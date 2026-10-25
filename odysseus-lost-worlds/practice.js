// v19 boss practice: fight one boss this browser has already beaten, on the selected
// difficulty, then return to the menu with the result. Practice is never ranked
// (no ranking run is started) and never saves or replaces the Continue checkpoint
// (checkpoint.js only saves for 'normal' and 'continue' journeys).
const BEATEN_BOSSES_KEY='odysseus-bosses-beaten-v1';
const PRACTICE_BOSSES=[
 {id:'polyphemus',stage:2,ko:'폴리페모스',en:'POLYPHEMUS'},
 {id:'poseidon',stage:3,ko:'포세이돈',en:'POSEIDON'},
 {id:'caocao',stage:7,ko:'조조',en:'CAO CAO'},
 {id:'antinous',stage:9,ko:'안티노오스',en:'ANTINOUS'}
];
let practiceBoss=null,practiceMenuOpen=false,practiceResult=null;
function practiceStorage(){try{return typeof localStorage==='object'&&localStorage?localStorage:null;}catch{return null;}}
function beatenBosses(){
 try{const list=JSON.parse(practiceStorage()?.getItem(BEATEN_BOSSES_KEY)||'[]');return Array.isArray(list)?PRACTICE_BOSSES.map(b=>b.id).filter(id=>list.includes(id)):[];}catch{return [];}
}
// Called by damage() in game.js whenever a boss is defeated.
function recordBossWin(id){
 if(!PRACTICE_BOSSES.some(b=>b.id===id))return false;const list=beatenBosses();if(list.includes(id))return true;
 const store=practiceStorage();if(!store)return false;
 try{store.setItem(BEATEN_BOSSES_KEY,JSON.stringify([...list,id]));return true;}catch{return false;}
}
const practiceKo=()=>controlLanguage==='ko';
const practiceTime=seconds=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
// The hero arrives as on a real journey: the blessings of the earlier bosses (+20 max HP each)
// and the attack bonus of that stage (from enter). One life: the first fall ends the practice.
// Returns null when this boss cannot be practised now.
function practicePlan(id){
 const boss=PRACTICE_BOSSES.find(b=>b.id===id);
 if(!boss||!beatenBosses().includes(id)||!['title','gameover','end'].includes(state))return null;
 const earlier=PRACTICE_BOSSES.filter(b=>b.stage<boss.stage).map(b=>b.id);
 return {boss,earlier,stage:boss.stage,maxHP:100+20*earlier.length,lives:1};
}
function startBossPractice(id){
 const plan=practicePlan(id);if(!plan)return false;const {boss,earlier}=plan;
 journeyMode='practice';practiceBoss=boss;practiceMenuOpen=false;practiceResult=null;runDifficulty=selectedDifficulty;
 p=freshHero();p.maxHP=plan.maxHP;p.hp=p.maxHP;lives=plan.lives;score=0;kills=0;bossRewards=new Set(earlier);
 runStats={normalKills:0,bossKills:0,damageTaken:0,retries:0};relic=boss.stage>7;finalBlessing=false;time=0;
 if(typeof cancelRankRun==='function')cancelRankRun('practice');
 enter(boss.stage);audio();refreshPracticeMenu();return true;
}
function endPractice(won){
 const boss=practiceBoss,d=DIFFICULTIES[runDifficulty],ko=practiceKo();
 practiceResult={boss:boss.id,won,seconds:Math.ceil(time),difficulty:runDifficulty};practiceMenuOpen=true;
 state=won?'end':'gameover';keys.clear();resetHealZone();
 // Nothing still in the air may hit the hero after the practice has ended.
 projectiles=[];hazards=[];p.inv=1e9;
 show(ko?'보스 연습':'BOSS PRACTICE',won?(ko?'승리':'VICTORY'):(ko?'패배':'DEFEATED'),
  (ko?boss.ko:boss.en)+' · '+(ko?d.ko+' · '+d.levelKo:d.en+' · '+d.levelEn)+'<br>'+(ko?'시간 ':'TIME ')+practiceTime(practiceResult.seconds)+'<br>'+(ko?'연습은 순위와 이어하기 기록에 남지 않습니다.':'Practice is not ranked and does not change your Continue checkpoint.'),
  ko?'새 여정 시작':'START NEW JOURNEY');
}
// A practice ends at the boss's defeat (instead of the next cut-scene or path) or at the first fall.
{const originalFinish=finishStage;finishStage=function(...args){if(journeyMode==='practice'&&state==='play'){endPractice(true);return;}return originalFinish(...args);};}
{const originalHurt=hurt;hurt=function(...args){const result=originalHurt(...args);if(journeyMode==='practice'&&state==='gameover'&&!practiceResult)endPractice(false);return result;};}
// Leaving for a journey closes the menu, so it opens again only when asked.
{const originalReset=reset;reset=function(...args){practiceMenuOpen=false;const result=originalReset(...args);refreshPracticeMenu();return result;};}
if(typeof continueJourney==='function'){const originalContinue=continueJourney;continueJourney=function(...args){const result=originalContinue(...args);if(result){practiceMenuOpen=false;refreshPracticeMenu();}return result;};}
function refreshPracticeMenu(){
 const toggle=document.getElementById('practice'),menu=document.getElementById('practice-menu');if(!toggle||!menu)return;
 const ko=practiceKo(),visible=['title','gameover','end'].includes(state),beaten=beatenBosses();
 toggle.hidden=!visible;toggle.textContent=ko?'보스 연습':'BOSS PRACTICE';toggle.lang=controlLanguage;
 toggle.setAttribute('aria-expanded',String(visible&&practiceMenuOpen));menu.hidden=!(visible&&practiceMenuOpen);
 // The open menu takes the place of the key reminder line, so the panel stays shorter.
 const keysLine=document.getElementById('small');if(keysLine)keysLine.hidden=visible&&practiceMenuOpen;
 menu.setAttribute('aria-label',ko?'보스 연습':'Boss practice');menu.lang=controlLanguage;
 const d=DIFFICULTIES[selectedDifficulty];
 document.getElementById('practice-hint').textContent=beaten.length
  ?(ko?'이긴 보스와 바로 싸웁니다. 난이도: '+d.ko+' · '+d.levelKo+'. 목숨 1개, 순위·이어하기 기록에는 남지 않습니다.':'Fight a boss you have beaten. Difficulty: '+d.en+' · '+d.levelEn+'. One life; not ranked and does not change your Continue checkpoint.')
  :(ko?'아직 이긴 보스가 없습니다. 여정에서 보스를 한 번 물리치면 이 브라우저에서 연습할 수 있습니다.':'No boss defeated yet. Beat a boss once on a journey, and you can practise it here in this browser.');
 for(const boss of PRACTICE_BOSSES){
  const button=document.getElementById('practice-'+boss.id),won=beaten.includes(boss.id);
  button.disabled=!won;button.textContent=(ko?boss.ko:boss.en)+(won?'':(ko?' · 아직 이기지 않음':' · NOT YET DEFEATED'));
 }
}
document.getElementById('practice').onclick=()=>{practiceMenuOpen=!practiceMenuOpen;refreshPracticeMenu();};
for(const boss of PRACTICE_BOSSES)document.getElementById('practice-'+boss.id).onclick=()=>startBossPractice(boss.id);
refreshPracticeMenu();
