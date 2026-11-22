import json, sys
import numpy as np
import librosa
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MUSIC = os.path.join(ROOT, "public", "music.mp3")
RAW = os.path.join(ROOT, "docs", "music_analysis_raw.json")


y, sr = librosa.load(MUSIC, sr=22050, mono=True)
A = json.load(open(RAW))
hop = 256
yh, yp = librosa.effects.hpss(y)
S_low = librosa.feature.melspectrogram(y=yp, sr=sr, hop_length=hop, n_mels=64, fmax=200)
kick = librosa.onset.onset_strength(S=librosa.power_to_db(S_low), sr=sr, hop_length=hop)
S_hi = librosa.feature.melspectrogram(y=yp, sr=sr, hop_length=hop, n_mels=64, fmin=2000)
snare = librosa.onset.onset_strength(S=librosa.power_to_db(S_hi), sr=sr, hop_length=hop)
t = librosa.frames_to_time(np.arange(len(kick)), sr=sr, hop_length=hop)

windows = [(0, 16), (12, 28), (60, 76), (84, 100), (100, 116), (118, 134), (132, 145)]
fig, ax = plt.subplots(len(windows), 1, figsize=(26, 3.2 * len(windows)))
beats = np.array(A["beat_times"])
downs = np.array(A["downbeat_times"])
for a, (s, e) in zip(ax, windows):
    m = (t >= s) & (t < e)
    a.plot(t[m], kick[m] / kick.max(), label="kick(<200Hz perc)", color="C0")
    a.plot(t[m], -snare[m] / snare.max(), label="hi perc (>2k)", color="C3")
    tt = np.arange(int(s * sr), int(min(e, len(y) / sr) * sr)) / sr
    a.plot(tt, y[int(s * sr): int(s * sr) + len(tt)] * 1.2 + 0, color="k", lw=0.2, alpha=0.4)
    for b in beats[(beats >= s) & (beats < e)]:
        a.axvline(b, color="gray", lw=0.6, ls=":")
    for d in downs[(downs >= s) & (downs < e)]:
        a.axvline(d, color="m", lw=1.4)
    a.set_xlim(s, e)
    a.set_xticks(np.arange(s, e, 0.5), minor=True)
    a.set_xticks(np.arange(s, e, 1))
    a.grid(which="major", axis="x", alpha=0.3)
ax[0].legend(loc="upper right")
plt.tight_layout()
plt.savefig(os.path.join(ROOT, "docs", "music_beats_zoom.png"), dpi=60)
