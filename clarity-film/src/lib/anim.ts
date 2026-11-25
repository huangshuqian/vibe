/** 动画小工具：全部由帧号驱动，不使用 CSS 动画与 Math.random()。 */
import { Easing, interpolate, spring } from "remotion";

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const EASE_IN = Easing.bezier(0.55, 0, 1, 0.45);

/** 0 → 1，从 start 开始持续 dur 帧 */
export const ramp = (frame: number, start: number, dur: number, easing: (t: number) => number = EASE_OUT) => {
  if (!Number.isFinite(start)) return start < 0 ? 1 : 0;
  return dur <= 0 ? (frame >= start ? 1 : 0) : interpolate(frame, [start, start + dur], [0, 1], { ...CLAMP, easing });
};

/** 入场 ramp × 出场 ramp：在 [inStart, outEnd] 内可见 */
export const window01 = (frame: number, inStart: number, inDur: number, outEnd: number, outDur: number) =>
  ramp(frame, inStart, inDur) * (1 - ramp(frame, outEnd - outDur, outDur, EASE_IN_OUT));

export const springAt = (frame: number, start: number, fps: number, damping = 14, mass = 0.8, stiffness = 120) =>
  spring({ frame: frame - start, fps, config: { damping, mass, stiffness } });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 十六进制颜色 + 透明度 → rgba() */
export const rgba = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${clamp01(a).toFixed(3)})`;
};

/** 两个十六进制颜色插值，返回十六进制 */
export const mixHex = (a: string, b: string, t: number) => {
  const pa = parseInt(a.replace("#", ""), 16);
  const pb = parseInt(b.replace("#", ""), 16);
  const ch = (s: number) =>
    Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, clamp01(t)))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};
