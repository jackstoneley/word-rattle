// Checks Life: a simple computer player (eat the nearest food, run from hunters, collect pods, evolve with its
// mate) finishes the cell stage as a plant eater and as a meat eater, in a sensible time; then carries on into the
// sea (dive as it grows, evolve at the nest, grow lungs and leg fins, crawl ashore). Seeded, so the check
// gives the same answer every time. Run by tools/build.py: node tools/life-check.js [-v]
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "games", "life", "index.html"), "utf8");
const core = html.match(/\/\*CORE-START\*\/([\s\S]*?)\/\*CORE-END\*\//);
if (!core) { console.error("life: CORE not found"); process.exit(1); }
const C = new Function(core[1] + ";return {newSave, newWorld, stepWorld, applyEvolve, respawn, viewR, designValue, partLimit, segLimit, stats, cloneD, PART, PARTS, TIERS, cur, goToSea, bandMid, bandAt, SEA, goToLand, testStart, landGo, landGoTo, landHunt, landLeave, landMove, lspStatus, impressPlan, socialQ, impressEnd, quakeSites, LT, goToTribe, setJob, assignJobs, popAll, room, canBuild, tribeBuild, tribeMake, TOOLS, BUILD, tribeGift, tribeTrade, tradeOffers, canImpress, tribeImpressEnd, tribeDuel, tribeRaidStores, canTake, tribeTake, tribeBurn, defenders, giftCost, tileI, CAMP_R, TOTEM_R, DEP_MATS, jobCount, landHunt, upkeep, isAlly, tribeAskHelp};")();
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
  if (c.quake && c.quake.phase !== "after" && !c.quake.made) { const Q = C.quakeSites(W); if (!P.path || P.mode !== "walk" || !B.fleeing) { B.fleeing = true; C.landLeave(W); C.landGo(W, Q.safe[0], Q.safe[1]); } return; } // run from the volcano
  B.fleeing = false;
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

/* Tribe: a steady chief. Keeps the jobs sensible, builds huts when the camp is full, plants totems towards deposits it has found
   (and later towards the hostile camp to hem it in), makes every tool it can, sends gifts and trades with the open tribe and
   impresses its chief; once it has guards with spears it leads them to burn the hostile tribe's totems, raids its stores,
   duels its champion and takes its fire. */
function tribePlan(W, B) {
  const T = W.S.tribe, LT = C.LT, F = W.fires[0], all = C.popAll(T), Hs = T.rv.filter(r => r.kind === "hostile" && !r.state), Os = T.rv.filter(r => r.kind === "open" && !r.state);
  const sites = T.builds.filter(b => !b.done).length, raid = T.rv.some(r => r.raid && (r.raid.ph !== "gather" || r.raid.t > 15)), up = C.upkeep(W);
  const needMat = C.DEP_MATS.filter(m => T.res[m] < 14 && W.deps.some(D => D.m === m && T.deps[D.n] && W.own[D.t] === 1)).length;
  const want = { build: sites ? Math.min(4, 1 + sites) : 0, wood: Math.max(2, Math.round(all * .22) + (T.res.wood < up.wood * 3 ? 1 : 0)), stone: Math.max(1, Math.round(all * .14) + (T.res.stone < up.stone * 3 ? 1 : 0)), fetch: needMat ? Math.min(3, needMat + 1) : 0,
    hunt: T.res.hide < 12 ? 1 : 0, guard: Math.round(all * (!Hs.length ? .05 : T.t > 600 ? .3 : .15)) + (raid ? 2 : 0) };
  if (T.hungry || T.res.food < 15) { want.wood = Math.min(want.wood, 2); want.stone = Math.min(want.stone, 1); }
  let free = all - Math.ceil(all * (T.hungry || T.res.food < 20 ? .55 : .3));
  for (const k of ["build", "wood", "guard", "stone", "fetch", "hunt"]) { const n = Math.max(0, Math.min(want[k], free)); T.jobs[k] = n; free -= n; } C.assignJobs(W);
  for (const t of C.TOOLS) C.tribeMake(W, t.id);
  const near = (k, tx, ty, R) => { let best = null, bd = 1e18; for (let n = 0; n < 400; n++) { const a = W.R() * Math.PI * 2, d = W.R() * LT * R, x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d; if (C.canBuild(W, k, x, y)) continue; const dd = Math.hypot(x - tx, y - ty); if (dd < bd) { bd = dd; best = [x, y]; } } return best; };
  const spare = m => T.res[m] - up[m] * 3;
  if (!sites && all >= C.room(T) - 1 && spare("wood") >= 30) { const p = near("hut", F.x, F.y, 6); if (p) C.tribeBuild(W, "hut", p[0], p[1]); }
  // a new camp: when the old ones are full, towards the nearest hostile tribe (to hem it in) or the island's middle
  if (sites < 2 && T.t > 420 && all >= C.room(T) - 2 && spare("wood") >= 40 && T.res.food >= 60 && T.res.stone >= 10 && T.builds.filter(b => b.k === "camp").length < 3) {
    const goal = Hs.sort((a, b) => Math.hypot(a.x - F.x, a.y - F.y) - Math.hypot(b.x - F.x, b.y - F.y))[0] || { x: 75 * LT, y: 75 * LT };
    let best = null, bd = 1e18; for (let n = 0; n < 900; n++) { const i = Math.floor(W.R() * 150 * 150), x = (i % 150 + .5) * LT, y = (((i / 150) | 0) + .5) * LT; if (C.canBuild(W, "camp", x, y)) continue; const d = Math.hypot(x - goal.x, y - goal.y) + Math.hypot(x - F.x, y - F.y) * .5; if (d < bd) { bd = d; best = [x, y]; } }
    if (best) C.tribeBuild(W, "camp", best[0], best[1]);
  }
  if (sites < 2 && spare("wood") >= 22 && spare("stone") >= 8) {
    const goal = W.deps.filter(D => T.deps[D.n] && W.own[D.t] !== 1 && W.own[D.t] < 2).sort((a, b) => Math.hypot(a.x - F.x, a.y - F.y) - Math.hypot(b.x - F.x, b.y - F.y))[0] || (T.t > 500 ? Hs[0] : null);
    if (goal) { let best = null, bd = 1e18; for (let n = 0; n < 500; n++) { const i = Math.floor(W.R() * 150 * 150), x = (i % 150 + .5) * LT, y = (((i / 150) | 0) + .5) * LT; if (C.canBuild(W, "totem", x, y)) continue; const d = Math.hypot(x - goal.x, y - goal.y); if (d < bd) { bd = d; best = [x, y]; } }
      if (best && (!Hs.includes(goal) || bd > LT * (C.CAMP_R + 3))) C.tribeBuild(W, "totem", best[0], best[1]); }
  }
  for (const O of Os) { const j = T.rv.indexOf(O); if (T.res.food > 50 + C.giftCost(O)) C.tribeGift(W, j, "food"); if (spare("wood") > 50 + C.giftCost(O)) C.tribeGift(W, j, "wood");
    for (const m of C.tradeOffers(O)) if (T.res[m] < 10) { C.tribeTrade(W, j, m); break; } }
}
function tribeChief(W, B) {
  const T = W.S.tribe, P = W.player, LT = C.LT, Os = T.rv.filter(r => r.kind === "open" && !r.state);
  if (W.duel) return; if (P.mode === "hunt" && P.tg && !P.tg.dead) { if (P.hp < P.max * .3) { C.landLeave(W); C.landGoTo(W, W.home); } return; }
  const att = W.cr.find(q => (q.kind === "rival" && q.tg === P || q.kind === "npc" && q.ai.tg === P) && Math.hypot(q.x - P.x, q.y - P.y) < LT * 4);
  if (att && P.hp > P.max * .4) { C.landHunt(W, att); return; }
  if (P.hp < P.max * .45) { W.rally = false; if (!P.goal || P.goal.kind !== "home") C.landGoTo(W, W.home); return; }
  if (P.path || P.goal) return;
  const D = W.deps.filter(d => !T.deps[d.n] && (Math.hypot(d.x - W.home.x, d.y - W.home.y) < LT * 32 || !W.deps.some(e => e.m === d.m && T.deps[e.n]))).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0];
  if (D && (T.t < 900 || !T.found[D.m])) { C.landGo(W, D.x, D.y); return; }
  for (const O of Os) { const oj = T.rv.indexOf(O); if (C.canImpress(W, oj)) { const q = C.socialQ(P.st, P.d), seqs = C.impressPlan(W, { lsp: O.i }); let sc = 0, n = 0; for (const s of seqs) for (const k of s) { sc += q[k]; n++; } W.S.time += n * 1.8; C.tribeImpressEnd(W, oj, sc / n); return; } }
  const O = Os.filter(o => o.mood >= 0 && T.t >= (o.cd.imp || 0)).sort((a, b) => b.mood - a.mood)[0];
  if (O && (T.t < 1500 || !T.rv.some(r => r.kind === "hostile" && !r.state))) { C.landGoTo(W, W.fires[T.rv.indexOf(O) + 1]); return; }
  const H = T.rv.filter(r => r.kind === "hostile" && !r.state).sort((a, b) => a.spirit - b.spirit)[0]; if (!H) { if (O) C.landGoTo(W, W.fires[T.rv.indexOf(O) + 1]); return; }
  const hj = T.rv.indexOf(H), guards = C.jobCount(W, "guard");
  if (guards < (T.tools.spear ? 4 : 7)) { if (Math.hypot(P.x - W.home.x, P.y - W.home.y) > LT * 4) C.landGoTo(W, W.home); return; }
  W.rally = true; T.rv.forEach((r, j) => { if (C.isAlly(r)) C.tribeAskHelp(W, j); });
  if (C.canTake(W, hj)) { C.tribeTake(W, hj); return; }
  if (W.cap) return;
  const atH = Math.hypot(P.x - H.x, P.y - H.y) < LT * 3.5;
  if (atH) {
    if (T.t >= (H.cd.duel || 0) && P.hp > P.max * .9) { C.tribeDuel(W, hj); return; }
    if (C.tribeRaidStores(W, hj) === "ok") return;
    const dfd = C.defenders(W, hj, H); if (dfd.length) { C.landHunt(W, dfd[0]); return; }
  }
  const t = H.totems.slice().sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0];
  if (t && !W.burn) { if (Math.hypot(P.x - t.x, P.y - t.y) < LT * 2.4) C.tribeBurn(W, t); else C.landGo(W, t.x, t.y); return; }
  if (W.burn) return;
  if (!atH && (T.t >= (H.cd.duel || 0) || T.t >= (H.cd.raid || 0) || H.spirit <= 30)) { C.landGoTo(W, W.fires[hj + 1]); return; }
  if (Math.hypot(P.x - W.home.x, P.y - W.home.y) > LT * 5) C.landGoTo(W, W.home);
}
function runTribe(S, diet, seed) {
  C.goToTribe(S); const t2 = S.time, TW = C.newWorld(S, seed + 300), T = S.tribe, TB = {}, tev = {};
  let tg = 0, tlog = 0;
  while (!T.done && S.time - t2 < 7200 && tg++ < 7200 * 20) {
    if (tg % 20 === 0) tribePlan(TW, TB); if (tg % 4 === 0) tribeChief(TW, TB);
    C.stepWorld(TW, 1 / 20, {});
    for (const e of TW.ev) { tev[e.t] = (tev[e.t] || 0) + 1; if (e.t === "villDied") tev["vd_" + e.by] = (tev["vd_" + e.by] || 0) + 1; if (e.t === "die") { if (verbose && (tev.die || 0) < 6) { const P = TW.player; console.log("    chief died", Math.round(T.t), e.how, "near", TW.cr.filter(q => Math.hypot(q.x - P.x, q.y - P.y) < 250).map(q => q.kind + (q.champ ? "C" : "") + (q.raid ? "R" : "")).join(","), "duel", !!TW.duel, "hp", P.hp, P.max); } C.respawn(TW); } }
    TW.ev.length = 0;
    if (verbose && S.time - t2 > tlog) { tlog += 300; console.log("  tribe", diet, seed, Math.round((S.time - t2) / 60), "min: pop", C.popAll(T), "/", C.room(T), "food", Math.round(T.res.food), "wood", Math.round(T.res.wood), "stone", Math.round(T.res.stone), "tools", Object.keys(T.tools).join(""), "builds", T.builds.map(b => b.k[0] + (b.done ? "" : "?")).join(""), "rivals", T.rv.map(r => r.kind[0] + r.pop + ":" + Math.round(r.kind === "open" ? r.mood : r.spirit) + (r.state ? r.state : "")).join(" "), "up", JSON.stringify(C.upkeep(TW)), "hem", (TW.hem || []).map(h => h.toFixed(2)).join(",")); }
  }
  const tmin = Math.round((S.time - t2) / 60);
  if (!T.done) { bad++; console.error(`life: the ${diet} eater bot (seed ${seed}) didn't finish the tribe stage in 120 min (${T.rv.map(r => r.name + " " + (r.state || (r.kind === "open" ? "mood " + Math.round(r.mood) : "spirit " + Math.round(r.spirit)))).join(", ")})`); }
  else { if (tmin < 15) { bad++; console.error(`life: the ${diet} eater bot (seed ${seed}) finished the tribe stage in ${tmin} min: too quick`); }
    tribeOut.push(`${diet} ${tmin} min (${C.popAll(T)} people, ${Object.keys(T.tools).length} tools, ${S.tribeNature}, raids beaten ${T.rv.reduce((a, r) => a + r.beat, 0)}/${T.rv.reduce((a, r) => a + r.beat + r.won, 0)}, ${T.builds.filter(b => b.k === "camp" && b.done).length} new camps)`); }
  if (verbose) console.log("tribe events", JSON.stringify(tev));
}
let bad = 0; const out = [], seaOut = [], landOut = [], tribeOut = [], grown = [];
if (process.argv.includes("--tribe")) { // quick: the tribe stage alone, from a test start
  for (const diet of ["plant", "meat"]) for (const seed of [11, 12]) { const S = C.testStart(C.newSave({ name: "Bot", diet, seed }), "land0"); S.land.done = true; S.landNature = ["mixed", "friendly", "fierce"][seed % 3]; runTribe(S, diet, seed); }
  console.log("tribe:", tribeOut.join(", ")); process.exit(bad ? 1 : 0);
}
for (const diet of process.argv.includes("--civ") ? [] : ["plant", "meat"]) for (const seed of [11, 12]) { // (--civ: only the civilisation and space stages)
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
  let lg = 0, dead = 0, rally = 0, scatter = 0, nests = 0, safe = 0, goals = 0;
  while (!L.done && S.time - t1 < 9000 && lg++ < 9000 * 20) {
    landBot(LW, diet, B); C.stepWorld(LW, 1 / 20, {});
    for (const e of LW.ev) {
      if (e.t === "mate") { evolve(LW, diet); B.evoT = LW.t; }
      if (e.t === "meet") landMeet(LW, diet, e.c);
      if (e.t === "die") { dead++; L.deaths++; C.respawn(LW); }
      if (e.t === "rally") rally++; if (e.t === "scatter") scatter++; if (e.t === "nestWon") nests++; if (e.t === "safe") safe = 1; if (e.t === "goal") goals++;
    }
    LW.ev.length = 0;
  }
  const lmin = Math.round((S.time - t1) / 60), fr = LW.lsp.filter(x => C.lspStatus(L, x.i) === "friend").length, gone = LW.lsp.filter(x => C.lspStatus(L, x.i) === "gone").length;
  if (!L.done) { bad++; console.error(`life: the ${diet} eater bot (seed ${seed}) didn't finish the land stage in 150 min (brain ${Math.round(L.grow)}, ${fr} friends, ${gone} hunted out)`); continue; }
  if (lmin < 12) { bad++; console.error(`life: the ${diet} eater bot (seed ${seed}) finished the land stage in ${lmin} min: too quick`); }
  landOut.push(`${diet} ${lmin} min (${fr} befriended, ${gone} hunted, ${nests} nests raided, ${goals} goals, ${safe ? "escaped the eruption" : "caught by the eruption"}, ${dead} deaths)`);
  if (verbose) console.log("land groups", diet, seed, "rallied", rally, "scattered", scatter);
  runTribe(S, diet, seed);
  if (verbose) console.log("land", diet, seed, "done", lmin, "min; friends", fr, "hunted", gone, "epics", JSON.stringify(L.epics), "deaths", dead, "evolves", L.evolves, "dna", Math.round(L.dna), "lean", L.lean.toFixed(2), "nature", S.landNature);
  if (verbose) console.log("sea", diet, seed, "sizes at", sizeAt.join(", "), "min; done", min, "min; deaths", c.deaths, "kills", c.kills, "goals", Object.keys(c.goals).join(" "), "lean", c.lean.toFixed(2), "young", c.young, "dna left", Math.round(c.dna));
}
// the civilisation stage: a player who grows towns, claims places, makes friends of the gentle nations, fights the warlike one
// and wins towns by war, faith and the arts; it must unite the islands in under two hours (and not in under 15 minutes)
const civOut = [];
const spaceOut = [];
const SPL = new Function(core[1] + ";return {newSave, newWorld, stepWorld, testStart, spFly, spRoute, spAct, spGo, spNear, spDiplo, spSaveShip, spCost, spAbil, spRespawn, spStar, spColCost, plXY, pKey, spOwner, spTA, spFit, spLife, hostile, vStats, vUnlocked, VPD, SPACE_GOALS};")();
// the space stage: a player who explores, scans, collects creatures, settles and shapes worlds, sells goods,
// does missions, makes friends of most empires, fights the ones that won't be friends, then flies to the Core
function spBestShip(W) {
  const L = SPL, un = id => L.vUnlocked(W, L.VPD[id]), len = 6, p = [];
  const T = ["warp", "scanner", "shield", "missile", "laser", "laser"].filter(un), B = ["thrust", "thrust", "beam", "shaper", "seeder", "reactor"].filter(un), Sd = ["plate", "plate", "laser", "laser", "laser", "pod"].filter(un);
  for (let c = 0; c < len; c++) { if (T[c]) p.push({ id: T[c], c, s: "t" }); else p.push({ id: "laser", c, s: "t" }); p.push({ id: B[c] || "pod", c, s: "b" }); p.push({ id: Sd[c] || "plate", c, s: "s" }); }
  return { n: "Bot", k: "space", len, p };
}
function spaceBot(W, B) {
  const L = SPL, X = W.S.space, G = W.G, sy = W.sys, vs = W.vs, mine = k => L.spOwner(X, k) === 0;
  if (W.dead) { W.dead = false; L.spRespawn(W); return; }
  if (X.travel) return;
  const myStars = [...new Set(Object.keys(X.pown).filter(k => X.pown[k] === 0).map(k => +k.split(":")[0]))];
  if (sy) { const foes = sy.ships.filter(e => L.hostile(X, e));
    if (foes.length) {
      if (X.hp < vs.hp * .5) L.spAbil(W, "repair"); L.spAbil(W, "missile");
      if (X.hp < vs.hp * .25) { const to = myStars.filter(n => n !== sy.n)[0]; if (to != null && !L.spFly(W, to)) return; }
      let t = null, bd = 1e9; for (const e of foes) { const d = Math.hypot(e.x - W.ship.x, e.y - W.ship.y); if (d < bd) { bd = d; t = e; } } W.ship.tg = t.id; return; } }
  // a better ship, at one of your worlds
  if (sy && sy.n >= 0 && myStars.includes(sy.n) && W.t - (B.shipT || -999) > 120) { B.shipT = W.t; const d = spBestShip(W), c = Math.max(0, L.spCost(d) - L.spCost(X.d)); if (c > 0 && X.cr > c + 120) { const e = L.spSaveShip(W, d); if (!e) B.ships = (B.ships || 0) + 1; } }
  // the empires
  for (let k = 1; k <= 6; k++) { const E = X.emp[k], tr = G.emp[k].trait; if (!E.met || E.gone) continue;
    if (E.mis && (E.mis.ty === "goods" || E.mis.ty === "zoo")) L.spDiplo(W, k, "hand");
    if (E.war && tr !== "war" && E.rel > -70) L.spDiplo(W, k, "peace");
    if (!E.war && E.rel >= 60 && !E.ally) L.spDiplo(W, k, "ally");
    if (!E.war && !E.ally && X.relic && tr === "faith") L.spDiplo(W, k, "relic");
    if (!E.war && !E.ally && E.rel >= 0 && E.rel < 25 && X.cr > 500) L.spDiplo(W, k, "gift");
    if (!E.war && !E.ally && tr === "war" && E.rel < -20 && X.t > 1800 && vs.dmg >= 30) L.spDiplo(W, k, "war"); }
  // jobs at this star's planets
  const keepG = X.emp.reduce((a, E) => a + (E && E.mis && E.mis.ty === "goods" ? E.mis.n : 0), 0);
  if (sy && sy.n >= 0) {
    const s = L.spStar(W, sy.n), keepCr = 60;
    for (const p of s.pl) { const key = L.pKey(s.n, p.k), own = L.spOwner(X, key), [T, A] = L.spTA(X, s, p), E = own > 0 ? X.emp[own] : null, c = X.col[key], life = L.spLife(X, s, p), gl = Object.values(X.goods).reduce((a, b) => a + b, 0);
      const jobs = [];
      if (vs.scan && !X.scan[key]) jobs.push("scan");
      if (X.scan[key] && p.ruin && !X.dug[key] && own <= 0) jobs.push("dig");
      if (vs.beam && life >= 2 && !X.zoo.some(z => z.k === key) && X.en >= 25 && own <= 0) jobs.push("beam");
      if (vs.shape && own <= 0 && p.ty !== "gas" && (T !== 2 || A !== 2) && L.spFit(p, [T, A]) <= 4 && X.cr > 80 && X.en >= 40 && (own === 0 || myStars.length < 9)) jobs.push("shape");
      if (own < 0 && p.ty !== "gas" && Math.abs(T - 2) <= 1 && Math.abs(A - 2) <= 1 && X.cr >= L.spColCost(X) + keepCr && myStars.length < 10 && !s.pl.some(q => L.spOwner(X, L.pKey(s.n, q.k)) > 0)) jobs.push("colony");
      if (vs.seed && own === 0 && T === 2 && A === 2 && life < 3 && X.zoo.length >= (life + 1) * 2) jobs.push("seed");
      if (own === 0 && c.lvl < 3 && X.cr > 150 * c.lvl + keepCr && (c.lvl < 2 || (T === 2 && A === 2))) jobs.push("up");
      if (own === 0 && (c.tur || 0) < (X.t > 1500 ? 2 : 1) && X.cr > 250) jobs.push("tur");
      if (E && !E.war && !E.gone && gl - keepG >= 10) jobs.push("sell");
      if (E && E.war) jobs.push("atk");
      for (const j of jobs) { if (j === "atk") { L.spAct(W, p.k, "atk"); return; } if (L.spNear(W, p.k)) { const e = L.spAct(W, p.k, j); if (!e) return; } else { const [x, y] = L.plXY(X, p); L.spGo(W, x, y); return; } }
    }
  }
  // where next
  const at = L.spStar(W, X.at), dist = n => { const s = L.spStar(W, n); return Math.hypot(s.x - at.x, s.y - at.y); }, go = n => n != null && n !== X.at && !L.spFly(W, n);
  if (X.united && X.core < 2) { if (go(-1)) return; }
  for (let k = 1; k <= 6; k++) { const m = X.emp[k].mis; if (m && (m.ty === "visit" || m.ty === "band") && go(m.star)) return; }
  for (const r of X.pir) if (W.t - (B.pirT || -999) > 60 && go(r.at)) { B.pirT = W.t; return; }
  for (const f of X.fleets) if (f.t >= f.dur && go(f.to)) return;
  const gl = Object.values(X.goods).reduce((a, b) => a + b, 0);
  if (gl >= 30) { const tgt = G.st.filter(s => s.pl.some(p => { const o = L.spOwner(X, L.pKey(s.n, p.k)); return o > 0 && X.emp[o].met && !X.emp[o].war; })).sort((a, b) => dist(a.n) - dist(b.n))[0]; if (tgt && go(tgt.n)) return; }
  const war = G.st.filter(s => s.pl.some(p => { const o = L.spOwner(X, L.pKey(s.n, p.k)); return o > 0 && X.emp[o].war; })).sort((a, b) => dist(a.n) - dist(b.n))[0]; if (war && vs.dmg >= 30 && go(war.n)) return;
  const jobsAt = s => s.pl.some(p => { const key = L.pKey(s.n, p.k), own = L.spOwner(X, key), [T, A] = L.spTA(X, s, p); return (vs.scan && !X.scan[key]) || (vs.beam && L.spLife(X, s, p) >= 2 && own <= 0 && !X.zoo.some(z => z.k === key)) || (own < 0 && p.ty !== "gas" && Math.abs(T - 2) <= 1 && Math.abs(A - 2) <= 1 && X.cr > L.spColCost(X) + 60 && myStars.length < 10); });
  const nx = G.st.filter(s => s.n !== X.at && (!X.vis[s.n] || jobsAt(s))).sort((a, b) => dist(a.n) - dist(b.n));
  for (const s of nx.slice(0, 4)) if (go(s.n)) return;
  // nothing to do: meet everyone (fly to the nearest empire not met yet)
  for (let k = 1; k <= 6; k++) if (!X.emp[k].met && go(G.emp[k].home)) return;
  const home = myStars.filter(n => n !== X.at)[Math.floor(W.t / 300) % Math.max(1, myStars.length)]; go(home);
}

// the space stage, from the Sky Ship's launch: it must unite the galaxy and beat the Warden in under four hours (not under 20 minutes)
function runSpace(S, seed) {
  const L = SPL, W = L.newWorld(S, seed), X = S.space, B = {}; let s = 0;
  for (; s < 240 * 60 && !X.done; s++) { for (let k = 0; k < 4; k++) L.stepWorld(W, .25, {}); W.ev.length = 0; if (s % 2 === 0) spaceBot(W, B); }
  const min = Math.round(s / 60);
  if (!X.done) { bad++; console.error(`life: the space bot (seed ${seed}) didn't reach the Core in 4 hours (${X.emp.slice(1).filter(E => E.ally || E.gone).length} of 6 empires won over, ${Object.keys(X.goals).length} goals)`); }
  else if (min < 20) { bad++; console.error(`life: the space bot (seed ${seed}) finished in ${min} min: too quick`); }
  spaceOut.push(`done in ${min} min (${X.how.ally} allies, ${X.how.war} worlds taken, ${Object.values(X.pown).filter(o => o === 0).length} worlds, ${Object.keys(X.goals).length} of ${L.SPACE_GOALS.length} goals, ${X.deaths} deaths)`);
}
{ const C = new Function(core[1] + ";return {newSave, newWorld, stepWorld, testStart, civBuild, civCan, civSettle, civFree, civHas, civCap, civSend, civClaim, civDiplo, civTrade, civOffer, civSetPol, civSaveDesign, civLaunch, skyStarter, ownTowns, CIV_GOALS};")();
function civDesigns(W, V) { // the bot's own vehicles: war wagons and warships once it has barracks and a mine, bell carts and stage carts for faith and the arts
  const has = k => C.ownTowns(V, 0).some(t => C.civHas(t, k)), want = [], w = (c, id) => ({ id, c, s: "b" });
  if (has("barracks") && has("mine")) want.push({ n: "War wagon", k: "cart", len: 3, p: [w(0, "iwheel"), w(2, "iwheel"), { id: "cannon", c: 1, s: "s" }, { id: "armour", c: 2, s: "s" }, { id: "ram", c: 0, s: "t" }] },
    { n: "Warship", k: "ship", len: 3, p: [{ id: "sail", c: 0, s: "t" }, { id: "sail", c: 2, s: "t" }, { id: "cannon", c: 1, s: "s" }, { id: "keel", c: 1, s: "b" }] });
  if (has("temple")) want.push({ n: "Bell cart", k: "cart", len: 2, p: [w(0, "wheel"), w(1, "wheel"), { id: "bell", c: 0, s: "t" }] }, { n: "Temple ship", k: "ship", len: 3, p: [{ id: "sail", c: 0, s: "t" }, { id: "bell", c: 1, s: "t" }, { id: "oars", c: 2, s: "s" }] });
  if (has("theatre")) want.push({ n: "Show cart", k: "cart", len: 2, p: [w(0, "wheel"), w(1, "wheel"), { id: "stage", c: 0, s: "t" }, { id: "banner", c: 1, s: "t" }] }, { n: "Show boat", k: "ship", len: 3, p: [{ id: "sail", c: 0, s: "t" }, { id: "stage", c: 1, s: "t" }, { id: "banner", c: 2, s: "t" }] });
  for (const d of want) if (!V.vd.some(x => x.n === d.n)) C.civSaveDesign(W, -1, d);
}
function civBot(W, V, s) {
  const mine = C.ownTowns(V, 0), R = V.res; civDesigns(W, V);
  if (V.offer) C.civOffer(W, true);
  for (const tw of mine) { if (tw.b.some(b => !b.done)) continue;
    let k = null; if (tw.near.coast && !C.civHas(tw, "dock") && !C.civCan(V, tw, "dock") && !mine.some(t => C.civHas(t, "dock"))) k = "dock"; else if (R.food < 60 || (C.civHas(tw, "farm") < Math.ceil(tw.pop / 9) && R.food < 300)) k = "farm"; else if (tw.pop >= C.civCap(tw) - 1) k = "house";
    else for (const k2 of ["mill", "quarry", "temple", "dock", "theatre", "barracks", "market", "mine", "glow", "wall"]) if (!C.civHas(tw, k2) && !C.civCan(V, tw, k2) && !tw.b.some(b => b.k === k2)) { k = k2; break; }
    if (k && !C.civCan(V, tw, k)) C.civBuild(W, tw, k); else for (const k2 of ["farm", "house", "mill", "quarry"]) if (!C.civCan(V, tw, k2)) { C.civBuild(W, tw, k2); break; }
    const free = C.civFree(W, -1); if (free.length && tw.pop >= 12 && R.food > 60) { for (const f of free) if (!C.civSettle(W, tw, f.n)) break; } }
  // claim what's free and reachable
  for (const sp of W.spots) if (!V.claims[sp.n] && R.wood > 80) C.civClaim(W, 0, sp.n);
  // be friends with the gentle nations, at war with the warlike one once strong
  for (let k = 1; k <= 3; k++) { const N = V.nat[k]; if (N.gone) continue;
    if (N.trait !== "war" && !N.war && N.rel < 60 && R.gold > 150) C.civDiplo(W, k, "gift");
    if (N.trait !== "war" && N.rel >= 60 && !N.ally) C.civDiplo(W, k, "ally");
    if (N.war && N.trait !== "war") C.civDiplo(W, k, "peace");
    if (N.trait === "war" && !N.war && s > 900 && C.ownTowns(V, 0).some(t => C.civHas(t, "barracks") && C.civHas(t, "dock"))) C.civDiplo(W, k, "war");
  }
  // win towns: armies at war targets, faith and festivals at the rest
  const tg = V.towns.filter(t => t.own > 0);
  for (const t of tg) { const N = V.nat[t.own];
    if (N.war && R.gold > 60 && R.ore > 20 && V.units.filter(u => u.own === 0 && u.k === "army").length < 5) C.civSend(W, 0, "army", { t: "town", id: t.id });
    else if (!N.ally && R.incense >= 12 && R.gold > 40) C.civSend(W, 0, "miss", { t: "town", id: t.id });
    else if (!N.ally && R.dye >= 12 && R.gold > 40) C.civSend(W, 0, "fest", { t: "town", id: t.id }); }
  // allies too: once they're the last ones left, win them over with faith and the arts
  if (V.nat.slice(1).filter(n => !n.gone).every(n => n.ally)) for (const t of tg) { if (R.incense >= 12 && R.gold > 40) C.civSend(W, 0, "miss", { t: "town", id: t.id }); if (R.dye >= 12 && R.gold > 40) C.civSend(W, 0, "fest", { t: "town", id: t.id }); }
}
  for (const seed of [3, 7]) {
    let S = C.newSave({ name: "Bot", diet: "plant", seed }); S = C.testStart(S, "civ0"); const W = C.newWorld(S, seed), V = S.civ; let s = 0;
    for (; s < 120 * 60 && !V.won; s++) { C.stepWorld(W, .5, {}); C.stepWorld(W, .5, {}); W.ev.length = 0; if (s % 5 === 0) civBot(W, V, s); }
    const min = Math.round(s / 60);
    // then the Sky Port and the launch
    let t2 = 0; for (; t2 < 40 * 60 && S.stage === "civ" && V.won; t2++) { C.stepWorld(W, .5, {}); C.stepWorld(W, .5, {}); W.ev.length = 0; if (t2 % 5) continue; civBot(W, V, s + t2);
      const cap = C.ownTowns(V, 0).find(t => t.cap); if (cap && !cap.b.some(b => b.k === "skyport")) C.civBuild(W, cap, "skyport"); if (C.ownTowns(V, 0).some(t => C.civHas(t, "skyport"))) C.civLaunch(W, C.skyStarter()); }
    if (V.won && S.stage !== "space") { bad++; console.error(`life: the civilisation bot (seed ${seed}) couldn't build the Sky Port and launch in 40 minutes`); }
    if (S.stage === "space") runSpace(S, seed);
    if (!V.won) { bad++; console.error(`life: the civilisation bot (seed ${seed}) didn't unite the islands in 2 hours (${C.ownTowns(V, 0).length} of ${V.towns.length} towns)`); }
    else if (min < 15) { bad++; console.error(`life: the civilisation bot (seed ${seed}) united the islands in ${min} min: too quick`); }
    civOut.push(`united in ${min} min (by war ${V.how.war}, faith ${V.how.faith}, arts ${V.how.arts}; ${Object.keys(V.goals).length} of ${C.CIV_GOALS.length} goals; ${V.vd.length} vehicle designs; launched ${Math.round(t2 / 60)} min later)`);
  } }
if (bad) process.exit(1);
console.log("life: cell stage finished by bots: " + out.join(", ") + "; sea stage: " + seaOut.join(", ") + "; land stage: " + landOut.join(", ") + "; tribe stage: " + tribeOut.join(", ") + "; civilisation: " + civOut.join(", ") + "; space: " + spaceOut.join(", "));
