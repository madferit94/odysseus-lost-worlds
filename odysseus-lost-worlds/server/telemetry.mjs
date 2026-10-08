// Separate from rankings: random per-journey credentials, no browser identifier.
const telemetryJson=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const EVENT_NAMES=new Set(['game_start','stage_start','stage_complete','player_death','retry','boss_start','boss_end','finisher_ready','finisher_use','game_clear','game_over','session_hidden','session_resumed','collection_stop']);
const GODS=['','athena','achilles','hermes','zeus'];
const SOURCES=['direct','x','reddit','linkedin','itch','other'];
const int=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
async function telemetryBody(request){
 if(!request.headers.get('content-type')?.includes('application/json'))throw Error('JSON required');
 const reader=request.body?.getReader();if(!reader)throw Error('Body required');let size=0;const chunks=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();throw Error('Too large');}chunks.push(value);}
 const data=new Uint8Array(size);let pos=0;for(const c of chunks){data.set(c,pos);pos+=c.length;}return JSON.parse(new TextDecoder().decode(data));
}
async function telemetryHash(token){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),v=>v.toString(16).padStart(2,'0')).join('');}
export async function telemetryApi(request,env){
 const url=new URL(request.url);
 if(request.method!=='POST')return telemetryJson({error:'Not found'},404);
 if(request.headers.get('origin')!==url.origin)return telemetryJson({error:'Same-origin required'},403);
 let data;try{data=await telemetryBody(request);}catch{return telemetryJson({error:'Invalid request'},400);}
 if(!data||!UUID.test(data.id)||typeof data.token!=='string'||!/^[-a-f0-9]{72}$/i.test(data.token))return telemetryJson({error:'Invalid journey'},400);
 try{
  const db=env.DB;if(!db)throw Error('Missing DB');const now=Math.floor(Date.now()/1000),cutoff=now-90*86400;
  const hash=await telemetryHash(data.token);
  if(url.pathname==='/api/telemetry/start'){
   if(data.consent!==true||!['v16','v17'].includes(data.version)||!['ithaca','aegean','trial','wrath'].includes(data.difficulty)||!SOURCES.includes(data.source)||typeof data.isTest!=='boolean')return telemetryJson({error:'Invalid consent or metadata'},400);
   await db.batch([
    db.prepare('DELETE FROM play_events WHERE received_at < ?').bind(cutoff),
    db.prepare('DELETE FROM play_sessions WHERE started_at < ?').bind(cutoff),
    db.prepare('INSERT INTO play_sessions (id,token_hash,started_at,version,difficulty,source,is_test,consent_version) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(data.id,hash,now,data.version,data.difficulty,data.source,Number(data.isTest),'2026-09-30')
   ]);
   const row=await db.prepare('SELECT token_hash FROM play_sessions WHERE id=?').bind(data.id).first();
   if(row?.token_hash!==hash)return telemetryJson({error:'Journey conflict'},403);
   return telemetryJson({id:data.id},201);
  }
  if(url.pathname!=='/api/telemetry/events')return telemetryJson({error:'Not found'},404);
  const session=await db.prepare('SELECT token_hash,started_at FROM play_sessions WHERE id=?').bind(data.id).first();
  if(!session||session.token_hash!==hash)return telemetryJson({error:'Journey not found'},403);
  if(now-session.started_at>86400)return telemetryJson({error:'Journey expired'},410);
  if(!Array.isArray(data.events)||data.events.length<1||data.events.length>10)return telemetryJson({error:'Invalid batch'},400);
  for(const e of data.events){
   if(!e||!EVENT_NAMES.has(e.name)||!int(e.seq,1999)||!int(e.activeMs,86400000)||e.activeMs>(now-session.started_at+30)*1000||!int(e.stage,10)||!int(e.attempt,20)||!int(e.hp,500)||!int(e.energy,200)||!int(e.lives,3)||!int(e.damageTaken,100000)||!int(e.normalKills,200)||!int(e.bossKills,4)||!int(e.retries,20)||!GODS.includes(e.god)||!['','polyphemus','poseidon','caocao','antinous'].includes(e.boss)||!['','win','death'].includes(e.outcome)||!int(e.durationMs,86400000))return telemetryJson({error:'Invalid event'},400);
   if((e.name==='game_start'&&e.seq!==0)||(e.name==='finisher_use'&&(!e.god||(e.god==='zeus'?e.energy<200:e.energy<100))))return telemetryJson({error:'Invalid event state'},400);
  }
  await db.batch(data.events.map(e=>db.prepare('INSERT INTO play_events (session_id,seq,received_at,name,active_ms,stage,attempt,hp,energy,lives,damage_taken,normal_kills,boss_kills,retries,god,boss,outcome,duration_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(session_id,seq) DO NOTHING').bind(data.id,e.seq,now,e.name,e.activeMs,e.stage,e.attempt,e.hp,e.energy,e.lives,e.damageTaken,e.normalKills,e.bossKills,e.retries,e.god,e.boss,e.outcome,e.durationMs)));
  return telemetryJson({accepted:data.events.map(e=>e.seq)});
 }catch{console.error('Telemetry storage unavailable');return telemetryJson({error:'Recording temporarily unavailable'},503);}
}
