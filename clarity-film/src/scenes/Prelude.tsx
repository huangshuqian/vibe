/**
 * 星盘序幕。时间点在 cuts.ts 的 opening 里，以完整版（前奏 bar 0–8，0–16.4 s）为例：
 *   bar 0 +2 拍  中心亮起暖金微光点（ignite）
 *   bar 1        向左右拉出细长水平光线（line）
 *   bar 2        上方逐字扫光浮现开场引导句（text）
 *   bar 4        光线收束，星盘轨道描边生长（orbit，在 Rig 里）
 *   bar 5–7      9 枚节点按拍依次点亮（nodes，Rig），bar 6 星网连线（net）
 *   bar 7        总标题浮现（title）；bar 8 第一个重拍切入正片（end）
 * 快剪版把这些压进 2 小节（bar 8–10）。
 * 这里的帧号都是绝对帧（序幕从 0 开始，与 Sequence 本地帧相同）。
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { OPENING } from "../config/content";
import { TYPE, useStage } from "../config/format";
import { GOLD, INK } from "../config/palette";
import { useTimeline } from "../config/timeline";
import { EASE_IN_OUT, ramp, rgba, springAt } from "../lib/anim";
import { useEnergy } from "../lib/audio";
import { FONT_CN, FONT_EN } from "../lib/fonts";
import { CharReveal, fitSize } from "../components/text/CharReveal";
import { EnglishLine } from "../components/text/Marks";

export const Prelude: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { W, H, u } = useStage();
  const { bass } = useEnergy();
  const { cut, barFrame, barFrames, p } = useTimeline();
  const b = cut.opening;

  const ignite = springAt(frame, barFrame(b.ignite), fps, 10, 1, 80);
  const pointFade = 1 - ramp(frame, barFrame(b.title) - p(6), p(14));
  const lineOpen = ramp(frame, barFrame(b.line), p(barFrames * 1.3));
  const lineClose = ramp(frame, barFrame(b.orbit) - p(4), p(22), EASE_IN_OUT);
  const lineW = W * 0.62 * lineOpen * (1 - lineClose);
  const textOut = ramp(frame, barFrame(b.textOut) - p(6), p(16), EASE_IN_OUT);
  const titleIn = ramp(frame, barFrame(b.title), p(26));
  const titleOut = ramp(frame, barFrame(b.end) - p(10), p(10), EASE_IN_OUT);
  const cy = H / 2;
  const lineSize = fitSize(OPENING.line, W * 0.86, TYPE.openingLine * u, 0.16);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* 水平光线 */}
      <div
        style={{
          position: "absolute",
          left: W / 2 - lineW / 2,
          top: cy - 0.75 * u,
          width: lineW,
          height: 1.5 * u,
          background: `linear-gradient(90deg, ${rgba(GOLD, 0)}, ${rgba(GOLD, 0.85)} 30%, #FFF6DC 50%, ${rgba(GOLD, 0.85)} 70%, ${rgba(GOLD, 0)})`,
          boxShadow: `0 0 ${10 * u}px ${rgba(GOLD, 0.6)}`,
        }}
      />
      {/* 暖金微光点 */}
      <div
        style={{
          position: "absolute",
          left: W / 2,
          top: cy,
          width: 0,
          height: 0,
          opacity: pointFade,
        }}
      >
        {[
          { s: 220, c: rgba(GOLD, 0.12) },
          { s: 70, c: rgba(GOLD, 0.35) },
          { s: 16, c: "#FFF6DE" },
        ].map(({ s, c }, i) => {
          const size = s * u * ignite * (1 + (i === 0 ? 0.25 * bass : 0.08 * bass));
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: -size / 2,
                top: -size / 2,
                width: size,
                height: size,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${c} 0%, ${i === 2 ? rgba(GOLD, 0.8) : rgba(GOLD, 0)} ${i === 2 ? 45 : 70}%, ${rgba(GOLD, 0)} 100%)`,
              }}
            />
          );
        })}
      </div>
      {/* 开场引导句（光线上方） */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: cy - 30 * u - lineSize * TYPE.lineHeight,
          display: "flex",
          justifyContent: "center",
          opacity: 1 - textOut,
          filter: textOut > 0 ? `blur(${(textOut * 4).toFixed(2)}px)` : undefined,
          transform: `translateY(${(-textOut * 16 * u).toFixed(2)}px)`,
        }}
      >
        <CharReveal
          text={OPENING.line}
          start={barFrame(b.text)}
          stagger={p(3)}
          dur={p(18)}
          blur={3}
          fontSize={lineSize}
          fontFamily={FONT_CN}
          fontWeight={300}
          letterSpacing="0.16em"
          color={rgba(INK, 0.92)}
          align="center"
        />
      </div>
      {/* 总标题 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: cy,
          transform: `translateY(-50%) scale(${1.04 - 0.04 * titleIn + 0.05 * titleOut})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: titleIn * (1 - titleOut),
          filter: `blur(${((1 - titleIn) * 6 + titleOut * 6).toFixed(2)}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_CN,
            fontWeight: 900,
            fontSize: TYPE.preludeTitle * u,
            letterSpacing: "0.24em",
            marginRight: "-0.24em",
            lineHeight: 1.2,
            backgroundImage: `linear-gradient(180deg, #FFF8E4 0%, ${GOLD} 48%, #9C7A35 78%, #F1DCA0 100%)`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: `drop-shadow(0 0 ${18 * u}px ${rgba(GOLD, 0.35)})`,
          }}
        >
          {OPENING.title}
        </div>
        <div style={{ height: 10 * u }} />
        <div style={{ fontFamily: FONT_EN }}>
          <EnglishLine text={OPENING.english} start={barFrame(b.title) + p(10)} dur={p(26)} u={u} align="center" />
        </div>
      </div>
    </div>
  );
};
