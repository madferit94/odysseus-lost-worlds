import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {memoryStorage,world,settle} from './game-world.mjs';

// Plays the real route to the start of stage 3 (Poseidon): clears G1, beats Polyphemus, spends energy.
const toPoseidon=`selectDifficulty('trial');reset();enter(1);p.x=455;update(.02);for(let w=0;w<cfg().waves;w++){enemies.forEach(e=>damage(e,9999,0,true));for(let i=0;i<75;i++)update(.02);}
 enter(2);damage(enemies[0],9999,0,true);update(.02);switchWeapon(2);update(.02);p.energy=137;
 p.hp=p.maxHP;for(let i=0;i<5;i++)grantLifeReward(enemy(500,390));enter(3);`;
// State that game.js carries into a stage, read right after enter().
const carried=`return JSON.stringify({stage,state,runDifficulty,lives,maxHP:p.maxHP,hp:p.hp,energy:p.energy,shield:p.shield,weapon:p.weapon,bossRewards:[...bossRewards],relic,score,kills,runStats});`;

test('a checkpoint is saved when stages 1-9 start, with exactly the state that carries between stages',()=>{
 const w=world();w.run("selectDifficulty('trial');reset();");assert.equal(w.saved(),null,'the prologue is not a checkpoint');
 w.run(toPoseidon);const c=w.saved(),now=JSON.parse(w.run(carried));
 assert.equal(c.stage,3);assert.equal(c.difficulty,'trial');assert.equal(c.version,'v19');
 for(const key of ['lives','maxHP','energy','shield','weapon','bossRewards','relic','score','kills','runStats'])assert.deepEqual(c[key],now[key],key);
 assert.ok(c.shield>=40&&c.shield<=60,'enter() keeps the shield, so the checkpoint keeps it too');
 assert.equal(c.maxHP,120);assert.deepEqual(c.bossRewards,['polyphemus']);assert.equal(c.weapon,2);assert.equal(c.energy,137);assert.equal(c.runStats.bossKills,1);
 assert.equal(c.hp,undefined,'HP is refilled by every stage start, so it is not stored');
 w.run('enter(10);');assert.equal(w.saved().stage,3,'the ending does not replace the checkpoint');
 w.run('update(8.1);');assert.equal(w.run('return state;'),'end');assert.equal(w.saved(),null,'reaching home deletes the checkpoint');
});
test('continue restores the stage start exactly, on the saved difficulty, and only from menu screens',()=>{
 const w=world();w.run(toPoseidon);const expected=JSON.parse(w.run(carried));
 w.run('p.inv=0;hurt(999);retry();p.inv=0;hurt(999);retry();p.inv=0;hurt(999);');assert.equal(w.run('return state;'),'gameover');
 assert.equal(w.el('continue').hidden,false,'game over offers to continue');assert.equal(w.el('continue-note').hidden,false);
 assert.equal(w.el('continue').textContent,'CONTINUE (STAGE 3 · TRIAL OF THE GODS · HARD)');assert.match(w.el('continue-note').textContent,/not ranked/);
 w.run("setControlLanguage('ko');");assert.equal(w.el('continue').textContent,'이어하기 (스테이지 3 · 신들의 시련 · 어려움)');assert.match(w.el('continue-note').textContent,/순위에 등록되지 않습니다/);
 w.run("selectDifficulty('ithaca');");
 assert.equal(w.run('return continueJourney();'),true);
 const after=JSON.parse(w.run(carried));assert.deepEqual(after,{...expected},'same state as when stage 3 first started');
 assert.equal(w.run('return journeyMode;'),'continue');assert.equal(w.run('return time;'),0);
 assert.equal(w.run('return enemies[0].max;'),Math.round(748*.95*1.2),'boss uses the saved difficulty, not the picker');
 assert.equal(w.el('continue').hidden,true,'hidden during play');assert.equal(w.run('return continueJourney();'),false,'cannot continue during play');
});
test('a new game keeps the old checkpoint until it reaches stage 1, then replaces it',()=>{
 const w=world();w.run(toPoseidon);assert.equal(w.saved().stage,3);
 w.run("state='title';selectDifficulty('aegean');reset();");assert.equal(w.saved().stage,3,'prologue: the saved journey is still there');
 w.run('enter(1);');const c=w.saved();assert.equal(c.stage,1);assert.equal(c.difficulty,'aegean');assert.deepEqual(c.bossRewards,[]);assert.equal(c.lives,3);
});
test('a continued journey is never ranked: no run is started or submitted, and an earlier run is dropped',async()=>{
 const w=world();await settle();w.run(toPoseidon);await settle();
 assert.equal(w.requests.filter(r=>r.path==='/api/runs').length,1,'the normal journey started a ranked run');
 w.run('p.inv=0;hurt(999);retry();p.inv=0;hurt(999);retry();p.inv=0;hurt(999);continueJourney();');await settle();
 assert.equal(w.run('return rankRunId;'),null);assert.match(w.el('rank-status').textContent,/continued journey, so it is not ranked/);
 w.run('enter(10);update(8.1);');await settle();await settle();
 assert.equal(w.run('return state;'),'end');assert.equal(w.el('rank-form').hidden,true,'no nickname form');
 assert.equal(w.requests.filter(r=>r.path==='/api/runs').length,1,'no new run');assert.equal(w.requests.filter(r=>r.path==='/api/results').length,0,'nothing submitted');
 // A run still starting when the player continues can never attach to the continued journey.
 const v=world();await settle();v.run(toPoseidon);v.run('p.inv=0;hurt(999);retry();p.inv=0;hurt(999);retry();p.inv=0;hurt(999);continueJourney();');await settle();await settle();
 assert.equal(v.run('return rankRunId;'),null);v.run('enter(10);update(8.1);');await settle();assert.equal(v.requests.filter(r=>r.path==='/api/results').length,0);
});
test('analytics marks a continued journey as its own session without changing event fields',()=>{
 const w=world();w.run(toPoseidon);w.run('p.inv=0;hurt(999);retry();p.inv=0;hurt(999);retry();p.inv=0;hurt(999);');w.analytics.length=0;
 w.run('continueJourney();');
 assert.deepEqual(w.analytics[0],{begin:'trial',mode:'continue'});
 const start=w.analytics[1];assert.equal(start.name,'game_start');assert.equal(start.stage,3);assert.equal(start.activeMs,0);assert.equal(start.hp,120);assert.equal(start.energy,137);assert.equal(start.bossKills,1);
 assert.deepEqual(Object.keys(start).sort(),['activeMs','attempt','bossKills','damageTaken','energy','hp','lives','name','normalKills','retries','stage'].sort());
 assert.equal(w.analytics[2].name,'stage_start');
 w.analytics.length=0;w.run("state='title';reset();");assert.deepEqual(w.analytics[0],{begin:'trial',mode:'normal'});
});
test('the game works when storage is blocked, and broken or edited checkpoints are ignored',()=>{
 const blocked=world({storageThrows:true});blocked.run(toPoseidon);assert.equal(blocked.run('return state;'),'play');
 blocked.run('p.inv=0;hurt(999);retry();p.inv=0;hurt(999);retry();p.inv=0;hurt(999);');assert.equal(blocked.el('continue').hidden,true);assert.equal(blocked.run('return continueJourney();'),false);
 const full=memoryStorage();full.setItem=()=>{throw Error('QuotaExceededError');};const quota=world({storage:full});quota.run(toPoseidon);assert.equal(quota.run('return state;'),'play');
 const base=(()=>{const w=world();w.run(toPoseidon);return w.saved();})();
 for(const [name,edit] of [['not JSON','{'],['stage 10',{...base,stage:10}],['unknown difficulty',{...base,difficulty:'nightmare'}],['extra max HP',{...base,maxHP:400}],
  ['future boss',{...base,bossRewards:['polyphemus','antinous'],maxHP:140}],['no lives',{...base,lives:0}],['shield over the cap',{...base,shield:61}],['fractional shield',{...base,shield:1.5}],['missing shield',{...base,shield:undefined}],['energy over the cap',{...base,energy:999}],['old format',{...base,v:2}]]){
  const storage=memoryStorage();storage.setItem('odysseus-checkpoint-v1',typeof edit==='string'?edit:JSON.stringify(edit));const w=world({storage});
  assert.equal(w.el('continue').hidden,true,name);assert.equal(w.run('return continueJourney();'),false,name);
  if(name!=='not JSON')assert.equal(storage.getItem('odysseus-checkpoint-v1'),null,name+' is removed');
 }
 const storage=memoryStorage();storage.setItem('odysseus-checkpoint-v1',JSON.stringify(base));const ok=world({storage});assert.equal(ok.el('continue').hidden,false);assert.equal(ok.run('return continueJourney();'),true);
});
test('index.html offers continue as a keyboard button with a note, and loads checkpoint.js before ranking and analytics',()=>{
 const html=fs.readFileSync(new URL('index.html',import.meta.url),'utf8');
 assert.match(html,/<button id="continue" type="button" hidden aria-describedby="continue-note"><\/button>/);assert.match(html,/<p id="continue-note" class="continue-note" role="note" hidden><\/p>/);
 assert.match(html,/\.panel #continue\{[^}]*max-width:100%;white-space:normal/,'long labels wrap on a 390px screen');
 const order=[...html.matchAll(/<script src="([\w-]+\.js)">/g)].map(m=>m[1]);
 assert.ok(order.indexOf('game.js')<order.indexOf('checkpoint.js')&&order.indexOf('checkpoint.js')<order.indexOf('ranking.js')&&order.indexOf('checkpoint.js')<order.indexOf('telemetry-hooks.js'));
 assert.match(fs.readFileSync(new URL('build.mjs',import.meta.url),'utf8'),/'checkpoint\.js'/);
});
test('the shield carries into a continued stage exactly as in play, up to its 60 cap',()=>{
 const w=world();w.run("selectDifficulty('trial');reset();enter(5);p.hp=p.maxHP;for(let i=0;i<9;i++)grantLifeReward(enemy(500,390));");
 assert.equal(w.run('return p.shield;'),60,'the game caps the shield at 60');w.run('enter(6);');const played=JSON.parse(w.run(carried));assert.equal(played.shield,60);
 w.run('p.inv=0;hurt(999);retry();p.inv=0;hurt(999);retry();p.inv=0;hurt(999);continueJourney();');
 assert.deepEqual(JSON.parse(w.run(carried)),played);
});
test('continuing from a freshly opened page does not record the prologue as completed',()=>{
 const seed=world();seed.run("reset();enter(1);");const storage=memoryStorage();storage.setItem('odysseus-checkpoint-v1',seed.storage.getItem('odysseus-checkpoint-v1'));
 const w=world({storage});assert.equal(w.run('return stage;'),0);w.run('continueJourney();');
 assert.deepEqual(w.analytics.map(e=>e.name||'begin'),['begin','game_start','stage_start']);assert.ok(!w.analytics.some(e=>e.name==='stage_complete'));
 // Walking out of the prologue on a new journey still completes it.
 const n=world();n.run("reset();p.x=1250;update(.02);");assert.ok(n.analytics.some(e=>e.name==='stage_complete'&&e.stage===0));
});
