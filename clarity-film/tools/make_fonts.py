"""Build the local font files in public/fonts (so rendering needs no network).

- Noto Serif SC variable font (weights 200-900), subset to GB2312 (6763 common
  hanzi + symbols), ASCII, CJK punctuation, full-width forms and every
  character that appears in src/config/content.ts
- Cormorant Garamond variable font (weights 300-700), Latin only

Only needed when the copy in content.ts uses a character outside GB2312:

    pip install fonttools brotli
    python tools/make_fonts.py

Source fonts are downloaded from github.com/google/fonts (SIL Open Font License).
"""
import os
import urllib.request

from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "fonts")
CACHE = os.path.join(ROOT, "fonts-src")
SOURCES = {
    "NotoSerifSC.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf",
    "CormorantGaramond.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf",
}
os.makedirs(OUT, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)


def source(name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        print("downloading", SOURCES[name])
        urllib.request.urlretrieve(SOURCES[name], path)
    return path


def gb2312():
    chars = set()
    for hi in range(0xA1, 0xF8):
        for lo in range(0xA1, 0xFF):
            try:
                chars.add(bytes([hi, lo]).decode("gb2312"))
            except UnicodeDecodeError:
                pass
    return chars


content = open(os.path.join(ROOT, "src", "config", "content.ts"), encoding="utf-8").read()
cjk = gb2312() | {c for c in content if ord(c) > 0x7F}
cjk |= {chr(c) for c in range(0x20, 0x7F)}  # ASCII
cjk |= {chr(c) for c in range(0x3000, 0x3040)}  # CJK punctuation
cjk |= {chr(c) for c in range(0xFF00, 0xFFF0)}  # full-width forms
cjk |= set("·—–…‘’“”•")


def build(src, out, chars):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.notdef_outline = True
    opts.name_IDs = ["*"]
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[ord(c) for c in chars])
    sub.subset(font)
    subset.save_font(font, out, opts)
    print(f"wrote {os.path.relpath(out, ROOT)} ({os.path.getsize(out) / 1e6:.2f} MB, {len(chars)} chars requested)")


build(source("NotoSerifSC.ttf"), os.path.join(OUT, "NotoSerifSC-GB2312.woff2"), cjk)
latin = {chr(c) for c in range(0x20, 0x7F)} | {chr(c) for c in range(0xA0, 0x180)} | set("·—–…‘’“”•")
build(source("CormorantGaramond.ttf"), os.path.join(OUT, "CormorantGaramond-Latin.woff2"), latin)
