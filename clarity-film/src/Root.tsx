import React from "react";
import { Composition } from "remotion";
import { FORMAT, FORMATS } from "./config/format";
import { FPS, TOTAL_FRAMES } from "./config/timeline";
import { Film } from "./Film";

export const RemotionRoot: React.FC = () => (
  <>
    {/* 主合成：画幅由 config/format.ts 的 FORMAT 决定 */}
    <Composition
      id="ClarityFilm"
      component={Film}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={FORMATS[FORMAT].width}
      height={FORMATS[FORMAT].height}
    />
    {/* 竖屏预览（1080×1920），排版自动切换到竖屏比例 */}
    <Composition
      id="ClarityFilmPortrait"
      component={Film}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={FORMATS.portrait.width}
      height={FORMATS.portrait.height}
    />
  </>
);
