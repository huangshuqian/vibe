import { Easing, interpolate, random } from "remotion";
import { HEIGHT, Motion, WIDTH } from "./edit";

const EASE = {
  linear: Easing.linear,
  // accelerating push, used to build tension under risers
  in: Easing.bezier(0.45, 0, 0.85, 0.6),
  inOut: Easing.bezier(0.42, 0, 0.58, 1),
} as const;

/**
 * Slow, smooth pseudo-handheld drift: a sum of incommensurate sines with
 * per-shot phases. No per-frame randomness, so there is no jitter.
 */
const handheld = (t: number, seed: string, amount: number) => {
  if (!amount) {
    return { x: 0, y: 0, r: 0 };
  }
  const p = (k: number) => random(`${seed}-${k}`) * Math.PI * 2;
  const wave = (f1: number, f2: number, f3: number, o: number) =>
    0.6 * Math.sin(2 * Math.PI * f1 * t + p(o)) +
    0.3 * Math.sin(2 * Math.PI * f2 * t + p(o + 1)) +
    0.1 * Math.sin(2 * Math.PI * f3 * t + p(o + 2));
  return {
    x: 7 * amount * wave(0.21, 0.53, 1.17, 0),
    y: 5 * amount * wave(0.17, 0.47, 0.97, 3),
    r: 0.14 * amount * wave(0.11, 0.37, 0.83, 6),
  };
};

/**
 * Camera transform for a shot at local frame `f` of `duration` frames.
 * Translation is clamped so the scaled image always covers the frame.
 */
export const cameraTransform = (
  motion: Motion,
  f: number,
  duration: number,
  fps: number,
  seed: string,
) => {
  const ease = EASE[motion.ease ?? "linear"];
  const p = interpolate(f, [0, Math.max(1, duration - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const hh = handheld(f / fps, seed, motion.handheld ?? 0);
  // a little extra scale so handheld rotation/drift never exposes an edge
  const hhPad = motion.handheld ? 0.012 * motion.handheld : 0;
  const scale = interpolate(p, [0, 1], [motion.scaleFrom, motion.scaleTo]) + hhPad;
  const ox = (motion.origin[0] / 100) * WIDTH;
  const oy = (motion.origin[1] / 100) * HEIGHT;
  const rawX = interpolate(p, [0, 1], motion.x) + hh.x;
  const rawY = interpolate(p, [0, 1], motion.y) + hh.y;
  const s1 = scale - 1;
  const tx = Math.min(ox * s1 - 1, Math.max(-(WIDTH - ox) * s1 + 1, rawX));
  const ty = Math.min(oy * s1 - 1, Math.max(-(HEIGHT - oy) * s1 + 1, rawY));
  return {
    transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${scale.toFixed(5)}) rotate(${hh.r.toFixed(4)}deg)`,
    transformOrigin: `${motion.origin[0]}% ${motion.origin[1]}%`,
  };
};
