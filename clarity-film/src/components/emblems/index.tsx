import React from "react";
import type { EmblemKind } from "../../config/content";
import type { EmblemProps } from "./common";
import { CrescentGauge } from "./CrescentGauge";
import { Corona } from "./Corona";
import { EchoRipples } from "./EchoRipples";
import { FlameVsGrid } from "./FlameVsGrid";
import { MirrorCircles } from "./MirrorCircles";
import { OffsetOrbits } from "./OffsetOrbits";
import { ProgressiveArcs } from "./ProgressiveArcs";
import { StarShield } from "./StarShield";
import { TangentRings } from "./TangentRings";

export const EMBLEMS: Record<EmblemKind, React.FC<EmblemProps>> = {
  "offset-orbits": OffsetOrbits,
  "tangent-rings": TangentRings,
  "progressive-arcs": ProgressiveArcs,
  "star-shield": StarShield,
  "crescent-gauge": CrescentGauge,
  "mirror-circles": MirrorCircles,
  "flame-vs-grid": FlameVsGrid,
  corona: Corona,
  "echo-ripples": EchoRipples,
};

export type { EmblemProps };
