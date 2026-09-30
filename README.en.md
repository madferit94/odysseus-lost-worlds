# ODYSSEUS: LOST WORLDS

[한국어](README.md) · **English**

A browser action game about finding your way home from Troy to Ithaca through the trials of the gods.

**[Play the game](https://odysseus-lost-worlds.sooyeon-jun-0389.chatgpt.site/)** · Current game version: **v16**

## About the game

Play as Odysseus after the Trojan War and journey home to Ithaca. Across 11 stages, travel from Greece through an unfamiliar Eastern realm, dodge enemy attacks, switch weapons, and call upon divine powers.

- **Three weapons:** Choose a sword, spear, or dagger to suit the fight.
- **Four finishers:** Call upon Athena, Achilles, Hermes, or Zeus.
- **Boss battles:** Face the distinct attacks of Polyphemus, Poseidon, Cao Cao, and Antinous.
- **Survival:** Start with three lives. During boss fights, green healing zones appear at random times and locations; stand inside them to recover health.
- **Scores and rankings:** Complete the journey to submit a score under a public nickname on the live site. No login is required.

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

## What's new in v16 · Optional play analytics

Opt in above the game before starting a new journey to record difficulty, stage progress, boss attempts, deaths, retries, finisher readiness/use and outcomes. Analytics is off by default; you can play without it. v15 gameplay balance is unchanged.

- Each journey uses a new random ID. Analytics tables do not store names, emails, IP addresses or full referring URLs. Rankings and hosting access logs are separate.
- Uncheck to stop future collection. Previously sent records remain under the retention policy.
- Only the operator can read raw events and export CSVs. Test records are excluded by default.
- An unknown outcome is not treated as failure. Exports cover the last 90 days; older raw records are cleaned on subsequent collection requests.

[Collection definitions, limitations and operator export guide](odysseus-lost-worlds/TELEMETRY-v16.md)

109 automated checks passed, and test events were verified in the live database. Browser start checks and automated combat simulations are distinguished; these are not findings from real players.

## What's new in v15

### Four difficulty levels

| Difficulty | Regular enemy HP / damage | Boss HP / damage |
| --- | --- | --- |
| Ithaca's Path · Easy | 85% / 85% | 85% / 85% |
| Aegean Voyage · Normal | 100% / 100% | 100% / 100% |
| Trial of the Gods · Hard | 115% / 115% | 120% / 115% |
| Poseidon's Wrath · Extreme | 130% / 130% | 135% / 130% |

Percentages are relative to v14 stats. Health and damage values are rounded to integers. **Aegean Voyage** is the default. Difficulty stays fixed during a run; a new selection takes effect when you start a new game.

### Two-bar finisher gauge

Store up to **2 energy bars**. Q, W, and E each require 1 bar; R, Zeus, requires 2 bars. Only the energy spent is deducted.

### Previous updates

- **v14:** Reduced boss health and damage by approximately 5%. These adjustments remain in v15.
- **v13:** Added three lives and randomly appearing boss-fight healing zones. If you have lives remaining, you can retry the fight after falling.

## Built with AI assistance

This is a personal project created with ChatGPT and Codex. The creator defined the game and requested changes; AI tools helped organize the plan, write code, check errors, improve features, and publish the game.

Play-driven requests such as “give the player three lives,” “add a place to heal during boss fights,” and “offer four difficulty levels” became concrete game rules. AI-generated code was checked with automated tests and browser checks, while balance and enjoyment continue to be refined through actual play feedback.

## Repository layout and local play

```text
README.md                 Korean introduction
README.en.md              English introduction
odysseus-lost-worlds/
  index.html              Game screen
  *.js                    Movement, combat, finishers, and UI
  assets/                 Game images
  server/                 Rankings, page counts and play analytics
  db/ · drizzle/          Database schema and migrations
  test-*.cjs / test-*.mjs  Automated checks
  TELEMETRY-v16.md         Collection and export guide
  README.md               Game folder guide
```

Download this repository, keep its folder structure intact, and open `odysseus-lost-worlds/index.html` in a desktop browser. No npm or package installation is required to run the game screen. It uses HTML, CSS, JavaScript, and Canvas.

This repository contains the browser game and server source. **Online rankings, page counts and play analytics require the hosted server and database.** Opening files locally or uploading them elsewhere does not automatically provide those services. Player records, CSV exports and secret credentials are not included.

For development checks, use Node.js 24 or later in the game folder: `node test-game.cjs`, `node --test test-worker.mjs test-telemetry.mjs`, and `node build.mjs`. `.openai/hosting.json` identifies the existing Sites project. Deployments from another account need their own project and database setup.

## Current limitations

- All difficulty levels currently share one online leaderboard.
- Mobile touch controls are not supported; a computer keyboard is recommended.
- Updating the GitHub files and updating the live game are separate operations.

For your first journey, try **Ithaca's Path**.
