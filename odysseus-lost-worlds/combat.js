const SHIELD_MAX=60,ARMOR_REDUCTION=.12,HEAL_ZONE_RATE=12,HEAL_ZONE_LIFE=6;
let healZone=null,healZoneClock=0;
function healZoneDelay(first=false){return (first?7:9)+Math.random()*(first?5:7);}
function resetHealZone(first=false){healZone=null;healZoneClock=cfg().boss?healZoneDelay(first):Infinity;}
function spawnHealZone(){
 const boss=enemies.find(e=>e.boss&&!e.dead);if(!cfg().boss||!boss||cleared||cutscene)return false;
 let x=480,y=400;
 for(let i=0;i<6;i++){const candidateX=140+Math.random()*680,candidateY=350+Math.random()*102;if(Math.hypot(candidateX-boss.x,(candidateY-boss.y)*1.8)>175){x=candidateX;y=candidateY;break;}x=candidateX;y=candidateY;}
 healZone={x,y,life:HEAL_ZONE_LIFE,maxLife:HEAL_ZONE_LIFE,carry:0,reported:0,labelClock:0};
 label('HEAL ZONE',x,y-58,'#a7ffc3');burst(x,y-8,'#79f3a8',24,.65);tone(660,.3,'triangle',.045,990);return true;
}
function updateHealZone(dt){
 if(!cfg().boss||cleared||cutscene||!enemies.some(e=>e.boss&&!e.dead)){healZone=null;return;}
 if(!healZone){healZoneClock-=dt;if(healZoneClock<=0)spawnHealZone();return;}
 healZone.life-=dt;healZone.labelClock-=dt;
 const dx=(p.x-healZone.x)/72,dy=(p.y-healZone.y)/32,inside=dx*dx+dy*dy<=1;
 if(inside&&p.hp<p.maxHP){
  const available=healZone.carry+HEAL_ZONE_RATE*dt,whole=Math.floor(available),gain=Math.min(p.maxHP-p.hp,whole);
  healZone.carry=available-whole;p.hp+=gain;healZone.reported+=gain;
  if(gain){p.healFlash=.22;setExpression(p,'relief',.25);}
  if(healZone.labelClock<=0&&healZone.reported){label('HEAL ZONE +'+healZone.reported,p.x,p.y-(p.z||0)-112,'#a7ffc3');healZone.reported=0;healZone.labelClock=.75;tone(720,.08,'triangle',.018,920);}
 }
 if(healZone.life<=0){healZone=null;healZoneClock=healZoneDelay(false);}
}
function drawHealZone(){
 if(!healZone)return;const x=healZone.x-cam,y=healZone.y,pulse=(Math.sin(time*6)+1)/2,fade=Math.min(1,healZone.life);
 g.save();g.globalAlpha=.18+.15*pulse*fade;ellipse(x,y,72,32,'#62f39b');ellipse(x,y,52,22,'#a8ffbe');g.globalAlpha=.85*fade;g.strokeStyle='#a9ffc3';g.lineWidth=2;g.beginPath();g.ellipse(x,y,68+pulse*5,29+pulse*3,0,0,Math.PI*2);g.stroke();rect(x-4,y-21,8,42,'#d6ffe0');rect(x-21,y-4,42,8,'#d6ffe0');g.restore();text('HEAL '+Math.ceil(healZone.life)+'s',x,y+50,10,'#bfffd0','center');
}
function reducedDamage(amount){return Math.max(1,Math.round(amount*(1-ARMOR_REDUCTION)));}
function blocksAttack(sourceX,blockable){return blockable&&sourceX!==null&&isBlocking()&&(sourceX-p.x)*p.face>=-2;}
function resolvePlayerDamage(amount){
 const incoming=reducedDamage(amount),absorbed=Math.min(p.shield||0,incoming);
 p.shield=Math.max(0,(p.shield||0)-absorbed);const lostHP=Math.min(p.hp,incoming-absorbed);
 p.hp-=lostHP;runStats.damageTaken+=lostHP;
 if(absorbed){p.shieldFlash=.5;burst(p.x,p.y-(p.z||0)-35,'#7feaff',17,.7);label(p.shield?'SHIELD -'+absorbed:'SHIELD BROKEN',p.x,p.y-(p.z||0)-130,'#a2efff');}
 return {absorbed,lostHP};
}
function grantLifeReward(e){
 const full=p.hp>=(p.maxHP||100),heal=Math.min(20,(p.maxHP||100)-p.hp),shield=full?Math.min(SHIELD_MAX-(p.shield||0),8):0;
 p.hp+=heal;p.shield=(p.shield||0)+shield;p.healFlash=heal>0?1.1:0;p.shieldFlash=shield>0?1.1:0;setExpression(p,'relief',.8);
 for(let i=0;i<9;i++)souls.push({x:e.x,y:e.y-35,life:1.1+i*.035,phase:i*.7,shield:shield>0});
 if(heal)label('LIFE ABSORB +'+heal+' HP',p.x,p.y-110,'#9affb8');
 if(shield)label('SHIELD +'+shield,p.x,p.y-(heal?135:110),'#a2efff');
 if(!heal&&!shield)label('HP & SHIELD FULL',p.x,p.y-110,'#a2efff');
 burst(p.x,p.y-34,shield?'#82eaff':'#8effb4',20,.7);tone(shield?784:660,.22,'triangle',.045,1046);
}
function queueWaterBombs(e){
 const count=e.enraged?3:2;
 for(let i=0;i<count;i++){
  const delay=.8+i*.38,x=clamp(e.targetX+(i===0?0:i===1?100:-100),60,880),y=clamp(e.targetY+(i===0?0:i===1?24:-24),338,464);
  hazards.push({kind:'waterbomb',bossAttack:true,sourceX:e.x,x,y,r:62,delay,life:delay+.5,damage:enemyDamage(e,21),hit:false,impacted:false});
 }
}
function updateHazards(dt){
 for(const h of hazards){
  h.delay-=dt;h.life-=dt;
  if(h.kind==='waterbomb'&&h.delay<=0&&!h.impacted){
   h.impacted=true;burst(h.x,h.y-10,'#b7f4ff',26,1.3);burst(h.x,h.y,'#4eafcf',18,.9);shake=Math.max(shake,4);noise(.16,.04);tone(130,.18,'triangle',.04,55);
  }
  const active=h.life>0&&(h.kind!=='waterbomb'||h.delay>-.24),sourceX=h.sourceX??h.x,blockable=!!h.bossAttack||['counter','stab'].includes(h.kind);
  if(active&&h.delay<=0&&!h.hit&&Math.abs(p.x-h.x)<h.r&&Math.abs(p.y-h.y)<(h.kind==='shock'?35:h.kind==='stab'?25:h.r*.55)){
   if(hurt(h.damage,sourceX,blockable,h.kind))h.hit=true;
  }
  if(h.life>0&&h.kind==='vortex'&&h.delay<0&&!blocksAttack(sourceX,blockable)){
   const dx=h.x-p.x,dy=h.y-p.y;if(Math.hypot(dx,dy)<160){p.x+=dx*dt*.3;p.y+=dy*dt*.3;}
  }
 }
 hazards=hazards.filter(h=>h.life>0);
}
function waterBombAltitude(h){return Math.max(0,Math.min(1,h.delay/.65))*270;}
function drawWaterBomb(h){
 const x=h.x-cam,y=h.y,warn=h.delay>0;
 ellipse(x,y,h.r,h.r*.4,warn?'#62dbed33':'#4daed17d');
 g.strokeStyle=warn?'#80eafd':'#d2ffff';g.lineWidth=3;g.beginPath();g.ellipse(x,y,h.r,h.r*.4,0,0,Math.PI*2);g.stroke();
 if(warn){
  text('WATER BOMB',x,y+6,11,'#defbff','center');
  if(h.delay<=.65){
   const altitude=waterBombAltitude(h),cy=y-altitude-18;
   for(let i=0;i<4;i++)ellipse(x+(i%2?10:-10),cy-28-i*14,3,8,'#96e9fa88');
   poly([[x-23,cy+4],[x-19,cy-17],[x-8,cy-35],[x,cy-49],[x+13,cy-27],[x+24,cy-4],[x+20,cy+15],[x,cy+24],[x-20,cy+16]],'#278cad');
   ellipse(x,cy,20,23,'#71d9ed');ellipse(x-6,cy-7,7,11,'#d1ffff');ellipse(x+9,cy+8,6,7,'#40a6c9');
  }
 }else{
  const t=Math.min(1,-h.delay/.5),r=24+t*65;
  ellipse(x,y,r,9+t*16,'#bafaff88');
  for(let i=0;i<10;i++){const angle=i*Math.PI/5,dx=Math.cos(angle)*r,dy=Math.sin(angle)*r*.32,lift=Math.sin(t*Math.PI)*(24+i%3*9);
   ellipse(x+dx,y+dy-lift,4,7,'#bff7ff');
  }
 }
}
function divineReady(){return !!p&&p.energy>=100&&divine<=0;}
function readyColor(){const t=(Math.sin(time*3)+1)/2;if(p&&p.energy>=200)return 'rgb('+Math.round(120+100*t)+',235,255)';return 'rgb('+Math.round(197+58*t)+','+Math.round(132+79*t)+','+Math.round(255-99*t)+')';}
function updateCombatFeedback(dt){
 p.shieldFlash=Math.max(0,(p.shieldFlash||0)-dt);
 const ready=divineReady()&&!cutscene&&stage!==10;
 if(ready&&!p.readyNotified){p.readyNotified=true;label('DIVINE READY',p.x,p.y-(p.z||0)-153,'#ffe6a6');burst(p.x,p.y-(p.z||0)-42,'#d8a6ff',26,.75);tone(880,.25,'triangle',.045,1320);}
 if(!ready)p.readyNotified=false;
 const zeus=ready&&p.energy>=200;if(zeus&&!p.zeusNotified){p.zeusNotified=true;label('ZEUS READY · R',p.x,p.y-(p.z||0)-175,'#baf6ff');burst(p.x,p.y-(p.z||0)-45,'#7fe8ff',42,1);tone(1108,.4,'triangle',.055,1760);}if(!zeus)p.zeusNotified=false;
}
function drawPlayerAuras(x,y){
 if(p.shield>0||p.shieldFlash>0){
  const alpha=p.shieldFlash>0?.24:.10;g.save();g.globalAlpha=alpha;ellipse(x,y-42,35,52,'#72e5ff');g.restore();
  g.strokeStyle=p.shieldFlash>0?'#d4fbff':'#73cce8';g.lineWidth=p.shieldFlash>0?3:1.5;g.beginPath();g.ellipse(x,y-42,35,52,0,0,Math.PI*2);g.stroke();
 }
 if(divineReady()&&!cutscene&&stage!==10){
  g.save();g.strokeStyle=readyColor();g.lineWidth=3;g.beginPath();g.ellipse(x,y+3,37+Math.sin(time*3)*4,11,0,0,Math.PI*2);g.stroke();
  for(let i=0;i<6;i++){const a=time*1.5+i*Math.PI/3,xx=x+Math.cos(a)*38,yy=y-42+Math.sin(a)*42;poly([[xx,yy-4],[xx+3,yy],[xx,yy+4],[xx-3,yy]],readyColor());}g.restore();
 }
}
function drawPlayerVitals(){
 const ready=divineReady(),hp=p?p.hp:100,max=p?p.maxHP:100,shield=p?(p.shield||0):0;
 text('ODYSSEUS',25,21,15);text('LIVES '+lives,243,21,10,lives>1?'#f0d99f':'#ff9d86','right');text('HP',25,39,10,'#b7c3bf');text(Math.ceil(hp)+' / '+max,243,39,10,'#dce7d6');rect(65,31,170,9,'#2c414a');rect(65,31,170*hp/max,9,'#d28d70');
 text('SHIELD',25,55,9,'#a5e8fc');rect(65,49,170,6,'#233e51');rect(65,49,170*shield/SHIELD_MAX,6,'#76dfff');text(shield+' / '+SHIELD_MAX,243,55,10,'#a5e8fc');
 const energy=p?p.energy:0,zeus=ready&&energy>=200;
 text(zeus?'ZEUS READY · PRESS R':ready?'Q / W / E READY · R NEEDS 2':'DIVINE ENERGY · R NEEDS 2',25,71,9,zeus?'#baf6ff':ready?'#ffe5ae':'#aec9c6');
 if(ready)rect(22,76,216,13,readyColor());rect(25,78,210,9,'#2c414a');rect(25,78,210*energy/ENERGY_MAX,9,ready?readyColor():'#80c5ca');rect(129,77,3,11,'#101f2c');
 text((energy/100).toFixed(2)+' / 2',243,86,10,zeus?'#baf6ff':'#dce7d6');
}
