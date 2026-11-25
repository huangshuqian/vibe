/**
 * 字体：中文 Noto Serif SC（思源宋体），英文 Cormorant Garamond。
 *
 * Google Fonts 把 Noto Serif SC 切成约 100 个 unicode-range 分片。这里只加载
 * 覆盖 content.ts 里实际出现的字的分片，所以替换文案后会自动加载新字所在的分片，
 * 不用手动维护子集。
 */
import { getInfo as getSerifScInfo, loadFont as loadSerifSc } from "@remotion/google-fonts/NotoSerifSC";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";
import { ALL_TEXT } from "../config/content";

type SerifScSubset = NonNullable<NonNullable<Parameters<typeof loadSerifSc>[1]>["subsets"]>[number];

const parseRanges = (ranges: string): [number, number][] =>
  ranges.split(",").map((part) => {
    const [a, b] = part.trim().replace(/^U\+/i, "").split("-");
    return [parseInt(a, 16), parseInt(b ?? a, 16)];
  });

const codepoints = [...new Set([...ALL_TEXT].map((c) => c.codePointAt(0) ?? 0))];

const neededSubsets = Object.entries(getSerifScInfo().unicodeRanges)
  .filter(([, ranges]) => parseRanges(ranges).some(([a, b]) => codepoints.some((c) => c >= a && c <= b)))
  .map(([key]) => key as SerifScSubset);

export const SERIF_SC = loadSerifSc("normal", {
  weights: ["300", "400", "600", "900"],
  subsets: neededSubsets,
  // 4 个字重 × 实际用到的分片（当前文案约 23 个），已经是按需加载
  ignoreTooManyRequestsWarning: true,
}).fontFamily;

export const SERIF_LATIN = loadCormorant("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
}).fontFamily;

/** 中文：思源宋体优先，再回退到系统宋体 */
export const FONT_CN = `"${SERIF_SC}", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif`;
/** 英文 / 拉丁文副标 */
export const FONT_EN = `"${SERIF_LATIN}", "Cormorant", "Times New Roman", serif`;
