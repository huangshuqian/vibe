/** 02 相切双环与星尘桥：左环层层叠叠（麻烦），右环空空一圈（孤独），切点处一座流动的星尘桥。 */
import React from "react";
import { random } from "remotion";
import { circlePath, diamondStar } from "../../lib/geometry";
import { Halo, StarDust, Stroke, stagger, type EmblemProps } from "./common";

export const TangentRings: React.FC<EmblemProps> = ({ cx, cy, r, color, draw, lit, bloom, frame, u }) => {
  const rr = 0.44 * r;
  const L = { x: cx - rr, y: cy };
  const R = { x: cx + rr, y: cy };
  const n = 6;
  const glow = 0.55 + 0.45 * lit;

  return (
    <g>
      <StarDust cx={cx} cy={cy} R={r * 0.95} color={color} lit={lit} frame={frame} u={u} seed="tangent" n={90} />
      {/* 水平轴 */}
      <Stroke d={`M ${cx - r * 0.98} ${cy} L ${cx + r * 0.98} ${cy}`} p={stagger(draw, 0, n)} color={color} w={0.8 * u} o={0.45} />
      {/* 左：层层叠叠 */}
      {[1, 0.76, 0.52, 0.28].map((k, i) => (
        <Stroke key={i} d={circlePath(L.x, L.y, rr * k)} p={stagger(draw, 1 + i * 0.3, n)} color={color} w={(i ? 1 : 1.8) * u} o={i ? 0.5 * glow : glow} />
      ))}
      <g opacity={stagger(draw, 2, n)}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6 + frame * 0.004;
          return (
            <line
              key={i}
              x1={L.x + rr * 0.3 * Math.cos(a)}
              y1={L.y + rr * 0.3 * Math.sin(a)}
              x2={L.x + rr * 0.5 * Math.cos(a)}
              y2={L.y + rr * 0.5 * Math.sin(a)}
              stroke={color}
              strokeWidth={0.8 * u}
              strokeOpacity={0.55}
            />
          );
        })}
      </g>
      {/* 右：空空一圈 + 一个点 */}
      <Stroke d={circlePath(R.x, R.y, rr)} p={stagger(draw, 3, n)} color={color} w={1.8 * u} o={glow} />
      <circle
        cx={R.x}
        cy={R.y}
        r={rr * 0.7}
        fill="none"
        stroke={color}
        strokeWidth={0.8 * u}
        strokeDasharray={`${2 * u} ${9 * u}`}
        opacity={stagger(draw, 4, n) * 0.6}
      />
      <circle cx={R.x} cy={R.y} r={3.4 * u} fill={color} opacity={stagger(draw, 4, n)} />
      {/* 星尘桥：上下两道弧，点沿桥从左向右流动 */}
      <g opacity={stagger(draw, 5, n)}>
        {Array.from({ length: 56 }, (_, k) => {
          const side = k % 2 ? 1 : -1;
          const s = (random(`bridge-${k}`) + frame * 0.0035) % 1;
          const x = L.x + (R.x - L.x) * s;
          const bulge = Math.sin(Math.PI * s) * rr * (0.55 + 0.25 * random(`bridge-h-${k}`));
          const y = cy + side * bulge;
          const o = Math.sin(Math.PI * s) * (0.35 + 0.65 * lit);
          return <circle key={k} cx={x} cy={y} r={(1 + random(`bridge-r-${k}`) * 1.3) * u} fill={k % 9 === 0 ? "#FFF4D6" : color} opacity={o} />;
        })}
      </g>
      {/* 切点 */}
      <Halo cx={cx} cy={cy} r={(18 + 40 * bloom + 10 * lit) * u} color={color} o={0.35 + 0.65 * lit} id="tan-h" />
      <path d={diamondStar(cx, cy, (10 + 16 * lit) * u, (3 + 3 * lit) * u)} fill="#FFF6E0" opacity={0.4 + 0.6 * lit} />
    </g>
  );
};
