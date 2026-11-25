// Print the resolved timeline of each cut (bars → seconds → frames) straight from src/config.
//   npm run timeline            both cuts
//   npm run timeline -- short   one cut
//   node tools/timeline.mjs --json   machine-readable (used by tools/qc.py)
// Checks that every cut, punch and accent lands within half a frame of a beat
// (whole bars: of a downbeat).
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
  logLevel: "error",
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
const { TIMELINES, FPS, MUSIC } = mod;

const args = process.argv.slice(2);
const json = args.includes("--json");
const ids = args.filter((a) => !a.startsWith("--"));
const cuts = (ids.length ? ids : Object.keys(TIMELINES)).map((id) => [id, TIMELINES[id]]);

const nearestMs = (videoFrame, tl, onDownbeat) => {
  const t = (videoFrame + tl.musicStartFrame) / FPS;
  const grid = onDownbeat ? MUSIC.downbeats : MUSIC.beats;
  return Math.min(...grid.map((x) => Math.abs(x - t))) * 1000;
};

if (json) {
  const data = Object.fromEntries(
    cuts.map(([id, tl]) => [
      id,
      {
        fps: FPS,
        totalFrames: tl.totalFrames,
        musicStartFrame: tl.musicStartFrame,
        musicStartSec: tl.musicStartFrame / FPS,
        fadeOut: tl.fadeOut,
        segments: tl.segments.map((s) => ({ kind: s.kind, index: s.index ?? null, from: s.from, to: s.to })),
      },
    ]),
  );
  console.log(JSON.stringify(data));
  process.exit(0);
}

let failed = false;
for (const [id, tl] of cuts) {
  const { cut } = tl;
  const fmt = (f) => `${(f / FPS).toFixed(2)} s / f${f}`;
  const bars = [cut.opening.end, ...cut.quotes.flatMap((q) => [q.start, q.punch, q.accent ?? q.punch]), cut.interaction.start, cut.finale.start];
  let worst = 0;
  for (const bar of bars) {
    worst = Math.max(worst, nearestMs(tl.barFrame(bar), tl, Number.isInteger(bar)));
  }
  const startSec = tl.musicStartFrame / FPS;
  console.log(`\n## ${id}  (music ${startSec.toFixed(2)}–${(startSec + tl.totalFrames / FPS).toFixed(2)} s, ${tl.totalFrames} frames = ${(tl.totalFrames / FPS).toFixed(2)} s)\n`);
  console.log("| # | 段落 | 构图 | 起点 | 金句 | 高亮 | 终点 |");
  console.log("|---|---|---|---|---|---|---|");
  tl.segments.forEach((s, i) => {
    const name = s.kind === "quote" ? `${String(s.index + 1).padStart(2, "0")} ${s.quote.keyword}` : s.kind;
    const layout = s.kind === "quote" ? s.quote.layout : "";
    const punch = s.kind === "quote" ? fmt(s.punch) : "";
    const accent = s.kind === "quote" && s.accent !== s.punch ? fmt(s.accent) : "";
    console.log(`| ${i} | ${name} | ${layout} | ${fmt(s.from)} | ${punch} | ${accent} | ${fmt(s.to)} |`);
  });
  console.log(`\nfade-out f${tl.fadeOut.from}–f${tl.fadeOut.to} (${(tl.fadeOut.from / FPS).toFixed(2)}–${(tl.fadeOut.to / FPS).toFixed(2)} s)`);
  console.log(`worst cut / punch / accent offset from the beat grid: ${worst.toFixed(1)} ms (half a frame = ${(500 / FPS).toFixed(1)} ms)`);
  if (worst > 500 / FPS + 0.01) failed = true;
}
if (failed) process.exit(1);
