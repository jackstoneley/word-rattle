// Checks Gravity Well: every level is well formed and can be won (a search over aims finds hits), and the next
// two months of daily orbits can be made. Run by tools/build.py: node tools/gravity-well-check.js
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "games", "gravity-well", "index.html"), "utf8");
const core = html.match(/\/\*CORE-START\*\/([\s\S]*?)\/\*CORE-END\*\//);
const data = html.match(/<script type="application\/json" id="levels">([\s\S]*?)<\/script>/);
if (!core || !data) { console.error("gravity-well: CORE or levels not found"); process.exit(1); }
const C = new Function(core[1] + ";return {solve, bodies, BALL};")();
const levels = JSON.parse(data[1]);
let bad = 0;
levels.forEach((L, i) => {
  const why = [];
  if (!L.n || !Array.isArray(L.s) || !Array.isArray(L.t) || L.t.length !== 3 || !Array.isArray(L.p) || !L.p.length) why.push("missing a field");
  else {
    for (const b of C.bodies(L, 0)) {
      if (Math.hypot(b[0] - L.s[0], b[1] - L.s[1]) < b[2] + C.BALL + 20) why.push("a body sits on the start");
      if (Math.hypot(b[0] - L.t[0], b[1] - L.t[1]) < b[2] + L.t[2] + 20) why.push("a body sits on the target");
    }
    for (const o of L.o || []) if (!L.p[o[0]]) why.push("a moon has no planet");
    if (!why.length && C.solve(L, 10, [100, 90, 80, 70, 60, 50, 40], 3).length < 3) why.push("no winning shot found");
  }
  if (why.length) { bad++; console.error(`gravity-well: level ${i + 1} (${L.n}): ${why.join("; ")}`); }
});
const C2 = new Function(core[1] + ";return {dailyLevel};")();
for (let d = 1; d <= 60; d++) if (!C2.dailyLevel(d)) { bad++; console.error("gravity-well: no daily orbit for day " + d); }
if (bad) process.exit(1);
console.log(`gravity-well: ${levels.length} levels and 60 daily orbits ok`);
