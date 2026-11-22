"""Shared colour grade (FFmpeg filter graph) for all footage.

Look: desaturated night blues, lifted-but-dense blacks, soft highlight
roll-off, practical lights kept faintly warm. Per-shot values in shots.json
(sat / bright / gamma) only normalise exposure and saturation so every
source lands in the same look.

Paths can be overridden with the FFMPEG, FFPROBE and FOOTAGE_DIR environment
variables. By default ffmpeg/ffprobe come from PATH and the downloaded source
footage (tools/fetch_footage.py) lives in <project>/footage.
"""
import os
import shutil

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FFMPEG = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or "ffmpeg"
FFPROBE = os.environ.get("FFPROBE") or shutil.which("ffprobe") or "ffprobe"
STOCK = os.environ.get("FOOTAGE_DIR") or os.path.join(_ROOT, "footage")


def grade_filter(g, src_height):
    sat = g.get("sat", 0.45)
    bright = g.get("bright", 0.0)
    gamma = g.get("gamma", 1.0)
    chain = []
    chain.append("scale=1920:1080:flags=lanczos:force_original_aspect_ratio=increase,crop=1920:1080")
    if src_height < 1000:
        # gentle detail recovery for 720p sources
        chain.append("unsharp=5:5:0.35:5:5:0.0")
    chain.append(f"eq=contrast=1.04:brightness={bright}:gamma={gamma}:saturation={sat}")
    # shadows -> blue/teal, mids slightly cool, highlights near neutral (lamps stay amber)
    chain.append("colorbalance=rs=-0.07:gs=-0.015:bs=0.09:rm=-0.035:gm=-0.005:bm=0.045:rh=0.015:gh=0.01:bh=0.0")
    # filmic tone curve: lifted black point, soft shoulder
    chain.append("curves=master='0/0.025 0.18/0.14 0.5/0.47 0.82/0.82 1/0.95'")
    return ",".join(chain)
