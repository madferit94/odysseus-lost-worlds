import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {memoryStorage,world,settle} from './game-world.mjs';

// v19 boss practice (practice.js) on top of the real game scripts.
const BEATEN='odysseus-bosses-beaten-v1',CHECKPOINT='odysseus-checkpoint-v1';
function withBeaten(list,checkpoint){const storage=memoryStorage();storage.setItem(BEATEN,JSON.stringify(list));if(checkpoint)storage.setItem(CHECKPOINT,checkpoint);return storage;}
const savedCheckpoint=(()=>{const w=world();w.run("selectDifficulty('wrath');reset();enter(1);enter(2);damage(enemies[0],9999,0,true);update(.02);enter(3);");return w.storage.getItem(CHECKPOINT);})();
const bossButtons=w=>['polyphemus','poseidon','caocao','antinous'].map(id=>w.el('practice-'+id));

test('without a defeated boss, the practice menu explains why every boss is locked',()=>{
 const w=world();assert.equal(w.el('practice').hidden,false);assert.equal(w.el('practice-menu').hidden,true);assert.equal(w.el('practice').getAttribute('aria-expanded'),'false');
 w.el('practice').onclick();assert.equal(w.el('practice-menu').hidden,false);assert.equal(w.el('practice').getAttribute('aria-expanded'),'true');
 assert.match(w.el('practice-hint').textContent,/No boss defeated yet\. Beat a boss once/);
 assert.ok(bossButtons(w).every(b=>b.disabled&&/NOT YET DEFEATED/.test(b.textContent)));
 assert.equal(w.run("return startBossPractice('polyphemus');"),false);assert.equal(w.run('return state;'),'title');
 w.run("setControlLanguage('ko');");assert.equal(w.el('practice').textContent,'보스 연습');assert.match(w.el('practice-hint').textContent,/아직 이긴 보스가 없습니다/);
 assert.equal(w.el('practice-poseidon').textContent,'포세이돈 · 아직 이기지 않음');
 w.el('practice').onclick();assert.equal(w.el('practice-menu').hidden,true,'the toggle closes the menu');
});
test('a boss beaten on a journey is remembered in this browser and unlocks only that boss',()=>{
 const w=world();w.run("reset();enter(2);damage(enemies[0],9999,0,true);");
 assert.deepEqual(JSON.parse(w.storage.getItem(BEATEN)),['polyphemus']);
 w.run("p.inv=0;state='play';lives=1;hurt(999);");assert.equal(w.run('return state;'),'gameover');w.el('practice').onclick();
 assert.deepEqual(bossButtons(w).map(b=>b.disabled),[false,true,true,true]);assert.equal(w.el('practice-polyphemus').textContent,'POLYPHEMUS');
 assert.match(w.el('practice-hint').textContent,/Fight a boss you have beaten\. Difficulty: AEGEAN VOYAGE · NORMAL/);
 w.run("selectDifficulty('wrath');");assert.match(w.el('practice-hint').textContent,/POSEIDON’S WRATH · EXTREME/,'the hint follows the difficulty picker');
});
test('practice starts the chosen boss on the selected difficulty, as the hero would arrive, with one life',async()=>{
 const w=world({storage:withBeaten(['polyphemus','poseidon','caocao','antinous'])});await settle();const runs=()=>w.requests.filter(r=>r.path==='/api/runs').length;
 w.run("selectDifficulty('trial');");w.el('practice').onclick();assert.ok(bossButtons(w).every(b=>!b.disabled));
 w.el('practice-caocao').onclick();await settle();
 const s=JSON.parse(w.run("return JSON.stringify({state,stage,journeyMode,runDifficulty,lives,maxHP:p.maxHP,hp:p.hp,energy:p.energy,bossRewards:[...bossRewards],relic,time,boss:enemies[0].type,bossHP:enemies[0].max});"));
 assert.deepEqual(s,{state:'play',stage:7,journeyMode:'practice',runDifficulty:'trial',lives:1,maxHP:140,hp:140,energy:0,bossRewards:['polyphemus','poseidon'],relic:false,time:0,boss:'caocao',bossHP:Math.round(726*.95*1.2)});
 assert.equal(runs(),0,'no ranking run is started');assert.match(w.el('rank-status').textContent,/Boss practice is not ranked/);
 assert.equal(w.el('practice-menu').hidden,true);assert.equal(w.el('continue').hidden,true);
 w.run("state='title';startBossPractice('antinous');");assert.equal(w.run('return stage;'),9);assert.equal(w.run('return p.maxHP;'),160);assert.equal(w.run('return relic;'),true);
});
test('winning returns to the menu with the result, without the next stage, a ranking entry or a checkpoint change',async()=>{
 const w=world({storage:withBeaten(['polyphemus','poseidon'],savedCheckpoint)});await settle();
 w.run("selectDifficulty('ithaca');startBossPractice('poseidon');for(let i=0;i<300;i++){p.inv=9;update(.1);}");assert.equal(w.run('return state;'),'play');
 w.run("p.inv=99;damage(enemies[0],9999,0,true);for(let i=0;i<20&&state==='play';i++)update(.02);projectiles.push({x:p.x,y:p.y,vx:0,vy:0,kind:'arrow',life:2,damage:999});update(.02);");await settle();
 assert.equal(w.run('return state;'),'end');assert.equal(w.run('return stage;'),3,'the drift cut-scene to the Eastern realm does not start');assert.equal(w.run('return cutscene;'),null);
 assert.equal(w.el('eyebrow').textContent,'BOSS PRACTICE');assert.equal(w.el('title').textContent,'VICTORY');
 assert.match(w.el('desc').innerHTML,/POSEIDON · ITHACA’S PATH · EASY<br>TIME 0:31<br>Practice is not ranked/);
 assert.equal(w.el('practice-menu').hidden,false,'back to the practice menu');assert.equal(w.el('continue').hidden,false,'the saved journey can still be continued');
 assert.equal(w.storage.getItem(CHECKPOINT),savedCheckpoint,'checkpoint unchanged');
 assert.equal(w.requests.filter(r=>r.path==='/api/runs'||r.path==='/api/results').length,0);assert.equal(w.el('rank-form').hidden,true);
 assert.deepEqual(JSON.parse(w.run('return JSON.stringify(practiceResult);')),{boss:'poseidon',won:true,seconds:31,difficulty:'ithaca'});
});
test('losing ends the practice at the first fall and shows the result in Korean or English',()=>{
 const w=world({storage:withBeaten(['polyphemus'],savedCheckpoint)});w.run("setControlLanguage('ko');startBossPractice('polyphemus');update(.5);p.inv=0;hurt(999);");
 assert.equal(w.run('return state;'),'gameover');assert.equal(w.el('title').textContent,'패배');assert.equal(w.el('eyebrow').textContent,'보스 연습');
 assert.match(w.el('desc').innerHTML,/폴리페모스 · 에게해의 항해 · 보통<br>시간 0:01<br>연습은 순위와 이어하기 기록에 남지 않습니다/);
 assert.equal(w.el('start').textContent,'새 여정 시작');assert.equal(w.el('practice-menu').hidden,false);
 assert.equal(w.storage.getItem(CHECKPOINT),savedCheckpoint);assert.equal(w.run('return lives;'),0);
 // Another practice and then a new journey work normally from here.
 assert.equal(w.run("return startBossPractice('polyphemus');"),true);w.run("p.inv=0;hurt(999);state='gameover';reset();");
 assert.equal(w.run('return journeyMode+lives+stage;'),'normal30');assert.equal(w.el('practice-menu').hidden,true);
});
test('analytics marks a practice as its own session and keeps the existing events',()=>{
 const w=world({storage:withBeaten(['polyphemus'])});w.analytics.length=0;
 w.run("selectDifficulty('wrath');startBossPractice('polyphemus');");
 assert.deepEqual(w.analytics[0],{begin:'wrath',mode:'practice'});
 const start=w.analytics[1];assert.equal(start.name,'game_start');assert.deepEqual([start.stage,start.hp,start.lives,start.energy,start.activeMs],[2,100,1,0,0]);
 assert.deepEqual(w.analytics.slice(2).map(e=>e.name).slice(0,2),['stage_start','boss_start']);
 w.run("damage(enemies[0],9999,0,true);for(let i=0;i<20&&state==='play';i++)update(.02);");const names=w.analytics.map(e=>e.name);
 assert.ok(names.includes('boss_end'));assert.equal(names.at(-1),'game_clear');
});
test('practice works with storage blocked (menu explains), and index.html wires the menu for keyboard use',()=>{
 const w=world({storageThrows:true});w.run("reset();enter(2);damage(enemies[0],9999,0,true);");assert.equal(w.run("return recordBossWin('polyphemus');"),false);
 w.run("state='title';");w.el('practice').onclick();assert.match(w.el('practice-hint').textContent,/No boss defeated yet/);
 const html=fs.readFileSync(new URL('index.html',import.meta.url),'utf8');
 assert.match(html,/<button id="practice" type="button" aria-expanded="false" aria-controls="practice-menu">/);
 assert.match(html,/<div id="practice-menu" class="practice-menu" role="group" aria-label="Boss practice" hidden>/);
 assert.deepEqual([...html.matchAll(/<button id="practice-(\w+)" class="practice-option" type="button"/g)].map(m=>m[1]),['polyphemus','poseidon','caocao','antinous']);
 assert.match(html,/\.practice-options\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'two per row on narrow screens');
 assert.match(html,/\.overlay\{overflow-y:auto\}\.overlay \.panel\{margin:auto\}/,'a tall menu scrolls inside the game frame instead of being cut off');
 const order=[...html.matchAll(/<script src="([\w-]+\.js)">/g)].map(m=>m[1]);
 assert.ok(order.indexOf('checkpoint.js')<order.indexOf('practice.js')&&order.indexOf('practice.js')<order.indexOf('telemetry-hooks.js'));
 assert.match(fs.readFileSync(new URL('build.mjs',import.meta.url),'utf8'),/'practice\.js'/);
});
test('a finished ranked journey waiting for its nickname locks practice until it is saved or skipped',async()=>{
 const finishJourney=async w=>{w.run("state='title';reset();");await settle();w.run('enter(10);update(8.1);');await settle();await settle();};
 // Skip: the result is dropped on purpose, then practice opens.
 const w=world({storage:withBeaten(['polyphemus'])});await settle();await finishJourney(w);
 assert.equal(w.run('return state;'),'end');assert.equal(w.el('rank-form').hidden,false,'the nickname form is waiting');
 assert.equal(w.el('practice').disabled,true);assert.equal(w.el('practice-wait').hidden,false);assert.match(w.el('practice-wait').textContent,/first save your result to the rankings below, or skip it/);
 assert.ok(bossButtons(w).every(b=>b.disabled));w.el('practice').onclick();assert.equal(w.el('practice-menu').hidden,true,'the menu does not open');
 assert.equal(w.run("return startBossPractice('polyphemus');"),false,'practice cannot start');assert.notEqual(w.run('return rankRunId;'),null,'the ranked run is kept');
 w.run("setControlLanguage('ko');");assert.match(w.el('practice-wait').textContent,/먼저 아래 순위에 결과를 저장하거나 건너뛰세요/);assert.equal(w.el('rank-skip').textContent,'저장하지 않고 건너뛰기');
 w.el('rank-skip').events.click();
 assert.equal(w.el('rank-form').hidden,true);assert.match(w.el('rank-status').textContent,/저장하지 않았습니다/);assert.equal(w.requests.filter(r=>r.path==='/api/results').length,0);
 assert.equal(w.el('practice').disabled,false);assert.equal(w.el('practice-wait').hidden,true);assert.equal(w.el('practice-polyphemus').disabled,false);
 assert.equal(w.run("return startBossPractice('polyphemus');"),true);
 // Save: after the result is stored, practice opens as well.
 const s=world({storage:withBeaten(['polyphemus'])});await settle();await finishJourney(s);assert.equal(s.el('practice').disabled,true);
 await s.el('rank-form').events.submit({preventDefault(){}});
 assert.equal(s.requests.filter(r=>r.path==='/api/results').length,1,'the waiting result was saved');assert.match(s.el('rank-status').textContent,/Saved!/);
 assert.equal(s.el('practice').disabled,false);assert.equal(s.el('practice-wait').hidden,true);assert.equal(s.run("return startBossPractice('polyphemus');"),true);
});
