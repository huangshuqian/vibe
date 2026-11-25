/**
 * 两个版本的乐段与小节分配。
 *
 * 时间全部用「小节号」表示：bar k 就是 src/data/music.json 里的 downbeats[k]
 * （118 BPM，一小节 2.034 s，一拍 0.508 s）。小数表示拍：9.25 = 第 9 小节第 2 拍。
 * 小节号由 src/config/timeline.ts 换算成视频里的帧。
 *
 * 每条语录：
 *   - start   本段第一拍（上一段在这一拍切走）
 *   - punch   第 2 拍「金句定格」：金句浮现、图腾点亮
 *   - accent  可选，关键词高亮 / 图腾高光 / 拆字填充的时刻，默认等于 punch
 *   - end     本段结束（= 下一段的 start）
 */

export type QuoteBars = { start: number; punch: number; accent?: number; end: number };

export type Cut = {
  id: "full" | "short";
  /** 音乐从第几小节开始（视频第 0 帧），null = 从音乐开头 */
  startBar: number | null;
  /**
   * 画面里固定帧数的动画（逐字浮现、入场、出场等）统一乘以这个系数。
   * 完整版 1；快剪版每条语录只有 2–3 小节，用 0.55 让文字更快到位
   */
  pace: number;
  /** 结尾音乐与画面同步淡出的秒数 */
  fadeSec: number;
  opening: {
    start: number;
    /** 中心暖金光点亮起 */
    ignite: number;
    /** 光点向左右拉出水平光线 */
    line: number;
    /** 引导句逐字扫光 */
    text: number;
    /** 引导句淡出 */
    textOut: number;
    /** 光线收束，星盘轨道描边生长 */
    orbit: number;
    /** 9 枚节点从这里开始依次点亮 */
    nodes: number;
    /** 相邻两枚节点之间隔几拍（1 = 每拍一枚，0.25 = 每个十六分音符一枚） */
    nodeStepBeats: number;
    /** 星网连线 */
    net: number;
    /** 总标题 */
    title: number;
    end: number;
  };
  /** 与 content.ts 的 QUOTES 一一对应 */
  quotes: QuoteBars[];
  interaction: { start: number; dots: number; dotStepBeats: number; end: number };
  finale: { start: number; title: number; english: number; closing: number; end: number };
};

/**
 * 完整版：整首有效音乐（0–132.3 s，65 小节）。
 * 前奏做序幕，两次 drop、breakdown 各放几条语录，第 55 小节低音空拍后进互动屏。
 */
export const FULL: Cut = {
  id: "full",
  startBar: null,
  pace: 1,
  fadeSec: 2.3,
  opening: { start: 0, ignite: 0.5, line: 1, text: 2, textOut: 4, orbit: 4, nodes: 5, nodeStepBeats: 1, net: 6, title: 7, end: 8 },
  quotes: [
    { start: 8, punch: 10, end: 12 },
    { start: 12, punch: 14, end: 16 },
    { start: 16, punch: 18, end: 22 },
    { start: 22, punch: 24, end: 28 },
    { start: 28, punch: 30, end: 32 },
    { start: 32, punch: 34, end: 36 },
    { start: 36, punch: 40, end: 44 },
    { start: 44, punch: 48, end: 51 },
    { start: 51, punch: 53, end: 56 },
  ],
  interaction: { start: 56, dots: 57, dotStepBeats: 1, end: 60 },
  finale: { start: 60, title: 61, english: 62, closing: 63, end: 65 },
};

/**
 * 快剪版：第 8–33 小节（原曲 16.3–67.2 s，视频 50.9 s）。
 *   bar 8    第一次铺垫开始（音量整体抬升 7 dB）：序幕 2 小节
 *   bar 10   第 1 条，之后每条 2 小节（铺垫 1 小节 + 金句 1 小节）
 *   bar 16   第一次 drop 砸入：落在第 3 条金句的第 2 小节，「你就会很累」在这一拍高亮
 *   bar 23   低音空一小节：第 7 条铺垫；bar 24 低音重新进入：第 7 条金句
 *   bar 30   全曲最响的一小节：互动屏，9 枚圆点按十六分音符点亮
 *   bar 31   低音撤出：终幕标题
 *   bar 32   breakdown（全曲最安静）：收尾短句，音乐与画面 2 秒淡出到第 33 小节
 * 两条最长的（第 3、9 条，各 38 个字）给 3 小节，金句各占 2 小节。
 */
export const SHORT: Cut = {
  id: "short",
  startBar: 8,
  pace: 0.55,
  fadeSec: 2.0,
  opening: { start: 8, ignite: 8, line: 8, text: 8, textOut: 9.25, orbit: 9, nodes: 9, nodeStepBeats: 0.25, net: 9.25, title: 9.5, end: 10 },
  quotes: [
    { start: 10, punch: 11, end: 12 },
    { start: 12, punch: 13, end: 14 },
    { start: 14, punch: 15, accent: 16, end: 17 },
    { start: 17, punch: 18, end: 19 },
    { start: 19, punch: 20, end: 21 },
    { start: 21, punch: 22, end: 23 },
    { start: 23, punch: 24, end: 25 },
    { start: 25, punch: 26, end: 27 },
    { start: 27, punch: 28, end: 30 },
  ],
  interaction: { start: 30, dots: 30.25, dotStepBeats: 0.25, end: 31 },
  finale: { start: 31, title: 31, english: 31.25, closing: 31.5, end: 33 },
};

export const CUTS = { full: FULL, short: SHORT } as const;
export type CutId = keyof typeof CUTS;
