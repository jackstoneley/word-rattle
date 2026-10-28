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


def check_link_up():
    """Every Link Up puzzle: four groups at levels 1-4, four words each, sixteen different words."""
    import json
    html = (ROOT / "games" / "link-up" / "index.html").read_text(encoding="utf-8")
    m = re.search(r'<script type="application/json" id="puzzles">(.*?)</script>', html, re.S)
    if not m:
        sys.exit("link-up: puzzle block not found")
    puzzles = json.loads(m.group(1))
    for i, p in enumerate(puzzles, 1):
        words = [w for g in p for w in g["w"]]
        if len(p) != 4 or sorted(g["l"] for g in p) != [1, 2, 3, 4] or any(len(g["w"]) != 4 for g in p) or len(set(words)) != 16:
            sys.exit(f"link-up: puzzle {i} is malformed")
    print(f"link-up: {len(puzzles)} puzzles ok")


def check_release_notes():
    """release-notes.json: unique ids, a known type, a headline and details on every note."""
    import json
    notes = json.loads((ROOT / "release-notes.json").read_text(encoding="utf-8"))["notes"]
    ids = [n["id"] for n in notes]
    if len(ids) != len(set(ids)) or any(n["type"] not in ("new-game", "features", "fixes") or not n.get("headline") or not n.get("details") for n in notes):
        sys.exit("release-notes.json: each note needs a unique id, a type (new-game, features or fixes), a headline and details")
    print(f"release notes: latest is #{max(ids)} ({next(n for n in notes if n['id'] == max(ids))['headline']})")


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
    check_link_up()
    check_release_notes()
    stamp_service_worker()
    check_scripts()
