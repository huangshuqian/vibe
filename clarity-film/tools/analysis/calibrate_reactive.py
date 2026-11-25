"""Step 4: calibrate the audio-reactive normalization used in src/lib/audio.ts.

Re-implements what @remotion/media-utils visualizeAudio() returns
(channel 0 at 48 kHz, rectangular window of 2 * numberOfSamples samples,
|FFT| / (N/2) / maxInt16, 3-pass bin smoothing, 3-frame time smoothing)
and prints the dB percentiles of the bass and mid bands per section.
The dB floor/ceiling in src/lib/audio.ts come from this output.

    python tools/analysis/calibrate_reactive.py
"""
import json
import os

import librosa
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MUSIC = os.path.join(ROOT, "public", "music.mp3")
M = json.load(open(os.path.join(ROOT, "src", "data", "music.json")))

SR = 48000
FPS = 30
N_SAMPLES = 512  # numberOfSamples passed to visualizeAudio
WIN = N_SAMPLES * 2
BASS = (30, 150)
MID = (150, 2000)

y, _ = librosa.load(MUSIC, sr=SR, mono=False)
ch0 = y[0]
ints = np.where(ch0 > 0, ch0 * 0x7FFF, ch0 * 0x8000)
max_int = np.abs(ints).max()
freqs = np.fft.rfftfreq(WIN, 1 / SR)[: WIN // 2]


def smoothen(a):
    a = a.copy()
    for _ in range(3):
        b = a.copy()
        b[1:-1] = (a[:-2] + a[1:-1] + a[2:]) / 3
        a = b
    return a


def vis(frame):
    c = int(np.floor(frame / FPS * SR))
    s, e = c - WIN // 2, c + WIN // 2
    buf = np.zeros(WIN)
    seg = ints[max(0, s): e]
    buf[max(0, s) - s: max(0, s) - s + len(seg)] = seg
    mag = np.abs(np.fft.fft(buf))[: WIN // 2]
    return smoothen(mag) / (WIN / 2) / max_int


n_frames = M["durationInFrames"]
raw = np.array([vis(f) for f in range(n_frames + 1)])
sm = np.vstack([raw[0], (raw[:-2] + raw[1:-1] + raw[2:]) / 3, raw[-1]])[: n_frames]


def band_db(lo, hi):
    m = (freqs >= lo) & (freqs < hi)
    return 20 * np.log10(sm[:, m].mean(1) + 1e-12)


bass, mid = band_db(*BASS), band_db(*MID)
t = np.arange(n_frames) / FPS
bars = np.array(M["downbeats"])
print("bins: bass %d, mid %d (bin width %.1f Hz)" % (((freqs >= BASS[0]) & (freqs < BASS[1])).sum(),
                                                    ((freqs >= MID[0]) & (freqs < MID[1])).sum(), SR / WIN))
for sec in M["sections"]:
    a = bars[sec["fromBar"]]
    b = bars[sec["toBar"]] if sec["toBar"] < len(bars) else M["musicEndSec"]
    m = (t >= a) & (t < b)
    print("%-10s bass p10/p50/p90 %6.1f %6.1f %6.1f | mid %6.1f %6.1f %6.1f" % (
        sec["name"], *np.percentile(bass[m], [10, 50, 90]), *np.percentile(mid[m], [10, 50, 90])))
m = t < M["musicEndSec"]
print("ALL        bass p5/p50/p98 %6.1f %6.1f %6.1f | mid %6.1f %6.1f %6.1f" % (
    *np.percentile(bass[m], [5, 50, 98]), *np.percentile(mid[m], [5, 50, 98])))
