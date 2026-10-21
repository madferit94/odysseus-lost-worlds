// Checks that the ranking plausibility limits still match the game data and that
// the time floor stays well below what the real game code allows.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {GAME_FACTS,MIN_PLAUSIBLE_ELAPSED_SECONDS,checkPlausibility} from './server/protection.mjs';

// Loads the real game files the same way test-game.cjs does, with a seeded Math.random.
function game(seed=1){
 let s=seed;const random=()=>{s=(s*1103515245+12345)%2147483648;return s/2147483648;};
 const noop=()=>{},elements=new Map(),draw=new Proxy({},{get:()=>noop,set:()=>true}),math=Object.create(Math);math.random=random;
 const element=id=>{if(!elements.has(id))elements.set(id,{getContext:()=>draw,classList:{add:noop,remove:noop},focus:noop,setAttribute:noop});return elements.get(id);};
 const ctx=vm.createContext({console,Math:math,Image:class{},document:{getElementById:element,addEventListener:noop},window:{addEventListener:noop,matchMedia:()=>({matches:false})},requestAnimationFrame:noop});
 for(const f of ['art.js','gods.js','achilles.js','caocao.js','weapons.js','progression.js','combat.js','characters.js','ui.js','game.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
 ctx.telemetry={begin:noop,emit:noop,flush:noop,display:noop};
 return code=>vm.runInContext(code,ctx);
}
// Plays a whole journey at 60 frames per second. mode 'instant' deletes every enemy as it
// appears (only walking, wave pauses and cut-scenes remain); mode 'bot' fights the
// nearest enemy, uses finishers and cannot be hurt, so it never loses time dodging.
function journey({mode,weapon=2,difficulty='ithaca',seed=1}){
 const run=game(seed);
 run(`audio=()=>{};var result=null;finishRankRun=r=>{result=r;};startRankRun=()=>{};selectDifficulty('${difficulty}');reset();switchWeapon(${weapon});
 function step(){keys.clear();if(state!=='play'||cutscene||stage===10||divine>0)return;p.inv=Math.max(p.inv,5);
  let alive=enemies.filter(e=>!e.dead);if('${mode}'==='instant')for(const e of alive)damage(e,99999,0,true);alive=enemies.filter(e=>!e.dead);
  if(!alive.length){keys.add('ArrowRight');return;}
  const boss=alive.find(e=>e.boss);
  if(boss&&boss.type==='antinous'){if(boss.hp<=scaledAttackDamage(145)&&p.energy>=100){p.face=Math.sign(boss.x-p.x)||1;finisher('athena');return;}}else if(p.energy>=200){finisher('zeus');return;}
  const w=currentWeapon(),t=alive.reduce((a,e)=>Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<Math.abs(a.x-p.x)+Math.abs(a.y-p.y)?e:a);
  const reach=w.reach+(t.boss?21:0),lo=cfg().boss?35:arena?450:35,hi=cfg().boss?900:arena?1190:cfg().length-25,side=Math.sign(t.x-p.x)||1;
  let want=t.x-side*Math.min(reach*.55,60);if(want<lo+2||want>hi-2)want=Math.max(lo+2,Math.min(hi-2,t.x+side*Math.min(reach*.55,60)));
  const dx=want-p.x,dy=t.y-p.y,face=Math.sign(t.x-p.x)||p.face;
  if(Math.abs(t.x-p.x)<reach-4&&Math.abs(dy)<w.depth*.7){if(p.face!==face&&Math.abs(t.x-p.x)>8){keys.add(face>0?'ArrowRight':'ArrowLeft');return;}slash();}
  else if(Math.abs(dx)>3)keys.add(dx>0?'ArrowRight':'ArrowLeft');
  if(Math.abs(dy)>4)keys.add(dy>0?'ArrowDown':'ArrowUp');}`);
 for(let i=0;i<60*600&&!run('result');i++)run('step();update(1/60);');
 return run('result');
}

test('kill and boss limits match the stages and waves in game.js',()=>{
 const run=game();
 const levels=run('LEVELS.map(l=>({waves:l.waves||0,types:(l.types||[]).length,boss:l.boss||null}))');
 const waveEnemies=levels.reduce((n,l)=>n+l.waves*l.types,0),bosses=levels.filter(l=>l.boss).length;
 const escorts=run("reset();enter(9);enemies.filter(e=>!e.boss&&!e.bossAid).length");
 assert.equal(waveEnemies,GAME_FACTS.waveEnemies);assert.equal(escorts,GAME_FACTS.escortEnemies);
 assert.equal(GAME_FACTS.maxNormalKills,waveEnemies+escorts);assert.equal(GAME_FACTS.minNormalKills,waveEnemies);assert.equal(bosses,GAME_FACTS.bosses);
 assert.equal(run('reset();p.hp'),GAME_FACTS.firstLifeHP);
});
test('even with every enemy removed instantly, the journey takes over 53 s of game time',t=>{
 const r=journey({mode:'instant'});t.diagnostic('no-combat journey: '+r.elapsed+' s');
 assert.equal(r.completed,true);assert.equal(r.normalKills,GAME_FACTS.maxNormalKills);assert.equal(r.bossKills,4);
 assert.ok(r.elapsed>=53,'scripted parts alone took '+r.elapsed+' s');
});
test('the time floor is at most 60% of a fast bot that cannot be hurt, and its results pass',t=>{
 const times=[];
 for(const weapon of [1,2,3]){
  const r=journey({mode:'bot',weapon});assert.ok(r,'bot finished with weapon '+weapon);times.push(r.elapsed);
  assert.equal(checkPlausibility(r,r.elapsed+5),null,JSON.stringify(r));
 }
 const fastest=Math.min(...times);t.diagnostic('bot journeys (sword, spear, dagger): '+times.join(', ')+' s');
 assert.ok(MIN_PLAUSIBLE_ELAPSED_SECONDS<=fastest*.6,`floor ${MIN_PLAUSIBLE_ELAPSED_SECONDS}s vs fastest bot ${fastest}s (${times.join(', ')})`);
});
