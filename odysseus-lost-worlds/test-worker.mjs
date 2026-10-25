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
 const ctx=vm.createContext({console,crypto,controlLanguage:'en',document:{getElementById:el},fetch:async(path,opts)=>{const response=await rawApi(new Request('https://game.example'+path,{...opts,headers:{...opts.headers,origin:'https://game.example'}}),env);if(loseResponse)throw Error('Lost response');return response;}});
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
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {RATE_LIMITS,UNKNOWN_CLIENT_MULTIPLIER,MAX_TRACKED_CLIENTS,MIN_PLAUSIBLE_ELAPSED_SECONDS,CLOCK_TOLERANCE_SECONDS,UNSUBMITTED_RUN_TTL_SECONDS,checkPlausibility,rateLimit,trackedClients,resetProtectionState} from './server/protection.mjs';
import {checkNickname,normalizeNickname} from './server/nickname.mjs';
const nowSeconds=()=>Math.floor(Date.now()/1000);
// Each protection test uses its own client address so rate limits do not leak between tests.
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
test('each write endpoint has a per-address limit with 429 and Retry-After',async()=>{
 resetProtectionState();
 const calls={runs:v=>v('/api/runs',{}),results:v=>v('/api/results',{runId:'bad'}),views:v=>v('/api/views',{pageId:crypto.randomUUID()}),telemetryStart:v=>v('/api/telemetry/start',{}),telemetryEvents:v=>v('/api/telemetry/events',{})};
 for(const [name,call] of Object.entries(calls)){
  const v=visitor(),{limit,windowSeconds}=RATE_LIMITS[name];
  for(let i=0;i<limit;i++)assert.notEqual((await call(v)).status,429,name+' request '+(i+1));
  const res=await call(v),data=await res.json(),wait=Number(res.headers.get('retry-after'));
  assert.equal(res.status,429,name);assert.equal(data.code,'rate_limited');assert.ok(Number.isInteger(wait)&&wait>=1&&wait<=windowSeconds,name+' Retry-After '+wait);assert.equal(data.retryAfter,wait);
  assert.notEqual((await call(visitor())).status,429,name+' other address');
 }
 // GET requests are not limited.
 const v=visitor();for(let i=0;i<RATE_LIMITS.runs.limit;i++)await v('/api/runs',{});assert.equal((await v('/api/leaderboard')).status,200);
 resetProtectionState();
});
test('rate limit windows expire, unknown addresses share a larger bucket, and memory stays bounded',()=>{
 resetProtectionState();const t=1_000_000_000_000,{limit,windowSeconds}=RATE_LIMITS.results;
 for(let i=0;i<limit;i++)assert.equal(rateLimit('results','a',t),null);
 assert.equal(rateLimit('results','a',t),windowSeconds);assert.equal(rateLimit('results','a',t+windowSeconds*1000-1500),2);
 assert.equal(rateLimit('results','a',t+windowSeconds*1000),null);
 for(let i=0;i<limit*UNKNOWN_CLIENT_MULTIPLIER;i++)assert.equal(rateLimit('results',null,t),null);assert.ok(rateLimit('results',null,t)>0);
 for(let i=0;i<MAX_TRACKED_CLIENTS+50;i++)rateLimit('views','10.0.'+i,t);assert.ok(trackedClients('views')<=MAX_TRACKED_CLIENTS);
 resetProtectionState();
});
test('starting a journey purges old unsubmitted runs at most once per interval',async()=>{
 resetProtectionState();const now=nowSeconds(),old=now-UNSUBMITTED_RUN_TTL_SECONDS-60;
 const insert=(id,started,submittedAt=null)=>sqlite.prepare('INSERT INTO runs (id,started_at,submitted_at,nickname,score,elapsed,retries) VALUES (?,?,?,?,?,?,?)').run(id,started,submittedAt,submittedAt?'Kept':null,submittedAt?20000:null,submittedAt?600:null,submittedAt?0:null);
 insert('purge-old',old);insert('purge-recent',now-3600);insert('purge-submitted',old-86400,old);
 const v=visitor();assert.equal((await v('/api/runs',{})).status,201);
 const ids=()=>sqlite.prepare("SELECT id FROM runs WHERE id LIKE 'purge-%' ORDER BY id").all().map(r=>r.id);
 assert.deepEqual(ids(),['purge-recent','purge-submitted']);
 insert('purge-old-2',old);assert.equal((await v('/api/runs',{})).status,201);assert.ok(ids().includes('purge-old-2'),'second purge waits for the interval');
 sqlite.prepare("DELETE FROM runs WHERE id LIKE 'purge-%'").run();resetProtectionState();
});
test('views count only requests that a browser marks as same-site',async()=>{
 const count=()=>sqlite.prepare('SELECT count(*) n FROM page_views').get().n,v=visitor(),before=count();
 let res=await v('/api/views',{pageId:crypto.randomUUID()},{origin:null});let data=await res.json();
 assert.equal(res.status,200);assert.equal(data.counted,false);assert.equal(data.views,before);assert.equal(count(),before);
 res=await v('/api/views',{pageId:crypto.randomUUID()},{origin:null,'sec-fetch-site':'cross-site'});assert.equal(res.status,403);
 res=await v('/api/views',{pageId:crypto.randomUUID()},{'sec-fetch-site':'cross-site'});assert.equal(res.status,403);
 res=await v('/api/views',{pageId:crypto.randomUUID()},{origin:null,'sec-fetch-site':'same-origin'});assert.equal(res.status,200);assert.equal(count(),before+1);
 res=await v('/api/views',{pageId:crypto.randomUUID()},{'sec-fetch-site':'same-origin'});assert.equal((await res.json()).views,before+2);
});
test('admin removal tool lists matches as a dry run and deletes only with --confirm',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'odysseus-admin-')),file=path.join(dir,'ranking.sqlite');
 try{
  const db=new DatabaseSync(file);for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
  const add=db.prepare('INSERT INTO runs (id,started_at,submitted_at,nickname,score,elapsed,normal_kills,boss_kills,damage_taken,retries) VALUES (?,?,?,?,?,?,?,?,?,?)');
  add.run('aaaaaaaa-0000-4000-8000-000000000001',1,2,'Cheater',32280,60,74,4,0,0);add.run('aaaaaaaa-0000-4000-8000-000000000002',1,3,'cheater',32000,61,74,4,0,0);
  add.run('aaaaaaaa-0000-4000-8000-000000000003',1,4,'Hero',30000,600,72,4,100,1);db.close();
  const tool=(...args)=>spawnSync(process.execPath,['admin-remove-run.mjs',...args],{encoding:'utf8'});
  const left=()=>{const d=new DatabaseSync(file);try{return d.prepare('SELECT nickname FROM runs ORDER BY id').all().map(r=>r.nickname);}finally{d.close();}};
  let out=tool('--db',file,'--nickname','  CHEATER ');assert.equal(out.status,0,out.stderr);
  assert.match(out.stdout,/2 matching row/);assert.match(out.stdout,/score=32280/);assert.match(out.stdout,/Dry run: nothing was deleted/);assert.deepEqual(left(),['Cheater','cheater','Hero']);
  out=tool('--db',file,'--nickname','Cheater','--confirm');assert.equal(out.status,0,out.stderr);assert.match(out.stdout,/Deleted 2 row/);assert.deepEqual(left(),['Hero']);
  out=tool('--db',file,'--run','aaaaaaaa-0000-4000-8000-000000000003');assert.match(out.stdout,/1 matching row/);assert.deepEqual(left(),['Hero']);
  out=tool('--db',file,'--run','aaaaaaaa-0000-4000-8000-000000000003','--confirm');assert.match(out.stdout,/Deleted 1 row/);assert.deepEqual(left(),[]);
  // Live database: works from an owner snapshot and prints the statement instead of deleting.
  const snapshot=path.join(dir,'runs.json');fs.writeFileSync(snapshot,JSON.stringify({complete:true,runs:[{id:'bbbbbbbb-0000-4000-8000-000000000001',nickname:'Cheater',score:32280}]}));
  out=tool('--snapshot',snapshot,'--nickname','cheater','--confirm');assert.equal(out.status,0,out.stderr);assert.match(out.stdout,/DELETE FROM runs WHERE id IN \('bbbbbbbb-0000-4000-8000-000000000001'\);/);assert.match(out.stdout,/Nothing was deleted locally/);
  assert.notEqual(tool('--db',file).status,0);assert.notEqual(tool('--db',file,'--run',"x' OR 1=1 --").status,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('ranking page explains rejected results, nickname refusals and busy limits',async()=>{
 const els=new Map();const element=id=>{if(!els.has(id))els.set(id,{textContent:'',value:'Hero',hidden:false,disabled:false,children:[],events:{},addEventListener(k,f){this.events[k]=f;},appendChild(v){this.children.push(v);},replaceChildren(){this.children=[];}});return els.get(id);};
 let reply=null;const v=visitor();
 const ctx=vm.createContext({console,document:{getElementById:element,createElement:()=>({children:[],textContent:'',appendChild(c){this.children.push(c);}})},fetch:async(p,opts)=>reply&&p==='/api/results'?reply():v(p,opts?.body?JSON.parse(opts.body):undefined)});
 vm.runInContext(fs.readFileSync('ranking.js','utf8'),ctx);await vm.runInContext('rankIdentityReady',ctx);
 const finish=async(r)=>{await vm.runInContext('startRankRun();rankStarting',ctx);sqlite.prepare('UPDATE runs SET started_at=? WHERE id=?').run(nowSeconds()-1000,vm.runInContext('rankRunId',ctx));await vm.runInContext('finishRankRun('+JSON.stringify(r)+')',ctx);};
 const submit=()=>element('rank-form').events.submit({preventDefault(){}});
 await finish({...botRun,elapsed:60});await submit();
 assert.match(element('rank-status').textContent,/faster than a real journey.*not ranked/);assert.equal(element('rank-form').hidden,true);
 await finish(botRun);element('rank-name').value='Adm1n';await submit();
 assert.match(element('rank-status').textContent,/reserved/);assert.equal(element('rank-form').hidden,false);assert.equal(element('rank-save').disabled,false);
 reply=()=>new Response(JSON.stringify({error:'busy',code:'rate_limited',retryAfter:42}),{status:429,headers:{'content-type':'application/json','retry-after':'42'}});
 await submit();assert.match(element('rank-status').textContent,/wait 42 seconds/);assert.equal(element('rank-form').hidden,false);assert.equal(element('rank-save').disabled,false);
 reply=null;element('rank-name').value='Sea Wanderer';await submit();assert.match(element('rank-status').textContent,/Saved!/);
});

// ---- Per-difficulty rankings (v18) -------------------------------------------
import {RANK_DIFFICULTIES} from './server/worker.mjs';
async function startOn(v,difficulty,ago=1000){const res=await v('/api/runs',difficulty===undefined?{}:{difficulty});assert.equal(res.status,201);const data=await res.json();sqlite.prepare('UPDATE runs SET started_at=? WHERE id=?').run(nowSeconds()-ago,data.runId);return data;}
const board=async(v,difficulty)=>{const res=await v('/api/leaderboard'+(difficulty?'?difficulty='+difficulty:''));assert.equal(res.status,200);return res.json();};
const storedDifficulty=id=>sqlite.prepare('SELECT difficulty FROM runs WHERE id=?').get(id).difficulty;

test('the migration only adds a difficulty column and index to runs',()=>{
 const columns=sqlite.prepare('PRAGMA table_info(runs)').all().map(c=>c.name);
 assert.deepEqual(columns,['id','started_at','submitted_at','nickname','score','elapsed','normal_kills','boss_kills','damage_taken','retries','player_key','difficulty']);
 assert.equal(sqlite.prepare('PRAGMA table_info(runs)').all().find(c=>c.name==='difficulty').notnull,0);
 assert.ok(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='runs'").all().some(i=>i.name==='idx_runs_difficulty_ranking'));
 assert.deepEqual([...RANK_DIFFICULTIES],['ithaca','aegean','trial','wrath']);
});
test('a ranking entry keeps the difficulty its journey was started with',async()=>{
 const v=visitor(),started=await startOn(v,'trial');assert.equal(started.difficulty,'trial');assert.equal(storedDifficulty(started.runId),'trial');
 // The result claims another difficulty; the run-start record decides.
 const res=await v('/api/results',{...botRun,runId:started.runId,nickname:'Trial Hero',difficulty:'ithaca'}),data=await res.json();
 assert.equal(res.status,200);assert.equal(data.difficulty,'trial');assert.equal(data.score,scoreRun(botRun).total);assert.equal(storedDifficulty(started.runId),'trial');
 assert.ok((await board(v,'trial')).entries.some(r=>r.nickname==='Trial Hero'&&r.difficulty==='trial'&&r.is_me===1));
 assert.ok(!(await board(v,'ithaca')).entries.some(r=>r.nickname==='Trial Hero'));
 // Re-sending the saved result with yet another difficulty changes nothing.
 const again=await (await v('/api/results',{...botRun,runId:started.runId,nickname:'Trial Hero',difficulty:'wrath'})).json();
 assert.equal(again.alreadySaved,true);assert.equal(again.difficulty,'trial');assert.equal(storedDifficulty(started.runId),'trial');
});
test('each difficulty board lists only its own runs, with its own ranks and personal best',async()=>{
 const v=visitor(),scores={};
 for(const [i,difficulty] of RANK_DIFFICULTIES.entries()){
  const {runId}=await startOn(v,difficulty),r={...botRun,elapsed:300+i*10};scores[difficulty]=scoreRun(r).total;
  assert.equal((await v('/api/results',{...r,runId,nickname:'Board '+difficulty})).status,200);
 }
 for(const difficulty of RANK_DIFFICULTIES){
  const data=await board(v,difficulty);assert.equal(data.difficulty,difficulty);
  assert.ok(data.entries.every(r=>r.difficulty===difficulty),difficulty);assert.ok(data.entries.length<=20);
  assert.deepEqual(data.entries.filter(r=>r.nickname.startsWith('Board ')).map(r=>r.nickname),['Board '+difficulty]);
  assert.equal(data.entries[0].rank,1);assert.equal(data.myBest.difficulty,difficulty);assert.equal(data.myBest.score,scores[difficulty]);
 }
});
test('unknown difficulties are refused when a journey starts and when a board is requested',async()=>{
 const v=visitor(),before=sqlite.prepare('SELECT count(*) n FROM runs').get().n;
 for(const difficulty of ['nightmare','EASY','legacy','',1,true,['trial'],{}]){
  const res=await v('/api/runs',{difficulty});assert.equal(res.status,400,JSON.stringify(difficulty));assert.equal((await res.json()).code,'invalid_difficulty');
 }
 assert.equal(sqlite.prepare('SELECT count(*) n FROM runs').get().n,before);
 for(const query of ['nightmare','',"aegean' OR 1=1 --",'Aegean']){const res=await v('/api/leaderboard?difficulty='+encodeURIComponent(query));assert.equal(res.status,400,query);assert.equal((await res.json()).code,'invalid_difficulty');}
});
test('rows saved before v18 are listed only as earlier records; the old request shape still works',async()=>{
 const v=visitor(),now=nowSeconds();
 // A row as stored by v17: no difficulty column value.
 sqlite.prepare('INSERT INTO runs (id,started_at,submitted_at,nickname,score,elapsed,normal_kills,boss_kills,damage_taken,retries) VALUES (?,?,?,?,?,?,?,?,?,?)').run('legacy-v17-row',now-5000,now-4000,'Old Sailor',60000,500,74,4,0,0);
 sqlite.prepare('INSERT INTO runs (id,started_at,submitted_at,nickname,score,elapsed,retries,difficulty) VALUES (?,?,?,?,?,?,?,?)').run('legacy-v18-row',now-5000,now-4000,'New Sailor',59000,500,0,'wrath');
 const legacy=await board(v,'legacy');assert.equal(legacy.difficulty,'legacy');assert.equal(legacy.entries[0].nickname,'Old Sailor');assert.equal(legacy.entries[0].difficulty,null);
 assert.ok(legacy.entries.every(r=>r.difficulty===null));
 for(const difficulty of RANK_DIFFICULTIES)assert.ok(!(await board(v,difficulty)).entries.some(r=>r.nickname==='Old Sailor'),difficulty);
 // A page from before v18 asks without a parameter and gets the combined list in the old shape.
 const combined=await board(v);assert.deepEqual(Object.keys(combined),['entries','myBest']);assert.deepEqual(combined.entries.slice(0,2).map(r=>[r.nickname,r.difficulty]),[['Old Sailor',null],['New Sailor','wrath']]);
 // A journey started by an old page (no difficulty) is not guessed into a difficulty board.
 const old=await startOn(v);assert.equal(old.difficulty,null);
 const saved=await (await v('/api/results',{...botRun,runId:old.runId,nickname:'Stale Tab',difficulty:'wrath'})).json();assert.equal(saved.difficulty,null);
 assert.equal((await board(v,'legacy')).myBest.nickname,'Stale Tab');const wrath=await board(v,'wrath');assert.equal(wrath.myBest,null);assert.ok(!wrath.entries.some(r=>r.nickname==='Stale Tab'));
 sqlite.prepare("DELETE FROM runs WHERE id IN ('legacy-v17-row','legacy-v18-row')").run();
});

// ---- Ranking page: difficulty tabs (v18) --------------------------------------
function rankingPage({selected='aegean',language}={}){
 const els=new Map(),requests=[],v=visitor();
 const element=id=>{if(!els.has(id))els.set(id,{id,textContent:'',value:'Tab Hero',hidden:false,disabled:false,children:[],events:{},attributes:{},className:'',
  setAttribute(k,val){this.attributes[k]=String(val);},getAttribute(k){return this.attributes[k]??null;},addEventListener(k,f){this.events[k]=f;},appendChild(c){this.children.push(c);},replaceChildren(){this.children=[];}});return els.get(id);};
 const DIFFICULTIES=Object.fromEntries(RANK_DIFFICULTIES.map(id=>[id,{ko:id,en:id,levelKo:id,levelEn:id}]));
 const ctx=vm.createContext({console,muted:false,state:'title',DIFFICULTIES,selectedDifficulty:selected,runDifficulty:selected,
  document:{getElementById:element,createElement:()=>({children:[],textContent:'',appendChild(c){this.children.push(c);}})},
  fetch:async(p,opts)=>{requests.push({path:p,body:opts?.body?JSON.parse(opts.body):undefined});return v(p,opts?.body?JSON.parse(opts.body):undefined);}});
 // Same order as index.html: ui.js (language, difficulty picker) before ranking.js.
 vm.runInContext(fs.readFileSync('ui.js','utf8'),ctx);if(language)vm.runInContext("controlLanguage='"+language+"'",ctx);
 vm.runInContext(fs.readFileSync('ranking.js','utf8'),ctx);
 const pressed=()=>['ithaca','aegean','trial','wrath','legacy'].filter(id=>element('rank-tab-'+id).getAttribute('aria-pressed')==='true');
 return {ctx,el:element,requests,pressed,run:s=>vm.runInContext(s,ctx),boards:()=>requests.filter(r=>r.path.startsWith('/api/leaderboard')).map(r=>r.path.split('=')[1])};
}
test('index.html has five keyboard-usable ranking tabs in a labelled group',()=>{
 const html=fs.readFileSync('index.html','utf8'),group=html.match(/<div id="rank-tabs"[^>]*>(.*?)<\/div>/)?.[0];
 assert.ok(group,'tab group exists');assert.match(group,/role="group"/);assert.match(group,/aria-label="Rankings by difficulty"/);
 const buttons=[...group.matchAll(/<button id="rank-tab-(\w+)"([^>]*)>([^<]+)<\/button>/g)];
 assert.deepEqual(buttons.map(b=>b[1]),['ithaca','aegean','trial','wrath','legacy']);
 for(const b of buttons){assert.match(b[2],/type="button"/);assert.match(b[2],/aria-pressed="(true|false)"/);assert.match(b[2],/aria-controls="rank-rows"/);}
 assert.equal(buttons.filter(b=>/aria-pressed="true"/.test(b[2])).map(b=>b[1]).join(),'aegean');
 // Narrow screens: tabs wrap (two per row at 390px) instead of overflowing the page.
 assert.match(html,/\.rank-tabs\{display:flex;flex-wrap:wrap;[^}]*\}/);assert.match(html,/\.rankings \.rank-tab\{flex:1 1 150px;min-width:0;[^}]*white-space:normal/);
 assert.doesNotMatch(html,/All difficulties currently share one ranking/);
});
test('ranking tabs open on the selected difficulty, switch boards and follow the page language',async()=>{
 const page=rankingPage({selected:'trial'});await page.run('rankIdentityReady');
 assert.deepEqual(page.pressed(),['trial']);assert.deepEqual(page.boards(),['trial']);
 assert.equal(page.el('rank-tab-wrath').textContent,'POSEIDON’S WRATH · EXTREME');assert.equal(page.el('rank-tab-legacy').textContent,'Earlier records (before difficulty split)');
 await page.el('rank-tab-wrath').onclick();assert.deepEqual(page.pressed(),['wrath']);assert.equal(page.boards().at(-1),'wrath');
 await page.el('rank-tab-legacy').onclick();assert.deepEqual(page.pressed(),['legacy']);assert.match(page.el('rank-load').textContent,/before v18/);
 // Choosing a difficulty for the next journey shows that difficulty's board.
 assert.equal(page.run("selectDifficulty('ithaca')"),true);await page.run('rankIdentityReady');await new Promise(r=>setImmediate(r));
 assert.deepEqual(page.pressed(),['ithaca']);assert.equal(page.boards().at(-1),'ithaca');
 page.run("setControlLanguage('ko')");
 assert.equal(page.el('rank-tab-ithaca').textContent,'이타카의 길 · 쉬움');assert.equal(page.el('rank-tab-wrath').textContent,'포세이돈의 분노 · 최상');
 assert.equal(page.el('rank-tab-legacy').textContent,'이전 기록 (난이도 구분 전)');assert.equal(page.el('rank-tabs').getAttribute('aria-label'),'난이도별 순위');assert.equal(page.el('rank-tab-ithaca').lang,'ko');
 assert.deepEqual(page.pressed(),['ithaca'],'language change keeps the board');
 page.run("setControlLanguage('en')");assert.equal(page.el('rank-tab-ithaca').textContent,'ITHACA’S PATH · EASY');
 const korean=rankingPage({language:'ko'});await korean.run('rankIdentityReady');assert.deepEqual(korean.pressed(),['aegean']);assert.equal(korean.el('rank-tab-aegean').textContent,'에게해의 항해 · 보통');
});
test('after a journey the page shows the board of the difficulty it was started with',async()=>{
 const page=rankingPage({selected:'wrath'});await page.run('rankIdentityReady');
 await page.run('startRankRun();rankStarting');const start=page.requests.find(r=>r.path==='/api/runs');assert.deepEqual(start.body,{difficulty:'wrath'});
 const runId=page.run('rankRunId');assert.equal(storedDifficulty(runId),'wrath');sqlite.prepare('UPDATE runs SET started_at=? WHERE id=?').run(nowSeconds()-1000,runId);
 // The player looked at another board during the journey, and the picker changed for the next game.
 await page.el('rank-tab-ithaca').onclick();page.run("selectedDifficulty='trial'");
 await page.run('finishRankRun('+JSON.stringify(botRun)+')');assert.deepEqual(page.pressed(),['wrath']);assert.equal(page.el('rank-form').hidden,false);
 await page.el('rank-form').events.submit({preventDefault(){}});assert.match(page.el('rank-status').textContent,/Saved!/);
 const sent=page.requests.find(r=>r.path==='/api/results');assert.equal(sent.body.difficulty,undefined,'the result carries no difficulty');
 assert.deepEqual(page.pressed(),['wrath']);assert.equal(page.boards().at(-1),'wrath');
 assert.ok(page.el('rank-rows').children.some(row=>row.children[1].textContent==='Tab Hero (ME)'));assert.match(page.el('rank-personal').textContent,/My best: #\d+/);
});
