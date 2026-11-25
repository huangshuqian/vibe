/** 03 三层渐进同心弧：上山 → 砍柴 → 做饭，一环套一环越走越长；金句时中心的「当下」亮起。 */
import React from "react";
import { FONT_CN } from "../../lib/fonts";
import { arcPath, circlePath, polar } from "../../lib/geometry";
import { Halo, StarDust, Stroke, stagger, type EmblemProps } from "./common";

const LAYERS = [
  { k: 0.36, sweep: 110, speed: 0.42, offset: -40, label: "上山" },
  { k: 0.6, sweep: 215, speed: -0.27, offset: 80, label: "砍柴" },
  { k: 0.84, sweep: 300, speed: 0.17, offset: 200, label: "做饭" },
];

export const ProgressiveArcs: React.FC<EmblemProps> = ({ cx, cy, r, color, draw, lit, bloom, frame, u }) => {
  const n = 7;
  const ends = LAYERS.map((L) => {
    const a0 = L.offset + frame * L.speed;
    return { a0, a1: a0 + L.sweep, rad: r * L.k };
  });

  return (
    <g>
      <StarDust cx={cx} cy={cy} R={r * 0.3} color={color} lit={lit} frame={frame} u={u} seed="arcs" n={46} />
      {/* 轨道底线 */}
      {LAYERS.map((L, i) => (
        <Stroke key={`t${i}`} d={circlePath(cx, cy, r * L.k)} p={stagger(draw, i * 0.5, n)} color={color} w={0.7 * u} o={0.22} />
      ))}
      {/* 渐进弧 */}
      {ends.map((e, i) => (
        <Stroke
          key={`a${i}`}
          d={arcPath(cx, cy, e.rad, e.a0, e.a1)}
          p={stagger(draw, 2 + i, n)}
          color={color}
          w={(2.6 - i * 0.5) * u}
          o={0.9 - 0.35 * lit}
        />
      ))}
      {/* 弧端点、标签与串联虚线 */}
      {ends.map((e, i) => {
        const p = polar(cx, cy, e.rad, e.a1);
        const lp = polar(cx, cy, e.rad + 22 * u, e.a1);
        const o = stagger(draw, 3 + i, n);
        const next = ends[i + 1];
        const q = next ? polar(cx, cy, next.rad, next.a0) : null;
        return (
          <g key={`e${i}`} opacity={o}>
            <circle cx={p.x} cy={p.y} r={4.2 * u} fill={color} />
            <circle cx={p.x} cy={p.y} r={8 * u} fill="none" stroke={color} strokeWidth={0.8 * u} strokeOpacity={0.6} />
            <text
              x={lp.x}
              y={lp.y}
              fill={color}
              fillOpacity={0.75}
              fontFamily={FONT_CN}
              fontSize={13 * u}
              letterSpacing={2 * u}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {LAYERS[i].label}
            </text>
            {q && (
              <line
                x1={p.x}
                y1={p.y}
                x2={q.x}
                y2={q.y}
                stroke={color}
                strokeWidth={0.8 * u}
                strokeDasharray={`${3 * u} ${5 * u}`}
                strokeOpacity={0.5 * (1 - lit * 0.6)}
              />
            )}
          </g>
        );
      })}
      {/* 中心：当下 */}
      <Halo cx={cx} cy={cy} r={(r * 0.2) * (0.5 + 0.8 * lit) + 30 * bloom * u} color={color} o={0.3 + 0.7 * lit} id="arcs-h" />
      <circle cx={cx} cy={cy} r={(3.5 + 3 * lit) * u} fill="#F4FFF9" opacity={stagger(draw, 6, n)} />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.15 * lit}
        fill="none"
        stroke={color}
        strokeWidth={1.4 * u}
        opacity={lit}
      />
    </g>
  );
};
