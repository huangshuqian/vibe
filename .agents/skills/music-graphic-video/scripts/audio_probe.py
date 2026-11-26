#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""BGM 体检：响度 / True Peak / BPM / 能量走势 / 气口，以及 1～2 首歌的衔接方案。

用法：
  python3 audio_probe.py A.mp3 [B.mp3] [--target 秒] [--fps 30] [--switch-at 0.5] [--out 报告.md] [--json 结果.json]
  python3 audio_probe.py 成片.mp4 --master        # 成片复测：True Peak、响度、超限时间段
  python3 audio_probe.py --selftest               # 用已知答案的合成信号验算本脚本

依赖：ffmpeg / ffprobe（在 PATH 里，或用环境变量 FFMPEG / FFPROBE 指定），Python 3.8+，numpy。

约定：
- 时间单位都是秒（帧号按 --fps 换算）。
- 音量系数是线性振幅倍数，对应 Remotion 的 volume：系数 = 10^(增益dB/20)。只压不抬，系数永远 <= 1。
- BPM、小节首拍、气口都是估计值，必须在 Studio 里听辨确认。
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field

try:
    import numpy as np
except ImportError:  # main() 里给出明确提示
    np = None

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
FFPROBE = os.environ.get("FFPROBE", "ffprobe")

SR = 22050           # 分析用采样率（单声道）
N_FFT = 1024
HOP = 256
FR = SR / HOP        # 分析帧率，约 86.1 帧/秒
ABS_GATE = -70.0     # BS.1770 绝对门限（LUFS）
SILENCE_DB = -45.0   # 200 ms RMS 低于这个 dBFS 视为静音
EDGE_SILENCE_DB = -50.0  # 判断开头/结尾静音用（10 ms RMS）


class ProbeError(Exception):
    pass


# ----------------------------------------------------------------------------
# 基础工具
# ----------------------------------------------------------------------------

def need_tools(numpy_needed: bool = True) -> None:
    missing = [t for t in (FFMPEG, FFPROBE) if shutil.which(t) is None and not os.path.isfile(t)]
    if missing:
        raise ProbeError("找不到 " + "、".join(missing) + "。请安装 ffmpeg，"
                         "或用环境变量 FFMPEG / FFPROBE 指定可执行文件路径。")
    if numpy_needed and np is None:
        raise ProbeError("缺少 numpy，请先运行：python3 -m pip install numpy")


def run(cmd: list) -> subprocess.CompletedProcess:
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        tail = p.stderr.decode("utf-8", "replace").strip().splitlines()[-6:]
        raise ProbeError("命令失败：" + " ".join(str(c) for c in cmd[:4]) + " …\n" + "\n".join(tail))
    return p


def _num(s: str) -> float:
    try:
        return float(s)
    except ValueError:
        return float("-inf") if "inf" in s else float("nan")


def db_to_coef(db: float) -> float:
    return 10.0 ** (db / 20.0)


def lufs_mean(values) -> float | None:
    """能量域平均（BS.1770 的块平均方式），忽略低于绝对门限的块。"""
    v = np.asarray(values, dtype=float)
    v = v[np.isfinite(v) & (v > ABS_GATE)]
    if v.size == 0:
        return None
    return float(10.0 * np.log10(np.mean(10.0 ** (v / 10.0))))


def gated_lufs(values) -> float | None:
    """对一段 momentary 块做 BS.1770 门限积分（-70 绝对门限 + -10 相对门限）。"""
    v = np.asarray(values, dtype=float)
    v = v[np.isfinite(v) & (v > ABS_GATE)]
    if v.size == 0:
        return None
    rel = 10.0 * np.log10(np.mean(10.0 ** (v / 10.0))) - 10.0
    v = v[v > rel]
    return float(10.0 * np.log10(np.mean(10.0 ** (v / 10.0)))) if v.size else None


def moving_avg(x, w: int):
    w = max(1, int(w))
    x = np.asarray(x, dtype=np.float64)
    c = np.concatenate([[0.0], np.cumsum(x)])
    half = w // 2
    idx = np.arange(len(x))
    lo = np.clip(idx - half, 0, len(x))
    hi = np.clip(idx + half + 1, 0, len(x))
    return (c[hi] - c[lo]) / np.maximum(hi - lo, 1)


def gauss_smooth(x, sigma: float):
    r = int(3 * sigma) + 1
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    return np.convolve(x, k, mode="same")


def nearest(grid, t: float, tol: float):
    """返回 grid 里离 t 最近且在 tol 以内的值，没有则返回 None。"""
    if grid is None or len(grid) == 0:
        return None
    i = int(np.searchsorted(grid, t))
    best = None
    for j in (i - 1, i):
        if 0 <= j < len(grid) and (best is None or abs(grid[j] - t) < abs(grid[best] - t)):
            best = j
    if best is not None and abs(grid[best] - t) <= tol:
        return float(grid[best])
    return None


# ----------------------------------------------------------------------------
# 测量
# ----------------------------------------------------------------------------

def ffprobe_info(path: str) -> dict:
    p = run([FFPROBE, "-v", "error", "-show_entries",
             "stream=index,codec_type,codec_name,sample_rate,channels,duration:"
             "stream_disposition=attached_pic:format=duration",
             "-of", "json", path])
    data = json.loads(p.stdout.decode("utf-8", "replace") or "{}")
    streams = data.get("streams", [])
    audio = [s for s in streams if s.get("codec_type") == "audio"]
    video = [s for s in streams if s.get("codec_type") == "video"
             and not (s.get("disposition") or {}).get("attached_pic")]
    if not audio:
        raise ProbeError(f"{path} 里没有音频流")
    a = audio[0]
    fmt_dur = float((data.get("format") or {}).get("duration") or 0.0)
    a_dur = float(a.get("duration") or 0.0) or fmt_dur
    v_dur = float(video[0].get("duration") or 0.0) if video else None
    return {"codec": a.get("codec_name"), "sample_rate": int(a.get("sample_rate") or 0),
            "channels": int(a.get("channels") or 0), "duration": a_dur,
            "video_duration": v_dur}


_N = r"(-?(?:inf|nan|\d+(?:\.\d+)?))"
_FRAME_RE = re.compile(r"\bt:\s*(\d+(?:\.\d+)?).*?\bM:\s*" + _N + r"\s+S:\s*" + _N)
_FTPK_RE = re.compile(r"FTPK:\s*((?:-?(?:inf|nan|\d+(?:\.\d+)?)\s+)+)dBFS")


def ebur128_scan(path: str):
    """一次 ffmpeg ebur128 扫描：综合响度、LRA、峰值，以及每 100 ms 的 momentary 响度和帧 True Peak。"""
    p = run([FFMPEG, "-hide_banner", "-nostats", "-i", path, "-map", "0:a:0",
             "-af", "ebur128=peak=true+sample", "-f", "null", "-"])
    text = p.stderr.decode("utf-8", "replace")
    t, m, tp = [], [], []
    for line in text.splitlines():
        if "Parsed_ebur128" not in line:
            continue
        mm = _FRAME_RE.search(line)
        if not mm:
            continue
        ft = _FTPK_RE.search(line)
        peaks = [_num(x) for x in ft.group(1).split()] if ft else []
        t.append(float(mm.group(1)))
        m.append(_num(mm.group(2)))
        tp.append(max(peaks) if peaks else float("nan"))
    summ = text[text.rfind("Summary:"):] if "Summary:" in text else ""

    def grab(pattern: str) -> float:
        mm = re.search(pattern, summ)
        return _num(mm.group(1)) if mm else float("nan")

    summary = {
        "I": grab(r"Integrated loudness:\s*\n\s*I:\s*" + _N),
        "LRA": grab(r"Loudness range:\s*\n\s*LRA:\s*" + _N),
        "SP": grab(r"Sample peak:\s*\n\s*Peak:\s*" + _N),
        "TP": grab(r"True peak:\s*\n\s*Peak:\s*" + _N),
    }
    t = np.asarray(t, dtype=float)
    m = np.asarray(m, dtype=float)
    tp = np.asarray(tp, dtype=float)
    full = t >= 0.4 - 1e-6  # 前 400 ms 的 momentary 块不完整
    series = {"m_t": t[full] - 0.2,  # 400 ms 块的中心
              "m": m[full],
              "pk_t": t - 0.05,       # 100 ms 帧的中心
              "pk": tp}
    return summary, series


def decode_mono(path: str):
    p = run([FFMPEG, "-v", "error", "-i", path, "-map", "0:a:0", "-ac", "1", "-ar", str(SR),
             "-f", "f32le", "-"])
    return np.frombuffer(p.stdout, dtype="<f4").astype(np.float32)


def edge_silence(y):
    """开头静音长度、结尾静音起点（10 ms RMS，阈值 -50 dBFS）。"""
    w = int(0.01 * SR)
    n = len(y) // w
    if n == 0:
        return 0.0, len(y) / SR
    blocks = y[: n * w].reshape(n, w).astype(np.float64)
    db = 10.0 * np.log10((blocks ** 2).mean(axis=1) + 1e-12)
    loud = np.nonzero(db > EDGE_SILENCE_DB)[0]
    if loud.size == 0:
        return 0.0, 0.0
    return loud[0] * w / SR, (loud[-1] + 1) * w / SR


def frame_features(y):
    """分析帧网格上的：时间、全频谱通量、低频（<150 Hz）谱通量、200 ms 均方值。"""
    if len(y) < N_FFT:
        y = np.pad(y, (0, N_FFT - len(y)))
    y = np.ascontiguousarray(y, dtype=np.float32)
    n_frames = 1 + (len(y) - N_FFT) // HOP
    frames = np.lib.stride_tricks.as_strided(
        y, shape=(n_frames, N_FFT), strides=(y.strides[0] * HOP, y.strides[0]), writeable=False)
    win = np.hanning(N_FFT).astype(np.float32)
    low_bins = int(150 * N_FFT / SR) + 1
    flux = np.empty(n_frames, dtype=np.float64)
    flux_low = np.empty(n_frames, dtype=np.float64)
    prev = None
    chunk = 2048
    for s in range(0, n_frames, chunk):
        e = min(n_frames, s + chunk)
        logm = np.log1p(100.0 * np.abs(np.fft.rfft(frames[s:e] * win, axis=1)))
        stacked = logm if prev is None else np.vstack([prev, logm])
        d = np.diff(stacked, axis=0)
        if prev is None:
            d = np.vstack([np.zeros((1, d.shape[1])), d])
        d = np.maximum(d, 0.0)
        flux[s:e] = d.sum(axis=1)
        flux_low[s:e] = d[:, 1:low_bins].sum(axis=1)
        prev = logm[-1:]
    # 谱通量描述的是第 i-1 帧到第 i 帧之间的变化，时间取两帧中心的中点
    times = (np.arange(n_frames) * HOP + N_FFT / 2 - HOP / 2) / SR
    c = np.concatenate([[0.0], np.cumsum(y.astype(np.float64) ** 2)])
    centers = np.arange(n_frames) * HOP + N_FFT // 2
    half = int(0.1 * SR)
    lo = np.clip(centers - half, 0, len(y))
    hi = np.clip(centers + half, 0, len(y))
    ms = (c[hi] - c[lo]) / np.maximum(hi - lo, 1)
    return times, flux, flux_low, ms


# ----------------------------------------------------------------------------
# 节奏：BPM、拍点、小节首拍
# ----------------------------------------------------------------------------

def _tempo_prior(bpm: float) -> float:
    # 以 120 BPM 为中心、标准差 1 个八度的对数高斯先验，用来在半速/倍速之间取舍
    return math.exp(-0.5 * (math.log2(bpm / 120.0)) ** 2)


def _comb(env_s, period: float, n_phase: int = 48):
    idx = np.arange(len(env_s))
    k = np.arange(int((len(env_s) - 1) / period))
    phases = np.linspace(0.0, period, n_phase, endpoint=False)
    pos = phases[:, None] + k[None, :] * period
    vals = np.interp(pos, idx, env_s).mean(axis=1)
    j = int(np.argmax(vals))
    return float(vals[j]), float(phases[j])


def analyze_rhythm(times, flux, flux_low):
    env = np.maximum(flux - moving_avg(flux, int(0.5 * FR)), 0.0)
    n = len(env)
    if n < 8 * FR or env.max() <= 0:
        return None
    x = env - env.mean()
    nfft = 1 << int(math.ceil(math.log2(2 * n)))
    spec = np.fft.rfft(x, nfft)
    ac = np.fft.irfft(spec * np.conj(spec), nfft)[:n]
    if ac[0] <= 0:
        return None
    ac = ac / ac[0]
    lo = max(2, int(FR * 60 / 240))
    hi = min(n - 2, int(math.ceil(FR * 60 / 40)))
    cands = []
    for i in range(lo, hi + 1):
        if ac[i] > ac[i - 1] and ac[i] >= ac[i + 1] and ac[i] > 0:
            a, b, c = ac[i - 1], ac[i], ac[i + 1]
            den = a - 2 * b + c
            off = 0.5 * (a - c) / den if den != 0 else 0.0
            lag = i + off
            bpm = 60.0 * FR / lag
            if 40.0 <= bpm <= 240.0:
                cands.append({"bpm": bpm, "acf": float(b - 0.25 * (a - c) * off)})
    if not cands:
        return None
    for cnd in cands:
        cnd["score"] = cnd["acf"] * _tempo_prior(cnd["bpm"])
    cands.sort(key=lambda d: -d["score"])
    best = cands[0]

    # 用整首歌的梳状滤波把 BPM 精确到 0.01，并求出拍点相位
    env_s = gauss_smooth(env, 1.0)
    grid = np.arange(best["bpm"] * 0.97, best["bpm"] * 1.03, 0.05)
    coarse = max(((_comb(env_s, 60.0 * FR / b, 24)[0], b) for b in grid))
    fine = np.arange(coarse[1] - 0.06, coarse[1] + 0.06, 0.005)
    score, bpm = max(((_comb(env_s, 60.0 * FR / b)[0], b) for b in fine))
    period = 60.0 * FR / bpm
    _, phase = _comb(env_s, period, 96)
    beat_frames = np.arange(phase % period, n - 1, period)
    beat_times = np.interp(beat_frames, np.arange(n), times)

    # 拍点和实际起音的贴合度（只看起音明显的拍）。对恒定速度的音乐，这比 ACF 数值更能说明 BPM 对不对：
    # 随机起音的中位偏差约为 1/8 拍（108 BPM 时约 70 ms），真实节拍通常在 20 ms 以内。
    thr = np.percentile(env_s, 75)
    offs = []
    hits = 0
    for bf in beat_frames:
        a = int(max(0, bf - period / 4))
        b = int(min(n - 1, bf + period / 4))
        if b <= a:
            continue
        j = a + int(np.argmax(env_s[a:b + 1]))
        if env_s[j] >= thr:
            off = (j - bf) / FR * 1000.0
            offs.append(off)
            if abs(off) <= 40.0:
                hits += 1
    fit_ms = float(np.median(np.abs(offs))) if offs else None
    hit_rate = hits / max(1, len(beat_frames))
    drift_ms = None
    if len(offs) >= 15:
        third = len(offs) // 3
        drift_ms = float(np.median(offs[-third:]) - np.median(offs[:third]))

    # 半速/倍速候选
    def acf_at(b: float) -> float | None:
        lag = 60.0 * FR / b
        if lag < 1 or lag >= n - 1:
            return None
        return float(np.interp(lag, np.arange(n), ac))

    related = []
    for mult, label in ((0.5, "半速"), (2.0, "倍速")):
        b = bpm * mult
        if 40.0 <= b <= 240.0:
            related.append({"bpm": b, "label": label, "acf": acf_at(b)})
    # 半速/倍速是否也说得通：加权得分接近，或者（只对半速）原始 ACF 不比当前估计低。
    # 半拍感（half-time）在流行和电子乐里很常见；倍速超过 180 BPM 的 BGM 很少，所以倍速只看加权得分。
    ambiguous = None
    for r in related:
        if r["acf"] is None or best["acf"] <= 0:
            continue
        weighted_close = r["acf"] * _tempo_prior(r["bpm"]) >= 0.85 * best["acf"] * _tempo_prior(best["bpm"])
        raw_close = r["label"] == "半速" and r["bpm"] >= 50.0 and r["acf"] >= 0.95 * best["acf"]
        if weighted_close or raw_close:
            ambiguous = r
    steady = drift_ms is None or abs(drift_ms) <= 25.0
    if fit_ms is not None and fit_ms <= 20.0 and hit_rate >= 0.5 and steady:
        conf = "高"
    elif fit_ms is not None and fit_ms <= 35.0 and hit_rate >= 0.3:
        conf = "中"
    else:
        conf = "低"
    if ambiguous is not None and conf == "高":
        conf = "中"

    # 小节首拍：4 种相位里低频起音最强的一种（按 4/4 估计）
    low = gauss_smooth(np.maximum(flux_low - moving_avg(flux_low, int(0.5 * FR)), 0.0), 1.0)
    strengths = []
    for bf in beat_frames:
        c0 = int(round(bf))
        strengths.append(float(low[max(0, c0 - 2): c0 + 3].max()) if c0 < n else 0.0)
    strengths = np.asarray(strengths)
    bar_phase, bar_ratio, bar_scores = 0, 1.0, [0.0, 0.0, 0.0, 0.0]
    if len(strengths) >= 8 and strengths.max() > 0:
        bar_scores = [float(strengths[j::4].mean()) for j in range(4)]
        order = np.argsort(bar_scores)[::-1]
        bar_phase = int(order[0])
        second = bar_scores[order[1]]
        bar_ratio = bar_scores[order[0]] / second if second > 0 else 9.9
    bar_conf = "高" if bar_ratio >= 1.3 else ("中" if bar_ratio >= 1.12 else "低")
    bar_times = beat_times[bar_phase::4]

    return {
        "bpm": float(bpm), "conf": conf, "acf": best["acf"],
        "candidates": [{"bpm": c["bpm"], "acf": c["acf"]} for c in cands[:4]],
        "related": related, "ambiguous": ambiguous,
        "beat_period": 60.0 / bpm, "bar_period": 240.0 / bpm,
        "beats": beat_times, "fit_ms": fit_ms, "drift_ms": drift_ms, "hit_rate": hit_rate,
        "bars": bar_times, "bar_phase": bar_phase, "bar_ratio": float(bar_ratio),
        "bar_scores": bar_scores, "bar_conf": bar_conf,
        "env": env_s,
    }


# ----------------------------------------------------------------------------
# 气口、段落变化、能量表
# ----------------------------------------------------------------------------

@dataclass
class Breath:
    start: float
    end: float
    t_min: float
    depth: float
    min_db: float
    kind: str
    score: float
    next_onset: float
    phrase: float = 0.0       # 气口后第一个拍点（下一句的起点），没有可靠拍点时用最强起音
    phrase_kind: str = "起音"  # 小节首拍 / 拍点 / 起音


def find_breaths(times, ms, env, lead: float, tail: float):
    rms_db = 10.0 * np.log10(ms + 1e-12)
    ref_mean = 10.0 * np.log10(moving_avg(ms, int(5.0 * FR)) + 1e-12)
    # 局部“底噪”：±2.5 s 内 200 ms RMS 的第 20 百分位，用来排除拍与拍之间的正常起伏
    step = 20
    half = int(2.5 * FR)
    pts = np.arange(0, len(rms_db), step)
    p20 = np.array([np.percentile(rms_db[max(0, i - half): i + half + 1], 20) for i in pts])
    ref_low = np.interp(np.arange(len(rms_db)), pts, p20)
    depth = ref_mean - rms_db
    below_floor = ref_low - rms_db
    valid = (times > lead + 0.3) & (times < tail - 0.3)
    mask = valid & (((depth >= 6.0) & (below_floor >= 2.0)) | (rms_db <= SILENCE_DB))

    runs = []
    i = 0
    n = len(mask)
    gap = int(0.1 * FR)
    while i < n:
        if not mask[i]:
            i += 1
            continue
        j = i
        while j + 1 < n and (mask[j + 1] or (j + gap < n and mask[j + 1: j + gap + 1].any())):
            j += 1
        runs.append((i, j))
        i = j + 1

    out = []
    env_med = float(np.median(env)) if len(env) else 0.0
    for i0, i1 in runs:
        dur = times[i1] - times[i0]
        if dur < 0.12:
            continue
        seg = slice(i0, i1 + 1)
        k = i0 + int(np.argmin(rms_db[seg]))
        d = float(np.max(depth[seg]))
        mn = float(rms_db[k])
        if mn <= SILENCE_DB and dur >= 0.2:
            kind = "静音"
        elif d >= 12.0:
            kind = "深"
        else:
            kind = "中"
        score = min(d, 30.0) * math.sqrt(min(dur, 1.5)) + (10.0 if kind == "静音" else 0.0)
        a = i1
        b = min(len(env) - 1, i1 + int(0.6 * FR))
        nxt = times[i1]
        if b > a:
            j = a + int(np.argmax(env[a:b + 1]))
            if env[j] > 3.0 * env_med:
                nxt = times[j]
        out.append(Breath(float(times[i0]), float(times[i1]), float(times[k]), d, mn, kind, score, float(nxt)))
    return out


def find_changes(m_t, m, start: float, end: float, half: float = 4.0, min_lu: float = 3.0,
                 min_sep: float = 6.0):
    ts = np.arange(max(half, start + half), end - half, 0.5)
    diffs = []
    for tau in ts:
        before = lufs_mean(m[(m_t >= tau - half) & (m_t < tau)])
        after = lufs_mean(m[(m_t >= tau) & (m_t < tau + half)])
        before = ABS_GATE if before is None else before
        after = ABS_GATE if after is None else after
        diffs.append(after - before)
    diffs = np.asarray(diffs)
    picked = []
    for i in np.argsort(-np.abs(diffs)):
        if abs(diffs[i]) < min_lu:
            break
        if all(abs(ts[i] - ts[j]) >= min_sep for j in picked):
            picked.append(int(i))
    return [{"t": float(ts[i]), "delta": float(diffs[i])} for i in sorted(picked)]


def energy_table(tr, window: float):
    """每个时间窗的响度、峰值和律动强度。

    级别按这首歌自己的中位数来分（高 >= +1.5 LU，低 <= -2.5 LU），因为同一首歌里段落之间
    通常只差几个 LU；律动 = 窗内平均起音强度 / 全曲各窗中位数（>= 1.3 密，<= 0.7 疏），
    用来区分“同样响但更满”的高潮段和“同样响但稀疏”的铺垫段。
    """
    m_t, m = tr.series["m_t"], tr.series["m"]
    pk_t, pk = tr.series["pk_t"], tr.series["pk"]
    rows = []
    k = 0
    while k * window < tr.duration - 1e-6:
        t0 = k * window
        t1 = min(tr.duration, t0 + window)
        level = lufs_mean(m[(m_t >= t0) & (m_t < t1)])
        sel = pk[(pk_t >= t0) & (pk_t < t1)]
        sel = sel[np.isfinite(sel)]
        e = tr.env[(tr.env_t >= t0) & (tr.env_t < t1)]
        rows.append({"t0": t0, "t1": t1, "lufs": level,
                     "delta": None if level is None else level - tr.I,
                     "peak": float(sel.max()) if sel.size else None,
                     "onset": float(e.mean()) if e.size else 0.0})
        k += 1
    levels = [r["lufs"] for r in rows if r["lufs"] is not None and r["lufs"] > tr.I - 15.0]
    med = float(np.median(levels)) if levels else tr.I
    onsets = [r["onset"] for r in rows if r["lufs"] is not None and r["lufs"] > tr.I - 15.0]
    omed = float(np.median(onsets)) if onsets else 0.0
    for r in rows:
        if r["lufs"] is None or r["lufs"] <= tr.I - 15.0:
            r["label"], r["groove"], r["groove_label"] = "静", None, "—"
            continue
        rel = r["lufs"] - med
        r["label"] = "高" if rel >= 1.5 else ("低" if rel <= -2.5 else "中")
        g = r["onset"] / omed if omed > 0 else None
        r["groove"] = g
        r["groove_label"] = "—" if g is None else ("密" if g >= 1.3 else ("疏" if g <= 0.7 else "中"))
    return rows


# ----------------------------------------------------------------------------
# 单首音轨分析
# ----------------------------------------------------------------------------

@dataclass
class Track:
    path: str
    name: str
    info: dict
    summary: dict
    series: dict
    lead: float
    tail: float
    rhythm: dict | None
    breaths: list
    changes: list
    env_t: object = None   # 起音强度包络的时间轴（不写进 JSON）
    env: object = None
    table: list = field(default_factory=list)
    top_breaths: list = field(default_factory=list)

    @property
    def duration(self) -> float:
        return self.info["duration"]

    @property
    def I(self) -> float:
        return self.summary["I"]

    @property
    def TP(self) -> float:
        return self.summary["TP"]

    def snap(self, t: float) -> tuple:
        """优先吸附到小节首拍（容差半小节），否则吸附到拍点（容差半拍）。"""
        r = self.rhythm
        if r is None:
            return t, "未吸附"
        if r["bar_conf"] != "低":
            v = nearest(r["bars"], t, r["bar_period"] / 2)
            if v is not None:
                return v, "小节首拍"
        v = nearest(r["beats"], t, r["beat_period"] / 2)
        if v is not None:
            return v, "拍点"
        return t, "未吸附"

    def level(self, t0: float, t1: float) -> float | None:
        m_t, m = self.series["m_t"], self.series["m"]
        return gated_lufs(m[(m_t >= t0) & (m_t < t1)])

    def next_phrase(self, b: "Breath") -> tuple:
        """气口结束后的第一个拍点（1 拍以内），并标出它是不是小节首拍。"""
        r = self.rhythm
        if r is not None and r["conf"] != "低":
            beats = r["beats"]
            i = int(np.searchsorted(beats, b.end - 0.05))
            if i < len(beats) and beats[i] - b.end <= r["beat_period"]:
                t = float(beats[i])
                is_bar = r["bar_conf"] != "低" and nearest(r["bars"], t, 0.01) is not None
                return t, ("小节首拍" if is_bar else "拍点")
        return b.next_onset, "起音"


def analyze_track(path: str, window: float) -> Track:
    info = ffprobe_info(path)
    summary, series = ebur128_scan(path)
    if not math.isfinite(summary["I"]) or summary["I"] <= ABS_GATE:
        raise ProbeError(f"{os.path.basename(path)} 的综合响度测不出来（可能是静音文件）")
    y = decode_mono(path)
    lead, tail = edge_silence(y)
    times, flux, flux_low, ms = frame_features(y)
    rhythm = analyze_rhythm(times, flux, flux_low)
    env = rhythm["env"] if rhythm else gauss_smooth(np.maximum(flux, 0.0), 1.0)
    breaths = find_breaths(times, ms, env, lead, tail)
    changes = find_changes(series["m_t"], series["m"], lead, tail)
    tr = Track(path=path, name=os.path.basename(path), info=info, summary=summary, series=series,
               lead=lead, tail=tail, rhythm=rhythm, breaths=breaths, changes=changes,
               env_t=times, env=env)
    for c in tr.changes:
        c["snap"], c["snap_kind"] = tr.snap(c["t"])
    for b in tr.breaths:
        b.phrase, b.phrase_kind = tr.next_phrase(b)
    tr.table = energy_table(tr, window)
    top = sorted(tr.breaths, key=lambda b: -b.score)[:12]
    tr.top_breaths = sorted(top, key=lambda b: b.t_min)
    return tr


# ----------------------------------------------------------------------------
# 音量系数与衔接方案
# ----------------------------------------------------------------------------

def compute_gains(tracks: list, ceiling: float) -> list:
    """只压不抬：先把偏响的音轨压到最轻那首的响度，再保证每首的 True Peak 不超过上限。"""
    i_min = min(t.I for t in tracks)
    limits = [t.I + min(0.0, ceiling - t.TP) for t in tracks]
    target = min(min(limits), i_min)
    out = []
    for t in tracks:
        g = min(0.0, target - t.I)
        match = i_min - t.I
        extra = target - i_min
        reasons = []
        if len(tracks) == 1:
            if g < 0:
                reasons.append(f"True Peak {t.TP:.1f} dBTP 高于上限 {ceiling:.1f}，下压 {-g:.1f} dB")
            else:
                reasons.append("峰值有余量，保持原样")
        else:
            if match < -0.05:
                reasons.append(f"比另一首响 {-match:.1f} LU，压到同一响度")
            else:
                reasons.append("较轻的一首，作为响度基准")
            if extra < -0.05:
                reasons.append(f"受 True Peak 上限限制，两首再一起压 {-extra:.1f} dB")
        out.append({"gain_db": g, "coef": db_to_coef(g), "reason": "；".join(reasons),
                    "tp_after": t.TP + g})
    return out


def _cut_points(tr: Track) -> list:
    """可以收尾或切出的位置：气口（乐句末尾）和能量回落点（段落结束）。

    分数大致可比：气口 = 深度 × sqrt(时长)，回落 = 3 × |回落 LU|。
    """
    pts = [{"t": b.start, "score": b.score, "how": f"气口 · {b.kind} · {b.depth:.0f} dB",
            "kind": b.kind, "depth": b.depth} for b in tr.breaths]
    for c in tr.changes:
        if c["delta"] <= -3.0:
            pts.append({"t": c["snap"], "score": 3.0 * abs(c["delta"]),
                        "how": f"段落回落 {c['delta']:+.1f} LU · {c['snap_kind']}",
                        "kind": "回落", "depth": abs(c["delta"])})
    return pts


def _end_point(tr: Track, start: float, want_len: float, fade: float) -> dict:
    """在目标结束时间附近（-6 s～+2.5 s）找乐句末尾或段落回落收尾；都没有就吸附到小节/拍点。"""
    want_end = start + want_len
    usable_end = tr.tail
    note = ""
    if want_end > usable_end + 0.5:
        note = f"长度不够，差 {want_end - usable_end:.1f} s"
        want_end = usable_end
    cands = [p for p in _cut_points(tr) if want_end - 6.0 <= p["t"] <= want_end + 2.5 and p["t"] > start + fade]
    if cands:
        best = max(cands, key=lambda p: p["score"] - 0.8 * abs(p["t"] - want_end))
        end, how = best["t"], best["how"]
    else:
        end, how = tr.snap(want_end)
        end = min(end, usable_end)
        how = f"{how} · 附近没有气口或回落"
    bar = tr.rhythm["bar_period"] if tr.rhythm else None
    fade_len = bar if (bar and 1.5 <= bar <= 3.0) else fade
    return {"end": end, "how": how, "fade": fade_len, "note": note}


def plan_single(tr: Track, target: float, fade: float, start_override: float | None) -> dict:
    starts = []
    if start_override is not None:
        starts.append((start_override, "指定起播点"))
    else:
        starts.append((tr.lead, "曲首" + (f" · 跳过开头静音 {tr.lead:.2f} s" if tr.lead >= 0.05 else "")))
        rises = [c for c in tr.changes if c["delta"] >= 3.0 and c["snap"] + target <= tr.tail + 1.0]
        if rises:
            first = rises[0]
            starts.append((first["snap"], f"第一次能量抬升 +{first['delta']:.1f} LU · {first['snap_kind']}"))
            strongest = max(rises, key=lambda c: c["delta"])
            if strongest is not first:
                starts.append((strongest["snap"], f"最强能量抬升 +{strongest['delta']:.1f} LU · {strongest['snap_kind']}"))
    options = []
    for s, why in starts:
        hook = tr.level(s, s + 15.0)
        endp = _end_point(tr, s, target, fade)
        options.append({"start": s, "why": why,
                        "hook_delta": None if hook is None else hook - tr.I,
                        **endp, "length": endp["end"] - s})
    return {"type": "single", "options": options}


def plan_pair(a: Track, b: Track, gains: list, target: float, ratio: float, fade: float,
              a_start: float | None, b_start: float | None) -> dict:
    s_a = a.lead if a_start is None else a_start
    want = ratio * target
    lo = max(0.2 * target, want - 0.2 * target)
    hi = min(0.8 * target, want + 0.2 * target)
    # 切出点：质量 × 位置贴近度。--switch-at 代表叙事转折的位置，偏离越远扣得越多（σ = 8% 目标时长）
    sigma = 0.08 * target
    switches = []
    for p in _cut_points(a):
        la = p["t"] - s_a
        if lo <= la <= hi:
            near = math.exp(-0.5 * ((la - want) / sigma) ** 2)
            switches.append({"t": p["t"], "len_a": la, "kind": p["kind"], "depth": p["depth"],
                             "how": p["how"], "rank": p["score"] * (0.05 + 0.95 * near)})
    switches.sort(key=lambda d: -d["rank"])
    warnings = []
    if not switches:
        t, how = a.snap(s_a + want)
        switches.append({"t": t, "len_a": t - s_a, "kind": how, "depth": 0.0,
                         "how": f"{how} · 无气口", "rank": 0.0})
        warnings.append("A 在目标切换区间里没有明显气口或段落回落：改用小节首拍切换，并用转场音效或画面重拍遮挡。")

    ra, rb = a.rhythm, b.rhythm
    compatible = False
    if ra and rb:
        q = ra["bpm"] / rb["bpm"]
        q = min(q, 1.0 / q)
        compatible = abs(q - 1.0) <= 0.06 or abs(2.0 * q - 1.0) <= 0.06
    if compatible:
        xfade = min(max(rb["bar_period"], 1.0), 2.5)
        xfade_note = f"两首速度接近（{ra['bpm']:.0f} / {rb['bpm']:.0f} BPM），按 1 小节做等功率交叉淡化"
    else:
        xfade = 0.6
        xfade_note = "两首速度不同、节拍对不齐，在 A 的切出点做短的等功率交叉淡化，必要时用转场音效遮挡"

    def b_starts():
        if b_start is not None:
            return [(b_start, "指定起播点", 4)]
        out = [(b.lead, "曲首", 1)]
        for c in b.changes:
            if c["delta"] >= 3.0:
                out.append((c["snap"], f"能量抬升 +{c['delta']:.1f} LU · {c['snap_kind']}", 3))
        for br in sorted(b.breaths, key=lambda x: -x.score)[:6]:
            out.append((br.phrase, f"气口后的下一句 · {br.phrase_kind}", 2))
        uniq = []
        for item in sorted(out, key=lambda x: x[0]):
            if all(abs(item[0] - u[0]) > 0.5 for u in uniq):
                uniq.append(item)
        return uniq

    ga, gb = gains[0]["gain_db"], gains[1]["gain_db"]
    by_switch = []
    for sw in switches[:4]:
        len_a = sw["len_a"]
        need_b = target - len_a
        lvl_a = a.level(sw["t"] - 4.0, sw["t"])
        options = []
        for s_b, why, pref in b_starts():
            endp = _end_point(b, s_b, need_b, fade)
            if endp["note"]:
                continue
            lvl_b = b.level(s_b, s_b + 4.0)
            jump = None if (lvl_a is None or lvl_b is None) else (lvl_b + gb) - (lvl_a + ga)
            penalty = 0.0 if jump is None else max(0.0, abs(jump) - 4.0)
            options.append({"switch": sw, "b_start": s_b, "b_why": why, "jump": jump,
                            "b_end": endp, "total": len_a + endp["end"] - s_b,
                            "rank": sw["rank"] + 3.0 * pref - 2.0 * penalty})
        options.sort(key=lambda p: -p["rank"])
        if options:
            by_switch.append(options)
    if not by_switch:
        warnings.append("B 的长度不够接满目标时长：缩短目标、提前切换，或换一首更长的 B。")
        return {"type": "pair", "a_start": s_a, "switches": switches[:4], "plans": [],
                "xfade": xfade, "xfade_note": xfade_note, "warnings": warnings}
    by_switch.sort(key=lambda opts: -opts[0]["rank"])
    # 候选表：每个切出点给一个最好的 B 起播点，再给推荐切出点补两个备选起播点
    plans = [opts[0] for opts in by_switch] + by_switch[0][1:3]
    return {"type": "pair", "a_start": s_a, "switches": switches[:4], "plans": plans,
            "xfade": xfade, "xfade_note": xfade_note, "warnings": warnings}


def remotion_params(plan: dict, best: dict, gains: list, fps: int) -> list:
    """把推荐方案换算成 Remotion 帧参数（trimBefore / from / durationInFrames / 淡入淡出帧）。"""
    f = lambda s: int(round(s * fps))  # noqa: E731
    x = plan["xfade"]
    s_a = plan["a_start"]
    len_a = best["switch"]["len_a"]
    pre = min(x / 2.0, best["b_start"])
    b_from = len_a - pre
    b_trim = best["b_start"] - pre
    b_len = best["b_end"]["end"] - b_trim
    return [
        "帧号都是合成时间轴上的绝对帧；trimBefore 是源文件里跳过的帧数。",
        f"A：from=0  trimBefore={f(s_a)}  durationInFrames={f(len_a + x / 2.0)}  volume={gains[0]['coef']:.3f}  "
        f"淡出（等功率）第 {f(len_a - x / 2.0)}–{f(len_a + x / 2.0)} 帧",
        f"B：from={f(b_from)}  trimBefore={f(b_trim)}  durationInFrames={f(b_len)}  volume={gains[1]['coef']:.3f}  "
        f"淡入（等功率）第 {f(b_from)}–{f(b_from + x)} 帧，淡出第 {f(b_from + b_len - best['b_end']['fade'])}–{f(b_from + b_len)} 帧",
        f"合成总长 durationInFrames={f(b_from + b_len)}（{(b_from + b_len):.2f} s）",
    ]


# ----------------------------------------------------------------------------
# 报告
# ----------------------------------------------------------------------------

def _fmt(v, nd=1, unit=""):
    if v is None or (isinstance(v, float) and not math.isfinite(v)):
        return "—"
    return f"{v:.{nd}f}{unit}"


def _bar(delta):
    if delta is None:
        return "·" * 0
    n = int(round(max(0.0, min(1.0, (delta + 24.0) / 30.0)) * 20))
    return "█" * n + "░" * (20 - n)


def track_section(tr: Track, letter: str, window: float, fps: int) -> list:
    L = [f"## {letter} · {tr.name}", ""]
    r = tr.rhythm
    L.append("### 节奏")
    if r is None:
        L.append("- 没有检测到稳定的节奏（太短、太安静或无打击乐）。卡点改用能量变化和气口。")
    else:
        drift = f"，前后段漂移 {r['drift_ms']:+.0f} ms" if r["drift_ms"] is not None else ""
        L.append(f"- BPM **{r['bpm']:.2f}**（置信度 {r['conf']}）。依据：拍点与起音的中位偏差 "
                 f"{_fmt(r['fit_ms'], 0, ' ms')}，{r['hit_rate'] * 100:.0f}% 的拍上有明显起音{drift}。")
        rel = "、".join(f"{x['bpm']:.1f}（{x['label']}，{_fmt(x['acf'], 2)}）" for x in r["related"])
        L.append(f"- 半速/倍速候选：{rel or '—'}；括号里是自相关强度，当前估计为 {r['acf']:.2f}，只用来互相比较。")
        if r["ambiguous"]:
            L.append(f"  - 注意：{r['ambiguous']['bpm']:.1f} BPM 也说得通，可能是{r['ambiguous']['label']}，要听辨。")
        L.append(f"- 拍长 {r['beat_period']:.3f} s（{r['beat_period'] * fps:.2f} 帧），按 4/4 一小节 {r['bar_period']:.3f} s"
                 f"（{r['bar_period'] * fps:.2f} 帧）。")
        if r["drift_ms"] is not None and abs(r["drift_ms"]) > 35:
            L.append("  - 漂移偏大：这首歌可能不是恒定速度，拍点只在前半段可靠，卡点前逐个听辨。")
        first_bars = "、".join(f"{t:.2f}" for t in r["bars"][:4])
        scores = " / ".join(f"{s:.2f}" for s in r["bar_scores"])
        L.append(f"- 小节首拍（估计）：{first_bars} s …，相位得分 {scores}（最高/次高 {r['bar_ratio']:.2f}，"
                 f"置信度 {r['bar_conf']}）。按 4/4 推断，务必听辨。")
    L.append("")
    L.append(f"### 能量走势（每 {window:g} 秒；相对 = 减去综合响度 {tr.I:.1f} LUFS）")
    L.append("")
    L.append("级别按这首歌自己的中位响度划分；律动是起音强度相对全曲中位数的倍数，"
             "用来区分同样响但更满（密）和更空（疏）的段落。画面密度跟着这两列走。")
    L.append("")
    L.append("| 时间 | 响度 LUFS | 相对 | 走势 | 级别 | 律动 | 峰值 dBTP | 备注 |")
    L.append("|---|---|---|---|---|---|---|---|")
    for row in tr.table:
        notes = []
        for c in tr.changes:
            if row["t0"] <= c["snap"] < row["t1"]:
                notes.append(f"{'抬升' if c['delta'] > 0 else '回落'} {c['delta']:+.1f} LU @ {c['snap']:.2f}s")
        for b in tr.top_breaths:
            if row["t0"] <= b.t_min < row["t1"]:
                notes.append(f"气口 {b.t_min:.2f}s")
        groove = "—" if row["groove"] is None else f"{row['groove']:.2f} {row['groove_label']}"
        L.append(f"| {row['t0']:.0f}–{row['t1']:.0f} s | {_fmt(row['lufs'], 1)} | {_fmt(row['delta'], 1)} | "
                 f"{_bar(row['delta'])} | {row['label']} | {groove} | {_fmt(row['peak'], 1)} | {'；'.join(notes)} |")
    L.append("")
    L.append("### 天然气口（按显著程度取前 12 个，按时间排列）")
    L.append("")
    if not tr.top_breaths:
        L.append("没有找到明显的气口：切换和收尾改用小节首拍，配合淡化或转场音效。")
    else:
        L.append("切出或收尾用“时间段”的起点（乐句末尾）；接入用“下一句起点”。")
        L.append("")
        L.append("| 时间段 | 最低点 | 深度 | 类型 | 下一句起点 |")
        L.append("|---|---|---|---|---|")
        for b in tr.top_breaths:
            L.append(f"| {b.start:.2f}–{b.end:.2f} s | {b.t_min:.2f} s | {b.depth:.1f} dB | {b.kind} | "
                     f"{b.phrase:.2f} s（{b.phrase_kind}） |")
    L.append("")
    return L


def render_report(tracks: list, gains: list, plan: dict | None, args) -> str:
    L = ["# BGM 体检报告", ""]
    tgt = f"目标时长 {args.target:g} s ｜ " if args.target else ""
    L.append(f"{tgt}帧率 {args.fps} ｜ True Peak 上限 {args.tp_ceiling:.1f} dBTP ｜ 生成：audio_probe.py")
    L.append("")
    L.append("## 总览")
    L.append("")
    L.append("| 音轨 | 时长 | 综合响度 | 响度范围 | True Peak | 采样峰值 | BPM（置信度） | 开头静音 | 结尾静音 |")
    L.append("|---|---|---|---|---|---|---|---|---|")
    for letter, tr in zip("AB", tracks):
        bpm = f"{tr.rhythm['bpm']:.1f}（{tr.rhythm['conf']}）" if tr.rhythm else "—"
        L.append(f"| {letter} {tr.name} | {tr.duration:.2f} s | {tr.I:.1f} LUFS | {_fmt(tr.summary['LRA'], 1)} LU | "
                 f"{_fmt(tr.TP, 1)} dBTP | {_fmt(tr.summary['SP'], 1)} dBFS | {bpm} | {tr.lead:.2f} s | "
                 f"{max(0.0, tr.duration - tr.tail):.2f} s |")
    for tr in tracks:
        if tr.info["channels"] == 1:
            L.append(f"\n> {tr.name} 是单声道：渲染时会转成立体声，实际响度可能和这里差 3 dB，以成片复测为准。")
    L.append("")
    L.append("## 音量系数（只压不抬）")
    L.append("")
    L.append("| 音轨 | 增益 | Remotion volume | 处理后 True Peak | 原因 |")
    L.append("|---|---|---|---|---|")
    for letter, tr, g in zip("AB", tracks, gains):
        L.append(f"| {letter} | {g['gain_db']:+.1f} dB | {g['coef']:.3f} | {g['tp_after']:.1f} dBTP | {g['reason']} |")
    L.append("")
    L.append("系数 = 10^(增益dB/20)，例如 -3 dB → 0.708。交叉淡化的重叠段和音效叠加处电平会相加，"
             "成片渲染后必须用 `--master` 复测。")
    L.append("")
    for letter, tr in zip("AB", tracks):
        L.extend(track_section(tr, letter, args.window, args.fps))
    if plan is not None:
        L.extend(plan_section(plan, tracks, gains, args))
    return "\n".join(L).rstrip() + "\n"


def plan_section(plan: dict, tracks: list, gains: list, args) -> list:
    fps = args.fps
    L = [f"## 衔接方案（目标 {args.target:g} s）", ""]
    if plan["type"] == "single":
        tr = tracks[0]
        L.append("| 起播点 | 依据 | 前 15 秒相对响度 | 收尾 | 淡出 | 实际时长 | 备注 |")
        L.append("|---|---|---|---|---|---|---|")
        for o in plan["options"]:
            L.append(f"| {o['start']:.2f} s（第 {round(o['start'] * fps)} 帧） | {o['why']} | {_fmt(o['hook_delta'], 1)} LU | "
                     f"{o['end']:.2f} s，{o['how']} | {o['fade']:.2f} s | {o['length']:.2f} s | {o['note']} |")
        L.append("")
        L.append("- 前 15 秒相对响度越接近 0，开头越有推进感；明显为负说明是慢前奏，钩子要靠画面撑住，或者换起播点。")
        L.append(f"- 写进 Remotion：trimBefore = 起播点 × {fps}，durationInFrames = 实际时长 × {fps}，"
                 f"淡出用最后 {plan['options'][0]['fade']:.2f} s；volume × {gains[0]['coef']:.3f}。")
        L.append("- 收尾优先落在乐句末尾（气口）或段落回落处，音乐自然收住；"
                 "最后一句文案（含爆点定格）结束后，片尾不超过 3 秒。")
        L.append("")
        return L

    a, b = tracks
    L.append(f"- 交叉淡化 {plan['xfade']:.2f} s（{round(plan['xfade'] * fps)} 帧），中心对准切出点：{plan['xfade_note']}。")
    L.append(f"- 切出点按 `--switch-at {args.switch_at:g}`（目标时长的 {args.switch_at * 100:.0f}% 附近）排序；"
             "叙事转折在别处时改这个参数重跑。")
    for w in plan["warnings"]:
        L.append(f"- ⚠ {w}")
    if not plan["plans"]:
        L.append("")
        return L
    best = plan["plans"][0]
    sw = best["switch"]
    L.append("")
    L.append("### 推荐方案")
    L.append("")
    L.append(f"1. A 从 {plan['a_start']:.2f} s 起播，在 A 的 {sw['t']:.2f} s 切出（{sw['how']}），"
             f"对应视频 {sw['len_a']:.2f} s（第 {round(sw['len_a'] * fps)} 帧）。")
    L.append(f"2. B 从 {best['b_start']:.2f} s 接入：{best['b_why']}。")
    e = best["b_end"]
    L.append(f"3. B 在 {e['end']:.2f} s 收尾：{e['how']}，最后 {e['fade']:.2f} s 淡出。")
    jump = "—" if best["jump"] is None else f"{best['jump']:+.1f} LU"
    L.append(f"4. 衔接处响度变化（切出前 4 s → 接入后 4 s，已计入音量系数）：{jump}。"
             "超过 ±4 LU 时，确认这是想要的爆发，否则换 B 的起播点。")
    L.append(f"5. 实际总时长 {best['total']:.2f} s。")
    L.append("")
    L.append("Remotion 参数：")
    L.append("")
    L.append("```text")
    L.extend(remotion_params(plan, best, gains, fps))
    L.append("```")
    L.append("")
    L.append("### 其他候选")
    L.append("")
    L.append("| A 切出点 | A 段长度 | 切出依据 | B 起播点 | B 起播依据 | 衔接响度变化 | B 收尾 | 总时长 |")
    L.append("|---|---|---|---|---|---|---|---|")
    for p in plan["plans"]:
        s = p["switch"]
        j = "—" if p["jump"] is None else f"{p['jump']:+.1f} LU"
        L.append(f"| {s['t']:.2f} s | {s['len_a']:.2f} s | {s['how']} | {p['b_start']:.2f} s | "
                 f"{p['b_why']} | {j} | {p['b_end']['end']:.2f} s | {p['total']:.2f} s |")
    L.append("")
    return L


# ----------------------------------------------------------------------------
# 成片复测
# ----------------------------------------------------------------------------

def master_check(path: str, ceiling: float, target_lufs: float, fps: int) -> tuple:
    info = ffprobe_info(path)
    summary, series = ebur128_scan(path)
    pk_t, pk = series["pk_t"], series["pk"]
    over = np.isfinite(pk) & (pk > ceiling)
    ranges = []
    i = 0
    while i < len(pk):
        if not over[i]:
            i += 1
            continue
        j = i
        while j + 1 < len(pk) and (over[j + 1] or (j + 2 < len(pk) and over[j + 2])):
            j += 1
        ranges.append((float(pk_t[i] - 0.05), float(pk_t[j] + 0.05), float(np.nanmax(pk[i:j + 1]))))
        i = j + 1
    ok = math.isfinite(summary["TP"]) and summary["TP"] <= ceiling + 1e-9
    L = ["# 成片音频复测", "", f"文件：{os.path.basename(path)}", ""]
    L.append("| 项目 | 结果 | 判定 |")
    L.append("|---|---|---|")
    L.append(f"| True Peak | {_fmt(summary['TP'], 2)} dBTP | {'通过' if ok else '超限'}（上限 {ceiling:.1f}） |")
    lvl = summary["I"]
    if lvl < target_lufs - 2.0:
        verdict = f"偏小声（参考 {target_lufs:.0f} LUFS），可选两遍 loudnorm 整体抬升，需用户确认"
    elif lvl > target_lufs + 4.0:
        verdict = "偏响，检查是否有音轨没有按系数下压"
    else:
        verdict = "正常"
    L.append(f"| 综合响度 | {lvl:.1f} LUFS | {verdict} |")
    L.append(f"| 响度范围 | {_fmt(summary['LRA'], 1)} LU | — |")
    L.append(f"| 采样峰值 | {_fmt(summary['SP'], 2)} dBFS | — |")
    if info.get("video_duration"):
        diff = info["duration"] - info["video_duration"]
        ok_len = abs(diff) <= 1.0 / fps + 1e-6
        L.append(f"| 音视频时长差 | {diff * 1000:+.0f} ms | {'正常' if ok_len else '不一致，检查合成时长和音频裁切'} |")
    L.append("")
    if ranges:
        L.append("超限时间段（多半是交叉淡化重叠段或音效叠加处，优先压低对应音效或音轨的系数）：")
        L.append("")
        for t0, t1, v in sorted(ranges, key=lambda r: -r[2])[:10]:
            L.append(f"- {t0:.2f}–{t1:.2f} s（第 {round(t0 * fps)}–{round(t1 * fps)} 帧）：最高 {v:.2f} dBTP")
        L.append("")
    return "\n".join(L) + "\n", ok


# ----------------------------------------------------------------------------
# 自检：用已知答案的合成信号验算
# ----------------------------------------------------------------------------

def _synth(path: str, expr: str, dur: float, sr: int = 44100) -> None:
    # 表达式里的逗号必须用单引号包起来，否则会被 filtergraph 当成滤镜分隔符
    run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
         "-i", f"aevalsrc='{expr}|{expr}':s={sr}:d={dur}", "-c:a", "pcm_s16le", path])


def selftest() -> int:
    need_tools()
    results = []

    def check(name, ok, detail):
        results.append(ok)
        print(f"{'✓' if ok else '✗'} {name}：{detail}")

    with tempfile.TemporaryDirectory() as d:
        sine = os.path.join(d, "sine.wav")
        _synth(sine, "0.1*sin(2*PI*1000*t)", 12)
        s, _ = ebur128_scan(sine)
        check("响度", abs(s["I"] + 20.0) <= 0.2, f"振幅 0.1 的 1 kHz 立体声正弦，期望 -20.0 LUFS，实测 {s['I']:.2f}")
        check("True Peak", abs(s["TP"] + 20.0) <= 0.2, f"期望 -20.0 dBTP，实测 {s['TP']:.2f}")

        kick = "0.6*sin(2*PI*55*t)*exp(-25*mod(t,{p}))"
        hat = "0.12*(2*random(0)-1)*exp(-120*mod(t,{h}))"
        groove120 = f"({kick.format(p=0.5)}+{hat.format(h=0.25)}+0.05*sin(2*PI*220*t))"
        g120 = os.path.join(d, "g120.wav")
        _synth(g120, groove120, 40)
        tr = analyze_track(g120, 5.0)
        bpm = tr.rhythm["bpm"] if tr.rhythm else float("nan")
        check("BPM", abs(bpm - 120.0) <= 0.5, f"120 BPM 底鼓 + 八分音符踩镲，实测 {bpm:.2f}（不能是 60 或 240）")

        rnd = os.path.join(d, "random.wav")
        _synth(rnd, "0.8*gt(random(0),0.99995)+0.01*(2*random(1)-1)", 40)
        trr = analyze_track(rnd, 5.0)
        conf = trr.rhythm["conf"] if trr.rhythm else "低"
        check("BPM 置信度", conf == "低", f"随机时刻的点击（没有固定速度），置信度应为 低，实测 {conf}")

        p96 = 60.0 / 96
        groove96 = f"({kick.format(p=p96)}+{hat.format(h=p96 / 2)}+0.08*sin(2*PI*196*t))"
        gate = "*if(between(t,20,21),0,1)*if(between(t,30,30.4),0.2,1)"
        g96 = os.path.join(d, "g96.wav")
        _synth(g96, groove96 + gate, 45)
        tr96 = analyze_track(g96, 5.0)
        bpm96 = tr96.rhythm["bpm"] if tr96.rhythm else float("nan")
        check("BPM（第二首）", abs(bpm96 - 96.0) <= 0.5, f"96 BPM，实测 {bpm96:.2f}")
        hit1 = [b for b in tr96.breaths if b.start <= 20.6 and b.end >= 20.4 and b.kind == "静音"]
        check("气口：静音", bool(hit1), f"20.0–21.0 s 插入 1 秒静音，识别到："
              + ("、".join(f"{b.start:.2f}–{b.end:.2f} s（{b.kind}）" for b in hit1) or "无"))
        hit2 = [b for b in tr96.breaths if b.start <= 30.25 and b.end >= 30.15]
        check("气口：凹陷", bool(hit2), f"30.0–30.4 s 压低 14 dB，识别到："
              + ("、".join(f"{b.start:.2f}–{b.end:.2f} s（{b.kind}，{b.depth:.0f} dB）" for b in hit2) or "无"))

        loud = os.path.join(d, "loud.wav")
        _synth(loud, "0.2*sin(2*PI*1000*t)", 12)
        ta = analyze_track(loud, 5.0)
        tb = analyze_track(sine, 5.0)
        g = compute_gains([ta, tb], -1.0)
        check("音量系数", abs(g[0]["coef"] - 0.501) <= 0.005 and abs(g[1]["coef"] - 1.0) <= 1e-9,
              f"-14 LUFS 与 -20 LUFS 两首，期望 A 0.501、B 1.000，实测 {g[0]['coef']:.3f}、{g[1]['coef']:.3f}")

        hot = os.path.join(d, "hot.wav")
        _synth(hot, "0.99*sin(2*PI*1000*t)", 6)
        th = analyze_track(hot, 5.0)
        gh = compute_gains([th], -1.0)
        expect = db_to_coef(-1.0 - th.TP)
        check("True Peak 余量", abs(gh[0]["coef"] - expect) <= 0.002 and gh[0]["tp_after"] <= -1.0 + 1e-6,
              f"峰值 {th.TP:.2f} dBTP 的单曲，系数 {gh[0]['coef']:.3f}，处理后 {gh[0]['tp_after']:.2f} dBTP")
        check("dB 换算", abs(db_to_coef(-3.0) - 0.708) <= 0.001, f"-3 dB → {db_to_coef(-3.0):.3f}（期望 0.708）")

    passed = sum(results)
    print(f"\n{passed}/{len(results)} 项通过")
    return 0 if passed == len(results) else 1


# ----------------------------------------------------------------------------
# 入口
# ----------------------------------------------------------------------------

def to_jsonable(tracks: list, gains: list, plan: dict | None) -> dict:
    def tr_dict(tr: Track) -> dict:
        r = tr.rhythm
        return {
            "file": tr.path, "duration": tr.duration, "channels": tr.info["channels"],
            "sample_rate": tr.info["sample_rate"], "integrated_lufs": tr.I, "lra": tr.summary["LRA"],
            "true_peak_dbtp": tr.TP, "sample_peak_dbfs": tr.summary["SP"],
            "lead_silence": tr.lead, "tail_silence_start": tr.tail,
            "rhythm": None if r is None else {
                "bpm": r["bpm"], "confidence": r["conf"], "acf": r["acf"],
                "related": r["related"], "beat_period": r["beat_period"], "bar_period": r["bar_period"],
                "fit_ms": r["fit_ms"], "drift_ms": r["drift_ms"], "bar_confidence": r["bar_conf"],
                "bar_phase_scores": r["bar_scores"],
                "beats": [round(float(x), 3) for x in r["beats"]],
                "bars": [round(float(x), 3) for x in r["bars"]],
            },
            "energy": tr.table,
            "changes": tr.changes,
            "breaths": [b.__dict__ for b in tr.breaths],
        }

    def clean(o):
        if isinstance(o, dict):
            return {k: clean(v) for k, v in o.items() if k != "env"}
        if isinstance(o, (list, tuple)):
            return [clean(v) for v in o]
        if isinstance(o, Breath):
            return clean(o.__dict__)
        if isinstance(o, float) and not math.isfinite(o):
            return None
        if np is not None and isinstance(o, np.generic):
            return clean(o.item())
        return o

    return clean({"tracks": [tr_dict(t) for t in tracks], "gains": gains, "plan": plan})


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description="BGM 体检：响度、True Peak、BPM、能量走势、气口，以及 1～2 首歌的衔接方案。")
    ap.add_argument("files", nargs="*", help="1～2 个音频文件（两首时按 A→B 顺序）；--master 时传成片")
    ap.add_argument("--target", type=float, help="目标视频时长（秒），给了才生成衔接方案")
    ap.add_argument("--fps", type=int, default=30, help="合成帧率，用于换算帧号（默认 30）")
    ap.add_argument("--switch-at", type=float, default=0.5, help="两首时，切到 B 的大致位置（占目标时长的比例，默认 0.5）")
    ap.add_argument("--a-start", type=float, help="指定 A 的起播点（秒）")
    ap.add_argument("--b-start", type=float, help="指定 B 的起播点（秒）")
    ap.add_argument("--tp-ceiling", type=float, default=-1.0, help="True Peak 上限（dBTP，默认 -1.0）")
    ap.add_argument("--fade-out", type=float, default=2.0, help="默认收尾淡出秒数（小节长 1.5～3 s 时改用 1 小节）")
    ap.add_argument("--window", type=float, default=5.0, help="能量表的时间窗（秒，默认 5）")
    ap.add_argument("--out", help="把 Markdown 报告另存到这个文件")
    ap.add_argument("--json", help="把完整数据（拍点、气口、能量表、方案）存成 JSON")
    ap.add_argument("--master", action="store_true", help="成片复测模式：True Peak、响度、超限时间段")
    ap.add_argument("--target-lufs", type=float, default=-14.0, help="成片响度参考值（默认 -14 LUFS，只用于提示）")
    ap.add_argument("--selftest", action="store_true", help="用合成信号验算本脚本")
    args = ap.parse_args(argv)

    try:
        if args.selftest:
            return selftest()
        if args.master:
            need_tools(numpy_needed=True)
            if len(args.files) != 1:
                ap.error("--master 需要且只需要 1 个成片文件")
            text, ok = master_check(args.files[0], args.tp_ceiling, args.target_lufs, args.fps)
            print(text)
            if args.out:
                with open(args.out, "w", encoding="utf-8") as fh:
                    fh.write(text)
            return 0 if ok else 1
        if not 1 <= len(args.files) <= 2:
            ap.error("需要 1～2 个音频文件")
        need_tools()
        for f in args.files:
            if not os.path.isfile(f):
                raise ProbeError(f"找不到文件：{f}")
        tracks = [analyze_track(f, args.window) for f in args.files]
        gains = compute_gains(tracks, args.tp_ceiling)
        plan = None
        if args.target:
            if len(tracks) == 1:
                plan = plan_single(tracks[0], args.target, args.fade_out, args.a_start)
            else:
                plan = plan_pair(tracks[0], tracks[1], gains, args.target, args.switch_at, args.fade_out,
                                 args.a_start, args.b_start)
        report = render_report(tracks, gains, plan, args)
        print(report)
        if args.out:
            with open(args.out, "w", encoding="utf-8") as fh:
                fh.write(report)
        if args.json:
            with open(args.json, "w", encoding="utf-8") as fh:
                json.dump(to_jsonable(tracks, gains, plan), fh, ensure_ascii=False, indent=1)
        return 0
    except ProbeError as e:
        print(f"错误：{e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
