// Builds the app's web folder (www/) from the website: the home page, shell.js and every game,
// with fonts and PeerJS bundled so everything works offline, and an app flag set on every page.
// Run `python3 tools/build.py` first so games/word-rattle/index.html is up to date.
const fs = require("fs"), path = require("path");
const app = path.resolve(__dirname, ".."), root = path.resolve(app, ".."), www = path.join(app, "www");
const nm = path.join(app, "node_modules");
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, "fonts"), { recursive: true });

// 1. fonts used by any page, from @fontsource packages
const FACES = [
  ["Archivo Black", "archivo-black", [400]],
  ["Figtree", "figtree", [400, 500, 600, 700, 800]],
  ["Atkinson Hyperlegible", "atkinson-hyperlegible", [400, 700]],
  ["Bricolage Grotesque", "bricolage-grotesque", [500, 700, 800]]
];
let css = "";
for (const [family, pkg, weights] of FACES) {
  const dir = path.join(nm, "@fontsource", pkg, "files");
  for (const w of weights) {
    const file = `${pkg}-latin-${w}-normal.woff2`;
    if (!fs.existsSync(path.join(dir, file))) { console.warn("missing font", file); continue; }
    fs.copyFileSync(path.join(dir, file), path.join(www, "fonts", file));
    css += `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(${file}) format("woff2")}\n`;
  }
}
fs.writeFileSync(path.join(www, "fonts", "fonts.css"), css);

// 2. pages
const pages = ["index.html", ...fs.readdirSync(path.join(root, "games")).filter(g => fs.existsSync(path.join(root, "games", g, "index.html"))).map(g => `games/${g}/index.html`)];
for (const rel of pages) {
  let html = fs.readFileSync(path.join(root, rel), "utf8");
  const up = "../".repeat(rel.split("/").length - 1);
  html = html.replace(/<link rel="preconnect"[^>]*>\s*/g, "");
  html = html.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/g, `<link rel="stylesheet" href="${up}fonts/fonts.css">`);
  html = html.replace(/<link rel="manifest"[^>]*>\s*/g, "").replace(/<link rel="apple-touch-icon"[^>]*>\s*/g, "");
  if (!/<head>/.test(html)) throw new Error("prepare-www: no <head> in " + rel);
  html = html.replace("<head>", "<head><script>window.SG_APP=true;window.WR_APP=true;</script>");
  const out = path.join(www, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}
fs.copyFileSync(path.join(root, "shell.js"), path.join(www, "shell.js"));
fs.copyFileSync(path.join(root, "release-notes.json"), path.join(www, "release-notes.json"));

// 3. PeerJS for online live games in Word Rattle (it loads "peerjs.min.js" next to itself)
fs.copyFileSync(path.join(nm, "peerjs", "dist", "peerjs.min.js"), path.join(www, "games", "word-rattle", "peerjs.min.js"));
console.log("www ready:", pages.join(", "));
