/** 09 向外扩散的星尘回声波纹：中心发出一圈圈由星尘组成的回声；金句时远处有一个点被点亮、连回中心。 */
import React from "react";
import { random } from "remotion";
import { circlePath, diamondStar, polar } from "../../lib/geometry";
import { Halo, Stroke, stagger, type EmblemProps } from "./common";

const RIPPLES = 6;
const CYCLE = 150; // 每圈回声 5 秒从中心走到边缘

export const EchoRipples: React.FC<EmblemProps> = ({ cx, cy, r, color, draw, lit, bloom, frame, u }) => {
  const n = 6;
  const R = r * 0.96;
  const one = polar(cx, cy, R * 0.8, 52);
  const others = [148, 236, 312].map((a, i) => polar(cx, cy, R * (0.55 + 0.12 * i), a));

  return (
    <g>
      <Stroke d={circlePath(cx, cy, R * 0.5)} p={stagger(draw, 0, n)} color={color} w={0.8 * u} o={0.3} />
      <Stroke d={circlePath(cx, cy, R)} p={stagger(draw, 1, n)} color={color} w={1 * u} o={0.45} />
      {/* 星尘回声 */}
      <g opacity={stagger(draw, 2, n)}>
        {Array.from({ length: RIPPLES }, (_, k) => {
          const t = ((frame / CYCLE + k / RIPPLES) % 1 + 1) % 1;
          const rho = R * t;
          const fade = (1 - t) ** 1.3;
          const dots = Math.round(10 + 64 * t);
          return (
            <g key={k}>
              <circle cx={cx} cy={cy} r={rho} fill="none" stroke={color} strokeWidth={0.7 * u} strokeOpacity={0.22 * fade * (1 + lit)} />
              {Array.from({ length: dots }, (_, j) => {
                const a = (j * 360) / dots + k * 7 + random(`echo-${k}-${j}`) * 3;
                const p = polar(cx, cy, rho * (0.985 + random(`echo-r-${k}-${j}`) * 0.03), a);
                return <circle key={j} cx={p.x} cy={p.y} r={(0.9 + random(`echo-s-${k}-${j}`)) * u} fill={j % 11 === 0 ? "#F2F8FF" : color} opacity={fade * 0.9} />;
              })}
            </g>
          );
        })}
      </g>
      {/* 其他人：很淡的连线 */}
      <g opacity={stagger(draw, 4, n) * 0.45}>
        {others.map((p, i) => (
          <g key={i}>
            <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={color} strokeWidth={0.7 * u} strokeDasharray={`${2 * u} ${6 * u}`} />
            <circle cx={p.x} cy={p.y} r={2.4 * u} fill={color} />
          </g>
        ))}
      </g>
      {/* 那个能替你说出故事的人 */}
      <Stroke d={`M ${cx} ${cy} L ${one.x} ${one.y}`} p={lit} color="#EAF4FF" w={1.3 * u} o={0.85} />
      <Halo cx={one.x} cy={one.y} r={(16 + 40 * bloom + 10 * lit) * u} color={color} o={lit} id="echo-one" />
      <path d={diamondStar(one.x, one.y, (6 + 14 * lit) * u, (2 + 3 * lit) * u)} fill="#F2F8FF" opacity={0.3 + 0.7 * lit} />
      <circle cx={one.x} cy={one.y} r={(9 + 4 * lit) * u} fill="none" stroke={color} strokeWidth={0.9 * u} opacity={0.3 + 0.7 * lit} />
      {/* 声源 */}
      <Halo cx={cx} cy={cy} r={(22 + 24 * bloom) * u} color={color} o={0.55 + 0.45 * lit} id="echo-src" />
      <circle cx={cx} cy={cy} r={4 * u} fill="#F2F8FF" opacity={stagger(draw, 5, n)} />
    </g>
  );
};
