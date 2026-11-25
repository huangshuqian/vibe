/**
 * 全片文案与视觉配置（批量替换文案只需要改这个文件）。
 * 每条语录在完整版 / 快剪版里各占哪几个小节，在 src/config/cuts.ts 里配置。
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
};

export const OPENING = {
  line: "献给每一个，在深夜里突然想通的瞬间",
  title: "清醒录",
  english: "CLARITAS · MENTIS",
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
  },
];

export const INTERACTION = {
  question: "哪一句话，刚好说中了此刻的你？",
};

export const FINALE = {
  title: "清醒录",
  english: "CLARITAS · MENTIS",
  closing: "保持清醒 · 依然热爱",
};

/** 外环 textPath 环绕小字的固定前缀 */
export const RING_MOTTO = "CLARITAS MENTIS";

const CN_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
export const eyebrowOf = (i: number, q: Quote) => `第${CN_NUM[i] ?? i + 1}则　${q.keyword}`;
export const indexLabel = (i: number) => String(i + 1).padStart(2, "0");
export const totalLabel = () => String(QUOTES.length).padStart(2, "0");
