import React from "react";
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { cameraTransform } from "../lib/camera";
import { energyAt, ShotDef, TimelineEntry } from "../lib/edit";
import { Dust } from "./fx/Dust";
import { Fog } from "./fx/Fog";
import { Glow } from "./fx/Glow";
import { Rain } from "./fx/Rain";

const SOFT = Easing.bezier(0.45, 0, 0.55, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const BLUR_MAX = 16;

/**
 * Opacity / blur from the incoming and outgoing transitions.
 * Shots later in the timeline are stacked on top, so a dissolve only needs
 * the incoming shot to fade up over the (still opaque) outgoing one.
 */
const transitionState = (tl: TimelineEntry, f: number) => {
  const d = tl.durationInFrames;
  let opacity = 1;
  let blur = 0;
  const tin = tl.transitionIn;
  switch (tin.type) {
    case "fromBlack":
    case "dissolve":
      opacity *= interpolate(f, [0, tin.frames], [0, 1], { ...clamp, easing: SOFT });
      break;
    case "blur":
      opacity *= interpolate(f, [0, tin.frames], [0, 1], { ...clamp, easing: SOFT });
      blur = Math.max(blur, interpolate(f, [0, tin.frames], [BLUR_MAX, 0], { ...clamp, easing: SOFT }));
      break;
    case "dip":
      opacity *= interpolate(f, [0, tin.inFrames], [0, 1], { ...clamp, easing: SOFT });
      break;
    default:
      break;
  }
  const tout = tl.transitionOut;
  if (tout?.type === "dip") {
    opacity *= interpolate(f, [d - tout.outFrames, d], [1, 0], { ...clamp, easing: SOFT });
  }
  if (tout?.type === "blur") {
    blur = Math.max(blur, interpolate(f, [d - tout.frames, d], [0, BLUR_MAX], { ...clamp, easing: SOFT }));
  }
  return { opacity, blur };
};

export const Shot: React.FC<{ def: ShotDef; tl: TimelineEntry }> = ({ def, tl }) => {
  const f = useCurrentFrame(); // local to the shot's <Sequence>
  const { fps } = useVideoConfig();
  const t = f / fps;
  const { opacity, blur } = transitionState(tl, f);
  const cam = cameraTransform(def.motion, f, tl.durationInFrames, fps, def.id);
  // quieter passages -> thicker fog; louder -> fog thins a little
  const breath = 0.85 + 0.3 * (1 - energyAt(tl.from + f));

  return (
    <AbsoluteFill style={{ opacity, filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
      <AbsoluteFill style={{ ...cam, willChange: "transform" }}>
        <OffthreadVideo
          src={staticFile(`clips/${def.id}.mp4`)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {def.fx.glow ? <Glow {...def.fx.glow} t={t} /> : null}
      </AbsoluteFill>
      {/* atmosphere sits in front of the lens: not scaled with the camera */}
      <Fog intensity={def.fx.fog} t={t} seed={def.id} breath={breath} />
      <Rain intensity={def.fx.rain} t={t} seed={def.id} />
      <Dust intensity={def.fx.dust} t={t} seed={def.id} />
    </AbsoluteFill>
  );
};
