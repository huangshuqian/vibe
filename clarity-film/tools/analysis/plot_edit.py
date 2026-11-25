"""Step 5 (docs): draw the edit on top of the music energy curve -> docs/edit_on_music.png

    node tools/timeline.mjs > /dev/null   # (optional) sanity check first
    python tools/analysis/plot_edit.py
"""
import json
import os
import subprocess

import librosa
import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
M = json.load(open(os.path.join(ROOT, "src", "data", "music.json")))
table = subprocess.run(["node", os.path.join(ROOT, "tools", "timeline.mjs")], capture_output=True, text=True, check=True).stdout

segs = []
for line in table.splitlines():
    if not line.startswith("| ") or line.startswith("| #"):
        continue
    cells = [c.strip() for c in line.strip("|").split("|")]
    sec = lambda c: float(c.split(" s")[0]) if c else None
    # matplotlib has no CJK font here: label quotes as Q01..Q09
    name = cells[1] if not cells[1][:2].isdigit() else "Q" + cells[1][:2]
    segs.append({"name": name, "from": sec(cells[3]), "punch": sec(cells[4]), "to": sec(cells[5])})

y, sr = librosa.load(os.path.join(ROOT, "public", "music.mp3"), sr=22050, mono=True, duration=M["videoEndSec"] + 0.5)
hop = 512
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
f = librosa.fft_frequencies(sr=sr, n_fft=2048)
t = librosa.frames_to_time(np.arange(S.shape[1]), sr=sr, hop_length=hop)
win = int(0.5 * sr / hop)
sm = lambda v: np.convolve(v, np.ones(win) / win, mode="same")
low = sm(S[(f >= 30) & (f <= 150)].sum(0))
high = sm(S[f > 2000].sum(0))
rms = sm(librosa.feature.rms(y=y, hop_length=hop)[0])

colors = {"prelude": "#E6C97A", "interaction": "#888888", "finale": "#E6C97A"}
mood = ["#B8A8FF", "#3BA4FF", "#3CE6B0", "#F0B94D", "#FF5B79", "#B8A8FF", "#FF5B79", "#F0B94D", "#3BA4FF"]
fig, ax = plt.subplots(figsize=(22, 6))
ax.set_facecolor("#05060B")
ax.plot(t, rms / rms.max(), color="#EEE8DA", lw=1.2, label="RMS")
ax.plot(t, low / low.max(), color="#FF5B79", lw=1, alpha=0.8, label="low 30–150 Hz")
ax.plot(t, high / high.max(), color="#3BA4FF", lw=1, alpha=0.8, label="high > 2 kHz")
for i, s in enumerate(segs):
    c = colors.get(s["name"], mood[(i - 1) % 9])
    ax.axvspan(s["from"], s["to"], color=c, alpha=0.13)
    ax.axvline(s["from"], color=c, lw=1.4)
    if s["punch"]:
        ax.axvline(s["punch"], color=c, lw=1, ls="--")
    ax.text((s["from"] + s["to"]) / 2, 1.04, s["name"], color="#F2EBDD", ha="center", fontsize=10)
for sec in M["sections"]:
    a = M["downbeats"][sec["fromBar"]]
    ax.text(a + 0.3, -0.1, f'{sec["name"]}', fontsize=8, color="#BFC8E0")
ax.axvspan(M["fadeOutStartSec"], M["fadeOutEndSec"], color="white", alpha=0.25)
ax.set_xlim(0, M["videoEndSec"])
ax.set_ylim(-0.15, 1.1)
ax.set_xticks(np.arange(0, M["videoEndSec"], 4))
ax.set_xlabel("seconds (solid line = segment cut on a downbeat, dashed = punch downbeat)")
ax.legend(loc="lower right")
plt.tight_layout()
out = os.path.join(ROOT, "docs", "edit_on_music.png")
plt.savefig(out, dpi=70)
print("wrote", out)
