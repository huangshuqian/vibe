// QA: bundle once, render stills at the given bars (or frames) and an optional contact sheet.
//   node tools/stills.mjs [--portrait] 9.3 11.3 f:360 ...
// Numbers are bar positions (bar k = downbeats[k]); "f:N" is a raw frame number.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const music = JSON.parse(fs.readFileSync(path.join(root, "src/data/music.json"), "utf8"));
const args = process.argv.slice(2);
const portrait = args.includes("--portrait");
const id = portrait ? "ClarityFilmPortrait" : "ClarityFilm";
const outDir = path.join(root, "out", portrait ? "stills-portrait" : "stills");
fs.mkdirSync(outDir, { recursive: true });

const barSec = (bar) => {
  const d = music.downbeats;
  const i = Math.min(Math.floor(bar), d.length - 2);
  return d[i] + (bar - i) * (d[i + 1] - d[i]);
};
const frames = args
  .filter((a) => !a.startsWith("--"))
  .map((a) => (a.startsWith("f:") ? { label: a.replace(":", ""), frame: Number(a.slice(2)) } : { label: `bar${a}`, frame: Math.round(barSec(Number(a)) * music.fps) }));

const patched = path.join(root, "bin", "compositor");
const binariesDirectory = fs.existsSync(path.join(patched, "remotion")) ? patched : null;
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts") });
const composition = await selectComposition({ serveUrl, id, binariesDirectory });
for (const { label, frame } of frames) {
  const output = path.join(outDir, `${label}_f${frame}.jpg`);
  await renderStill({
    serveUrl,
    composition,
    frame,
    output,
    imageFormat: "jpeg",
    jpegQuality: 88,
    binariesDirectory,
    // BROWSER_LOG=1 forwards console.log from the page (debugging)
    onBrowserLog: (log) => process.env.BROWSER_LOG && console.log("[browser]", log.text),
  });
  console.log("wrote", path.relative(root, output));
}
