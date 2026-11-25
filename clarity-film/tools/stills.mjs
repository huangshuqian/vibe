// QA: bundle once, render stills at the given bars (or frames).
//   node tools/stills.mjs [--short] [--portrait] 9.3 11.3 f:360 ...
// Numbers are music bar positions (bar k = downbeats[k]); "f:N" is a raw video frame number.
// --short renders the fast cut (ClarityShort), default is the full version (ClarityFilm).
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const portrait = args.includes("--portrait");
const short = args.includes("--short");
const id = `${short ? "ClarityShort" : "ClarityFilm"}${portrait ? "Portrait" : ""}`;
const outDir = path.join(root, "out", `stills-${short ? "short" : "full"}${portrait ? "-portrait" : ""}`);
fs.mkdirSync(outDir, { recursive: true });

// bar → video frame, using the same timeline code as the video
const compiled = await build({
  entryPoints: [path.join(root, "src/config/timeline.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  loader: { ".json": "json" },
  logLevel: "error",
});
const { TIMELINES } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const tl = TIMELINES[short ? "short" : "full"];

const frames = args
  .filter((a) => !a.startsWith("--"))
  .map((a) => (a.startsWith("f:") ? { label: a.replace(":", ""), frame: Number(a.slice(2)) } : { label: `bar${a}`, frame: tl.barFrame(Number(a)) }));

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
