/**
 * 小节号 → 秒 / 帧，以及每个版本的段落表。
 *
 * 数据来源：src/data/music.json（tools/analysis/export_timing.py 生成）。
 * 整数小节直接用吸附到打击乐起音的强拍时间，小数小节（拍）在相邻两个强拍之间线性插值。
 *
 * buildTimeline(cut) 把 cuts.ts 里的一个版本换算成视频帧；组件通过 useTimeline() 读取
 * 当前合成用的是哪个版本，所以完整版和快剪版可以同时注册成两个合成。
 */
import { createContext, useContext } from "react";
import music from "../data/music.json";
import { QUOTES, type Quote } from "./content";
import { CUTS, type Cut, type CutId } from "./cuts";

export const FPS = music.fps;
export const BEAT_SEC = music.beatPeriodSec;
export const BAR_SEC = music.barPeriodSec;
export const MUSIC = music;

const DOWN = music.downbeats;
const BEATS = music.beats;

/** 音乐里第 bar 小节的时间（秒） */
export const barSec = (bar: number): number => {
  const last = DOWN.length - 1;
  if (bar <= 0) return DOWN[0] + bar * BAR_SEC;
  if (bar >= last) return DOWN[last] + (bar - last) * BAR_SEC;
  const i = Math.floor(bar);
  return DOWN[i] + (bar - i) * (DOWN[i + 1] - DOWN[i]);
};

export type QuoteSegment = {
  kind: "quote";
  index: number;
  quote: Quote;
  from: number;
  punch: number;
  /** 关键词高亮 / 图腾高光的帧，默认等于 punch */
  accent: number;
  to: number;
};

export type Segment =
  | { kind: "prelude"; from: number; to: number }
  | QuoteSegment
  | { kind: "interaction"; from: number; to: number }
  | { kind: "finale"; from: number; to: number };

export type Timeline = {
  cut: Cut;
  pace: number;
  /** 视频第 0 帧对应音乐的第几帧（<Audio trimBefore> 和音频可视化都用它） */
  musicStartFrame: number;
  totalFrames: number;
  barFrames: number;
  beatFrames: number;
  /** 小节号 → 视频帧 */
  barFrame: (bar: number) => number;
  /** 第 bar 小节之后第 beat 拍 → 视频帧 */
  beatFrame: (bar: number, beat: number) => number;
  /** 固定帧数的动画时长 × pace */
  p: (frames: number) => number;
  fadeOut: { from: number; to: number };
  segments: Segment[];
  segmentIndexAt: (frame: number) => number;
  /** 当前小节内的相位 0..1（强拍处为 0） */
  barPhase: (frame: number) => number;
  /** 每拍一次的指数衰减脉冲 0..1 */
  beatPulse: (frame: number, decayFrames?: number) => number;
  /** 每小节强拍一次的指数衰减脉冲 0..1 */
  downbeatPulse: (frame: number, decayFrames?: number) => number;
  /**
   * 段落切换的过渡窗口：从 T - lead 开始，持续 dur 帧（T = 新段落第一拍）。
   * 星盘外环位移、氛围色、光晕横扫都用这一套窗口，保证一镜到底的节奏一致。
   */
  transitionOf: (seg: Segment) => { lead: number; dur: number };
};

/** 距离最近一个已经过去的拍（或强拍）的秒数 */
const sinceLast = (t: number, times: number[]): number => {
  if (t < times[0]) return Infinity;
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return t - times[lo];
};

export const buildTimeline = (cut: Cut): Timeline => {
  const musicStartFrame = cut.startBar === null ? 0 : Math.floor(barSec(cut.startBar) * FPS);
  const musicStartSec = musicStartFrame / FPS;
  const barFrame = (bar: number) => Math.round((barSec(bar) - musicStartSec) * FPS);
  const beatFrame = (bar: number, beat: number) => barFrame(bar + beat / music.beatsPerBar);
  const p = (frames: number) => frames * cut.pace;
  const musicTime = (frame: number) => frame / FPS + musicStartSec;

  const totalFrames = Math.ceil((barSec(cut.finale.end) - musicStartSec) * FPS);
  const fadeEndSec = Math.min(barSec(cut.finale.end), music.musicEndSec) - 0.02;
  const fadeOut = {
    from: Math.round((fadeEndSec - cut.fadeSec - musicStartSec) * FPS),
    to: Math.round((fadeEndSec - musicStartSec) * FPS),
  };

  if (cut.quotes.length !== QUOTES.length) {
    throw new Error(`cut "${cut.id}": ${cut.quotes.length} quote slots for ${QUOTES.length} quotes`);
  }

  const segments: Segment[] = [
    // 序幕从第 0 帧开始，这样序幕里的本地帧 = 绝对帧
    { kind: "prelude", from: 0, to: barFrame(cut.opening.end) },
    ...QUOTES.map((quote, index): QuoteSegment => {
      const b = cut.quotes[index];
      return {
        kind: "quote",
        index,
        quote,
        from: barFrame(b.start),
        punch: barFrame(b.punch),
        accent: barFrame(b.accent ?? b.punch),
        to: barFrame(b.end),
      };
    }),
    { kind: "interaction", from: barFrame(cut.interaction.start), to: barFrame(cut.interaction.end) },
    { kind: "finale", from: barFrame(cut.finale.start), to: totalFrames },
  ];

  // ---- 配置自检：段落首尾相接、金句和高亮在段内 ----
  segments.forEach((s, i) => {
    const next = segments[i + 1];
    if (next && next.from !== s.to) {
      throw new Error(`cut "${cut.id}": gap/overlap between segment ${i} (${s.kind}) and ${i + 1} (${next.kind})`);
    }
    if (s.kind === "quote" && !(s.from < s.punch && s.punch <= s.accent && s.accent < s.to)) {
      throw new Error(`cut "${cut.id}", quote ${s.index + 1}: need start < punch <= accent < end`);
    }
  });

  const segmentIndexAt = (frame: number) => {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (frame >= segments[i].from) return i;
    }
    return 0;
  };

  const transitionOf = (seg: Segment) => {
    const base = seg.kind === "finale" ? { lead: 4, dur: 60 } : seg.kind === "interaction" ? { lead: 12, dur: 30 } : { lead: 10, dur: 24 };
    return { lead: Math.round(p(base.lead)), dur: Math.round(p(base.dur)) };
  };

  return {
    cut,
    pace: cut.pace,
    musicStartFrame,
    totalFrames,
    barFrames: BAR_SEC * FPS,
    beatFrames: BEAT_SEC * FPS,
    barFrame,
    beatFrame,
    p,
    fadeOut,
    segments,
    segmentIndexAt,
    barPhase: (frame) => {
      const d = sinceLast(musicTime(frame), DOWN);
      return Number.isFinite(d) ? Math.min(1, d / BAR_SEC) : 0;
    },
    beatPulse: (frame, decayFrames = 7) => {
      const d = sinceLast(musicTime(frame), BEATS) * FPS;
      return Number.isFinite(d) ? Math.exp(-d / decayFrames) : 0;
    },
    downbeatPulse: (frame, decayFrames = 10) => {
      const d = sinceLast(musicTime(frame), DOWN) * FPS;
      return Number.isFinite(d) ? Math.exp(-d / decayFrames) : 0;
    },
    transitionOf,
  };
};

// 相邻两条语录禁止重复构图，9 条图腾不能重复（与版本无关）
QUOTES.forEach((q, i) => {
  if (i > 0 && QUOTES[i - 1].layout === q.layout) {
    throw new Error(`quotes ${i} and ${i + 1} use the same layout "${q.layout}"`);
  }
});
if (new Set(QUOTES.map((q) => q.emblem)).size !== QUOTES.length) {
  throw new Error("every quote needs its own emblem");
}

export const TIMELINES: Record<CutId, Timeline> = {
  full: buildTimeline(CUTS.full),
  short: buildTimeline(CUTS.short),
};

export const TimelineContext = createContext<Timeline>(TIMELINES.full);
export const useTimeline = (): Timeline => useContext(TimelineContext);
