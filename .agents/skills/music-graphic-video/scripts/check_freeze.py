#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""静止画面检测：找出预览或成片里“画面完全不动”超过上限的片段。

用法：
  python3 check_freeze.py 预览.mp4 [--limit 1.5] [--hook 15 --hook-limit 1.0]
                          [--allow 31.2-33.6 --allow 58-60.4] [--allow-limit 2.5] [--noise=-55dB] [--fps 30]
  python3 check_freeze.py --selftest

规则（对应 SKILL.md 红线 1）：
- 全片任何画面完全静止不超过 --limit 秒（默认 1.5）。
- 开头 --hook 秒（默认 15）内不超过 --hook-limit 秒（默认 1.0）。
- 用 --allow 登记的爆点定格区间，静止上限放宽到 --allow-limit 秒（默认 2.5）。登记在钩子区内会给出提醒。

原理：ffmpeg 的 freezedetect 滤镜把每一帧和“静止开始时的参考帧”比较，差异低于 --noise 就算没动，
所以缓慢的推拉镜头会在累计出可见变化后被判为“在动”。

阈值实测（540×960、H.264 CRF 16～23）：
- -55dB（默认）：3 秒推 1% 的极慢推镜判为在动；编码噪声不会把一段静止切碎。
- -60dB：编码噪声偶尔会把一段 2 秒的静止切成两段 1 秒，漏报超限（脚本会合并相邻片段兜底）。
- -50dB 及更宽：3 秒推 1% 的慢推开始被误判为静止。
叠加了颗粒、噪点这类全屏随机纹理时，画面永远不会被判为静止：先关掉纹理层渲预览，或者接受这一点。

依赖：ffmpeg / ffprobe（PATH 里，或用环境变量 FFMPEG / FFPROBE 指定），Python 3.8+。
退出码：0 全部通过，1 有超限片段，2 参数或运行错误。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
FFPROBE = os.environ.get("FFPROBE", "ffprobe")


def fail(msg: str) -> int:
    print(f"错误：{msg}", file=sys.stderr)
    return 2


def video_duration(path: str) -> float:
    p = subprocess.run([FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=duration:format=duration", "-of", "json", path],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode("utf-8", "replace").strip())
    data = json.loads(p.stdout.decode("utf-8", "replace") or "{}")
    streams = data.get("streams") or []
    if not streams:
        raise RuntimeError(f"{path} 里没有视频流")
    d = streams[0].get("duration") or (data.get("format") or {}).get("duration")
    return float(d or 0.0)


def detect(path: str, noise: str, min_d: float) -> list:
    cmd = [FFMPEG, "-hide_banner", "-nostats", "-i", path, "-map", "0:v:0",
           "-vf", f"freezedetect=n={noise}:d={min_d}", "-an", "-f", "null", "-"]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        tail = p.stderr.decode("utf-8", "replace").strip().splitlines()[-5:]
        raise RuntimeError("ffmpeg 运行失败：\n" + "\n".join(tail))
    text = p.stderr.decode("utf-8", "replace")
    events, cur = [], None
    for m in re.finditer(r"lavfi\.freezedetect\.freeze_(start|duration|end):\s*([0-9.]+)", text):
        key, val = m.group(1), float(m.group(2))
        if key == "start":
            if cur is not None:
                events.append(cur)
            cur = {"start": val, "end": None}
        elif key == "end" and cur is not None:
            cur["end"] = val
            events.append(cur)
            cur = None
    if cur is not None:
        events.append(cur)  # 静止一直持续到片尾，ffmpeg 不会输出 freeze_end
    return events


def merge(events: list, duration: float, gap: float) -> list:
    """把首尾相接的静止片段合并：编码噪声会让一段连续静止被切成几段。"""
    out = []
    for ev in events:
        start = ev["start"]
        end = ev["end"] if ev["end"] is not None else duration
        if out and start - out[-1][1] <= gap:
            out[-1][1] = max(out[-1][1], end)
        else:
            out.append([start, end])
    return out


def parse_range(s: str) -> tuple:
    m = re.fullmatch(r"\s*([0-9.]+)\s*-\s*([0-9.]+)\s*", s)
    if not m or float(m.group(2)) <= float(m.group(1)):
        raise argparse.ArgumentTypeError(f"区间格式应为 开始-结束（秒），例如 31.2-33.6，收到：{s}")
    return float(m.group(1)), float(m.group(2))


def evaluate(video: str, limit: float, hook: float, hook_limit: float, allow: list, allow_limit: float,
             noise: str, fps: int) -> tuple:
    """返回（时长，最短检测时长，[(开始, 结束, 时长, 区域, 上限, 是否通过)]）。"""
    duration = video_duration(video)
    min_d = max(0.1, min(limit, hook_limit) - 0.05)
    rows = []
    for start, end in merge(detect(video, noise, min_d), duration, 2.5 / fps):
        dur = end - start
        allowed = next(((a0, a1) for a0, a1 in allow if start >= a0 - 0.2 and end <= a1 + 0.2), None)
        if allowed:
            lim, zone = allow_limit, "爆点定格"
        elif start < hook:
            lim, zone = hook_limit, "钩子区"
        else:
            lim, zone = limit, "正文"
        rows.append((start, end, dur, zone, lim, dur <= lim + 1.0 / fps))
    return duration, min_d, rows


def selftest() -> int:
    """合成一段 20 秒的测试视频，在已知位置冻结画面，检查判定结果。"""
    fps = 30
    # (首帧, 末帧) → 冻结时段；钩子区设为前 6 秒
    freezes = [(60, 98), (240, 299), (360, 425), (480, 515), (555, 599)]
    expect = [("钩子区", False), ("正文", False), ("爆点定格", True), ("正文", True), ("正文", True)]
    chain, last = [], "0:v"
    for k, (a, b) in enumerate(freezes):
        chain.append(f"[{last}]split=2[s{k}][r{k}];[s{k}][r{k}]freezeframes=first={a}:last={b}:replace={a}[v{k}]")
        last = f"v{k}"
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "freeze.mkv")
        base = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
                "-i", f"testsrc2=size=270x480:rate={fps}:duration=20", "-filter_complex", ";".join(chain),
                "-map", f"[{last}]"]
        p = subprocess.run(base + ["-c:v", "libx264", "-pix_fmt", "yuv420p", path], stderr=subprocess.PIPE)
        if p.returncode != 0:  # 没有 libx264 时退回无损的 ffv1
            p = subprocess.run(base + ["-c:v", "ffv1", path], stderr=subprocess.PIPE)
            if p.returncode != 0:
                print("✗ 生成测试视频失败：" + p.stderr.decode("utf-8", "replace").strip()[-300:])
                return 1
        _, _, rows = evaluate(path, 1.5, 6.0, 1.0, [(12.0, 14.4)], 2.5, "-55dB", fps)
    got = [(r[3], r[5]) for r in rows]
    ok = got == expect
    for (a, b), r in zip(freezes, rows):
        print(f"  冻结 {a / fps:.2f}–{(b + 1) / fps:.2f} s → 检测 {r[0]:.2f}–{r[1]:.2f} s，{r[3]}，{'通过' if r[5] else '超限'}")
    print(f"{'✓' if ok else '✗'} 判定：期望 {expect}，实测 {got}")
    print(f"\n{1 if ok else 0}/1 项通过")
    return 0 if ok else 1


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="静止画面检测（freezedetect）")
    ap.add_argument("video", nargs="?", help="预览或成片（建议先用 Remotion --scale=0.5 渲一个低清预览）")
    ap.add_argument("--limit", type=float, default=1.5, help="全片静止上限（秒，默认 1.5）")
    ap.add_argument("--hook", type=float, default=15.0, help="钩子区长度（秒，默认 15）")
    ap.add_argument("--hook-limit", type=float, default=1.0, help="钩子区静止上限（秒，默认 1.0）")
    ap.add_argument("--allow", type=parse_range, action="append", default=[],
                    help="登记的爆点定格区间（秒），可重复，例如 --allow 31.2-33.6")
    ap.add_argument("--allow-limit", type=float, default=2.5, help="爆点定格的静止上限（秒，默认 2.5）")
    ap.add_argument("--noise", default="-55dB",
                    help="判定为“没动”的差异阈值（默认 -55dB）。负数要写成 --noise=-60dB，否则会被当成参数名")
    ap.add_argument("--fps", type=int, default=30, help="用于换算帧号（默认 30）")
    ap.add_argument("--selftest", action="store_true", help="用合成视频验算本脚本")
    args = ap.parse_args(argv)

    for tool in (FFMPEG, FFPROBE):
        if shutil.which(tool) is None and not os.path.isfile(tool):
            return fail(f"找不到 {tool}。请安装 ffmpeg，或用环境变量 FFMPEG / FFPROBE 指定路径。")
    if args.selftest:
        return selftest()
    if not args.video:
        ap.error("需要一个视频文件")
    if not os.path.isfile(args.video):
        return fail(f"找不到文件：{args.video}")
    try:
        duration, min_d, rows = evaluate(args.video, args.limit, args.hook, args.hook_limit, args.allow,
                                         args.allow_limit, args.noise, args.fps)
    except RuntimeError as e:
        return fail(str(e))

    for a0, a1 in args.allow:
        if a0 < args.hook:
            print(f"提醒：定格区间 {a0:.2f}–{a1:.2f} s 在前 {args.hook:g} 秒的钩子区里。"
                  "钩子区尽量不要完全定格，用慢推代替。")
    bad = sum(1 for r in rows if not r[5])

    print(f"# 静止画面检测：{os.path.basename(args.video)}")
    print()
    print(f"时长 {duration:.2f} s ｜ 上限：正文 {args.limit:g} s、钩子区（前 {args.hook:g} s）{args.hook_limit:g} s、"
          f"爆点定格 {args.allow_limit:g} s ｜ 阈值 {args.noise}")
    print()
    if not rows:
        print(f"没有发现超过 {min_d:.2f} s 的静止片段。")
        return 0
    print("| 时间段 | 帧 | 时长 | 区域 | 上限 | 判定 |")
    print("|---|---|---|---|---|---|")
    for start, end, dur, zone, limit, ok in rows:
        print(f"| {start:.2f}–{end:.2f} s | {round(start * args.fps)}–{round(end * args.fps)} | {dur:.2f} s | "
              f"{zone} | {limit:g} s | {'通过' if ok else '超限'} |")
    print()
    if bad:
        print(f"{bad} 段超限：给这些画面加微动（慢推、漂移、局部元素动画），或者把确实要定格的爆点用 --allow 登记。")
        return 1
    print("全部在上限以内。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
