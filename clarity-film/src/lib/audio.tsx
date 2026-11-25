/**
 * 实时音频响应：useAudioData + visualizeAudio 提取低频 / 中频能量。
 *
 * - numberOfSamples = 512 → 1024 点 FFT（48 kHz 下 21 ms 窗口，每个频点 46.9 Hz）
 * - 低频 30–150 Hz（3 个频点），中频 150–2000 Hz（39 个频点）
 * - dB 归一化区间来自 tools/analysis/calibrate_reactive.py 对整首歌的统计：
 *   低频 5%/50%/98% 分位 = -42.6 / -28.1 / -17.4 dB，中频 = -44.1 / -31.4 / -25.0 dB
 * - 前后 3 帧平均 + 4 帧指数释放，避免逐帧闪烁
 *
 * 整片只在 Film 顶层算一次，用 Context 分发给各个组件。
 */
import { useAudioData, visualizeAudio, type MediaUtilsAudioData } from "@remotion/media-utils";
import React, { createContext, useContext, useMemo } from "react";
import { staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export type Energy = {
  /** 低频（底鼓 / 808）0..1 */
  bass: number;
  /** 中频（旋律 / 军鼓）0..1 */
  mid: number;
};

const ZERO: Energy = { bass: 0, mid: 0 };
const N = 512;
const BIN_HZ = 48000 / (N * 2);
const BASS_BINS = [Math.ceil(30 / BIN_HZ), Math.floor(150 / BIN_HZ)] as const;
const MID_BINS = [Math.ceil(150 / BIN_HZ), Math.floor(2000 / BIN_HZ)] as const;
const BASS_DB: [number, number] = [-40, -18];
const MID_DB: [number, number] = [-42, -25];
const RELEASE = [1, 0.78, 0.6, 0.47];

export const MUSIC_SRC = staticFile("music.mp3");

const bandMean = (spectrum: number[], [a, b]: readonly [number, number]) => {
  let s = 0;
  for (let i = a; i <= b; i++) s += spectrum[i];
  return s / (b - a + 1);
};

const norm = (v: number, [lo, hi]: [number, number]) => {
  const db = 20 * Math.log10(v + 1e-12);
  return Math.min(1, Math.max(0, (db - lo) / (hi - lo)));
};

const energyAt = (audioData: MediaUtilsAudioData, frame: number, fps: number): Energy => {
  // raw spectra for frame-4 .. frame+1, then 3-frame mean, then release envelope
  const raw = new Map<number, { bass: number; mid: number }>();
  for (let f = frame - RELEASE.length; f <= frame + 1; f++) {
    const spec = visualizeAudio({ audioData, frame: f, fps, numberOfSamples: N, smoothing: false, optimizeFor: "speed" });
    raw.set(f, { bass: bandMean(spec, BASS_BINS), mid: bandMean(spec, MID_BINS) });
  }
  const smooth = (f: number, key: "bass" | "mid") =>
    ((raw.get(f - 1)?.[key] ?? 0) + (raw.get(f)?.[key] ?? 0) + (raw.get(f + 1)?.[key] ?? 0)) / 3;

  let bass = 0;
  let mid = 0;
  RELEASE.forEach((w, k) => {
    bass = Math.max(bass, w * norm(smooth(frame - k, "bass"), BASS_DB));
    mid = Math.max(mid, w * norm(smooth(frame - k, "mid"), MID_DB));
  });
  return { bass, mid };
};

const EnergyContext = createContext<Energy>(ZERO);

export const AudioEnergyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(MUSIC_SRC);
  const value = useMemo(() => (audioData ? energyAt(audioData, frame, fps) : ZERO), [audioData, frame, fps]);
  return <EnergyContext.Provider value={value}>{children}</EnergyContext.Provider>;
};

export const useEnergy = (): Energy => useContext(EnergyContext);
