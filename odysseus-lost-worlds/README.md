# Game folder guide

**English** · [한국어](README.ko.md)

This folder holds the browser game and its server code. For what the game is and how to play it, see the [project introduction](../README.md). Version-by-version changes are in the [CHANGELOG](../CHANGELOG.md).

## What is in this folder

| Path | What it does |
| --- | --- |
| `index.html`, `display.css` | Game page and its layout |
| `game.js` and the other `*.js` files | Movement, combat, bosses, finishers, screen display, rankings, page views and optional play analytics |
| `display.js` | v17 toolbar: fullscreen, collapsible controls guide, language and sound buttons |
| `assets/` | Game images |
| `server/worker.mjs` | Server for online rankings and page views |
| `server/telemetry.mjs` | Server for optional play analytics |
| `db/`, `drizzle/` | Database tables and their change history |
| `export-analytics.mjs` | Operator-only tool that turns an analytics snapshot into CSV files |
| `test-game.cjs`, `test-*.mjs` | Automated checks |
| `build.mjs` | Packs the game and server into `dist/` for deployment |
| `TELEMETRY-v16.md` | What optional play analytics collects and how the operator exports it |

## Playing locally

Open `index.html` in a desktop browser. No installation is needed to see and play the game.

**Online rankings, page views and play analytics need the hosted server and its database.** When you open the file directly or put it on another web host, the game still runs, but those features cannot load or save anything.

## Checks and build

Use Node.js 24 or later inside this folder.

```sh
npm test          # game, display, server and analytics checks
node build.mjs    # writes the deployable game and server to dist/
```

`npm test` does not need `npm install`. `dist/` is a build output and is not stored in Git. `node build.mjs` reads `.openai/hosting.json`, which points to the existing hosted project; deploying from another account needs its own project and database.

## More documents

- [Project introduction (English)](../README.md) · [프로젝트 소개 (한국어)](../README.ko.md)
- [CHANGELOG (English)](../CHANGELOG.md) · [업데이트 내역 (한국어)](../CHANGELOG.ko.md)
- [Play analytics guide (English)](TELEMETRY-v16.md) · [플레이 기록 안내 (한국어)](TELEMETRY-v16.ko.md)
