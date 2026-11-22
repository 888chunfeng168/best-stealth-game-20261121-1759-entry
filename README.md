# best-stealth-game-20261121-1759-entry

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/888chunfeng168/best-stealth-game-20261121-1759-entry/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/888chunfeng168/best-stealth-game-20261121-1759-entry/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Nightshade — Silent Infiltration**: a top-down stealth game. You are an infiltrator in a dark archive: steal every intel core, slip past guards with sweeping vision cones, hide in bushes, use crates as cover, and reach the exit unseen. Three levels, a detection meter that gives you a chance to recover, and a ghost bonus for finishing a level never spotted.

## How to play

- **Move** — WASD / arrow keys, or click anywhere to walk there.
- **Sneak** — hold Shift: slower and quieter, and guards spot you much more slowly.
- **Vision cones** — yellow while a guard is calm, orange while suspicious, red on alarm. A guard's detection meter fills while you are in its cone and drains when you break sight; at half it comes to investigate, at full it chases.
- **Cover** — crates block a guard's sight completely. Bushes hide you: a guard barely sees you inside one unless it is very close.
- **Noise** — walking is loud enough for nearby guards to hear; sneaking is silent. A faint ring around you shows how loud your steps are.
- **Goal** — collect every intel core (◆) to unlock the exit, then reach it. Finish a level never spotted for a ghost bonus, and beat par time for a speed bonus.
- **Keys** — P pause, R retry the level, M mute.

## Levels

1. **The Archive** — two guards, two cores: learn the patrols.
2. **Server Hall** — three guards, three cores, long sightlines between the racks.
3. **The Vault** — four guards, tight patrols, no room for mistakes.

## Run it

```sh
python3 -m http.server 8080
# open http://localhost:8080/game/
```

Or serve `game/` with any static server and open `game/index.html`. No build step, no network requests, no libraries — plain HTML, CSS and ES modules, with all sounds synthesised in WebAudio.

## Screenshots

The four images in `screenshots/` are real renders of this game's own code in a desktop browser (taken with headless Chromium): the cover shows a guard's vision cone sweeping over the player hiding in a bush, then a suspicious guard closing in, an alarm chase, and the title screen. The game also stages those scenes itself with `?shot=1..4` on the page URL.

## Files

- `game/index.html`, `game/style.css` — the page and its chrome.
- `game/src/config.js` — every tunable number (speeds, vision, detection).
- `game/src/levels.js` — the three level maps and guard patrols.
- `game/src/world.js` — collision and line of sight.
- `game/src/guard.js` — guard AI: patrol, suspicion, chase, search.
- `game/src/player.js` — movement, sneaking, click-to-move.
- `game/src/input.js` — keyboard and mouse.
- `game/src/audio.js` — synthesised footsteps, alarm, chimes.
- `game/src/render.js` — canvas drawing, lighting, HUD.
- `game/src/main.js` — state machine, loop, scoring.
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ddg3n73c&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
