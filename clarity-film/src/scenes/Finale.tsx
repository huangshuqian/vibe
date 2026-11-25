/**
 * 终幕定版（完整版 bar 60–65，快剪版 bar 31–33）：巨型金色刻度星盘 + 彩色星芒连线在 Rig 里展开，
 * 这里负责暖金星尘扩散、超大金属标题、英文副标与收尾短句。整体淡出在 Film 里统一处理。
 */
import React from "react";
import { random, useCurrentFrame } from "remotion";
import { FINALE, QUOTES } from "../config/content";
import { TYPE, useStage } from "../config/format";
import { GOLD, INK, MOOD } from "../config/palette";
import { useTimeline } from "../config/timeline";
import { EASE_OUT, ramp, rgba } from "../lib/anim";
import { useEnergy } from "../lib/audio";
import { FONT_CN } from "../lib/fonts";
import { CharReveal, fitSize } from "../components/text/CharReveal";
import { EnglishLine } from "../components/text/Marks";

const DUST = 170;

export const Finale: React.FC<{ from: number }> = ({ from }) => {
  const frame = useCurrentFrame(); // 本地帧
  const { W, H, u } = useStage();
  const { bass } = useEnergy();
  const { cut, barFrame, p } = useTimeline();
  const b = cut.finale;
  const at = (bar: number) => barFrame(bar) - from;
  const titleIn = ramp(frame, at(b.title), p(34));
  const titleSize = fitSize(FINALE.title, W * 0.8, TYPE.finaleTitle * u, 0.2);
  const maxR = Math.hypot(W, H) * 0.55;
  const sweep = ramp(frame, at(b.title) + p(10), p(40), (t) => t);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* 暖金星尘微粒：从中心缓慢扩散 */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: DUST }, (_, i) => {
          const birth = p(random(`dust-b-${i}`) * 150);
          const life = p(120 + random(`dust-l-${i}`) * 120);
          const t = (frame - birth) / life;
          if (t <= 0 || t >= 1) return null;
          const a = random(`dust-a-${i}`) * Math.PI * 2 + t * 0.6 * (random(`dust-s-${i}`) - 0.5);
          const rho = maxR * (0.04 + 0.9 * EASE_OUT(t) * (0.35 + 0.65 * random(`dust-v-${i}`)));
          const tint = i % 9 === 0 ? MOOD[QUOTES[i % QUOTES.length].mood] : GOLD;
          const o = Math.sin(Math.PI * t) * (0.45 + 0.55 * random(`dust-o-${i}`));
          return (
            <circle
              key={i}
              cx={W / 2 + rho * Math.cos(a)}
              cy={H / 2 + rho * Math.sin(a)}
              r={(0.8 + random(`dust-r-${i}`) * 1.8) * u}
              fill={tint}
              opacity={o}
            />
          );
        })}
      </svg>
      {/* 标题区暗底，保证可读 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 34% 30% at 50% 50%, rgba(3,4,9,${(0.72 * titleIn).toFixed(3)}) 0%, rgba(3,4,9,0) 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: H / 2,
          transform: `translateY(-56%) scale(${(1.06 - 0.06 * titleIn).toFixed(4)})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", opacity: titleIn, filter: `blur(${((1 - titleIn) * 8).toFixed(2)}px)` }}>
          <div
            style={{
              fontFamily: FONT_CN,
              fontWeight: 900,
              fontSize: titleSize,
              letterSpacing: "0.2em",
              marginRight: "-0.2em",
              lineHeight: 1.15,
              backgroundImage: `linear-gradient(180deg, #FFF9E8 0%, #F3E0A8 24%, ${GOLD} 46%, #9A7631 72%, #E9D08C 90%, #FFF2C8 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: `drop-shadow(0 0 ${(22 + 14 * bass) * u}px ${rgba(GOLD, 0.38)})`,
            }}
          >
            {FINALE.title}
          </div>
          {/* 扫光：同一行字再叠一层，只露出一条移动的亮带 */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              fontFamily: FONT_CN,
              fontWeight: 900,
              fontSize: titleSize,
              letterSpacing: "0.2em",
              marginRight: "-0.2em",
              lineHeight: 1.15,
              backgroundImage: `linear-gradient(100deg, rgba(255,255,255,0) ${(sweep * 140 - 30).toFixed(1)}%, rgba(255,250,235,0.95) ${(
                sweep * 140 - 20
              ).toFixed(1)}%, rgba(255,255,255,0) ${(sweep * 140 - 10).toFixed(1)}%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              opacity: sweep > 0 && sweep < 1 ? 0.9 : 0,
            }}
          >
            {FINALE.title}
          </div>
        </div>
        <div style={{ height: 18 * u }} />
        <EnglishLine text={FINALE.english} start={at(b.english)} dur={p(26)} u={u} size={TYPE.finaleEnglish} align="center" />
        <div style={{ height: 40 * u }} />
        <CharReveal
          text={FINALE.closing}
          start={at(b.closing)}
          stagger={p(2.4)}
          dur={p(18)}
          blur={3}
          fontSize={TYPE.finaleClosing * u}
          fontFamily={FONT_CN}
          fontWeight={300}
          letterSpacing="0.3em"
          color={rgba(INK, 0.9)}
          align="center"
        />
      </div>
    </div>
  );
};
