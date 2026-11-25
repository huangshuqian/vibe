import React from "react";
import { Composition } from "remotion";
import { FORMAT, FORMATS } from "./config/format";
import { FPS, TIMELINES } from "./config/timeline";
import { Film } from "./Film";

/**
 * 4 个合成：
 *   ClarityShort          快剪版（约 51 s），画幅由 config/format.ts 的 FORMAT 决定
 *   ClarityShortPortrait  快剪版竖屏 1080×1920
 *   ClarityFilm           完整版（132 s），画幅由 FORMAT 决定
 *   ClarityFilmPortrait   完整版竖屏 1080×1920
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="ClarityShort"
      component={Film}
      defaultProps={{ cut: "short" as const }}
      durationInFrames={TIMELINES.short.totalFrames}
      fps={FPS}
      width={FORMATS[FORMAT].width}
      height={FORMATS[FORMAT].height}
    />
    <Composition
      id="ClarityShortPortrait"
      component={Film}
      defaultProps={{ cut: "short" as const }}
      durationInFrames={TIMELINES.short.totalFrames}
      fps={FPS}
      width={FORMATS.portrait.width}
      height={FORMATS.portrait.height}
    />
    <Composition
      id="ClarityFilm"
      component={Film}
      defaultProps={{ cut: "full" as const }}
      durationInFrames={TIMELINES.full.totalFrames}
      fps={FPS}
      width={FORMATS[FORMAT].width}
      height={FORMATS[FORMAT].height}
    />
    <Composition
      id="ClarityFilmPortrait"
      component={Film}
      defaultProps={{ cut: "full" as const }}
      durationInFrames={TIMELINES.full.totalFrames}
      fps={FPS}
      width={FORMATS.portrait.width}
      height={FORMATS.portrait.height}
    />
  </>
);
