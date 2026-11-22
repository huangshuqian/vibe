"""Automated quality checks on the rendered film.

1. container: 1920x1080, 30 fps, h264 + aac, frame count vs. music length
2. audio: rendered audio vs. source mp3 (duration, sample-level correlation,
   no dropouts / silent gaps inside the music body)
3. black frames: none outside the intended fades (start, dips, ending)
4. frame-to-frame jumps: large luma changes must coincide with planned cuts
5. shot list: no clip reused, transition spacing
6. cut alignment: every cut lands within 1 frame of a downbeat
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from grade import FFMPEG as FF, FFPROBE as FP  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEO = sys.argv[1] if len(sys.argv) > 1 else f"{ROOT}/out/regret-film.mp4"
SRC_AUDIO = f"{ROOT}/public/music.mp3"
music = json.load(open(f"{ROOT}/src/data/music.json"))
tl = json.load(open(f"{ROOT}/src/data/timeline.json"))
shots_def = {s["id"]: s for s in json.load(open(f"{ROOT}/src/data/shots.json"))["shots"]}
fps = music["fps"]
problems = []


def report(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        problems.append(msg)


# ---------- 1. container ----------
info = json.loads(subprocess.check_output([FP, "-v", "error", "-show_streams", "-show_format", "-count_frames", "-of", "json", VIDEO]))
v = next(s for s in info["streams"] if s["codec_type"] == "video")
a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
report(v["width"] == 1920 and v["height"] == 1080, f"resolution {v['width']}x{v['height']}")
report(v["r_frame_rate"] == "30/1", f"frame rate {v['r_frame_rate']}")
report(v["codec_name"] == "h264", f"video codec {v['codec_name']}")
report(a is not None and a["codec_name"] == "aac", f"audio stream {a and a['codec_name']} {a and a['sample_rate']}Hz {a and a['channels']}ch")
nb = int(v["nb_read_frames"])
report(nb == music["durationInFrames"], f"video frames {nb} (expected {music['durationInFrames']} = ceil({music['durationSec']:.3f}s x 30))")
vdur = nb / fps
report(abs(vdur - music["durationSec"]) < 1 / fps + 1e-6, f"video length {vdur:.3f}s vs music {music['durationSec']:.3f}s")

# ---------- 2. audio ----------
def pcm(path):
    raw = subprocess.check_output([FF, "-v", "error", "-i", path, "-ac", "1", "-ar", "8000", "-f", "f32le", "-"])
    return np.frombuffer(raw, np.float32)


ra, sa = pcm(VIDEO), pcm(SRC_AUDIO)
report(abs(len(ra) - len(sa)) / 8000 < 0.1, f"audio length {len(ra)/8000:.3f}s vs source {len(sa)/8000:.3f}s")
n = min(len(ra), len(sa))
# best lag within +-50 ms (codec priming)
best = max(range(-400, 401, 4), key=lambda L: np.dot(ra[max(0, L):n + min(0, L)][:200000], sa[max(0, -L):n - max(0, L)][:200000]))
r1 = ra[max(0, best):n + min(0, best)]
s1 = sa[max(0, -best):n - max(0, best)]
m = min(len(r1), len(s1))
corr = np.corrcoef(r1[:m], s1[:m])[0, 1]
report(corr > 0.98, f"audio matches source music (correlation {corr:.4f}, offset {best/8:.1f} ms)")
# windowed correlation: any 1 s window that diverges means a dropout / glitch
win = 8000
bad = []
for i in range(0, m - win, win):
    a_, b_ = r1[i:i + win], s1[i:i + win]
    if np.std(b_) > 1e-3:
        c = np.corrcoef(a_, b_)[0, 1]
        if c < 0.95:
            bad.append((round(i / 8000, 1), round(float(c), 3)))
report(not bad, f"no audio dropouts/glitches in 1 s windows {bad[:6] if bad else ''}")
gain = np.std(r1[:m]) / np.std(s1[:m])
report(0.9 < gain < 1.1, f"audio level unchanged (rendered/source RMS {gain:.3f})")

# ---------- 3 + 4. per-frame luma ----------
# decode to full-range RGB so 0 really means black (limited-range Y black is 16)
raw = subprocess.check_output([FF, "-v", "error", "-i", VIDEO, "-vf", "scale=96:54:in_range=tv:out_range=pc,format=rgb24", "-f", "rawvideo", "-"])
frames = np.frombuffer(raw, np.uint8).reshape(-1, 54, 96, 3).astype(np.float32).mean(axis=3)
# ignore letterbox rows (104 px of 1080 -> ~5.2 rows of 54)
act = frames[:, 6:48, :]
luma = act.mean(axis=(1, 2))
fade_ranges = [(0, 70)]
for e in tl["shots"]:
    t = e["transitionIn"]
    if t["type"] == "dip":
        fade_ranges.append((e["cutIn"] - t["outFrames"] - 2, e["cutIn"] + t["inFrames"] + 2))
fade_ranges.append((int(shots_def and json.load(open(f"{ROOT}/src/data/shots.json"))["ending"]["fadeStartSec"] * fps), nb))
in_fade = np.zeros(len(luma), bool)
for a0, b0 in fade_ranges:
    in_fade[max(0, a0):b0] = True
black = np.where(luma < 3.0)[0]
unexpected_black = [int(f) for f in black if not in_fade[f]]
report(not unexpected_black, f"no unexpected black frames ({len(black)} near-black frames, all inside planned fades)" if not unexpected_black else f"unexpected black frames at {unexpected_black[:20]}")
report(luma[-1] < 2.0 and luma[-15:].mean() < 3, f"ends on black (last-frame luma {luma[-1]:.2f})")
report(luma[0] < 2.0, f"starts from black (first-frame luma {luma[0]:.2f})")

diff = np.abs(np.diff(act, axis=0)).mean(axis=(1, 2))
med = np.median(diff)
jumps = np.where(diff > max(18, med * 8))[0] + 1
planned = set()
for e in tl["shots"]:
    t = e["transitionIn"]
    # a dip's fade-up is part of the planned cut (e.g. the 3-frame snap into the climax)
    extra = t["inFrames"] if t["type"] == "dip" else 0
    for k in range(-2, 3 + extra):
        planned.add(e["cutIn"] + k)
unplanned = [int(j) for j in jumps if j not in planned]
report(not unplanned, f"no sudden frame jumps outside cuts (median diff {med:.2f}, {len(jumps)} big jumps)" + (f" unplanned at {unplanned[:20]}" if unplanned else ""))
# temporal judder: repeated identical frames inside a shot (stalled video)
still = np.where(diff < 0.02)[0] + 1
stalled = [int(s) for s in still if not in_fade[s]]
report(len(stalled) < 5, f"no frozen frames inside shots ({len(stalled)} identical consecutive frames)")

# ---------- 5. shot list ----------
clips = [e["clip"] for e in tl["shots"]]
dups = {c for c in clips if clips.count(c) > 1}
report(not dups, f"no repeated footage ({len(clips)} shots, {len(set(clips))} unique clips)")
lens = [(e["cutOut"] - e["cutIn"]) / fps for e in tl["shots"]]
report(min(lens) >= 2.0, f"shot lengths {min(lens):.2f}-{max(lens):.2f}s (mean {np.mean(lens):.2f}s), none shorter than one bar")

# ---------- 6. cut alignment ----------
db = np.array(music["downbeats"]) * fps
offs = [min(abs(db - e["cutIn"])) for e in tl["shots"][1:]]
report(max(offs) <= 1.0, f"all {len(offs)} cuts within {max(offs):.2f} frames of a downbeat")

np.save(f"{ROOT}/out/qc_luma.npy", luma)
np.save(f"{ROOT}/out/qc_diff.npy", diff)
print("\nRESULT:", "ALL PASS" if not problems else f"{len(problems)} problem(s)")
