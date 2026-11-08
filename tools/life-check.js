// Checks Life: a simple computer player (eat the nearest food, run from hunters, collect pods, evolve with its
// mate) finishes the cell stage as a plant eater and as a meat eater, in a sensible time. Seeded, so the check
// gives the same answer every time. Run by tools/build.py: node tools/life-check.js [-v]
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "games", "life", "index.html"), "utf8");
const core = html.match(/\/\*CORE-START\*\/([\s\S]*?)\/\*CORE-END\*\//);
if (!core) { console.error("life: CORE not found"); process.exit(1); }
const C = new Function(core[1] + ";return {newSave, newWorld, stepWorld, applyEvolve, respawn, viewR, designValue, partLimit, segLimit, stats, cloneD, PART, PARTS, TIERS};")();
const verbose = process.argv.includes("-v");

// What the bot buys when it evolves, in order (skips parts it hasn't found or can't afford).
const PLAN = { plant: ["whip", "fringe", "moon", "shell", "frill", "thorn", "jet", "stalk", "cluster", "thorn", "shell", "feeler"],
  meat: ["whip", "thorn", "fringe", "jet", "slit", "shell", "thorn", "jaw", "stalk", "cluster", "spark", "shell"] };
const SPOT = { whip: [-1, 3.14, false], fringe: [-1, -2.1, true], moon: [0, -.5, true], shell: [0, -1.7, true], frill: [-1, -2.2, true], thorn: [0, -1.2, true],
  jet: [-1, 2.6, true], stalk: [0, -.9, true], cluster: [0, -.3, true], feeler: [0, -.4, true], slit: [0, -.6, true], jaw: [0, .5, true], spark: [0, -1.5, false] };
function evolve(W, diet) {
  const S = W.S, c = S.cell, d = C.cloneD(c.design);
  if (d.s.length < C.segLimit(c.tier) && c.tier >= 2) d.s.push(11);
  const have = {}; for (const q of d.p) have[q.id] = (have[q.id] || 0) + 1;
  const want = {};
  for (const id of PLAN[diet]) {
    want[id] = (want[id] || 0) + 1; if ((have[id] || 0) >= want[id] || !c.unlocked.includes(id)) continue;
    const [s, a, m] = SPOT[id], q = { id, s: s < 0 ? d.s.length - 1 : s, a: a + (have[id] || 0) * .4, m }, t = C.cloneD(d); t.p.push(q);
    if (C.stats(t).parts > C.partLimit(c.tier) || C.designValue(t) - C.designValue(c.design) > c.dna) continue;
    d.p.push(q); have[id] = (have[id] || 0) + 1;
  }
  if (C.designValue(d) - C.designValue(c.design) > c.dna) return C.applyEvolve(W, c.design);
  return C.applyEvolve(W, d);
}
function bot(W, diet, inp) {
  const P = W.player, V = C.viewR(W), c = W.S.cell; let tx = null, ty = null, best = 1e18;
  // run from anything with a bite that's big enough to hurt
  let fx = 0, fy = 0;
  for (const o of W.cr) if (o.kind === "npc" && o.st.bite > 0 && o.diet !== "plant" && o.k > P.k * .95) {
    const dx = P.x - o.x, dy = P.y - o.y, dd = Math.hypot(dx, dy); if (dd < V * .55) { fx += dx / dd / dd; fy += dy / dd / dd; }
  }
  if (fx || fy) { const n = Math.hypot(fx, fy); inp.mx = fx / n; inp.my = fy / n; if (P.st.ab.dash) inp.ab = "dash"; if (P.st.ab.zap) inp.ab = "zap"; return; }
  if (W.mate && (c.ready || c.dna >= 25)) { tx = W.mate.x; ty = W.mate.y; }
  else if (W.relic && Math.hypot(W.relic.x - P.x, W.relic.y - P.y) < V * 1.6) { tx = W.relic.x; ty = W.relic.y; }
  else {
    for (const it of W.items) { if ((it.ty === "plant") !== P.st.eat.plant > 0 && !(P.st.eat.plant && P.st.eat.meat)) continue; const dd = (it.x - P.x) ** 2 + (it.y - P.y) ** 2; if (dd < best) { best = dd; tx = it.x; ty = it.y; } }
    if (P.st.bite) for (const o of W.cr) if (o.kind === "npc" && o.k < P.k * .9) { const dd = ((o.x - P.x) ** 2 + (o.y - P.y) ** 2) * 1.5; if (dd < best) { best = dd; tx = o.x; ty = o.y; } }
  }
  if (tx == null) { inp.mx = Math.cos(W.t * .1); inp.my = Math.sin(W.t * .1); return; }
  const dx = tx - P.x, dy = ty - P.y, n = Math.hypot(dx, dy) || 1; inp.mx = dx / n; inp.my = dy / n;
}
let bad = 0; const out = [];
for (const diet of ["plant", "meat"]) for (const seed of [11, 12]) {
  const S = C.newSave({ name: "Bot", diet, seed }), W = C.newWorld(S, seed), inp = { mx: 0, my: 0, ab: null };
  const sizeAt = [];
  let guard = 0;
  while (!S.cell.done && S.time < 3600 && guard++ < 3600 * 20) {
    bot(W, diet, inp); C.stepWorld(W, 1 / 20, inp);
    for (const e of W.ev) {
      if (e.t === "mate") { const r = evolve(W, diet); if (r.grew) sizeAt.push(Math.round(S.time / 60)); }
      if (e.t === "die") C.respawn(W);
    }
    W.ev.length = 0;
  }
  const min = Math.round(S.time / 60);
  if (!S.cell.done) { bad++; console.error(`life: the ${diet} eater bot (seed ${seed}) didn't finish the cell stage in an hour (size ${S.cell.tier + 1})`); continue; }
  if (min < 8) { bad++; console.error(`life: the ${diet} eater bot (seed ${seed}) finished the cell stage in ${min} min: too quick`); }
  out.push(`${diet} ${min} min (${S.cell.deaths} deaths)`);
  if (verbose) console.log(diet, seed, "sizes at", sizeAt.join(", "), "min; done", min, "min; deaths", S.cell.deaths, "kills", S.cell.kills, "evolves", S.cell.evolves, "parts", S.cell.unlocked.length, "dna left", Math.round(S.cell.dna), "nature", S.nature, "ate", JSON.stringify(S.cell.ate, (k, v) => typeof v === "number" ? Math.round(v) : v));
}
if (bad) process.exit(1);
console.log("life: cell stage finished by bots: " + out.join(", "));
