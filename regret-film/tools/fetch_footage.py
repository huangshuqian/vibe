"""Download the source footage used in shots.json from Mixkit into footage/.

Mixkit License (free for commercial use, no attribution required):
https://mixkit.co/license/#videoFree

Tries the 1080p file first and falls back to 720p (some clips are only
offered at 720p for free). Already-downloaded clips are skipped.
"""
import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from grade import STOCK  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
shots = json.load(open(f"{ROOT}/src/data/shots.json"))["shots"]
os.makedirs(STOCK, exist_ok=True)

for s in shots:
    clip = s["clip"]
    out = os.path.join(STOCK, f"{clip}.mp4")
    if os.path.exists(out) and os.path.getsize(out) > 0:
        print(f"{s['id']} {clip}: already present")
        continue
    for res in (1080, 720):
        url = f"https://assets.mixkit.co/videos/{clip}/{clip}-{res}.mp4"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r, open(out + ".part", "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            os.replace(out + ".part", out)
            print(f"{s['id']} {clip}: {res}p")
            break
        except urllib.error.HTTPError:
            if os.path.exists(out + ".part"):
                os.remove(out + ".part")
    else:
        print(f"{s['id']} {clip}: FAILED to download", file=sys.stderr)
