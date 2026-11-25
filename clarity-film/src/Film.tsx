/**
 * 整片装配：
 *   背景（底色、氛围光、等高线、星空）
 *   → 镜头层（星盘 Rig + 各段文字 Sequence，整体做微幅缩放呼吸）
 *   → 转场光晕横扫 → 暗角 → 胶片噪点 → 结尾淡出 → 音乐
 *
 * props.cut 选择版本（cuts.ts）：full = 完整版，short = 快剪版。
 */
import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import type { CutId } from "./config/cuts";
import { BG } from "./config/palette";
import { BAR_SEC, FPS, TIMELINES, TimelineContext, useTimeline } from "./config/timeline";
import { EASE_IN_OUT, ramp } from "./lib/anim";
import { AudioEnergyProvider, MUSIC_SRC, useEnergy } from "./lib/audio";
import { boundaryProgress } from "./lib/rig";
import { AmbientGlow, ContourLines, FilmGrain, LightSweep, Vignette } from "./components/background/Atmosphere";
import { StarField } from "./components/background/StarField";
import { Rig } from "./components/astrolabe/Rig";
import { Prelude } from "./scenes/Prelude";
import { QuoteScene } from "./scenes/QuoteScene";
import { Interaction } from "./scenes/Interaction";
import { Finale } from "./scenes/Finale";
import "./lib/fonts";

const PHRASE = BAR_SEC * FPS * 4;

const Picture: React.FC = () => {
  const frame = useCurrentFrame();
  const tl = useTimeline();
  const { bass } = useEnergy();

  // 画面呼吸：4 小节一个周期的缓慢缩放 + 段落切换时一次轻推 + 低频的极轻微起伏
  const breath = 0.007 * (1 - Math.cos((2 * Math.PI * frame) / PHRASE)) * 0.5;
  let bump = 0;
  for (let b = 1; b < tl.segments.length; b++) bump += 0.014 * Math.sin(Math.PI * boundaryProgress(tl, frame, b));
  const cam = 1 + breath + bump + 0.004 * bass;
  const intro = ramp(frame, 0, tl.p(45), EASE_IN_OUT);
  const ending = ramp(frame, tl.fadeOut.from, tl.fadeOut.to - tl.fadeOut.from, EASE_IN_OUT);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden", fontVariantNumeric: "lining-nums" }}>
      {/* 开场从纯黑淡入到极深暗黑底色 */}
      <AbsoluteFill style={{ opacity: intro, backgroundColor: BG }}>
        <AmbientGlow />
        <AbsoluteFill style={{ transform: `scale(${(1 + (cam - 1) * 0.5).toFixed(5)})` }}>
          <ContourLines />
          <StarField />
        </AbsoluteFill>
        <AbsoluteFill style={{ transform: `scale(${cam.toFixed(5)})` }}>
          <Rig />
          {tl.segments.map((seg, i) => (
            <Sequence
              key={i}
              from={seg.from}
              durationInFrames={seg.to - seg.from}
              name={seg.kind === "quote" ? `${String(seg.index + 1).padStart(2, "0")} ${seg.quote.keyword} · ${seg.quote.layout}` : seg.kind}
            >
              {seg.kind === "prelude" && <Prelude />}
              {seg.kind === "quote" && <QuoteScene seg={seg} />}
              {seg.kind === "interaction" && <Interaction from={seg.from} to={seg.to} />}
              {seg.kind === "finale" && <Finale from={seg.from} />}
            </Sequence>
          ))}
        </AbsoluteFill>
        <LightSweep />
      </AbsoluteFill>
      <Vignette />
      <FilmGrain opacity={0.04 * intro} />
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: ending }} />
    </AbsoluteFill>
  );
};

const Music: React.FC = () => {
  const tl = useTimeline();
  return (
    <Audio
      src={MUSIC_SRC}
      trimBefore={tl.musicStartFrame}
      volume={(f) => interpolate(f, [tl.fadeOut.from, tl.fadeOut.to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
  );
};

export const Film: React.FC<{ cut: CutId }> = ({ cut }) => (
  <TimelineContext.Provider value={TIMELINES[cut]}>
    <AudioEnergyProvider>
      <Picture />
      <Music />
    </AudioEnergyProvider>
  </TimelineContext.Provider>
);
