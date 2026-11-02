import {telemetryApi} from './telemetry.mjs';
import {checkNickname} from './nickname.mjs';
import {checkClock,checkPlausibility,clientAddress,rateLimit,rateLimitedResponse,purgeUnsubmittedRuns} from './protection.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
// v18: each ranking entry belongs to the difficulty its journey was started with.
// Runs saved before v18 have no difficulty (NULL) and are listed as 'legacy'.
export const RANK_DIFFICULTIES=Object.freeze(['ithaca','aegean','trial','wrath']);
const RANK_BOARDS=[...RANK_DIFFICULTIES,'legacy'];
function database(env){if(!env.DB)throw Error('Leaderboard database unavailable');return env.DB;}
export function scoreRun(r){
 const combat=r.normalKills*100+r.bossKills*1200;
 const journey=10000; // Ten stages at 500, plus the 5,000-point homecoming bonus.
 const speed=Math.max(0,3600-r.elapsed)*2;
 const defense=Math.max(0,3000-r.damageTaken*5);
 const penalty=r.retries*500;
 return {total:Math.max(0,combat+journey+speed+defense-penalty),combat,journey,speed,defense,penalty};
}
function validResult(r,age){
 return r.completed===true&&Number.isInteger(r.normalKills)&&r.normalKills>=72&&r.normalKills<=74&&r.bossKills===4
  &&Number.isInteger(r.elapsed)&&r.elapsed>=60&&r.elapsed<=86400&&r.elapsed<=age+10
  &&Number.isInteger(r.damageTaken)&&r.damageTaken>=0&&r.damageTaken<=100000
  &&Number.isInteger(r.retries)&&r.retries>=0&&r.retries<=999;
}
async function body(request){
 if(!request.headers.get('content-type')?.includes('application/json'))throw Error('Expected JSON');
 const reader=request.body?.getReader();if(!reader)throw Error('Missing body');let chunks=[],size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>3000){await reader.cancel();throw Error('Request too large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
async function apiWithViewer(request,env,viewerKey){
 const url=new URL(request.url),path=url.pathname;
 if(request.method==='POST'&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return json({error:'Use the game website to submit.'},403);
 try{
  const db=database(env);
  if(path==='/api/views'&&['GET','POST'].includes(request.method)){
   if(request.method==='POST'){
    // Count only requests a browser marks as coming from this site. Browsers send
    // Origin (and usually Sec-Fetch-Site) with this request; scripts that send
    // neither header get the current count without adding a view.
    const site=request.headers.get('sec-fetch-site');
    if(site&&!['same-origin','same-site'].includes(site))return json({error:'Use the game website to count views.'},403);
    const counted=!!(request.headers.get('origin')||site);
    let data;try{data=await body(request);}catch{return json({error:'Invalid page view.'},400);}
    if(typeof data?.pageId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.pageId))return json({error:'Invalid page view.'},400);
    if(!counted){const row=await db.prepare('SELECT COUNT(*) AS views FROM page_views').first();return json({views:row.views,since:'2026-09-11',counted:false});}
    const results=await db.batch([
     db.prepare('INSERT INTO page_views (id,viewed_at) VALUES (?,?) ON CONFLICT(id) DO NOTHING').bind(data.pageId.toLowerCase(),Math.floor(Date.now()/1000)),
     db.prepare('SELECT COUNT(*) AS views FROM page_views')
    ]);
    return json({views:results[1].results[0].views,since:'2026-09-11'});
   }
   const row=await db.prepare('SELECT COUNT(*) AS views FROM page_views').first();return json({views:row.views,since:'2026-09-11'});
  }
  if(path==='/api/leaderboard'&&request.method==='GET'){
   // ?difficulty=ithaca|aegean|trial|wrath|legacy picks one board. Without the
   // parameter (pages from before v18) the reply is the old combined ranking.
   const board=url.searchParams.get('difficulty');
   if(board!==null&&!RANK_BOARDS.includes(board))return json({error:'Unknown difficulty.',code:'invalid_difficulty'},400);
   const filter=board===null?'':board==='legacy'?' AND difficulty IS NULL':' AND difficulty=?';
   const args=board===null||board==='legacy'?[viewerKey,viewerKey]:[board,viewerKey,viewerKey];
   const rows=await db.prepare('WITH ranked AS (SELECT nickname,score,elapsed,retries,submitted_at,difficulty,player_key,ROW_NUMBER() OVER (ORDER BY score DESC,elapsed ASC,submitted_at ASC,id ASC) AS rank FROM runs WHERE submitted_at IS NOT NULL'+filter+') SELECT nickname,score,elapsed,retries,submitted_at,difficulty,rank,CASE WHEN player_key=? THEN 1 ELSE 0 END AS is_me FROM ranked WHERE rank<=20 OR rank=(SELECT MIN(rank) FROM ranked WHERE player_key=?) ORDER BY rank').bind(...args).all();
   const all=rows.results||[],entries=all.filter(r=>r.rank<=20),myBest=all.find(r=>r.is_me)||null;
   return json(board===null?{entries,myBest}:{difficulty:board,entries,myBest});
  }
  if(path==='/api/runs'&&request.method==='POST'){
   // The difficulty is fixed here, when the journey starts; a result submitted
   // later cannot change it. Pages from before v18 send no difficulty: those
   // runs are kept without one (listed with the earlier records).
   let start=null;try{start=await body(request);}catch{}
   const difficulty=start?.difficulty??null;
   if(difficulty!==null&&!RANK_DIFFICULTIES.includes(difficulty))return json({error:'Unknown difficulty. Please reload the game.',code:'invalid_difficulty'},400);
   const id=crypto.randomUUID(),now=Math.floor(Date.now()/1000);
   await purgeUnsubmittedRuns(db,now);
   await db.prepare('INSERT INTO runs (id,started_at,player_key,difficulty) VALUES (?,?,?,?)').bind(id,now,viewerKey,difficulty).run();return json({runId:id,difficulty},201);
  }
  if(path==='/api/results'&&request.method==='POST'){
   let r;try{r=await body(request);}catch{return json({error:'The result could not be read.'},400);}
   if(!r||typeof r!=='object'||Array.isArray(r))return json({error:'The result could not be read.'},400);
   if(typeof r.runId!=='string'||!/^[-a-z0-9]{36}$/.test(r.runId)||typeof r.nickname!=='string')return json({error:'Start a new journey before submitting.'},400);
   const named=checkNickname(r.nickname);if(!named.nickname)return json({error:named.error,code:named.code},400);const nickname=named.nickname;
   const run=await db.prepare('SELECT * FROM runs WHERE id=?').bind(r.runId).first();
   if(!run)return json({error:'Journey not found. Please start a new game.'},404);
   if(run.player_key&&run.player_key!==viewerKey)return json({error:'Submit this journey from the browser where it started.'},403);
   if(run.submitted_at)return json({score:run.score,difficulty:run.difficulty,alreadySaved:true});
   const now=Math.floor(Date.now()/1000),age=now-run.started_at;
   if(age>172800)return json({error:'This result did not pass the journey checks.',code:'invalid_result'},400);
   const clock=checkClock(r,age);if(clock)return json({error:clock.error,code:clock.code},clock.status);
   if(!validResult(r,age))return json({error:'This result did not pass the journey checks.',code:'invalid_result'},400);
   const implausible=checkPlausibility(r,age);if(implausible)return json({error:implausible.error,code:implausible.code},implausible.status);
   // Any difficulty in the submitted body is ignored; the run-start record decides.
   const parts=scoreRun(r);
   const result=await db.prepare('UPDATE runs SET submitted_at=?,nickname=?,score=?,elapsed=?,normal_kills=?,boss_kills=?,damage_taken=?,retries=?,player_key=COALESCE(player_key,?) WHERE id=? AND submitted_at IS NULL').bind(now,nickname,parts.total,r.elapsed,r.normalKills,r.bossKills,r.damageTaken,r.retries,viewerKey,r.runId).run();
   if(result.meta?.changes===0){const saved=await db.prepare('SELECT score,difficulty FROM runs WHERE id=?').bind(r.runId).first();return json({score:saved.score,difficulty:saved.difficulty,alreadySaved:true});}
   return json({score:parts.total,breakdown:parts,difficulty:run.difficulty});
  }
  return json({error:'Not found'},404);
 }catch(error){console.error('Leaderboard request failed',error instanceof Error?error.message:'Unknown error');return json({error:path==='/api/views'?'Views are temporarily unavailable. Please try again.':'Rankings are temporarily unavailable. Please try again.'},503);}
}
// Best-effort per-address limits for requests that write to the database.
const LIMITED_POSTS={'/api/runs':'runs','/api/results':'results','/api/views':'views','/api/telemetry/start':'telemetryStart','/api/telemetry/events':'telemetryEvents'};
export async function api(request,env){
 const limitName=request.method==='POST'&&LIMITED_POSTS[new URL(request.url).pathname];
 if(limitName){const wait=rateLimit(limitName,clientAddress(request));if(wait)return rateLimitedResponse(wait);}
 if(new URL(request.url).pathname.startsWith('/api/telemetry/'))return telemetryApi(request,env);
 if(new URL(request.url).pathname==='/api/views')return apiWithViewer(request,env,null);
 const found=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('odysseus_player='))?.slice('odysseus_player='.length);
 const valid=typeof found==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(found);
 const token=valid?found:crypto.randomUUID();
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('odysseus-player:'+token));
 const viewerKey=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
 const response=await apiWithViewer(request,env,viewerKey);
 if(!valid)response.headers.set('set-cookie','odysseus_player='+token+'; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax');
 return response;
}
export default {async fetch(request,env){
 const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return api(request,env);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const asset=ASSET_MAP[url.pathname==='/'?'/index.html':url.pathname];
 if(!asset)return new Response('Not found',{status:404});
 const data=asset.binary?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body;
 return new Response(request.method==='HEAD'?null:data,{headers:{'content-type':asset.type,'cache-control':'no-cache','x-content-type-options':'nosniff'}});
}};
