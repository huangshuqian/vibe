/**
 * 小节号 → 秒 / 帧，以及整片的段落表。
 *
 * 数据来源：src/data/music.json（tools/analysis/export_timing.py 生成）。
 * 整数小节直接用吸附到打击乐起音的强拍时间，小数小节（拍）在相邻两个强拍之间线性插值。
 */
import music from "../data/music.json";
import { FINALE, INTERACTION, OPENING, QUOTES, type Quote } from "./content";

export const FPS = music.fps;
export const TOTAL_FRAMES = music.durationInFrames;
export const BEAT_SEC = music.beatPeriodSec;
export const BAR_SEC = music.barPeriodSec;
export const BEAT_FRAMES = BEAT_SEC * FPS;

const DOWN = music.downbeats;

export const barSec = (bar: number): number => {
  const last = DOWN.length - 1;
  if (bar <= 0) return DOWN[0] + bar * BAR_SEC;
  if (bar >= last) return DOWN[last] + (bar - last) * BAR_SEC;
  const i = Math.floor(bar);
  return DOWN[i] + (bar - i) * (DOWN[i + 1] - DOWN[i]);
};

export const barFrame = (bar: number): number => Math.round(barSec(bar) * FPS);

/** 第 bar 小节之后第 beat 拍（每小节 4 拍） */
export const beatFrame = (bar: number, beat: number): number => barFrame(bar + beat / music.beatsPerBar);

export const FADE_OUT = {
  from: Math.round(music.fadeOutStartSec * FPS),
  to: Math.round(music.fadeOutEndSec * FPS),
};

export type QuoteSegment = {
  kind: "quote";
  index: number;
  quote: Quote;
  from: number;
  punch: number;
  to: number;
};

export type Segment =
  | { kind: "prelude"; from: number; to: number }
  | QuoteSegment
  | { kind: "interaction"; from: number; to: number }
  | { kind: "finale"; from: number; to: number };

export const SEGMENTS: Segment[] = [
  // 序幕从第 0 帧开始（第一个强拍在 0.093 s），这样序幕里的本地帧 = 绝对帧
  { kind: "prelude", from: 0, to: barFrame(OPENING.bars.end) },
  ...QUOTES.map(
    (quote, index): QuoteSegment => ({
      kind: "quote",
      index,
      quote,
      from: barFrame(quote.bars.start),
      punch: barFrame(quote.bars.punch),
      to: barFrame(quote.bars.end),
    }),
  ),
  { kind: "interaction", from: barFrame(INTERACTION.bars.start), to: barFrame(INTERACTION.bars.end) },
  { kind: "finale", from: barFrame(FINALE.bars.start), to: TOTAL_FRAMES },
];

// ---- 配置自检：段落首尾相接、金句在段内、相邻两条构图不重复 ----
SEGMENTS.forEach((s, i) => {
  const next = SEGMENTS[i + 1];
  if (next && next.from !== s.to) {
    throw new Error(`timeline gap/overlap between segment ${i} (${s.kind}) and ${i + 1} (${next.kind})`);
  }
  if (s.kind === "quote" && !(s.from < s.punch && s.punch < s.to)) {
    throw new Error(`quote ${s.index + 1}: punch bar must be inside [start, end)`);
  }
});
QUOTES.forEach((q, i) => {
  if (i > 0 && QUOTES[i - 1].layout === q.layout) {
    throw new Error(`quotes ${i} and ${i + 1} use the same layout "${q.layout}"`);
  }
});
if (new Set(QUOTES.map((q) => q.emblem)).size !== QUOTES.length) {
  throw new Error("every quote needs its own emblem");
}

/** 每条语录解析后的起止时间（秒 / 帧），方便核对卡点 */
export const QUOTE_TIMELINE = SEGMENTS.filter((s): s is QuoteSegment => s.kind === "quote").map((s) => ({
  no: s.index + 1,
  startSec: +(s.from / FPS).toFixed(3),
  punchSec: +(s.punch / FPS).toFixed(3),
  endSec: +(s.to / FPS).toFixed(3),
  startFrame: s.from,
  punchFrame: s.punch,
  endFrame: s.to,
}));

export const segmentIndexAt = (frame: number): number => {
  for (let i = SEGMENTS.length - 1; i >= 0; i--) {
    if (frame >= SEGMENTS[i].from) return i;
  }
  return 0;
};

const BEATS = music.beats;

/** 距离最近一个已经过去的拍（或强拍）的帧数 */
const sinceLast = (frame: number, times: number[]): number => {
  const t = frame / FPS;
  let lo = 0;
  let hi = times.length - 1;
  if (t < times[0]) return Infinity;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return (t - times[lo]) * FPS;
};

/** 每拍一次的指数衰减脉冲（0..1） */
export const beatPulse = (frame: number, decayFrames = 7): number => {
  const d = sinceLast(frame, BEATS);
  return Number.isFinite(d) ? Math.exp(-d / decayFrames) : 0;
};

/** 每小节强拍一次的指数衰减脉冲（0..1） */
export const downbeatPulse = (frame: number, decayFrames = 10): number => {
  const d = sinceLast(frame, DOWN);
  return Number.isFinite(d) ? Math.exp(-d / decayFrames) : 0;
};

/** 当前小节内的相位 0..1（强拍处为 0） */
export const barPhase = (frame: number): number => {
  const d = sinceLast(frame, DOWN);
  return Number.isFinite(d) ? Math.min(1, d / (BAR_SEC * FPS)) : 0;
};

/**
 * 段落切换的过渡窗口：从 T - lead 开始，持续 dur 帧（T = 新段落第一拍）。
 * 星盘外环位移、氛围色、光晕横扫都用这一套窗口，保证一镜到底的节奏一致。
 */
export const transitionOf = (seg: Segment): { lead: number; dur: number } => {
  if (seg.kind === "finale") return { lead: 4, dur: 60 };
  if (seg.kind === "interaction") return { lead: 12, dur: 30 };
  return { lead: 10, dur: 24 };
};

export const MUSIC = music;
