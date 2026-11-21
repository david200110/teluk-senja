[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/david200110/teluk-senja/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/david200110/teluk-senja/reward.svg)](https://make.fun/bounty/gta6-01)

# Teluk Senja — An Open-World Crime Story

A complete open-world crime game in the spirit of GTA 6, built for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). Everything is original: the city, the characters, the story, the art and the music — nothing from Rockstar Games.

## The story

Arga is a young courier driver in **Teluk Senja**, a coastal Indonesian city at dusk, where the bay meets the beach and the harbour never sleeps. He owes **Bos Reno Rp 2,400,000** — and the only way out is through eight jobs:

1. **First Delivery** — 3 parcel drops — Rp 200,000
2. **The Harbour Pickup** — 3 crates from the pier — Rp 250,000
3. **Midnight Taxi** — drive Sari to Senja Bar — Rp 250,000
4. **The Repo Job** — steal the red coupe, deliver it to the garage — Rp 300,000
5. **Beachside Brawl** — beat 3 thugs at the beach — Rp 300,000
6. **The Getaway** — reach the safehouse at 3 stars, lose the heat — Rp 350,000
7. **Harbour Heist** — grab 4 cash bags under patrol — Rp 350,000
8. **Settle the Debt** — drive the final payment to Villa Reno — Rp 400,000

Pay it all back and walk away a free man.

## What's in the game

- **Open world**: a procedural coastal city — ~90 buildings, a beach and sea, a wooden pier, palms, street lamps, a mosque, Senja Bar, the harbour office and Villa Reno on the hill.
- **Day/night cycle**: the sun sets over the bay, the lamps come on, and the city changes with the clock.
- **On foot and by car**: walk, run, punch, steal cars and drive them with arcade handling, handbrake included.
- **Traffic and pedestrians**: cars cruise the grid, civilians wander the streets and flee when trouble starts.
- **Wanted system**: 0–5 stars. Steal a car in view or punch a civilian and the police come — they chase, ram, and bust you if they catch you slow. Stay clean and the heat cools off, one star at a time. Getting busted costs a fine; getting wasted costs a hospital bill.
- **Combat**: punch thugs and civilians up close; the beach brawl is a three-on-one fist fight.
- **HUD and minimap**: cash, debt, health, wanted stars, the clock, speed, a live top-down minimap with the objective, police and thug blips, mission tracker, dialogue and hints.
- **Story and progression**: 8 chained missions with dialogue, objective markers with a golden light pillar, and a debt counter that ticks down to zero.
- **Save/load**: progress saves to localStorage when a mission ends (or press R any time); continue from the menu.
- **Sound**: an original WebAudio synth groove in A minor plus procedural sound effects — punches, pickups, cash, sirens, engines. No audio files.
- **Menus**: title screen, pause, busted, wasted and story-complete screens.

## How to play

Serve the game and open it in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` from any static file server. It plays offline from its own files — no network requests.

| Key | Action |
| --- | --- |
| W A S D | Move on foot / drive |
| Shift | Run |
| E | Enter or steal a car / get out |
| F | Punch |
| M | Start the current mission |
| R | Save game |
| P / Esc | Pause |
| Mouse drag | Look around (scroll to zoom) |

## How it is built

- `game/index.html` — page, import map, HUD and menus
- `game/src/config.js` — tuning, mission rewards, places
- `game/src/util.js` — seeded RNG, money formatting, save shape
- `game/src/logic.js` — pure rules: mission chain, debt, combat, wanted, save/load
- `game/src/city.js` — procedural coastal city and day/night sky
- `game/src/vehicles.js` — cars, driving physics, traffic and police chase
- `game/src/peds.js` — pedestrians, beach thugs, Sari
- `game/src/missions.js` — the 8-mission chain, markers and dialogue
- `game/src/hud.js` — HUD and live minimap
- `game/src/audio.js` — original WebAudio music and sound effects
- `game/src/game.js` — the running game: player, camera, wanted, menus, save
- `game/src/main.js` — boot, input, frame loop
- `game/vendor/three.module.min.js` — Three.js r160 (vendored, minified)
- `main.ts` — the make.fun entry program (Node 22): copies `game/` and `screenshots/` to `/output` and writes `dossier.json`

Built with Three.js r160, plain ES modules, no build step.

## License

MIT — see [LICENSE](LICENSE).
