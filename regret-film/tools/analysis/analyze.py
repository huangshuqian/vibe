"""Music analysis for the cinematic music video.

Outputs docs/music_analysis_raw.json and docs/music_overview.png
"""
import json
import numpy as np
import librosa
import scipy.signal as sps
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MUSIC = os.path.join(ROOT, "public", "music.mp3")
RAW = os.path.join(ROOT, "docs", "music_analysis_raw.json")


SRC = MUSIC
OUT = os.path.join(ROOT, "docs")

y, sr = librosa.load(SRC, sr=22050, mono=True)
dur = len(y) / sr
hop = 512

# --- Energy / loudness ---
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
rms_db = librosa.amplitude_to_db(rms, ref=np.max)
t_rms = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)

# Low band (kick) energy via STFT
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
low = S[(freqs >= 30) & (freqs <= 150)].sum(axis=0)
mid = S[(freqs > 150) & (freqs <= 2000)].sum(axis=0)
high = S[freqs > 2000].sum(axis=0)

# --- Onsets ---
onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=hop, backtrack=False)
onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop)

# Kick-specific onset envelope
y_harm, y_perc = librosa.effects.hpss(y)
onset_perc = librosa.onset.onset_strength(y=y_perc, sr=sr, hop_length=hop)
S_low = librosa.feature.melspectrogram(y=y_perc, sr=sr, hop_length=hop, n_mels=64, fmax=200)
kick_env = librosa.onset.onset_strength(S=librosa.power_to_db(S_low), sr=sr, hop_length=hop)

# --- Tempo / beats ---
tempo_global, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop)
tempo_global = float(np.atleast_1d(tempo_global)[0])
beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)

# Tempogram based candidate tempos (for half/double check)
ac = librosa.autocorrelate(onset_perc, max_size=int(4 * sr / hop))
lags = np.arange(len(ac)) * hop / sr
valid = (lags > 0.25) & (lags < 2.0)
cand_idx = sps.find_peaks(ac * valid, distance=5)[0]
cand = sorted(cand_idx, key=lambda i: -ac[i])[:6]
cand_bpm = [(round(60 / lags[i], 2), float(ac[i] / ac[0])) for i in cand]

# Alternate prior tempos
tempo_alt = {}
for start_bpm in (70, 90, 140):
    tb, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop, start_bpm=start_bpm)
    tempo_alt[start_bpm] = float(np.atleast_1d(tb)[0])

# --- Downbeats: choose phase (0..3) maximizing low-band energy on beats ---
beat_low = np.array([kick_env[max(0, f - 1): f + 2].max() for f in beat_frames])
phase_scores = [beat_low[p::4].mean() for p in range(4)]
phase = int(np.argmax(phase_scores))
downbeat_times = beat_times[phase::4]

# --- Section segmentation (novelty on chroma + mfcc) ---
chroma = librosa.feature.chroma_cqt(y=y_harm, sr=sr, hop_length=hop)
mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=13)
feat = np.vstack([librosa.util.normalize(chroma, axis=1), librosa.util.normalize(mfcc, axis=1)])
# beat-synchronous
feat_sync = librosa.util.sync(feat, beat_frames, aggregate=np.median)
bounds = librosa.segment.agglomerative(feat_sync, 10)
bound_beats = [beat_frames[min(b, len(beat_frames) - 1)] for b in bounds]
bound_times = librosa.frames_to_time(bound_beats, sr=sr, hop_length=hop)

# --- Smoothed energy curve (1s window) ---
win = int(sr / hop)  # ~1 s
rms_s = np.convolve(rms, np.ones(win) / win, mode="same")
rms_s_db = librosa.amplitude_to_db(rms_s, ref=np.max)
low_s = np.convolve(low, np.ones(win) / win, mode="same")
low_s = low_s / low_s.max()

# per-second table
per_sec = []
for s in range(int(np.ceil(dur))):
    m = (t_rms >= s) & (t_rms < s + 1)
    if m.sum() == 0:
        continue
    per_sec.append({
        "t": s,
        "rms_db": round(float(rms_db[m].mean()), 1),
        "low": round(float(low[m].mean() / low.max()), 3),
        "high": round(float(high[m].mean() / high.max()), 3),
        "onset": round(float(onset_env[m].mean()), 2),
        "kick": round(float(kick_env[m].max()), 2),
    })

# --- Pauses / dips: frames where smoothed RMS drops > 8 dB below local median ---
loc_med = sps.medfilt(rms_s_db, kernel_size=int(8 * sr / hop) | 1)
dips = []
in_dip = False
for i, (v, m) in enumerate(zip(rms_s_db, loc_med)):
    if v < m - 6 and not in_dip:
        in_dip = True
        st = t_rms[i]
    elif v >= m - 6 and in_dip:
        in_dip = False
        dips.append((round(float(st), 2), round(float(t_rms[i]), 2)))

# Strong onsets (top 8% of percussive onset strength)
thr = np.percentile(onset_perc, 92)
strong_frames = sps.find_peaks(onset_perc, height=thr, distance=int(0.25 * sr / hop))[0]
strong_times = librosa.frames_to_time(strong_frames, sr=sr, hop_length=hop)

# Kick hits (strong low-band onsets)
kthr = np.percentile(kick_env, 90)
kick_frames = sps.find_peaks(kick_env, height=kthr, distance=int(0.3 * sr / hop))[0]
kick_times = librosa.frames_to_time(kick_frames, sr=sr, hop_length=hop)

result = {
    "duration": dur,
    "tempo_beat_track": tempo_global,
    "tempo_alt_priors": tempo_alt,
    "tempo_autocorr_candidates": cand_bpm,
    "beat_times": [round(float(b), 3) for b in beat_times],
    "downbeat_phase": phase,
    "downbeat_phase_scores": [round(float(p), 3) for p in phase_scores],
    "downbeat_times": [round(float(b), 3) for b in downbeat_times],
    "section_boundaries": [round(float(b), 2) for b in bound_times],
    "onset_times": [round(float(o), 3) for o in onset_times],
    "strong_onsets": [round(float(o), 3) for o in strong_times],
    "kick_times": [round(float(o), 3) for o in kick_times],
    "dips": dips,
    "per_second": per_sec,
}
with open(RAW, "w") as f:
    json.dump(result, f, ensure_ascii=False, indent=1)

# --- Plot ---
fig, ax = plt.subplots(5, 1, figsize=(26, 16), sharex=True)
ax[0].plot(np.arange(len(y)) / sr, y, lw=0.3, color="k")
ax[0].set_title("waveform")
ax[1].plot(t_rms, rms_db, lw=0.5, label="rms dB")
ax[1].plot(t_rms, rms_s_db, lw=1.5, label="rms 1s")
ax[1].legend()
ax[2].plot(t_rms, low_s, label="low 30-150Hz (1s)")
ax[2].plot(t_rms, np.convolve(high, np.ones(win) / win, mode="same") / high.max(), label="high >2k (1s)")
ax[2].legend()
ax[3].plot(t_rms[: len(onset_perc)], onset_perc, lw=0.5, label="perc onset")
ax[3].plot(t_rms[: len(kick_env)], kick_env, lw=0.5, alpha=0.7, label="kick env")
for k in kick_times:
    ax[3].axvline(k, color="r", lw=0.3, alpha=0.5)
ax[3].legend()
librosa.display.specshow(librosa.amplitude_to_db(S, ref=np.max), sr=sr, hop_length=hop, x_axis="time", y_axis="log", ax=ax[4])
for a in ax:
    for b in bound_times:
        a.axvline(b, color="g", lw=1.5)
    for d in downbeat_times:
        a.axvline(d, color="m", lw=0.3, alpha=0.4)
ax[4].set_xticks(np.arange(0, dur, 4))
plt.tight_layout()
plt.savefig(f"{OUT}/music_overview.png", dpi=70)

print("duration", dur)
print("tempo beat_track", tempo_global, "alt", tempo_alt)
print("autocorr candidates (bpm, strength)", cand_bpm)
print("n beats", len(beat_times), "first beats", np.round(beat_times[:12], 2))
print("downbeat phase", phase, phase_scores)
print("sections", np.round(bound_times, 2))
print("dips", dips)
print("n kicks", len(kick_times))
