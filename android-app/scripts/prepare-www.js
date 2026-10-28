// Builds the app's web folder from the website's index.html: local fonts, local PeerJS, app flag.
const fs = require("fs"), path = require("path");
const app = path.resolve(__dirname, ".."), root = path.resolve(app, ".."), www = path.join(app, "www");
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, "fonts"), { recursive: true });

let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const must = (re, rep, label) => { if (!re.test(html)) throw new Error("prepare-www: could not find " + label); html = html.replace(re, rep); };
must(/<link rel="preconnect"[^>]*>\s*/, "", "preconnect");
must(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link rel="stylesheet" href="fonts/fonts.css">', "font link");
must(/<link rel="manifest"[^>]*>\s*/, "", "manifest link");
must(/<link rel="apple-touch-icon"[^>]*>\s*/, "", "touch icon link");
must(/<script>\n"use strict";/, '<script>window.WR_APP=true;</script>\n<script>\n"use strict";', "main script");
fs.writeFileSync(path.join(www, "index.html"), html);

// fonts
const nm = path.join(app, "node_modules");
const faces = [["Archivo Black", "archivo-black", [400]], ["Figtree", "figtree", [400, 500, 600, 700, 800]]];
let css = "";
for (const [family, pkg, weights] of faces) {
  const dir = path.join(nm, "@fontsource", pkg, "files");
  for (const w of weights) {
    const file = `${pkg}-latin-${w}-normal.woff2`;
    if (!fs.existsSync(path.join(dir, file))) { console.warn("missing font", file); continue; }
    fs.copyFileSync(path.join(dir, file), path.join(www, "fonts", file));
    css += `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(${file}) format("woff2")}\n`;
  }
}
fs.writeFileSync(path.join(www, "fonts", "fonts.css"), css);

// PeerJS for online live games
fs.copyFileSync(path.join(nm, "peerjs", "dist", "peerjs.min.js"), path.join(www, "peerjs.min.js"));
console.log("www ready:", fs.readdirSync(www).join(", "));
