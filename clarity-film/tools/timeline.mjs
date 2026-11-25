// Print the resolved timeline (bars → seconds → frames) straight from src/config.
//   npm run timeline
// Also checks that every segment boundary and punch lands within half a frame of a downbeat.
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = await build({
  entryPoints: [path.join(root, "src/config/timeline.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  loader: { ".json": "json" },
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
const { SEGMENTS, FPS, MUSIC, FADE_OUT, TOTAL_FRAMES } = mod;

const nearestDownbeatMs = (frame) => {
  const t = frame / FPS;
  const d = Math.min(...MUSIC.downbeats.map((x) => Math.abs(x - t)));
  return d * 1000;
};
const fmt = (f) => `${(f / FPS).toFixed(2)} s / f${f}`;
let worst = 0;
console.log("| # | 段落 | 构图 | 起点 | 金句重拍 | 终点 |");
console.log("|---|---|---|---|---|---|");
SEGMENTS.forEach((s, i) => {
  const name = s.kind === "quote" ? `${String(s.index + 1).padStart(2, "0")} ${s.quote.keyword}` : s.kind;
  const layout = s.kind === "quote" ? s.quote.layout : "";
  const punch = s.kind === "quote" ? fmt(s.punch) : "";
  // the prelude starts at frame 0 (video start), every other boundary is a downbeat
  const cuts = i === 0 ? [] : [s.from];
  if (s.kind === "quote") cuts.push(s.punch);
  cuts.forEach((f) => (worst = Math.max(worst, nearestDownbeatMs(f))));
  console.log(`| ${i} | ${name} | ${layout} | ${fmt(s.from)} | ${punch} | ${fmt(s.to)} |`);
});
console.log(`\ntotal ${TOTAL_FRAMES} frames (${(TOTAL_FRAMES / FPS).toFixed(3)} s), fade-out f${FADE_OUT.from}–f${FADE_OUT.to}`);
console.log(`worst cut / punch offset from a downbeat: ${worst.toFixed(1)} ms (half a frame = ${(500 / FPS).toFixed(1)} ms)`);
if (worst > 500 / FPS + 0.01) process.exit(1);
