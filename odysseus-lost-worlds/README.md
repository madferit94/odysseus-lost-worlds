# ODYSSEUS: LOST WORLDS · Game folder

**English** · [한국어](README.ko.md)

[Project introduction](../README.md) · [Changelog](../CHANGELOG.md)

A browser action game about Odysseus going home to Ithaca after the Trojan War. Move with the arrow keys, dodge enemy attacks, and use weapons and the powers of the gods to clear 11 stages. The story starts in Greece, passes through an unfamiliar Eastern realm, and ends in Ithaca.

**[Play the game](https://odysseus-lost-worlds.sooyeon-jun-0389.chatgpt.site/)** · Live game: **v16** · This folder: **v17 (not deployed)**

## What kind of game is it?

- Defeat regular enemies to open the way to the next stage.
- Fight Polyphemus, Poseidon, Cao Cao and Antinous. Each boss attacks in its own way.
- Switch between sword, spear and dagger, and use the gods' finishers when your energy is charged.
- Look after your health and lives while you build your score. Finish the journey to save your result on the live game's leaderboard.
- Choose one of four difficulty levels before you start. All difficulties currently share one leaderboard.

## Controls

| Key | Action |
| --- | --- |
| Arrow keys | Move |
| A | Attack |
| Hold S | Block with your shield |
| Space | Jump |
| 1 / 2 / 3 | Select sword / spear / dagger |
| Q / W / E | Athena / Achilles / Hermes finisher — 1 bar each |
| R | Zeus finisher — 2 bars |
| Esc | Pause / resume |

## Versions

Changes for each version (v13 to v17) are in the [CHANGELOG](../CHANGELOG.md). The live site still runs v16 until v17 is deployed separately.

Optional play analytics was added in v16. Detailed play events are recorded only if the player opts in before starting a game, and the game can be played without it. See the [collection guide and operator CSV steps](TELEMETRY-v16.md). Real records and secret values are not in this repository.

## Running and files

You can play right away at the live game address above. If you downloaded this folder, you can also open `index.html` in a browser to see the game screen.

- `index.html`: game screen and controls guide
- `*.js`: game behaviour such as movement, combat and display
- `assets/`: images used in the game
- `server/`, `db/`, `drizzle/`: server source and database structure
- `test-game.cjs`, `test-*.mjs`: automated checks

Online rankings, page views and play analytics are connected to the live game's server and database. They do not work when you open `index.html` directly as a file.

To run the checks, use Node.js 24 or later in this folder: `npm test` and `node build.mjs`.
