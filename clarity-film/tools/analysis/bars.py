"""Step 2: beat-grid fit and per-bar table.

Checks that the tempo is constant, prints one row per bar (RMS, low band,
high band) and finds where the music actually ends (the file has a long
silent tail).

    python tools/analysis/bars.py
"""
import json
import os

import librosa
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MUSIC = os.path.join(ROOT, "public", "music.mp3")
RAW = os.path.join(ROOT, "docs", "music_analysis_raw.json")

y, sr = librosa.load(MUSIC, sr=22050, mono=True)
A = json.load(open(RAW))
beats = np.array(A["beat_times"])

# keep only beats inside the audible part
hop = 256
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
t = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
db_abs = 20 * np.log10(rms + 1e-9)
audible = t[db_abs > -60]
music_end = float(audible.max())
print("last audible frame (> -60 dBFS): %.3f s of %.3f s" % (music_end, len(y) / sr))

beats = beats[beats < music_end]
ibi = np.diff(beats)
print("beats %d, IBI mean %.4f std %.4f min %.3f max %.3f -> BPM %.2f"
      % (len(beats), ibi.mean(), ibi.std(), ibi.min(), ibi.max(), 60 / ibi.mean()))

n = np.arange(len(beats))
period, offset = np.polyfit(n, beats, 1)
resid = beats - np.polyval([period, offset], n)
print("linear fit period %.5f s (BPM %.3f), offset %.4f, resid max %.3f s"
      % (period, 60 / period, offset, np.abs(resid).max()))

S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
f = librosa.fft_frequencies(sr=sr, n_fft=2048)
low = S[(f >= 30) & (f <= 150)].sum(0)
high = S[f > 2000].sum(0)
low /= low.max()
high /= high.max()

downs = np.array(A["downbeat_times"])
bar = period * 4
grid = np.arange(downs[0], music_end + bar, bar)
print("bar period %.4f s, phrase (8 bars) %.3f s" % (bar, bar * 8))
print("\nbar |  start |  rmsdB | low  | high")
for i, s in enumerate(grid):
    e = s + bar
    m = (t >= max(s, 0)) & (t < e)
    if m.sum() == 0:
        continue
    dbv = 20 * np.log10(rms[m].mean() + 1e-9)
    print("%3d | %6.2f | %6.1f | %.2f | %.3f" % (i, s, dbv, low[m].mean(), high[m].mean()))

# exact moments where the bass (30-150 Hz) switches on / off, 100 ms smoothing
w = int(0.1 * sr / hop)
ls = np.convolve(low, np.ones(w) / w, mode="same")
on = ls > 0.15
edges = np.flatnonzero(np.diff(on.astype(int)))
print("\nbass on/off edges (s):", [("on" if on[e + 1] else "off", round(float(t[e]), 2)) for e in edges if t[e] < music_end])
