/**
 * 互动留白屏：星盘收起，深邃星空中央浮现提问，下方 9 枚情绪色迷你圆点依次点亮。
 * 完整版 bar 56–60，圆点从 bar 57 起每拍一枚；快剪版只有 bar 30 一小节，圆点按十六分音符点亮。
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { INTERACTION, QUOTES, indexLabel } from "../config/content";
import { TYPE, useStage } from "../config/format";
import { GOLD, INK, MOOD } from "../config/palette";
import { useTimeline } from "../config/timeline";
import { EASE_IN_OUT, ramp, rgba, springAt } from "../lib/anim";
import { FONT_CN, FONT_EN } from "../lib/fonts";
import { CharReveal, fitSize } from "../components/text/CharReveal";

export const Interaction: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame(); // 本地帧
  const { fps } = useVideoConfig();
  const { W, H, u, portrait } = useStage();
  const { cut, beatFrame, p } = useTimeline();
  const D = to - from;
  const exit = ramp(frame, D - p(12), p(12), EASE_IN_OUT);
  const size = fitSize(INTERACTION.question, W * 0.84, TYPE.question * u, 0.12);
  const rowW = portrait ? W * 0.84 : W * 0.5;
  const step = rowW / (QUOTES.length - 1);
  const rowY = H * (portrait ? 0.56 : 0.6);
  const litAt = (i: number) => beatFrame(cut.interaction.dots, i * cut.interaction.dotStepBeats) - from;
  const lastLit = litAt(QUOTES.length - 1);
  const progress = ramp(frame, litAt(0), lastLit - litAt(0), (t) => t);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - exit, filter: exit > 0 ? `blur(${(exit * 3).toFixed(2)}px)` : undefined }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * (portrait ? 0.4 : 0.36), display: "flex", justifyContent: "center" }}>
        <CharReveal
          text={INTERACTION.question}
          start={p(8)}
          stagger={p(2.6)}
          dur={p(20)}
          blur={4}
          fontSize={size}
          fontFamily={FONT_CN}
          fontWeight={400}
          letterSpacing="0.12em"
          color={rgba(INK, 0.95)}
          align="center"
        />
      </div>
      {/* 连接线：随点亮进度生长 */}
      <div
        style={{
          position: "absolute",
          left: (W - rowW) / 2,
          top: rowY,
          width: rowW * progress,
          height: 1,
          background: `linear-gradient(90deg, ${QUOTES.map((q, i) => `${rgba(MOOD[q.mood], 0.55)} ${(i / (QUOTES.length - 1)) * 100}%`).join(", ")})`,
        }}
      />
      {QUOTES.map((q, i) => {
        const c = MOOD[q.mood];
        const s = springAt(frame, litAt(i), fps, 10, 0.7, 160);
        const flash = frame >= litAt(i) ? Math.exp(-(frame - litAt(i)) / 8) : 0;
        const appear = ramp(frame, p(20 + i * 2), p(16));
        const x = (W - rowW) / 2 + i * step;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: rowY, opacity: appear }}>
            <div
              style={{
                position: "absolute",
                left: -9 * u,
                top: -9 * u,
                width: 18 * u,
                height: 18 * u,
                borderRadius: "50%",
                border: `1px solid ${rgba(c, 0.35 + 0.4 * s)}`,
                transform: `scale(${1 + 1.6 * flash})`,
                opacity: 1 - 0.5 * flash,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: -5 * u,
                top: -5 * u,
                width: 10 * u,
                height: 10 * u,
                borderRadius: "50%",
                background: `radial-gradient(circle, #FFFFFF 0%, ${c} 55%)`,
                transform: `scale(${Math.max(0, s)})`,
                boxShadow: `0 0 ${(14 + 20 * flash) * u}px ${rgba(c, 0.85)}, 0 0 ${40 * u}px ${rgba(c, 0.35)}`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: -40 * u,
                width: 80 * u,
                top: 22 * u,
                textAlign: "center",
                fontFamily: FONT_EN,
                fontSize: 17 * u,
                letterSpacing: "0.2em",
                color: s > 0.5 ? rgba(c, 0.95) : rgba(GOLD, 0.4),
              }}
            >
              {indexLabel(i)}
            </div>
          </div>
        );
      })}
    </div>
  );
};
