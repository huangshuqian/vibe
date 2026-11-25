/**
 * 确定性多层星空：远 / 中 / 近三层不同速度的视差漂移 + 呼吸微闪，
 * 中层邻近星点之间画低透明度的星座连线。星点亮度随中频能量轻微起伏。
 */
import React, { useMemo } from "react";
import { random, useCurrentFrame } from "remotion";
import { useStage } from "../../config/format";
import { useEnergy } from "../../lib/audio";

type Layer = { count: number; speed: number; r: [number, number]; o: [number, number] };

const LAYERS: Layer[] = [
  { count: 240, speed: 0.05, r: [0.35, 0.95], o: [0.15, 0.5] },
  { count: 95, speed: 0.13, r: [0.7, 1.4], o: [0.3, 0.75] },
  { count: 26, speed: 0.28, r: [1.2, 2.2], o: [0.55, 0.95] },
];
const PAD = 40;

type Star = { x0: number; y0: number; r: number; o: number; tw: number; ph: number };

const makeStars = (layer: number): Star[] =>
  Array.from({ length: LAYERS[layer].count }, (_, i) => {
    const L = LAYERS[layer];
    const k = `${layer}-${i}`;
    return {
      x0: random(`sx-${k}`),
      y0: random(`sy-${k}`),
      r: L.r[0] + (L.r[1] - L.r[0]) * random(`sr-${k}`) ** 2,
      o: L.o[0] + (L.o[1] - L.o[0]) * random(`so-${k}`),
      tw: 0.025 + 0.09 * random(`st-${k}`),
      ph: random(`sp-${k}`) * Math.PI * 2,
    };
  });

const STARS = LAYERS.map((_, i) => makeStars(i));

const wrap = (v: number, m: number) => ((v % m) + m) % m;

export const StarField: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const frame = useCurrentFrame();
  const { W, H, u } = useStage();
  const { mid } = useEnergy();
  const Wp = W + PAD * 2;
  const Hp = H + PAD * 2;

  const pos = (layer: number, s: Star) => {
    const v = LAYERS[layer].speed * u * frame;
    return { x: wrap(s.x0 * Wp - v, Wp) - PAD, y: wrap(s.y0 * Hp - v * 0.22, Hp) - PAD };
  };

  // 中层星点的近邻连线（基于初始位置算一次，漂移时距离不变）
  const pairs = useMemo(() => {
    const st = STARS[1];
    const maxD = Math.min(W, H) * 0.12;
    const out: [number, number][] = [];
    st.forEach((a, i) => {
      const near = st
        .map((b, j) => ({ j, d: Math.hypot((a.x0 - b.x0) * Wp, (a.y0 - b.y0) * Hp) }))
        .filter(({ j, d }) => j > i && d < maxD)
        .sort((p, q) => p.d - q.d)
        .slice(0, 2);
      near.forEach(({ j }) => out.push([i, j]));
    });
    return out.slice(0, 60);
  }, [W, H, Wp, Hp]);

  const shimmer = 1 + 0.3 * mid;

  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity }}>
      {pairs.map(([i, j], k) => {
        const a = pos(1, STARS[1][i]);
        const b = pos(1, STARS[1][j]);
        if (Math.abs(a.x - b.x) > W * 0.3 || Math.abs(a.y - b.y) > H * 0.3) return null; // 刚好跨过画面边缘
        const o = 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(frame * 0.02 + k * 1.3));
        return <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#C9D6FF" strokeWidth={0.6 * u} strokeOpacity={o} />;
      })}
      {STARS.map((layer, li) =>
        layer.map((s, i) => {
          const p = pos(li, s);
          const tw = 0.6 + 0.4 * Math.sin(frame * s.tw + s.ph);
          const o = Math.min(1, s.o * tw * shimmer);
          const warm = (i + li) % 11 === 0;
          return <circle key={`${li}-${i}`} cx={p.x} cy={p.y} r={s.r * u} fill={warm ? "#FFE6B0" : "#E4EBFF"} opacity={o} />;
        }),
      )}
      {/* 近层最亮的几颗带十字星芒 */}
      {STARS[2].slice(0, 8).map((s, i) => {
        const p = pos(2, s);
        const tw = 0.55 + 0.45 * Math.sin(frame * s.tw * 0.8 + s.ph);
        const l = (7 + 6 * tw) * u;
        return (
          <g key={`f${i}`} opacity={0.5 * tw * shimmer}>
            <line x1={p.x - l} y1={p.y} x2={p.x + l} y2={p.y} stroke="#FFF1D0" strokeWidth={0.6 * u} />
            <line x1={p.x} y1={p.y - l} x2={p.x} y2={p.y + l} stroke="#FFF1D0" strokeWidth={0.6 * u} />
          </g>
        );
      })}
    </svg>
  );
};
