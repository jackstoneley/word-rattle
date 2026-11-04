// Checks Epoch Siege: the battle rules run, and the computer playing the player's side at Normal settles every
// battle (no stalemates) against each enemy difficulty, with and without crowd fighting. Randomness is seeded so the check gives the same answer
// every time. Run by tools/build.py: node tools/epoch-siege-check.js [games per difficulty] [-v]
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "games", "epoch-siege", "index.html"), "utf8");
const core = html.match(/\/\*CORE-START\*\/([\s\S]*?)\/\*CORE-END\*\//);
if (!core) { console.error("epoch-siege: CORE not found"); process.exit(1); }
let seed = 1;
const SeededMath = Object.create(Math);
SeededMath.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const C = new Function("Math", core[1] + ";return {newGame, step, DIFF, STAT, KIND};")(SeededMath);
const N = +process.argv[2] || 2, verbose = process.argv.includes("-v");
let bad = 0;
if (C.STAT.length !== 6 || C.STAT.some(r => r.length !== C.KIND.length || r.some(u => !(u.cost > 0 && u.hp > 0 && u.n)))) { console.error("epoch-siege: unit table is malformed"); bad++; }
const out = [];
for (let d = 0; d < 4; d++) {
  let wins = 0; const times = [];
  for (let g = 0; g <= N; g++) { // the last battle of each set uses crowd fighting
    seed = 1000 * d + g + 1;
    const S = C.newGame({ diff: d, botDiff: 1, era: 0, crowd: g === N });
    while (S.over < 0 && S.t < 3600) { C.step(S, 1 / 15); S.ev.length = 0; }
    if (S.over < 0) { bad++; console.error(`epoch-siege: stalemate after an hour vs ${C.DIFF[d].n} (ages ${S.sd[0].era}/${S.sd[1].era})`); continue; }
    if (S.over === 0) wins++;
    times.push(Math.round(S.t / 60));
    if (verbose) console.log(C.DIFF[d].n, S.over === 0 ? "won" : "lost", Math.round(S.t / 60) + " min", "ages", S.sd[0].era, S.sd[1].era);
  }
  out.push(`${C.DIFF[d].n} won ${wins}/${N + 1} (${times.join(", ")} min)`);
}
if (bad) process.exit(1);
console.log("epoch-siege: Normal computer vs " + out.join("; "));
