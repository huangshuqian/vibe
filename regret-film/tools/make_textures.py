"""Generate deterministic texture assets and a per-frame music energy envelope.

public/fx/grain_0..5.png  : film grain plates (neutral 50% grey, for overlay blend)
public/fx/fog_a.png, fog_b.png : seamless (periodic) fractal fog, RGBA
src/data/energy.json      : smoothed loudness per video frame, 0..1
"""
import json
import os

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = f"{ROOT}/public/fx"
os.makedirs(FX, exist_ok=True)
rng = np.random.default_rng(7)

# --- grain ---
for i in range(6):
    n = rng.normal(0, 1, (1080, 1920)).astype(np.float32)
    n = gaussian_filter(n, 0.75)
    n = n / n.std()
    img = np.clip(128 + n * 34, 0, 255).astype(np.uint8)
    Image.fromarray(img, "L").save(f"{FX}/grain_{i}.png", optimize=True)


# --- fog (periodic fractal noise via FFT, so it tiles seamlessly) ---
def fractal(h, w, beta, seed):
    r = np.random.default_rng(seed)
    white = r.normal(size=(h, w))
    F = np.fft.fft2(white)
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    # weight horizontal frequencies more -> features are wider than tall (fog banks)
    f = np.sqrt((fx * 2.4) ** 2 + fy ** 2)
    # floor the lowest frequencies so a single giant blob can't dominate the frame
    f = np.maximum(f, 5.0 / w)
    F = F / f ** beta
    F[0, 0] = 0
    n = np.real(np.fft.ifft2(F))
    n = (n - n.mean()) / n.std()
    return n


def fog(name, seed, beta, thresh, softness, color, alpha_max, vertical_bias):
    h, w = 1080, 2560
    n = fractal(h, w, beta, seed)
    a = np.clip((n - thresh) / softness, 0, 1) ** 1.4
    # denser towards the lower part of the frame (ground fog)
    yy = np.linspace(0, 1, h)[:, None]
    a = a * (1 - vertical_bias + vertical_bias * yy ** 0.8)
    a = gaussian_filter(a, 16, mode="wrap")
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = color
    rgba[..., 3] = np.clip(a * alpha_max * 255, 0, 255).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(f"{FX}/{name}.png", optimize=True)


fog("fog_a", 11, 1.75, -0.5, 2.2, (196, 206, 220), 0.85, 0.55)
fog("fog_b", 23, 1.6, -0.2, 2.0, (178, 190, 208), 0.75, 0.35)

# --- energy envelope per frame ---
import librosa  # noqa: E402

music = json.load(open(f"{ROOT}/src/data/music.json"))
y, sr = librosa.load(f"{ROOT}/public/music.mp3", sr=22050, mono=True)
fps = music["fps"]
hop = sr // fps  # 735 samples = exactly one video frame
rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop, center=True)[0]
db = librosa.amplitude_to_db(rms, ref=np.max)
# smooth ~0.8 s so it breathes instead of flickering
k = int(0.8 * fps)
win = np.hanning(k * 2 + 1)
win /= win.sum()
sm = np.convolve(np.pad(db, k, mode="edge"), win, mode="valid")
lo, hi = np.percentile(sm[: int(139 * fps)], [5, 98])
e = np.clip((sm - lo) / (hi - lo), 0, 1)
n_frames = music["durationInFrames"]
e = np.pad(e, (0, max(0, n_frames - len(e))), mode="edge")[:n_frames]
json.dump([round(float(v), 3) for v in e], open(f"{ROOT}/src/data/energy.json", "w"))
print("grain/fog written; energy frames", len(e), "mean", round(float(e.mean()), 3))
