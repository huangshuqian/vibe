"""Compute the frame-accurate edit timeline from shots.json + music.json.

Writes src/data/timeline.json, consumed by both tools/prep_clips.py and the
Remotion composition, so cut points are computed in exactly one place.

Rules
- cut(k) = round(downbeats[k] * fps); first shot starts at 0, last ends at the
  end of the music.
- dissolve / blur of d frames is centred on the cut: the incoming shot starts
  floor(d/2) early, the outgoing shot runs ceil(d/2) late.
- dip {outFrames, inFrames}: outgoing shot fades to black and ends on the cut,
  incoming shot starts on the cut and fades up. No overlap.
- fromBlack: first shot fades up from black.
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
music = json.load(open(f"{ROOT}/src/data/music.json"))
data = json.load(open(f"{ROOT}/src/data/shots.json"))
fps = music["fps"]
total = music["durationInFrames"]
db = music["downbeats"]


def cut(bar):
    if bar is None:
        return None
    return round(db[bar] * fps)


shots = data["shots"]
cuts = []
for i, s in enumerate(shots):
    start = 0 if i == 0 else cut(s["fromBar"])
    end = total if i == len(shots) - 1 else cut(s["toBar"])
    cuts.append((start, end))

# sanity: contiguous
for i in range(1, len(shots)):
    assert cuts[i][0] == cuts[i - 1][1], f"gap/overlap between {shots[i-1]['id']} and {shots[i]['id']}"


def lead_in(tr):
    if tr["type"] in ("dissolve", "blur"):
        return tr["frames"] // 2
    return 0


def tail_out(next_tr):
    if next_tr is None:
        return 0
    if next_tr["type"] in ("dissolve", "blur"):
        return math.ceil(next_tr["frames"] / 2)
    return 0


timeline = []
for i, s in enumerate(shots):
    tr = s["transition"]
    nxt = shots[i + 1]["transition"] if i + 1 < len(shots) else None
    start_cut, end_cut = cuts[i]
    frm = start_cut - lead_in(tr)
    to = end_cut + tail_out(nxt)
    entry = {
        "id": s["id"],
        "clip": s["clip"],
        "from": frm,
        "durationInFrames": to - frm,
        "cutIn": start_cut,
        "cutOut": end_cut,
        "transitionIn": tr,
        "transitionOut": nxt if nxt is None or nxt["type"] in ("dissolve", "blur", "dip") else None,
        "srcIn": s["srcIn"],
        "rate": s["rate"],
        "srcSeconds": round((to - frm) / fps * s["rate"], 3),
    }
    timeline.append(entry)

json.dump({"fps": fps, "durationInFrames": total, "shots": timeline}, open(f"{ROOT}/src/data/timeline.json", "w"), indent=1)

print(f"{'id':4} {'clip':6} {'cutIn':>6} {'cutOut':>6} {'secIn':>7} {'len(s)':>6} {'from':>5} {'dur':>4} tr")
for e, s in zip(timeline, shots):
    print(f"{e['id']:4} {e['clip']:6} {e['cutIn']:6d} {e['cutOut']:6d} {e['cutIn']/fps:7.2f} {(e['cutOut']-e['cutIn'])/fps:6.2f} {e['from']:5d} {e['durationInFrames']:4d} {e['transitionIn']['type']}")
lens = [(e["cutOut"] - e["cutIn"]) / fps for e in timeline]
print(f"shots={len(timeline)} mean={sum(lens)/len(lens):.2f}s min={min(lens):.2f}s max={max(lens):.2f}s total={total} frames")
