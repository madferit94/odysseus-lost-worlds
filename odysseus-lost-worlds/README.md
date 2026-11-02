# Game folder guide

**English** · [한국어](README.ko.md)

This folder holds the browser game and its server code. For what the game is and how to play it, see the [project introduction](../README.md). Version-by-version changes are in the [CHANGELOG](../CHANGELOG.md).

## What is in this folder

| Path | What it does |
| --- | --- |
| `index.html`, `display.css` | Game page and its layout |
| `game.js` and the other `*.js` files | Movement, combat, bosses, finishers, screen display, rankings, page views and optional play analytics |
| `checkpoint.js` | v19 Continue: saves a checkpoint in this browser at each stage and restores it |
| `practice.js` | v19 Boss practice: remembers beaten bosses and runs a single boss fight |
| `display.js` | v17 toolbar: fullscreen, collapsible controls guide, language and sound buttons |
| `assets/` | Game images |
| `server/worker.mjs` | Server for online rankings (one board per difficulty from v18) and page views |
| `server/telemetry.mjs` | Server for optional play analytics |
| `server/protection.mjs` | Ranking result checks, request limits and clean-up of unfinished journeys |
| `server/nickname.mjs`, `server/nickname-blocklist.mjs` | Nickname clean-up and the editable list of blocked and reserved names |
| `db/`, `drizzle/` | Database tables and their change history |
| `export-analytics.mjs` | Operator-only tool that turns an analytics snapshot into CSV files |
| `admin-remove-run.mjs` | Operator-only tool that finds and removes ranking entries |
| `test-game.cjs`, `test-*.mjs` | Automated checks |
| `analysis/autoplay/` | Balance simulation: bots play the real game thousands of times; results and a plain report are in `analysis/autoplay/results/REPORT.md` |
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

## Boss practice (v19)

`practice.js` remembers in `localStorage` (key `odysseus-bosses-beaten-v1`) every boss this browser has defeated, on any journey. The Boss practice menu lists the four bosses; ones not yet beaten are locked, and with none beaten the menu explains how to unlock them.

- A practice starts the boss stage through `enter()` on the difficulty selected in the picker, with the state a hero has on arrival: maximum HP 100 + 20 for each earlier boss, those bosses' blessings, the stage's attack bonus, weapon 1, no energy and one life.
- It ends when the boss falls (no cut-scene or next stage follows) or at the first fall. The menu then shows victory or defeat, the boss, the difficulty and the game time, and stays open for another try.
- **Not ranked, checkpoint untouched.** A practice never starts a ranking run, drops any run this page started earlier, and is refused by the server if marked as practice. `checkpoint.js` saves only for new and continued journeys, so a practice never writes or deletes the Continue checkpoint.
- While a finished ranked journey waits for its nickname, the practice button is disabled with a note (Korean and English) until the result is saved or skipped (`Skip, do not save` in the ranking form). Otherwise starting a practice would drop that result.
- Optional analytics: a practice is its own session with `mode` = `practice`; a win ends with `game_clear`, a loss with `game_over`.

## Continue from a checkpoint (v19)

`checkpoint.js` saves a checkpoint in the browser's `localStorage` (key `odysseus-checkpoint-v1`) each time stages 1-9 start. It stores only what `game.js` carries from one stage to the next: stage, difficulty, lives, maximum HP (boss blessings), finisher energy, shield (up to 60; `enter()` does not reset it), weapon, defeated bosses, the celestial compass, score, kills and the journey counters. Every stage start refills HP, so HP is not stored. A continued stage therefore starts with the same hero and journey state as when it first began; only game time restarts.

- Continue appears on the title, game over and ending screens only when a valid checkpoint exists. It sets that state and starts the stage through the same `enter()` the game uses, on the saved difficulty (not the one selected in the picker). Game time restarts from 0.
- A game over keeps the checkpoint (from the start of that stage, with the lives it had then). Reaching home deletes it. A new game replaces it when the new journey reaches stage 1; the prologue has no fights, so pressing Enter by mistake does not lose a saved journey at once.
- Storage errors (blocked, full, private mode) are caught; the game then simply has no Continue. A checkpoint that does not match the game rules (for example more maximum HP than the defeated bosses give) is ignored and removed.
- **Not ranked.** A continued journey never starts a ranking run, drops any run this page started earlier, and never shows the nickname form. The server also refuses `POST /api/runs` and `POST /api/results` that say `mode` is anything other than `normal` (`400`, `unranked_mode`). The server cannot see the game, so a modified browser could still send a made-up result as a normal journey; that is the same limit as described under Ranking protection, and such entries are removed by the operator.
- Optional analytics: a continued journey is a new session with `mode` = `continue` ([analytics guide](TELEMETRY-v16.md)).

## Rankings by difficulty (v18)

Each difficulty has its own ranking board. The page shows four tabs plus "Earlier records" (results with no recorded difficulty).

- When a journey starts, the page sends the selected difficulty with the start request (`POST /api/runs`, body `{"difficulty":"trial"}`). The server checks it is one of `ithaca`, `aegean`, `trial`, `wrath` and stores it in the `runs.difficulty` column. An unknown value is refused (`400`, `invalid_difficulty`).
- The result sent at the end carries no difficulty. If a request includes one, the server ignores it: the run-start record decides the board. The nickname, ownership and result checks below are unchanged.
- `GET /api/leaderboard?difficulty=ithaca|aegean|trial|wrath|legacy` returns one board (top 20 and your best on that board). Without the parameter, the reply is the old combined list in the old shape, so a page loaded before the update keeps working.
- **Results with no recorded difficulty (`legacy`): saved before v18, or started from a page opened before the update.** Before v18, the `runs` table did not store a difficulty, and the optional analytics records are separate, opt-in and not linked to ranking entries. So the difficulty of an older result cannot be known. It is not assumed to be Normal: those results keep an empty difficulty and are shown only under "Earlier records (before difficulty split)". A journey started by a page loaded before the update (which sends no difficulty) is listed there too.
- Limit: like the rest of the result, the difficulty is reported by the player's browser when the journey starts. The server cannot confirm the game was really played on that difficulty.
- Database change: `drizzle/0004_runs_difficulty.sql` only adds the column and an index. Existing rows and columns are not changed.

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
