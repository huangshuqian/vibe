/** 进度序号、细字眉题、方框属性标签、宽字距英文副标。 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Tag } from "../../config/content";
import { TYPE } from "../../config/format";
import { GOLD, INK } from "../../config/palette";
import { ramp, rgba, springAt } from "../../lib/anim";
import { FONT_CN, FONT_EN } from "../../lib/fonts";

export const IndexMark: React.FC<{ index: string; total: string; start: number; u: number; align?: "left" | "center" }> = ({
  index,
  total,
  start,
  u,
  align = "left",
}) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, start, 16);
  const line = ramp(frame, start + 4, 22);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: align === "center" ? "center" : "flex-start",
        gap: 14 * u,
        opacity: p,
        transform: `translateY(${(1 - p) * 10 * u}px)`,
      }}
    >
      <span style={{ fontFamily: FONT_EN, fontSize: TYPE.index * u, color: GOLD, fontWeight: 500, letterSpacing: "0.06em" }}>{index}</span>
      <span style={{ fontFamily: FONT_EN, fontSize: 17 * u, color: rgba(GOLD, 0.6), letterSpacing: "0.2em" }}>/ {total}</span>
      <span style={{ width: 72 * u * line, height: 1, background: `linear-gradient(90deg, ${rgba(GOLD, 0.8)}, ${rgba(GOLD, 0)})` }} />
    </div>
  );
};

export const Eyebrow: React.FC<{ text: string; start: number; u: number; align?: "left" | "center" }> = ({ text, start, u, align = "left" }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, start, 18);
  return (
    <div
      style={{
        fontFamily: FONT_CN,
        fontWeight: 300,
        fontSize: TYPE.eyebrow * u,
        letterSpacing: "0.42em",
        color: rgba(INK, 0.58),
        textAlign: align,
        opacity: p,
        filter: `blur(${(1 - p) * 2}px)`,
      }}
    >
      {text}
    </div>
  );
};

export const TagLabel: React.FC<{ tag: Tag; start: number; mood: string; u: number }> = ({ tag, start, mood, u }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = springAt(frame, start, fps, 13, 0.7, 150);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10 * u,
        opacity: Math.min(1, s),
        transform: `translateY(${(1 - s) * 12 * u}px) scale(${0.9 + 0.1 * s})`,
        transformOrigin: "left center",
      }}
    >
      <span
        style={{
          border: `1px solid ${rgba(mood, 0.75)}`,
          padding: `${2 * u}px ${8 * u}px ${3 * u}px`,
          fontFamily: FONT_CN,
          fontSize: TYPE.tag * 0.82 * u,
          letterSpacing: "0.2em",
          color: mood,
          lineHeight: 1.4,
          boxShadow: `0 0 ${10 * u}px ${rgba(mood, 0.18)}`,
        }}
      >
        {tag.k}
      </span>
      <span style={{ fontFamily: FONT_CN, fontSize: TYPE.tag * u, color: rgba(INK, 0.86), letterSpacing: "0.14em", fontWeight: 400 }}>{tag.v}</span>
    </div>
  );
};

export const EnglishLine: React.FC<{ text: string; start: number; u: number; color?: string; size?: number; align?: "left" | "center" }> = ({
  text,
  start,
  u,
  color = GOLD,
  size = TYPE.english,
  align = "left",
}) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, start, 26);
  // 字距从 0.6em 收拢到 0.35em
  const tracking = 0.35 + 0.25 * (1 - p);
  return (
    <div
      style={{
        fontFamily: FONT_EN,
        fontSize: size * u,
        fontWeight: 500,
        letterSpacing: `${tracking.toFixed(3)}em`,
        color,
        opacity: 0.88 * p,
        textAlign: align,
        whiteSpace: "nowrap",
        // 字距会在最后一个字母后面多出一截，居中时补回来
        marginRight: align === "center" ? `-${tracking.toFixed(3)}em` : undefined,
      }}
    >
      {text}
    </div>
  );
};
