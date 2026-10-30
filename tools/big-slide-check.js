// Checks Buddy's Big Slide: every challenge level's answer (h) reaches the flag with every bone, within par and any ink
// limit, and the next year of daily slides can be made. Run by tools/build.py: node tools/big-slide-check.js
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "games", "big-slide", "index.html"), "utf8");
const core = html.match(/\/\*CORE-START\*\/([\s\S]*?)\/\*CORE-END\*\//);
const data = html.match(/<script type="application\/json" id="levelData">([\s\S]*?)<\/script>/);
if (!core || !data) { console.error("big-slide: CORE or levelData not found"); process.exit(1); }
const C = new Function(core[1] + ";return {simulate, inkOf, segHitsRect, dailyLevel};")();
const levels = JSON.parse(data[1]);
let bad = 0;
levels.forEach((L, i) => {
  const why = [];
  if (!L.n || !L.s || !L.f || !Array.isArray(L.b) || !L.h || !L.p) why.push("missing a field");
  else {
    const res = C.simulate(L, L.h), ink = C.inkOf(L.h);
    if (!res.ok) why.push("answer doesn't reach the flag (" + res.why + ")");
    else if (!res.all) why.push(`answer catches ${res.got} of ${L.b.length} bones`);
    if (ink > L.p) why.push(`answer uses ${ink} ink, over par ${L.p}`);
    if (L.lim && ink > L.lim) why.push(`answer uses ${ink} ink, over the limit ${L.lim}`);
    for (const z of L.z || []) for (const h of L.h) for (let k = 1; k + 3 < h.length; k += 2) if (C.segHitsRect(h[k], h[k + 1], h[k + 2], h[k + 3], z)) why.push("answer crosses a flowerbed");
  }
  if (why.length) { bad++; console.error(`big-slide: level ${i + 1} (${L.n}): ${why.join("; ")}`); }
});
for (let d = 1; d <= 400; d++) if (!C.dailyLevel(d, d % 7 < 2)) { bad++; console.error("big-slide: no daily slide for day " + d); }
if (bad) process.exit(1);
console.log(`big-slide: ${levels.length} levels and 400 daily slides ok`);
