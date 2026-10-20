let rankRunId=null,rankPending=null,rankGeneration=0,rankStarting=null,rankIdentityReady=Promise.resolve();
const rankStatus=document.getElementById('rank-status'),rankSave=document.getElementById('rank-save'),rankForm=document.getElementById('rank-form');
async function rankRequest(path,body){
 let response;try{response=await fetch(path,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{});}catch{throw Error('Online rankings are unavailable. Please try again.');}
 let data;try{data=await response.json();}catch{throw Error('Online rankings are unavailable. Please try again.');}
 if(!response.ok)throw Error(data.error||'Could not connect to rankings.');return data;
}
function startRankRun(){
 const generation=++rankGeneration;rankRunId=null;rankPending=null;rankForm.hidden=true;rankSave.disabled=false;
 rankStatus.textContent='Starting your ranked journey…';
 rankStarting=rankIdentityReady.then(()=>rankRequest('/api/runs',{})).then(data=>{if(generation===rankGeneration){rankRunId=data.runId;rankStatus.textContent='Journey started. Reach home to enter the rankings.';}}).catch(error=>{if(generation===rankGeneration)rankStatus.textContent=error.message+' This journey can still be played.';});
}
async function finishRankRun(result){
 const generation=rankGeneration;rankPending=result;await rankStarting;if(generation!==rankGeneration)return;
 if(!rankRunId){rankStatus.textContent='Journey complete. This run could not connect to online rankings.';return;}
 rankForm.hidden=false;rankStatus.textContent='You made it home! Enter a nickname to save your result.';
}
function rankTime(seconds){return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
async function loadRanking(){
 const body=document.getElementById('rank-rows'),status=document.getElementById('rank-load');status.textContent='Loading rankings…';
 try{const data=await rankRequest('/api/leaderboard');body.replaceChildren();
  const visible=[...data.entries];if(data.myBest&&data.myBest.rank>20)visible.push(data.myBest);document.getElementById('rank-personal').textContent=data.myBest?'My best: #'+data.myBest.rank+' · '+data.myBest.score.toLocaleString()+' points (ME)':'Your new records will be marked (ME) in this browser.';
  for(const [i,row] of visible.entries()){
   const tr=document.createElement('tr');if(row.is_me)tr.className='rank-me';for(const value of [row.rank||i+1,row.nickname+(row.is_me?' (ME)':''),row.score.toLocaleString(),rankTime(row.elapsed),row.retries]){const td=document.createElement('td');td.textContent=value;tr.appendChild(td);}body.appendChild(tr);
  }
  status.textContent=data.entries.length?'Top 20 completed journeys · Highest score wins.':'No completed journeys yet. Be the first to return home!';
 }catch(error){status.textContent=error.message;}
}
rankForm.addEventListener('submit',async event=>{
 event.preventDefault();if(!rankPending||!rankRunId)return;rankSave.disabled=true;rankStatus.textContent='Saving your journey…';
 try{const result=await rankRequest('/api/results',{...rankPending,runId:rankRunId,nickname:document.getElementById('rank-name').value});rankStatus.textContent='Saved! Your ranking score: '+result.score.toLocaleString()+'.';rankForm.hidden=true;await loadRanking();}
 catch(error){rankStatus.textContent=error.message;rankSave.disabled=false;}
});
document.getElementById('rank-refresh').addEventListener('click',async()=>{await rankIdentityReady;await loadRanking();});rankIdentityReady=loadRanking();
