"""Trim, retime, grade and encode every shot's source clip into public/clips/<id>.mp4.

Reads src/data/timeline.json (run build_timeline.py first). Each output clip
starts exactly at the shot's first frame (Sequence frame 0) and is at least as
long as the shot, so Remotion plays it with playbackRate=1 and no offset.
"""
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from grade import FFMPEG, FFPROBE, STOCK, grade_filter  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = f"{ROOT}/public/clips"
os.makedirs(OUT, exist_ok=True)
tl = json.load(open(f"{ROOT}/src/data/timeline.json"))
shots = {s["id"]: s for s in json.load(open(f"{ROOT}/src/data/shots.json"))["shots"]}
only = set(sys.argv[1:])
MARGIN = 0.4  # seconds of extra source at the tail


def probe(src):
    out = subprocess.check_output([FFPROBE, "-v", "error", "-select_streams", "v", "-show_entries",
                                   "stream=height:format=duration", "-of", "json", src]).decode()
    j = json.loads(out)
    return int(j["streams"][0]["height"]), float(j["format"]["duration"])


def job(e):
    s = shots[e["id"]]
    src = f"{STOCK}/{e['clip']}.mp4"
    h, dur = probe(src)
    need = e["srcSeconds"] + MARGIN * e["rate"]
    if e["srcIn"] + need > dur:
        return f"{e['id']}: NOT ENOUGH SOURCE ({e['srcIn']}+{need:.2f} > {dur:.2f})"
    out = f"{OUT}/{e['id']}.mp4"
    vf = f"setpts=(PTS-STARTPTS)/{e['rate']},fps=30," + grade_filter(s["grade"], h) + ",format=yuv420p"
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{e['srcIn']:.3f}", "-t", f"{need:.3f}", "-i", src,
           "-vf", vf, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-g", "15",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
    subprocess.run(cmd, check=True)
    _, odur = probe(out)
    ok = odur * 30 >= e["durationInFrames"]
    return f"{e['id']}: {odur:.2f}s for {e['durationInFrames']/30:.2f}s shot {'OK' if ok else 'TOO SHORT'}"


todo = [e for e in tl["shots"] if not only or e["id"] in only]
with ThreadPoolExecutor(max_workers=3) as ex:
    for r in ex.map(job, todo):
        print(r, flush=True)
