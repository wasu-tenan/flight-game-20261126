# flight-game-20261126

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/wasu-tenan/flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/wasu-tenan/flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Ridge Runner — Alpine Ring Run.** A complete original flight game that runs offline in a desktop browser from static files: take off from Pinecrest strip, thread all eight golden rings over a river valley, watch your fuel, and land gently at Alderfield. Built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network request: `game/index.html` and its ES modules are all the game loads.

## How to fly

- **↑ / ↓ or W / S** — pitch the nose up and down
- **→ / ← or D / A** — throttle up and down
- **Mouse** — steer toward the pointer; hold click for throttle
- **Space** — airbrake · **P** — pause · **M** — sound on/off · **R** — restart

Fly through a ring to score 1,000 points and top the fuel tank up by 14%. Land on a strip slower than 150 kt and sinking slower than 6 m/s: land at Alderfield after all eight rings and the mission is complete. Stall below 55 kt, run dry, or meet the mountainside and the valley wins.

The HUD shows altitude (ft), airspeed (kt) and heading, fuel, rings, time and score, with lit attitude, airspeed and altimeter dials and a compass strip. Sound is synthesised in code (engine hum, ring chime, landing fanfare, crash thud) — no audio files.

## Screenshots

Four real renders of the game's own code: the title screen over Pinecrest, mid-flight through the rings, the mission-complete landing at Alderfield, and a stall crash into the ridge.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `vendor/makefun-game.ts`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=2mmz0hmg&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
