// Checks Gravity Well: every level and Star Run level is well formed and can be won (its stored winning aim h hits,
// or for levels without one a search over aims finds hits), and the first daily orbits and voyage systems can be made.
// Run by tools/build.py: node tools/gravity-well-check.js
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "games", "gravity-well", "index.html"), "utf8");
const core = html.match(/\/\*CORE-START\*\/([\s\S]*?)\/\*CORE-END\*\//);
const block = id => { const m = html.match(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`)); return m && JSON.parse(m[1]); };
const levels = block("levels"), starrun = block("starrun");
if (!core || !levels || !starrun) { console.error("gravity-well: CORE, levels or starrun not found"); process.exit(1); }
const C = new Function(core[1] + ";return {solve, shoot, bodies, BALL, CR, WR, dailyLevel, voyageLevel};")();
let bad = 0;
function check(L, name) {
  const why = [];
  if (!L.n || !Array.isArray(L.s) || !Array.isArray(L.t) || L.t.length !== 3 || !Array.isArray(L.p) || !L.p.length) why.push("missing a field");
  else {
    for (const b of C.bodies(L, 0)) {
      if (Math.hypot(b[0] - L.s[0], b[1] - L.s[1]) < b[2] + C.BALL + 20) why.push("a body sits on the start");
      if (Math.hypot(b[0] - L.t[0], b[1] - L.t[1]) < b[2] + L.t[2] + 20) why.push("a body sits on the target");
    }
    for (const o of L.o || []) if (!L.p[o[0]]) why.push("a moon has no planet");
    for (const c of L.c || []) if (c.length !== 2) why.push("a star is malformed");
    for (const w of L.w || []) if (w.length !== 4) why.push("a wormhole is malformed");
    if (!why.length) {
      if (L.h) { if (C.shoot(L, L.h[0], L.h[1]).r !== "hit") why.push("the stored winning aim misses"); }
      else if (C.solve(L, 10, [100, 90, 80, 70, 60, 50, 40], 3).length < 3) why.push("no winning shot found");
    }
  }
  if (why.length) { bad++; console.error(`gravity-well: ${name} (${L.n}): ${why.join("; ")}`); }
}
levels.forEach((L, i) => check(L, `level ${i + 1}`));
starrun.forEach((L, i) => { check(L, `star run ${i + 1}`); if (!(L.c || []).length) { bad++; console.error(`gravity-well: star run ${i + 1} has no stars`); } });
for (let d = 1; d <= 12; d++) { const L = C.dailyLevel(d); if (!L) { bad++; console.error("gravity-well: no daily orbit for day " + d); } else if (L.h) check(L, "daily " + d); }
for (let k = 1; k <= 12; k++) { const L = C.voyageLevel(k); if (!L) { bad++; console.error("gravity-well: no voyage system " + k); } else check(L, "voyage " + k); }
if (bad) process.exit(1);
console.log(`gravity-well: ${levels.length} levels, ${starrun.length} star runs, 12 daily orbits and 12 voyage systems ok`);
