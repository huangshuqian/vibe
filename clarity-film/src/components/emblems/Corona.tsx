/** 08 宏大天体星盘与日冕脉冲：中心太阳 + 随低频伸缩的日冕射线 + 每个强拍向外推出的脉冲环 + 三条行星轨道。 */
import React from "react";
import { circlePath, polar } from "../../lib/geometry";
import { Halo, StarDust, Stroke, stagger, type EmblemProps } from "./common";

const ORBITS = [
  { k: 0.56, speed: 0.62, size: 4.2, phase: 40 },
  { k: 0.74, speed: 0.36, size: 5.2, phase: 190 },
  { k: 0.92, speed: 0.21, size: 3.6, phase: 300 },
];

export const Corona: React.FC<EmblemProps> = ({ cx, cy, r, color, draw, lit, bloom, frame, bass, barPhase, u }) => {
  const n = 7;
  const rays = 72;
  const sun = r * 0.19;
  const pulse = barPhase;

  return (
    <g>
      <StarDust cx={cx} cy={cy} R={r * 0.98} color={color} lit={lit} frame={frame} u={u} seed="corona" n={110} />
      {/* 行星轨道 + 黄道 */}
      {ORBITS.map((o, i) => (
        <Stroke key={i} d={circlePath(cx, cy, r * o.k)} p={stagger(draw, i * 0.5, n)} color={color} w={(i === 1 ? 1.3 : 0.8) * u} o={0.55} />
      ))}
      <ellipse
        cx={cx}
        cy={cy}
        rx={r * 0.95}
        ry={r * 0.3}
        transform={`rotate(-20 ${cx} ${cy})`}
        fill="none"
        stroke={color}
        strokeWidth={0.8 * u}
        strokeDasharray={`${3 * u} ${6 * u}`}
        opacity={stagger(draw, 1.5, n) * 0.5}
      />
      {/* 强拍脉冲环 */}
      <circle
        cx={cx}
        cy={cy}
        r={sun * 1.3 + pulse * r * 0.72}
        fill="none"
        stroke={color}
        strokeWidth={(1 + 1.5 * (1 - pulse)) * u}
        opacity={(1 - pulse) ** 2 * (0.25 + 0.55 * lit) * stagger(draw, 3, n)}
      />
      {/* 日冕射线 */}
      <g opacity={stagger(draw, 3, n)}>
        {Array.from({ length: rays }, (_, k) => {
          const a = (k * 360) / rays + frame * 0.08;
          const wave = 0.5 + 0.5 * Math.sin(k * 2.3 + frame * 0.09) * Math.cos(k * 0.7 - frame * 0.05);
          const len = r * (0.05 + 0.14 * wave) * (0.75 + 0.6 * bass + 0.5 * lit);
          const p0 = polar(cx, cy, sun * 1.35, a);
          const p1 = polar(cx, cy, sun * 1.35 + len, a);
          return <line key={k} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={color} strokeWidth={(k % 6 === 0 ? 1.6 : 0.9) * u} strokeOpacity={0.45 + 0.4 * wave} strokeLinecap="round" />;
        })}
      </g>
      {/* 行星 */}
      <g opacity={stagger(draw, 4, n)}>
        {ORBITS.map((o, i) => {
          const p = polar(cx, cy, r * o.k, o.phase + frame * o.speed);
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={o.size * u * 2.2} fill="none" stroke={color} strokeWidth={0.8 * u} strokeOpacity={0.6} />
              <circle cx={p.x} cy={p.y} r={o.size * u} fill={i === 1 ? "#FFF3D8" : color} />
            </g>
          );
        })}
      </g>
      {/* 太阳 */}
      <Halo cx={cx} cy={cy} r={sun * (2.2 + 1.4 * lit) + 50 * bloom * u} color={color} o={(0.45 + 0.55 * lit) * stagger(draw, 5, n)} id="corona-h" />
      <Stroke d={circlePath(cx, cy, sun)} p={stagger(draw, 5, n)} color={color} w={1.8 * u} />
      <Stroke d={circlePath(cx, cy, sun * 0.62)} p={stagger(draw, 6, n)} color={color} w={1 * u} o={0.8} />
      <circle cx={cx} cy={cy} r={sun * 0.3} fill="#FFF4DA" opacity={stagger(draw, 6, n) * (0.6 + 0.4 * lit)} />
    </g>
  );
};
