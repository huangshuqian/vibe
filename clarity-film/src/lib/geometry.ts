/** SVG 几何工具。角度一律用度，0° 指向正上方，顺时针为正。 */

export type Pt = { x: number; y: number };

export const polar = (cx: number, cy: number, r: number, deg: number): Pt => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

export const f2 = (v: number) => v.toFixed(2);

/** 从正上方开始顺时针（ccw = true 时逆时针）的整圆，两段半圆弧拼成 */
export const circlePath = (cx: number, cy: number, r: number, ccw = false) => {
  const s = ccw ? 0 : 1;
  return `M ${f2(cx)} ${f2(cy - r)} A ${f2(r)} ${f2(r)} 0 1 ${s} ${f2(cx)} ${f2(cy + r)} A ${f2(r)} ${f2(r)} 0 1 ${s} ${f2(cx)} ${f2(cy - r)}`;
};

/** 从 a0 到 a1（度，顺时针）的圆弧 */
export const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) % 360 > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M ${f2(p0.x)} ${f2(p0.y)} A ${f2(r)} ${f2(r)} 0 ${large} ${sweep} ${f2(p1.x)} ${f2(p1.y)}`;
};

export const polyPath = (pts: Pt[], close = true) =>
  pts.map((p, i) => `${i ? "L" : "M"} ${f2(p.x)} ${f2(p.y)}`).join(" ") + (close ? " Z" : "");

/** n 角星：外半径 r1、内半径 r2 交替 */
export const starPts = (cx: number, cy: number, n: number, r1: number, r2: number, rot = 0): Pt[] =>
  Array.from({ length: n * 2 }, (_, i) => polar(cx, cy, i % 2 ? r2 : r1, rot + (i * 180) / n));

/** 正多边形 */
export const ngonPts = (cx: number, cy: number, n: number, r: number, rot = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => polar(cx, cy, r, rot + (i * 360) / n));

/** 绕 (cx, cy) 旋转一个点 */
export const rotatePt = (p: Pt, cx: number, cy: number, deg: number): Pt => {
  const a = (deg * Math.PI) / 180;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
};

/** 菱形星芒（四角星）路径，中心 (x, y)，长轴 l，短轴 w */
export const diamondStar = (x: number, y: number, l: number, w: number) =>
  `M ${f2(x)} ${f2(y - l)} Q ${f2(x + w * 0.18)} ${f2(y - w * 0.18)} ${f2(x + w)} ${f2(y)} ` +
  `Q ${f2(x + w * 0.18)} ${f2(y + w * 0.18)} ${f2(x)} ${f2(y + l)} ` +
  `Q ${f2(x - w * 0.18)} ${f2(y + w * 0.18)} ${f2(x - w)} ${f2(y)} ` +
  `Q ${f2(x - w * 0.18)} ${f2(y - w * 0.18)} ${f2(x)} ${f2(y - l)} Z`;
