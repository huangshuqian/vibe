/**
 * 全片唯一的一枚星盘（一镜到底）：
 * - 暖金双环刻度（持续顺时针旋转）+ 反向旋转的内刻度环
 * - 沿弧排列的英文 <textPath> 环绕小字
 * - 四角菱形星芒
 * - 9 枚情绪色节点与几何星网（序幕、终幕）
 * - 当前语录的专属内环图腾（components/emblems）
 * 位置 / 大小由 lib/rig.ts 在段落之间插值。
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { QUOTES, RING_MOTTO, indexLabel, totalLabel } from "../../config/content";
import { useStage } from "../../config/format";
import { GOLD, MOOD } from "../../config/palette";
import { useTimeline, type Segment } from "../../config/timeline";
import { clamp01, EASE_IN_OUT, ramp, rgba, springAt } from "../../lib/anim";
import { useEnergy } from "../../lib/audio";
import { FONT_EN } from "../../lib/fonts";
import { circlePath, diamondStar, polar } from "../../lib/geometry";
import { blendBySegment, rigStateAt } from "../../lib/rig";
import { EMBLEMS } from "../emblems";
import { Stroke } from "../emblems/common";

const NODE_COLORS = QUOTES.map((q) => MOOD[q.mood]);
const NET_CHORDS = [
  ...NODE_COLORS.map((_, i) => [i, (i + 4) % 9] as const),
  ...NODE_COLORS.map((_, i) => [i, (i + 2) % 9] as const),
];

const ringText = (seg: Segment) => {
  const body =
    seg.kind === "quote"
      ? `${RING_MOTTO} · ${indexLabel(seg.index)} / ${totalLabel()} · ${seg.quote.english.replace(/\s*·\s*/g, " ")} · `
      : `${RING_MOTTO} · NOVEM SENTENTIAE · NOCTE ILLUMINATA · `;
  return body.repeat(2);
};

export const Rig: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tl = useTimeline();
  const stage = useStage();
  const { u } = stage;
  const { bass } = useEnergy();
  const { cut, barFrame, beatFrame, barFrames, beatFrames, p } = tl;

  const st = rigStateAt(tl, frame, stage);
  const segIdx = tl.segmentIndexAt(frame);
  const seg = tl.segments[segIdx];
  const finaleFrom = barFrame(cut.finale.start);

  // 描边生长：序幕在 orbit 小节开始画；终幕重新展开
  const draw =
    frame < finaleFrom
      ? ramp(frame, barFrame(cut.opening.orbit), p(barFrames * 1.25), EASE_IN_OUT)
      : ramp(frame, finaleFrom, p(barFrames * 1.4), EASE_IN_OUT);
  if (st.opacity <= 0.001 || draw <= 0) return null;

  // 金句点亮（punch）/ 高光脉冲（accent）
  let lit = 0;
  let bloom = 0;
  if (seg.kind === "quote") {
    const d = frame - seg.accent;
    lit = ramp(frame, seg.punch, 12);
    bloom = d >= 0 ? clamp01((1 - Math.exp(-d / 2.5)) * Math.exp(-d / 16) * 1.5) : 0;
  }
  const scale = 1 + 0.012 * bass + 0.035 * bloom;

  const R = st.r;
  const rot = frame * 0.05;
  const gold = GOLD;
  const ringO = 0.75 + 0.25 * lit;

  // 环绕小字：段落切换前后淡出淡入
  const T = seg.from;
  const nextT = tl.segments[segIdx + 1]?.from ?? Infinity;
  const textO = clamp01(Math.min(frame - T, nextT - frame) / p(8)) * clamp01((draw - 0.75) / 0.25);
  const textR = R * 0.885;

  // 节点与星网
  const openingNodeAt = (i: number) => beatFrame(cut.opening.nodes, i * cut.opening.nodeStepBeats);
  const finaleNodeAt = (i: number) => finaleFrom + p(16 + i * 3);
  const nodeAlpha = (i: number) =>
    blendBySegment(tl, frame, (s) => {
      if (s.kind === "prelude") return springAt(frame, openingNodeAt(i), fps, 12);
      if (s.kind === "quote") return i === s.index ? 1 : i < s.index ? 0.5 : 0.25;
      if (s.kind === "finale") return springAt(frame, finaleNodeAt(i), fps, 12);
      return 0;
    });
  const nodeSize = (i: number) =>
    blendBySegment(tl, frame, (s) => (s.kind === "quote" ? (i === s.index ? 5.2 + 2 * bass : 2.6) : 4.2));
  /** 节点被点亮那一拍的闪光 */
  const nodeFlash = (i: number) =>
    blendBySegment(tl, frame, (s) => {
      const at = s.kind === "prelude" ? openingNodeAt(i) : s.kind === "finale" ? finaleNodeAt(i) : null;
      return at !== null && frame >= at ? Math.exp(-(frame - at) / 7) : 0;
    });
  const netP = blendBySegment(tl, frame, (s) => {
    if (s.kind === "prelude") return ramp(frame, barFrame(cut.opening.net), p(barFrames * 1.2), EASE_IN_OUT);
    if (s.kind === "finale") return ramp(frame, finaleFrom + p(beatFrames * 2), p(barFrames * 1.6), EASE_IN_OUT);
    return 0;
  });
  const netO = blendBySegment(tl, frame, (s) => (s.kind === "prelude" ? 0.38 : s.kind === "finale" ? 0.62 : 0));
  const nodePos = (i: number) => polar(0, 0, R, i * 40);

  const emblemSeg = seg.kind === "quote" ? seg : null;
  const Emblem = emblemSeg ? EMBLEMS[emblemSeg.quote.emblem] : null;
  const emblemDraw = emblemSeg ? ramp(frame, emblemSeg.from + p(3), p(44), EASE_IN_OUT) : 0;
  const emblemO = emblemSeg ? 1 - ramp(frame, emblemSeg.to - p(12), p(12), EASE_IN_OUT) : 0;

  return (
    <svg
      width={stage.W}
      height={stage.H}
      style={{ position: "absolute", inset: 0, overflow: "visible", opacity: st.opacity }}
    >
      <defs>
        <filter id="rig-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={3.2 * u} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="rig-glow-strong" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={7 * u} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="rig-halo">
          <stop offset="0%" stopColor={gold} stopOpacity={0.16} />
          <stop offset="45%" stopColor={st.mood} stopOpacity={0.12} />
          <stop offset="72%" stopColor={st.mood} stopOpacity={0.05} />
          <stop offset="100%" stopColor={st.mood} stopOpacity={0} />
        </radialGradient>
        <path id="rig-text-path" d={circlePath(0, 0, textR)} />
        {NET_CHORDS.map(([a, b], k) => {
          const p = nodePos(a);
          const q = nodePos(b);
          return (
            <linearGradient key={k} id={`net-${k}`} gradientUnits="userSpaceOnUse" x1={p.x} y1={p.y} x2={q.x} y2={q.y}>
              <stop offset="0%" stopColor={NODE_COLORS[a]} />
              <stop offset="50%" stopColor={gold} stopOpacity={0.6} />
              <stop offset="100%" stopColor={NODE_COLORS[b]} />
            </linearGradient>
          );
        })}
      </defs>

      <g transform={`translate(${st.cx} ${st.cy}) scale(${scale})`}>
        {/* 外环光晕：随低频呼吸，金句时绽放 */}
        <circle r={R * 1.4} fill="url(#rig-halo)" opacity={(0.6 + 0.5 * bass + 1.2 * bloom) * draw} />

        {/* 外环：暖金双环 + 刻度 + 环绕小字（顺时针） */}
        <g transform={`rotate(${rot})`} filter="url(#rig-glow)">
          <Stroke d={circlePath(0, 0, R)} p={draw} color={gold} w={1.7 * u} o={ringO} />
          <Stroke d={circlePath(0, 0, R * 0.955)} p={draw} color={gold} w={0.9 * u} o={ringO * 0.8} />
          {Array.from({ length: 120 }, (_, i) => {
            const o = clamp01(draw * 120 - i) * (i % 5 === 0 ? 0.95 : 0.55);
            if (o <= 0) return null;
            const major = i % 10 === 0;
            const a = polar(0, 0, R * 0.955, i * 3);
            const b = polar(0, 0, R * (major ? 0.995 : i % 5 === 0 ? 0.985 : 0.972), i * 3);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={gold} strokeWidth={(major ? 1.4 : 0.8) * u} strokeOpacity={o} />;
          })}
          {[0, 90, 180, 270].map((a) => {
            const p = polar(0, 0, R * 1.03, a);
            const l = polar(0, 0, R * 1.0, a - 1.6);
            const rr = polar(0, 0, R * 1.0, a + 1.6);
            return <path key={a} d={`M ${p.x} ${p.y} L ${l.x} ${l.y} L ${rr.x} ${rr.y} Z`} fill={gold} opacity={clamp01(draw * 4 - 3)} />;
          })}
          <text
            fill={gold}
            fillOpacity={0.62 * textO}
            fontFamily={FONT_EN}
            fontSize={Math.max(10, R * 0.036)}
            fontWeight={500}
            dominantBaseline="middle"
          >
            <textPath href="#rig-text-path" textLength={2 * Math.PI * textR * 0.995} lengthAdjust="spacing">
              {ringText(seg)}
            </textPath>
          </text>
        </g>

        {/* 内刻度环（逆时针） */}
        <g transform={`rotate(${-rot * 0.7})`}>
          <Stroke d={circlePath(0, 0, R * 0.8)} p={draw} color={gold} w={0.8 * u} o={0.55} />
          {Array.from({ length: 72 }, (_, i) => {
            const o = clamp01(draw * 72 - i) * (i % 6 === 0 ? 0.8 : 0.35);
            if (o <= 0) return null;
            const a = polar(0, 0, R * 0.8, i * 5);
            const b = polar(0, 0, R * (i % 6 === 0 ? 0.765 : 0.785), i * 5);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={gold} strokeWidth={0.8 * u} strokeOpacity={o} />;
          })}
        </g>

        {/* 四角菱形星芒（不随环转，只闪烁） */}
        {[45, 135, 225, 315].map((a, i) => {
          const p = polar(0, 0, R * 1.1, a);
          const tw = 0.65 + 0.35 * Math.sin(frame * 0.07 + i * 1.9);
          const s = (1 + 0.25 * bass + 0.5 * bloom) * R * 0.05;
          return (
            <path
              key={a}
              d={diamondStar(p.x, p.y, s, s * 0.32)}
              fill={gold}
              opacity={clamp01(draw * 6 - 5) * tw}
              filter="url(#rig-glow)"
            />
          );
        })}

        {/* 专属内环图腾 */}
        {Emblem && emblemSeg && emblemO > 0 && (
          <g opacity={emblemO} filter="url(#rig-glow)">
            <Emblem
              cx={0}
              cy={0}
              r={R * 0.72}
              color={MOOD[emblemSeg.quote.mood]}
              draw={emblemDraw}
              lit={lit}
              bloom={bloom}
              sincePunch={frame - emblemSeg.accent}
              frame={frame}
              bass={bass}
              barPhase={tl.barPhase(frame)}
              u={u}
            />
          </g>
        )}

        {/* 几何星网 + 9 枚情绪色节点（随外环旋转） */}
        <g transform={`rotate(${rot})`}>
          {netO > 0 &&
            NET_CHORDS.map(([a, b], k) => {
              const p = nodePos(a);
              const q = nodePos(b);
              return (
                <Stroke
                  key={k}
                  d={`M ${p.x} ${p.y} L ${q.x} ${q.y}`}
                  p={netP}
                  color={`url(#net-${k})`}
                  w={(k < 9 ? 1.1 : 0.7) * u}
                  o={netO * (k < 9 ? 1 : 0.6)}
                />
              );
            })}
          {NODE_COLORS.map((c, i) => {
            const a = nodeAlpha(i);
            if (a <= 0.01) return null;
            const p = nodePos(i);
            const size = nodeSize(i) * u;
            const flash = nodeFlash(i);
            return (
              <g key={i} opacity={clamp01(a)}>
                {flash > 0.02 && (
                  <circle cx={p.x} cy={p.y} r={size * (3 + 9 * (1 - flash))} fill="none" stroke={c} strokeWidth={1.4 * u} strokeOpacity={flash} />
                )}
                <circle cx={p.x} cy={p.y} r={size * (4 + 3 * flash)} fill={rgba(c, 0.16 + 0.3 * flash)} />
                <circle cx={p.x} cy={p.y} r={size * 1.9} fill="none" stroke={c} strokeWidth={0.9 * u} strokeOpacity={0.7} />
                <circle cx={p.x} cy={p.y} r={size} fill={c} filter="url(#rig-glow-strong)" />
                <circle cx={p.x} cy={p.y} r={size * 0.45} fill="#FFFFFF" />
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
};
