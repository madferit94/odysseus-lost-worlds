import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {api} from './server/worker.mjs';
import {prepareExport,csv} from './export-analytics.mjs';
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 const DB={prepare(sql){let args=[];return{bind(...v){args=v;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){return{meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};},async all(){return{results:sqlite.prepare(sql).all(...args)};}};},async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.all());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return{sqlite,env:{DB}};
}
const metadata=()=>({id:crypto.randomUUID(),token:crypto.randomUUID()+crypto.randomUUID(),consent:true,version:'v16',difficulty:'ithaca',source:'x',isTest:true});
test('operator export excludes tests and secrets, flags incomplete journeys, escapes CSV',()=>{
 const now=Math.floor(Date.now()/1000),sessions=[{id:'a',started_at:now,is_test:0,token_hash:'NEVER EXPORT'},{id:'b',started_at:now,is_test:1}],events=[{session_id:'a',seq:0,received_at:now,name:'game_start',active_ms:0},{session_id:'a',seq:2,received_at:now,name:'stage_start',active_ms:1200},{session_id:'b',seq:0,received_at:now,name:'game_start'}];
 const result=prepareExport(sessions,events);assert.equal(result.sessions.length,1);assert.equal(result.sessions[0].outcome,'unknown');assert.equal(result.sessions[0].missing_sequences,'1');assert.equal(result.events.length,2);assert.ok(!JSON.stringify(result).includes('NEVER EXPORT'));assert.match(csv([{name:'=SUM(A1)'}],['name']),/'=SUM/);assert.equal(prepareExport(sessions,events,{includeTests:true}).sessions.length,2);
});
const event=(seq=0)=>({name:seq===0?'game_start':'stage_start',seq,activeMs:0,stage:0,attempt:0,hp:100,energy:0,lives:3,damageTaken:0,normalKills:0,bossKills:0,retries:0,god:'',boss:'',outcome:'',durationMs:0});
const request=(path,data,origin='https://game.example')=>new Request('https://game.example'+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)});
test('consent required; immutable metadata; no cookie or public raw-data reader',async()=>{
 const {env,sqlite}=database(),m=metadata();
 assert.equal((await api(request('/api/telemetry/start',{...m,consent:false}),env)).status,400);
 const start=await api(request('/api/telemetry/start',m),env);assert.equal(start.status,201);assert.equal(start.headers.get('set-cookie'),null);
 await api(request('/api/telemetry/start',{...m,difficulty:'wrath'}),env);
 assert.equal(sqlite.prepare('SELECT difficulty FROM play_sessions').get().difficulty,'ithaca');
 assert.equal((await api(new Request('https://game.example/api/telemetry/events'),env)).status,404);
 assert.equal((await api(request('/api/telemetry/start',m,'https://elsewhere.example'),env)).status,403);
});
test('events persist once; invalid batches are atomic; secrets protect each journey',async()=>{
 const {env,sqlite}=database(),m=metadata();await api(request('/api/telemetry/start',m),env);
 const payload={id:m.id,token:m.token,events:[event(),event(1)]};
 for(let i=0;i<3;i++)assert.equal((await api(request('/api/telemetry/events',payload),env)).status,200);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM play_events').get().n,2);
 assert.equal((await api(request('/api/telemetry/events',{...payload,token:metadata().token}),env)).status,403);
 assert.equal((await api(request('/api/telemetry/events',{...payload,events:[event(2),{...event(3),name:'unknown'}]}),env)).status,400);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM play_events').get().n,2);
 assert.equal((await api(request('/api/telemetry/events',{...payload,events:[{...event(2),name:'finisher_use',god:'zeus',energy:150}]}),env)).status,400);
 assert.equal((await api(request('/api/telemetry/events',{...payload,events:Array(11).fill(event())}),env)).status,400);
 assert.equal((await api(request('/api/telemetry/events',{...payload,events:[{...event(2),activeMs:999999}]}),env)).status,400);
});
test('90-day cleanup removes expired analytics only, not rankings or page views',async()=>{
 const {env,sqlite}=database(),m=metadata();await api(request('/api/telemetry/start',m),env);await api(request('/api/telemetry/events',{...m,events:[event()]}),env);
 const old=Math.floor(Date.now()/1000)-91*86400;sqlite.prepare('UPDATE play_sessions SET started_at=?').run(old);sqlite.prepare('UPDATE play_events SET received_at=?').run(old);
 sqlite.prepare('INSERT INTO page_views VALUES (?,?)').run('keep',old);
 await api(request('/api/telemetry/start',metadata()),env);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM play_sessions').get().n,1);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM play_events').get().n,0);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM page_views').get().n,1);
});
function frontend(){
 const {env,sqlite}=database(),elements=new Map(),handlers={},noop=()=>{},draw=new Proxy({},{get:()=>noop,set:()=>true});let loseResponse=false,offline=false;
 const el=id=>{if(!elements.has(id))elements.set(id,{checked:false,events:{},textContent:'',getContext:()=>draw,classList:{add:noop,remove:noop},focus:noop,setAttribute:noop,before:noop,addEventListener(k,f){this.events[k]=f;}});return elements.get(id);};
 const requests=[];const ctx=vm.createContext({console,crypto,Math,URLSearchParams,AbortController,location:{search:'?test=1&utm_source=x'},setTimeout:()=>1,clearTimeout:noop,Image:class{},requestAnimationFrame:noop,document:{hidden:false,createElement:()=>el('panel'),querySelector:()=>el('layout'),getElementById:el,addEventListener(k,f){handlers[k]=f;}},window:{addEventListener(k,f){handlers[k]=f;}},fetch:async(path,opts)=>{
  requests.push(path);if(offline)throw Error('offline');const response=await api(new Request('https://game.example'+path,{...opts,headers:{...opts.headers,origin:'https://game.example'}}),env);if(loseResponse&&path.endsWith('/events')){loseResponse=false;throw Error('response lost');}return response;
 }});
 for(const f of ['art.js','gods.js','achilles.js','caocao.js','weapons.js','progression.js','combat.js','characters.js','ui.js','game.js','telemetry.js','telemetry-hooks.js'])vm.runInContext(fs.readFileSync(''+f,'utf8'),ctx);
 const run=s=>vm.runInContext(s,ctx);run('audio=()=>{}');return{sqlite,run,el,requests,lose:()=>loseResponse=true,offline:v=>offline=v};
}
test('real game hooks cover bosses, retries, two-bar Zeus and game over; rejected use is absent',async()=>{
 const f=frontend();f.el('analytics-consent').checked=true;
 f.run("selectDifficulty('ithaca');reset();enter(2);p.energy=150;finisher('zeus');gainEnergy(50);finisher('zeus');divine=0;p.inv=0;hurt(999);retry();p.inv=0;hurt(999);retry();p.inv=0;hurt(999);");
 await f.run('telemetry.flush()');await new Promise(r=>setImmediate(r));await f.run('telemetry.flush()');
 const rows=f.sqlite.prepare('SELECT * FROM play_events ORDER BY seq').all();
 assert.equal(rows.filter(e=>e.name==='finisher_use').length,1);assert.equal(rows.find(e=>e.name==='finisher_use').energy,200);
 assert.equal(rows.filter(e=>e.name==='boss_start').length,3);assert.equal(rows.filter(e=>e.name==='boss_end'&&e.outcome==='death').length,3);
 assert.equal(rows.filter(e=>e.name==='retry').length,2);assert.equal(rows.filter(e=>e.name==='game_over').length,1);
 assert.equal(rows.filter(e=>e.name==='player_death').length,3);
 assert.equal(f.sqlite.prepare('SELECT difficulty,is_test FROM play_sessions').get().is_test,1);
});
test('opt-out sends nothing; opting in mid-run waits for restart; language and stop work',async()=>{
 const f=frontend();f.run('reset();');await f.run('telemetry.flush()');assert.equal(f.requests.length,0);
 f.el('analytics-consent').checked=true;f.el('analytics-consent').events.change();f.run('gainEnergy(200);');await f.run('telemetry.flush()');assert.equal(f.requests.length,0);
 f.run("reset();setControlLanguage('ko');");await f.run('telemetry.flush()');assert.match(f.el('analytics-status').textContent,/기록 저장 확인/);
 f.el('analytics-consent').checked=false;f.el('analytics-consent').events.change();const count=f.requests.length;f.run('enter(2);gainEnergy(200);finisher("zeus");');await f.run('telemetry.flush()');assert.equal(f.requests.length,count);
});
test('lost acknowledgements retry without duplicates; offline play is unaffected',async()=>{
 const f=frontend();f.el('analytics-consent').checked=true;f.run('reset();');f.lose();await f.run('telemetry.flush()');
 assert.match(f.el('analytics-status').textContent,/retrying/);await f.run('telemetry.flush()');assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM play_events').get().n,2);
 f.offline(true);f.run('enter(1);');await f.run('telemetry.flush()');assert.equal(f.run('state'),'play');f.offline(false);await f.run('telemetry.flush()');assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM play_events').get().n,4);
});
test('boss victory, stage complete, epilogue and pause timing are measured',async()=>{
 const f=frontend();f.el('analytics-consent').checked=true;f.run('reset();enter(2);damage(enemies[0],999,0,true);update(.02);pause();update(10);pause();enter(10);update(9);');
 await f.run('telemetry.flush()');await new Promise(r=>setImmediate(r));await f.run('telemetry.flush()');
 const rows=f.sqlite.prepare('SELECT * FROM play_events ORDER BY seq').all();assert.equal(rows.filter(e=>e.name==='boss_end'&&e.outcome==='win').length,1);assert.equal(rows.filter(e=>e.name==='game_clear').length,1);assert.equal(rows.find(e=>e.name==='game_clear').active_ms,9020);assert.ok(rows.some(e=>e.name==='stage_complete'&&e.stage===10));
});
