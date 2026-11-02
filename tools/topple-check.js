// Checks Topple: every level can be finished, its par is the solver's shortest, its teleport pairs sit on pads,
// and the first climb boards can be made. Run by tools/build.py: node tools/topple-check.js
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "games", "topple", "index.html"), "utf8");
const core = html.match(/\/\*CORE-START\*\/([\s\S]*?)\/\*CORE-END\*\//);
const data = html.match(/<script type="application\/json" id="levels">([\s\S]*?)<\/script>/);
if (!core || !data) { console.error("topple: CORE or levels not found"); process.exit(1); }
const C = new Function(core[1] + ";return {load, parOf, generate, mulberry, hashStr};")();
const levels = JSON.parse(data[1]);
let bad = 0;
levels.forEach((L, i) => {
  const why = [];
  if (!Array.isArray(L.m) || !L.s || !L.p) why.push("missing a field");
  else {
    const p = C.parOf(L);
    if (p < 0) why.push("can't be finished");
    else if (p !== L.p) why.push(`par is ${L.p} but the shortest is ${p}`);
    for (const [x1, y1, x2, y2] of L.t || []) if (L.m[y1][x1] !== "p" || L.m[y2][x2] !== "p") why.push("teleport pair not on pads");
    if (/p/.test(L.m.join("")) && !(L.t || []).length) why.push("pads without a teleport pair");
  }
  if (why.length) { bad++; console.error(`topple: level ${i + 1}: ${why.join("; ")}`); }
});
// the climb board maker (a copy of climbLevel's settings is not needed: just check the page's own function)
const climb = html.match(/function climbLevel\(k\)\{[\s\S]*?\n\}\n/);
if (!climb) { bad++; console.error("topple: climbLevel not found"); }
else {
  const make = new Function("mulberry", "hashStr", "generate", `const CLIMB=new Map();${climb[0]};return climbLevel`)(C.mulberry, C.hashStr, C.generate);
  for (let k = 1; k <= 40; k++) if (!make(k)) { bad++; console.error("topple: no climb board " + k); }
}
if (bad) process.exit(1);
console.log(`topple: ${levels.length} levels and 40 climb boards ok`);
