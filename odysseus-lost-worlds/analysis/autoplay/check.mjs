// Checks for the autoplay simulator: node --test analysis/autoplay/check.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {simulateRun} from './run.mjs';
import {GAME_DIR, GAME_FILES} from './sandbox.mjs';
import {wilson} from './aggregate.mjs';

// Kills the player once, as soon as a hit can land (not during a finisher, cut-scene or the ending).
const KILL = '(()=>{if(cutscene||stage===10||divine>0)return false;p.inv=0;p.shield=0;hurt(9999);return true;})()';

test('the same seed reproduces the identical run summary', () => {
  const a = simulateRun({difficulty: 'trial', skill: 'average', seed: 11});
  const b = simulateRun({difficulty: 'trial', skill: 'average', seed: 11});
  assert.deepEqual(a, b);
  assert.equal(a.outcome, 'clear');
  const c = simulateRun({difficulty: 'trial', skill: 'average', seed: 12});
  assert.notDeepEqual(a, c, 'a different seed should give a different run');
});

test('a forced death is recorded with its stage, and the run continues with one life fewer', () => {
  const r = simulateRun({difficulty: 'aegean', skill: 'expert', seed: 5, inject: [{at: 45, code: KILL}]});
  assert.equal(r.deathsByStage.reduce((a, b) => a + b, 0), 1);
  assert.equal(r.retries, 1);
  assert.equal(r.livesLeft, 2);
  assert.equal(r.outcome, 'clear');
  const s = r.deathsByStage.findIndex(n => n === 1);
  assert.ok(r.stageSeconds[s] !== null && r.stageDamage[s] >= 100, 'the death stage lost at least one full life of HP');
});

test('three forced deaths end the run as game over at the stage where the last life was lost', () => {
  const r = simulateRun({difficulty: 'aegean', skill: 'expert', seed: 5, inject: [45, 50, 55].map(at => ({at, code: KILL}))});
  assert.equal(r.outcome, 'gameover');
  assert.equal(r.livesLeft, 0);
  assert.equal(r.deathsByStage.reduce((a, b) => a + b, 0), 3);
  assert.equal(r.deathsByStage[r.endStage] >= 1, true);
});

test('the game-time cap marks a run as timeout instead of hanging', () => {
  const r = simulateRun({difficulty: 'wrath', skill: 'novice', seed: 1, maxGameSeconds: 30});
  assert.equal(r.outcome, 'timeout');
  assert.ok(r.gameSeconds >= 30 && r.gameSeconds < 32);
});

test('the simulator does not change any game file', () => {
  const files = [...new Set([...GAME_FILES, ...fs.readdirSync(GAME_DIR).filter(f => /\.(js|cjs|mjs|html|css|json)$/.test(f))])];
  const hash = () => Object.fromEntries(files.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(GAME_DIR, f))).digest('hex')]));
  const before = hash();
  simulateRun({difficulty: 'ithaca', skill: 'novice', seed: 3});
  assert.deepEqual(hash(), before);
});

test('Wilson intervals match known values', () => {
  const w = wilson(0, 200);
  assert.equal(w.lo, 0);
  assert.ok(Math.abs(w.hi - 0.0188) < 0.0002);
  const h = wilson(50, 100);
  assert.ok(Math.abs(h.lo - 0.4038) < 0.0002 && Math.abs(h.hi - 0.5962) < 0.0002);
});
