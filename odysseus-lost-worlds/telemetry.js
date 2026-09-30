// Opt-in analytics. Queues and write credentials live only in this page's memory.
const telemetry=(()=>{
 const panel=document.createElement('section');panel.className='analytics-panel';panel.setAttribute('aria-label','Optional play analytics');
 panel.innerHTML='<label><input id="analytics-consent" type="checkbox"><span id="analytics-label"></span></label><span id="analytics-status" role="status"></span><details><summary id="analytics-details-title"></summary><p id="analytics-details"></p></details>';
 document.querySelector('.play-layout').before(panel);
 const consent=document.getElementById('analytics-consent'),status=document.getElementById('analytics-status');
 const query=new URLSearchParams(location.search),testMode=query.get('test')==='1';
 const sourceAliases={twitter:'x',x:'x',reddit:'reddit',linkedin:'linkedin',itch:'itch','itch.io':'itch'};
 const rawSource=(query.get('utm_source')||'').toLowerCase();
 const source=rawSource?(sourceAliases[rawSource]||'other'):'direct';
 let current=null,lastState='off',retryTimer=null;
 const pending=new Set();
 function display(){
  const ko=typeof controlLanguage!=='undefined'&&controlLanguage==='ko';
  document.getElementById('analytics-label').textContent=ko?'플레이 기록 분석에 참여 (선택)':'Share play events for analysis (optional)';
  document.getElementById('analytics-details-title').textContent=ko?'수집 항목과 보관 안내':'What is collected';
  document.getElementById('analytics-details').textContent=ko?'선택한 다음 새 게임을 시작하면 난이도·진행·보스전·사망·필살기·플레이 시간과 유입 분류를 수집합니다. 이름·이메일·IP·전체 유입 주소는 분석 표에 저장하지 않습니다. 게임마다 새 임의 번호를 사용합니다. 해제하면 이후 수집을 멈춥니다. 기존 기록은 90일 분석 대상이며, 90일이 지난 원본은 다음 수집 요청 때 정리합니다. 원본은 운영자만 조회하며 포트폴리오에는 합계만 사용합니다. 기존 조회수와 선택한 순위 등록은 별개이고, 호스팅 서비스의 접속 기록은 이 선택과 별개입니다.':'Opt in before starting a new game. We collect difficulty, progress, boss attempts, deaths, finishers, active play time and a source category. No name, email, IP or full referring URL is stored in analytics. Each journey gets a random ID. Uncheck to stop future collection. Records are used for 90 days; older raw records are removed on subsequent collection requests. Only the operator can read raw events; portfolio results use aggregates. Existing page counts, optional rankings and hosting access logs are separate.';
  const labels=ko?{off:'분석 수집 꺼짐 · 게임 이용 가능',next:'다음 새 게임부터 수집합니다',sending:'기록 전송 중',saved:'기록 저장 확인됨',retry:'연결 지연 · 자동 재시도 중',stopped:'수집 중지 · 이 게임은 더 이상 기록하지 않습니다',limit:'기록 한도 도달 · 게임은 계속됩니다'}:{off:'Analytics off · game available',next:'Will record your next new game',sending:'Sending play events',saved:'Play events saved',retry:'Connection delayed · retrying',stopped:'Collection stopped for this journey',limit:'Recording limit reached · game continues'};
  status.textContent=(testMode?(ko?'테스트 모드 · ':'TEST MODE · '):'')+labels[lastState];
 }
 function setStatus(s){lastState=s;display();}
 async function post(path,payload){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{const res=await fetch(path,{method:'POST',credentials:'omit',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:controller.signal,keepalive:true});if(!res.ok){const error=Error('recording');error.permanent=res.status>=400&&res.status<500&&![408,429].includes(res.status);throw error;}return await res.json();}finally{clearTimeout(timer);}
 }
 function flush(run=current){if(!run)return Promise.resolve();if(run.busy)return run.flight;run.flight=transmit(run);return run.flight;}
 async function transmit(run){
  if(!run||run.cancelled||run.busy||!run.queue.length)return;
  run.busy=true;if(run===current)setStatus('sending');
  try{
   if(!run.started){await post('/api/telemetry/start',run.meta);run.started=true;}
   if(run.cancelled)return;
   while(run.queue.length&&!run.cancelled){const batch=run.queue.slice(0,10);const response=await post('/api/telemetry/events',{id:run.meta.id,token:run.meta.token,events:batch});if(!Array.isArray(response.accepted)||batch.some(e=>!response.accepted.includes(e.seq)))throw Error('acknowledgement');run.queue.splice(0,batch.length);}
   run.failures=0;if(run===current&&!run.cancelled)setStatus('saved');
   if(run!==current&&!run.queue.length)pending.delete(run);
  }catch(error){run.failures++;if(error.permanent){run.cancelled=true;run.queue=[];pending.delete(run);}if(run===current&&!run.cancelled)setStatus('retry');else if(run===current)setStatus('stopped');}
  finally{run.busy=false;schedule();}
 }
 function schedule(){
  clearTimeout(retryTimer);const runs=[...pending].filter(r=>!r.cancelled&&r.queue.length);if(!runs.length)return;
  retryTimer=setTimeout(()=>{for(const run of runs)flush(run);},Math.min(30000,2000*2**Math.min(4,Math.max(...runs.map(r=>r.failures)))));
 }
 function begin(difficulty){
  if(current)flush(current);current=null;
  if(!consent.checked){setStatus('off');return;}
  current={meta:{id:crypto.randomUUID(),token:crypto.randomUUID()+crypto.randomUUID(),consent:true,version:'v16',difficulty,source,isTest:testMode},queue:[],seq:0,started:false,busy:false,cancelled:false,failures:0};pending.add(current);setStatus('sending');
 }
 function emit(name,snapshot,extra={}){
  if(!current||current.cancelled||!consent.checked)return;
  if(current.seq>=2000||current.queue.length>=500){setStatus('limit');return;}
  current.queue.push({...snapshot,god:'',boss:'',outcome:'',durationMs:0,...extra,name,seq:current.seq++});schedule();
  if(['game_over','game_clear','collection_stop'].includes(name))flush(current);
 }
 consent.addEventListener('change',()=>{
  if(!consent.checked){for(const run of pending){run.cancelled=true;run.queue=[];}pending.clear();current=null;clearTimeout(retryTimer);setStatus('stopped');}
  else setStatus('next');
 });
 window.addEventListener('online',()=>{for(const run of pending)flush(run);});
 // Hidden is not equivalent to quitting: terminal outcomes require explicit game events.
 display();return {begin,emit,flush,display,testMode};
})();
