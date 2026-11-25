/**
 * 逐字浮现 + 扫光 + 关键词金属渐变高亮。
 * 每个字单独一个 span：透明度 / 上浮 / 模糊错峰收束，一道暖光从左到右扫过。
 * 高亮字用 background-clip:text 的金属渐变，在 highlightAt 时从正文色过渡到主题色。
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { INK } from "../../config/palette";
import { clamp01, mixHex, ramp, rgba } from "../../lib/anim";

export type CharRevealProps = {
  text: string;
  /** 开始帧（Sequence 内的本地帧） */
  start: number;
  /** 每字间隔帧数 */
  stagger?: number;
  /** 单字浮现时长 */
  dur?: number;
  /** 起始模糊 px */
  blur?: number;
  /** 起始下沉（em） */
  rise?: number;
  sweep?: boolean;
  color?: string;
  highlight?: string;
  highlightAt?: number;
  mood?: string;
  fontSize: number;
  fontFamily: string;
  fontWeight?: number;
  letterSpacing?: string;
  lineHeight?: number;
  align?: "left" | "center";
  /** 每行之后额外的错峰（帧） */
  lineDelay?: number;
};

const metal = (mood: string, h: number) => {
  const s = (c: string) => mixHex(INK, c, h);
  return `linear-gradient(180deg, ${s("#FFFFFF")} 6%, ${s(mixHex(mood, "#FFFFFF", 0.55))} 34%, ${s(mood)} 58%, ${s(
    mixHex(mood, "#000000", 0.38),
  )} 82%, ${s(mixHex(mood, "#FFFFFF", 0.35))} 100%)`;
};

const highlightMask = (text: string, word?: string) => {
  const mask = new Array<boolean>(text.length).fill(false);
  if (!word) return mask;
  let i = text.indexOf(word);
  while (i >= 0) {
    for (let k = i; k < i + word.length; k++) mask[k] = true;
    i = text.indexOf(word, i + word.length);
  }
  return mask;
};

export const CharReveal: React.FC<CharRevealProps> = ({
  text,
  start,
  stagger = 2,
  dur = 14,
  blur = 3,
  rise = 0.3,
  sweep = true,
  color = INK,
  highlight,
  highlightAt = Infinity,
  mood = "#E6C97A",
  fontSize,
  fontFamily,
  fontWeight = 400,
  letterSpacing = "0.06em",
  lineHeight = 1.85,
  align = "left",
  lineDelay = 0,
}) => {
  const frame = useCurrentFrame();
  const mask = highlightMask(text, highlight);
  const lines = text.split("\n");
  const count = text.replace(/\n/g, "").length;
  const h = ramp(frame, highlightAt, 14);
  const sweepPos = sweep ? ((frame - start) / (count * stagger + lines.length * lineDelay + 26)) * (count + 8) - 4 : -99;

  let flat = 0; // 字符在整段（含换行）里的位置，用来查高亮
  let seq = 0; // 不含换行的序号，用来错峰
  return (
    <div style={{ fontSize, fontFamily, fontWeight, letterSpacing, lineHeight, textAlign: align, color }}>
      {lines.map((line, li) => {
        const row = (
          <div key={li} style={{ whiteSpace: "nowrap" }}>
            {[...line].map((ch, ci) => {
              const i = seq++;
              const hl = mask[flat + ci];
              const t0 = start + i * stagger + li * lineDelay;
              const p = ramp(frame, t0, dur);
              const g = Math.exp(-((i - sweepPos) ** 2) / 3.2);
              const b = (1 - p) * blur;
              const base: React.CSSProperties = {
                display: "inline-block",
                opacity: p,
                transform: `translateY(${((1 - p) * rise).toFixed(3)}em)`,
                whiteSpace: "pre",
              };
              if (hl) {
                const glow = clamp01(h);
                return (
                  <span
                    key={ci}
                    style={{
                      ...base,
                      backgroundImage: metal(mood, glow),
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                      fontWeight: Math.max(fontWeight, 600),
                      filter: `blur(${b.toFixed(2)}px) drop-shadow(0 0 ${(0.28 * glow).toFixed(3)}em ${rgba(mood, 0.6 * glow)})${
                        g > 0.02 ? ` brightness(${(1 + 0.6 * g).toFixed(3)})` : ""
                      }`,
                    }}
                  >
                    {ch}
                  </span>
                );
              }
              return (
                <span
                  key={ci}
                  style={{
                    ...base,
                    filter: b > 0.01 ? `blur(${b.toFixed(2)}px)` : undefined,
                    color: g > 0.02 ? mixHex(color.startsWith("#") ? color : INK, "#FFF3D2", 0.85 * g) : color,
                    textShadow: g > 0.02 ? `0 0 ${(0.4 * g).toFixed(3)}em ${rgba("#FFE3A6", 0.8 * g)}` : undefined,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        );
        flat += line.length + 1;
        return row;
      })}
    </div>
  );
};

/** 估算一行文字的宽度（em）：中文 1em，半角 0.55em */
export const lineEm = (line: string, tracking = 0.06) =>
  [...line].reduce((w, ch) => w + (ch.charCodeAt(0) < 0x2e80 ? (ch === " " ? 0.3 : 0.56) : 1) + tracking, 0);

/** 让最长的一行不超过 maxWidth */
export const fitSize = (text: string, maxWidth: number, base: number, tracking = 0.06) => {
  const longest = Math.max(...text.split("\n").map((l) => lineEm(l, tracking)));
  return Math.min(base, maxWidth / Math.max(1, longest));
};
