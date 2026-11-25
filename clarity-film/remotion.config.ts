import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Config } from "@remotion/cli/config";

// Only on glibc 2.34 systems: tools/patch_compositor.py writes a patched copy of
// the compositor to bin/compositor. Elsewhere the bundled compositor is used.
const patchedCompositor = path.join(process.cwd(), "bin", "compositor");
if (fs.existsSync(path.join(patchedCompositor, "remotion"))) {
  Config.setBinariesDirectory(patchedCompositor);
}

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(94);
Config.setCodec("h264");
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
Config.setAudioBitrate("320k");
Config.setOverwriteOutput(true);
// Remotion rejects a concurrency above the machine's CPU count
Config.setConcurrency(Math.max(1, Math.min(6, os.cpus().length)));
