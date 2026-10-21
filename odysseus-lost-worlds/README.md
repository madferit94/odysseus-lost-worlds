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
| `server/protection.mjs` | Ranking result checks, request limits and clean-up of unfinished journeys |
| `server/nickname.mjs`, `server/nickname-blocklist.mjs` | Nickname clean-up and the editable list of blocked and reserved names |
| `db/`, `drizzle/` | Database tables and their change history |
| `export-analytics.mjs` | Operator-only tool that turns an analytics snapshot into CSV files |
| `admin-remove-run.mjs` | Operator-only tool that finds and removes ranking entries |
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

## Ranking protection

The player's browser reports the result of a journey; the server cannot watch the game. The checks below refuse results that a real journey cannot produce and slow down scripted abuse. They cannot make cheating impossible: a made-up result that looks real (100 seconds or more, correct enemy counts) can still be saved, so the operator removes such entries by hand.

**Result checks** (`server/protection.mjs`). A refused result gets an error message and is not ranked.

- Play time cannot be longer than the time the server has seen since the journey started, plus 10 seconds.
- Play time must be at least **100 seconds**. How this number was chosen:
  - With no fighting at all, the fixed parts of the game take at least about 53 seconds: the 1.4-second start freeze, about 4,100 px of walking at 205 px per second, seven 1.25-second pauses between waves, 15 seconds of story scenes and the 8-second ending. Running the real game code with every enemy removed the moment it appears took 69 seconds.
  - A bot that runs the real game code, attacks the nearest enemy, uses finishers and never dodges finished the easiest difficulty in 175–210 seconds with all 3 weapons and several finisher choices (175–212 seconds over all four difficulties). A strong player has to dodge, so a real run takes longer.
  - 100 seconds is about 57% of the bot's fastest run. `test-plausibility.mjs` replays the bot on every test run and fails if the limit ever rises above 60% of the bot's fastest time (for example after a balance change).
- Enemy counts must match the game: 72–74 regular enemies (12 waves of 6, plus 2 guards in the Antinous fight who can disappear without counting) and exactly 4 bosses. `test-plausibility.mjs` recounts these from the stage data in `game.js`.
- A retry needs a fall, and the first life has exactly 100 HP. A result with retries but less than 100 damage is refused.
- Not checked yet: the game also implies at most 2 retries (3 lives) and at least 100 damage per retry. These were left out because the existing limit of up to 999 retries was kept unchanged; the owner can decide to add them.

**Nicknames** (`server/nickname.mjs`). Before checking and saving, a nickname is normalised (full-width and styled letters become plain letters, for example `Ｈｅｒｏ` → `Hero`), trimmed, and repeated spaces become one. Allowed characters are unchanged (letters, numbers, spaces, dots, dashes, underscores, up to 16). Then:

- Names on the blocked list are refused: common English and Korean swear words and slurs. Spaces, dots, dashes and underscores are ignored, and common look-alikes are read as letters (`0`→o, `1`→i or l, `3`→e, `4`→a, `5`→s, `@`→a, `$`→s, and Cyrillic or Greek letters that look Latin).
- Reserved names are refused: admin, moderator, system, odysseus and similar, and 운영자 and 관리자, also with digits added (`admin01`) or as a separate word (`Game Admin`).
- A name that mixes Latin with Cyrillic or Greek letters is refused (a common trick for look-alike names).
- The lists are in `server/nickname-blocklist.mjs`; edit them there. This is a basic filter, not full moderation. It will miss some abuse and can refuse an innocent name that contains a blocked word (for example "Scunthorpe"). Some words are blocked only as a whole name to avoid that (for example "dick" but not "Dickens").

**Request limits**. Each client address can send, per 10 minutes: 30 new journeys, 20 ranking submissions, 60 page-view counts, 30 analytics journey starts and 300 analytics event batches. Over the limit, the server answers `429` with a `Retry-After` header (seconds to wait). Values are constants in `server/protection.mjs`.

- The counts live in the memory of one server instance. A host that runs several instances keeps separate counts, and a restart resets them. They are a best effort; if the host offers a platform-level rate rule, use it as well.
- The address comes from `cf-connecting-ip`, then `x-real-ip`, then the last `x-forwarded-for` entry. Requests without any of these share one bucket with a 10× limit.
- Optional analytics treats a `429` as temporary and retries later; play is unaffected.

**Page views** are counted only when the browser marks the request as coming from this site (`Origin` equal to the site, or `Sec-Fetch-Site: same-origin`/`same-site`). Browsers always send these on this request. A request with neither header gets the current count back but is not counted. A request with a different site is refused. Scripts can fake these headers, so the request limit is what bounds inflation.

**Clean-up**. Starting a new journey also deletes journeys that were started more than 24 hours ago and never submitted, at most once every 10 minutes per server instance. A journey left paused for more than 24 hours can therefore no longer be ranked.

### Removing a ranking entry

`admin-remove-run.mjs` finds entries by journey ID or nickname (nickname matching ignores upper/lower case and extra spaces). It only lists matches unless you add `--confirm`.

```sh
# A SQLite copy of the database, for example a local development database
node admin-remove-run.mjs --db ranking.sqlite --nickname "Cheater"            # list only
node admin-remove-run.mjs --db ranking.sqlite --nickname "Cheater" --confirm  # delete

# The live database: read the runs table through the owner's authenticated Sites
# database connection (as in the analytics guide) and save it as
# {"complete":true,"runs":[...]} under .analytics-private/
node admin-remove-run.mjs --snapshot .analytics-private/runs.json --run <journey-id> --confirm
```

With `--snapshot`, nothing is deleted locally: `--confirm` prints the `DELETE` statement to run through the same owner connection.

## More documents

- [Project introduction (English)](../README.md) · [프로젝트 소개 (한국어)](../README.ko.md)
- [CHANGELOG (English)](../CHANGELOG.md) · [업데이트 내역 (한국어)](../CHANGELOG.ko.md)
- [Play analytics guide (English)](TELEMETRY-v16.md) · [플레이 기록 안내 (한국어)](TELEMETRY-v16.ko.md)
