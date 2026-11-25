/**
 * 字体：中文 Noto Serif SC（思源宋体），英文 Cormorant Garamond。
 *
 * 两个都是本地的可变字体（public/fonts，tools/make_fonts.py 生成），渲染时不需要联网：
 * - NotoSerifSC-GB2312.woff2：字重 200–900，覆盖 GB2312 的 6763 个常用汉字、
 *   中英文标点，以及 content.ts 里出现的所有字
 * - CormorantGaramond-Latin.woff2：字重 300–700，拉丁字母
 *
 * 如果替换后的文案用到 GB2312 以外的生僻字，重新运行 python tools/make_fonts.py。
 * 字体缺字时会回退到系统宋体，不会报错。
 */
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

const SERIF_SC = "Noto Serif SC Local";
const SERIF_LATIN = "Cormorant Garamond Local";

// loadFont 内部会 delayRender，直到字体可用才开始截帧
loadFont({ family: SERIF_SC, url: staticFile("fonts/NotoSerifSC-GB2312.woff2"), weight: "200 900", format: "woff2" });
loadFont({ family: SERIF_LATIN, url: staticFile("fonts/CormorantGaramond-Latin.woff2"), weight: "300 700", format: "woff2" });

/** 中文：思源宋体优先，再回退到系统宋体 */
export const FONT_CN = `"${SERIF_SC}", "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif`;
/** 英文 / 拉丁文副标 */
export const FONT_EN = `"${SERIF_LATIN}", "Cormorant Garamond", "Times New Roman", serif`;
