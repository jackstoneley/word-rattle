// Checks Life: a simple computer player (eat the nearest food, run from hunters, collect pods, evolve with its
// mate) finishes the cell stage as a plant eater and as a meat eater, in a sensible time; then carries on into the
// sea (dive as it grows, evolve at the nest, grow lungs and leg fins, crawl ashore). Seeded, so the check
// gives the same answer every time. Run by tools/build.py: node tools/life-check.js [-v]
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "games", "life", "index.html"), "utf8");
const core = html.match(/\/\*CORE-START\*\/([\s\S]*?)\/\*CORE-END\*\//);
if (!core) { console.error("life: CORE not found"); process.exit(1); }
const C = new Function(core[1] + ";return {newSave, newWorld, stepWorld, applyEvolve, respawn, viewR, designValue, partLimit, segLimit, stats, cloneD, PART, PARTS, TIERS, cur, goToSea, bandMid, bandAt, SEA, goToLand, landGo, landGoTo, landHunt, landLeave, landMove, lspStatus, impressPlan, socialQ, impressEnd, LT};")();
const verbose = process.argv.includes("-v");

// What the bot buys when it evolves, in order (skips parts it hasn't found or can't afford).
const PLAN = { plant: ["whip", "fringe", "moon", "shell", "frill", "thorn", "jet", "stalk", "cluster", "thorn", "shell", "feeler"],
  meat: ["whip", "thorn", "fringe", "jet", "slit", "shell", "thorn", "jaw", "stalk", "cluster", "spark", "shell"] };
const SEAPLAN = { plant: ["tailfin", "sidefin", "baleen", "plate", "frill", "ink", "stalk", "lamp", "thorn"], meat: ["tailfin", "sidefin", "beak", "thorn", "plate", "tentacle", "slit", "lamp", "ink"] };
const SPOT = { whip: [-1, 3.14, false], fringe: [-1, -2.1, true], moon: [0, -.5, true], shell: [0, -1.7, true], frill: [-1, -2.2, true], thorn: [0, -1.2, true],
  jet: [-1, 2.6, true], stalk: [0, -.9, true], cluster: [0, -.3, true], feeler: [0, -.4, true], slit: [0, -.6, true], jaw: [0, .5, true], spark: [0, -1.5, false],
  tailfin: [-1, 3.14, false], sidefin: [1, -1.6, true], baleen: [0, .45, true], beak: [0, .45, true], plate: [1, -1.6, true], tentacle: [0, .8, true], ink: [-1, 2.7, false],
  lamp: [0, -.1, false], lungs: [0, -1.4, false], legfin: [-1, -1.9, true],
  leg: [1, -1.7, true], crest: [0, -2.4, true], voice: [0, -1.8, false], claw: [0, .8, true], horn: [0, .3, true], ear: [0, -1.25, true], spitter: [0, -.25, false],
  tail: [-1, 3.14, false], hand: [0, 1.1, true], wing: [1, -1.5, true] };
const LANDPLAN = { plant: ["crest", "leg", "horn", "crest", "ear", "wing", "plate", "hand", "tail"], meat: ["claw", "crest", "horn", "leg", "spitter", "ear", "plate", "tail", "wing"] };
function evolve(W, diet) {
  const S = W.S, c = C.cur(S), d = C.cloneD(c.design), sea = S.stage === "sea";
  if (d.s.length < C.segLimit(c.tier, S) && c.tier >= 2) d.s.push(11);
  const have = {}; for (const q of d.p) have[q.id] = (have[q.id] || 0) + 1;
  const want = {};
  // in the sea, lungs and leg fins come first once it's nearly ready to leave
  const plan = S.stage === "land" ? LANDPLAN[diet] : sea ? (c.tier >= 4 ? ["lungs", "legfin", ...SEAPLAN[diet]] : SEAPLAN[diet]) : PLAN[diet];
  if (sea && c.tier >= 4 && !have.lungs) { // make room by dropping the newest extras
    while (d.p.length && C.stats(d).parts + 3 > C.partLimit(c.tier, S)) { const i = d.p.findIndex(q => !["tailfin", "baleen", "beak", "jaw", "filter", "siphon"].includes(q.id)); if (i < 0) break; d.p.splice(i, 1); }
  }
  for (const id of plan) {
    want[id] = (want[id] || 0) + 1; if ((have[id] || 0) >= want[id] || !c.unlocked.includes(id)) continue;
    const [s, a, m] = SPOT[id], q = { id, s: s < 0 ? d.s.length - 1 : s, a: a + (have[id] || 0) * .4, m }, t = C.cloneD(d); t.p.push(q);
    if (C.stats(t).parts > C.partLimit(c.tier, S) || C.designValue(t) - C.designValue(c.design) > c.dna) continue;
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
  else if (W.pods.length && Math.hypot(W.pods[0].x - P.x, W.pods[0].y - P.y) < V * 1.6) { tx = W.pods[0].x; ty = W.pods[0].y; }
  else {
    for (const it of W.items) { if ((it.ty === "plant") !== P.st.eat.plant > 0 && !(P.st.eat.plant && P.st.eat.meat)) continue; const dd = (it.x - P.x) ** 2 + (it.y - P.y) ** 2; if (dd < best) { best = dd; tx = it.x; ty = it.y; } }
    if (P.st.bite) for (const o of W.cr) if (o.kind === "npc" && o.k < P.k * .9) { const dd = ((o.x - P.x) ** 2 + (o.y - P.y) ** 2) * 1.5; if (dd < best) { best = dd; tx = o.x; ty = o.y; } }
  }
  if (tx == null) { inp.mx = Math.cos(W.t * .1); inp.my = Math.sin(W.t * .1); return; }
  const dx = tx - P.x, dy = ty - P.y, n = Math.hypot(dx, dy) || 1; inp.mx = dx / n; inp.my = dy / n;
}
function seaBot(W, diet, inp) {
  const P = W.player, V = C.viewR(W), c = C.cur(W.S), R = P.g.R * P.k; let tx = null, ty = null, best = 0;
  let fx = 0, fy = 0;
  for (const o of W.cr) if (o.kind === "npc" && o.st.bite > 0 && o.diet !== "plant" && o.k > P.k * .95) {
    const dx = P.x - o.x, dy = P.y - o.y, dd = Math.hypot(dx, dy); if (dd < V * .55) { fx += dx / dd / dd; fy += dy / dd / dd; }
  }
  if (fx || fy) { const n = Math.hypot(fx, fy); inp.mx = fx / n; inp.my = fy / n; if (P.st.ab.dash) inp.ab = "dash"; if (P.st.ab.ink) inp.ab = "ink"; return; }
  const legs = P.st.lungs && P.st.legs >= 2;
  if (c.ashore && legs) { tx = P.x; ty = -100; }
  else if (c.ready || (c.ashore && !legs)) { tx = W.nest.x; ty = W.nest.y; }
  else if (W.pods.length && Math.hypot(W.pods[0].x - P.x, W.pods[0].y - P.y) < V * 1.6) { tx = W.pods[0].x; ty = W.pods[0].y; }
  else {
    for (const it of W.items) {
      const ok = it.ty === "plant" ? P.st.eat.plant : P.st.eat.meat; if (!ok) continue;
      const v = Math.min(1.6, (it.k / P.k) ** 2) * (.75 + .45 * (it.ty === "meat" ? c.lean : -c.lean)); if (v < .3) continue;
      const sc = v / (Math.hypot(it.x - P.x, it.y - P.y) + R * 3); if (sc > best) { best = sc; tx = it.x; ty = it.y; }
    }
    if (P.st.bite) for (const o of W.cr) if (o.kind === "npc" && o.k < P.k * .9 && o.k > P.k * .4) { const sc = 2 * (o.k / P.k) ** 2 / (Math.hypot(o.x - P.x, o.y - P.y) + R * 3); if (sc > best) { best = sc; tx = o.x; ty = o.y; } }
    const goal = C.bandMid(Math.min(4, c.tier)); // swim down to the depth that suits its size
    if (tx == null || best * V < .4) { tx = P.x + Math.sin(W.t * .05) * V; ty = goal; }
  }
  const dx = tx - P.x, dy = ty - P.y, n = Math.hypot(dx, dy) || 1; inp.mx = dx / n; inp.my = dy / n;
}
/* Land: walk to the nearest species not yet dealt with; impress if its show is one this design can copy, otherwise hunt;
   fight back when attacked, go home to heal and to evolve. */
function landBot(W, diet, B) {
  const P = W.player, c = C.cur(W.S), LT = C.LT;
  if (P.mode === "hunt" && P.tg && !P.tg.dead) {
    B.fightT = (B.fightT || 0) + .05;
    if (B.fightT > 25) { B.fightT = 0; P.tg.botSkip = W.t + 90; C.landLeave(W); C.landGoTo(W, W.home); return; } // a fight going nowhere: give up and go home
    for (const id of ["charge", "pounce", "spit", "roar"]) if (P.st.ab[id] && !(P.ab[id] > 0) && Math.hypot(P.tg.x - P.x, P.tg.y - P.y) < LT * 4) { C.landMove(W, id); break; }
    if (P.hp < P.max * .3) { C.landLeave(W); C.landGoTo(W, W.home); }
    return;
  }
  B.fightT = 0;
  const att = W.cr.find(q => q.kind === "npc" && q.ai.tg && q.ai.tg.team && Math.hypot(q.x - P.x, q.y - P.y) < LT * 4);
  if (att && P.hp > P.max * .35 && P.st.bite + 2 >= att.st.bite * .5 && W.t >= (att.botSkip || 0)) { C.landHunt(W, att); return; }
  if (att && !(P.goal && P.goal.kind === "home")) { C.landGoTo(W, W.home); return; } // too tough: run home
  if (P.hp < P.max * .4) { if (!P.goal || P.goal.kind !== "home") C.landGoTo(W, W.home); return; }
  if (P.goal || P.path || P.eating) return;
  if (c.dna >= 50 && W.t - B.evoT > 150) { C.landGoTo(W, W.home); return; }
  let best = null, bd = 1e18;
  for (const q of W.cr) if (q.kind === "npc") {
    const st = q.lsp != null ? C.lspStatus(c, q.lsp) : c.epics[q.epic]; if (st || q.wooed || W.t < (q.botSkip || 0)) continue;
    const d = (q.x - P.x) ** 2 + (q.y - P.y) ** 2 * 1 + (q.epic != null ? 1e7 : 0); if (d < bd) { bd = d; best = q; }
  }
  // a landmark close by (or nothing else worth doing) is worth the walk
  let mk = null, md = (LT * 30) ** 2; for (const m of W.marks) if (!c.found[m.id]) { const d = (m.x - P.x) ** 2 + (m.y - P.y) ** 2; if (d < md) { md = d; mk = m; } }
  if (mk && (!best || md < bd * .5)) { C.landGo(W, mk.x, mk.y); return; }
  // an unguarded nest is worth raiding
  for (const Ls of W.lsp) if (Ls.life === "home" && !(c.nests || {})[Ls.i] && C.lspStatus(c, Ls.i) !== "friend" && !W.cr.some(q => q.lsp === Ls.i && Math.hypot(q.x - Ls.x, q.y - Ls.y) < LT * 7) && Math.hypot(Ls.x - P.x, Ls.y - P.y) < LT * 40) { C.landGo(W, Ls.x, Ls.y); return; }
  if (best) C.landGoTo(W, best);
}
function landMeet(W, diet, T) {
  const P = W.player, q = C.socialQ(P.st, P.d), seqs = C.impressPlan(W, T); let sc = 0, n = 0;
  for (const s of seqs) for (const k of s) { sc += q[k]; n++; }
  const need = T.epic != null ? .7 : .6;
  // the show takes about as long as a person would: ~1.8 s a move
  if (!T.asleep && (sc / n >= need || (T.epic == null && T.st.bite > P.st.bite + 4))) { W.S.time += n * 1.8; if (!C.impressEnd(W, T, sc / n)) T.botSkip = W.t + 60; return; }
  C.landHunt(W, T);
}
let bad = 0; const out = [], seaOut = [], landOut = [], grown = [];
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
  out.push(`${diet} ${min} min (${S.cell.deaths} deaths)`); grown.push([diet, seed, S]);
  if (verbose) console.log(diet, seed, "sizes at", sizeAt.join(", "), "min; done", min, "min; deaths", S.cell.deaths, "kills", S.cell.kills, "evolves", S.cell.evolves, "parts", S.cell.unlocked.length, "dna left", Math.round(S.cell.dna), "nature", S.nature, "ate", JSON.stringify(S.cell.ate, (k, v) => typeof v === "number" ? Math.round(v) : v));
}
// the sea, carrying on from each finished pond
for (const [diet, seed, S] of grown) {
  C.goToSea(S); const t0 = S.time, W = C.newWorld(S, seed + 100), inp = { mx: 0, my: 0, ab: null }, c = S.sea, sizeAt = [];
  let guard = 0;
  while (!c.done && S.time - t0 < 5400 && guard++ < 5400 * 20) {
    seaBot(W, diet, inp); C.stepWorld(W, 1 / 20, inp);
    for (const e of W.ev) {
      if (e.t === "mate") { const r = evolve(W, diet); if (r.grew) sizeAt.push(Math.round((S.time - t0) / 60)); }
      if (e.t === "die") C.respawn(W);
    }
    W.ev.length = 0;
  }
  const min = Math.round((S.time - t0) / 60);
  if (!c.done) { bad++; console.error(`life: the ${diet} eater bot (seed ${seed}) didn't finish the sea stage in 90 min (size ${c.tier + 1}${c.ashore ? ", ready to go ashore" : ""})`); continue; }
  if (min < 12) { bad++; console.error(`life: the ${diet} eater bot (seed ${seed}) finished the sea stage in ${min} min: too quick`); }
  seaOut.push(`${diet} ${min} min (${c.deaths} deaths)`);
  // and the land
  C.goToLand(S); const t1 = S.time, LW = C.newWorld(S, seed + 200), L = S.land, B = { evoT: 0 };
  let lg = 0, dead = 0, rally = 0, scatter = 0, nests = 0;
  while (!L.done && S.time - t1 < 9000 && lg++ < 9000 * 20) {
    landBot(LW, diet, B); C.stepWorld(LW, 1 / 20, {});
    for (const e of LW.ev) {
      if (e.t === "mate") { evolve(LW, diet); B.evoT = LW.t; }
      if (e.t === "meet") landMeet(LW, diet, e.c);
      if (e.t === "die") { dead++; L.deaths++; C.respawn(LW); }
      if (e.t === "rally") rally++; if (e.t === "scatter") scatter++; if (e.t === "nestWon") nests++;
    }
    LW.ev.length = 0;
  }
  const lmin = Math.round((S.time - t1) / 60), fr = LW.lsp.filter(x => C.lspStatus(L, x.i) === "friend").length, gone = LW.lsp.filter(x => C.lspStatus(L, x.i) === "gone").length;
  if (!L.done) { bad++; console.error(`life: the ${diet} eater bot (seed ${seed}) didn't finish the land stage in 150 min (brain ${Math.round(L.grow)}, ${fr} friends, ${gone} hunted out)`); continue; }
  if (lmin < 15) { bad++; console.error(`life: the ${diet} eater bot (seed ${seed}) finished the land stage in ${lmin} min: too quick`); }
  landOut.push(`${diet} ${lmin} min (${fr} befriended, ${gone} hunted, ${nests} nests raided, ${dead} deaths)`);
  if (verbose) console.log("land groups", diet, seed, "rallied", rally, "scattered", scatter);
  if (verbose) console.log("land", diet, seed, "done", lmin, "min; friends", fr, "hunted", gone, "epics", JSON.stringify(L.epics), "deaths", dead, "evolves", L.evolves, "dna", Math.round(L.dna), "lean", L.lean.toFixed(2), "nature", S.landNature);
  if (verbose) console.log("sea", diet, seed, "sizes at", sizeAt.join(", "), "min; done", min, "min; deaths", c.deaths, "kills", c.kills, "goals", Object.keys(c.goals).join(" "), "lean", c.lean.toFixed(2), "young", c.young, "dna left", Math.round(c.dna));
}
if (bad) process.exit(1);
console.log("life: cell stage finished by bots: " + out.join(", ") + "; sea stage: " + seaOut.join(", ") + "; land stage: " + landOut.join(", "));
