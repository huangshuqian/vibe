#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""离线字形扫描：文案里的每个字是否都在字体文件里，以及假粗体、远程字体、中文断行问题。

用法：
  python3 check_glyphs.py --font public/<合成名>/fonts/标题.ttf --font public/<合成名>/fonts/正文.otf \\
                          src/<合成名> [更多文件或目录] [--max-line 16] [--extra "0123456789%"] [--strict]
  python3 check_glyphs.py --selftest

检查内容：
1. 缺字：所有字体都没有的字（一定会回退成系统字体）记为错误；只有部分字体没有的字记为警告，
   因为不知道哪段文字用哪个字体，需要人工确认。
2. 字重：代码里用到的 fontWeight / font-weight / <b> / <strong> 有没有对应的字体文件，
   没有时浏览器会合成假粗体或显示成相近字重。
3. 加载方式：有没有显式加载（loadFont / @font-face / FontFace），有没有远程字体。
4. 断行：手动换行（\\n）后的行首标点、行尾开括号、单字成行；超过 --max-line 个全角字符没有手动断行的行。

只扫描会显示在画面上的文字：字符串和模板字面量里含非 ASCII 字符的部分、JSX 文本、JSON 的字符串值。
注释会被跳过；纯 ASCII 的字符串默认当成代码（类名、路径、CSS 值）不检查，需要时加 --ascii-all。
数字 0-9 默认总是检查（计时器、进度数字是运行时拼出来的）。

依赖：Python 3.8+，fontTools（python3 -m pip install fonttools；.woff2 还需要 brotli）。
退出码：0 通过；1 有缺字（--strict 时任何警告也算）；2 参数或运行错误。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import unicodedata
from bisect import bisect_right

try:
    from fontTools.ttLib import TTCollection, TTFont
except ImportError:
    TTFont = None

CODE_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
DEFAULT_EXT = CODE_EXT | {".json", ".css"}
SKIP_DIRS = {"node_modules", ".git", "dist", "build", "out", ".next", ".remotion"}
NO_LINE_START = set("，。、；：？！）】》」』〉…—·％%‰℃”’,.;:?!)]}")
NO_LINE_END = set("（【《「『〈“‘([{")
WEIGHT_NAMES = {"normal": 400, "bold": 700, "bolder": 700, "lighter": 300}


def is_wide(ch: str) -> bool:
    return unicodedata.east_asian_width(ch) in ("W", "F")


def is_han(ch: str) -> bool:
    o = ord(ch)
    return 0x3400 <= o <= 0x9FFF or 0xF900 <= o <= 0xFAFF or 0x20000 <= o <= 0x3134F


# ----------------------------------------------------------------------------
# JS/TS 扫描：区分代码、字符串、模板字面量和注释
# ----------------------------------------------------------------------------

class JsScanner:
    def __init__(self, text: str):
        self.t = text
        self.n = len(text)
        self.items = []          # (位置, 'str', 内容)
        self.code = []           # (位置, 代码片段)
        self.clean = list(text)  # 注释替换成空格后的文本，用来找 fontWeight 等
        self.line_starts = [0] + [m.end() for m in re.finditer("\n", text)]

    def line(self, pos: int) -> int:
        return bisect_right(self.line_starts, pos)

    def _blank(self, a: int, b: int) -> None:
        for k in range(a, min(b, self.n)):
            if self.clean[k] != "\n":
                self.clean[k] = " "

    def _escape(self, j: int):
        """解码 j 处（反斜杠）开始的转义，返回（字符，下一个位置）。"""
        t = self.t
        if j + 1 >= self.n:
            return "", j + 1
        c = t[j + 1]
        simple = {"n": "\n", "t": "\t", "r": "", "b": "", "f": "", "v": "", "0": ""}
        if c in simple:
            return simple[c], j + 2
        if c == "\n":
            return "", j + 2
        if c == "u":
            if j + 2 < self.n and t[j + 2] == "{":
                end = t.find("}", j + 3)
                if end > 0:
                    try:
                        return chr(int(t[j + 3:end], 16)), end + 1
                    except ValueError:
                        pass
            try:
                return chr(int(t[j + 2:j + 6], 16)), j + 6
            except ValueError:
                return "u", j + 2
        if c == "x":
            try:
                return chr(int(t[j + 2:j + 4], 16)), j + 4
            except ValueError:
                return "x", j + 2
        return c, j + 2

    def scan(self):
        self.scan_code(0, False)
        return self

    def scan_code(self, i: int, stop_brace: bool) -> int:
        t, n = self.t, self.n
        depth = 0
        start = i
        while i < n:
            c = t[i]
            nxt = t[i + 1] if i + 1 < n else ""
            if c == "/" and nxt == "/":
                self.code.append((start, t[start:i]))
                j = t.find("\n", i)
                j = n if j < 0 else j
                self._blank(i, j)
                i = start = j
                continue
            if c == "/" and nxt == "*":
                self.code.append((start, t[start:i]))
                j = t.find("*/", i + 2)
                j = n if j < 0 else j + 2
                self._blank(i, j)
                i = start = j
                continue
            if c in "'\"":
                self.code.append((start, t[start:i]))
                i = start = self.scan_string(i, c)
                continue
            if c == "`":
                self.code.append((start, t[start:i]))
                i = start = self.scan_template(i)
                continue
            if stop_brace:
                if c == "{":
                    depth += 1
                elif c == "}":
                    if depth == 0:
                        self.code.append((start, t[start:i]))
                        return i + 1
                    depth -= 1
            i += 1
        self.code.append((start, t[start:i]))
        return i

    def scan_string(self, i: int, q: str) -> int:
        t, n = self.t, self.n
        j = i + 1
        buf = []
        while j < n and t[j] != q:
            if t[j] == "\\":
                ch, j = self._escape(j)
                buf.append(ch)
            elif t[j] == "\n":
                break  # 没闭合的字符串（多半是 JSX 文本里的撇号），到行尾为止
            else:
                buf.append(t[j])
                j += 1
        self.items.append((i, "str", "".join(buf)))
        return j + 1

    def scan_template(self, i: int) -> int:
        t, n = self.t, self.n
        j = i + 1
        seg_pos = j
        buf = []
        while j < n:
            c = t[j]
            if c == "\\":
                ch, j = self._escape(j)
                buf.append(ch)
                continue
            if c == "`":
                self.items.append((seg_pos, "str", "".join(buf)))
                return j + 1
            if c == "$" and j + 1 < n and t[j + 1] == "{":
                self.items.append((seg_pos, "str", "".join(buf)))
                buf = []
                j = self.scan_code(j + 2, True)
                seg_pos = j
                continue
            buf.append(c)
            j += 1
        self.items.append((seg_pos, "str", "".join(buf)))
        return j


JSX_TEXT_RE = re.compile(r">([^<>{}]*[A-Za-z0-9\u0080-\uffff][^<>{}]*)<")


def extract(path: str):
    """返回（文字条目列表，去掉注释后的文本，行号函数）。文字条目：(行号, 类型, 内容)。"""
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        text = fh.read()
    ext = os.path.splitext(path)[1].lower()
    if ext == ".json":
        items = []
        try:
            data = json.loads(text)
        except ValueError:
            return [], text, lambda pos: 1

        def walk(o):
            if isinstance(o, str):
                items.append((0, "json", o))
            elif isinstance(o, dict):
                for v in o.values():
                    walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)
        walk(data)
        located = []
        for _, kind, s in items:
            key = json.dumps(s, ensure_ascii=False)[1:-1][:20]
            pos = text.find(key) if key else -1
            located.append((text.count("\n", 0, pos) + 1 if pos >= 0 else 1, kind, s))
        return located, text, lambda pos: text.count("\n", 0, pos) + 1
    if ext == ".css":
        stripped = re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), text, flags=re.S)
        return [], stripped, lambda pos: text.count("\n", 0, pos) + 1
    sc = JsScanner(text).scan()
    out = [(sc.line(pos), kind, s) for pos, kind, s in sc.items]
    for pos, chunk in sc.code:
        for m in JSX_TEXT_RE.finditer(chunk):
            seg = m.group(1)
            if seg.strip():
                out.append((sc.line(pos + m.start(1)), "jsx", seg))
        for m in re.finditer(r"[^\x00-\x7f]+", chunk):
            out.append((sc.line(pos + m.start()), "jsx", m.group(0)))
    return out, "".join(sc.clean), sc.line


def iter_files(paths: list, exts: set):
    for p in paths:
        if os.path.isfile(p):
            yield p
        elif os.path.isdir(p):
            for root, dirs, files in os.walk(p):
                dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
                for f in sorted(files):
                    if os.path.splitext(f)[1].lower() in exts:
                        yield os.path.join(root, f)
        else:
            raise FileNotFoundError(p)


# ----------------------------------------------------------------------------
# 字体
# ----------------------------------------------------------------------------

def load_fonts(paths: list) -> list:
    fonts = []
    for p in paths:
        if not os.path.isfile(p):
            raise FileNotFoundError(p)
        faces = TTCollection(p, lazy=True).fonts if p.lower().endswith((".ttc", ".otc")) else [TTFont(p, lazy=True)]
        for f in faces:
            name = f["name"]
            family = name.getDebugName(16) or name.getDebugName(1) or os.path.basename(p)
            style = name.getDebugName(17) or name.getDebugName(2) or ""
            weight = f["OS/2"].usWeightClass if "OS/2" in f else 400
            wght = None
            if "fvar" in f:
                for axis in f["fvar"].axes:
                    if axis.axisTag == "wght":
                        wght = (axis.minValue, axis.maxValue)
            fonts.append({"path": p, "family": family, "style": style, "weight": weight, "wght": wght,
                          "cmap": set((f.getBestCmap() or {}).keys())})
    return fonts


def weight_available(w: int, fonts: list) -> bool:
    for f in fonts:
        if f["wght"] and f["wght"][0] <= w <= f["wght"][1]:
            return True
        if not f["wght"] and f["weight"] == w:
            return True
    return False


# ----------------------------------------------------------------------------
# 主流程
# ----------------------------------------------------------------------------

WEIGHT_RE = re.compile(r"font(?:Weight|-weight)\s*[:=]\s*\{?\s*['\"]?(\d{3}|bold|bolder|normal|lighter)\b")
BOLD_TAG_RE = re.compile(r"<(b|strong)[\s>]")
LOAD_RE = re.compile(r"\bloadFont\s*\(|@font-face|\bFontFace\s*\(")
REMOTE_RE = re.compile(r"@remotion/google-fonts|fonts\.googleapis\.com|fonts\.gstatic\.com|"
                       r"https?://[^\s'\"`)]+\.(?:woff2?|ttf|otf)\b")


def run_check(font_paths: list, src_paths: list, exts: set, extra: str, max_line: int,
              ascii_all: bool, strict: bool, out=print) -> int:
    fonts = load_fonts(font_paths)
    files = list(iter_files(src_paths, exts))
    texts = []        # (文件, 行, 类型, 内容)
    used_weights = {}  # 字重 -> 第一次出现的位置
    loads, remotes = [], []
    for full in files:
        items, clean, line_of = extract(full)
        path = os.path.relpath(full) if not os.path.relpath(full).startswith("..") else full
        for ln, kind, s in items:
            texts.append((path, ln, kind, s))
        for m in WEIGHT_RE.finditer(clean):
            v = m.group(1)
            w = int(v) if v.isdigit() else WEIGHT_NAMES[v]
            used_weights.setdefault(w, f"{path}:{line_of(m.start())}")
        for m in BOLD_TAG_RE.finditer(clean):
            used_weights.setdefault(700, f"{path}:{line_of(m.start())}（<{m.group(1)}>）")
        loads += [f"{path}:{line_of(m.start())}" for m in LOAD_RE.finditer(clean)]
        remotes += [f"{path}:{line_of(m.start())}：{m.group(0)}" for m in REMOTE_RE.finditer(clean)]

    chars = {}
    for ch in extra:
        chars.setdefault(ch, "（--extra）")
    rendered = []
    for path, ln, kind, s in texts:
        if kind == "jsx" or ascii_all or any(ord(c) > 127 for c in s):
            rendered.append((path, ln, s))
            for ch in s:
                if not ch.isspace() and unicodedata.category(ch)[0] != "C":
                    chars.setdefault(ch, f"{path}:{ln}")

    errors, warnings = [], []
    out("# 离线字形扫描")
    out("")
    out("| 字体文件 | 字族 | 样式 | 字重 | 字符数 |")
    out("|---|---|---|---|---|")
    for f in fonts:
        w = f"{f['wght'][0]:.0f}–{f['wght'][1]:.0f}（可变）" if f["wght"] else str(f["weight"])
        out(f"| {os.path.basename(f['path'])} | {f['family']} | {f['style']} | {w} | {len(f['cmap'])} |")
    out("")
    han = sum(1 for c in chars if is_han(c))
    out(f"扫描 {len(files)} 个文件，{len(rendered)} 段文字，{len(chars)} 个不同字符（其中汉字 {han} 个）。")
    out("")
    if han == 0:
        warnings.append("没有扫到任何汉字：扫描路径对吗？文案放在别的目录或数据文件里的话，把它们也加进来。")

    missing_all = [c for c in chars if all(ord(c) not in f["cmap"] for f in fonts)]
    if missing_all:
        by_loc = {}
        for c in missing_all:
            by_loc.setdefault(chars[c], []).append(c)
        groups = [f"{''.join(cs)}（{loc}）" for loc, cs in by_loc.items()]
        listed = "；".join(groups[:20]) + (f"；另有 {len(groups) - 20} 处" if len(groups) > 20 else "")
        errors.append(f"所有字体都缺这 {len(missing_all)} 个字，渲染时一定会回退成系统字体："
                      f"{listed}（括号里是第一次出现的位置）")
    for f in fonts:
        miss = [c for c in chars if ord(c) not in f["cmap"] and c not in missing_all]
        if miss and len(fonts) > 1:
            listed = "".join(miss[:30]) + (f" 等 {len(miss)} 个" if len(miss) > 30 else "")
            warnings.append(f"{os.path.basename(f['path'])}（{f['family']}）缺：{listed}。"
                            "如果这些字会用这个字体显示，就会回退；确认它们只出现在别的字体负责的文字里。")

    for w, where in sorted(used_weights.items()):
        if not weight_available(w, fonts):
            have = sorted({f["weight"] for f in fonts if not f["wght"]})
            what = "合成假粗体" if w >= 600 and all(h < 600 for h in have) else "用相近字重显示"
            warnings.append(f"代码里用到字重 {w}（{where}），但字体文件里没有这个字重（现有 {have or '可变字体'}）："
                            f"浏览器会{what}。补上对应字重的文件，或者改用已有字重。")

    if not loads:
        warnings.append("没找到显式加载字体的代码（loadFont / @font-face / FontFace）。"
                        "如果加载写在别的文件，把那个文件也加进扫描路径。")
    for r in remotes:
        warnings.append(f"远程字体（渲染依赖网络，离线或网络慢时会回退）：{r}")

    for path, ln, s in rendered:
        lines = s.split("\n")
        where = f"{path}:{ln}"
        if len(lines) > 1:
            for k, line in enumerate(lines):
                st = line.strip()
                if not st:
                    continue
                if k > 0 and st[0] in NO_LINE_START:
                    warnings.append(f"行首标点「{st[0]}」：{where} 「{st[:12]}」")
                if k < len(lines) - 1 and st[-1] in NO_LINE_END:
                    warnings.append(f"行尾是开括号或引号「{st[-1]}」：{where} 「{st[-12:]}」")
                if sum(1 for c in st if is_han(c)) == 1 and len([c for c in st if not c.isspace()]) <= 2:
                    warnings.append(f"单字成行「{st}」：{where}")
        else:
            st = s.strip()
            if st and st[0] in NO_LINE_START and any(is_han(c) for c in st):
                warnings.append(f"文字以标点「{st[0]}」开头（拆分成多行时可能拆错了位置）：{where} 「{st[:12]}」")
        for line in lines:
            wide = sum(1 for c in line if is_wide(c))
            if wide > max_line:
                warnings.append(f"一行 {wide} 个全角字符，超过 {max_line}，会被自动换行，建议手动断行：{where} "
                                f"「{line.strip()[:16]}…」")

    for title, items in (("错误", errors), ("警告", warnings)):
        if items:
            out(f"## {title}（{len(items)}）")
            out("")
            for it in items:
                out(f"- {it}")
            out("")
    if not errors and not warnings:
        out("全部通过。")
    if errors or (strict and warnings):
        return 1
    return 0


def selftest() -> int:
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    def build(path, family, style, weight, chars):
        names = [".notdef"] + [f"uni{ord(c):04X}" for c in chars]
        fb = FontBuilder(1000, isTTF=True)
        fb.setupGlyphOrder(names)
        fb.setupCharacterMap({ord(c): f"uni{ord(c):04X}" for c in chars})
        glyphs = {}
        for nm in names:
            pen = TTGlyphPen(None)
            pen.moveTo((50, 0))
            pen.lineTo((50, 700))
            pen.lineTo((550, 700))
            pen.closePath()
            glyphs[nm] = pen.glyph()
        fb.setupGlyf(glyphs)
        fb.setupHorizontalMetrics({nm: (600, 50) for nm in names})
        fb.setupHorizontalHeader(ascent=800, descent=-200)
        fb.setupNameTable({"familyName": family, "styleName": style})
        fb.setupOS2(usWeightClass=weight)
        fb.setupPost()
        fb.save(path)

    body_chars = "顺应大脑是一种能力不对抗它而，。0123456789"
    with tempfile.TemporaryDirectory() as d:
        body = os.path.join(d, "Body-Regular.ttf")
        title = os.path.join(d, "Title-Bold.ttf")
        build(body, "TestBody", "Regular", 400, body_chars)
        build(title, "TestTitle", "Bold", 700, "顺应大脑")
        src = os.path.join(d, "src")
        os.makedirs(src)
        with open(os.path.join(src, "Scene.tsx"), "w", encoding="utf-8") as fh:
            fh.write(
                "import {loadFont} from '@remotion/fonts';\n"
                "loadFont({family: 'Body', url: staticFile('fonts/Body-Regular.ttf')});\n"
                "// 注释里的字不应该被检查：龘\n"
                "/* 块注释也一样：靐 */\n"
                "export const Scene = ({n}: {n: number}) => (\n"
                "  <div style={{fontWeight: 700, fontFamily: 'Title'}}>顺应大脑</div>\n"
                ");\n"
                "const a = '迷宫破局';\n"
                "const b = `第${n}步`;\n"
                "const c = '顺应大\\n脑';\n"
                "const d = '，而不是对抗它';\n"
                "const e = '这是一句明显超过十六个字的长文案没有手动断行会自动换行';\n"
                "const f = {fontWeight: '500'};\n"
                "const g = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC';\n"
            )
        with open(os.path.join(src, "copy.json"), "w", encoding="utf-8") as fh:
            json.dump({"lines": ["顺应它", "龘"]}, fh, ensure_ascii=False)
        logs = []
        code = run_check([body, title], [src], DEFAULT_EXT, "0123456789", 16, False, False, out=logs.append)
        text = "\n".join(logs)

    checks = [
        ("缺字检测到 迷宫破局", "迷宫破局（" in text),
        ("模板字面量里的 第、步", "第步（" in text),
        ("JSON 里的字也检查（龘 定位到 copy.json）", "龘（" in text and "copy.json" in text.split("龘（")[1][:120]),
        ("块注释里的 靐 不检查", "靐" not in text),
        ("字重 500 没有对应文件", "字重 500" in text),
        ("字重 700 有对应文件，不报", "字重 700" not in text),
        ("单字成行", "单字成行「脑」" in text),
        ("以标点开头", "文字以标点「，」开头" in text),
        ("超长行", "会被自动换行" in text),
        ("远程字体", "fonts.googleapis.com" in text),
        ("找到显式加载", "没找到显式加载" not in text),
        ("有缺字时退出码为 1", code == 1),
    ]
    for name, ok in checks:
        print(f"{'✓' if ok else '✗'} {name}")
    passed = sum(ok for _, ok in checks)
    print(f"\n{passed}/{len(checks)} 项通过")
    if passed != len(checks):
        print("\n--- 扫描输出 ---\n" + text)
    return 0 if passed == len(checks) else 1


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="离线字形扫描（缺字、假粗体、远程字体、中文断行）")
    ap.add_argument("paths", nargs="*", help="要扫描的文件或目录（合成目录、文案数据文件等）")
    ap.add_argument("--font", action="append", default=[], help="字体文件（ttf/otf/ttc/woff/woff2），可重复")
    ap.add_argument("--ext", default=",".join(sorted(DEFAULT_EXT)), help="要扫描的扩展名，逗号分隔")
    ap.add_argument("--extra", default="0123456789", help="额外必须有字形的字符（默认 0-9，计时器和进度数字用）")
    ap.add_argument("--max-line", type=int, default=16, help="一行最多几个全角字符不手动断行（默认 16）")
    ap.add_argument("--ascii-all", action="store_true", help="纯 ASCII 字符串也当成画面文字检查")
    ap.add_argument("--strict", action="store_true", help="有任何警告也返回 1")
    ap.add_argument("--selftest", action="store_true", help="用临时生成的字体和代码验算本脚本")
    args = ap.parse_args(argv)
    if TTFont is None:
        print("错误：缺少 fontTools，请先运行：python3 -m pip install fonttools", file=sys.stderr)
        return 2
    if args.selftest:
        return selftest()
    if not args.font or not args.paths:
        ap.error("需要至少一个 --font 和一个扫描路径")
    exts = {e if e.startswith(".") else "." + e for e in args.ext.split(",") if e}
    try:
        return run_check(args.font, args.paths, exts, args.extra, args.max_line, args.ascii_all, args.strict)
    except FileNotFoundError as e:
        print(f"错误：找不到 {e}", file=sys.stderr)
        return 2
    except Exception as e:  # 字体文件损坏、woff2 缺 brotli 等
        print(f"错误：{type(e).__name__}: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
