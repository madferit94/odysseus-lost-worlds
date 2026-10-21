# Optional play analytics (added in v16)

**English** · [한국어](TELEMETRY-v16.ko.md)

Play analytics was added in v16 and only measures play. It does not change difficulty, damage, lives, heal zones or finisher numbers. The current game (v17) uses the same events and fields; only the version label it records is `v17`.

## Player choice

- The checkbox above the game is off by default. Records are collected only after you tick it and then start a new game.
- Ticking it in the middle of a game takes effect from the next new game. Unticking it stops new sends and retries. It does not cancel a request already on its way or delete records that were already saved.
- Each journey uses a new random ID that is not linked to the browser ID used for rankings. The analytics tables do not store names, emails, IP addresses, full URLs or device details. The hosting service's own access logs are separate.
- The page view counter and online rankings are separate features. Saving a ranking is still optional.
- Raw records are analysed for the last 90 days. Records older than 90 days are removed on the next analytics-start request, so cleanup can be delayed while nobody plays. There is no scheduled deletion job yet.

## Event definitions

| Event | When it is recorded |
|---|---|
| game_start | A new journey starts. Difficulty, build version (the current game sends `v17`; the server also accepts `v16`), source category and test flag are stored in `play_sessions` |
| stage_start | Entering a stage or continuing after a death. `attempt` counts tries at that stage, starting from 0 |
| stage_complete | A battle ends, the prologue is passed or the epilogue finishes; recorded once per attempt |
| player_death / retry | HP reaches 0 / the journey actually continues with a remaining life |
| boss_start / boss_end | A boss attempt starts / ends in victory or death. `duration_ms` is game time that passed during that attempt |
| finisher_ready | Energy rises to the amount a finisher needs. It does not mean landing, animation and every other condition were met |
| finisher_use | Only finishers that actually fire. `energy` is the value just before use (Zeus: 200) |
| game_clear / game_over | The epilogue finishes / all 3 lives are used. Saved whether or not a ranking is submitted |
| session_hidden / session_resumed | The page is hidden / shown again. This is not treated as quitting or losing |

`active_ms` is the game's own clock. It leaves out pauses and the wait after a death, and includes battle effects, cutscenes and the epilogue. Each frame step has an upper limit, so on slow devices it can be shorter than real time. `received_at` is the server receive time in UTC epoch seconds. The last event time is a lower bound for total play time.

Boss attempts restart after a death, but enemies keep the damage they took, so attempt 2 is not a fresh full-health boss fight. Compare first-attempt success separately. Ready events measure the energy threshold, not every condition needed to cast.

## Source links

Add `?utm_source=x`, `?utm_source=reddit`, `?utm_source=linkedin` or `?utm_source=itch` to the public game address. `twitter` is stored as `x` and `itch.io` as `itch`; any other value is stored only as `other`. No parameter is stored as `direct`, which does not prove someone typed the address. Full URLs and referrers are not stored.

This supports progress analysis by source **after a player opted in and started a game**. It does not measure total visits per channel, people who did not opt in, unique visitors or return rates. Do not combine it with the page view count to claim a precise conversion rate.

## Data quality

- At most 10 events per request, 2,000 events per journey and 500 unsent events waiting in memory.
- A resent event with the same journey ID and sequence number is stored once. The screen shows "saved" only after the server confirms it.
- Sends recover after network loss and retry with a delay: 8-second request limit, up to 30 seconds between retries. Records can be lost after a long time offline, a forced close or when a limit is reached. Journeys older than 24 hours accept no new events.
- Unsent events are not recovered after a page reload. When analysing, check separately for gaps in event order, missing start events and unconfirmed final results. A missing last event right before closing cannot be found by checking the order alone.
- The data is reported by the browser, so tampering, automated visits and a self-reported test flag cannot be fully blocked. Use it as a guide to player behaviour, not for prize settlement or similar decisions.

## Operator-only export

There is no public way to read the data or download a CSV. Only the **site owner's authenticated Sites database queries** can read it, and CSV files are made locally. Players never see raw records.

1. Using the owner connection, check the database structure, then read every page of `play_sessions` and `play_events`. Use only the next-page value the query returns.
2. Leave out token hashes and save the result as a new JSON file under `.analytics-private/` in the form `{complete:true,sessions:[...],events:[...]}`. Collection keeps running while you read, so this is not a single-transaction snapshot. Check again for events whose start record is missing.
3. Run `node export-analytics.mjs <snapshot.json> <new output folder>`. By default only `is_test=0` is included. Add `--include-tests` only for QA checks.
4. `sessions.csv` has one row per journey and `events.csv` one row per action. Existing output folders are never overwritten. Do not commit raw data or CSV files to Git.

`outcome=unknown` covers journeys still in progress, endings that were not confirmed and stopped collection. Do not count all of them as failures. Use `missing_sequences`, `has_start` and `terminal_conflict` to check data health, and split analysis by version, difficulty and test flag. Before/after comparisons are observational and do not prove cause and effect.

## Verification commands

Inside the game folder, with Node.js 24 or later: `npm test` (runs `node test-game.cjs` and `node --test test-worker.mjs test-telemetry.mjs test-display.mjs`) and `node build.mjs`, which builds the deployable Worker.
For a test play, open the game with `?test=1`, opt in, then start. Keep automated simulations and real manual browser play recorded separately.
