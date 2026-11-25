/**
 * 画幅与排版基准。
 *
 * 一键切换画幅：把 FORMAT 改成 'portrait' 即可把主合成 ClarityFilm 变成 1080×1920。
 * 另外 Root 里始终注册了一个竖屏预览合成 ClarityFilmPortrait。
 *
 * 所有组件都通过 useStage() 读取当前合成的宽高，排版尺寸统一乘以 u
 * （u = 短边 / 1080，所以横屏和竖屏下字号的像素值一致）。
 */
import { useVideoConfig } from "remotion";

export type FormatKey = "landscape" | "portrait";

/** ← 改这里切换横 / 竖屏 */
export const FORMAT: FormatKey = "landscape";

export const FORMATS: Record<FormatKey, { width: number; height: number }> = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
};

export const FPS = 30;

/** 字号（px，短边 1080 时的值）与排版常量 */
export const TYPE = {
  /** 正文行高 */
  lineHeight: 1.85,
  /** 英文副标字间距 */
  englishTracking: "0.35em",
  index: 40,
  eyebrow: 19,
  setup: 44,
  punch: 68,
  tag: 20,
  english: 21,
  /** center-split 左右拆字 */
  split: 232,
  /** vertical-accent 竖排关键词 */
  vertical: 196,
  openingLine: 40,
  preludeTitle: 128,
  question: 56,
  finaleTitle: 214,
  finaleEnglish: 26,
  finaleClosing: 34,
} as const;

export type Stage = {
  W: number;
  H: number;
  /** 1 = 1px at a 1080px short side */
  u: number;
  portrait: boolean;
};

export const useStage = (): Stage => {
  const { width, height } = useVideoConfig();
  return { W: width, H: height, u: Math.min(width, height) / 1080, portrait: height > width };
};
