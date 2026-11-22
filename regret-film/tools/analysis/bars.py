import json
import numpy as np
import librosa
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MUSIC = os.path.join(ROOT, "public", "music.mp3")
RAW = os.path.join(ROOT, "docs", "music_analysis_raw.json")


y, sr = librosa.load(MUSIC, sr=22050, mono=True)
A = json.load(open(RAW))
beats = np.array(A["beat_times"])
ibi = np.diff(beats)
print("IBI mean %.4f std %.4f min %.3f max %.3f -> BPM %.2f" % (ibi.mean(), ibi.std(), ibi.min(), ibi.max(), 60 / ibi.mean()))

# Fit a linear grid to beats (constant tempo check)
n = np.arange(len(beats))
p = np.polyfit(n, beats, 1)
resid = beats - np.polyval(p, n)
print("linear fit period %.5f offset %.4f, resid max %.3f" % (p[0], p[1], np.abs(resid).max()))

hop = 256
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
t = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
f = librosa.fft_frequencies(sr=sr, n_fft=2048)
low = S[(f >= 30) & (f <= 150)].sum(0)
high = S[f > 3000].sum(0)
low /= low.max(); high /= high.max()

downs = np.array(A["downbeat_times"])
# extend grid with fitted period
period = p[0] * 4
print("bar period %.4f" % period)
grid = np.arange(downs[0] - period, 145, period)
print("\nbar |  start |  rmsdB | low  | high | note")
for i, s in enumerate(grid):
    e = s + period
    m = (t >= max(s, 0)) & (t < e)
    if m.sum() == 0:
        continue
    db = 20 * np.log10(rms[m].mean() + 1e-9)
    print("%3d | %6.2f | %6.1f | %.2f | %.3f" % (i, s, db, low[m].mean(), high[m].mean()))

# fine RMS minima (pauses) at 50ms resolution
win = int(0.25 * sr / hop)
rs = np.convolve(rms, np.ones(win) / win, mode="same")
db = 20 * np.log10(rs + 1e-9)
print("\nlocal quiet points (250ms smoothed) below -30 dBFS-rel:")
ref = db.max()
for a, b in [(59, 63), (67, 72), (96, 99), (104, 107), (122, 125), (131, 134), (139, 145)]:
    m = (t >= a) & (t < b)
    i = np.argmin(db[m])
    print("  window %d-%d: min at %.2fs  %.1f dB (rel)" % (a, b, t[m][i], db[m][i] - ref))
