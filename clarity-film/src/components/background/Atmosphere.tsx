/** 氛围层：径向氛围光、星图等高线脉络、主题色光晕横扫、暗角、胶片噪点。 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { useStage } from "../../config/format";
import { GOLD } from "../../config/palette";
import { SEGMENTS, transitionOf } from "../../config/timeline";
import { clamp01, lerp, mixHex, rgba } from "../../lib/anim";
import { useEnergy } from "../../lib/audio";
import { f2 } from "../../lib/geometry";
import { blendColorBySegment, rigStateAt, segmentMood } from "../../lib/rig";

/** 极深底色上叠微弱的径向氛围光（跟着星盘位置和当前情绪色走） */
export const AmbientGlow: React.FC = () => {
  const frame = useCurrentFrame();
  const stage = useStage();
  const { bass } = useEnergy();
  const st = rigStateAt(frame, stage);
  const mood = blendColorBySegment(frame, segmentMood);
  const a = 0.1 + 0.07 * bass;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: [
          `radial-gradient(circle at ${f2(st.cx)}px ${f2(st.cy)}px, ${rgba(mood, a)} 0%, ${rgba(mood, a * 0.35)} ${f2(st.r * 1.1)}px, ${rgba(mood, 0)} ${f2(st.r * 2.6)}px)`,
          `radial-gradient(ellipse 70% 60% at ${f2(stage.W - st.cx)}px ${f2(stage.H * 0.55)}px, ${rgba(GOLD, 0.035)} 0%, ${rgba(GOLD, 0)} 70%)`,
        ].join(", "),
      }}
    />
  );
};

/** 极淡的星图等高线脉络：几条缓慢形变的闭合曲线 + 两条倾斜的天球大圆 */
export const ContourLines: React.FC = () => {
  const frame = useCurrentFrame();
  const { W, H, u } = useStage();
  const mood = blendColorBySegment(frame, segmentMood);
  const cx = W * 0.58;
  const cy = H * 0.56;
  const base = Math.min(W, H);
  const t = frame / 30;
  const ring = (k: number) => {
    const R = base * (0.22 + k * 0.17);
    const pts = Array.from({ length: 121 }, (_, i) => {
      const a = (i / 120) * Math.PI * 2;
      const rr =
        R *
        (1 + 0.05 * Math.sin(3 * a + k * 1.1 + t * 0.09) + 0.035 * Math.sin(5 * a - k * 0.7 - t * 0.06) + 0.02 * Math.sin(9 * a + t * 0.04));
      return `${i ? "L" : "M"} ${f2(cx + rr * Math.cos(a) * 1.25)} ${f2(cy + rr * Math.sin(a))}`;
    });
    return pts.join(" ") + " Z";
  };
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: 7 }, (_, k) => (
        <path key={k} d={ring(k)} fill="none" stroke={k % 2 ? mixHex(GOLD, mood, 0.5) : "#9FB4E8"} strokeWidth={0.7 * u} strokeOpacity={0.05} />
      ))}
      {[-18, 24].map((tilt, i) => (
        <ellipse
          key={i}
          cx={W / 2}
          cy={H / 2}
          rx={W * 0.62}
          ry={H * 0.2}
          transform={`rotate(${tilt + t * (i ? -0.25 : 0.2)} ${W / 2} ${H / 2})`}
          fill="none"
          stroke={GOLD}
          strokeWidth={0.6 * u}
          strokeOpacity={0.045}
          strokeDasharray={`${2 * u} ${8 * u}`}
        />
      ))}
    </svg>
  );
};

/** 段落切换时一道轻盈的主题色光晕从左到右横扫 */
export const LightSweep: React.FC = () => {
  const frame = useCurrentFrame();
  const { W, H } = useStage();
  return (
    <>
      {SEGMENTS.slice(1).map((seg, i) => {
        const { lead } = transitionOf(seg);
        const t0 = seg.from - lead - 4;
        const t1 = seg.from + 18;
        if (frame < t0 || frame > t1) return null;
        const p = clamp01((frame - t0) / (t1 - t0));
        const x = lerp(-0.45, 1.15, p) * W;
        const color = segmentMood(seg);
        const o = Math.sin(Math.PI * p);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: -H * 0.2,
              width: W * 0.32,
              height: H * 1.4,
              transform: "skewX(-16deg)",
              background: `linear-gradient(90deg, ${rgba(color, 0)} 0%, ${rgba(color, 0.14 * o)} 42%, ${rgba("#FFF6E2", 0.08 * o)} 50%, ${rgba(
                color,
                0.14 * o,
              )} 58%, ${rgba(color, 0)} 100%)`,
              mixBlendMode: "screen",
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};

export const Vignette: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: "radial-gradient(ellipse 78% 74% at 50% 50%, rgba(0,0,0,0) 48%, rgba(1,1,4,0.55) 82%, rgba(0,0,0,0.86) 100%)",
      pointerEvents: "none",
    }}
  />
);

/** 胶片噪点：feTurbulence 每帧换一个确定性的 seed，半分辨率渲染再放大 */
export const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => {
  const frame = useCurrentFrame();
  const { W, H } = useStage();
  const w = Math.ceil(W / 2);
  const h = Math.ceil(H / 2);
  return (
    <svg
      width={w}
      height={h}
      style={{ position: "absolute", left: 0, top: 0, transform: "scale(2)", transformOrigin: "0 0", opacity, pointerEvents: "none" }}
    >
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 24} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width={w} height={h} filter="url(#grain)" />
    </svg>
  );
};
