# ODYSSEUS: LOST WORLDS

**English** · [한국어](README.ko.md)

A browser action game about finding your way home from Troy to Ithaca through the trials of the gods.

**[Play the game](https://odysseus-lost-worlds.sooyeon-jun-0389.chatgpt.site/)** · Live game: **v16** · Repository: **v17 (not deployed)**

## About the game

Play as Odysseus after the Trojan War and journey home to Ithaca. Across 11 stages, travel from Greece through an unfamiliar Eastern realm, dodge enemy attacks, switch weapons, and call upon divine powers.

- **Three weapons:** Choose a sword, spear, or dagger to suit the fight.
- **Four finishers:** Call upon Athena, Achilles, Hermes, or Zeus.
- **Boss battles:** Face the distinct attacks of Polyphemus, Poseidon, Cao Cao, and Antinous.
- **Survival:** Start with three lives. During boss fights, green healing zones appear at random times and locations; stand inside them to recover health.
- **Scores and rankings:** Complete the journey to submit a score under a public nickname on the live site. No login is required.
- **Four difficulty levels:** From Ithaca's Path (easy) to Poseidon's Wrath (extreme).
- **Optional play analytics:** Anonymous stage, boss and death records are collected only after opt-in. Off by default. [Collection guide](odysseus-lost-worlds/TELEMETRY-v16.md)

Designed for a computer and keyboard.

## Getting started

1. Open the game link above in a desktop browser.
2. Choose a difficulty and start the game.
3. Move with the arrow keys and attack with `A`.

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

Land before attacking, blocking, or using a finisher. There is a brief recovery period after landing.

See the [CHANGELOG](CHANGELOG.md) for version-by-version changes.

## Built with AI assistance

This is a personal project created with ChatGPT and Codex. The creator defined the game and requested changes; AI tools helped organize the plan, write code, check errors, improve features, and publish the game.

Play-driven requests such as “give the player three lives,” “add a place to heal during boss fights,” and “offer four difficulty levels” became concrete game rules. AI-generated code was checked with automated tests and browser checks, while balance and enjoyment continue to be refined through actual play feedback.

## Repository layout and local play

```text
README.md                 English introduction
README.ko.md              Korean introduction (한국어 소개)
CHANGELOG.md              Changelog (English)
CHANGELOG.ko.md           Changelog (한국어)
odysseus-lost-worlds/
  index.html              Game screen
  *.js                    Movement, combat, finishers, and UI
  assets/                 Game images
  server/                 Rankings, page counts and play analytics
  db/ · drizzle/          Database schema and migrations
  test-*.cjs / test-*.mjs  Automated checks
  TELEMETRY-v16.md         Collection and export guide (English)
  TELEMETRY-v16.ko.md      Collection and export guide (한국어)
  README.md               Game folder guide (English)
  README.ko.md            Game folder guide (한국어)
```

Download this repository, keep its folder structure intact, and open `odysseus-lost-worlds/index.html` in a desktop browser. No npm or package installation is required to run the game screen. It uses HTML, CSS, JavaScript, and Canvas.

This repository contains the browser game and server source. **Online rankings, page counts and play analytics require the hosted server and database.** Opening files locally or uploading them elsewhere does not automatically provide those services. Player records, CSV exports and secret credentials are not included.

For development checks, use Node.js 24 or later in the game folder: `npm test` (game, display, server and analytics checks; no install needed) and `node build.mjs`. `.openai/hosting.json` identifies the existing Sites project. Deployments from another account need their own project and database setup.

## Current limitations

- All difficulty levels currently share one online leaderboard.
- Mobile touch controls are not supported; a computer keyboard is recommended.
- Updating the GitHub files and updating the live game are separate operations.

For your first journey, try **Ithaca's Path**.
