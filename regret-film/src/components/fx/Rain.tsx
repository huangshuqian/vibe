import React, { useMemo } from "react";
import { AbsoluteFill, random } from "remotion";
import { HEIGHT, WIDTH } from "../../lib/edit";

type Drop = { x0: number; y0: number; speed: number; len: number; width: number; alpha: number };

const makeDrops = (seed: string, count: number, near: boolean): Drop[] =>
  new Array(count).fill(0).map((_, i) => {
    const r = (k: string) => random(`${seed}-${near ? "n" : "f"}-${i}-${k}`);
    return {
      x0: r("x") * (WIDTH + 400) - 200,
      y0: r("y") * (HEIGHT + 200),
      speed: near ? 1900 + r("s") * 700 : 1100 + r("s") * 500,
      len: near ? 70 + r("l") * 60 : 26 + r("l") * 30,
      width: near ? 1.3 + r("w") * 0.8 : 0.7 + r("w") * 0.5,
      alpha: near ? 0.1 + r("a") * 0.14 : 0.06 + r("a") * 0.1,
    };
  });

const ANGLE = 0.16; // ~9 degrees, wind from the left

const RainLayer: React.FC<{ drops: Drop[]; t: number; blur: number }> = ({ drops, t, blur }) => (
  <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0, filter: `blur(${blur}px)` }}>
    {drops.map((d, i) => {
      const span = HEIGHT + d.len + 200;
      const y = ((d.y0 + d.speed * t) % span) - d.len - 100;
      const x = d.x0 + y * ANGLE;
      return (
        <line
          key={i}
          x1={x}
          y1={y}
          x2={x + d.len * ANGLE}
          y2={y + d.len}
          stroke="rgb(205,218,235)"
          strokeOpacity={d.alpha}
          strokeWidth={d.width}
          strokeLinecap="round"
        />
      );
    })}
  </svg>
);

/** Two depth layers of motion-blurred rain streaks, deterministic per shot. */
export const Rain: React.FC<{ intensity: number; t: number; seed: string }> = ({ intensity, t, seed }) => {
  const far = useMemo(() => makeDrops(seed, Math.round(160 * intensity), false), [seed, intensity]);
  const near = useMemo(() => makeDrops(seed, Math.round(38 * intensity), true), [seed, intensity]);
  if (intensity <= 0) {
    return null;
  }
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none" }}>
      <RainLayer drops={far} t={t} blur={0.5} />
      <RainLayer drops={near} t={t} blur={1.2} />
    </AbsoluteFill>
  );
};
