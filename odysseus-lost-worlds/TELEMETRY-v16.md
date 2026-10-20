# v16 · Opt-in play analytics

**English** · [한국어](TELEMETRY-v16.ko.md)

The v15 difficulty, damage, lives, heal zone and finisher values are unchanged. This patch adds measurement only.

## Player choice

- The checkbox above the game is off by default. Records are kept only after you tick it and then start a new game.
- If you turn it on during a game, it applies from the next new game. Turning it off stops new sends and retries. It does not delete requests already being sent or records already stored; previously sent records remain under the retention policy.
- Detailed analytics uses a new random ID for each game and is not linked to the ranking's browser ID. There is no identifier that connects one game to another. Names, emails, IP addresses, full URLs and device information are not stored in the analytics tables. This is separate from the hosting service's own access logs.
- The existing total page views and online rankings are separate features. Submitting a ranking is still optional.
- Raw records are analysed for the last 90 days, and exports include only the last 90 days. Raw records older than 90 days are cleaned up on the next analytics-start request. If nobody plays for a while, cleanup may be delayed. There is no scheduled automatic deletion yet.

## Event definitions

| Event | When it is recorded |
|---|---|
| game_start | A new journey starts. Difficulty, version, source category and test flag are stored in play_sessions (the live v16 game stores `v16`; the repository's v17 build stores `v17`) |
| stage_start | Entering a stage or resuming after a death; attempt is the 0-based attempt number for that stage |
| stage_complete | Battle ends / prologue passed / epilogue finished; recorded once per attempt |
| player_death / retry | HP reaches 0, and the player actually resumes with a remaining life |
| boss_start / boss_end | A boss attempt starts, and ends in a win or death; duration_ms is how much game time passed during that attempt |
| finisher_ready | Energy rises to or above the finisher's cost; this does not mean every condition (landing, end of animation) is also met |
| finisher_use | Only finishers that actually fire; energy is the value just before use (Zeus 200) |
| game_clear / game_over | Epilogue finished, or all 3 lives used; stored whether or not a ranking is submitted |
| session_hidden / session_resumed | The page was hidden / came back; not treated as leaving or losing |

`active_ms` is the existing game clock. It excludes pauses and the wait after a death, and includes combat effects, cutscenes and the epilogue. Because the time between frames is capped, it can be shorter than real wall-clock time on slow devices. `received_at` is the server receive time in UTC epoch seconds. The time of the last event is a lower bound on the total play time.

Boss attempts restart after a death; enemies keep their damage. Attempt 2 is therefore not a fresh full-health boss fight. Compare first-attempt success separately. Ready events measure the energy threshold, not all castability conditions.

## Source links

Add `?utm_source=x`, `?utm_source=reddit`, `?utm_source=linkedin` or `?utm_source=itch` to the live game address. `twitter` is normalised to `x` and `itch.io` to `itch`; any other value is stored only as `other`. No parameter is classed as `direct`, which does not prove the visitor typed the address. Full URLs and referrers are not stored.

This version supports progress analysis by source **from the moment an opted-in game starts**. It does not measure total visits per channel, people who did not opt in, unique visitors or return rate. Do not divide by the existing page views and read the result as a strict source conversion rate.

## Data quality

- Up to 10 events per request, up to 2,000 events per game, and up to 500 unsent events queued in memory.
- A resend with the same game ID and event number is stored only once. The screen shows "saved" only after the server confirms storage.
- Network recovery and delayed retries are supported: 8-second request timeout, retry interval up to 30 seconds. Events can be lost after a long time offline, a forced close, or reaching a limit. A journey older than 24 hours accepts no new events.
- Unsent events are not recovered after a page reload. During analysis, check separately for gaps in the event sequence, a missing start event, and an unconfirmed final outcome. A missing final event just before the end cannot be found by the sequence check alone.
- This is client-reported data, so tampering, automated visits and a self-reported test flag cannot be fully blocked. Use it as a reference for player behaviour, not for things like settling contest prizes.

## Operator-only CSV export

There is no public data viewer or CSV download path. Data is fetched only through the **site owner's authenticated Sites DB access** and turned into CSV locally. Raw data is not shown to players.

1. Using the owner connection, check the DB structure, then read every page of `play_sessions` and `play_events`. Use only the next-page value that is returned.
2. Leave out token hashes and save to a new JSON file under `.analytics-private/` in the form `{complete:true,sessions:[...],events:[...]}`. Collection continues while you read, so this is not a perfect point-in-time transactional snapshot. Re-check for events whose start record is missing.
3. Run `node export-analytics.mjs <snapshot.json> <new output folder>`. By default only `is_test=0` is included. Add `--include-tests` only for QA checks.
4. `sessions.csv` is a per-journey summary and `events.csv` has one row per action. An existing output folder is never overwritten. Do not commit raw data or CSVs to Git.

`outcome=unknown` covers journeys still in progress, endings that were not confirmed, stopped collection and similar cases. Do not automatically count it in a failure-rate denominator. Check data condition with `missing_sequences`, `has_start` and `terminal_conflict`, and analyse version, difficulty and test status separately. Before/after comparisons are observational and do not prove a causal effect.

## Verification commands

`node test-game.cjs`, `node --test test-worker.mjs test-telemetry.mjs`, `node build.mjs`.
In this repository the game files are in the current folder. `node build.mjs` builds the Worker for deployment. Tests need Node.js 24 or later.
For a test play, open the address with `?test=1`, opt in, then start. Record automated simulations and real manual browser play separately.
