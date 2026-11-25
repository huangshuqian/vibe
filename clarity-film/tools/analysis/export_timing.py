"""Step 3: export the music timing used by the Remotion project.

Writes src/data/music.json:
  - constant-tempo beat grid (linear fit of librosa beats inside the audible part)
  - grid phase corrected by the median offset of on-beat percussive onsets
  - downbeats (bar k = downbeats[k]), each snapped to the nearest percussive
    onset within +-70 ms
  - section map (bar indices) and the end / fade-out of the video

    python tools/analysis/export_timing.py
"""
import json
import os

import librosa
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MUSIC = os.path.join(ROOT, "public", "music.mp3")
RAW = os.path.join(ROOT, "docs", "music_analysis_raw.json")
OUT = os.path.join(ROOT, "src", "data", "music.json")
FPS = 30
FADE_SEC = 2.3  # picture and music fade out together over the last 2.3 s

A = json.load(open(RAW))
y, sr = librosa.load(MUSIC, sr=22050, mono=True)
file_dur = len(y) / sr

# where the music really stops (the file has ~32 s of digital silence after it)
rms = librosa.feature.rms(y=y, hop_length=256)[0]
t_rms = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=256)
music_end = float(t_rms[20 * np.log10(rms + 1e-9) > -60].max())

beats = np.array(A["beat_times"])
beats = beats[beats < music_end]
n = np.arange(len(beats))
period, offset = np.polyfit(n, beats, 1)

_, yp = librosa.effects.hpss(y)
env = librosa.onset.onset_strength(y=yp, sr=sr, hop_length=128)
on = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=128, units="time")
strength = env[librosa.time_to_frames(on, sr=sr, hop_length=128)]
rel = ((on - offset + period / 2) % period) - period / 2
strong = (strength > np.percentile(strength, 60)) & (np.abs(rel) < 0.08)
phase_fix = float(np.median(rel[strong]))
offset += phase_fix

phase = A["downbeat_phase"]
bar = 4 * period
first_down = offset + phase * period
n_bars = int(np.ceil((music_end - first_down) / bar))  # 65 bars -> grid point 65 is the end

grid = first_down + bar * np.arange(n_bars + 1)
downbeats = []
for g in grid:
    near = on[np.abs(on - g) < 0.07]
    downbeats.append(round(float(near[np.argmin(np.abs(near - g))]) if len(near) else float(g), 3))

beat_grid = [round(float(offset + k * period), 3) for k in range(int((music_end - offset) / period) + 1)]

video_end = max(grid[-1], music_end)
duration_frames = int(np.ceil(video_end * FPS))
fade_end = music_end - 0.02
fade_start = fade_end - FADE_SEC

sections = [
    {"name": "intro", "fromBar": 0, "toBar": 8,
     "mood": "铺底 + 低频脉冲，没有高频；第 3 小节（6.2 s）进踩镲，第 7 小节（14.4 s）上升音效"},
    {"name": "build1", "fromBar": 8, "toBar": 16,
     "mood": "16.4 s 整体抬升 7 dB，低音逐渐撤出，高频一路爬升，第 14 小节（28.6 s）最亮"},
    {"name": "drop1", "fromBar": 16, "toBar": 31,
     "mood": "32.6 s 低音砸入（第一次 drop）；第 23 小节（46.9 s）低音空一小节，第 24 小节重新进；第 30 小节（61.1 s）最响"},
    {"name": "break1", "fromBar": 31, "toBar": 32,
     "mood": "低音撤出，过门"},
    {"name": "breakdown", "fromBar": 32, "toBar": 40,
     "mood": "全曲最安静（约 -18 dB），只有铺底和脉冲；第 39 小节（79.4 s）上升音效"},
    {"name": "build2", "fromBar": 40, "toBar": 48,
     "mood": "81.5 s 抬升，结构同 build1，第 46 小节（93.7 s）高频最密"},
    {"name": "drop2", "fromBar": 48, "toBar": 63,
     "mood": "97.7 s 第二次 drop；第 55 小节（112.0 s）低音空一小节，第 56 小节重新进"},
    {"name": "tail", "fromBar": 63, "toBar": n_bars,
     "mood": "第 63 小节低音空拍，第 64 小节最后一小节，132.2 s 音乐硬切停止"},
]

out = {
    "source": "感知（Amageddon）.MP3",
    "fps": FPS,
    "fileDurationSec": round(file_dur, 3),
    "musicEndSec": round(music_end, 3),
    "videoEndSec": round(float(video_end), 3),
    "durationInFrames": duration_frames,
    "bpm": round(60 / period, 3),
    "beatPeriodSec": round(float(period), 5),
    "barPeriodSec": round(float(bar), 5),
    "beatsPerBar": 4,
    "gridPhaseFixMs": round(phase_fix * 1000, 1),
    "firstDownbeatSec": round(float(first_down), 4),
    "downbeats": downbeats,
    "beats": beat_grid,
    "fadeOutStartSec": round(fade_start, 3),
    "fadeOutEndSec": round(fade_end, 3),
    "sections": sections,
}
with open(OUT, "w") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)

print("music end %.3f s (file %.3f s)" % (music_end, file_dur))
print("bpm %.3f, beat %.5f s, bar %.5f s, phase fix %.1f ms" % (60 / period, period, bar, phase_fix * 1000))
print("bars %d, video end %.3f s -> %d frames, fade %.3f -> %.3f s" % (n_bars, video_end, duration_frames, fade_start, fade_end))
print("snap deltas (ms):", [round((d - g) * 1000) for d, g in zip(downbeats, grid)])
print("downbeats:", downbeats)
