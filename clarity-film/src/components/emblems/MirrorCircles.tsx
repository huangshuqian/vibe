/** 06 对称镜像双圆：一条镜轴两边完全对称的两个圆，重叠出一枚透镜（各自都对）。 */
import React from "react";
import { random } from "remotion";
import { circlePath, polyPath } from "../../lib/geometry";
import { dim, Halo, StarDust, Stroke, stagger, type EmblemProps } from "./common";

export const MirrorCircles: React.FC<EmblemProps> = ({ cx, cy, r, color, draw, lit, bloom, frame, u }) => {
  const n = 7;
  const off = r * 0.3;
  const rr = r * 0.52;
  const L = cx - off;
  const R = cx + off;
  const chev = (x: number, dir: 1 | -1) =>
    polyPath(
      [
        { x: x - dir * rr * 0.16, y: cy - rr * 0.2 },
        { x: x + dir * rr * 0.08, y: cy },
        { x: x - dir * rr * 0.16, y: cy + rr * 0.2 },
      ],
      false,
    );

  return (
    <g>
      <defs>
        <clipPath id="mirror-lens">
          <circle cx={R} cy={cy} r={rr} />
        </clipPath>
      </defs>
      {/* 透镜（两圆交集） */}
      <circle cx={L} cy={cy} r={rr} clipPath="url(#mirror-lens)" fill={dim(color, (0.04 + 0.22 * lit) * stagger(draw, 3, n))} />
      <StarDust cx={cx} cy={cy} R={rr * 0.85} color={color} lit={lit} frame={frame} u={u} seed="mirror" n={50} />
      {/* 镜轴 */}
      <line
        x1={cx}
        y1={cy - r * 0.98}
        x2={cx}
        y2={cy + r * 0.98}
        stroke={color}
        strokeWidth={(0.9 + 0.8 * lit) * u}
        strokeDasharray={`${5 * u} ${6 * u}`}
        opacity={stagger(draw, 0, n) * (0.5 + 0.5 * lit)}
      />
      <Stroke d={`M ${cx - r * 0.95} ${cy} L ${cx + r * 0.95} ${cy}`} p={stagger(draw, 0.5, n)} color={color} w={0.7 * u} o={0.35} />
      {/* 两个镜像圆：左边顺时针画，右边逆时针画 */}
      <Stroke d={circlePath(L, cy, rr)} p={stagger(draw, 1, n)} color={color} w={1.8 * u} />
      <Stroke d={circlePath(R, cy, rr, true)} p={stagger(draw, 1, n)} color={color} w={1.8 * u} />
      <Stroke d={circlePath(L, cy, rr * 0.42)} p={stagger(draw, 2, n)} color={color} w={1 * u} o={0.7} />
      <Stroke d={circlePath(R, cy, rr * 0.42, true)} p={stagger(draw, 2, n)} color={color} w={1 * u} o={0.7} />
      {/* 指向镜轴的一对箭头 */}
      <Stroke d={chev(L, 1)} p={stagger(draw, 4, n)} color={color} w={1.6 * u} />
      <Stroke d={chev(R, -1)} p={stagger(draw, 4, n)} color={color} w={1.6 * u} />
      {/* 镜像星点 */}
      <g opacity={stagger(draw, 5, n)}>
        {Array.from({ length: 7 }, (_, k) => {
          const dx = r * (0.1 + 0.8 * random(`mir-x-${k}`));
          const dy = r * (random(`mir-y-${k}`) - 0.5) * 1.5;
          const tw = 0.5 + 0.5 * Math.sin(frame * 0.09 + k * 1.3);
          const s = (1.2 + random(`mir-s-${k}`) * 1.4) * u;
          return (
            <g key={k} opacity={0.4 + 0.6 * tw}>
              <circle cx={cx - dx} cy={cy + dy} r={s} fill={color} />
              <circle cx={cx + dx} cy={cy + dy} r={s} fill={color} />
            </g>
          );
        })}
      </g>
      <Halo cx={L} cy={cy} r={(10 + 20 * bloom) * u} color={color} o={0.4 + 0.6 * lit} id="mir-hl" />
      <Halo cx={R} cy={cy} r={(10 + 20 * bloom) * u} color={color} o={0.4 + 0.6 * lit} id="mir-hr" />
      <circle cx={L} cy={cy} r={3 * u} fill="#F7F3FF" opacity={stagger(draw, 6, n)} />
      <circle cx={R} cy={cy} r={3 * u} fill="#F7F3FF" opacity={stagger(draw, 6, n)} />
    </g>
  );
};
