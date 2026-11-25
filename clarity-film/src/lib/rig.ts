/**
 * 星盘外环的「一镜到底」状态：每一段有一个目标位置（lib/layout.ts），
 * 段落切换时在 transitionOf() 的窗口里平滑插值过去。
 */
import { MOOD, GOLD } from "../config/palette";
import type { Stage } from "../config/format";
import type { Segment, Timeline } from "../config/timeline";
import { EASE_IN_OUT, lerp, mixHex, ramp } from "./anim";
import { rigTarget } from "./layout";

export type RigState = { cx: number; cy: number; r: number; opacity: number; mood: string };

/** 第 b 个段落切换的进度 0..1 */
export const boundaryProgress = (tl: Timeline, frame: number, b: number) => {
  const seg = tl.segments[b];
  const { lead, dur } = tl.transitionOf(seg);
  return ramp(frame, seg.from - lead, dur, EASE_IN_OUT);
};

/** 按段落取值并在切换窗口里插值（数值版） */
export const blendBySegment = (tl: Timeline, frame: number, value: (seg: Segment, i: number) => number) => {
  let v = value(tl.segments[0], 0);
  for (let b = 1; b < tl.segments.length; b++) {
    const p = boundaryProgress(tl, frame, b);
    if (p <= 0) break;
    v = lerp(v, value(tl.segments[b], b), p);
  }
  return v;
};

/** 按段落取颜色并插值 */
export const blendColorBySegment = (tl: Timeline, frame: number, value: (seg: Segment) => string) => {
  let c = value(tl.segments[0]);
  for (let b = 1; b < tl.segments.length; b++) {
    const p = boundaryProgress(tl, frame, b);
    if (p <= 0) break;
    c = mixHex(c, value(tl.segments[b]), p);
  }
  return c;
};

export const segmentMood = (seg: Segment) => (seg.kind === "quote" ? MOOD[seg.quote.mood] : GOLD);

export const rigStateAt = (tl: Timeline, frame: number, stage: Stage): RigState => {
  const targets = tl.segments.map((s) => rigTarget(stage, s, (q) => MOOD[q.mood]));
  let st: RigState = { ...targets[0], mood: targets[0].mood ?? GOLD };
  for (let b = 1; b < tl.segments.length; b++) {
    const p = boundaryProgress(tl, frame, b);
    if (p <= 0) break;
    const t = targets[b];
    st = {
      cx: lerp(st.cx, t.cx, p),
      cy: lerp(st.cy, t.cy, p),
      r: lerp(st.r, t.r, p),
      opacity: lerp(st.opacity, t.opacity, p),
      mood: mixHex(st.mood, t.mood ?? GOLD, p),
    };
  }
  return st;
};
