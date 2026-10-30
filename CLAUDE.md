# Stoneley Games: guide for Claude Code

A home page plus nine self-contained HTML games, published two ways:

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

The folder names, saved-data prefixes and code names stay as they are even though the on-screen names
changed: renaming them would break saved games and old links.

- **Website** (GitHub Pages, from the `main` branch root): https://jackstoneley.github.io/word-rattle/
- **Android app** (Capacitor wrapper), built by GitHub Actions on every push and published to the
  `latest` GitHub release. The app's **Check for updates** button installs new builds itself.

The owner (Jack) and his wife play on Android phones. They are not developers: explain changes in plain
words, and describe how to get the update on their phones (open the app, tap Check for updates).

## Layout

```
index.html                 Home page ("hub"): game cards with progress, backup/restore of all games, app updates
shell.js                   Loaded at the end of every game: back button routing, offline service worker, links
sw.js                      Website offline cache. VERSION is stamped by tools/build.py; never edit by hand
manifest.webmanifest, *.png  Website install metadata and icons
games/<id>/index.html      One self-contained game per folder (all CSS/JS inline)
games/word-rattle/src/     Word Rattle source: template.html + words.txt + common.txt -> built index.html
tools/build.py             Build step. Run after ANY change, before committing
tools/big-slide-check.js   Rides every Big Slide level's answer (run by build.py)
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

### Adding a new game

1. Create `games/<id>/index.html` (self-contained), add the shell script tag, home link and `SG_BACK`.
2. Add a card for it in the hub (`index.html`), with its own small CSS art panel.
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
