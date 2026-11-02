# Autoplay balance report

**English** · [한국어](REPORT.ko.md)

Bots played the real game code (v17 `game.js` and friends, unchanged) **4,800 times**: 4 difficulties × 6 bot skill levels × 200 seeds each. Every run is a full journey with 3 lives and the game's own "continue" after a death, exactly like the page. The goal is to see *where* the game is hard, not to replace real players. Game code: v17 (commit `55539e0`); 240 of the same seeds replayed on v19 (`14dfc20`) gave identical results, so the numbers also hold for v19.

## Key findings

- **expert and average bots cleared every run on every difficulty.** For a player who reacts in about 0.3 s and makes the average bot's share of mistakes, no difficulty is hard enough to end a run.
- **novice bots** clear Ithaca (easy) 100%, Aegean (normal) 100%, Trial (hard) 90%, Wrath (extreme) 39%. The lowest is Wrath (extreme): 39% (32%–45%).
- **98% of all lost runs (222 of 227) ended in the first three fighting stages** (G1 Cyclops Ruins, Polyphemus, Poseidon).
- For **novice** bots, 752 deaths happened in G1–G3 and 5 in all later stages together. The player gains +8% attack per stage and +20 max HP per boss, so the later stages get easier for the same bot.
- **Deadliest boss:** Poseidon for novice bots on Wrath (extreme): 64% (57%–70%) of lives that entered the fight were lost there (145 of 227).
- **Expert bots lose almost no HP** (1 / 3 / 7 / 20 HP per whole journey on Ithaca (easy) / Aegean (normal) / Trial (hard) / Wrath (extreme)). They hold S toward bosses, which blocks every boss attack including water bombs and arrow rain, and they fire a finisher whenever a boss or a group is in reach.
- **A bot that never dodges at all cleared more often than the novice bot** on Trial (hard), Wrath (extreme) (100% vs 90%, 60% vs 39%). Killing fast and stealing life seems to protect more than late, half-hearted dodging and wandering.
- **Finishers are what keep the average bot alive, more than the shield.** On Wrath (extreme), the average bot loses 387 HP per journey; without finishers 1279 HP (0.89 deaths per run); without the shield 460 HP. It used about 28 finishers per journey: the bar fills in a few seconds of hitting, and each one freezes every enemy for 2.7 s, makes the player untouchable and wipes all arrows and warning circles.
- No run got stuck or hit the 60-minute game-time cap.

## The bot skill levels

Bots read the game state the way a player reads the screen and act only by pressing the game's keys (arrows, A, S, Q/W/E/R, Enter). Skill changes only *how* they see and press, never a game number. All bots keep the default bronze sword and never jump. These are **assumptions**, not measured human data.

| Setting | expert | average | novice |
| --- | ---: | ---: | ---: |
| Reaction to a new attack | 180 ± 30 ms | 300 ± 50 ms | 500 ± 100 ms |
| Attacks never noticed | 2% | 12% | 45% |
| Attacks noticed late | 5% (+100–250 ms) | 20% (+150–400 ms) | 30% (+200–500 ms) |
| Hit-box guess error | +6 ± 3 px | +0 ± 6 px | -4 ± 8 px |
| Thinks of the shield (S) | 95% | 50% | 10% |
| Re-plans every | 33 ms | 67 ms | 100 ms |
| Time between A presses | 80–120 ms | 120–250 ms | 180–400 ms |
| Lines up off the enemy row by | ± 0 px | ± 6 px | ± 14 px |
| Heal zone | 95% of zones when HP < 80% | 60% of zones when HP < 50% | 30% of zones when HP < 35% |
| Goes for green-heart enemies | when HP < 70% | when HP < 40% | no |
| Stops hitting into Antinous's counter | 98% | 60% | 20% |
| Finishers (Q/W/E/R) | aimed at bosses or groups | soon after full (1–4 s) if an enemy is in front | random key 20–60 s after full |
| Random wandering | no | 0.05 per s, 0.3–0.8 s each | 0.25 per s, 0.4–1.2 s each |

- **expert**: close to the best this bot design can do; blocks almost everything blockable and aims finishers.
- **average**: reacts in about 250–350 ms, misses or mistimes some attacks, uses the shield half the time and presses a finisher soon after the bar fills.
- **novice**: slow, misses almost half of the attacks, rarely shields, wanders, uses finishers late and at random.

Reference bots (not player models), to see what matters:
- **no-defence reference**: same speed as the novice, but walks up and attacks only; never dodges, blocks or looks for heal zones. It shows how far pure attacking gets.
- **average, no shield**: the average bot that never holds S.
- **average, no finishers**: the average bot that never uses Q/W/E/R, except the one Q the game asks for to finish Antinous.

## 1. Clear rate by difficulty and skill

Share of runs that reached the ending. In brackets: 95% confidence interval (Wilson). "No death" = cleared without losing a single life.

| Skill | Ithaca (easy) | Aegean (normal) | Trial (hard) | Wrath (extreme) |
| --- | ---: | ---: | ---: | ---: |
| expert | 100% (98%–100%)<br>no death 100% | 100% (98%–100%)<br>no death 100% | 100% (98%–100%)<br>no death 100% | 100% (98%–100%)<br>no death 100% |
| average | 100% (98%–100%)<br>no death 100% | 100% (98%–100%)<br>no death 100% | 100% (98%–100%)<br>no death 100% | 100% (98%–100%)<br>no death 100% |
| novice | 100% (98%–100%)<br>no death 100% | 100% (98%–100%)<br>no death 90% | 90% (85%–93%)<br>no death 25% | 39% (32%–45%)<br>no death 0% |
| no-defence reference | 100% (98%–100%)<br>no death 100% | 100% (98%–100%)<br>no death 100% | 100% (98%–100%)<br>no death 86% | 60% (53%–66%)<br>no death 2% |
| average, no shield | 100% (98%–100%)<br>no death 100% | 100% (98%–100%)<br>no death 100% | 100% (98%–100%)<br>no death 100% | 100% (98%–100%)<br>no death 99% |
| average, no finishers | 100% (98%–100%)<br>no death 100% | 100% (98%–100%)<br>no death 100% | 100% (98%–100%)<br>no death 90% | 99% (96%–99%)<br>no death 36% |

| Skill | Ithaca (easy) | Aegean (normal) | Trial (hard) | Wrath (extreme) |
| --- | ---: | ---: | ---: | ---: |
| expert | 0.00 deaths · 1 HP lost · 19.8 finishers · 193 s | 0.00 deaths · 3 HP lost · 21.4 finishers · 203 s | 0.00 deaths · 7 HP lost · 22.9 finishers · 213 s | 0.00 deaths · 20 HP lost · 24.6 finishers · 229 s |
| average | 0.00 deaths · 131 HP lost · 23.1 finishers · 207 s | 0.00 deaths · 210 HP lost · 24.8 finishers · 217 s | 0.00 deaths · 291 HP lost · 26.7 finishers · 227 s | 0.00 deaths · 387 HP lost · 28.2 finishers · 238 s |
| novice | 0.00 deaths · 631 HP lost · 8.0 finishers · 239 s | 0.11 deaths · 913 HP lost · 8.5 finishers · 261 s | 1.14 deaths · 1123 HP lost · 7.7 finishers · 278 s | 2.54 deaths · 970 HP lost · 3.8 finishers · 297 s |
| no-defence reference | 0.00 deaths · 535 HP lost · 6.7 finishers · 203 s | 0.01 deaths · 764 HP lost · 7.4 finishers · 220 s | 0.14 deaths · 1013 HP lost · 7.9 finishers · 233 s | 2.19 deaths · 1005 HP lost · 4.5 finishers · 249 s |
| average, no shield | 0.00 deaths · 165 HP lost · 23.0 finishers · 206 s | 0.00 deaths · 248 HP lost · 24.8 finishers · 215 s | 0.00 deaths · 341 HP lost · 26.5 finishers · 225 s | 0.01 deaths · 460 HP lost · 28.3 finishers · 238 s |
| average, no finishers | 0.00 deaths · 490 HP lost · 1.0 finishers · 207 s | 0.00 deaths · 737 HP lost · 1.0 finishers · 227 s | 0.11 deaths · 960 HP lost · 1.0 finishers · 245 s | 0.89 deaths · 1279 HP lost · 1.0 finishers · 269 s |

Second table: averages per run; the time is the median game time of cleared runs (cut-scenes included).

## What keeps the player alive (reference bots)

Each cell: clear rate · deaths per run · HP lost per run · deadliest boss (deaths per attempt). Compare each reference bot with the average bot it is based on.

| Bot | Ithaca (easy) | Aegean (normal) | Trial (hard) | Wrath (extreme) |
| --- | ---: | ---: | ---: | ---: |
| average | 100% · 0.00 · 131 HP · none | 100% · 0.00 · 210 HP · none | 100% · 0.00 · 291 HP · none | 100% · 0.00 · 387 HP · none |
| novice | 100% · 0.00 · 631 HP · none | 100% · 0.11 · 913 HP · Poseidon 3% | 90% · 1.14 · 1123 HP · Poseidon 31% | 39% · 2.54 · 970 HP · Poseidon 64% |
| no-defence reference | 100% · 0.00 · 535 HP · none | 100% · 0.01 · 764 HP · none | 100% · 0.14 · 1013 HP · Polyphemus 2% | 60% · 2.19 · 1005 HP · Poseidon 54% |
| average, no shield | 100% · 0.00 · 165 HP · none | 100% · 0.00 · 248 HP · none | 100% · 0.00 · 341 HP · none | 100% · 0.01 · 460 HP · Polyphemus 1.0% |
| average, no finishers | 100% · 0.00 · 490 HP · none | 100% · 0.00 · 737 HP · none | 100% · 0.11 · 960 HP · Poseidon 5% | 99% · 0.89 · 1279 HP · Poseidon 23% |

## 2. Where runs end

Each cell: share of runs that **entered** the stage, then how many runs **ended** there (last life lost). Player-model bots only; skills with no lost run get one line.

- **expert**: all runs cleared on every difficulty; no stage ended a run.

- **average**: all runs cleared on every difficulty; no stage ended a run.

**novice**

| Stage | Ithaca (easy) | Aegean (normal) | Trial (hard) | Wrath (extreme) |
| --- | ---: | ---: | ---: | ---: |
| Prologue Troy | 100% | 100% | 100% | 100% |
| G1 Cyclops Ruins | 100% | 100% | 100% | 100% |
| G2 Polyphemus | 100% | 100% | 100% | 100% · **ended 28** |
| G3 Poseidon | 100% | 100% | 100% · **ended 20** | 86% · **ended 90** |
| E1 Yellow Turban Village | 100% | 100% | 90% | 41% |
| E2 Bamboo Forest | 100% | 100% | 90% | 41% |
| E3 Burning Fortress | 100% | 100% | 90% | 41% |
| E4 Cao Cao | 100% | 100% | 90% | 41% · **ended 5** |
| Final Act Ithaca | 100% | 100% | 90% | 39% |
| Antinous | 100% | 100% | 90% | 39% |
| Epilogue | 100% | 100% | 90% | 39% |

## 3. Deaths per boss attempt

An attempt is one life that enters the boss fight (the first entry or a continue). The rate is lives lost at that boss ÷ attempts, with the 95% interval and the raw counts. Attempts within one run are not fully independent, so read the interval as approximate.

- **expert**: no deaths at any boss on any difficulty.

- **average**: no deaths at any boss on any difficulty.

**novice**

| Boss | Ithaca (easy) | Aegean (normal) | Trial (hard) | Wrath (extreme) |
| --- | ---: | ---: | ---: | ---: |
| Polyphemus | 0% (0%–2%) · 0/200 | 1.0% (0.3%–4%) · 2/202 | 27% (22%–32%) · 73/273 | 48% (43%–54%) · 161/333 |
| Poseidon | 0% (0%–2%) · 0/200 | 3% (1%–6%) · 6/206 | 31% (25%–36%) · 79/259 | 64% (57%–70%) · 145/227 |
| Cao Cao | 0% (0%–2%) · 0/200 | 0% (0%–2%) · 0/200 | 0% (0%–2%) · 0/180 | 6% (3%–13%) · 5/82 |
| Antinous | 0% (0%–2%) · 0/200 | 0% (0%–2%) · 0/200 | 0% (0%–2%) · 0/180 | 0% (0%–5%) · 0/77 |

## 4. Median boss fight time

Seconds of game time from entering the fight to the boss falling, added up over every life used, for fights that were won. In brackets: 90th percentile.

| Boss | Skill | Ithaca (easy) | Aegean (normal) | Trial (hard) | Wrath (extreme) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Polyphemus | expert | 9.0 (11.9) | 11.1 (12.7) | 13.8 (15.2) | 14.8 (16.1) |
| Polyphemus | average | 10.6 (13.7) | 12.3 (14.9) | 14.1 (16.8) | 15.6 (18.2) |
| Polyphemus | novice | 11.3 (14.4) | 13.1 (16.1) | 16.6 (20.6) | 19.1 (22.7) |
| Poseidon | expert | 9.7 (12.9) | 9.7 (13.2) | 15.7 (19.8) | 14.7 (20.8) |
| Poseidon | average | 10.9 (13.7) | 12.0 (14.8) | 14.5 (17.5) | 16.7 (21.8) |
| Poseidon | novice | 11.5 (14.1) | 13.4 (16.6) | 16.3 (19.9) | 18.9 (22.3) |
| Cao Cao | expert | 7.9 (10.6) | 8.6 (10.9) | 10.8 (12.2) | 11.9 (13.7) |
| Cao Cao | average | 8.9 (11.4) | 10.3 (12.8) | 11.7 (14.3) | 12.9 (16.0) |
| Cao Cao | novice | 9.6 (12.0) | 11.1 (15.0) | 13.3 (16.1) | 14.7 (17.1) |
| Antinous | expert | 7.6 (8.3) | 8.9 (9.9) | 10.6 (11.8) | 12.6 (14.4) |
| Antinous | average | 10.9 (13.9) | 12.4 (15.5) | 14.3 (17.3) | 15.2 (18.9) |
| Antinous | novice | 12.3 (15.0) | 13.8 (16.9) | 15.3 (18.3) | 16.7 (19.6) |

## 5. HP lost and close calls per stage

Mean HP lost in the stage (all lives) · share of runs whose HP fell below 25% there (or died). Only runs that entered the stage count. Late stages have more max HP (+20 per boss), so the same HP loss is a smaller share.

**average**

| Stage | Ithaca (easy) | Aegean (normal) | Trial (hard) | Wrath (extreme) |
| --- | ---: | ---: | ---: | ---: |
| Prologue Troy | 0 · 0% | 0 · 0% | 0 · 0% | 0 · 0% |
| G1 Cyclops Ruins | 18 · 0% | 28 · 0% | 38 · 0% | 53 · 0% |
| G2 Polyphemus | 15 · 0% | 24 · 0% | 37 · 0% | 53 · 3% |
| G3 Poseidon | 33 · 0% | 47 · 0% | 64 · 0% | 87 · 5% |
| E1 Yellow Turban Village | 10 · 0% | 16 · 0% | 18 · 0% | 21 · 0% |
| E2 Bamboo Forest | 9 · 0% | 17 · 0% | 23 · 0% | 30 · 0% |
| E3 Burning Fortress | 12 · 0% | 21 · 0% | 26 · 0% | 31 · 0% |
| E4 Cao Cao | 19 · 0% | 27 · 0% | 36 · 0% | 50 · 0% |
| Final Act Ithaca | 7 · 0% | 13 · 0% | 20 · 0% | 21 · 0% |
| Antinous | 8 · 0% | 17 · 0% | 30 · 0% | 41 · 0% |
| Epilogue | 0 · 0% | 0 · 0% | 0 · 0% | 0 · 0% |

**novice**

| Stage | Ithaca (easy) | Aegean (normal) | Trial (hard) | Wrath (extreme) |
| --- | ---: | ---: | ---: | ---: |
| Prologue Troy | 0 · 0% | 0 · 0% | 0 · 0% | 0 · 0% |
| G1 Cyclops Ruins | 129 · 0.5% | 196 · 34% | 229 · 68% | 306 · 99% |
| G2 Polyphemus | 65 · 2% | 91 · 21% | 134 · 72% | 173 · 94% |
| G3 Poseidon | 80 · 0.5% | 113 · 22% | 159 · 77% | 184 · 95% |
| E1 Yellow Turban Village | 70 · 0% | 90 · 0% | 115 · 0% | 151 · 0% |
| E2 Bamboo Forest | 67 · 0% | 101 · 0% | 119 · 0% | 154 · 9% |
| E3 Burning Fortress | 67 · 0% | 103 · 0% | 125 · 0% | 149 · 5% |
| E4 Cao Cao | 58 · 0% | 81 · 0% | 119 · 8% | 144 · 33% |
| Final Act Ithaca | 44 · 0% | 69 · 0% | 101 · 0% | 122 · 0% |
| Antinous | 50 · 0% | 69 · 0% | 90 · 0% | 108 · 0% |
| Epilogue | 0 · 0% | 0 · 0% | 0 · 0% | 0 · 0% |

Expert bots lost at most 11.9 HP on average in any stage, so their table is left out.

## 6. Hardest spots

Stages ranked by deaths per 100 runs that entered them, pooled over the four difficulties (ties broken by close calls, then HP lost). Top 3 per skill.

- **expert**: nothing stands out (no deaths and no run below 25% HP in any stage).

**average**

| # | Stage | Deaths / 100 runs | HP < 25% | Mean HP lost | By difficulty (deaths / 100) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | G3 Poseidon | 0.0 | 1% (0.6%–2%) | 58 | Ithaca 0.0 · Aegean 0.0 · Trial 0.0 · Wrath 0.0 |
| 2 | G2 Polyphemus | 0.0 | 0.8% (0.3%–2%) | 32 | Ithaca 0.0 · Aegean 0.0 · Trial 0.0 · Wrath 0.0 |
| 3 | G1 Cyclops Ruins | 0.0 | 0% (0%–0.5%) | 34 | Ithaca 0.0 · Aegean 0.0 · Trial 0.0 · Wrath 0.0 |

**novice**

| # | Stage | Deaths / 100 runs | HP < 25% | Mean HP lost | By difficulty (deaths / 100) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | G1 Cyclops Ruins | 35.3 | 50% (47%–53%) | 215 | Ithaca 0.0 · Aegean 6.5 · Trial 36.0 · Wrath 98.5 |
| 2 | G2 Polyphemus | 30.0 | 47% (43%–50%) | 116 | Ithaca 0.0 · Aegean 1.0 · Trial 38.5 · Wrath 80.5 |
| 3 | G3 Poseidon | 29.8 | 47% (43%–50%) | 132 | Ithaca 0.0 · Aegean 3.0 · Trial 39.5 · Wrath 84.3 |

## 7. Candidates to look at (not decisions)

These are places where the numbers stand out. They are questions for play-testing with people, not proven fixes; no number change is suggested here as fact.

1. **Early difficulty spike (G1–G3).** novice bots: 752 deaths in G1–G3 vs 5 afterwards. Mean HP lost in G1 Cyclops Ruins (129 / 196 / 229 / 306) is higher than in the Final Act Ithaca waves (44 / 69 / 101 / 122) on every difficulty. In the code, attack grows +8% per stage and max HP +20 per boss, so the opening is fought with the weakest Odysseus. Question: is the first real fight meant to be the hardest wall?
2. **Poseidon and Polyphemus on the harder difficulties.** novice bot deaths per attempt (Ithaca (easy) / Aegean (normal) / Trial (hard) / Wrath (extreme)): Polyphemus 0% / 1.0% / 27% / 48%; Poseidon 0% / 3% / 31% / 64%; Cao Cao 0% / 0% / 0% / 6%; Antinous 0% / 0% / 0% / 0%. The two Greek bosses come before most of the attack and HP growth.
3. **Finishers as a defence.** HP lost per journey (Ithaca (easy) / Aegean (normal) / Trial (hard) / Wrath (extreme)): average bot 131 / 210 / 291 / 387; without finishers 490 / 737 / 960 / 1279; without the shield 165 / 248 / 341 / 460. The average bot used 23 / 25 / 27 / 28 finishers per journey. In the code a hit gives 8 energy (12 on a boss), a kill 13 and a third combo hit 10, and each finisher stops the world for 2.7 s, gives 3 s of invulnerability and clears every projectile and hazard. Question: are finishers meant to be this frequent, and this protective?
4. **The shield against bosses.** Expert bots lose 0.6 / 0.7 / 2.1 / 6.4 HP in all four boss stages together. In the code, every boss attack (`bossAttack` hazards, dashes, projectiles) is blocked when S is held facing the boss, including area attacks that fall from above. For the average bot the shield matters much less than finishers (see above). Question: should some boss attacks need a dodge instead of a block?
5. **How far apart the difficulties are.** The average bot clears 100% / 100% / 100% / 100% and loses 131 / 210 / 291 / 387 HP per journey on Ithaca (easy) / Aegean (normal) / Trial (hard) / Wrath (extreme). Enemy numbers go from ×0.85 to ×1.3–1.35, while healing (life steal, green hearts, heal zones, +12 HP between waves, +20 max HP per boss) stays the same. Question: should "extreme" be a real threat for a steady, average player?
6. **Later stages for weaker players.** Novice bot deaths from E1 to the end: 0 / 0 / 0 / 5 (Ithaca (easy) / Aegean (normal) / Trial (hard) / Wrath (extreme)). Once past Poseidon, almost everyone finishes. Question: does the second half still feel tense?

## 8. What this can and cannot tell us

**Can:** compare stages, bosses and difficulties with each other *for the same bot*; show where damage and deaths pile up; show how much each difficulty step changes the outcome; repeat exactly after a balance change (same seeds give the same runs).

**Cannot:**
- **Bots are not people.** They know exactly where every hit box is (with a set error), never get confused by the screen, never panic, never learn, and never quit out of boredom. People also jump and switch weapons; these bots never do.
- **The skill levels are assumptions.** Reaction times and mistake rates were chosen by hand, not measured. A different but equally reasonable choice could move the clear rates a lot. Treat the numbers as **relative** (which stage is harder than which), not as "X% of players will clear".
- **No real player data backs this yet.** The live site has about 110 page views and no finished run, which is too little to check the bots against.
- The page itself is not drawn (no rendering), and the game runs at a fixed 60 steps per second. Game rules are unchanged, but rendering normally uses the random number generator for screen shake, so a seed here does not match a seed in a browser.
- Confidence intervals cover only the randomness of the runs, not the uncertainty in the bot models.

## 9. How to run

Use Node.js 24 or later inside the game folder (`odysseus-lost-worlds/odysseus-lost-worlds`). No `npm install` is needed.

```sh
node analysis/autoplay/simulate.mjs                  # full batch (200 seeds per cell), rewrites results/
node analysis/autoplay/simulate.mjs --runs 20        # quick look
node analysis/autoplay/simulate.mjs --one wrath novice 7   # one run as JSON
node analysis/autoplay/simulate.mjs --report-only    # rebuild the reports from summary.json
node --test analysis/autoplay/check.mjs              # simulator checks
```

Other options: `--difficulties ithaca,wrath`, `--skills expert,novice`, `--seed 1000` (first seed), `--workers 4`, `--out some/folder`. Bot profiles are in `skills.mjs`; the bot itself is `bot.js`. After any change to the game numbers, run the batch again and compare `summary.json`.

## Run details

| Item | Value |
| --- | ---: |
| Runs | 4800 (200 per difficulty × skill, seeds 1–200) |
| Game version | v17 · commit `55539e0`; re-checked on v19 (`14dfc20`): 240 same-seed runs identical |
| Wall time | 359 s · 7 worker threads · Node v24.14.1 |
| Game time played | 296.6 h |
| Time step | 1/60 s |
| Safety caps | 60 min game time → timeout; no progress for 180 s → stuck |
| Weapon | bronze sword (default, never switched) |
| Files | `runs.csv` one row per run · `summary.json` all tables above |
