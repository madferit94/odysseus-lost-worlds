// Plays one full journey of the real game with a bot and turns the game's own
// analytics events into a one-run summary.
import {createGame, mulberry32, seedFor} from './sandbox.mjs';
import {SKILLS} from './skills.mjs';

export const STAGES = 11;
export const BOSS_STAGES = {2: 'polyphemus', 3: 'poseidon', 7: 'caocao', 9: 'antinous'};
export const BOSSES = Object.values(BOSS_STAGES);
export const STAGE_SHORT = ['Prologue Troy', 'G1 Cyclops Ruins', 'G2 Polyphemus', 'G3 Poseidon', 'E1 Yellow Turban Village', 'E2 Bamboo Forest', 'E3 Burning Fortress', 'E4 Cao Cao', 'Final Act Ithaca', 'Antinous', 'Epilogue'];

/**
 * @param {object} o
 * @param {'ithaca'|'aegean'|'trial'|'wrath'} o.difficulty
 * @param {'expert'|'average'|'novice'} o.skill
 * @param {number} o.seed  same seed -> same run
 * @param {number} [o.maxGameSeconds=3600]  game-time cap; the run is marked 'timeout' after it
 * @param {number} [o.stuckSeconds=180]  no progress for this long -> 'stuck'
 * @param {{at:number,code:string}[]} [o.inject]  test-only: game code run once game time passes `at`
 *   (tried again every frame while it returns false)
 */
export function simulateRun({difficulty, skill, seed, maxGameSeconds = 3600, stuckSeconds = 180, inject = []}) {
  const profile = SKILLS[skill];
  if (!profile) throw Error('Unknown skill ' + skill);
  const game = createGame(seedFor(seed, difficulty));
  const ctx = game.context;
  if (!game.run(`selectDifficulty(${JSON.stringify(difficulty)})`)) throw Error('Unknown difficulty ' + difficulty);
  game.run('reset();');
  const bot = ctx.__makeBot(profile, mulberry32(seedFor(seed, difficulty, skill, 'bot')), game.press);
  const dt = 1 / 60, maxFrames = Math.ceil(maxGameSeconds * 60 * 1.5) + 6000;
  const pending = inject.map(i => ({...i}));
  const minHP = Array(STAGES).fill(null);
  let outcome = null, lastSig = '', lastChange = 0;
  for (let frame = 0; frame < maxFrames; frame++) {
    bot.tick();
    ctx.update(dt);
    const state = ctx.__state(), t = ctx.__time(), s = ctx.__stage(), hp = ctx.__hpShare();
    if (minHP[s] === null || hp < minHP[s]) minHP[s] = hp;
    for (const i of pending) if (!i.done && t >= i.at && state === 'play' && game.run(i.code) !== false) i.done = true;
    if (state === 'end') { outcome = 'clear'; break; }
    if (state === 'gameover') { outcome = 'gameover'; break; }
    if (frame % 60 === 0) {
      if (t >= maxGameSeconds) { outcome = 'timeout'; break; }
      const v = ctx.__peek();
      const sig = [v.stage, v.cutscene, v.waveNumber, v.cleared, v.enemyHP, v.alive, v.lives, v.alive ? 0 : Math.round(v.x / 40)].join('|');
      if (sig !== lastSig) { lastSig = sig; lastChange = t; } else if (t - lastChange > stuckSeconds) { outcome = 'stuck'; break; }
    }
  }
  if (!outcome) outcome = 'timeout';
  return summarize({difficulty, skill, seed, outcome, events: game.events, final: ctx.__peek(), minHP});
}

export function summarize({difficulty, skill, seed, outcome, events, final, minHP}) {
  const enter = Array(STAGES).fill(null), enterDamage = Array(STAGES).fill(null);
  const deaths = Array(STAGES).fill(0), specials = {athena: 0, achilles: 0, hermes: 0, zeus: 0};
  const bosses = Object.fromEntries(BOSSES.map(b => [b, {reached: false, won: false, attempts: 0, deaths: 0, fightSeconds: 0, lifeSeconds: []}]));
  for (const e of events) {
    if (e.name === 'stage_start' && e.attempt === 0 && enter[e.stage] === null) { enter[e.stage] = e.activeMs / 1000; enterDamage[e.stage] = e.damageTaken; }
    else if (e.name === 'player_death') deaths[e.stage]++;
    else if (e.name === 'finisher_use') specials[e.god]++;
    else if (e.name === 'boss_start') { const b = bosses[e.boss]; b.reached = true; b.attempts++; }
    else if (e.name === 'boss_end') {
      const b = bosses[e.boss]; b.fightSeconds += e.durationMs / 1000; b.lifeSeconds.push(e.durationMs / 1000);
      if (e.outcome === 'win') b.won = true; else b.deaths++;
    }
  }
  const endTime = final.time, endDamage = final.runStats.damageTaken;
  const stageSeconds = enter.map((t, s) => t === null ? null : round((enter[s + 1] ?? endTime) - t));
  const stageDamage = enterDamage.map((d, s) => d === null ? null : Math.round((enterDamage[s + 1] ?? endDamage) - d));
  for (const b of Object.values(bosses)) { b.fightSeconds = round(b.fightSeconds); b.lifeSeconds = b.lifeSeconds.map(round); }
  const endStage = final.stage;
  return {
    difficulty, skill, seed, outcome,
    endStage, endStageName: STAGE_SHORT[endStage], endBoss: outcome === 'clear' ? '' : (BOSS_STAGES[endStage] || ''),
    gameSeconds: round(endTime), score: final.score, kills: final.kills, retries: final.runStats.retries, livesLeft: final.lives,
    damageTaken: Math.round(endDamage), deathsByStage: deaths, stageSeconds, stageDamage,
    stageMinHP: minHP.map((h, i) => enter[i] === null ? null : round(h)), bosses, specials,
  };
}
const round = x => Math.round(x * 100) / 100;
