import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FilmGrain } from "./components/fx/FilmGrain";
import { Shot } from "./components/Shot";
import { ENDING, energyAt, LETTERBOX_PX, SHOTS } from "./lib/edit";

const Vignette: React.FC<{ strength: number }> = ({ strength }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(ellipse 75% 70% at 50% 48%, rgba(0,0,0,0) 45%, rgba(2,4,10,${strength.toFixed(3)}) 100%)`,
    }}
  />
);

const Letterbox: React.FC = () =>
  LETTERBOX_PX > 0 ? (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: LETTERBOX_PX, background: "#000" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: LETTERBOX_PX, background: "#000" }} />
    </AbsoluteFill>
  ) : null;

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const energy = energyAt(frame);

  // "breathing": edges close in slightly in the quiet passages
  const vignette = 0.5 + 0.18 * (1 - energy);
  const ending = interpolate(frame, [ENDING.fadeStartSec * fps, ENDING.fadeEndSec * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.6, 1),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {SHOTS.map(({ def, tl }) => (
        <Sequence key={def.id} name={`${def.id} ${def.desc}`} from={tl.from} durationInFrames={tl.durationInFrames}>
          <Shot def={def} tl={tl} />
        </Sequence>
      ))}
      <Vignette strength={vignette} />
      <FilmGrain opacity={0.16} />
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: ending, pointerEvents: "none" }} />
      <Letterbox />
      <Audio src={staticFile("music.mp3")} />
    </AbsoluteFill>
  );
};
