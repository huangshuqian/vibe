"""Export music timing (beat grid, snapped downbeats, sections) for the Remotion project.

Beat grid: constant tempo fitted to librosa beats (108 BPM, 0.5556 s/beat).
Downbeats: every 4th beat (phase chosen by low-frequency kick energy), each one
snapped to the nearest detected percussive onset within +-70 ms when present.
"""
import json
import numpy as np
import librosa
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MUSIC = os.path.join(ROOT, "public", "music.mp3")
RAW = os.path.join(ROOT, "docs", "music_analysis_raw.json")


SRC = MUSIC
A = json.load(open(RAW))
FPS = 30

y, sr = librosa.load(SRC, sr=22050, mono=True)
dur_lib = len(y) / sr

beats = np.array(A["beat_times"])
n = np.arange(len(beats))
period, offset = np.polyfit(n, beats, 1)
phase = A["downbeat_phase"]

# percussive onsets for snapping
_, yp = librosa.effects.hpss(y)
env = librosa.onset.onset_strength(y=yp, sr=sr, hop_length=256)
on = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=256, units="time")

grid = []
k = 0
t = offset + phase * period
# include a virtual downbeat before the first one (pickup bar)
t0 = t - 4 * period
while t0 < dur_lib + 4 * period:
    grid.append(t0)
    t0 += 4 * period

snapped = []
for g in grid:
    near = on[np.abs(on - g) < 0.07]
    snapped.append(float(near[np.argmin(np.abs(near - g))]) if len(near) else float(g))

# index 0 == the first true downbeat (1.96 s); index -1 == pickup bar
first = 1
downbeats = [round(x, 3) for x in snapped[first:] if x < dur_lib + 0.5]

# bar indices refer to `downbeats` below (bar 0 = 1.93 s); null = start/end of track
sections = [
    {"name": "intro", "fromBar": None, "toBar": 2, "mood": "sparse pads, sub swells, no percussion (0-6.4 s)"},
    {"name": "groove-in", "fromBar": 2, "toBar": 4, "mood": "hats enter 6.4 s, beat arrives 8.6 s"},
    {"name": "A", "fromBar": 4, "toBar": 26, "mood": "main groove, 808 swell every 2 bars, loudest bar at 22.0 s"},
    {"name": "drop", "fromBar": 26, "toBar": 27, "mood": "energy dips, pause at 61.78 s"},
    {"name": "bridge", "fromBar": 27, "toBar": 30, "mood": "bass gone, single swell at 66.4 s"},
    {"name": "breakdown", "fromBar": 30, "toBar": 32, "mood": "quietest part of the body (-25 dB), 71.76 s low point"},
    {"name": "B", "fromBar": 32, "toBar": 43, "mood": "quiet melodic section, one bass swell at 86.4 s"},
    {"name": "build", "fromBar": 43, "toBar": 47, "mood": "risers, high band rises, pause at 105.67 s"},
    {"name": "climax", "fromBar": 47, "toBar": 55, "mood": "densest highs, sustained energy (~-16.5 dB), short dip 123.5 s"},
    {"name": "climax2", "fromBar": 55, "toBar": 62, "mood": "last full phrase, still strong"},
    {"name": "outro", "fromBar": 62, "toBar": None, "mood": "fade from 139.7 s to silence at 144.8 s"},
]

ff_dur = 144.822857  # ffprobe container duration of the mp3
out = {
    "fps": FPS,
    "durationSec": ff_dur,
    "durationInFrames": int(np.ceil(ff_dur * FPS)),
    "bpm": round(60 / period, 3),
    "beatPeriodSec": round(float(period), 5),
    "barPeriodSec": round(float(period * 4), 5),
    "firstBeatSec": round(float(offset), 4),
    "pickupBarSec": round(snapped[0], 3),
    "downbeats": downbeats,
    "pauses": [61.78, 71.76, 97.33, 105.67, 123.5, 132.89],
    "fadeOutStartSec": 139.74,
    "sections": sections,
}
json.dump(out, open(os.path.join(ROOT, "src", "data", "music.json"), "w"), indent=1)
print("bpm", out["bpm"], "frames", out["durationInFrames"], "n downbeats", len(downbeats))
print("first downbeats", downbeats[:8], "...", downbeats[-4:])
print("snap deltas (ms):", [round((s - g) * 1000) for s, g in zip(snapped[1:20], grid[1:20])])
