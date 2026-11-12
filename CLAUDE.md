# Stoneley Games: guide for Claude Code

A home page plus fourteen self-contained HTML games, published two ways:

| Name on screen | Folder / code name | Saved-data prefix |
| --- | --- | --- |
| Word Rattle | `games/word-rattle` | `wr.` |
| Link Up | `games/link-up` | `lu.` |
| Kakuro | `games/cross-sums` (Cross Sums) | `kk.` |
| Gem Tower Defence | `games/gem-bastion` (Gem Bastion) | `gembastion.` |
| Topple | `games/topple` | `tp.` |
| Buddy Breakout | `games/mudlark` (Mudlark) | `ml.` |
| Boxed In | `games/boxed-in` | `bi.` |
| Echo Cartographer | `games/echo-cartographer` | `ec.` |
| Buddy's Big Slide | `games/big-slide` | `slide.` |
| Lee Lee's Kitchen | `games/lee-lee` | `ll.` |
| Gravity Well | `games/gravity-well` | `gw.` |
| Epoch Siege | `games/epoch-siege` | `es.` |
| Hollowdeep | `games/hollowdeep` | `hd.` |
| Life | `games/life` | `lf.` |

The folder names, saved-data prefixes and code names stay as they are even though the on-screen names
changed: renaming them would break saved games and old links.

- **Website** (GitHub Pages, from the `main` branch root): https://jackstoneley.github.io/word-rattle/
- **Android app** (Capacitor wrapper), built by GitHub Actions on every push and published to the
  `latest` GitHub release. The app's **Check for updates** button installs new builds itself.

The owner (Jack) and his wife play on Android phones. They are not developers: explain changes in plain
words, and describe how to get the update on their phones (open the app, tap Check for updates).

## Layout

```
index.html                 Home page ("hub"): Today's puzzles, Carry on, grouped game tiles with progress, backup/restore, app updates
shell.js                   Loaded at the end of every game: back button routing, offline service worker, links
sw.js                      Website offline cache. VERSION is stamped by tools/build.py; never edit by hand
manifest.webmanifest, *.png  Website install metadata and icons
games/<id>/index.html      One self-contained game per folder (all CSS/JS inline)
games/word-rattle/src/     Word Rattle source: template.html + words.txt + common.txt -> built index.html
tools/build.py             Build step. Run after ANY change, before committing
tools/big-slide-check.js   Rides every Big Slide level's answer (run by build.py)
tools/gravity-well-check.js  Checks every Gravity Well level can be won (run by build.py)
tools/epoch-siege-check.js   Computer-vs-computer Epoch Siege battles must all finish (run by build.py)
tools/life-check.js          Bots must finish Life's cell stage as a plant and a meat eater (run by build.py)
release-notes.json         What's new in each release; shown in the app's update banner
android-app/               Capacitor project: config, native plugin, build scripts, icons, signing key
.github/workflows/android.yml  Builds the APK and replaces the "latest" release
```

## Release notes (the app's update banner)

When a change is worth telling the players about, add an entry to `release-notes.json` with the next `id`:

```json
{ "id": 2, "type": "features", "headline": "Word Rattle: hints", "details": ["Short plain sentence", "..."] }
```

`type` is `new-game`, `features` or `fixes`. The app compares the notes it was built with against the live copy
on the website and shows the newer entries in the banner ("New game", "New features" or "Fixes"), so write
headlines and details for the players, not for developers. The GitHub release text uses the newest entry.

## The one rule

**Run `python3 tools/build.py` after every change and commit what it produces.** It rebuilds Word Rattle
from its template, restamps `sw.js` so phones fetch the new version, and checks every page's JavaScript
parses. The GitHub workflow fails if the committed files are out of date.

Never edit `games/word-rattle/index.html` directly: edit `games/word-rattle/src/template.html` (the word
list is injected at `__WORDS__`).

## Working on a game

- Each game must work as a single page with no build step of its own (Word Rattle's word list is the only
  exception) and no network needed, apart from optional features (Google Fonts, PeerJS for online live play).
- Saved data lives in `localStorage` on the phone. Each game owns a key prefix:
  `wr.` (Word Rattle), `kk.` (Cross Sums), `gembastion.` (Gem Bastion). A new game needs its own prefix,
  added to `PREFIXES` in the hub's backup code and, if useful, a progress line in `renderStats()` there.
- The hub lays games out as: **Today's puzzles** (`TODAY` in the hub script: each daily game's done-today check, keyed
  by that game's own day number; Word Rattle and Kakuro instead note today's daily in `wr.today` / `kk.today` when
  their menu shows), **Carry on** (the two most recent entries of `sg.recent`, `{game folder: time}`,
  which `shell.js` writes whenever a game page opens; the hub owns the `sg.` prefix), then tiles in four groups
  (Words & numbers, Puzzles, Strategy, Action & easy-going). Backup and app updates sit in a folded section at the bottom.
- **Never break saved data.** Keep reading old shapes; migrate on load if a format must change.
- End every game page with `<script src="../../shell.js"></script>` and give it a `← All games` link to
  `../../index.html`. For the phone's back button, define `window.SG_BACK = () => { ... }`: return `true`
  if the game handled it (closed a dialog, left a sub-screen), `false` to go back to the games list.
- In the app, `window.SG_APP` (and `window.WR_APP`) is `true`, and the native plugin is
  `Capacitor.registerPlugin("WordRattle")` (the name is historical; it serves every game).

### Link Up (`games/link-up`)

A daily connections puzzle (NYT difficulty, not the TV wall). Puzzles live in the
`<script type="application/json" id="puzzles">` block: a list of puzzles, each four groups
`{"l": 1-4, "c": "Group name", "w": [four words]}`, level 1 easiest (yellow) to 4 trickiest (purple, usually
wordplay). Puzzle #1 is 28 October 2026 and the daily puzzle cycles through the list, so **append** new
puzzles (never reorder or edit old ones: saved games are keyed by puzzle number). Each word must fit only one
group, unless it is a deliberate red herring that the other groups rule out. `tools/build.py` checks the shape.

- **Two sets.** List entries 1-50 are the first, gentler set (daily #1-11 used them). From #12 (8 November 2026)
  `puzzleFor` cycles through entries 51 onwards, the trickier set, NYT style: each group may carry `"r"`, words from
  *other* groups that also fit it (red herrings). `tools/build.py` checks every board with `r` still has exactly one
  answer, and that each trickier puzzle has at least two red herrings. Write new puzzles this way, with honest `r`
  lists, and append them.

- **Bonus puzzles** live in the `id="bonus"` block (same shape). They are never used as daily puzzles; saved games
  are keyed by bonus number in `lu.bonus`, so append only here too.
- **Boards people make** (`lu.mine`, received ones in `lu.shared`, their games in `lu.cgames` keyed by board id).
  There is no server: a board travels as a link, `SITE_URL#lu.` + base64url(JSON `[1, title, author,
  [[group, [4 words]] x4]]`, yellow first). The hub and `shell.js` send `#lu.…` links to Link Up and every other
  link to Word Rattle (apart from `#sl.…` Big Slide tracks); Word Rattle forwards any `lu.` or `sl.` code it gets. Keep that link format readable forever.

### Topple (`games/topple`)

A block-rolling puzzle (after Bloxorz). Levels live in the `<script type="application/json" id="levels">` block:
`m` rows of tile codes, `s` start, `w` switches, `p` par (fewest moves, found by the solver). The code between
`/*CORE-START*/` and `/*CORE-END*/` (rules, solver, level generator) has no page dependencies, so a Node script can
run it to make and check levels. **Append** levels only: progress (`tp.levels`) is keyed by level number. The daily
puzzle (`tp.daily`, keyed by day number from 30 October 2026) is generated on the phone from the date, so changing
`generate` or `dailyLevel` changes every future daily board: don't, without a plan.
Tiles beyond the originals: `c` crumbly (falls away once the block leaves it; its fallen state is a bit in the mask after
the bridges), `i` ice (a block wholly on ice slides on until part of it has grip), `p` teleport pads, paired in the
level's optional `t` list `[[x1,y1,x2,y2]]` (standing on one jumps to the other). The generator only places these when
its options ask (`crumble`, `ice`, `icePatches`, `tele`), so the daily board is unaffected: keep any new generator step
behind an option that the daily doesn't set. **Endless climb**: board k is `climbLevel(k)`, made from its number (the same
for everyone); the move limit is `climbLimit`. Saved as `tp.climb` (`best`, `runs`, `run: {k, lives, moves, path}`), where
`path` replays the block's position on the current board. Changing `generate` for those options or `climbLevel` changes
the climb boards. `tools/topple-check.js` (run by build.py) checks every level's par and the first 40 climb boards.

### Buddy Breakout (`games/mudlark`, first called Mudlark)

A launch-and-upgrade game (after Learn to Fly): Buddy, the owners' white labradoodle, slides down a mud slope and flies
to a group of lady dogs in a dog park at 3,000 m (landing from `MEET` on reaches them; flying past them makes him panic). Upgrades,
goals, flight physics and earnings sit between `/*CORE-START*/` and `/*CORE-END*/` with no page dependencies, so a
Node script can fly a simple pilot through a whole career to check the balance (about four weeks of game days to reach
the lady dogs at 3,000 m). Saved game: `ml.save` (`day`, `cash`, `upg` levels, `goals` reached, `best`, `done` day).
Upgrade lists may grow at the end; never reorder them, since saves hold level numbers.

### Boxed In (`games/boxed-in`)

A top-down zombie survival game (after Boxhead), single player with auto-aim: the gun fires at the nearest enemy in
line of sight, the player only moves (a floating thumb stick on the left). Arenas are strings in `MAPS` and are turned
on their side on tall screens. Weapons unlock by score within a run (`WEAPONS[].at`). Saved data: `bi.best`, the best
wave, score and kills per arena index; an arena opens when the one before it has a best wave above 8, so append arenas.

### Echo Cartographer (`games/echo-cartographer`)

A memory maze in the dark: a ping lights the walls the dot can see (rays, so corners hide walls), then they fade.
Levels 1-30 and the daily maze (`ec.daily`, day number from 30 October 2026) are generated on the phone from their
number by the code between `/*CORE-START*/` and `/*CORE-END*/`; changing `makeMaze`, `levelSpec` or `makeLevel` changes
every board, so don't, without a plan. Progress: `ec.levels` keyed by level number (`stars`, `bumps`, `pings`, `at`).
Stars come from bumps (walking into walls).

### Buddy's Big Slide (`games/big-slide`)

A draw-a-track game (in the spirit of Line Rider): the player draws lines, presses Play, and Buddy rides his sledge down
them. Physics, the daily generator and star rules sit between `/*CORE-START*/` and `/*CORE-END*/` with no page
dependencies (only + - * / and `Math.sqrt`, so a track rides the same on every phone). Lines are `{t, s, p}`: type
0 track / 1 boost / 2 scenery, solid side `s` (the side facing up; loops work when drawn anticlockwise in one go), points.
Challenge levels live in the `<script type="application/json" id="levelData">` block: `n` name, `tip`, `s` start, `f`
flag, `b` bones, `g` fixed grey lines, `z` flowerbeds (no drawing), `x` thorn bushes, `h` an answer, `p` par ink,
optional `lim` ink limit. `tools/big-slide-check.js` (run by build.py) rides every answer, so a new level needs an
answer that reaches the flag with every bone within par. **Append** levels only: progress (`slide.levels`) is keyed by
level number. The daily slide (`slide.daily`, day 1 is 30 October 2026) is generated from the date by `dailyLevel`:
changing it, or the physics, changes every future daily. Other saved data: `slide.work` (drawings in progress),
`slide.tracks` and `slide.shared` (own and received tracks), `slide.name`. Tracks travel as links,
`SITE_URL#sl.` + `z` base64url(deflate-raw JSON) or `j` base64url(JSON), JSON `[1, title, author, startX, startY,
[[type, side, x0, y0, dx1, dy1, ...], ...]]`; the hub, `shell.js`, Word Rattle and Link Up send `#sl.…` links here.
Keep that format readable forever.

### Lee Lee's Kitchen (`games/lee-lee`)

A relaxed cooking and restaurant-management game (in the spirit of PlateUp, gentler). Lee Lee (slim, light brown skin, dark
bun, coral headband and top) is the player: tap anything and she walks to it. Customers sit, order (📝), wait, eat, pay and
leave dirty plates; dishes are recipes of station steps (`RECIPES[].s`, ending in `plate` at the counter). Stations are `get`
(fridge), `act` (hands-on: chop / mix / pour mini-games, or timed when mini-games are off) and `pas` (cooks alone, burns after
`b` seconds). Two venues: `cafe` (daytime) and `pub` (evening, pints, rowdy customers late on). Staff roles (`waiter`,
`porter`, `cook`, `drinks`, `floor`) run their own task loops in `staffThink`. Data and economy sit between
`/*CORE-START*/` and `/*CORE-END*/`. Five save slots, `ll.slot.0`-`ll.slot.4` (whole save object per slot; `migrate()` fills
missing fields, so new fields need a default in `newSave`), plus `ll.opts` (`mini`). A day is not saved until it ends. Lists
like `RECIPES`, `STATIONS`, `CAMPAIGNS`, `DECOR` are keyed by id or index in saves (`owned`, `stations`, `decor` level):
append, never reorder or rename ids. `window.LL` exposes the day for Playwright bots (`step(dt)`, `leeTap(target)`,
`playLevel(i)`). The counter has six put-down spots (`G.spots`) and `top` (worktop) stations hold one item; free play tops up
stock automatically (`autoStock`). **Campaign**: `CHAPTERS` and `LEVELS` (in CORE) define fixed days (menu, stations, tables,
staff, `people`, goals `[kind, n]`, the first must be met); arrivals come from `levelArrivals(i)` with a seeded random, so a
level is the same every time. Progress is `ll.camp` `{s: {level index: stars}}`, so append levels only. A campaign day uses a
throwaway save (`slot = -1`, `LV` set) and never touches the free-play slots.
Learning and balance: `coachNext()` is the "what would a good player do next" planner behind the green helper arrow
(`opts.help` auto/on/off; auto shows it always in campaign days 1-5 and free-play days 1-3, later after ~5 s idle). A bot
that only follows `coachNext()` is the best balance test: run every campaign day with a 0 s and a 1 s reaction delay (all
should pass at 0 s; most at 1 s, the rest via the easier retry, `EASY`, offered after two fails in `ll.camp.f`, max 2 stars).
Free play has `S.diff` (index into `DIFFS`: patience, crowd, burn, tips, rep), two seeded daily goals (`dailyGoals`, cash
and rep rewards), rush warnings, a service streak (`G.streak` raises tips), end-of-day advice (`dayTips`, stored as
`S.last.advice`), WebAudio cues (`snd`, `opts.sound`), and campaign chapter certificates (+£75 start cash each).
Layout: `S.stations[i]` is the station in kitchen spot i (`slotPos(i)`) and may be `null` (an empty spot; use `kit()` for the
list without gaps); `S.tpos[j]` is table j's position in `TABLE_POS` (old saves get `0..n-1` in `migrate`). The office's
Rearrange map (`layout()`) swaps them. Drink recipes have no `plate` step (`plated(r)`), so they use no plate.

### Gravity Well (`games/gravity-well`)

A gravity golf puzzle: aim (angle in tenths of a degree, power 1-100%), launch, and every planet pulls the ball (acceleration
`m/d²`, negative `m` pushes) towards a target that is usually off screen. Physics, solver and level generators sit between
`/*CORE-START*/` and `/*CORE-END*/` (fixed step `DT`, the same flight on every phone). A level: `n` name, `s` start, `t` target
`[x,y,r]`, `p` planets `[x,y,r,m]` (small and very heavy ones are black holes, `isHole`), optional `o` moons `[planet, distance,
r, m, speed, phase]` (they restart from their phase on every shot), `c` stars to collect before the target counts, `w` wormhole
pairs `[x1,y1,x2,y2]`, `h` a known winning aim `[a, pw]`. Levels 1-30 (Classic, made with `generate`) and 31-60 (Deep Space)
live in the `id="levels"` block; Star Run levels in `id="starrun"`. Deep Space, Star Run, the daily orbit from day 4 and Voyage
systems come from `genField` + `findRoute`: a crowded field, then random aims until one winds a long way through it, the target
(and stars) placed on that path, kept only if near-miss aims also win and no easy (little-turning) shot gets there.
`tools/gravity-well-check.js` (run by build.py) checks every stored level's `h` still wins, and the first daily and voyage boards.
**Append** levels only: progress is keyed by number (`gw.levels`, `gw.stars`). The daily orbit (`gw.daily`, day 1 is 4 November
2026; days 1-3 use the old generator) and Voyage systems (`gw.voyage`: `best`, `runs`, `run: {k, left}`) are made on the phone
(in a Web Worker) from their number: changing the physics, `genField`, `findRoute`, `dailyLevel` or `voyageLevel` changes them.
`gw.tab` remembers the menu tab.

### Epoch Siege (`games/epoch-siege`)

A side-on base-against-base battle through six ages (in the genre of the old Flash age-war games, with its own units and art).
Rules, unit tables (`ERAS`, `KIND`, `TWEAK`, `TURK`, `UPG`), the fixed-step battle (`step`) and the enemy's brain
(`aiThink`) sit between `/*CORE-START*/` and `/*CORE-END*/`. Kinds per age: 0 fighter, 1 shooter, 2 heavy, 3 healer,
4 champion (one at a time, triple damage to bases). Stand-offs are broken by passive gold growing over the battle
(`warEconomy`), upgrades to level 10 with a 20-unit army cap, and in the last age the Star Lance (experience charges a
hit for a fifth of the enemy base). `tools/epoch-siege-check.js` (seeded, run by build.py) plays a Normal computer against
each difficulty and fails on any battle that lasts an hour. Saved data: `es.save` (the battle in progress, plain JSON of
the state minus projectiles), `es.stats` (`played`, `wins`/`losses`/`fast` per difficulty, `kills`), `es.opts`,
`es.meta` (`medals`, `earned`, `perks` {id: level 1-3}, `equip` [up to 3 ids], `gen` id, `camp` {mission index: {won,
st: [3 stars], best, tries}}).
Campaign, generals and perks live in CORE too: `MISSIONS` (battle options `o`, two star goals `g`: time / hp / lost),
`GENERALS` and `PERKS` (modifier sets, see `MOD0`; `addMods` stacks them, `loadoutMods` builds the player's side).
Each side carries its modifiers in `P.m` (`md(P)`, defaulting to `MOD0` for old saves). Missions are keyed by index,
generals and perks by id: append only. The Star Lance charges in the last age a battle allows (`topEra`), so missions
capped below the Future still end. Healing: a troop can be healed once per `HEAL_GAP`; shooters target healers in reach.
Lanes: battle option `lanes` (1 or 3). Each unit has `ln` (missing = 0); troops only meet, block, heal and splash
within their lane; defences and specials cover every lane. Queue items carry the lane chosen when they were bought
(`P.lane`, set by tapping a lane; the computer picks with `aiLane`). Bases are `LANE_BASE` times tougher with lanes,
crowds stand two deep. `opts.top` switches the page to the map view (`renderTop`), lanes running up the screen.
Generals level 1-5 from battle points in `es.meta.gx` (`GEN_PTS`; each general's `lv` lists what levels 2-5 add).
Missions 31-49 are three roads (`br`: iron, wild, fronts) that open after mission 30 (`req`), and a finale (`any`).
Saves hold era and kind numbers, so append to the tables, never reorder them.
Difficulty (`DIFF`): `inc`/`xp` multiply the computer's gold and experience, `pxp` is experience it earns each second,
and a computer side an age behind earns experience three times as fast (`xpMult`). Normal is meant to beat a good player
who doesn't plan: it was far too easy at 1x. Battle option `crowd` (Crowd fighting): troops stand in ranks of
`CROWD_RANK` (3) instead of single file, and up to three can leave the base at once.

### Hollowdeep (`games/hollowdeep`)

A dungeon-building strategy game (in the spirit of Dungeon Keeper, with its own names and look): the player never steers
units directly. They mark rock to dig (`mark` bit 2), paint rooms on their own floor, plant a rally flag, or pick up and
drop creatures. Diggers dig, claim floor next to their owner's and carry gold home; creatures come through owned Gates
when the rooms they need exist (`KINDS[].need`) and there is a free Lair bed, then sleep, eat, train and fight on their own.
Rival lords (owners 2-4, wild creatures are owner 5) use the same rules plus `aiThink` (expand, mine, build rooms, tunnel
to the player and raid in growing waves). Rules, map maker and AI sit between `/*CORE-START*/` and `/*CORE-END*/` with no page
dependencies, so a Node script can play whole games. Maps are made from `spec.seed`; campaign realms are `CAMPAIGN`
(append only: progress `hd.progress.won` is keyed by realm number). The game in progress is `hd.game` (`saveWorld`:
tile arrays as base64 plus units and lords; `loadWorld` must keep reading old saves, so new arrays default to empty). `window.HD` exposes the world for
Playwright. **Shapes**: `findFeats` turns 2x2 and 3x3 squares of one room into features (`FEATS[room][n-2]`: Big nest, Book stand,
Sparring ring, Workbench, Great forge, ...) that change what the room does; creature needs can name them (`"f:5"` any Library
feature, `"f:4:3"` a 3x3 Training feature). **Workshop**: blueprints `K.bp` (`{id,i,t:"t"|"d",k,st,p,at,by}`) are paid for when
planned, made by Tinkers and idle diggers (`craftAdd`), then fetched from a Workshop tile and fitted by a digger. Traps (`W.trap`,
`TRAPS`) and doors (`W.door`, `W.dhp`, `DOORS`) belong to the tile's owner and vanish if the tile is claimed. Doors block rivals'
movement (`moveAlong` sets `u.blocked`; creatures smash them), while searches for one owner pass `bo` so its own doors are open.
`ROOMS`, `TRAPS`, `DOORS` and `KINDS` are saved by index or key: append only.
**Land**: tiles also include `LAVA` (impassable), `WATER` (walkable at half speed, never claimed) and `STAIR` (heroes' way in);
`spec.theme` (earth, fire, deep, crystal) picks the palette and how much lava or water `newWorld` makes. Treasure hides in rock
(`W.treas`, paid out by `collapse(W,i,owner)`). Owner 6 is `HERO` (waves from `W.hero`, `spawnWave`, `heroThink`; Dwarves tunnel
with `digRouteFrom`), owner 7 is `NEUTRAL` (lost creatures that join whoever's floor or creature reaches them). `foe(u,o)` is the one
test for "can be fought". **Spells** (`SPELLS`, `castSpell`): mana `K.mana`, research `K.rp` from Library tiles and studying Hexers;
a spell is known once `K.rp >= rp`. **Possession**: `W.poss {id,dx,dy,atk}` set by the page, run by `possessTick`; never saved.
**Prisoners**: with a free Jail cell a beaten enemy gets `ko` instead of dying; diggers `drag` it to the Jail (`jail` = captor),
then to the Persuasion room, where `pers` reaching 50 converts it. Diggers: up to `DIG_SIDE` (3) per side of a rock (`W.digN`,
rebuilt each `recount`), and claims chain along lines (`chainClaim`). **Campaign**: 20 realms with `par` minutes and a third star
`s3`; `hd.progress.won[n]` is `{time, at, stars:[3]}` (old entries without `stars` count as one star).
Each realm's `adds` introduces rooms, creatures, traps/doors and spells; `campSpec(n)` builds the spec with `allow` (everything up to n),
saved in `W.spec`, and `allowed(W,cat,id)` gates building, arrivals (rivals too), lost creatures, traps and spells. The page shows locked
things with `unlockRealm`, and a `briefing` card opens each realm. Quick games and saves without `allow` allow everything.
**Rival brain** (`aiThink` → `aiWar`, `aiExpand`, `aiRooms`, `aiTraps`): each lord has a `persona` (builder, raider, schemer) that scales
growth, army size (`aiCap`, rising through the game) and boldness. They keep a wage `reserve`, spend surplus on rooms and defences,
expand all game towards gold, Gates, lost creatures and the map centre (forgetting unreachable marks), and go to war on the weakest
realm (`strength`): gather on their border (`phase` gather → march), retreat below 35% of the raid. A beaten realm's land and rooms
pass to the winner (`destroyRealm`). Any keeper raises `alarmAt` when enemy fighters enter its land near the Heart; creatures rush there.
**Old places** (`W.sites` `[{k, i, st, o, g, by}]`, `SITES` keyed by id: append only; old saves have none): made in `newWorld` from
their own random stream (`RS`), so adding them left every seed's map as it was: keep any new map feature on a separate stream too.
They sit about halfway between realms. A `tomb` has `wight` guardians (`g` counted in `siteCount`), can't be claimed while they stand,
and pays out once in `siteTaken` (called from `claimTile`). The others (`spring`, `idol`, `lode`, `well`) help whoever owns the tile
(`K.c.sites`, filled by `siteCount` in `recount`; effects in `keeperTick` and `hit`). Rivals dig to them in `aiExpand` and send their
army at a guarded tomb (`K.siteT`). **Events** (`W.evn {next, n, last}`, `worldEvent`, `EVENTS`: tremor, gold, swarm, band) fire every
few minutes except in the tips realm. **Rare creatures** (`rare`, `max` in `KINDS`; `"x:"` needs read `K.c.x` (`lava`, `dead`,
`found`) or `K.gold`): sporeling, shade, imp, ghoul, wyrm. A Shade (`sneak`) runs errands in `spyTick` (`u.sp {ph, o}`, not saved): it is
`hidden()` from targeting, Heart zaps, runes and spike pits until `spotted()` (a rival fighter within reach, a Watchtower, an alarm
bell, or being hit), passes rival doors, steals from a treasury and carries it home. The player picks who may come: `K.ban {kind: 1}`
(the Gates list in `openRealm`). Room art: `drawRoomTile` draws floors from world coordinates so patterns run across tiles, wall
furniture on tiles with no room above, and a sparse prop from a long list per tile hash.
**Research**: the player picks what the Library studies (`openResearch`, `setResearch`). `K.known {spell id: 1 known, 2 mastered}`,
`K.res` the spell being studied, `K.rpg` points in it; every gain goes through `spellCheck(W,K,before)`. `K.rp` stays the running
total, and a save without `known` gets it from `rp` and each spell's old threshold (`resInit`), so keep the `rp` fields. `spellCost`
gives the mana price (mastered: 30% off). Spells 8-10 are Curse (`u.curseT`), Raise the dead (skeletons with `u.ttl`, counted in
`c.summoned`) and Hellfire. **Rooms 12-15**: Torture chamber (`prisoner`: faster than persuasion, a small chance of death each second,
the Jail heals prisoners first; a broken rival creature reveals its old realm; a Wheel of pain sets `c.fear`: faster training and
digging), Fighting pit (`spar`), Gambling den (`gamble`, `u.gT`) and Dark altar (`sacrifice`, from the page's Hand drop). Rivals don't
build these. **Levels**: diggers earn xp from work (`digXp`, `digMult`, `digLoad`); `drawUnit` scales every unit by level.
**Mood** (page only): `stains` (blood, from `blood` effects), the shadow over known-but-unseen tiles and the vignette in `draw`,
WebAudio sound made in code (`audio`, `snd`, `fxSound`, `soundTick`; `hd.opts.sound`), and `whisper()` (the advisor's lines).
**The Long Dark** (a second campaign; state `D`, saved whole as `hd.dark`: `seed`, `turn`, `dread` 0-10, `own {node: "me" | "vas" | "L0".."L2"}`,
`lords [{alive, vassal}]`, `flags` (abbey, castle), `tries`, `nm`, `keep` (the keep's saved world), `exp` (an expedition in progress), `won`).
It never touches `hd.game`: `save()` routes by `W.spec.dark`. `DARK_NODES` (16, with `l` links, `gives`, `income`, `seat`, `surf`) and
`DARK_LORDS` are keyed by index: append only. The keep is a world with `spec.keep` (no rivals, never won or lost: `destroyRealm` sacks it
instead; hero reprisals are set on `W.hero` by `darkHome`). `darkLaunch` takes chosen creatures out of the keep into `spec.party`,
`darkSpec` builds the realm (lord name and `power` from the map, heroes from dread 4), `darkResult` applies the ending (`W.ends[2]`:
conquer, starve, vassal; `endLord`), dread, tribute and `darkLordsMove`, and `darkHome` puts veterans (`u.nm`, `u.vet`) and gold back.
What is allowed is `darkAllow(D)` (`DARK_BASE` plus every held node's `gives`). Starving: an AI lord with no Gate for 150 s gives in
(`K.noGate`); begging: `W.offer` at 25% Heart, answered by the page's `offerCard`. Surface raids are realms with `spec.surface`
(the lord fields hero kinds). `"x:dread"` needs gate Tormentors, Ghouls and the Wyrm in the Long Dark only (99 elsewhere).
`spec.deep` (Long Dark only) makes far-off gold, gems, treasure, lost creatures and tombs better, from its own random stream.
**Rockfalls** (`spec.falls`, Long Dark only; `W.fall {next, warn}`, `fallTick`, `fallOk`): open, roomless floor 6+ tiles from any Heart
fills in after a 9 s warning, more often the more floor a keeper has. Page: `openDark`, `renderDark` (the SVG map), `darkBriefing`,
`darkOver`, `keepIntro`. `tools`-style check: play the whole campaign in Node with the functions above (launch, end the lord, result, home).
**How rivals build** (replaces the open hall): `newWorld` gives each a 5x5 Heart chamber with four arms (Lair, Farm, Treasury, the Gate;
Training on Fair and up), each room a walled chamber. `aiRooms` plans more as `K.plan [{r, tiles, door, t0, done}]`: `aiChamber` finds
a doorway in rock off plain floor with the room beyond it and rock all round (`CHAMBER` sizes, 3x3 by default), marks it, and paints the
tiles as they are claimed; with nowhere to put one, `aiCorridor` pushes a one-wide tunnel out. Open floor that already exists (claimed
caves, saves from before) is still used through `findBlock`. `aiTraps` sets doors and traps by difficulty: budgets `[2,5,12]` doors and
`[1,4,8]` traps, door kind up to `diff+1`, on doorways (a tunnel tile with one of their rooms behind it; Gentle only treasury and lair),
on the way in (`aiApproach`, from `K.threat`, where intruders last broke in) and, on Fierce, at the Heart. Change the layout and the
no-R()-calls rule matters: the start layout uses none, so the rest of each seed's map is unchanged. Rivals also build Pit, Jail,
Torture/Persuasion and Den, cast through `aiSpells`, flee when hurt (`u.flee`), avoid learnt traps (`W.av[o]`, `learnTrap`, `W._av` in
`bfs`), guard held sites (`c.siteTiles`), strike early when the player's army is away (`K.early`), and speak (`say`, `LINES` by persona;
toast class `say2`-`say4`). **No-go** for the player's diggers is `W.mark` bit 32 (`W._blk` in `bfs`, set round `digger`; also checked
in `claimable` and the dig search); painted from the Dig tool (`digMode`).

### Life (`games/life`)

An evolve-a-creature game (in the genre of the evolution sims, with its own names and art), built a stage at a time:
`STAGES` lists Cell, Sea, Land, Tribe, Civilisation, Space; all six exist. `S.stage` is "cell", "sea", "land", "tribe", "civ" or "space"; `cur(S)` is that stage's state
(`S.cell` / `S.sea` / `S.land`; the tribe stage keeps `S.land` as `cur` and has its own `S.tribe`) and `TS(S)` its sizes (`TIERS` / `SEA_TIERS` / `LAND_TIERS`, land has one: the brain bar). Rules sit between `/*CORE-START*/` and `/*CORE-END*/`.
A creature is a design `{s: [segment radii, head first], p: [{id, s: segment, a: angle (0 = front), m: mirrored}], h, l, h2,
pat, edge}`; `geom` places the parts, `stats` turns them into speed, bite, health, sight and so on, `designValue` is its DNA
price. Every creature in the pond is drawn from the same parts (`randomDesign`, per-save `species(tier, i)`: 0-2 plant
eaters, 3-4 hunters, 5 both), so carnivores are built scary (jaws, slit eyes, spiky skin, dark reds) and grazers cute.
Parts act where they sit (`stats`, `fight`, `guardAt`): `push` parts (tails, jet, paddle) only push when pointing backwards,
every biter (`g.biters`: jaws, siphon, pincer) bites on its own cooldown, shells soften bites near them and stalk eyes are weak
spots, every part has weight `w`, and `good`/`bad` text shows in the builder. Computer creatures (`scan`, `think`) have
`hunger`: grazers eat and school with their kind, hunters pick prey by size and distance, switch to clearly better prey,
sprint after other creatures (not the player), then eat. `steer` eases off when facing away, so nothing circles.
Test starts (`STARTS`, `testStart`, chosen in the new-life dialog) jump to a later size or the end of the cell stage with every
part and 300 DNA, and mark the save `test`; add each new stage to `STARTS` as it's built. Pods (`W.pods`) carry a visible part id; beaten creatures can drop one of their own parts.
**Sea** (`W.sea`): a bounded map (`SEA`: ±W wide, D deep, surface/shore at y = 0) in five depth bands with their own food
size, plant/meat density and share of hunters (`populateSea`, species tier = band - 1 + a little); creatures keep to their
band (`think`). `seaStart` turns the cell into a sea creature (second section, whip → tail fin) when the cell stage ends
(`goToSea`). Sea-only parts carry `sea: 1` (`stageParts`). Nest `W.nest` (evolve there; respawn there; `seaStep` opens the
builder on entering, or while ready). Young (`kind: "ally"`, `team` 1, count `S.sea.young` = min(3, size) refilled at each
evolve) follow you and join fights (`allyThink`, `W.foe`). Diet `S.sea.lean` -1..1 drifts with what you eat and scales food
value. `SEA_GOALS` pay DNA and a pod; a boss (`W.boss`, name from `BOSS_NAMES`) spawns in the Deep. At the last size the
growth bar sets `ashore`; with lungs and two leg fins, reaching the surface finishes the stage (`done`, `S.seaNature`).
No songs or friendship mini-game in the sea; species mostly don't get along. Long bodies are drawn bent (`bentG`).
**Land** (`W.land`, own code after the sea in CORE: `newLand`, `stepLand`; page: `drawLand`, `landTap`, `renderLandUI`,
`startImpress`): tap to move, drawn in real 3D with three.js (`games/life/three.module.min.js`, r160, MIT; imported by
`load3D` when the land first shows, listed in `sw.js` and copied by `prepare-www.js`). Page code `/* the land in 3D */`:
`land3H` (heights in tiles: `HZ`, lakes flat in raised banks, rivers in beds), `build3D` (ground mesh at 2 vertices a tile
with vertex-colour fog of war `fog3`; water; plants and rocks as InstancedMesh patches of `CHK` tiles that appear when their
tile is seen; fruit per plant's `food`; nests; landmarks `mark3`), creatures from designs (`makeTpl` → merged vertex-coloured
mesh plus animated legs with 2-bone IK, tail/tentacle chains, lower jaws, voice sacs, glows; cached by design in `G3.tpl`,
instanced per creature by `inst3`, animated by `anim3`), `draw3D` (camera, day/night light, `cut3` cuts plants away round
the player, `P3` projects to the screen, `ground3` turns taps into ground points) and `overlay3D` (labels, bubbles, birds,
corner map on the 2D canvas above). The old flat `drawLand` stays as the fallback when WebGL can't start. The island (`makeIsland`, from
`hash(seed, 777, ISLAND_V)`): `LN`×`LN` tiles of `LT` units, heights `W.hgt`, biomes incl. lakes, rivers (slow), snow and
cliffs; `W.reach` is the main island. Saves made on an older island (`S.land.iv` ≠ `ISLAND_V`) keep brain, DNA, pack and
design but restart the species tally on the new island. Fog: `W.seen` (saved packed in `S.land.seen`) filled by `reveal`
within `sightR`; creatures show only within sight; `S.land.met` lists species met (pause list). Landmarks (`LANDMARKS`,
`W.marks`, found in `S.land.found`: DNA, brain +3; springs heal, bones drop pods, the Old Tree always fruits).
`findPath` is A* plus string-pulling with a body-width `los`; `moveC` slides along water/rock; `toLand` rescues anything
in the water; the player and pack don't collide with animals (no deadlocks). Twelve species (`LSPEC`: diet, size, `life`
herd / pack / solo / home, biomes, extras) plus two giants. Herds and packs follow a leader along a `route` (`W.lead`),
herds panic together, packs share a target; solo animals keep their own `homes`; home animals defend their nest
(`scanLand`). Each species has a `temper` (`TEMPER`, `POW` damage/health multipliers): flee, defend or aggro; `landAlarm` makes the
whole group near the victim answer an attack (or a hunt starting, or aggro ones being approached) together. Home nests: walking
into one with no guards left calls `nestWon` (`S.land.nests[i]`, `NEST_DNA`, brain +4, eggs or a part pod). Events (core: `quakeStep`, `stampStep`, `landGoals`; state `S.land.quake` {phase warn → erupt → after, t, sx/sy safe spot
chosen when it starts, made, inv, pk}): at `QUAKE.start` brain or `QUAKE.startT` seconds in the land, the highest ground erupts;
`W.fireR` grows to `rmax` and burns anything inside, animals follow a flow field (`flowField`, `flowMove`) to the safe spot, your nest
moves there; then `resettle` (deterministic new homes near it) and `scorch` (dead trees, no bushes) run, also on every load after.
Invaders (the `late` LSPEC entry) arrive 2 min later; herds stampede through you now and then (`W.stamp`). `LAND_GOALS` reuse
`goal()`. Page: `quake3` (smoke, lava, flame ring, safe beacon), `burn3` (charred ground). Befriend: impress three *different* members (`wooed`); hunt four to drive a species out (`lspStatus`).
Brain: species +8, giants +12, landmarks +3, food a little; 100 finishes (`done`, `S.landNature`). Impress: `impressPlan`,
`socialQ` (call = voice, dance = legs, show = crest/frill/wing, pose = horns/armour/size), win at 60% (giants 70%).
Fights: `landHunt`, `landFight`, `landMove` (`LMOVES`). Pack: young (`pack`, `packMax`) and joiners (`joined`) follow
`W.trail`; `W.callTg` sends them. Day/night `S.land.day` over `DAY`. Parts: `land: 1` land-only; `water: 1` swimming
parts are not offered on land, and any still on the body are dead weight there (`stats(d, g, "land")`: no effect, double
weight, -2 health; `designValue(d, "land")` gives no DNA back for them); `both: 1` sea parts work on land too.
3D shape (all optional, saved in the design): `sy` per-section height and `sh` per-section tall/flat, `sp` spine stretch (used by `geom`),
and per part `l` length and `z` size (`geom` passes them on). On land they change `stats` (legs: stride, turning, weight, reach; size scales
effects and weight) and `designValue`. `shapeUp` gives each island species a body plan (`d.plan`: tall, crawl, round, deep, hunch, biped)
from its own random stream. The builder's Shape tab and the part sliders show only on land, with a 3D preview (`edPreview`, `EP`).
The builder picks parts by a fingertip-sized reach (`partCentre`), a chip list of every part (`renderChips`), drag-anywhere
to move the picked part, and ↺ ↻ / section buttons.
Sizes: `TIERS` (growth needed per size), world scale `KT(t)` = 1.7^t; the camera zooms out as you grow. Eating fills
`cell.grow`; when full (`ready`) the mate appears and evolving with it grows a size (`applyEvolve`); finishing the last size
sets `cell.done` and `S.nature` (hunter / grazer / forager from what was eaten), to carry into the sea stage.
Saves: `lf.slot.0`-`lf.slot.2` (whole save, `migrate()` fills new fields), `lf.last` (slot index), `lf.opts`. `mode` is
`normal` (respawn, lose 10% DNA) or `hard` (one life: `S.dead` set, slot shows the fossil). `PARTS` and `TIERS` are
saved by id / index: append only. `tools/life-check.js` runs a greedy bot through the stage (about 14-22 min for a
perfect bot, so 20+ for a person) and fails if it can't finish or finishes in under 8 minutes; then plays on into the sea
(about 21-30 min for the bot; fails if not done in 90 or under 12), then the land (impress what its design can copy,
else hunt; about 14-28 min for the bot; fails if not done in 150 or under 12). `window.LF` exposes the
world for Playwright.
**Tribe** (`S.tribe`, code after the land in CORE: `newTribe`, `tribeStep`; page: `renderTribeUI`, `tribeTap`, the Jobs / Build /
Tools / Tribes panels, `tribe3` and `terr3` for the camp and land colours in 3D): the same island (`newLand` with `W.tribe`), the camp
at `S.tribe.camp` (`campSpot`). You play the Chief (tap to walk); villagers (kind `vill`, team 1) work on their own from job counts
(`S.tribe.jobs`, everyone else gathers food; `villThink`) and only gather inside your land (stone diggers may use rocks on unclaimed land
within 16 tiles of a fire; rocks inside cliffs are skipped). Villagers never collide with each other. Guards patrol fires, watch fires and
totems and take on `villFoe`s anywhere within 22 tiles of their post; with `W.rally` (📣) they follow the Chief and also fight `raidFoe`s. `W.own` (owner per tile: 1 you, 2 + j rival
j; `landOwners`) comes from camp fires (`W.fires`, `CAMP_R`) and totems. `BUILDS` (hut, totem, watch fire) are planned by the Chief,
paid for at once and put up by builders; `TOOLS` need materials (`MATS`), found in deposits (`W.deps`, `makeDeps`, from the seed)
that the Chief discovers (`S.tribe.deps`) and a totem claims; hides come from hunting. Four rivals (`S.tribe.rv`, `makeRivals`: kind
`rival`, team 2, `rivalThink`; one always open, one always hostile, two from the land stage: friends open, driven-out species hostile;
colours `RVC` by kind and `ci`): open ones (`mood`; gifts, trade and impressing its chief, `befriend`; an ally at `ALLY_AT` (`isAlly`:
its land counts in `W.hem`, its people in outnumbering, its guards fight raiders, `tribeAskHelp` lends warriors, `allyHelp`); joins at
100 when your tribe is at least as big) and hostile ones (`spirit`, `rivalStep`: heals slowly, drains while hemmed in (`W.hem`) or outnumbered; raids in
waves, gather → march → loot → home; beaten raids, burnt totems, raided stores, kills and duels with its champion lower it; at 30
or below (`TAKE_AT`) the Chief can take its fire; at 0 it gives in). `tribeResolve` turns a settled rival's camp into your settlement; both
settled ends the stage (`S.tribeNature`). New camps (`BUILDS` "camp", `FOUND_D` tiles from your fires, on unclaimed land) are built by
builders as a founding party and join `W.fires` after the rival camps. Upkeep every minute (`upkeep`: fires burn wood, totems and watch
fires take stone; short stores damage buildings) and stores above `storeCap` waste away. `MATS`, `BUILDS`, `TOOLS`, `JOBS` are saved by id: append only. `tools/life-check.js`
plays the tribe stage with a bot after the land (about 25 min; fails if not done in 120 or under 15); `--tribe` runs it alone.
**Civilisation** (`S.civ`, code after the tribe in CORE: `newCiv`, `civStep`; page: `civ3`, `civOverlay`, `civTap`, the town / settlers /
towns / goals panels). Real time, as the tribe. Its own map (`makeArchipelago` from `hash(seed, 2000, CIV_V)`, `W.isle` per tile): five
`ISLES` (home, three rival nations, one empty), town sites `W.sites` (`ISLE_SITES`), ore `W.ores` and glowstone `W.glows`, all from
their own random streams, so the map never moves. `W.land` and `W.civ` are both set (it reuses the 3D land engine; the player is an
invisible anchor and the camera roams). Towns `S.civ.towns` `{id, site, own (0 you, 1-3 the nations), name, pop, b: [{k, done, prog}], cap}`
share one store `S.civ.res` (food, wood, stone, ore, glow, gold; capped by `capR`). `CB` buildings (saved by id: append only): one built
at a time per town, workplaces limited by `civSlots` (houses and walls don't count, houses max 8), output by `civFit` (what's round the
town: `civNear`) and mood (`civMood`). Settlers (`civSettle`, `S.civ.wagons`) found towns on free sites of the same island. `CIV_GOALS`
pay gold. Fog is saved in `S.civ.seen`. Part 2 (`civInit2` fills it in on any save): nations `S.civ.nat[1..3]` (`NAT_TRAITS` war / faith /
arts, `rel` -100..100, `war`, `ally`, `deal`, abstract `gold`, cooldowns `cd`; run by `civAI`). Every town has `def` (`civDefMax`, worn by
sieges against `civGarrison`, shared among besieging armies) and influence `inf.f` (faith) / `inf.c` (culture) per owner; `civTake` hands
a town over (`C.how` counts your wins by war, faith, arts; a nation with no towns is `gone`; all gone sets `C.won`). Units `S.civ.units`
(`UNIT`: army, miss, fest) go in straight lines from `civSource` (the right building, plus a dock to cross the sea); `civSend`, `civUnits`.
Resource spots `W.spots` (all glowstone, then a meadow and spring per island from stream 2003, then ores appended; `SPOT_K`) are held by
outposts in `S.civ.claims` {spot: {own, hp}} (`civClaim`). Diplomacy `civDiplo` (gift, deal, ally at 60, war, peace), trade `civTradeOffers`,
nations' offers `C.offer`. Government `C.gov` {tax (`TAX`), pol (two `POLICIES`), polT}. A dock charts the map (`C.charted`). Every island has
a town site that can take a dock (`W.harbour`). Losing every town: `civRestore` (normal) or death (hardcore). `tools/life-check.js` plays the whole stage with a bot
that must unite the islands in under two hours and not under 15 minutes (about 30 minutes for the bot), then builds the Sky Port and launches.
**Vehicles** (part 3, in CORE after the civ code): a design is `{n, k: cart|ship|air|space, len, p: [{id, c: section, s: "t"|"s"|"b"}]}`
(section 0 is the front; side parts count twice). `VP` parts (saved by id: append only; `k` kinds, `sl` slots, `un` a building, or for
starship parts a space goal, that unlocks it), `vStats` (speed, war/faith/arts, hp, cargo, cost `c`, and for starships range, shield, dmg,
energy, tools; `ok` says why a design can't go), `vClean`. `S.civ.vd` is the list (max 8; `vStarter`), saved with `civSaveDesign`. Units and
settlers pick the best fitting design (`vFits`: carts on one island, ships across the sea from a dock town, airships anywhere with a `yard`) and
carry `f` (`vJob`), `tough` (`vTough`), speed (`vSpeedF`) and `dv` (the design, for 3D); the trip costs the design's materials; the nations'
units get `natVF`. Buildings `yard` and `skyport` (only in the capital once `C.won`); `civLaunch` pays the Sky Ship (a space design) in gold
and calls `goToSpace`. Page: `vehMesh` (3D model of any design), the builder `openVB` / `renderVB` (screen `#vbld`, preview `VBR`),
`civVehDlg`, `civLaunchDlg`.
**Space** (`S.space`, code after the vehicles in CORE; page after them): a galaxy from `makeGalaxy(seed)` (`hash(seed, 3000, SPACE_V)`, cached
in `GALAXY`: 60 stars plus bridge stars so the first ship (range `HOP0`) can reach every one, and one near the Core; planets `{ty, T, A, life, res,
ruin, orb, ph, sp, r, sd}`; six empires `G.emp` with traits `EMP_TRAITS`, homes and starting worlds). Planet keys "star:planet"; saved state:
`pown` (owner per planet, -1 none), `col` (colonies `{lvl, tur, def, home}`), `shaped` (`[T, A]`), `life`, `scan`, `dug`, `vis`, `zoo`, `goods`,
`relic`, `cr`, `d` (the ship design), `at` (star; -1 is the Core), `travel {path, i, t, charge}`, `emp[1..6] {rel, war, ally, gone, met, mis, cd}`,
`pir` (raids), `fleets`, `bands` (pirate bands by star), `goals`, `how`, `core`, `done`. The world `W.space` keeps `W.sys` (the system: `ships`,
`fx`, `pdef`; never saved) and `W.ship`. Rules: `spFly` / `spRoute` (jumps no longer than `vs.range`; the Core once `united`), `spGo` /
`spGoPlanet`, `spAct` (scan, dig, beam, shape, seed, colony, up, tur, sell, atk), `spDiplo` (gift up to 25, relic, ally at 60, war, peace,
hand), missions (`spMisText`, `spMisDone`; they expire), `systemStep` (auto-firing lasers, enemy ships, planet guns, the Warden and its drones,
ally escorts at the Core), `spTick` (income, raids and fleets wearing down colonies while you're away, empire growth, war and peace, missions),
`spGoals` (`SPACE_GOALS`, append only; each unlocks a part). **Fly-over** (`W.fly {k, t, u}`, not saved; `spFlyover`, `spLeaveFly`): a low pass
over a planet; `spSpecies(p, life)` (animals from the planet's seed, `landDesign` + `shapeUp`), beamed one kind at a time (`W.beamI`, zoo keys
"star:planet#i"); `spDeps(p)` hidden riches, found by `spSweep` near the longitude being passed and taken by `spHarvest` (grow back after
`DEP_BACK`; state in `X.dep[key] {f, h}`). Page: `drawFly`, `flyTap`, `creatureMesh` (a still 3D animal from `makeTpl`). **Wars are not flown**:
`spWarTick` sets each war's `front` (a world, or the one picked with spAct "atk") and siege `sg` from fleet strength: yours `X.wf` warships ×
`spPow(your ship)` (`spBuildWarship`, `warshipCost`), theirs `E.fl` × `empPow`; your fleet also meets their fleets at your worlds. Only pirates,
drones and the Warden are fought directly. **Ship looks**: `foeDesign` gives each empire three starship designs (`G.emp[k].ships`, hull colour
`hull`) and pirates three (`G.pir`), from their own streams; the nations in Civilisation travel in `natDesign` vehicles. Page: `drawSpace` (galaxy and system views on the shared renderer, `SP3`; flat
`drawSpace2D` without WebGL), `spaceTap`, `renderSpaceUI`, the panels (`spEmpDlg`, `spWorldsDlg`, `spZooDlg`, `spGoalsDlg`), `spaceEvent`,
`spaceWonDlg` (the life story). Test starts `civend` and `space0`. `tools/life-check.js` plays space with `spaceBot` after the civ launch: it must
reach the Core within four hours and not under 20 minutes (about 40-130 minutes for the bot); `--civ` runs only the civ and space stages.

### Adding a new game

1. Create `games/<id>/index.html` (self-contained), add the shell script tag, home link and `SG_BACK`.
2. Add a tile for it in the right group in the hub (`index.html`), with `data-game="<id>"` and its own small art panel
   inside a 96x112 `.frame`; if it has a daily puzzle, add it to `TODAY` too.
3. Add the page to `CORE` in `sw.js`.
4. If it uses a Google Font not already bundled, add the `@fontsource/<family>` package to
   `android-app/package.json` and an entry to `FACES` in `android-app/scripts/prepare-www.js`.
5. Add a `new-game` entry to `release-notes.json`.
6. Run `python3 tools/build.py`, test, commit, push.

## Word Rattle specifics (handle with care)

- **Seeds** are 8 characters: 3 for the rules, 4 random (the lowest bit of the last one is the board-turning
  flag), 1 check character. Existing seeds and daily boards must keep producing the same board: don't
  change `settingsIndex`, `buildBoard`, the dice lists, `dailySeed`, or the word list without a plan.
- **Sync links** (`#s.…`) carry a player's recent games (`WR2|pid|name|seed,score,…,bits`). Word lists are
  bitsets over the sorted list of every valid word on a board, so the dictionary must stay identical on
  both phones. Old links (`#r.…`, bare `#SEED`, `#live.CODE`) arrive at the hub and are forwarded to
  Word Rattle. `SITE_URL` in the template must stay the site root.
- **Live play**: online through PeerJS (free public broker), or nearby in the app through Google Nearby
  Connections (`startAdvertising`/`startDiscovery`, star layout). The host's phone is the hub and relays
  everything; up to 8 players.

## Android app

- `android-app/scripts/prepare-www.js` copies the hub, `shell.js` and every game into `www/`, bundles
  fonts and PeerJS, and sets `window.SG_APP` on every page.
- `npx cap add android` generates the Android project in CI, then `android-app/scripts/patch-android.js`
  adds the native plugin (`android-app/native/WordRattlePlugin.java`), permissions, link handling,
  icons and signing. The `android/` folder is generated, never committed.
- App id `com.jackstoneley.wordrattle` must never change: it lets new builds install over old ones and keep
  everyone's saved games. `versionCode` is the GitHub run number.
- `android-app/wordrattle.keystore` signs every build so updates install over the top. Keep using it.
- Updates: the hub reads `releases/latest` from the GitHub API, compares `build N` in the release title with
  the installed version, then the plugin downloads `stoneley-games.apk` and opens Android's installer.
- Native features can't be tested here. Test the web side with Playwright (a stub for
  `Capacitor.registerPlugin` is enough), and say plainly what still needs trying on a real phone.

## Testing

- `python3 tools/build.py` must pass.
- Playwright and Chromium are available in Claude Code sessions. Serve the repo (for example
  `python3 -m http.server`) and check the hub, every game, and the back-button routing (call
  `window.SG_BACK()` or emit a fake `back` event from a stubbed plugin).
- After pushing, watch the **Android app** workflow run and confirm the `latest` release has the new build.

## Commits

Small, descriptive commits on `main`. GitHub Pages deploys the website automatically; the workflow
builds and publishes the app. Tell the owner to tap **Check for updates** in the app afterwards.
