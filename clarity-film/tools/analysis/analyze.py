"""Step 1: raw music analysis for 清醒录.

Reads public/music.mp3, writes docs/music_analysis_raw.json and
docs/music_overview.png. Prints a summary to stdout.

    python tools/analysis/analyze.py
"""
import json
import os

import librosa
import librosa.display
import matplotlib
import numpy as np
import scipy.signal as sps

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MUSIC = os.path.join(ROOT, "public", "music.mp3")
DOCS = os.path.join(ROOT, "docs")
RAW = os.path.join(DOCS, "music_analysis_raw.json")
os.makedirs(DOCS, exist_ok=True)

y, sr = librosa.load(MUSIC, sr=22050, mono=True)
dur = len(y) / sr
hop = 512

# --- loudness and band energy ---
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
rms_db = librosa.amplitude_to_db(rms, ref=np.max)
t_rms = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)

S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
low = S[(freqs >= 30) & (freqs <= 150)].sum(axis=0)
mid = S[(freqs > 150) & (freqs <= 2000)].sum(axis=0)
high = S[freqs > 2000].sum(axis=0)

# --- onsets ---
onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=hop)
onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop)

y_harm, y_perc = librosa.effects.hpss(y)
onset_perc = librosa.onset.onset_strength(y=y_perc, sr=sr, hop_length=hop)
S_low = librosa.feature.melspectrogram(y=y_perc, sr=sr, hop_length=hop, n_mels=64, fmax=200)
kick_env = librosa.onset.onset_strength(S=librosa.power_to_db(S_low), sr=sr, hop_length=hop)

# --- tempo / beats ---
tempo_global, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop)
tempo_global = float(np.atleast_1d(tempo_global)[0])
beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)

# half / double tempo check: autocorrelation peaks of the percussive onset envelope
ac = librosa.autocorrelate(onset_perc, max_size=int(4 * sr / hop))
lags = np.arange(len(ac)) * hop / sr
valid = (lags > 0.25) & (lags < 2.0)
cand_idx = sps.find_peaks(ac * valid, distance=5)[0]
cand = sorted(cand_idx, key=lambda i: -ac[i])[:6]
cand_bpm = [(round(60 / lags[i], 2), round(float(ac[i] / ac[0]), 3)) for i in cand]

tempo_alt = {}
for start_bpm in (70, 90, 120, 140):
    tb, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop, start_bpm=start_bpm)
    tempo_alt[start_bpm] = round(float(np.atleast_1d(tb)[0]), 2)

# --- downbeat phase: beat phase (0..3) with the most low-band kick energy ---
beat_low = np.array([kick_env[max(0, f - 1): f + 2].max() for f in beat_frames])
phase_scores = [float(beat_low[p::4].mean()) for p in range(4)]
phase = int(np.argmax(phase_scores))
downbeat_times = beat_times[phase::4]

# --- section novelty (chroma + mfcc, beat-synchronous) ---
chroma = librosa.feature.chroma_cqt(y=y_harm, sr=sr, hop_length=hop)
mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=13)
feat = np.vstack([librosa.util.normalize(chroma, axis=1), librosa.util.normalize(mfcc, axis=1)])
feat_sync = librosa.util.sync(feat, beat_frames, aggregate=np.median)
bounds = librosa.segment.agglomerative(feat_sync, 10)
bound_beats = [beat_frames[min(b, len(beat_frames) - 1)] for b in bounds]
bound_times = librosa.frames_to_time(bound_beats, sr=sr, hop_length=hop)

# --- 1 s smoothed curves ---
win = int(sr / hop)
rms_s = np.convolve(rms, np.ones(win) / win, mode="same")
rms_s_db = librosa.amplitude_to_db(rms_s, ref=np.max)
low_s = np.convolve(low, np.ones(win) / win, mode="same") / low.max()
high_s = np.convolve(high, np.ones(win) / win, mode="same") / high.max()

per_sec = []
for s in range(int(np.ceil(dur))):
    m = (t_rms >= s) & (t_rms < s + 1)
    if m.sum() == 0:
        continue
    per_sec.append({
        "t": s,
        "rms_db": round(float(rms_db[m].mean()), 1),
        "low": round(float(low[m].mean() / low.max()), 3),
        "mid": round(float(mid[m].mean() / mid.max()), 3),
        "high": round(float(high[m].mean() / high.max()), 3),
        "onset": round(float(onset_env[m].mean()), 2),
        "kick": round(float(kick_env[m].max()), 2),
    })

# pauses: smoothed RMS more than 6 dB below the local 8 s median
loc_med = sps.medfilt(rms_s_db, kernel_size=int(8 * sr / hop) | 1)
dips, in_dip, st = [], False, 0.0
for i, (v, m) in enumerate(zip(rms_s_db, loc_med)):
    if v < m - 6 and not in_dip:
        in_dip, st = True, t_rms[i]
    elif v >= m - 6 and in_dip:
        in_dip = False
        dips.append((round(float(st), 2), round(float(t_rms[i]), 2)))

thr = np.percentile(onset_perc, 92)
strong_frames = sps.find_peaks(onset_perc, height=thr, distance=int(0.25 * sr / hop))[0]
strong_times = librosa.frames_to_time(strong_frames, sr=sr, hop_length=hop)
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
    "downbeat_phase_scores": [round(p, 3) for p in phase_scores],
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

fig, ax = plt.subplots(5, 1, figsize=(30, 16), sharex=True)
ax[0].plot(np.arange(len(y)) / sr, y, lw=0.3, color="k")
ax[0].set_title("waveform")
ax[1].plot(t_rms, rms_db, lw=0.5, label="rms dB")
ax[1].plot(t_rms, rms_s_db, lw=1.5, label="rms 1 s")
ax[1].legend()
ax[2].plot(t_rms, low_s, label="low 30-150 Hz (1 s)")
ax[2].plot(t_rms, high_s, label="high >2 kHz (1 s)")
ax[2].legend()
ax[3].plot(t_rms[: len(onset_perc)], onset_perc, lw=0.5, label="perc onset")
ax[3].plot(t_rms[: len(kick_env)], kick_env, lw=0.5, alpha=0.7, label="kick env")
for k in kick_times:
    ax[3].axvline(k, color="r", lw=0.3, alpha=0.5)
ax[3].legend()
librosa.display.specshow(librosa.amplitude_to_db(S, ref=np.max), sr=sr, hop_length=hop,
                         x_axis="time", y_axis="log", ax=ax[4])
for a in ax:
    for b in bound_times:
        a.axvline(b, color="g", lw=1.5)
    for d in downbeat_times:
        a.axvline(d, color="m", lw=0.3, alpha=0.4)
ax[4].set_xticks(np.arange(0, dur, 4))
plt.tight_layout()
plt.savefig(os.path.join(DOCS, "music_overview.png"), dpi=60)

print("duration", round(dur, 3))
print("tempo beat_track", round(tempo_global, 2), "alt priors", tempo_alt)
print("autocorr candidates (bpm, strength)", cand_bpm)
print("n beats", len(beat_times), "first beats", np.round(beat_times[:12], 2))
print("downbeat phase", phase, [round(p, 3) for p in phase_scores])
print("sections", np.round(bound_times, 2))
print("dips", dips)
print("n kicks", len(kick_times))
