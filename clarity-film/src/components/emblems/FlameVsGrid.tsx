/** 07 烈焰星芒与冷峻方阵对峙：左边一团跳动的火焰星芒，右边纹丝不动的 4×4 方阵，中间一道分界。 */
import React from "react";
import { COLD } from "../../config/palette";
import { circlePath, f2, polar } from "../../lib/geometry";
import { dim, Halo, StarDust, Stroke, stagger, type EmblemProps } from "./common";

export const FlameVsGrid: React.FC<EmblemProps> = ({ cx, cy, r, color, draw, lit, bloom, frame, bass, u }) => {
  const n = 7;
  const F = { x: cx - r * 0.44, y: cy };
  const G = { x: cx + r * 0.44, y: cy };
  const spikes = 14;
  const cell = r * 0.1;
  const pitch = r * 0.13;

  return (
    <g>
      <Stroke d={circlePath(cx, cy, r * 0.96)} p={stagger(draw, 0, n)} color={color} w={0.8 * u} o={0.3} />
      {/* 分界线 */}
      <Stroke d={`M ${cx} ${cy - r * 0.82} L ${cx} ${cy + r * 0.82}`} p={stagger(draw, 0.5, n)} color="#FFFFFF" w={(0.9 + 1.2 * lit) * u} o={0.45 + 0.4 * lit} />
      <g opacity={stagger(draw, 1, n)}>
        {Array.from({ length: 17 }, (_, i) => {
          const y = cy - r * 0.8 + (i * r * 1.6) / 16;
          const w = (i % 4 === 0 ? 10 : 5) * u;
          return <line key={i} x1={cx - w} y1={y} x2={cx + w} y2={y} stroke="#FFFFFF" strokeWidth={0.8 * u} strokeOpacity={0.4} />;
        })}
      </g>
      <StarDust cx={F.x} cy={F.y} R={r * 0.36} color={color} lit={lit} frame={frame} u={u} seed="flame" n={40} />
      {/* 烈焰星芒：弯曲的火舌，长度随时间与低频跳动 */}
      <g>
        {Array.from({ length: spikes }, (_, k) => {
          const a = (k * 360) / spikes + frame * 0.35;
          const flick = 0.5 + 0.5 * Math.sin(frame * 0.23 + k * 1.7) * Math.sin(frame * 0.071 + k * 0.6);
          const len = r * (0.2 + 0.12 * flick + 0.06 * bass + 0.1 * lit);
          const b0 = polar(F.x, F.y, r * 0.06, a - 10);
          const b1 = polar(F.x, F.y, r * 0.06, a + 10);
          const tip = polar(F.x, F.y, r * 0.06 + len, a + 8 * Math.sin(frame * 0.1 + k));
          const c0 = polar(F.x, F.y, r * 0.06 + len * 0.55, a - 14);
          const c1 = polar(F.x, F.y, r * 0.06 + len * 0.55, a + 2);
          const d = `M ${f2(b0.x)} ${f2(b0.y)} Q ${f2(c0.x)} ${f2(c0.y)} ${f2(tip.x)} ${f2(tip.y)} Q ${f2(c1.x)} ${f2(c1.y)} ${f2(b1.x)} ${f2(b1.y)}`;
          return <Stroke key={k} d={d} p={stagger(draw, 2 + (k / spikes) * 2, n)} color={color} w={1.3 * u} fill={dim(color, 0.12 + 0.22 * lit)} />;
        })}
        <Halo cx={F.x} cy={F.y} r={r * (0.16 + 0.12 * lit) + 26 * bloom * u} color={color} o={0.45 + 0.55 * lit} id="flame-h" />
        <circle cx={F.x} cy={F.y} r={4 * u} fill="#FFF1E6" opacity={stagger(draw, 3, n)} />
      </g>
      {/* 冷峻方阵 */}
      <g>
        <Stroke
          d={`M ${G.x - pitch * 2.3} ${G.y - pitch * 2.3} H ${G.x + pitch * 2.3} V ${G.y + pitch * 2.3} H ${G.x - pitch * 2.3} Z`}
          p={stagger(draw, 3, n)}
          color={COLD}
          w={1 * u}
          o={0.6}
          linecap="butt"
        />
        {Array.from({ length: 16 }, (_, k) => {
          const i = k % 4;
          const j = Math.floor(k / 4);
          const x = G.x + (i - 1.5) * pitch - cell / 2;
          const y = G.y + (j - 1.5) * pitch - cell / 2;
          const filled = (i + j) % 2 === 0;
          return (
            <Stroke
              key={k}
              d={`M ${f2(x)} ${f2(y)} H ${f2(x + cell)} V ${f2(y + cell)} H ${f2(x)} Z`}
              p={stagger(draw, 4 + (k / 16) * 2, n)}
              color={COLD}
              w={1.1 * u}
              o={0.9}
              fill={filled ? dim(COLD, 0.08 + 0.3 * lit) : "none"}
              linecap="butt"
            />
          );
        })}
      </g>
    </g>
  );
};
