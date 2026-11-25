/**
 * 全片文案与视觉配置（批量替换文案只需要改这个文件）。
 *
 * 时间全部用「小节号」表示：bar k 就是 src/data/music.json 里的 downbeats[k]
 * （118 BPM，一小节 2.034 s）。小节号由 src/config/timeline.ts 换算成秒和帧。
 *   - start  本段第一拍（上一段在这一拍切走）
 *   - punch  第 2 拍「金句定格」触发的小节（乐句重音）
 *   - end    本段结束（= 下一段的 start）
 */
import type { MoodKey } from "./palette";

export type LayoutMode = "left-editorial" | "right-editorial" | "center-split" | "vertical-accent";

export type EmblemKind =
  | "offset-orbits"
  | "tangent-rings"
  | "progressive-arcs"
  | "star-shield"
  | "crescent-gauge"
  | "mirror-circles"
  | "flame-vs-grid"
  | "corona"
  | "echo-ripples";

export type Tag = { k: string; v: string };

export type Quote = {
  mood: MoodKey;
  layout: LayoutMode;
  emblem: EmblemKind;
  /** 意象名，出现在第二个属性标签里 */
  emblemName: string;
  setup: string;
  /** 用 \n 手动换行 */
  punch: string;
  /** 需要高亮的关键词（在铺垫句或金句里出现都可以，金句时刻点亮） */
  highlight: string;
  keyword: string;
  english: string;
  tags: Tag[];
  /** center-split：拆到图腾左右两侧的两个字 */
  splitChars?: [string, string];
  /** vertical-accent：竖排关键词放在左边还是右边 */
  verticalSide?: "left" | "right";
  bars: { start: number; punch: number; end: number };
};

export const OPENING = {
  line: "献给每一个，在深夜里突然想通的瞬间",
  title: "清醒录",
  english: "CLARITAS · MENTIS",
  bars: {
    start: 0,
    /** 光点向左右拉出水平光线 */
    line: 1,
    /** 引导句逐字扫光 */
    text: 2,
    /** 光线收束，星盘轨道描边生长 */
    orbit: 4,
    /** 9 枚节点从这一小节开始按拍点亮（每拍一枚） */
    nodes: 5,
    /** 星网连线 */
    net: 6,
    /** 总标题 */
    title: 7,
    end: 8,
  },
};

export const QUOTES: Quote[] = [
  {
    mood: "lilac",
    layout: "left-editorial",
    emblem: "offset-orbits",
    emblemName: "错位双轨",
    setup: "你总是很理智",
    punch: "想跟你沟通的我，像个疯子",
    highlight: "疯子",
    keyword: "失衡",
    english: "DISSONANCE",
    tags: [
      { k: "关系", v: "错频沟通" },
      { k: "意象", v: "错位双轨" },
    ],
    bars: { start: 8, punch: 10, end: 12 },
  },
  {
    mood: "abyss",
    layout: "right-editorial",
    emblem: "tangent-rings",
    emblemName: "相切双环",
    setup: "婚姻就是用麻烦来对抗孤独",
    punch: "有的人不怕麻烦\n有的人不怕孤独",
    highlight: "对抗孤独",
    keyword: "取舍",
    english: "SOLITUDO",
    tags: [
      { k: "选择", v: "孤独与羁绊" },
      { k: "意象", v: "相切双环" },
    ],
    bars: { start: 12, punch: 14, end: 16 },
  },
  {
    mood: "jade",
    layout: "center-split",
    splitChars: ["当", "下"],
    emblem: "progressive-arcs",
    emblemName: "渐进同心弧",
    setup: "上山就上山，砍柴就砍柴，做饭就做饭",
    punch: "如果上山为了砍柴，砍柴为了做饭\n你就会很累",
    highlight: "你就会很累",
    keyword: "当下",
    english: "PRAESENS",
    tags: [
      { k: "心法", v: "停止内耗" },
      { k: "意象", v: "三层同心弧" },
    ],
    bars: { start: 16, punch: 18, end: 22 },
  },
  {
    mood: "amber",
    layout: "vertical-accent",
    verticalSide: "left",
    emblem: "star-shield",
    emblemName: "星芒盾",
    setup: "你只需要考虑自己的感受和利益",
    punch: "至于别人的感受和利益\n别人自己会争取",
    highlight: "自己会争取",
    keyword: "边界",
    english: "TERMINUS",
    tags: [
      { k: "清醒", v: "课题分离" },
      { k: "意象", v: "星芒盾" },
    ],
    bars: { start: 22, punch: 24, end: 28 },
  },
  {
    mood: "ember",
    layout: "left-editorial",
    emblem: "crescent-gauge",
    emblemName: "残月刻度仪",
    setup: "晚上好，自我介绍一下",
    punch: "我是第 57 个民族\n余额不足",
    highlight: "余额不足",
    keyword: "自嘲",
    english: "PARADOX",
    tags: [
      { k: "人间", v: "真实松弛" },
      { k: "意象", v: "残月刻度仪" },
    ],
    bars: { start: 28, punch: 30, end: 32 },
  },
  {
    mood: "lilac",
    layout: "right-editorial",
    emblem: "mirror-circles",
    emblemName: "镜像双圆",
    setup: "不必再争论谁对谁错",
    punch: "你们是对的\n但我也没错",
    highlight: "我也没错",
    keyword: "立场",
    english: "PERSPECTIVA",
    tags: [
      { k: "和解", v: "允许不同" },
      { k: "意象", v: "镜像双圆" },
    ],
    bars: { start: 32, punch: 34, end: 36 },
  },
  {
    mood: "ember",
    layout: "center-split",
    splitChars: ["炙", "热"],
    emblem: "flame-vs-grid",
    emblemName: "烈焰与方阵",
    setup: "关于亲密关系的真相",
    punch: "稳定的情绪和炙热的爱\n是无法共存的",
    highlight: "无法共存",
    keyword: "炙热",
    english: "ARDOR",
    tags: [
      { k: "悖论", v: "理性与爱" },
      { k: "意象", v: "烈焰对峙方阵" },
    ],
    bars: { start: 36, punch: 40, end: 44 },
  },
  {
    mood: "amber",
    layout: "vertical-accent",
    verticalSide: "right",
    emblem: "corona",
    emblemName: "日冕星盘",
    setup: "既然终点早已注定",
    punch: "百分百死亡率的人生\n你怕什么？",
    highlight: "你怕什么",
    keyword: "无畏",
    english: "MEMENTO · MORI",
    tags: [
      { k: "破局", v: "尽兴而活" },
      { k: "意象", v: "日冕脉冲" },
    ],
    bars: { start: 44, punch: 48, end: 51 },
  },
  {
    mood: "abyss",
    layout: "left-editorial",
    emblem: "echo-ripples",
    emblemName: "回声波纹",
    setup: "最扎心的不是文案，而是看评论的人",
    punch: "你不停地翻着评论\n只为找到那个能替你说出故事的人",
    highlight: "替你说出故事",
    keyword: "共鸣",
    english: "RESONANTIA",
    tags: [
      { k: "共情", v: "深夜同路人" },
      { k: "意象", v: "星尘回声" },
    ],
    bars: { start: 51, punch: 53, end: 56 },
  },
];

export const INTERACTION = {
  question: "哪一句话，刚好说中了此刻的你？",
  bars: {
    start: 56,
    /** 9 枚迷你圆点从这一小节开始按拍点亮 */
    dots: 57,
    end: 60,
  },
};

export const FINALE = {
  title: "清醒录",
  english: "CLARITAS · MENTIS",
  closing: "保持清醒 · 依然热爱",
  bars: { start: 60, title: 61, english: 62, closing: 63, end: 65 },
};

/** 外环 textPath 环绕小字的固定前缀 */
export const RING_MOTTO = "CLARITAS MENTIS";

const CN_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
export const eyebrowOf = (i: number, q: Quote) => `第${CN_NUM[i] ?? i + 1}则　${q.keyword}`;
export const indexLabel = (i: number) => String(i + 1).padStart(2, "0");
export const totalLabel = () => String(QUOTES.length).padStart(2, "0");

/** 所有出现在画面上的中文，用来决定要加载哪些 Noto Serif SC 字体分片 */
export const ALL_TEXT = [
  OPENING.line,
  OPENING.title,
  INTERACTION.question,
  FINALE.title,
  FINALE.closing,
  ...QUOTES.flatMap((q, i) => [
    q.setup,
    q.punch,
    q.keyword,
    eyebrowOf(i, q),
    ...(q.splitChars ?? []),
    ...q.tags.flatMap((t) => [t.k, t.v]),
  ]),
  "0123456789/·？，",
].join("");
