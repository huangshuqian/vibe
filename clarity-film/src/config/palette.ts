/** 情绪配色系统：5 套暗黑霓虹主色 + 全片统一的暖香槟金。 */

export const MOOD = {
  /** 青翠绿 */
  jade: "#3CE6B0",
  /** 赤焰红 */
  ember: "#FF5B79",
  /** 琥珀暖金 */
  amber: "#F0B94D",
  /** 冷光银紫 */
  lilac: "#B8A8FF",
  /** 深海湛蓝 */
  abyss: "#3BA4FF",
} as const;

export type MoodKey = keyof typeof MOOD;

/** 暖香槟金：星盘外环与点睛色 */
export const GOLD = "#E6C97A";
/** 极深暗黑底色 */
export const BG = "#04050A";
/** 正文米白 */
export const INK = "#EEE8DA";
/** 冷峻方阵（第 7 条意象）用的冷银 */
export const COLD = "#B9CBEA";
