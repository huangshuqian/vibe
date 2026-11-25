"""Automatic QC of the rendered video.

    python tools/qc.py [out/clarity-film.mp4]

Uses the ffmpeg / ffprobe that ship with Remotion (or FFMPEG / FFPROBE env vars).
"""
import json
import os
import subprocess
import sys

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEO = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "out", "clarity-film.mp4")
MUSIC = os.path.join(ROOT, "public", "music.mp3")
M = json.load(open(os.path.join(ROOT, "src", "data", "music.json")))
import glob  # noqa: E402

# Remotion installs one platform package: compositor-linux-x64-gnu, compositor-darwin-arm64, compositor-win32-x64-msvc, ...
_bins = sorted(glob.glob(os.path.join(ROOT, "node_modules", "@remotion", "compositor-*")))
BIN = _bins[0] if _bins else ""
EXE = ".exe" if os.name == "nt" else ""
FFMPEG = os.environ.get("FFMPEG", os.path.join(BIN, "ffmpeg" + EXE))
FFPROBE = os.environ.get("FFPROBE", os.path.join(BIN, "ffprobe" + EXE))
ENV = {**os.environ, "LD_LIBRARY_PATH": BIN, "DYLD_LIBRARY_PATH": BIN}
FPS = M["fps"]
SR = 8000

results = []


def check(name, ok, detail):
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + " — " + detail)


def probe():
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-count_frames", "-show_entries",
         "stream=codec_type,width,height,r_frame_rate,nb_read_frames,sample_rate,channels:format=duration",
         "-of", "json", VIDEO], capture_output=True, text=True, env=ENV, check=True).stdout
    return json.loads(out)


def pcm(path, seconds=None):
    # Remotion's ffmpeg build has no raw PCM muxer, so decode to a 16-bit WAV file
    tmp = os.path.join(ROOT, "out", "_qc.wav")
    cmd = [FFMPEG, "-v", "error", "-y", "-i", path, "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le"]
    if seconds:
        cmd += ["-t", str(seconds)]
    subprocess.run(cmd + [tmp], env=ENV, check=True)
    data, _ = sf.read(tmp, dtype="float32")
    os.remove(tmp)
    return data


def luma():
    """mean RGB brightness per frame (64x36 thumbnails, decoded to full-range RGB)"""
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", VIDEO, "-vf", "scale=64:36,format=rgb24", "-f", "image2pipe", "-c:v", "rawvideo", "-"],
                         capture_output=True, env=ENV, check=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, 36 * 64 * 3).mean(1)


info = probe()
v = next(s for s in info["streams"] if s["codec_type"] == "video")
a = next(s for s in info["streams"] if s["codec_type"] == "audio")
dur = float(info["format"]["duration"])
check("resolution", (v["width"], v["height"]) == (1920, 1080), f'{v["width"]}x{v["height"]}')
check("frame rate", v["r_frame_rate"] == f"{FPS}/1", v["r_frame_rate"])
check("video frames", int(v["nb_read_frames"]) == M["durationInFrames"], f'{v["nb_read_frames"]} (expected {M["durationInFrames"]})')
check("length vs music end", abs(dur - M["videoEndSec"]) < 0.1, f"video {dur:.3f} s, music stops at {M['musicEndSec']} s")
check("audio stream", int(a["sample_rate"]) >= 44100 and int(a["channels"]) == 2, f'{a["sample_rate"]} Hz, {a["channels"]} ch')

out_a = pcm(VIDEO)
src_a = pcm(MUSIC, seconds=dur)
n = min(len(out_a), len(src_a))
body = slice(int(1 * SR), int(M["fadeOutStartSec"] * SR))
x, y = out_a[body], src_a[body]
lags = range(-80, 81, 4)
corr = [np.corrcoef(x[max(0, -l): len(x) - max(0, l)], y[max(0, l): len(y) - max(0, -l)])[0, 1] for l in lags]
best = int(np.argmax(corr))
check("audio matches source before the fade", corr[best] > 0.99 and abs(list(lags)[best]) <= 8,
      f"correlation {corr[best]:.4f} at offset {list(lags)[best] / SR * 1000:.1f} ms")
rms = lambda s: float(np.sqrt(np.mean(s ** 2)) + 1e-12)
check("audio level unchanged before the fade", abs(rms(x) / rms(y) - 1) < 0.03, f"rendered/source RMS {rms(x) / rms(y):.3f}")

win = int(0.25 * SR)
db = lambda s: 20 * np.log10(rms(s))
fs = int(M["fadeOutStartSec"] * SR)
fe = int(M["fadeOutEndSec"] * SR)
before = db(out_a[fs - win: fs])
mid = db(out_a[(fs + fe) // 2 - win // 2: (fs + fe) // 2 + win // 2])
tail = db(out_a[fe - win // 2: n])
check("music fades out over the last 2.3 s", before - mid > 4 and tail < -45,
      f"{before:.1f} dB before fade, {mid:.1f} dB mid-fade, {tail:.1f} dB in the last {(n - fe + win // 2) / SR:.2f} s")

L = luma()
check("starts from black", L[0] < 1.5, f"frame 0 mean RGB {L[0]:.2f}")
check("ends on black", L[-1] < 1.5, f"last frame mean RGB {L[-1]:.2f}")
dark = np.flatnonzero(L < 3)
inside = dark[(dark > 30) & (dark < int(M["fadeOutStartSec"] * FPS))]
check("no black frames between intro and fade", len(inside) == 0, f"{len(inside)} near-black frames in the body")
jumps = np.abs(np.diff(L))
check("no sudden brightness jumps", jumps.max() < 12, f"max frame-to-frame luma change {jumps.max():.1f} (0-255)")

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
