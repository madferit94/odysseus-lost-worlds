let controlLanguage='en';
function refreshDifficultyLabels(){
 const ko=controlLanguage==='ko';
 document.getElementById('difficulty-label').textContent=ko?'여정의 난이도 선택':'CHOOSE YOUR ODYSSEY';
 document.getElementById('difficulty-picker').setAttribute('aria-label',ko?'게임 난이도':'Game difficulty');
 for(const [id,level] of Object.entries(DIFFICULTIES)){
  const button=document.getElementById('difficulty-'+id);
  button.textContent=ko?level.ko+' · '+level.levelKo:level.en+' · '+level.levelEn;
  button.setAttribute('aria-pressed',String(selectedDifficulty===id));
 }
}
function selectDifficulty(id){if(!DIFFICULTIES[id]||!['title','gameover','end'].includes(state))return false;selectedDifficulty=id;refreshDifficultyLabels();return true;}
function bindDifficultyControls(){for(const id of Object.keys(DIFFICULTIES))document.getElementById('difficulty-'+id).onclick=()=>selectDifficulty(id);refreshDifficultyLabels();}
function refreshSoundLabel(){document.getElementById('sound').textContent=controlLanguage==='ko'?(muted?'소리: 꺼짐':'소리: 켜짐'):(muted?'Sound: OFF':'Sound: ON');}
function refreshControlLanguage(){
 const ko=controlLanguage==='ko';
 const small=document.getElementById('small'),hint=document.getElementById('hint');
 small.lang=hint.lang=controlLanguage;
 small.textContent=state==='pause'?(ko?'Esc — 게임 계속':'Esc — Resume your journey'):(ko?'방향키 이동 · A 공격 · S 방패 · Space 점프 · 1 / 2 / 3 무기 · Q / W / E / R 필살기':'Arrows move · A attack · S shield · Space jump · 1 / 2 / 3 weapons · Q / W / E / R finishers');
 hint.textContent=ko?'목숨은 3개입니다. 보스전에는 무작위 힐 존이 나타나며 안에 서 있으면 HP가 회복됩니다. 초록 하트 몹은 HP 20을 회복합니다. S로 보스를 향해 방어하세요.':'You have 3 lives. A random heal zone appears during boss fights; stand inside it to recover HP. Green heart enemies heal 20 HP. Hold S facing the boss to block.';
 refreshSoundLabel();refreshDifficultyLabels();if(typeof refreshViewsLabel==='function')refreshViewsLabel();
}
function setControlLanguage(language){
 controlLanguage=language==='ko'?'ko':'en';const ko=controlLanguage==='ko';
 document.getElementById('guide-ko').hidden=!ko;document.getElementById('guide-en').hidden=ko;
 for(const id of ['en','ko'])document.getElementById('lang-'+id).setAttribute('aria-pressed',String(id===controlLanguage));
 refreshControlLanguage();
}
function bindLanguageControls(){
 for(const id of ['en','ko'])document.getElementById('lang-'+id).onclick=()=>{setControlLanguage(id);if(state==='play')canvas.focus();};
 setControlLanguage('en');
}
