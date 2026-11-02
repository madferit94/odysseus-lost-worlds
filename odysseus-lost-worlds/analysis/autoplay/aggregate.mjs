// Turns per-run records into per-cell (difficulty x skill) numbers, CSV rows and a ranked list of hard spots.
import {STAGES, STAGE_SHORT, BOSSES, BOSS_STAGES} from './run.mjs';

// Wilson score interval for a proportion k/n (95% when z = 1.96).
export function wilson(k, n, z = 1.96) {
  if (!n) return {k, n, p: null, lo: null, hi: null};
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return {k, n, p: r4(p), lo: r4(Math.max(0, (c - m) / d)), hi: r4(Math.min(1, (c + m) / d))};
}
export function quantile(values, q) {
  const v = values.filter(x => x !== null && x !== undefined).sort((a, b) => a - b);
  if (!v.length) return null;
  const i = (v.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return r2(v[lo] + (v[hi] - v[lo]) * (i - lo));
}
const mean = v => v.length ? r2(v.reduce((a, b) => a + b, 0) / v.length) : null;
const r2 = x => Math.round(x * 100) / 100, r4 = x => Math.round(x * 10000) / 10000;
const NEAR_DEATH = 0.25;

export function aggregateCell(runs) {
  const n = runs.length, outcomes = {clear: 0, gameover: 0, timeout: 0, stuck: 0};
  for (const r of runs) outcomes[r.outcome]++;
  const clears = runs.filter(r => r.outcome === 'clear');
  const stages = [];
  for (let s = 0; s < STAGES; s++) {
    const reached = runs.filter(r => r.stageSeconds[s] !== null);
    const endedHere = reached.filter(r => r.outcome !== 'clear' && r.endStage === s).length;
    const deaths = reached.reduce((a, r) => a + r.deathsByStage[s], 0);
    const finished = reached.filter(r => r.endStage > s || r.outcome === 'clear');
    stages.push({
      stage: s, name: STAGE_SHORT[s], reached: reached.length, endedHere,
      lossRate: wilson(endedHere, reached.length),
      deaths, deathsPer100: reached.length ? r2(100 * deaths / reached.length) : null,
      medianSeconds: quantile(finished.map(r => r.stageSeconds[s]), 0.5),
      meanDamage: mean(reached.map(r => r.stageDamage[s])),
      medianMinHP: quantile(reached.map(r => r.stageMinHP[s]), 0.5),
      // Runs whose HP fell below 25% (or that died) in this stage.
      nearDeath: wilson(reached.filter(r => r.stageMinHP[s] !== null && r.stageMinHP[s] < NEAR_DEATH).length, reached.length),
    });
  }
  const bosses = {};
  for (const b of BOSSES) {
    const reached = runs.filter(r => r.bosses[b].reached), won = reached.filter(r => r.bosses[b].won);
    const attempts = reached.reduce((a, r) => a + r.bosses[b].attempts, 0), deaths = reached.reduce((a, r) => a + r.bosses[b].deaths, 0);
    bosses[b] = {
      reached: reached.length, won: won.length, attempts, deaths,
      deathPerAttempt: wilson(deaths, attempts),
      winRate: wilson(won.length, reached.length),
      medianFightSeconds: quantile(won.map(r => r.bosses[b].fightSeconds), 0.5),
      p90FightSeconds: quantile(won.map(r => r.bosses[b].fightSeconds), 0.9),
      meanDamage: mean(reached.map(r => r.stageDamage[Number(Object.keys(BOSS_STAGES).find(k => BOSS_STAGES[k] === b))])),
    };
  }
  const deathsAll = runs.map(r => r.deathsByStage.reduce((a, b) => a + b, 0));
  const specialsAll = runs.map(r => Object.values(r.specials).reduce((a, b) => a + b, 0));
  return {
    n, outcomes, clearRate: wilson(outcomes.clear, n),
    noDeathClearRate: wilson(clears.filter(r => r.retries === 0).length, n),
    deathsPerRun: mean(deathsAll), damagePerRun: mean(runs.map(r => r.damageTaken)), specialsPerRun: mean(specialsAll),
    medianClearSeconds: quantile(clears.map(r => r.gameSeconds), 0.5), medianClearScore: quantile(clears.map(r => r.score), 0.5),
    stages, bosses,
  };
}

// Hard spots: stages ranked by deaths per 100 runs that reached them, pooled over difficulties,
// for one skill. Also returns the per-difficulty evidence.
export function rankSpikes(cells, skill, difficulties) {
  const rows = [];
  for (let s = 0; s < STAGES; s++) {
    let reached = 0, deaths = 0, ended = 0, near = 0, damage = 0;
    const by = {};
    for (const d of difficulties) {
      const st = cells[d + '/' + skill]?.stages[s];
      if (!st) continue;
      reached += st.reached; deaths += st.deaths; ended += st.endedHere; near += st.nearDeath.k; damage += (st.meanDamage || 0) * st.reached;
      by[d] = {deathsPer100: st.deathsPer100, lossRate: st.lossRate.p, nearDeath: st.nearDeath.p, meanDamage: st.meanDamage};
    }
    rows.push({stage: s, name: STAGE_SHORT[s], boss: BOSS_STAGES[s] || '', reached, deaths, deathsPer100: reached ? r2(100 * deaths / reached) : 0, endedHere: ended, nearDeath: wilson(near, reached), meanDamage: reached ? r2(damage / reached) : 0, byDifficulty: by});
  }
  return rows.sort((a, b) => b.deathsPer100 - a.deathsPer100 || b.nearDeath.p - a.nearDeath.p || b.meanDamage - a.meanDamage);
}

export const CSV_COLUMNS = [
  'difficulty', 'skill', 'seed', 'outcome', 'end_stage', 'end_stage_name', 'end_boss', 'game_seconds', 'score', 'kills', 'retries', 'lives_left', 'damage_taken',
  'specials_athena', 'specials_achilles', 'specials_hermes', 'specials_zeus',
  ...['deaths', 'seconds', 'damage', 'min_hp_share'].flatMap(k => Array.from({length: STAGES}, (_, s) => `${k}_s${s}`)),
  ...BOSSES.flatMap(b => [`${b}_attempts`, `${b}_deaths`, `${b}_won`, `${b}_fight_seconds`]),
];
export function csvRow(r) {
  const cells = [r.difficulty, r.skill, r.seed, r.outcome, r.endStage, r.endStageName, r.endBoss, r.gameSeconds, r.score, r.kills, r.retries, r.livesLeft, r.damageTaken,
    r.specials.athena, r.specials.achilles, r.specials.hermes, r.specials.zeus,
    ...r.deathsByStage, ...r.stageSeconds, ...r.stageDamage, ...r.stageMinHP,
    ...BOSSES.flatMap(b => { const x = r.bosses[b]; return [x.attempts, x.deaths, x.won ? 1 : 0, x.reached ? x.fightSeconds : '']; })];
  return cells.map(v => v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v)).join(',');
}
