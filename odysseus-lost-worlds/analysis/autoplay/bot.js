// Autoplay bot. This script is loaded into the same vm sandbox as the real game
// scripts, so it can read the game's state (enemies, projectiles, hazards, p ...)
// the way a player reads the screen. It never changes game state directly: every
// action goes through the page's own keydown/keyup handlers (press()).
//
// Human-like limits come from a skill profile P (see skills.mjs):
//  - each new threat is only "seen" after a sampled reaction delay,
//  - some threats are missed entirely or seen late,
//  - the bot's guess of each hit box is off by a sampled margin,
//  - the shield is only considered for a share of threats,
//  - decisions are taken at a fixed interval, attacks are pressed at a human rate,
//  - finishers, heal zones and life carriers are used by simple per-skill rules.
(function(){
'use strict';
const KEY={left:['ArrowLeft','ArrowLeft'],right:['ArrowRight','ArrowRight'],up:['ArrowUp','ArrowUp'],down:['ArrowDown','ArrowDown'],s:['KeyS','s'],a:['KeyA','a'],q:['KeyQ','q'],w:['KeyW','w'],e:['KeyE','e'],r:['KeyR','r'],enter:['Enter','Enter']};
const HELD=[['ArrowLeft','left'],['ArrowRight','right'],['ArrowUp','up'],['ArrowDown','down'],['s','s']];
const H=1.0,STEP=1/30,RUN=205,GUARD_SPEED=80,ATTACK_SPEED=74;

// Read-only views for the Node harness.
globalThis.__state=()=>state;globalThis.__time=()=>time;globalThis.__stage=()=>stage;
globalThis.__hpShare=()=>p?Math.max(0,p.hp)/(p.maxHP||100):1;
globalThis.__peek=()=>({state,stage,time,lives,score,kills,cutscene,divine,waveNumber,cleared,
 runStats:{...runStats},hp:p?p.hp:0,x:p?p.x:0,
 enemyHP:enemies.reduce((n,e)=>n+(e.dead?0:Math.max(0,e.hp)),0),alive:enemies.filter(e=>!e.dead).length});

globalThis.__makeBot=function(P,rnd,press){
 const seen=new WeakMap(),tokens=new WeakMap();
 let plan=null,target=null,aimDy=0,aimUntil=-1,nextDecision=-1,nextAttack=-1,wanderUntil=-1,wanderGoal=null;
 let readySince=null,readyPick=null,readyDelay=0,finalAt=null,lastState='';
 const uni=([a,b])=>a+(b-a)*rnd();
 const gauss=()=>{let u=0;while(!u)u=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*rnd());};
 const tap=k=>{press('keydown',...KEY[k]);press('keyup',...KEY[k]);};
 // Every thing that can hurt the player gets one perception record the first time it is on screen.
 function perceive(obj){
  let r=seen.get(obj);
  if(!r){
   const reaction=Math.max(.06,P.reaction[0]+gauss()*P.reaction[1]),late=rnd()<P.lateProb?uni(P.lateExtra):0;
   r={notice:time+reaction+late,ignore:rnd()<P.missProb,shield:rnd()<P.shieldProb,use:rnd(),margin:P.margin[0]+gauss()*P.margin[1]};
   seen.set(obj,r);
  }
  return r;
 }
 const known=r=>!r.ignore&&time>=r.notice;
 function xBounds(){const lo=cfg().boss?35:arena?450:35,hi=cfg().boss?900:arena?1190:cfg().length-25;return[lo+4,hi-4];}
 function yBounds(x){const narrow=stage===5&&(x<460||x>1220);return narrow?[369,434]:[330,474];}
 const cx=x=>{const[a,b]=xBounds();return clamp(x,a,b);};
 const cy=(y,x)=>{const[a,b]=yBounds(x);return clamp(y,a,b);};

 // ---- threat model: what will hit the player, where and when (times are seconds from now)
 function threats(){
  const T=[];
  for(const a of projectiles){
   if(a.life<=0)continue;const r=perceive(a);if(!known(r))continue;const wave=a.kind==='wave',sx=-Math.sign(a.vx)*28;
   T.push({k:'proj',x0:a.x,y0:a.y,vx:a.vx,vy:a.vy,t0:0,t1:a.life,rx:(wave?35:17)+r.margin,ry:(wave?28:18)+r.margin,dmg:a.damage,
    block:r.shield&&['arrow','rock','talisman','wave'].includes(a.kind),src:t=>a.x+a.vx*t+sx});
  }
  for(const h of hazards){
   if(h.hit)continue;const end=h.kind==='waterbomb'?h.delay+.24:h.life;if(end<=0)continue;
   const r=perceive(h);if(!known(r))continue;const sx=h.sourceX??h.x;
   T.push({k:'zone',t0:Math.max(0,h.delay),t1:end,x:h.x,y:h.y,rx:h.r+r.margin,ry:(h.kind==='shock'?35:h.kind==='stab'?25:h.r*.55)+r.margin,dmg:h.damage,
    block:r.shield&&(!!h.bossAttack||h.kind==='counter'||h.kind==='stab'),src:()=>sx});
  }
  for(const e of enemies){
   if(e.dead)continue;let tk=tokens.get(e);
   if(e.wind>0||e.dash>0||e.guard>0){if(!tk||tk.done){tk={done:false};tokens.set(e,tk);}}else{if(tk)tk.done=true;continue;}
   const r=perceive(tk);if(!known(r))continue;
   const speed=590*(e.enraged?1.15:1),m=r.margin;
   if(e.dash>0){if(e.dashHit)continue;const x0=e.x,dir=e.dashDir;
    T.push({k:'dash',t0:0,t1:e.dash,x0,dir,speed,y:e.y,rx:70+m,ry:32+m,dmg:enemyDamage(e,e.boss?22:18),block:r.shield,src:t=>x0+dir*speed*t});continue;}
   if(e.wind<=0)continue;
   const t0=e.wind+(e.stun||0),ty=e.targetY;
   if(!e.boss){
    if(e.type==='archer'||e.type==='rock')continue;// they fire a projectile, handled above once it flies
    T.push({k:'zone',t0,t1:t0+.04,x:e.x,y:ty,rx:(e.type==='spear'?125:80)+m,ry:30+m,dmg:enemyDamage(e,e.bossAid?8:e.type==='brute'?16:10),block:r.shield,src:()=>e.x});continue;
   }
   if(e.mode==='charge'||e.mode==='dash'){const x0=e.x,dir=e.targetX>e.x?1:-1;
    T.push({k:'dash',t0,t1:t0+.48,x0,dir,speed,y:ty,rx:70+m,ry:32+m,dmg:enemyDamage(e,22),block:r.shield,src:t=>x0+dir*speed*(t-t0)});}
   else if(e.mode==='trident')T.push({k:'zone',t0,t1:t0+.3,x:e.x+e.face*95,y:ty,rx:100+m,ry:25+m,dmg:enemyDamage(e,23),block:r.shield,src:()=>e.x});
   else if(e.mode==='combo')for(let i=0;i<3;i++)T.push({k:'zone',t0:t0+i*.3,t1:t0+i*.3+.55,x:e.x+e.face*65,y:ty,rx:75+m,ry:41+m,dmg:enemyDamage(e,12),block:r.shield,src:()=>e.x});
  }
  return T;
 }
 function hitAt(th,t,px,py){
  if(t<th.t0||t>th.t1)return false;
  if(th.k==='proj')return Math.abs(th.x0+th.vx*t-px)<th.rx&&Math.abs(th.y0+th.vy*t-py)<th.ry;
  if(th.k==='zone')return Math.abs(px-th.x)<th.rx&&Math.abs(py-th.y)<th.ry;
  return Math.abs(px-(th.x0+th.dir*th.speed*(t-th.t0)))<th.rx&&Math.abs(py-th.y)<th.ry;
 }
 // Where the player will be t seconds into a plan (attack animations slow movement).
 function posAt(pl,t,busy){
  const dx=pl.tx-p.x,dy=pl.ty-p.y,d=Math.hypot(dx,dy);if(!d)return[p.x,p.y];
  const slow=pl.block?0:Math.min(t,busy),moved=pl.block?GUARD_SPEED*t:ATTACK_SPEED*slow+RUN*(t-slow),f=Math.min(1,moved/d);
  return[p.x+dx*f,p.y+dy*f];
 }
 function expectedDamage(pl,T,busy){
  let total=0;
  for(const th of T){
   const end=Math.min(H,th.t1);
   for(let t=th.t0;t<=end+1e-9;t+=STEP){
    const[px,py]=posAt(pl,t,busy);
    if(hitAt(th,t,px,py)){if(!(pl.block&&th.block&&(th.src(t)-px)*pl.face>=-2))total+=th.dmg;break;}
   }
  }
  return total;
 }

 // ---- offence: who to fight and where to stand
 function lane(e,len,dy,back=-25){const fx=(e.x-p.x)*p.face;return fx>back&&fx<len&&Math.abs(e.y-p.y)<dy;}
 function pickTarget(alive){
  if(P.lifeCarrierBelow>0&&p.hp<p.maxHP*P.lifeCarrierBelow){const c=alive.find(e=>e.lifeSoul&&!e.boss);if(c)return c;}
  if(P.sticky&&target&&!target.dead&&alive.includes(target))return target;
  return alive.reduce((a,e)=>Math.abs(e.x-p.x)+Math.abs(e.y-p.y)*1.5<Math.abs(a.x-p.x)+Math.abs(a.y-p.y)*1.5?e:a);
 }
 function offence(){
  const alive=enemies.filter(e=>!e.dead);
  if(wanderUntil>time)return{tx:cx(wanderGoal[0]),ty:cy(wanderGoal[1],wanderGoal[0]),attack:null};
  if(!alive.length)return{tx:Math.min(p.x+150,cfg().length),ty:cy(400,p.x),attack:null};
  if(healZone&&p.hp<p.maxHP*P.healBelow){const r=perceive(healZone);if(known(r)&&r.use<P.healUse)return{tx:cx(healZone.x),ty:cy(healZone.y,healZone.x),attack:null,heal:true};}
  const t=pickTarget(alive);if(t!==target){target=t;aimUntil=-1;}
  if(time>=aimUntil){aimDy=gauss()*P.aimNoise;aimUntil=time+1;}
  const w=currentWeapon(),reach=w.reach+(t.boss?21:0),side=Math.sign(t.x-p.x)||1,[lo,hi]=xBounds();
  let want=t.x-side*Math.min(reach*.55,60);if(want<lo||want>hi)want=t.x+side*Math.min(reach*.55,60);
  return{tx:cx(want),ty:cy(t.y+aimDy,want),attack:t};
 }
 function canHit(t){
  if(!t||t.dead)return false;const w=currentWeapon(),reach=w.reach+(t.boss?21:0),fx=(t.x-p.x)*p.face;
  if(!(fx>-14&&fx<reach-4&&Math.abs(t.y-p.y)<w.depth*.85))return false;
  if(t.type==='antinous'){const tk=tokens.get(t);if(tk&&!tk.done&&(t.guard>0||t.mode==='counter')){const r=perceive(tk);if(known(r)&&r.use<P.guardRespect)return false;}}
  return true;
 }

 // ---- finishers (Q Athena, W Achilles, E Hermes, R Zeus)
 function finisherKey(alive,danger){
  if(p.energy<100||divine>0||cutscene||p.airTime>0){readySince=null;return null;}
  const boss=alive.find(e=>e.boss);
  // The game tells every player to press Q for the final Antinous blow.
  if(boss&&boss.type==='antinous'&&boss.hp<=scaledAttackDamage(145)){
   if(finalAt===null)finalAt=time+uni(P.finalDelay);
   return time>=finalAt&&lane(boss,600,165,-45)?'q':null;
  }
  if(readySince===null){readySince=time;readyDelay=uni(P.specialDelay);readyPick=rnd();}
  if(time<readySince+readyDelay)return null;
  const mobs=alive.filter(e=>!e.boss&&e.type!=='clone');
  if(P.specials==='never')return null;
  if(P.specials==='smart'){
   if(p.energy>=200&&mobs.length>=5)return 'r';
   if(boss&&lane(boss,470,95)&&!(boss.type==='antinous'&&boss.hp<=scaledAttackDamage(145)+40))return 'w';
   if(mobs.filter(e=>Math.abs(e.x-p.x)<290&&Math.abs(e.y-p.y)<150).length>=3)return 'e';
   if(mobs.filter(e=>lane(e,470,95)).length>=3)return 'w';
   if(danger&&p.hp<p.maxHP*.3)return 'e';// divine time makes the player untouchable
   return null;
  }
  if(P.specials==='whenFull'){
   if(p.energy>=200&&readyPick<.3)return 'r';
   if(!alive.some(e=>lane(e,600,165,-45)))return null;
   return readyPick<.6?'q':readyPick<.8?'w':'e';
  }
  // 'rare': presses some finisher key at a random moment, aimed or not.
  const k=readyPick<.4?'q':readyPick<.6?'w':readyPick<.8?'e':'r';
  if(k==='r'&&p.energy<200){readySince=null;return null;}
  return k;
 }

 function decide(){
  const T=threats(),off=offence(),busy=Math.max(0,attack)+(queued?.25:0);
  const offPlan={tx:off.tx,ty:off.ty,block:false,face:p.face,attack:off.attack,heal:off.heal};
  if(!T.length){plan=offPlan;return 0;}
  const d0=expectedDamage(offPlan,T,busy);if(d0===0){plan=offPlan;return 0;}
  let best=offPlan,bestCost=d0*1000-.5;
  const consider=(pl,extra)=>{const c=expectedDamage(pl,T,busy)*1000+extra;if(c<bestCost){best=pl;bestCost=c;}};
  consider({tx:p.x,ty:p.y,block:false,face:p.face},0);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;for(const dist of [30,60,100,150]){const tx=cx(p.x+Math.cos(a)*dist);consider({tx,ty:cy(p.y+Math.sin(a)*dist,tx),block:false,face:p.face},dist*.02);}}
  const blockable=T.filter(th=>th.block);
  if(blockable.length){
   const sides=new Set(blockable.map(th=>Math.sign(th.src(0)-p.x)||p.face));
   for(const face of sides)for(const dy of [0,-35,35,-70,70])consider({tx:p.x,ty:cy(p.y+dy,p.x),block:true,face},2+Math.abs(dy)*.02);
  }
  plan=best;if(best!==offPlan)plan.attack=null;
  return d0;
 }

 function tick(){
  if(state==='dead'){if(lastState!=='dead')plan=null;lastState=state;tap('enter');return;}
  lastState=state;
  if(state!=='play'||cutscene||stage===10||divine>0){sync(new Set());return;}
  let danger=0;
  if(time>=nextDecision){
   if(P.wanderRate>0&&wanderUntil<=time&&rnd()<P.wanderRate*P.decision){wanderUntil=time+uni(P.wanderDur);wanderGoal=[p.x+(rnd()-.5)*320,p.y+(rnd()-.5)*160];}
   danger=decide();nextDecision=time+P.decision;
  }
  if(!plan)return;
  const want=new Set();
  const alive=enemies.filter(e=>!e.dead),fk=finisherKey(alive,danger>0);
  if(fk){const boss=alive.find(e=>e.boss);if(fk==='q'&&boss&&Math.sign(boss.x-p.x)!==p.face){want.add(boss.x>p.x?'ArrowRight':'ArrowLeft');sync(want);return;}sync(want);tap(fk);return;}
  if(plan.block){
   want.add('s');
   if(p.face!==plan.face)want.add(plan.face>0?'ArrowRight':'ArrowLeft');
   if(plan.ty-p.y>3)want.add('ArrowDown');else if(plan.ty-p.y<-3)want.add('ArrowUp');
   sync(want);return;
  }
  const t=plan.attack;
  if(t&&canHit(t)){
   sync(want);
   if(time>=nextAttack){tap('a');nextAttack=time+uni(P.attackInterval);}
   return;
  }
  if(t&&!t.dead&&Math.abs(t.x-p.x)<currentWeapon().reach&&Math.abs(t.y-p.y)<currentWeapon().depth*.85&&Math.sign(t.x-p.x)!==p.face&&Math.abs(t.x-p.x)>8){
   want.add(t.x>p.x?'ArrowRight':'ArrowLeft');sync(want);return;// turn around
  }
  const dx=plan.tx-p.x,dy=plan.ty-p.y;
  if(dx>3)want.add('ArrowRight');else if(dx<-3)want.add('ArrowLeft');
  if(dy>3)want.add('ArrowDown');else if(dy<-3)want.add('ArrowUp');
  sync(want);
 }
 function sync(want){
  for(const[k,name]of HELD){const has=keys.has(k);if(want.has(k)&&!has)press('keydown',...KEY[name]);else if(!want.has(k)&&has)press('keyup',...KEY[name]);}
 }
 return{tick};
};
})();
