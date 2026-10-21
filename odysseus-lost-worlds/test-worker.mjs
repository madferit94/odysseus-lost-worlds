import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import vm from 'node:vm';
import {api as rawApi,scoreRun} from './server/worker.mjs';
let cookie='';
const api=async(request,env)=>{if(cookie&&!request.headers.has('cookie'))request.headers.set('cookie',cookie);const response=await rawApi(request,env);const next=response.headers.get('set-cookie');if(next)cookie=next.split(';')[0];return response;};
const sqlite=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')))sqlite.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const env={DB:{async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.runBatch());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}},prepare(sql){let args=[];return{bind(...v){args=v;return this;},runBatch(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const r=sqlite.prepare(sql).run(...args);return{meta:{changes:Number(r.changes)}};},async all(){return{results:sqlite.prepare(sql).all(...args)};},async first(){return sqlite.prepare(sql).get(...args)||null;}};}}};
const request=(path,data)=>new Request('https://game.example'+path,data?{method:'POST',headers:{'content-type':'application/json','origin':'https://game.example'},body:JSON.stringify(data)}:{});
const result={nickname:'Hero',completed:true,normalKills:72,bossKills:4,elapsed:600,damageTaken:100,retries:1};
async function start(){const res=await api(request('/api/runs',{}),env);assert.equal(res.status,201);const {runId}=await res.json();sqlite.prepare('UPDATE runs SET started_at=? WHERE id=?').run(Math.floor(Date.now()/1000)-1000,runId);return runId;}
test('empty ranking, real migration, and score formula',async()=>{
 assert.deepEqual(await (await api(request('/api/leaderboard'),env)).json(),{entries:[],myBest:null});
 assert.deepEqual(scoreRun(result),{total:30000,combat:12000,journey:10000,speed:6000,defense:2500,penalty:500});
});
test('submit, retry safely, and ignore a forged total',async()=>{
 const runId=await start();const a=await api(request('/api/results',{...result,runId,score:999999}),env);assert.equal(a.status,200);assert.equal((await a.json()).score,30000);
 const b=await api(request('/api/results',{...result,runId,nickname:'Changed'}),env);assert.equal((await b.json()).alreadySaved,true);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM runs WHERE submitted_at IS NOT NULL').get().n,1);
});
test('reject invalid results, names and cross-origin changes',async()=>{
 const runId=await start();for(const delta of [{elapsed:1},{normalKills:999},{damageTaken:-1},{bossKills:3},{nickname:'<script>'},{elapsed:10000},{completed:false}])assert.equal((await api(request('/api/results',{...result,runId,...delta}),env)).status,400);
 const req=new Request('https://game.example/api/runs',{method:'POST',headers:{origin:'https://evil.example'}});assert.equal((await api(req,env)).status,403);
});
test('results with a JSON body that is not an object are rejected as unreadable, not as an outage',async()=>{
 const before=sqlite.prepare('SELECT count(*) n FROM runs WHERE submitted_at IS NOT NULL').get().n;
 for(const raw of ['null','42','"text"','true','[]']){
  const res=await api(new Request('https://game.example/api/results',{method:'POST',headers:{'content-type':'application/json','origin':'https://game.example'},body:raw}),env);
  assert.equal(res.status,400,raw);assert.ok((await res.json()).error,raw);
 }
 assert.equal(sqlite.prepare('SELECT count(*) n FROM runs WHERE submitted_at IS NOT NULL').get().n,before);
});
test('ranking orders by score and accepts Unicode nicknames',async()=>{
 const runId=await start();assert.equal((await api(request('/api/results',{...result,runId,nickname:'오디세우스',retries:0}),env)).status,200);
 const data=await (await api(request('/api/leaderboard'),env)).json();assert.equal(data.entries[0].nickname,'오디세우스');assert.equal(data.entries[0].score,30500);
});
test('frontend starts, saves, displays actual results and recovers network failures',async()=>{
 const els=new Map();const element=id=>{if(!els.has(id))els.set(id,{textContent:'',value:'Browser Hero',hidden:false,disabled:false,children:[],events:{},addEventListener(k,f){this.events[k]=f;},appendChild(v){this.children.push(v);},replaceChildren(){this.children=[];}});return els.get(id);};
 let offline=false;
 const ctx=vm.createContext({console,document:{getElementById:element,createElement:()=>({children:[],textContent:'',appendChild(v){this.children.push(v);}})},fetch:async(path,opts)=>{if(offline)throw Error('Offline');return api(new Request('https://game.example'+path,opts),env);}});
 vm.runInContext(fs.readFileSync('ranking.js','utf8'),ctx);await vm.runInContext('startRankRun();rankStarting',ctx);
 const runId=vm.runInContext('rankRunId',ctx);sqlite.prepare('UPDATE runs SET started_at=? WHERE id=?').run(Math.floor(Date.now()/1000)-1000,runId);
 await vm.runInContext('finishRankRun('+JSON.stringify(result)+')',ctx);assert.equal(element('rank-form').hidden,false);
 offline=true;await element('rank-form').events.submit({preventDefault(){}});assert.equal(element('rank-save').disabled,false);assert.equal(element('rank-form').hidden,false);
 offline=false;await element('rank-form').events.submit({preventDefault(){}});assert.equal(element('rank-form').hidden,true);assert.match(element('rank-status').textContent,/30,000/);assert.ok(element('rank-rows').children.length>=3);
 assert.ok(element('rank-rows').children.some(row=>row.children[1].textContent==='Browser Hero (ME)'));
});

function newVisitor(){
 let jar='';return async(path,data)=>{const req=request(path,data);if(jar)req.headers.set('cookie',jar);const res=await rawApi(req,env);const next=res.headers.get('set-cookie');if(next)jar=next.split(';')[0];return res;};
}
test('ME belongs to a browser, not a shared nickname, and survives another visit',async()=>{
 const a=newVisitor(),b=newVisitor();const first=await a('/api/leaderboard');assert.match(first.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
 const aRun=(await (await a('/api/runs',{})).json()).runId,bRun=(await (await b('/api/runs',{})).json()).runId;
 for(const id of [aRun,bRun])sqlite.prepare('UPDATE runs SET started_at=? WHERE id=?').run(Math.floor(Date.now()/1000)-1000,id);
 await a('/api/results',{...result,runId:aRun,nickname:'Same Hero',elapsed:610});
 assert.equal((await b('/api/results',{...result,runId:aRun,nickname:'Stolen'})).status,403);
 await b('/api/results',{...result,runId:bRun,nickname:'Same Hero',elapsed:620});
 const ar=await (await a('/api/leaderboard')).json(),br=await (await b('/api/leaderboard')).json();
 assert.equal(ar.entries.filter(r=>r.is_me).length,1);assert.equal(br.entries.filter(r=>r.is_me).length,1);
 assert.equal(ar.myBest.elapsed,610);assert.equal(br.myBest.elapsed,620);assert.equal((await (await a('/api/leaderboard')).json()).myBest.elapsed,610);
});
test('a personal best outside the top twenty is returned without changing the top twenty',async()=>{
 const c=newVisitor();const id=(await (await c('/api/runs',{})).json()).runId;
 sqlite.prepare('UPDATE runs SET started_at=? WHERE id=?').run(Math.floor(Date.now()/1000)-1000,id);
 await c('/api/results',{...result,runId:id,nickname:'My Low Score',retries:50});
 for(let i=0;i<25;i++)sqlite.prepare('INSERT INTO runs (id,started_at,submitted_at,nickname,score,elapsed,retries) VALUES (?,?,?,?,?,?,?)').run('test-only-'+i,1,2,'Fixture '+i,40000,200+i,0);
 const data=await (await c('/api/leaderboard')).json();assert.equal(data.entries.length,20);assert.ok(data.myBest.rank>20);assert.equal(data.myBest.is_me,1);
 assert.equal(data.entries.filter(r=>r.is_me).length,0);
});


test('views start at zero, reads do not increment, retries are idempotent across visitors',async()=>{
 const empty=await rawApi(request('/api/views'),env);assert.equal(empty.status,200);assert.equal(empty.headers.get('set-cookie'),null);
 assert.deepEqual(await empty.json(),{views:0,since:'2026-09-11'});
 const pageId=crypto.randomUUID();
 for(const id of [pageId,pageId,pageId.toUpperCase()])assert.equal((await (await rawApi(request('/api/views',{pageId:id}),env)).json()).views,1);
 assert.equal((await (await rawApi(request('/api/views'),env)).json()).views,1);
 assert.equal((await (await rawApi(request('/api/views',{pageId:crypto.randomUUID()}),env)).json()).views,2);
});
test('views reject invalid bodies and cross-origin writes without modifying rankings',async()=>{
 const before=sqlite.prepare('SELECT count(*) n FROM page_views').get().n,ranking=sqlite.prepare('SELECT count(*) n FROM runs').get().n;
 for(const data of [{},{pageId:'bad'},{pageId:1},{pageId:"'); DELETE FROM runs; --"}])assert.equal((await rawApi(request('/api/views',data),env)).status,400);
 const foreign=request('/api/views',{pageId:crypto.randomUUID()});foreign.headers.set('origin','https://evil.example');assert.equal((await rawApi(foreign,env)).status,403);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM page_views').get().n,before);assert.equal(sqlite.prepare('SELECT count(*) n FROM runs').get().n,ranking);
});
test('simultaneous view retries count a page once; separate page loads each count',async()=>{
 const before=sqlite.prepare('SELECT count(*) n FROM page_views').get().n,ids=Array.from({length:5},()=>crypto.randomUUID());
 const replies=await Promise.all(Array.from({length:20},(_,i)=>rawApi(request('/api/views',{pageId:ids[i%ids.length]}),env)));
 assert.ok(replies.every(r=>r.status===200));assert.equal((await (await rawApi(request('/api/views'),env)).json()).views,before+5);
});
test('view display recovers a lost response without double counting and translates labels',async()=>{
 const before=sqlite.prepare('SELECT count(*) n FROM page_views').get().n,els=new Map(),el=id=>{if(!els.has(id))els.set(id,{textContent:''});return els.get(id);};let loseResponse=true;
 const ctx=vm.createContext({console,crypto,controlLanguage:'en',document:{getElementById:el},fetch:async(path,opts)=>{const response=await rawApi(new Request('https://game.example'+path,opts),env);if(loseResponse)throw Error('Lost response');return response;}});
 vm.runInContext(fs.readFileSync('views.js','utf8'),ctx);await vm.runInContext('pageViewsLoading',ctx);
 assert.equal(el('site-views').textContent,'Retry views');assert.equal(el('site-views').disabled,false);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM page_views').get().n,before+1);
 loseResponse=false;await el('site-views').onclick();assert.equal(sqlite.prepare('SELECT count(*) n FROM page_views').get().n,before+1);
 assert.match(el('site-views').textContent,/Views: /);vm.runInContext("controlLanguage='ko';refreshViewsLabel()",ctx);assert.match(el('site-views').textContent,/조회수:/);assert.match(el('views-note').textContent,/2026.09.11/);
 await el('site-views').onclick();assert.equal(sqlite.prepare('SELECT count(*) n FROM page_views').get().n,before+1);
});
test('unavailable view storage returns an error instead of a fabricated count',async()=>{
 const response=await rawApi(request('/api/views'),{});assert.equal(response.status,503);const data=await response.json();assert.equal(data.views,undefined);assert.match(data.error,/Views are temporarily unavailable/);
});

// ---- Ranking protection ------------------------------------------------------
import {MIN_PLAUSIBLE_ELAPSED_SECONDS,CLOCK_TOLERANCE_SECONDS,checkPlausibility} from './server/protection.mjs';
import {checkNickname,normalizeNickname} from './server/nickname.mjs';
const nowSeconds=()=>Math.floor(Date.now()/1000);
let address=0;
function visitor(){
 const ip='198.51.100.'+(++address);let jar='';
 return async(path,data,headers={})=>{const req=request(path,data);req.headers.set('cf-connecting-ip',ip);for(const [k,v] of Object.entries(headers))v===null?req.headers.delete(k):req.headers.set(k,v);if(jar)req.headers.set('cookie',jar);const res=await rawApi(req,env);const next=res.headers.get('set-cookie');if(next)jar=next.split(';')[0];return res;};
}
async function runStartedAgo(v,seconds){const {runId}=await (await v('/api/runs',{})).json();sqlite.prepare('UPDATE runs SET started_at=? WHERE id=?').run(nowSeconds()-seconds,runId);return runId;}
const submitted=id=>sqlite.prepare('SELECT submitted_at FROM runs WHERE id=?').get(id)?.submitted_at??null;
// Values produced by the game's own code: test-plausibility.mjs bot runs and its realistic fixture.
const botRun={completed:true,normalKills:73,bossKills:4,damageTaken:185,retries:0,elapsed:175};

test('a forged maximum score is rejected with 422 and never ranked',async()=>{
 const v=visitor(),forged={nickname:'Speedy',completed:true,elapsed:60,normalKills:74,bossKills:4,damageTaken:0,retries:0};
 assert.equal(scoreRun(forged).total,32280);
 for(const age of [55,1000]){
  const runId=await runStartedAgo(v,age),res=await v('/api/results',{...forged,runId}),data=await res.json();
  assert.equal(res.status,422);assert.equal(data.code,'implausible_time');assert.match(data.error,/not ranked/);assert.equal(submitted(runId),null);
 }
 const board=await (await v('/api/leaderboard')).json();assert.ok(!board.entries.some(r=>r.nickname==='Speedy'));
});
test('realistic results from the game code are accepted, including one exactly at the floor',async()=>{
 const v=visitor();
 for(const [age,r] of [[180,botRun],[1000,{...result,completed:true}],[MIN_PLAUSIBLE_ELAPSED_SECONDS,{completed:true,normalKills:74,bossKills:4,damageTaken:0,retries:0,elapsed:MIN_PLAUSIBLE_ELAPSED_SECONDS}],[2400,{completed:true,normalKills:72,bossKills:4,damageTaken:1450,retries:2,elapsed:2100}]]){
  const runId=await runStartedAgo(v,age),res=await v('/api/results',{...r,nickname:'Real Hero',runId});
  assert.equal(res.status,200,JSON.stringify(r));assert.equal((await res.json()).score,scoreRun(r).total);assert.notEqual(submitted(runId),null);
 }
});
test('reported play time must agree with the server clock',async()=>{
 const v=visitor();
 let runId=await runStartedAgo(v,200),res=await v('/api/results',{...botRun,nickname:'Clock',runId,elapsed:200+CLOCK_TOLERANCE_SECONDS+1});
 assert.equal(res.status,400);assert.equal((await res.json()).code,'clock_mismatch');assert.equal(submitted(runId),null);
 res=await v('/api/results',{...botRun,nickname:'Clock',runId,elapsed:200+CLOCK_TOLERANCE_SECONDS});assert.equal(res.status,200);
 // Server time far shorter than any real journey: rejected even if the reported time is long enough.
 runId=await runStartedAgo(v,40);res=await v('/api/results',{...botRun,nickname:'Clock',runId,elapsed:120});assert.equal(res.status,400);assert.equal(submitted(runId),null);
 assert.equal(checkPlausibility({...botRun,elapsed:120},40).code,'implausible_time');
 assert.equal(checkPlausibility(botRun,MIN_PLAUSIBLE_ELAPSED_SECONDS-CLOCK_TOLERANCE_SECONDS-1).code,'implausible_time');
});
test('impossible kill, boss and retry combinations are rejected',async()=>{
 const v=visitor();
 for(const delta of [{normalKills:75},{normalKills:71},{bossKills:5},{bossKills:3}]){
  const runId=await runStartedAgo(v,1000),res=await v('/api/results',{...botRun,...delta,nickname:'Counts',runId});
  assert.equal(res.status,400,JSON.stringify(delta));assert.equal(submitted(runId),null);
 }
 for(const delta of [{retries:1,damageTaken:0},{retries:2,damageTaken:99}]){
  const runId=await runStartedAgo(v,1000),res=await v('/api/results',{...botRun,...delta,nickname:'Counts',runId});
  assert.equal(res.status,422,JSON.stringify(delta));assert.equal((await res.json()).code,'impossible_result');assert.equal(submitted(runId),null);
 }
 for(const delta of [{normalKills:75},{bossKills:5},{bossKills:3}])assert.equal(checkPlausibility({...botRun,...delta},1000).code,'impossible_result');
 assert.equal(checkPlausibility({...botRun,retries:1,damageTaken:100},1000),null);
});
test('nicknames are normalised, filtered for abuse and look-alikes, and saved clean',async()=>{
 assert.equal(normalizeNickname('  Ｈｅｒｏ   of\tTroy '),'Hero of Troy');assert.equal(normalizeNickname('ㅋㅋ왕'),'ㅋㅋ왕');
 for(const name of ['Admin','admin01','ADM1N','4dmin','Game Admin','운영자','게임관리자','Odysseus','0dysseus','SYSTEM','Moderator','ѕуѕтем'])assert.equal(checkNickname(name).code,'nickname_reserved',name);
 for(const name of ['fuck','F.u.C.k','FuuuCK','sh1t','씨발','ㅅㅂ','병신아','tlqkf','Dick'])assert.equal(checkNickname(name).code,'nickname_blocked',name);
 for(const name of ['Hеro','аdmin','Ηero'])assert.equal(checkNickname(name).code,'nickname_mixed_script',name);
 for(const name of ['<b>x</b>','','x'.repeat(17),'a​b'])assert.equal(checkNickname(name).code,'nickname_format',name);
 for(const name of ['Hero','오디세우스','Badminton','Dickens','Nigeria','시발점','Привет','김민수Kim','Hero_1.0-a'])assert.equal(checkNickname(name).nickname,name,name);
 const v=visitor();
 let runId=await runStartedAgo(v,1000);const saved=await v('/api/results',{...botRun,runId,nickname:'  Ｓｅａ   Ｗａｎｄｅｒｅｒ  '});assert.equal(saved.status,200);
 assert.equal(sqlite.prepare('SELECT nickname FROM runs WHERE id=?').get(runId).nickname,'Sea Wanderer');
 for(const [nickname,code] of [['Adm1n','nickname_reserved'],['씨발','nickname_blocked'],['Hеro','nickname_mixed_script']]){
  runId=await runStartedAgo(v,1000);const res=await v('/api/results',{...botRun,runId,nickname});const data=await res.json();
  assert.equal(res.status,400);assert.equal(data.code,code);assert.ok(data.error);assert.equal(submitted(runId),null);
 }
});
