// v19 continue: a checkpoint is saved in this browser each time a stage (1-9) starts.
// It holds only what carries from one stage to the next in game.js: difficulty,
// lives, maximum HP (boss blessings), finisher energy, weapon, defeated bosses,
// the celestial compass, score, kills and the journey counters. Stage entry
// (enter) refills HP, so HP itself is not stored.
// Rules: a new game replaces the checkpoint when it reaches stage 1 (the prologue has
// no fights, so an accidental new game does not lose a saved journey at once);
// reaching home deletes it; a game over keeps it so the journey can continue from
// the start of that stage with the lives it had then.
// A continued journey is never ranked (ranking.js does not start or submit a run).
const CHECKPOINT_KEY='odysseus-checkpoint-v1';
const CHECKPOINT_BOSS_STAGES={polyphemus:2,poseidon:3,caocao:7,antinous:9};
// Storage can be missing, full or blocked (private mode); the game works without it.
function checkpointStorage(){try{return typeof localStorage==='object'&&localStorage?localStorage:null;}catch{return null;}}
const finiteBetween=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const wholeBetween=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
// Returns a clean checkpoint, or null when there is none or it does not match the game rules.
function validCheckpoint(c){
 if(!c||typeof c!=='object'||c.v!==1)return null;
 if(!wholeBetween(c.stage,1,9)||!Object.prototype.hasOwnProperty.call(DIFFICULTIES,c.difficulty))return null;
 if(!Array.isArray(c.bossRewards)||new Set(c.bossRewards).size!==c.bossRewards.length||!c.bossRewards.every(b=>CHECKPOINT_BOSS_STAGES[b]<c.stage))return null;
 if(c.maxHP!==100+20*c.bossRewards.length||!wholeBetween(c.lives,1,3)||!finiteBetween(c.energy,0,ENERGY_MAX)||!wholeBetween(c.weapon,1,3)||typeof c.relic!=='boolean')return null;
 const r=c.runStats;
 if(!wholeBetween(c.score,0,1e7)||!wholeBetween(c.kills,0,1e5)||!r||typeof r!=='object'||!wholeBetween(r.normalKills,0,1e4)||!wholeBetween(r.bossKills,0,4)||!finiteBetween(r.damageTaken,0,1e6)||!wholeBetween(r.retries,0,1e4))return null;
 return {v:1,stage:c.stage,difficulty:c.difficulty,lives:c.lives,maxHP:c.maxHP,energy:c.energy,weapon:c.weapon,bossRewards:[...c.bossRewards],relic:c.relic,score:c.score,kills:c.kills,
  runStats:{normalKills:r.normalKills,bossKills:r.bossKills,damageTaken:r.damageTaken,retries:r.retries}};
}
function readCheckpoint(){
 const store=checkpointStorage();if(!store)return null;
 try{const raw=store.getItem(CHECKPOINT_KEY);if(!raw)return null;const c=validCheckpoint(JSON.parse(raw));if(!c)store.removeItem(CHECKPOINT_KEY);return c;}catch{return null;}
}
function clearCheckpoint(){const store=checkpointStorage();try{store?.removeItem(CHECKPOINT_KEY);}catch{}refreshContinueButton();}
// Called by enter() in game.js after the new stage is set up.
function saveCheckpoint(){const saved=writeCheckpoint();refreshContinueButton();return saved;}
function writeCheckpoint(){
 if(!['normal','continue'].includes(journeyMode)||stage<1||stage>9||!p)return false;
 const c=validCheckpoint({v:1,stage,difficulty:runDifficulty,lives,maxHP:p.maxHP,energy:p.energy,weapon:p.weapon,bossRewards:[...bossRewards],relic,score,kills,runStats});
 const store=checkpointStorage();if(!c||!store)return false;
 try{store.setItem(CHECKPOINT_KEY,JSON.stringify({...c,version:'v19',savedAt:Date.now()}));return true;}catch{return false;}
}
function continueJourney(){
 const c=readCheckpoint();if(!c||!['title','gameover','end'].includes(state))return false;
 journeyMode='continue';runDifficulty=c.difficulty;
 p=freshHero();p.maxHP=c.maxHP;p.hp=c.maxHP;p.energy=c.energy;p.weapon=c.weapon;
 lives=c.lives;score=c.score;kills=c.kills;bossRewards=new Set(c.bossRewards);runStats={...c.runStats};relic=c.relic;finalBlessing=false;
 // Game time restarts: a continued journey is not ranked, and analytics measure this session only.
 time=0;
 if(typeof cancelRankRun==='function')cancelRankRun('continue');
 enter(c.stage);audio();return true;
}
function continueLabel(c,ko){const d=DIFFICULTIES[c.difficulty];return ko?'이어하기 (스테이지 '+c.stage+' · '+d.ko+' · '+d.levelKo+')':'CONTINUE (STAGE '+c.stage+' · '+d.en+' · '+d.levelEn+')';}
// Shown only on the title, game over and ending screens, and only when a checkpoint exists.
function refreshContinueButton(){
 const button=document.getElementById('continue'),note=document.getElementById('continue-note');if(!button||!note)return;
 const c=['title','gameover','end'].includes(state)?readCheckpoint():null,ko=controlLanguage==='ko';
 button.hidden=note.hidden=!c;
 if(!c)return;
 button.textContent=continueLabel(c,ko);button.lang=note.lang=controlLanguage;
 note.textContent=ko?'이어한 여정은 순위에 등록되지 않습니다. 순위에 도전하려면 새 게임을 시작하세요.':'Continued journeys are not ranked. Start a new game to enter the rankings.';
}
document.getElementById('continue').onclick=()=>continueJourney();
refreshContinueButton();
