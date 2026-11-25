/**
 * 4 种构图的几何：星盘中心 / 半径、文案区、拆字与竖排关键词位置。
 * 横屏与竖屏各一套比例，全部由 useStage() 的 W / H 推出来。
 */
import type { LayoutMode, Quote } from "../config/content";
import type { Stage } from "../config/format";
import type { Segment } from "../config/timeline";

export type Astro = { cx: number; cy: number; r: number };

export type TextBox = {
  x: number;
  y: number;
  w: number;
  /** 文案块垂直方向的锚点：top = y 是顶边，center = y 是中线 */
  anchor: "top" | "center";
  align: "left" | "center";
};

export type QuoteGeometry = {
  layout: LayoutMode;
  astro: Astro;
  text: TextBox;
  /** center-split：上方铺垫句、下方金句 */
  top?: TextBox;
  bottom?: TextBox;
  /** center-split：左右拆字的中心 x，和字号 */
  split?: { lx: number; rx: number; y: number; size: number };
  /** vertical-accent：竖排关键词与分割线 */
  vertical?: { x: number; y: number; size: number; dividerX: number; dividerTop: number; dividerBottom: number };
};

export const quoteGeometry = (s: Stage, q: Quote): QuoteGeometry => {
  const { W, H, u, portrait } = s;
  switch (q.layout) {
    case "left-editorial":
      return portrait
        ? {
            layout: q.layout,
            astro: { cx: W * 0.5, cy: H * 0.29, r: W * 0.34 },
            text: { x: W * 0.1, y: H * 0.545, w: W * 0.8, anchor: "top", align: "left" },
          }
        : {
            layout: q.layout,
            astro: { cx: W * 0.705, cy: H * 0.5, r: H * 0.33 },
            text: { x: W * 0.085, y: H * 0.5, w: W * 0.405, anchor: "center", align: "left" },
          };
    case "right-editorial":
      return portrait
        ? {
            layout: q.layout,
            astro: { cx: W * 0.5, cy: H * 0.7, r: W * 0.34 },
            text: { x: W * 0.1, y: H * 0.1, w: W * 0.8, anchor: "top", align: "left" },
          }
        : {
            layout: q.layout,
            astro: { cx: W * 0.295, cy: H * 0.5, r: H * 0.33 },
            text: { x: W * 0.545, y: H * 0.5, w: W * 0.385, anchor: "center", align: "left" },
          };
    case "center-split": {
      const r = portrait ? W * 0.25 : H * 0.19;
      const cy = portrait ? H * 0.47 : H * 0.462;
      const size = portrait ? 150 * u : 232 * u;
      const gap = r * 1.2 + size * 0.75;
      return {
        layout: q.layout,
        astro: { cx: W / 2, cy, r },
        text: { x: W * 0.1, y: H * 0.2, w: W * 0.8, anchor: "top", align: "center" },
        top: portrait
          ? { x: W * 0.08, y: H * 0.12, w: W * 0.84, anchor: "top", align: "center" }
          : { x: W * 0.15, y: H * 0.05, w: W * 0.7, anchor: "top", align: "center" },
        bottom: portrait
          ? { x: W * 0.06, y: H * 0.665, w: W * 0.88, anchor: "top", align: "center" }
          : { x: W * 0.12, y: H * 0.69, w: W * 0.76, anchor: "top", align: "center" },
        split: portrait
          ? { lx: W * 0.5 - W * 0.38, rx: W * 0.5 + W * 0.38, y: cy - r * 1.55, size }
          : { lx: W / 2 - gap, rx: W / 2 + gap, y: cy, size },
      };
    }
    case "vertical-accent": {
      const left = (q.verticalSide ?? "left") === "left";
      if (portrait) {
        const kx = left ? W * 0.12 : W * 0.88;
        return {
          layout: q.layout,
          astro: { cx: left ? W * 0.6 : W * 0.4, cy: H * 0.28, r: W * 0.3 },
          text: { x: left ? W * 0.27 : W * 0.08, y: H * 0.55, w: W * 0.65, anchor: "top", align: "left" },
          vertical: {
            x: kx,
            y: H * 0.56,
            size: 150 * u,
            dividerX: left ? W * 0.215 : W * 0.785,
            dividerTop: H * 0.12,
            dividerBottom: H * 0.9,
          },
        };
      }
      return {
        layout: q.layout,
        astro: { cx: left ? W * 0.77 : W * 0.23, cy: H * 0.5, r: H * 0.3 },
        text: { x: left ? W * 0.265 : W * 0.435, y: H * 0.5, w: W * 0.315, anchor: "center", align: "left" },
        vertical: {
          x: left ? W * 0.125 : W * 0.875,
          y: H * 0.5,
          size: 196 * u,
          dividerX: left ? W * 0.215 : W * 0.785,
          dividerTop: H * 0.16,
          dividerBottom: H * 0.84,
        },
      };
    }
  }
};

export type RigTarget = Astro & { opacity: number; mood: string | null };

/** 每一段里星盘外环应该待的位置 */
export const rigTarget = (s: Stage, seg: Segment, moodHex: (q: Quote) => string): RigTarget => {
  const { W, H, portrait } = s;
  const short = Math.min(W, H);
  switch (seg.kind) {
    case "prelude":
      return { cx: W / 2, cy: H / 2, r: portrait ? W * 0.36 : H * 0.3, opacity: 1, mood: null };
    case "quote":
      return { ...quoteGeometry(s, seg.quote).astro, opacity: 1, mood: moodHex(seg.quote) };
    case "interaction":
      return { cx: W / 2, cy: H / 2, r: short * 0.16, opacity: 0, mood: null };
    case "finale":
      return { cx: W / 2, cy: H / 2, r: portrait ? W * 0.44 : H * 0.455, opacity: 1, mood: null };
  }
};
