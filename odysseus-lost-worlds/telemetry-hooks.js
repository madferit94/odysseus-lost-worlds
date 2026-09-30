// Observe existing game functions; preserve their return values and balance rules.
(()=>{
 let attempt=0,stageDone=false,bossStartedAt=null,ended=false,ready=new Set();
 const snapshot=()=>({activeMs:Math.round(time*1000),stage,attempt,hp:Math.ceil(p?.hp||0),energy:Math.floor(p?.energy||0),lives,damageTaken:Math.round(runStats.damageTaken),normalKills:runStats.normalKills,bossKills:runStats.bossKills,retries:runStats.retries});
 const event=(name,extra={})=>telemetry.emit(name,snapshot(),extra);
 const bossBegin=()=>{if(cfg().boss&&enemies.some(e=>e.boss&&!e.dead)){bossStartedAt=time;event('boss_start',{boss:cfg().boss});}};
 const bossEnd=outcome=>{if(bossStartedAt===null)return;event('boss_end',{boss:cfg().boss,outcome,durationMs:Math.round((time-bossStartedAt)*1000)});bossStartedAt=null;};
 const complete=()=>{if(!stageDone){event('stage_complete');stageDone=true;}};
 const observeReady=()=>{
  if(!p||state!=='play'||stage===10||cutscene)return;
  for(const god of Object.values(FINISHER_KEYS)){const available=p.energy>=finisherCost(god);if(available&&!ready.has(god)){ready.add(god);event('finisher_ready',{god});}if(!available)ready.delete(god);}
 };
 const originalReset=reset;reset=function(...args){telemetry.begin(selectedDifficulty);attempt=0;stageDone=false;bossStartedAt=null;ended=false;ready.clear();telemetry.emit('game_start',{activeMs:0,stage:0,attempt:0,hp:100,energy:0,lives:3,damageTaken:0,normalKills:0,bossKills:0,retries:0});return originalReset(...args);};
 const originalEnter=enter;enter=function(s){if(p&&s===1&&stage===0)complete();const result=originalEnter(s);attempt=0;stageDone=false;bossStartedAt=null;event('stage_start');bossBegin();observeReady();return result;};
 const originalResume=resumeBattle;resumeBattle=function(...args){const result=originalResume(...args);if(result){attempt++;ready.clear();event('retry');event('stage_start');bossBegin();observeReady();}return result;};
 const originalHurt=hurt;hurt=function(...args){const before=p?.hp,result=originalHurt(...args);if(before>0&&p.hp===0){event('player_death');bossEnd('death');if(state==='gameover'&&!ended){ended=true;event('game_over');}}return result;};
 const originalDamage=damage;damage=function(e,...args){const alive=!e.dead,result=originalDamage(e,...args);if(alive&&e.boss&&e.dead)bossEnd('win');observeReady();return result;};
 const originalGain=gainEnergy;gainEnergy=function(...args){const result=originalGain(...args);observeReady();return result;};
 const originalFinisher=finisher;finisher=function(god='athena'){observeReady();const before=snapshot(),wasDivine=divine;const result=originalFinisher(god);if(wasDivine<=0&&divine>0){telemetry.emit('finisher_use',before,{god});observeReady();}return result;};
 const originalFinish=finishStage;finishStage=function(...args){complete();return originalFinish(...args);};
 const originalUpdate=update;update=function(...args){const result=originalUpdate(...args);observeReady();if(state==='end'&&!ended){complete();ended=true;event('game_clear');}return result;};
 const originalLanguage=refreshControlLanguage;refreshControlLanguage=function(...args){const result=originalLanguage(...args);telemetry.display();return result;};
 document.addEventListener('visibilitychange',()=>{if(p&&!ended){event(document.hidden?'session_hidden':'session_resumed');telemetry.flush();}});
 window.addEventListener('pagehide',()=>{if(p&&!ended){event('session_hidden');telemetry.flush();}});
})();
