/** 01 错位双轨道：两条错开的椭圆轨道，两颗行星永远不同步，虚线是够不着的沟通。 */
import React from "react";
import { f2, rotatePt, type Pt } from "../../lib/geometry";
import { dim, Halo, StarDust, Stroke, stagger, type EmblemProps } from "./common";

type Ellipse = { x: number; y: number; rx: number; ry: number; rot: number };

const onEllipse = (e: Ellipse, deg: number, scale = 1): Pt => {
  const t = (deg * Math.PI) / 180;
  return rotatePt({ x: e.x + e.rx * scale * Math.cos(t), y: e.y + e.ry * scale * Math.sin(t) }, e.x, e.y, e.rot);
};

const ellipsePath = (e: Ellipse, scale = 1, from = 0, to = 360, steps = 96) =>
  Array.from({ length: steps + 1 }, (_, i) => onEllipse(e, from + ((to - from) * i) / steps, scale))
    .map((p, i) => `${i ? "L" : "M"} ${f2(p.x)} ${f2(p.y)}`)
    .join(" ");

export const OffsetOrbits: React.FC<EmblemProps> = ({ cx, cy, r, color, draw, lit, bloom, frame, u }) => {
  const A: Ellipse = { x: cx - 0.13 * r, y: cy - 0.03 * r, rx: 0.8 * r, ry: 0.35 * r, rot: -18 };
  const B: Ellipse = { x: cx + 0.13 * r, y: cy + 0.05 * r, rx: 0.72 * r, ry: 0.43 * r, rot: 28 };
  const aDeg = frame * 1.15 + 30;
  const bDeg = -frame * 0.63 + 210;
  const pa = onEllipse(A, aDeg);
  const pb = onEllipse(B, bDeg);
  const n = 6;
  const glow = 0.55 + 0.45 * lit;

  return (
    <g>
      <StarDust cx={cx} cy={cy} R={r * 0.92} color={color} lit={lit} frame={frame} u={u} seed="orbits" />
      <Stroke d={ellipsePath(A)} p={stagger(draw, 0, n)} color={color} w={1.8 * u} o={glow} />
      <Stroke d={ellipsePath(B)} p={stagger(draw, 1, n)} color={color} w={1.8 * u} o={glow} />
      <Stroke d={ellipsePath(A, 0.62)} p={stagger(draw, 2, n)} color={color} w={0.9 * u} o={0.35 + 0.3 * lit} />
      <Stroke d={ellipsePath(B, 0.62)} p={stagger(draw, 2, n)} color={color} w={0.9 * u} o={0.35 + 0.3 * lit} />
      {/* 轨道刻度 */}
      <g opacity={stagger(draw, 3, n)}>
        {Array.from({ length: 36 }, (_, i) => {
          const p0 = onEllipse(A, i * 10, 1.02);
          const p1 = onEllipse(A, i * 10, i % 3 === 0 ? 1.1 : 1.06);
          return <line key={i} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={color} strokeWidth={0.9 * u} strokeOpacity={0.55} />;
        })}
        {Array.from({ length: 24 }, (_, i) => {
          const p0 = onEllipse(B, i * 15, 0.95);
          const p1 = onEllipse(B, i * 15, 0.9);
          return <line key={i} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={color} strokeWidth={0.9 * u} strokeOpacity={0.45} />;
        })}
      </g>
      {/* 两个错开的焦点 */}
      <g opacity={stagger(draw, 4, n)}>
        <circle cx={A.x} cy={A.y} r={3 * u} fill={color} />
        <circle cx={B.x} cy={B.y} r={3 * u} fill="none" stroke={color} strokeWidth={1.2 * u} />
        <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={color} strokeWidth={0.8 * u} strokeOpacity={0.6} />
      </g>
      {/* 行星、拖尾与够不着的虚线 */}
      <g opacity={stagger(draw, 5, n)}>
        <path d={ellipsePath(A, 1, aDeg - 55, aDeg, 24)} stroke={color} strokeWidth={3 * u} strokeOpacity={0.5} fill="none" strokeLinecap="round" />
        <path d={ellipsePath(B, 1, bDeg + 40, bDeg, 24)} stroke={color} strokeWidth={3 * u} strokeOpacity={0.5} fill="none" strokeLinecap="round" />
        <line
          x1={pa.x}
          y1={pa.y}
          x2={pb.x}
          y2={pb.y}
          stroke={color}
          strokeWidth={1 * u}
          strokeDasharray={`${4 * u} ${7 * u}`}
          strokeOpacity={0.3 + 0.5 * lit}
        />
        <Halo cx={pa.x} cy={pa.y} r={(16 + 18 * bloom) * u} color={color} o={0.5 + 0.5 * lit} id="orb-ha" />
        <Halo cx={pb.x} cy={pb.y} r={(14 + 18 * bloom) * u} color={color} o={0.5 + 0.5 * lit} id="orb-hb" />
        <circle cx={pa.x} cy={pa.y} r={5 * u} fill="#FFF6E0" />
        <circle cx={pb.x} cy={pb.y} r={4.2 * u} fill={dim(color, 1)} />
      </g>
    </g>
  );
};
