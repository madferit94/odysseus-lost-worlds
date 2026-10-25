let rankRunId=null,rankPending=null,rankGeneration=0,rankStarting=null,rankIdentityReady=Promise.resolve();
// v18: one ranking board per difficulty. 'legacy' lists results with no recorded
// difficulty: saved before v18, or started from a page opened before the update.
const RANK_BOARDS={
 ithaca:{ko:'이타카의 길 · 쉬움',en:'ITHACA’S PATH · EASY'},
 aegean:{ko:'에게해의 항해 · 보통',en:'AEGEAN VOYAGE · NORMAL'},
 trial:{ko:'신들의 시련 · 어려움',en:'TRIAL OF THE GODS · HARD'},
 wrath:{ko:'포세이돈의 분노 · 최상',en:'POSEIDON’S WRATH · EXTREME'},
 legacy:{ko:'이전 기록 (난이도 구분 전)',en:'Earlier records (before difficulty split)'}
};
const RANK_BOARD_IDS=Object.keys(RANK_BOARDS),rankDifficulty=id=>RANK_BOARD_IDS.includes(id)&&id!=='legacy'?id:null;
// Default board: the difficulty currently selected in the game (game.js), else Normal.
let rankBoard=typeof selectedDifficulty==='string'&&rankDifficulty(selectedDifficulty)||'aegean',rankRunDifficulty=null,rankLoadTicket=0;
const rankStatus=document.getElementById('rank-status'),rankSave=document.getElementById('rank-save'),rankForm=document.getElementById('rank-form');
async function rankRequest(path,body){
 const response=await fetch(path,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{});
 let data;try{data=await response.json();}catch{throw Error('Online rankings are unavailable. Please try again.');}
 if(!response.ok){const error=Error(rankMessage(response,data));error.status=response.status;error.code=data.code||'';throw error;}return data;
}
// Clear messages for the server's ranking checks; other errors keep the server's text.
function rankMessage(response,data){
 if(response.status===429){const wait=Number(response.headers?.get?.('retry-after'))||data.retryAfter||60;return 'Too many requests from this connection. Please wait '+(wait>=120?Math.ceil(wait/60)+' minutes':wait+' seconds')+' and try again.';}
 if(data.code==='implausible_time')return 'This result was faster than a real journey can be completed, so it was not ranked.';
 if(data.code==='impossible_result')return 'This result did not match what the journey allows, so it was not ranked.';
 if(data.code==='clock_mismatch')return 'This result reported more play time than has passed since the journey started, so it was not ranked.';
 if(data.code==='nickname_reserved')return 'That nickname is reserved for the game operator. Please choose another.';
 if(data.code==='nickname_blocked')return 'That nickname is not allowed. Please choose another.';
 if(data.code==='nickname_mixed_script')return 'Use one alphabet in your nickname. Latin letters cannot be mixed with Cyrillic or Greek letters.';
 return data.error||'Could not connect to rankings.';
}
// game.js calls this from reset(), after runDifficulty is fixed for the new journey.
// The server stores the difficulty with the run when it starts; the result sent at
// the end carries no difficulty, so it cannot move a run to another board.
function startRankRun(difficulty=typeof runDifficulty==='string'?runDifficulty:null){
 const generation=++rankGeneration;rankRunId=null;rankPending=null;rankRunDifficulty=null;rankForm.hidden=true;rankSave.disabled=false;
 rankStatus.textContent='Starting your ranked journey…';const start=rankDifficulty(difficulty)?{difficulty}:{};
 rankStarting=rankIdentityReady.then(()=>rankRequest('/api/runs',start)).then(data=>{if(generation===rankGeneration){rankRunId=data.runId;rankRunDifficulty=rankDifficulty(data.difficulty);rankStatus.textContent='Journey started. Reach home to enter the rankings.';}}).catch(error=>{if(generation===rankGeneration)rankStatus.textContent=error.message+' This journey can still be played.';});
}
// v19: continued journeys (and other unranked modes) never start or submit a ranked run.
function unrankedMessage(mode){
 const ko=typeof controlLanguage==='string'&&controlLanguage==='ko';
 return mode==='continue'?(ko?'이어한 여정은 순위에 등록되지 않습니다. 순위에 도전하려면 새 게임을 시작하세요.':'This is a continued journey, so it is not ranked. Start a new game to enter the rankings.')
  :mode==='practice'?(ko?'보스 연습은 순위에 등록되지 않습니다.':'Boss practice is not ranked.')
  :(ko?'이 플레이는 순위에 등록되지 않습니다.':'This play is not ranked.');
}
// Drops any ranked run this page started earlier, so it can never be submitted for an unranked journey.
function cancelRankRun(mode){++rankGeneration;rankRunId=null;rankPending=null;rankRunDifficulty=null;rankStarting=null;rankForm.hidden=true;rankStatus.textContent=unrankedMessage(mode);}
async function finishRankRun(result,mode='normal'){
 if(mode!=='normal'){cancelRankRun(mode);return;}
 const generation=rankGeneration;rankPending=result;await rankStarting;if(generation!==rankGeneration)return;
 if(!rankRunId){rankStatus.textContent='Journey complete. This run could not connect to online rankings.';return;}
 showRankBoard(rankRunDifficulty||'legacy');
 rankForm.hidden=false;rankStatus.textContent='You made it home! Enter a nickname to save your result.';rankWaitingChanged();
}
function rankAttr(el,name,value){if(typeof el.setAttribute==='function')el.setAttribute(name,value);}
// Tab labels follow the page language (controlLanguage from ui.js).
// A finished ranked journey waits here until it is saved or skipped. Boss practice
// (practice.js) stays locked meanwhile, so starting one cannot silently drop it.
function rankResultWaiting(){return !!(rankPending&&rankRunId);}
function rankWaitingChanged(){if(typeof refreshPracticeMenu==='function')refreshPracticeMenu();}
function skipRankResult(){
 if(!rankResultWaiting())return false;rankPending=null;rankForm.hidden=true;
 rankStatus.textContent=typeof controlLanguage==='string'&&controlLanguage==='ko'?'이 결과는 순위에 저장하지 않았습니다.':'This result was not saved to the rankings.';
 rankWaitingChanged();return true;
}
function refreshRankTabs(){
 const ko=typeof controlLanguage==='string'&&controlLanguage==='ko';
 const group=document.getElementById('rank-tabs');rankAttr(group,'aria-label',ko?'난이도별 순위':'Rankings by difficulty');
 for(const [id,label] of Object.entries(RANK_BOARDS)){
  const tab=document.getElementById('rank-tab-'+id);tab.textContent=ko?label.ko:label.en;tab.lang=ko?'ko':'en';
  rankAttr(tab,'aria-pressed',String(id===rankBoard));tab.className='rank-tab'+(id===rankBoard?' rank-tab-current':'')+(id==='legacy'?' rank-tab-legacy':'');
 }
 const skip=document.getElementById('rank-skip');skip.textContent=ko?'저장하지 않고 건너뛰기':'Skip, do not save';skip.lang=ko?'ko':'en';
}
// Switches the board at once; the list loads after the browser identity request (first load) is done.
function showRankBoard(id){if(!RANK_BOARD_IDS.includes(id))return null;rankBoard=id;refreshRankTabs();return rankIdentityReady.then(()=>loadRanking());}
function rankTime(seconds){return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
async function loadRanking(){
 const body=document.getElementById('rank-rows'),status=document.getElementById('rank-load'),board=rankBoard,ticket=++rankLoadTicket;status.textContent='Loading rankings…';
 // Clear the previous board at once so its rows are never shown under another tab while loading or after a failure.
 body.replaceChildren();document.getElementById('rank-personal').textContent='';
 try{const data=await rankRequest('/api/leaderboard?difficulty='+board);if(ticket!==rankLoadTicket)return;body.replaceChildren();
  const visible=[...data.entries];if(data.myBest&&data.myBest.rank>20)visible.push(data.myBest);document.getElementById('rank-personal').textContent=data.myBest?'My best: #'+data.myBest.rank+' · '+data.myBest.score.toLocaleString()+' points (ME)':'Your new records will be marked (ME) in this browser.';
  for(const [i,row] of visible.entries()){
   const tr=document.createElement('tr');if(row.is_me)tr.className='rank-me';for(const value of [row.rank||i+1,row.nickname+(row.is_me?' (ME)':''),row.score.toLocaleString(),rankTime(row.elapsed),row.retries]){const td=document.createElement('td');td.textContent=value;tr.appendChild(td);}body.appendChild(tr);
  }
  const ko=typeof controlLanguage==='string'&&controlLanguage==='ko';
  status.textContent=board==='legacy'?(data.entries.length?(ko?'난이도가 기록되지 않은 결과입니다(v18 이전 기록 또는 업데이트 전에 열어 둔 페이지로 시작한 게임).':'Results with no recorded difficulty: saved before v18, or started from a page opened before the update.'):(ko?'난이도가 기록되지 않은 결과가 없습니다.':'No results without a recorded difficulty.')):data.entries.length?'Top 20 completed journeys on this difficulty · Highest score wins.':'No completed journeys on this difficulty yet. Be the first to return home!';
 }catch(error){if(ticket===rankLoadTicket)status.textContent=error.message;}
}
rankForm.addEventListener('submit',async event=>{
 event.preventDefault();if(!rankPending||!rankRunId)return;rankSave.disabled=true;rankStatus.textContent='Saving your journey…';
 try{const result=await rankRequest('/api/results',{...rankPending,runId:rankRunId,nickname:document.getElementById('rank-name').value});rankStatus.textContent='Saved! Your ranking score: '+result.score.toLocaleString()+'.';rankForm.hidden=true;rankPending=null;rankWaitingChanged();
  // Show the board of the difficulty the server stored for this journey.
  rankBoard=rankDifficulty(result.difficulty)||(result.difficulty===null?'legacy':rankBoard);refreshRankTabs();await loadRanking();}
 catch(error){rankStatus.textContent=error.message;
  // A rejected result cannot pass on a second try, so the form closes; nickname and busy errors can be fixed.
  if(error.status===422||['clock_mismatch','invalid_result'].includes(error.code)){rankForm.hidden=true;rankPending=null;rankWaitingChanged();}else rankSave.disabled=false;}
});
document.getElementById('rank-skip').addEventListener('click',()=>skipRankResult());
for(const id of RANK_BOARD_IDS)document.getElementById('rank-tab-'+id).onclick=()=>showRankBoard(id);
document.getElementById('rank-refresh').addEventListener('click',async()=>{await rankIdentityReady;await loadRanking();});refreshRankTabs();rankIdentityReady=loadRanking();
