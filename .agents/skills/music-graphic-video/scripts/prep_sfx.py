#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""音效预处理：去头尾静音 → 按动作截短 → 5 ms 淡入 + 短淡出 → 峰值归一化 → 48 kHz 立体声 WAV，并记录许可证。

用法：
  批量（推荐）：python3 prep_sfx.py --manifest sfx.csv --out-dir public/<合成名>/sfx [--peak -6]
  单个文件：    python3 prep_sfx.py 原始.wav -o public/<合成名>/sfx/click.wav --max 0.25 --license CC0 --source URL
  自检：        python3 prep_sfx.py --selftest

清单 CSV 的列（第一行是表头）：
  name,src,max_len,fade_out,license,source_url,author,note
  - name：输出文件名（不带扩展名），例如 stamp_hit
  - max_len：截短后的最长秒数，按动作给：点击 0.15～0.3、翻页/纸张 0.4～0.8、印章 0.3～0.6、转场嗖声 0.5～1.0
  - fade_out：淡出秒数，留空时取 max_len 的 25%（不超过 0.12 s）
  - license：只接受 CC0（含 “CC0 1.0”“Creative Commons 0”等写法）；要放行别的许可证用 --allow-license

为什么用峰值归一化：BS.1770 的响度按 400 ms 一块来测，短于 0.4 秒的音效测不出有效的综合响度。
统一到 -6 dBFS 峰值以后，混音电平在 Remotion 里用 volume 按 BGM 调（通常从 0.3～0.5 起试）。

依赖：ffmpeg / ffprobe（PATH 里，或用环境变量 FFMPEG / FFPROBE 指定），Python 3.8+。
退出码：0 全部成功；1 有文件被拒绝或处理失败；2 参数错误。
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
FFPROBE = os.environ.get("FFPROBE", "ffprobe")
CC0_ALIASES = ("CC0", "CREATIVECOMMONS0", "CCZERO", "PUBLICDOMAINDEDICATION")


class SfxError(Exception):
    pass


def run(cmd: list) -> str:
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        tail = p.stderr.decode("utf-8", "replace").strip().splitlines()[-4:]
        raise SfxError("ffmpeg 失败：" + " / ".join(tail))
    return p.stderr.decode("utf-8", "replace")


def duration(path: str) -> float:
    p = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "json", path],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise SfxError(f"读不了 {path}：" + p.stderr.decode("utf-8", "replace").strip())
    return float((json.loads(p.stdout or b"{}").get("format") or {}).get("duration") or 0.0)


def peak_db(path: str) -> float:
    log = run([FFMPEG, "-hide_banner", "-nostats", "-i", path, "-af", "volumedetect", "-f", "null", "-"])
    m = re.search(r"max_volume:\s*(-?[\d.]+|-inf) dB", log)
    if not m or m.group(1) == "-inf":
        return float("-inf")
    return float(m.group(1))


def license_ok(lic: str, allowed: list) -> bool:
    norm = re.sub(r"[\s\-_.]", "", (lic or "").upper())
    if any(norm.startswith(a) for a in CC0_ALIASES):
        return True
    return any(norm == re.sub(r"[\s\-_.]", "", a.upper()) for a in allowed)


def process(src: str, dst: str, max_len: float, fade_out: float | None, peak: float, threshold: float) -> dict:
    if not os.path.isfile(src):
        raise SfxError(f"找不到源文件 {src}")
    if max_len <= 0:
        raise SfxError("max_len 必须大于 0")
    fo = fade_out if fade_out is not None else min(0.12, 0.25 * max_len)
    fo = max(0.005, min(fo, max_len * 0.9))
    before = duration(src)
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        tmp = os.path.join(d, "trim.wav")
        chain = ",".join([
            "aformat=sample_fmts=fltp:channel_layouts=stereo",
            "aresample=48000",
            f"silenceremove=start_periods=1:start_threshold={threshold}dB:start_silence=0.005",
            "areverse",
            f"silenceremove=start_periods=1:start_threshold={threshold}dB:start_silence=0.02",
            "areverse",
            f"atrim=0:{max_len}",
            "afade=t=in:d=0.005",
            "areverse", f"afade=t=in:d={fo}", "areverse",  # 在结尾淡出，不需要先知道长度
        ])
        run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-af", chain, "-c:a", "pcm_f32le", tmp])
        after = duration(tmp)
        if after <= 0.005:
            raise SfxError(f"整段都低于 {threshold} dB，去静音后什么都不剩，检查文件或调低 --threshold")
        p0 = peak_db(tmp)
        if p0 == float("-inf"):
            raise SfxError("处理后是纯静音")
        gain = peak - p0
        run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", tmp, "-af", f"volume={gain:.2f}dB",
             "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", dst])
    return {"before": before, "after": duration(dst), "fade_out": fo, "gain": gain, "peak": peak_db(dst)}


def write_credits(path: str, rows: list) -> None:
    cols = ["name", "file", "duration", "peak_dbfs", "license", "source_url", "author", "src", "note"]
    with open(path, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in cols})


def batch(manifest: str, out_dir: str, peak: float, threshold: float, allowed: list, credits: str | None) -> int:
    base = os.path.dirname(os.path.abspath(manifest))
    with open(manifest, "r", encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    need = {"name", "src", "max_len", "license"}
    if not rows or not need.issubset(rows[0].keys()):
        raise SfxError(f"清单缺少列：{', '.join(sorted(need))}（第一行必须是表头）")
    done, bad = [], 0
    print("| 名称 | 原长 | 处理后 | 淡出 | 增益 | 峰值 | 许可证 | 结果 |")
    print("|---|---|---|---|---|---|---|---|")
    for r in rows:
        name = (r.get("name") or "").strip()
        lic = (r.get("license") or "").strip()
        if not name:
            continue
        if not re.fullmatch(r"[A-Za-z0-9_\-]+", name):
            print(f"| {name} | — | — | — | — | — | {lic} | 拒绝：name 只能用字母、数字、下划线和连字符 |")
            bad += 1
            continue
        if not license_ok(lic, allowed):
            print(f"| {name} | — | — | — | — | — | {lic or '（空）'} | 拒绝：不是 CC0，换素材或用 --allow-license 明确放行 |")
            bad += 1
            continue
        src = r["src"].strip()
        src = src if os.path.isabs(src) else os.path.join(base, src)
        dst = os.path.join(out_dir, f"{name}.wav")
        try:
            fo = (r.get("fade_out") or "").strip()
            res = process(src, dst, float(r["max_len"]), float(fo) if fo else None, peak, threshold)
        except (SfxError, ValueError) as e:
            print(f"| {name} | — | — | — | — | — | {lic} | 失败：{e} |")
            bad += 1
            continue
        print(f"| {name} | {res['before']:.2f} s | {res['after']:.3f} s | {res['fade_out']:.3f} s | "
              f"{res['gain']:+.1f} dB | {res['peak']:.1f} dBFS | {lic} | 已写入 {os.path.relpath(dst)} |")
        done.append({"name": name, "file": os.path.relpath(dst, out_dir), "duration": f"{res['after']:.3f}",
                     "peak_dbfs": f"{res['peak']:.1f}", "license": lic, "source_url": r.get("source_url", ""),
                     "author": r.get("author", ""), "src": r["src"], "note": r.get("note", "")})
    credits = credits or os.path.join(out_dir, "sfx-credits.csv")
    if done:
        write_credits(credits, done)
        print(f"\n来源与许可证记录：{os.path.relpath(credits)}")
    return 1 if bad else 0


def selftest() -> int:
    results = []

    def check(name, ok, detail):
        results.append(ok)
        print(f"{'✓' if ok else '✗'} {name}：{detail}")

    with tempfile.TemporaryDirectory() as d:
        raw = os.path.join(d, "raw.wav")
        # 0.5 s 静音 + 0.3 s 噪声脉冲（指数衰减）+ 1.0 s 静音，峰值约 -12 dBFS
        expr = "if(between(t,0.5,0.8),0.25*(2*random(0)-1)*exp(-12*(t-0.5)),0)"
        run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
             "-i", f"aevalsrc='{expr}':s=44100:d=1.8", "-c:a", "pcm_s16le", raw])
        out = os.path.join(d, "hit.wav")
        res = process(raw, out, 0.25, None, -6.0, -50.0)
        check("截短", 0.2 <= res["after"] <= 0.26, f"原长 {res['before']:.2f} s，max_len 0.25 → {res['after']:.3f} s")
        check("峰值归一化", abs(res["peak"] + 6.0) <= 0.3, f"目标 -6 dBFS，实测 {res['peak']:.2f}")
        out2 = os.path.join(d, "full.wav")
        res2 = process(raw, out2, 5.0, None, -6.0, -50.0)
        check("去头尾静音", 0.2 <= res2["after"] <= 0.36, f"0.5 s 静音 + 0.3 s 声音 + 1.0 s 静音 → {res2['after']:.3f} s")
        manifest = os.path.join(d, "sfx.csv")
        with open(manifest, "w", encoding="utf-8", newline="") as fh:
            fh.write("name,src,max_len,fade_out,license,source_url,author,note\n")
            fh.write("ok_hit,raw.wav,0.3,,CC0 1.0,https://example.org/1,someone,\n")
            fh.write("bad_lic,raw.wav,0.3,,Pixabay Content License,https://example.org/2,someone,\n")
        out_dir = os.path.join(d, "sfx")
        devnull = open(os.devnull, "w")
        stdout, sys.stdout = sys.stdout, devnull
        try:
            code = batch(manifest, out_dir, -6.0, -50.0, [], None)
        finally:
            sys.stdout = stdout
            devnull.close()
        check("许可证过滤", code == 1 and os.path.isfile(os.path.join(out_dir, "ok_hit.wav"))
              and not os.path.isfile(os.path.join(out_dir, "bad_lic.wav")),
              "CC0 的写入，Pixabay 许可证的被拒绝")
        check("来源记录", os.path.isfile(os.path.join(out_dir, "sfx-credits.csv")), "生成 sfx-credits.csv")
    passed = sum(results)
    print(f"\n{passed}/{len(results)} 项通过")
    return 0 if passed == len(results) else 1


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="音效预处理：去静音、截短、淡出、峰值归一化，并记录许可证")
    ap.add_argument("src", nargs="?", help="单个文件模式：源文件")
    ap.add_argument("-o", "--output", help="单个文件模式：输出 WAV 路径")
    ap.add_argument("--max", type=float, help="单个文件模式：截短后的最长秒数")
    ap.add_argument("--fade-out", type=float, help="单个文件模式：淡出秒数（默认 max 的 25%%，不超过 0.12 s）")
    ap.add_argument("--license", default="", help="单个文件模式：许可证（只接受 CC0）")
    ap.add_argument("--source", default="", help="单个文件模式：来源网址（写进日志）")
    ap.add_argument("--manifest", help="批量模式：清单 CSV")
    ap.add_argument("--out-dir", help="批量模式：输出目录，例如 public/<合成名>/sfx")
    ap.add_argument("--credits", help="批量模式：来源记录 CSV 的路径（默认 <out-dir>/sfx-credits.csv）")
    ap.add_argument("--peak", type=float, default=-6.0, help="峰值归一化目标（dBFS，默认 -6）")
    ap.add_argument("--threshold", type=float, default=-50.0, help="判定静音的阈值（dB，默认 -50）")
    ap.add_argument("--allow-license", action="append", default=[], help="额外放行的许可证名称（需要用户同意）")
    ap.add_argument("--selftest", action="store_true", help="用合成音效验算本脚本")
    args = ap.parse_args(argv)
    for tool in (FFMPEG, FFPROBE):
        if shutil.which(tool) is None and not os.path.isfile(tool):
            print(f"错误：找不到 {tool}。请安装 ffmpeg，或用环境变量 FFMPEG / FFPROBE 指定路径。", file=sys.stderr)
            return 2
    try:
        if args.selftest:
            return selftest()
        if args.manifest:
            if not args.out_dir:
                ap.error("批量模式需要 --out-dir")
            return batch(args.manifest, args.out_dir, args.peak, args.threshold, args.allow_license, args.credits)
        if not (args.src and args.output and args.max):
            ap.error("单个文件模式需要：源文件、-o 输出路径、--max 秒数；或者用 --manifest 批量处理")
        if not license_ok(args.license, args.allow_license):
            print(f"拒绝：许可证“{args.license or '（空）'}”不是 CC0。换素材，或者经用户同意后用 --allow-license 放行。",
                  file=sys.stderr)
            return 1
        res = process(args.src, args.output, args.max, args.fade_out, args.peak, args.threshold)
        print(f"{args.output}：{res['before']:.2f} s → {res['after']:.3f} s，淡出 {res['fade_out']:.3f} s，"
              f"增益 {res['gain']:+.1f} dB，峰值 {res['peak']:.1f} dBFS，许可证 {args.license}"
              + (f"，来源 {args.source}" if args.source else ""))
        return 0
    except SfxError as e:
        print(f"错误：{e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
