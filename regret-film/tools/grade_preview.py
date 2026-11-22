"""Grade one representative frame per shot and tile them into a contact sheet
so the look can be checked for consistency before processing full clips."""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
from grade import FFMPEG, FFPROBE, STOCK, grade_filter  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out", "grade_preview")
os.makedirs(OUT, exist_ok=True)
shots = json.load(open(f"{ROOT}/src/data/shots.json"))["shots"]
only = sys.argv[1:]

tiles = []
for s in shots:
    if only and s["id"] not in only:
        continue
    src = f"{STOCK}/{s['clip']}.mp4"
    h = int(subprocess.check_output([FFPROBE, "-v", "error", "-select_streams", "v", "-show_entries", "stream=height", "-of", "csv=p=0", src]).decode().strip())
    t = s["srcIn"] + 1.5 * s["rate"]
    out = f"{OUT}/{s['id']}.jpg"
    vf = grade_filter(s["grade"], h) + ",scale=480:270"
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.2f}", "-i", src, "-frames:v", "1", "-vf", vf, out], check=True)
    tiles.append((s["id"], s["clip"], out))

cols = 4
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (480 * cols, 290 * rows), (0, 0, 0))
d = ImageDraw.Draw(sheet)
for i, (sid, clip, p) in enumerate(tiles):
    x, y = (i % cols) * 480, (i // cols) * 290
    sheet.paste(Image.open(p), (x, y))
    d.text((x + 6, y + 274), f"{sid}  {clip}", fill=(255, 220, 0))
sheet.save(f"{OUT}/sheet.jpg", quality=85)
print("ok", len(tiles))
