import React from "react";
import { AbsoluteFill } from "remotion";

/** Soft warm bloom around a practical light source. */
export const Glow: React.FC<{ x: number; y: number; strength: number; t: number }> = ({ x, y, strength, t }) => {
  const s = strength * (0.9 + 0.1 * Math.sin(t * 0.9));
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: "screen",
        opacity: s,
        background: `radial-gradient(ellipse 38% 46% at ${x}% ${y}%, rgba(255,196,130,0.85) 0%, rgba(255,170,100,0.3) 35%, rgba(255,160,90,0) 70%)`,
        pointerEvents: "none",
      }}
    />
  );
};
