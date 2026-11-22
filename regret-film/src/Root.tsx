import React from "react";
import { Composition } from "remotion";
import { Film } from "./Film";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./lib/edit";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="RegretFilm"
      component={Film}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
