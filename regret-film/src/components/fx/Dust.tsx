import React, { useMemo } from "react";
import { AbsoluteFill, random } from "remotion";
import { HEIGHT, WIDTH } from "../../lib/edit";

type Mote = { x0: number; y0: number; vx: number; vy: number; size: number; alpha: number; phase: number; wob: number };

/** Sparse floating dust / light motes, drifting slowly upward. */
export const Dust: React.FC<{ intensity: number; t: number; seed: string }> = ({ intensity, t, seed }) => {
  const motes = useMemo<Mote[]>(
    () =>
      new Array(Math.round(46 * intensity)).fill(0).map((_, i) => {
        const r = (k: string) => random(`${seed}-dust-${i}-${k}`);
        return {
          x0: r("x") * WIDTH,
          y0: r("y") * HEIGHT,
          vx: (r("vx") - 0.5) * 16,
          vy: -3 - r("vy") * 9,
          size: 2 + r("s") ** 2 * 7,
          alpha: 0.25 + r("a") * 0.55,
          phase: r("p") * Math.PI * 2,
          wob: 6 + r("w") * 16,
        };
      }),
    [seed, intensity],
  );
  if (intensity <= 0) {
    return null;
  }
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none" }}>
      {motes.map((m, i) => {
        const x = (((m.x0 + m.vx * t + Math.sin(t * 0.6 + m.phase) * m.wob) % WIDTH) + WIDTH) % WIDTH;
        const y = (((m.y0 + m.vy * t) % HEIGHT) + HEIGHT) % HEIGHT;
        const flicker = 0.65 + 0.35 * Math.sin(t * 1.3 + m.phase * 3);
        const d = m.size * 3;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - d / 2,
              top: y - d / 2,
              width: d,
              height: d,
              borderRadius: "50%",
              opacity: m.alpha * flicker * intensity,
              background: "radial-gradient(circle, rgba(255,242,222,0.9) 0%, rgba(255,236,210,0.35) 30%, rgba(255,236,210,0) 68%)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
