const FINISHER_KEYS={q:'athena',w:'achilles',e:'hermes',r:'zeus'};
const ENERGY_MAX=200;
function finisherCost(god){return god==='zeus'?200:100;}
function lifeStealRate(){return stage===9?.10:.04;}
function gainEnergy(amount){p.energy=clamp(p.energy+amount,0,ENERGY_MAX)};
function attackBonusPercent(){return Math.max(0,Math.min(stage,9)-1)*8;}
function scaledAttackDamage(base){return Math.round(base*(1+attackBonusPercent()/100));}
function absorbAttackLife(dealt){
 if(dealt<=0||p.hp<=0)return 0;
 if(p.hp>=p.maxHP){p.leechCarry=0;return 0;}
 const available=(p.leechCarry||0)+dealt*lifeStealRate(),whole=Math.floor(available+1e-8),gain=Math.min(p.maxHP-p.hp,whole);
 p.leechCarry=Math.max(0,available-whole);p.hp+=gain;if(p.hp===p.maxHP)p.leechCarry=0;
 if(gain){p.healFlash=.4;setExpression(p,'relief',.32);label('LIFE STEAL +'+gain,p.x,p.y-(p.z||0)-115,'#9affc2');burst(p.x,p.y-(p.z||0)-35,'#8ef5b0',7,.35);}
 return gain;
}
function syncProgressGuide(){
 const bonus=attackBonusPercent(),damage=scaledAttackDamage(currentWeapon().damage[0]);
 const ko=document.getElementById('combat-stats-ko'),en=document.getElementById('combat-stats-en');
 if(ko)ko.textContent='현재 기본 타격 '+damage+' · 공격력 +'+bonus+'% · 흡혈 '+Math.round(lifeStealRate()*100)+'%';
 if(en)en.textContent='Current hit '+damage+' · ATK +'+bonus+'% · Life steal '+Math.round(lifeStealRate()*100)+'%';
}
function respawnPosition(){
 const left=cfg().boss?75:arena?475:clamp(p.x-180,35,cfg().length-35),right=cfg().boss?885:arena?1165:clamp(p.x+180,35,cfg().length-35);
 const positions=[{x:left,y:345},{x:right,y:455},{x:left,y:455},{x:right,y:345}],alive=enemies.filter(e=>!e.dead);
 const safety=spot=>alive.length?Math.min(...alive.map(e=>Math.abs(e.x-spot.x)+Math.abs(e.y-spot.y)*2)):0;
 return positions.reduce((best,spot)=>safety(spot)>safety(best)?spot:best,positions[0]);
}
function resumeBattle(){
 if(!p||state!=='dead'||lives<=0)return false;
 runStats.retries++;
 // Preserve enemy objects, HP, deaths, phase, rage, wave progress and earned scores.
 // Only attacks already in flight are cleared to allow a fair re-entry.
 for(const e of enemies){e.wind=0;e.dash=0;e.dashHit=false;e.guard=0;e.stun=0;e.stunLock=0;e.hit=0;e.faceTime=0;e.cool=1.25;}
 const spot=respawnPosition();p.x=spot.x;p.y=spot.y;p.face=p.x<(cfg().boss?480:820)?1:-1;
 p.hp=p.maxHP;p.shield=0;p.energy=40;p.inv=2.2;p.airTime=0;p.z=0;p.jumpCooldown=0;p.attackCooldown=0;p.pendingWeapon=0;p.leechCarry=0;
 p.blockFlash=0;p.shieldFlash=0;p.healFlash=0;p.dodgeFlash=0;p.overheadGuard=false;p.readyNotified=false;p.zeusNotified=false;p.faceTime=0;
 projectiles=[];hazards=[];particles=[];labels=[];rings=[];souls=[];resetHealZone(false);attack=0;queued=false;combo=0;comboUntil=0;freeze=0;shake=0;flash=0;divine=0;enemyClock=1.25;keys.clear();
 state='play';overlay.classList.add('hidden');canvas.focus();syncWeaponGuide();label('BACK IN THE FIGHT',p.x,p.y-140,'#c9f2d6');audio();return true;
}
