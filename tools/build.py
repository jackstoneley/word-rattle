#!/usr/bin/env python3
"""Build Stoneley Games for the website (and as the input for the Android app).

  python3 tools/build.py          build, version the offline cache, and syntax-check every page

What it does:
  1. Word Rattle: games/word-rattle/src/template.html + words.txt + common.txt
     -> games/word-rattle/index.html (the word list is embedded so the game works offline).
  2. sw.js: stamps a VERSION from a hash of every page, so phones pick up changes.
  3. Checks the JavaScript in every page parses (needs `node` on the PATH; skipped if missing).
"""
import hashlib, pathlib, re, shutil, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
WR = ROOT / "games" / "word-rattle"
def pages():
    return [ROOT / "index.html", ROOT / "shell.js", *sorted((ROOT / "games").glob("*/index.html"))]


def build_word_rattle():
    src = WR / "src"
    tpl = (src / "template.html").read_text(encoding="utf-8")
    if tpl.count("__WORDS__") != 1:
        sys.exit("template.html must contain __WORDS__ exactly once")
    words = [w for w in (src / "words.txt").read_text(encoding="utf-8").split("\n") if w]
    common = set((src / "common.txt").read_text(encoding="utf-8").split("\n"))
    data = "\n".join(("*" + w if w in common else w) for w in words)
    (WR / "index.html").write_text(tpl.replace("__WORDS__", data), encoding="utf-8")
    print(f"word-rattle: {len(words)} words, {len(common)} common")


def stamp_service_worker():
    h = hashlib.sha256()
    for p in pages():
        h.update(p.read_bytes())
    version = h.hexdigest()[:10]
    sw = ROOT / "sw.js"
    text = sw.read_text(encoding="utf-8")
    text = re.sub(r'const VERSION = "[^"]*";', f'const VERSION = "{version}";', text, count=1)
    sw.write_text(text, encoding="utf-8")
    print(f"sw.js: version {version}")


def check_scripts():
    node = shutil.which("node")
    if not node:
        print("node not found: skipped the syntax check")
        return
    bad = 0
    for p in pages():
        if p.suffix == ".js":
            blocks = [p.read_text(encoding="utf-8")]
        else:
            html = p.read_text(encoding="utf-8")
            blocks = re.findall(r"<script(?![^>]*(?:\bsrc=|type=\"text/plain\"))[^>]*>(.*?)</script>", html, re.S)
        for i, js in enumerate(blocks):
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
                f.write(js)
            r = subprocess.run([node, "--check", f.name], capture_output=True, text=True)
            if r.returncode:
                bad += 1
                print(f"SYNTAX ERROR in {p.relative_to(ROOT)} script {i + 1}:\n{r.stderr[:800]}")
    if bad:
        sys.exit(1)
    print(f"scripts: all parse ({len(pages())} files)")


if __name__ == "__main__":
    build_word_rattle()
    stamp_service_worker()
    check_scripts()
