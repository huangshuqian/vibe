/** 04 锐利星芒盾与极坐标刻度：极坐标网格上的八角星盾，外围一圈断续的边界线。 */
import React from "react";
import { circlePath, ngonPts, polar, polyPath, starPts } from "../../lib/geometry";
import { dim, Halo, StarDust, Stroke, stagger, type EmblemProps } from "./common";

export const StarShield: React.FC<EmblemProps> = ({ cx, cy, r, color, draw, lit, bloom, frame, u }) => {
  const n = 7;
  const rot = frame * 0.05;
  return (
    <g>
      {/* 极坐标网格 */}
      {[0.3, 0.55, 0.8].map((k, i) => (
        <Stroke key={i} d={circlePath(cx, cy, r * k)} p={stagger(draw, i * 0.4, n)} color={color} w={0.7 * u} o={0.25} />
      ))}
      <g opacity={stagger(draw, 1, n) * 0.35}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = polar(cx, cy, r * 0.12, i * 30);
          const b = polar(cx, cy, r * 0.9, i * 30);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={0.7 * u} />;
        })}
      </g>
      {/* 极坐标刻度 */}
      <g opacity={stagger(draw, 2, n)}>
        {Array.from({ length: 72 }, (_, i) => {
          const long = i % 6 === 0;
          const a = polar(cx, cy, r * 0.92, i * 5 - rot);
          const b = polar(cx, cy, r * (long ? 1.0 : 0.96), i * 5 - rot);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={(long ? 1.4 : 0.8) * u} strokeOpacity={long ? 0.9 : 0.55} />;
        })}
      </g>
      {/* 断续的边界线 */}
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.66}
        fill="none"
        stroke={color}
        strokeWidth={(1.6 + 1.2 * lit) * u}
        strokeDasharray={`${14 * u} ${7 * u}`}
        strokeDashoffset={-frame * 0.4 * u}
        opacity={stagger(draw, 3, n) * (0.55 + 0.45 * lit)}
      />
      <StarDust cx={cx} cy={cy} R={r * 0.6} color={color} lit={lit} frame={frame} u={u} seed="shield" n={70} />
      {/* 八角星盾 */}
      <Stroke
        d={polyPath(starPts(cx, cy, 8, r * 0.8, r * 0.27, rot * 0.5))}
        p={stagger(draw, 4, n)}
        color={color}
        w={1.9 * u}
        o={0.9}
        fill={dim(color, 0.05 + 0.2 * lit)}
        linecap="butt"
      />
      <Stroke d={polyPath(starPts(cx, cy, 4, r * 0.46, r * 0.11, 45 - rot))} p={stagger(draw, 5, n)} color={color} w={1.3 * u} o={0.8} linecap="butt" />
      <Stroke d={polyPath(ngonPts(cx, cy, 8, r * 0.2, 22.5 + rot))} p={stagger(draw, 6, n)} color={color} w={1 * u} o={0.7} />
      <Halo cx={cx} cy={cy} r={(r * 0.22) * (0.6 + 0.6 * lit) + 30 * bloom * u} color={color} o={0.25 + 0.75 * lit} id="shield-h" />
      <circle cx={cx} cy={cy} r={(3 + 2 * lit) * u} fill="#FFF6DE" opacity={stagger(draw, 6, n)} />
    </g>
  );
};
