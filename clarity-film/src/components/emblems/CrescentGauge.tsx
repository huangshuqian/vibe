/** 05 微光残月刻度仪：一弯残月 + 半圆仪表，金句时指针一路掉进「余额不足」的红区。 */
import React from "react";
import { spring, useVideoConfig } from "remotion";
import { FONT_EN } from "../../lib/fonts";
import { arcPath, circlePath, polar } from "../../lib/geometry";
import { dim, Halo, StarDust, Stroke, stagger, type EmblemProps } from "./common";

const A0 = -125;
const A1 = 125;

export const CrescentGauge: React.FC<EmblemProps> = ({ cx, cy, r, color, draw, lit, bloom, sincePunch, frame, u }) => {
  const { fps } = useVideoConfig();
  const n = 7;
  // 指针：铺垫时在 64% 附近晃，金句重拍时掉到 4%
  const drop = sincePunch < 0 ? 0 : spring({ frame: sincePunch, fps, config: { damping: 9, mass: 0.9, stiffness: 90 } });
  const value = 0.64 + 0.02 * Math.sin(frame * 0.13) - drop * 0.6;
  const needleA = A0 + (A1 - A0) * value;
  const tip = polar(cx, cy, r * 0.74, needleA);
  const tail = polar(cx, cy, r * 0.12, needleA + 180);

  // 残月：外圆被偏移圆挖掉一块
  const mo = { x: cx - r * 0.04, y: cy + r * 0.06, r: r * 0.42 };
  const mc = { x: mo.x + r * 0.2, y: mo.y - r * 0.11, r: r * 0.38 };
  const crescentDraw = stagger(draw, 2, n);

  return (
    <g>
      <defs>
        <mask id="cres-cut" maskUnits="userSpaceOnUse">
          <rect x={cx - r * 2} y={cy - r * 2} width={r * 4} height={r * 4} fill="#fff" />
          <circle cx={mc.x} cy={mc.y} r={mc.r} fill="#000" />
        </mask>
        <mask id="cres-inner" maskUnits="userSpaceOnUse">
          <circle cx={mo.x} cy={mo.y} r={mo.r} fill="#fff" />
        </mask>
      </defs>
      {/* 仪表刻度 */}
      <Stroke d={arcPath(cx, cy, r * 0.86, A0, A1)} p={stagger(draw, 0, n)} color={color} w={0.9 * u} o={0.5} />
      <g opacity={stagger(draw, 1, n)}>
        {Array.from({ length: 51 }, (_, i) => {
          const a = A0 + ((A1 - A0) * i) / 50;
          const long = i % 5 === 0;
          const p0 = polar(cx, cy, r * 0.9, a);
          const p1 = polar(cx, cy, r * (long ? 1.0 : 0.95), a);
          const low = i <= 6;
          return (
            <line
              key={i}
              x1={p0.x}
              y1={p0.y}
              x2={p1.x}
              y2={p1.y}
              stroke={low ? "#FFD2DA" : color}
              strokeWidth={(long ? 1.5 : 0.8) * u}
              strokeOpacity={low ? 0.6 + 0.4 * lit : long ? 0.85 : 0.5}
            />
          );
        })}
        {[
          { a: A0, t: "0" },
          { a: 0, t: "50" },
          { a: A1, t: "100" },
        ].map(({ a, t }) => {
          const p = polar(cx, cy, r * 1.1, a);
          return (
            <text key={t} x={p.x} y={p.y} fill={color} fillOpacity={0.7} fontFamily={FONT_EN} fontSize={14 * u} textAnchor="middle" dominantBaseline="middle" letterSpacing={2 * u}>
              {t}
            </text>
          );
        })}
      </g>
      {/* 低电量红区 */}
      <Stroke d={arcPath(cx, cy, r * 0.86, A0, A0 + 30)} p={stagger(draw, 1.5, n)} color={color} w={(3 + 2.5 * lit) * u} o={0.6 + 0.4 * lit} linecap="butt" />
      <StarDust cx={mo.x} cy={mo.y} R={mo.r * 0.95} color={color} lit={lit} frame={frame} u={u} seed="moon" n={60} />
      {/* 残月本体 */}
      <g mask="url(#cres-cut)">
        <circle cx={mo.x} cy={mo.y} r={mo.r} fill={dim(color, (0.06 + 0.3 * lit) * crescentDraw)} />
        <Stroke d={circlePath(mo.x, mo.y, mo.r, true)} p={crescentDraw} color={color} w={1.8 * u} />
      </g>
      <g mask="url(#cres-inner)">
        <Stroke
          d={circlePath(mc.x, mc.y, mc.r)}
          p={stagger(draw, 3, n)}
          color={color}
          w={1.2 * u}
          o={0.8}
        />
      </g>
      {/* 指针 */}
      <g opacity={stagger(draw, 5, n)}>
        <line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} stroke="#FFF2EA" strokeWidth={1.6 * u} strokeLinecap="round" />
        <circle cx={tip.x} cy={tip.y} r={3 * u} fill={color} />
        <circle cx={cx} cy={cy} r={6 * u} fill="none" stroke={color} strokeWidth={1.4 * u} />
        <circle cx={cx} cy={cy} r={2.4 * u} fill="#FFF2EA" />
      </g>
      <Halo cx={tip.x} cy={tip.y} r={(14 + 34 * bloom) * u} color={color} o={0.3 + 0.7 * lit} id="cres-h" />
    </g>
  );
};
