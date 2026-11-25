/**
 * 一条语录 =「一语两拍」：
 *   第 1 拍（start → punch）意象铺垫：图腾描边生长（在 Rig 里），序号 / 眉题 / 铺垫句依次浮现
 *   第 2 拍（punch → end） 金句定格：金句 blur(4px)→0 + 扫光错峰浮现，关键词金属高亮，标签与英文副标弹出
 * 星盘本体在 components/astrolabe/Rig.tsx（全片共用一枚），这里只负责文字层。
 */
import React from "react";
import { random, useCurrentFrame, useVideoConfig } from "remotion";
import { eyebrowOf, indexLabel, totalLabel, type Quote } from "../config/content";
import { TYPE, useStage, type Stage } from "../config/format";
import { GOLD, INK, MOOD } from "../config/palette";
import type { QuoteSegment } from "../config/timeline";
import { clamp01, EASE_IN_OUT, mixHex, ramp, rgba, springAt } from "../lib/anim";
import { FONT_CN } from "../lib/fonts";
import { quoteGeometry, type TextBox } from "../lib/layout";
import { Stroke } from "../components/emblems/common";
import { CharReveal, fitSize } from "../components/text/CharReveal";
import { EnglishLine, Eyebrow, IndexMark, TagLabel } from "../components/text/Marks";

/** 本地时间表（帧，相对段落起点） */
const T_INDEX = 4;
const T_EYEBROW = 9;
const T_SETUP = 14;
const EXIT = 10;

type Beats = { P: number; D: number };

const metalFill = (mood: string) =>
  `linear-gradient(180deg, #FFF8E6 0%, ${mixHex(GOLD, "#FFFFFF", 0.35)} 22%, ${GOLD} 46%, ${mixHex(mood, GOLD, 0.35)} 70%, ${mixHex(
    mood,
    "#000000",
    0.25,
  )} 100%)`;

/** 文案侧的微弱星座连线 */
const TextConstellation: React.FC<{ box: TextBox; seed: number; stage: Stage; mood: string }> = ({ box, seed, stage, mood }) => {
  const frame = useCurrentFrame();
  const { u, H } = stage;
  const top = box.anchor === "center" ? box.y - H * 0.3 : box.y - H * 0.04;
  const h = box.anchor === "center" ? H * 0.6 : H * 0.36;
  const pts = Array.from({ length: 7 }, (_, i) => ({
    x: box.x + box.w * (0.08 + 0.84 * random(`tc-x-${seed}-${i}`)),
    y: top + h * ((i + 0.5) / 7 + (random(`tc-y-${seed}-${i}`) - 0.5) * 0.12),
  })).sort((a, b) => a.x - b.x);
  const p = ramp(frame, 0, 60, EASE_IN_OUT);
  const d = pts.map((q, i) => `${i ? "L" : "M"} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" ");
  return (
    <svg width={stage.W} height={stage.H} style={{ position: "absolute", inset: 0 }}>
      <Stroke d={d} p={p} color={mixHex(GOLD, mood, 0.4)} w={0.8 * u} o={0.13} />
      {pts.map((q, i) => {
        const tw = 0.6 + 0.4 * Math.sin(frame * 0.08 + i * 1.7);
        return (
          <g key={i} opacity={clamp01(p * 7 - i) * tw}>
            <circle cx={q.x} cy={q.y} r={6 * u} fill={rgba(mood, 0.08)} />
            <circle cx={q.x} cy={q.y} r={1.6 * u} fill={i % 3 === 0 ? "#FFF6E0" : mood} opacity={0.7} />
          </g>
        );
      })}
    </svg>
  );
};

/** 编辑排版文字块：序号 → 眉题 → 铺垫句 → 主题色细线 → 金句 → 标签 → 英文 */
const TextStack: React.FC<{ q: Quote; index: number; box: TextBox; beats: Beats; stage: Stage }> = ({ q, index, box, beats, stage }) => {
  const frame = useCurrentFrame();
  const { u } = stage;
  const mood = MOOD[q.mood];
  const { P } = beats;
  const setupDim = 1 - 0.42 * ramp(frame, P, 16) * (q.setup.includes(q.highlight) ? 0 : 1);
  const rule = ramp(frame, P - 4, 18);
  const setupSize = fitSize(q.setup, box.w, TYPE.setup * u);
  const punchSize = fitSize(q.punch, box.w, TYPE.punch * u, 0.04);
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        transform: box.anchor === "center" ? "translateY(-50%)" : undefined,
      }}
    >
      <IndexMark index={indexLabel(index)} total={totalLabel()} start={T_INDEX} u={u} />
      <div style={{ height: 20 * u }} />
      <Eyebrow text={eyebrowOf(index, q)} start={T_EYEBROW} u={u} />
      <div style={{ height: 26 * u }} />
      <div style={{ opacity: setupDim }}>
        <CharReveal
          text={q.setup}
          start={T_SETUP}
          stagger={2.2}
          dur={16}
          blur={2.5}
          fontSize={setupSize}
          fontFamily={FONT_CN}
          fontWeight={300}
          color={rgba(INK, 0.9)}
          highlight={q.highlight}
          highlightAt={P + 4}
          mood={mood}
        />
      </div>
      <div style={{ height: 18 * u }} />
      <div style={{ width: 56 * u * rule, height: 1.5 * u, background: `linear-gradient(90deg, ${mood}, ${rgba(mood, 0)})`, boxShadow: `0 0 ${8 * u}px ${rgba(mood, 0.6)}` }} />
      <div style={{ height: 18 * u }} />
      <CharReveal
        text={q.punch}
        start={P}
        stagger={1.1}
        dur={16}
        blur={4}
        rise={0.2}
        fontSize={punchSize}
        fontFamily={FONT_CN}
        fontWeight={600}
        letterSpacing="0.04em"
        highlight={q.highlight}
        highlightAt={P + 4}
        mood={mood}
        lineDelay={5}
      />
      <div style={{ height: 30 * u }} />
      <div style={{ display: "flex", gap: 26 * u, flexWrap: "wrap" }}>
        {q.tags.map((t, k) => (
          <TagLabel key={k} tag={t} start={P + 14 + k * 6} mood={mood} u={u} />
        ))}
      </div>
      <div style={{ height: 24 * u }} />
      <EnglishLine text={q.english} start={P + 22} u={u} />
    </div>
  );
};

/** 超大金属衬线字：铺垫时是细描边，金句重拍时填充金属渐变并发光 */
const GiantGlyphs: React.FC<{
  text: string;
  size: number;
  mood: string;
  P: number;
  vertical?: boolean;
  u: number;
}> = ({ text, size, mood, P, vertical, u }) => {
  const frame = useCurrentFrame();
  const reveal = ramp(frame, T_SETUP - 6, 40, EASE_IN_OUT);
  const lit = ramp(frame, P, 14);
  const common: React.CSSProperties = {
    fontFamily: FONT_CN,
    fontWeight: 900,
    fontSize: size,
    lineHeight: 1,
    letterSpacing: vertical ? "0.16em" : 0,
    writingMode: vertical ? "vertical-rl" : undefined,
    whiteSpace: "nowrap",
  };
  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          ...common,
          color: "transparent",
          WebkitTextStroke: `${Math.max(1, 1.1 * u)}px ${rgba(GOLD, 0.6)}`,
          opacity: 1 - 0.75 * lit,
          clipPath: vertical ? `inset(0 0 ${(1 - reveal) * 100}% 0)` : `inset(${(1 - reveal) * 100}% 0 0 0)`,
        }}
      >
        {text}
      </div>
      <div
        style={{
          ...common,
          position: "absolute",
          inset: 0,
          backgroundImage: metalFill(mood),
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          opacity: lit,
          filter: `blur(${((1 - lit) * 4).toFixed(2)}px) drop-shadow(0 0 ${(18 * u * lit).toFixed(1)}px ${rgba(mood, 0.45 * lit)})`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

const CenterSplit: React.FC<{ q: Quote; index: number; beats: Beats; stage: Stage }> = ({ q, index, beats, stage }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = stage;
  const geo = quoteGeometry(stage, q);
  const mood = MOOD[q.mood];
  const { P } = beats;
  const top = geo.top!;
  const bottom = geo.bottom!;
  const split = geo.split!;
  const [lc, rc] = q.splitChars ?? [q.keyword[0], q.keyword.slice(1)];
  const spread = springAt(frame, P, fps, 11) * 26 * u;
  const setupDim = 1 - 0.38 * ramp(frame, P, 16);
  const punchSize = fitSize(q.punch, bottom.w, 54 * u, 0.04);
  return (
    <>
      <div style={{ position: "absolute", left: top.x, top: top.y, width: top.w, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <IndexMark index={indexLabel(index)} total={totalLabel()} start={T_INDEX} u={u} align="center" />
        <div style={{ height: 12 * u }} />
        <Eyebrow text={eyebrowOf(index, q)} start={T_EYEBROW} u={u} align="center" />
        <div style={{ height: 10 * u }} />
        <div style={{ opacity: setupDim }}>
          <CharReveal
            text={q.setup}
            start={T_SETUP}
            stagger={2}
            blur={2.5}
            fontSize={fitSize(q.setup, top.w, 40 * u)}
            fontFamily={FONT_CN}
            fontWeight={300}
            color={rgba(INK, 0.9)}
            align="center"
            highlight={q.highlight}
            highlightAt={P + 4}
            mood={mood}
          />
        </div>
      </div>
      {[
        { ch: lc, x: split.lx - spread },
        { ch: rc, x: split.rx + spread },
      ].map(({ ch, x }, k) => (
        <div key={k} style={{ position: "absolute", left: x, top: split.y, transform: "translate(-50%, -50%)" }}>
          <GiantGlyphs text={ch} size={split.size} mood={mood} P={P + k * 3} u={u} />
        </div>
      ))}
      <div style={{ position: "absolute", left: bottom.x, top: bottom.y, width: bottom.w, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <CharReveal
          text={q.punch}
          start={P}
          stagger={1.1}
          dur={16}
          blur={4}
          rise={0.2}
          fontSize={punchSize}
          fontFamily={FONT_CN}
          fontWeight={600}
          letterSpacing="0.04em"
          align="center"
          highlight={q.highlight}
          highlightAt={P + 4}
          mood={mood}
          lineDelay={5}
        />
        <div style={{ height: 14 * u }} />
        <div style={{ display: "flex", alignItems: "center", gap: 28 * u, flexWrap: "wrap", justifyContent: "center" }}>
          {q.tags.map((t, k) => (
            <TagLabel key={k} tag={t} start={P + 14 + k * 6} mood={mood} u={u} />
          ))}
          <EnglishLine text={q.english} start={P + 22} u={u} />
        </div>
      </div>
    </>
  );
};

const VerticalAccent: React.FC<{ q: Quote; index: number; beats: Beats; stage: Stage }> = ({ q, index, beats, stage }) => {
  const frame = useCurrentFrame();
  const { u } = stage;
  const geo = quoteGeometry(stage, q);
  const v = geo.vertical!;
  const mood = MOOD[q.mood];
  const grow = ramp(frame, 2, 36, EASE_IN_OUT);
  const mid = (v.dividerTop + v.dividerBottom) / 2;
  const half = ((v.dividerBottom - v.dividerTop) / 2) * grow;
  const lit = ramp(frame, beats.P, 14);
  return (
    <>
      {/* 细垂直分割线，从中点向上下生长 */}
      <div
        style={{
          position: "absolute",
          left: v.dividerX,
          top: mid - half,
          height: half * 2,
          width: 1,
          background: `linear-gradient(180deg, ${rgba(GOLD, 0)}, ${rgba(GOLD, 0.7)} 20%, ${rgba(mixHex(GOLD, mood, lit), 0.9)} 50%, ${rgba(GOLD, 0.7)} 80%, ${rgba(GOLD, 0)})`,
          boxShadow: `0 0 ${8 * u * lit}px ${rgba(mood, 0.5)}`,
        }}
      />
      {[v.dividerTop, v.dividerBottom].map((y, k) => (
        <div
          key={k}
          style={{
            position: "absolute",
            left: v.dividerX - 3.5 * u,
            top: y - 3.5 * u,
            width: 7 * u,
            height: 7 * u,
            transform: "rotate(45deg)",
            border: `1px solid ${rgba(GOLD, 0.8)}`,
            opacity: clamp01(grow * 3 - 2),
          }}
        />
      ))}
      <div style={{ position: "absolute", left: v.x, top: v.y, transform: "translate(-50%, -50%)" }}>
        <GiantGlyphs text={q.keyword} size={v.size} mood={mood} P={beats.P} vertical u={u} />
      </div>
      <TextStack q={q} index={index} box={geo.text} beats={beats} stage={stage} />
    </>
  );
};

export const QuoteScene: React.FC<{ seg: QuoteSegment }> = ({ seg }) => {
  const frame = useCurrentFrame();
  const stage = useStage();
  const { quote: q, index } = seg;
  const beats: Beats = { P: seg.punch - seg.from, D: seg.to - seg.from };
  const geo = quoteGeometry(stage, q);
  const exit = ramp(frame, beats.D - EXIT, EXIT, EASE_IN_OUT);
  const mood = MOOD[q.mood];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: 1 - exit,
        filter: exit > 0 ? `blur(${(exit * 3).toFixed(2)}px)` : undefined,
        transform: `translateY(${(-exit * 10 * stage.u).toFixed(2)}px)`,
      }}
    >
      {q.layout !== "center-split" && <TextConstellation box={geo.text} seed={index} stage={stage} mood={mood} />}
      {(q.layout === "left-editorial" || q.layout === "right-editorial") && (
        <TextStack q={q} index={index} box={geo.text} beats={beats} stage={stage} />
      )}
      {q.layout === "center-split" && <CenterSplit q={q} index={index} beats={beats} stage={stage} />}
      {q.layout === "vertical-accent" && <VerticalAccent q={q} index={index} beats={beats} stage={stage} />}
    </div>
  );
};
