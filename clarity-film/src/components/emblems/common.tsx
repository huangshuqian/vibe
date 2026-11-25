/** 图腾共用：逐笔生长描边、错峰进度、星尘点阵。 */
import React from "react";
import { random } from "remotion";
import { clamp01, rgba } from "../../lib/anim";

export type EmblemProps = {
  /** 图腾中心（Rig 已经平移到原点，通常是 0, 0） */
  cx: number;
  cy: number;
  /** 图腾半径 */
  r: number;
  color: string;
  /** 0..1 描边生长进度 */
  draw: number;
  /** 0..1 金句时刻点亮 */
  lit: number;
  /** 0..1 金句瞬间的高光脉冲（衰减） */
  bloom: number;
  /** 距离金句重拍的帧数（之前为负） */
  sincePunch: number;
  frame: number;
  bass: number;
  /** 当前小节内的相位 0..1 */
  barPhase: number;
  u: number;
};

/** 把整体进度 p 分给 n 个笔画中的第 i 笔，相邻笔画有 overlap 比例重叠 */
export const stagger = (p: number, i: number, n: number, overlap = 0.55) => {
  const span = 1 / (n - (n - 1) * overlap);
  const start = i * span * (1 - overlap);
  return clamp01((p - start) / span);
};

type StrokeProps = {
  d: string;
  p: number;
  color: string;
  w: number;
  o?: number;
  fill?: string;
  linecap?: "round" | "butt" | "square";
};

/** strokeDashoffset 逐笔生长 */
export const Stroke: React.FC<StrokeProps> = ({ d, p, color, w, o = 1, fill = "none", linecap = "round" }) =>
  p <= 0 ? null : (
    <path
      d={d}
      pathLength={1}
      strokeDasharray="1 1"
      strokeDashoffset={1 - p}
      stroke={color}
      strokeWidth={w}
      strokeOpacity={o}
      strokeLinecap={linecap}
      fill={fill}
    />
  );

/** 金句时刻从中心向外亮起的星尘点阵（向日葵螺旋分布） */
export const StarDust: React.FC<{
  cx: number;
  cy: number;
  R: number;
  color: string;
  lit: number;
  frame: number;
  u: number;
  n?: number;
  seed: string;
}> = ({ cx, cy, R, color, lit, frame, u, n = 120, seed }) => {
  if (lit <= 0) return null;
  return (
    <g>
      {Array.from({ length: n }, (_, k) => {
        const rho = R * Math.sqrt((k + 0.5) / n);
        const a = k * 2.39996;
        const appear = clamp01(lit * 1.8 - (rho / R) * 0.9);
        if (appear <= 0) return null;
        const tw = 0.55 + 0.45 * Math.sin(frame * (0.06 + random(`${seed}-w-${k}`) * 0.1) + random(`${seed}-p-${k}`) * 6.28);
        const size = (0.8 + random(`${seed}-s-${k}`) * 1.1) * u;
        return (
          <circle
            key={k}
            cx={cx + rho * Math.cos(a)}
            cy={cy + rho * Math.sin(a)}
            r={size}
            fill={k % 7 === 0 ? "#FFF4D6" : color}
            opacity={appear * tw * 0.85}
          />
        );
      })}
    </g>
  );
};

export const Halo: React.FC<{ cx: number; cy: number; r: number; color: string; o: number; id: string }> = ({
  cx,
  cy,
  r,
  color,
  o,
  id,
}) =>
  o <= 0 ? null : (
    <g>
      <defs>
        <radialGradient id={id}>
          <stop offset="0%" stopColor="#FFF6DE" stopOpacity={0.95} />
          <stop offset="28%" stopColor={color} stopOpacity={0.55} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} opacity={clamp01(o)} />
    </g>
  );

export const dim = (color: string, a: number) => rgba(color, a);
