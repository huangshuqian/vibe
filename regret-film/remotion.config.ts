import fs from "node:fs";
import path from "node:path";
import { Config } from "@remotion/cli/config";

// Only on glibc 2.34 systems: tools/patch_compositor.py writes a patched copy of
// the compositor to bin/compositor. Elsewhere the bundled compositor is used.
const patchedCompositor = path.join(process.cwd(), "bin", "compositor");
if (fs.existsSync(path.join(patchedCompositor, "remotion"))) {
  Config.setBinariesDirectory(patchedCompositor);
}

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
Config.setAudioBitrate("320k");
Config.setOverwriteOutput(true);
// 33 x 1080p clips: without a cap the compositor's frame cache grew to 12 GB
// and was OOM-killed mid-render.
Config.setOffthreadVideoCacheSizeInBytes(1536 * 1024 * 1024);
Config.setConcurrency(6);
