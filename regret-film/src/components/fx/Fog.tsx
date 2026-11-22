import React from "react";
import { AbsoluteFill, Img, random, staticFile } from "remotion";

const TILE_W = 2560;

const FogLayer: React.FC<{
  src: string;
  t: number;
  speed: number;
  offset: number;
  bob: number;
  opacity: number;
}> = ({ src, t, speed, offset, bob, opacity }) => {
  const x = -(((offset + speed * t) % TILE_W) + TILE_W) % TILE_W;
  const y = Math.sin(t * 0.25 + offset) * bob;
  const img: React.CSSProperties = {
    position: "absolute",
    top: 0,
    width: TILE_W,
    height: 1080,
  };
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "screen" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)` }}>
        <Img src={staticFile(src)} style={{ ...img, left: 0 }} />
        <Img src={staticFile(src)} style={{ ...img, left: TILE_W }} />
      </div>
    </AbsoluteFill>
  );
};

/** Two parallax fog sheets drifting at different speeds. */
export const Fog: React.FC<{ intensity: number; t: number; seed: string; breath: number }> = ({
  intensity,
  t,
  seed,
  breath,
}) => {
  if (intensity <= 0) {
    return null;
  }
  const o1 = random(`${seed}-fogA`) * TILE_W;
  const o2 = random(`${seed}-fogB`) * TILE_W;
  const dir = random(`${seed}-dir`) > 0.5 ? 1 : -1;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <FogLayer src="fx/fog_b.png" t={t} speed={9 * dir} offset={o2} bob={6} opacity={intensity * 0.32 * breath} />
      <FogLayer src="fx/fog_a.png" t={t} speed={22 * dir} offset={o1} bob={10} opacity={intensity * 0.42 * breath} />
    </AbsoluteFill>
  );
};
