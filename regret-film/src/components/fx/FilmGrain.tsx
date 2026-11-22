import React from "react";
import { AbsoluteFill, Img, random, staticFile, useCurrentFrame } from "remotion";

const PLATES = 6;

/**
 * Film grain: one of six pre-rendered neutral-grey noise plates per frame,
 * randomly offset so the pattern never visibly repeats. Overlay blend keeps
 * mid-grey neutral, so it only adds texture.
 */
export const FilmGrain: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const plate = Math.floor(random(`grain-plate-${frame}`) * PLATES);
  // plate is drawn at a uniform 1.083x so there is margin for the offset
  const dx = Math.round((random(`grain-x-${frame}`) - 0.5) * 140);
  const dy = Math.round((random(`grain-y-${frame}`) - 0.5) * 80);
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity, pointerEvents: "none", overflow: "hidden" }}>
      <Img
        src={staticFile(`fx/grain_${plate}.png`)}
        style={{
          position: "absolute",
          left: -80,
          top: -45,
          width: 2080,
          height: 1170,
          transform: `translate(${dx}px, ${dy}px)`,
        }}
      />
    </AbsoluteFill>
  );
};
