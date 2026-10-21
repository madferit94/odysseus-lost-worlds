// Ranking protection: result plausibility checks.

// ---- Facts taken from the game data (game.js) ------------------------------
// LEVELS: wave stages G1 (3 waves), E1, E2, E3 (2 waves each) and FINAL ACT
// (3 waves) spawn 6 regular enemies per wave = 12 waves x 6 = 72.
// The Antinous stage adds a fighter and an archer = 2 more. Boss helpers and
// Cao Cao clones never count as normal kills. Total possible normal kills: 74.
// The two Antinous escorts are removed without counting when phase II starts,
// so a legitimate run reports 72 to 74 normal kills and exactly 4 boss kills
// (Polyphemus, Poseidon, Cao Cao, Antinous). validResult in worker.mjs already
// enforces these bounds; test-plausibility.mjs re-derives them from game.js.
export const GAME_FACTS=Object.freeze({waveEnemies:72,escortEnemies:2,maxNormalKills:74,minNormalKills:72,bosses:4,firstLifeHP:100});

// ---- Time floor -------------------------------------------------------------
// The reported elapsed time is game time (Math.ceil of seconds in play, cut-scenes
// included, pauses and death screens excluded). Game time can never run faster
// than wall-clock time, because each frame adds at most 0.04 s.
//
// How the floor was chosen (details in README "Ranking protection"):
// - Scripted parts alone need at least about 53 s even with no fighting at all:
//   1.4 s start freeze, at least about 4,100 px of walking at 205 px/s (20 s),
//   7 pauses of 1.25 s between waves, 15 s of cut-scenes and the 8 s epilogue.
//   Running the real game code with every enemy deleted on spawn took 69 s.
// - A bot running the real game code, attacking the nearest enemy and using
//   finishers, finished the easiest difficulty in 176-210 s when it could not be
//   hurt (3 weapons, 5 finisher strategies, 3 seeds; stuck runs left out) and in
//   175-187 s when it could be hurt (175-212 s over all four difficulties; it
//   never needed a retry). Its fastest run was 175 s.
// - 100 s is about 57% of the fastest bot run, so a strong human is far above it,
//   and it leaves only about 47 s of fighting for 78 enemies including 4 bosses.
export const MIN_PLAUSIBLE_ELAPSED_SECONDS=100;
// Allowed gap between the reported game time and the server's clock. The run is
// created by a request sent when the journey starts, so it can reach the server
// a few seconds late. Same value as the existing validResult rule.
export const CLOCK_TOLERANCE_SECONDS=10;

const reject=(status,code,error)=>({status,code,error});
// Runs before validResult so a clock mismatch gets a specific message (still 400).
export function checkClock(r,age){
 if(Number.isInteger(r.elapsed)&&r.elapsed>age+CLOCK_TOLERANCE_SECONDS)
  return reject(400,'clock_mismatch','This result reports more play time than has passed since the journey started. Please start a new journey.');
 return null;
}
// Runs after validResult. Returns null when the result is plausible.
export function checkPlausibility(r,age){
 if(r.normalKills>GAME_FACTS.maxNormalKills||r.normalKills<GAME_FACTS.minNormalKills||r.bossKills!==GAME_FACTS.bosses)
  return reject(422,'impossible_result','This result has more defeated enemies than the journey contains, so it was not ranked.');
 if(r.elapsed<MIN_PLAUSIBLE_ELAPSED_SECONDS||age<MIN_PLAUSIBLE_ELAPSED_SECONDS-CLOCK_TOLERANCE_SECONDS)
  return reject(422,'implausible_time','This result is faster than a real journey can be completed, so it was not ranked.');
 // A retry needs a death, and the first life starts with exactly 100 HP. Every point
 // of lost HP is counted in damageTaken, so any retry means at least 100 damage.
 if(r.retries>0&&r.damageTaken<GAME_FACTS.firstLifeHP)
  return reject(422,'impossible_result','This result reports a retry without the damage needed to fall, so it was not ranked.');
 return null;
}
