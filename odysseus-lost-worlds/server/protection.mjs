// Ranking protection: result plausibility checks, best-effort rate limits and
// clean-up of journeys that were started but never submitted.

// ---- Facts taken from the game data (game.js) ------------------------------
// LEVELS: wave stages G1 (3 waves), E1, E2, E3 (2 waves each) and FINAL ACT
// (3 waves) spawn 6 regular enemies per wave = 12 waves x 6 = 72.
// The Antinous stage adds a fighter and an archer = 2 more. Boss helpers and
// Cao Cao clones never count as normal kills. Total possible normal kills: 74.
// The two Antinous escorts are removed without counting when phase II starts,
// so a legitimate run reports 72 to 74 normal kills and exactly 4 boss kills
// (Polyphemus, Poseidon, Cao Cao, Antinous). validResult in worker.mjs already
// enforces these bounds; test-plausibility.mjs re-derives them from game.js.
export const GAME_FACTS=Object.freeze({waveEnemies:72,escortEnemies:2,maxNormalKills:74,minNormalKills:72,bosses:4,firstLifeHP:100});

// ---- Time floor -------------------------------------------------------------
// The reported elapsed time is game time (Math.ceil of seconds in play, cut-scenes
// included, pauses and death screens excluded). Game time can never run faster
// than wall-clock time, because each frame adds at most 0.04 s.
//
// How the floor was chosen (details in README "Ranking protection"):
// - Scripted parts alone need at least about 53 s even with no fighting at all:
//   1.4 s start freeze, at least about 4,100 px of walking at 205 px/s (20 s),
//   7 pauses of 1.25 s between waves, 15 s of cut-scenes and the 8 s epilogue.
//   Running the real game code with every enemy deleted on spawn took 69 s.
// - A bot running the real game code, attacking the nearest enemy and using
//   finishers, finished the easiest difficulty in 176-210 s when it could not be
//   hurt (3 weapons, 5 finisher strategies, 3 seeds; stuck runs left out) and in
//   175-187 s when it could be hurt (175-212 s over all four difficulties; it
//   never needed a retry). Its fastest run was 175 s.
// - 100 s is about 57% of the fastest bot run, so a strong human is far above it,
//   and it leaves only about 47 s of fighting for 78 enemies including 4 bosses.
export const MIN_PLAUSIBLE_ELAPSED_SECONDS=100;
// Allowed gap between the reported game time and the server's clock. The run is
// created by a request sent when the journey starts, so it can reach the server
// a few seconds late. Same value as the existing validResult rule.
export const CLOCK_TOLERANCE_SECONDS=10;

const reject=(status,code,error)=>({status,code,error});
// Runs before validResult so a clock mismatch gets a specific message (still 400).
export function checkClock(r,age){
 if(Number.isInteger(r.elapsed)&&r.elapsed>age+CLOCK_TOLERANCE_SECONDS)
  return reject(400,'clock_mismatch','This result reports more play time than has passed since the journey started. Please start a new journey.');
 return null;
}
// Runs after validResult. Returns null when the result is plausible.
export function checkPlausibility(r,age){
 if(r.normalKills>GAME_FACTS.maxNormalKills||r.normalKills<GAME_FACTS.minNormalKills||r.bossKills!==GAME_FACTS.bosses)
  return reject(422,'impossible_result','This result has more defeated enemies than the journey contains, so it was not ranked.');
 if(r.elapsed<MIN_PLAUSIBLE_ELAPSED_SECONDS||age<MIN_PLAUSIBLE_ELAPSED_SECONDS-CLOCK_TOLERANCE_SECONDS)
  return reject(422,'implausible_time','This result is faster than a real journey can be completed, so it was not ranked.');
 // A retry needs a death, and the first life starts with exactly 100 HP. Every point
 // of lost HP is counted in damageTaken, so any retry means at least 100 damage.
 if(r.retries>0&&r.damageTaken<GAME_FACTS.firstLifeHP)
  return reject(422,'impossible_result','This result reports a retry without the damage needed to fall, so it was not ranked.');
 return null;
}

// ---- Rate limits (best effort) ---------------------------------------------
// Counted in this server instance's memory only. A host that runs several
// instances keeps separate counts, and counts reset when an instance restarts.
// A platform-level rate rule is stronger if the host offers one.
export const RATE_LIMITS=Object.freeze({
 runs:{limit:30,windowSeconds:600},           // new journeys: one every 20 s on average
 results:{limit:20,windowSeconds:600},        // ranking submissions
 views:{limit:60,windowSeconds:600},          // page-view counts
 telemetryStart:{limit:30,windowSeconds:600}, // optional analytics: journey start
 telemetryEvents:{limit:300,windowSeconds:600}, // optional analytics: event batches
});
// Requests without a known client address share one bucket with a higher limit.
export const UNKNOWN_CLIENT_MULTIPLIER=10;
// At most this many addresses are tracked per limit; oldest entries are dropped first.
export const MAX_TRACKED_CLIENTS=5000;
const buckets=new Map();

// Cloudflare sets cf-connecting-ip and clients cannot override it. Other proxies
// append the address they saw to x-forwarded-for, so the last entry is used.
export function clientAddress(request){
 const forwarded=request.headers.get('x-forwarded-for')?.split(',').map(v=>v.trim()).filter(Boolean).at(-1);
 const value=(request.headers.get('cf-connecting-ip')||request.headers.get('x-real-ip')||forwarded||'').trim();
 return value?value.slice(0,64):null;
}
// Returns null when allowed, or the number of seconds to wait.
export function rateLimit(name,address,now=Date.now()){
 const rule=RATE_LIMITS[name];if(!rule)return null;
 let table=buckets.get(name);if(!table)buckets.set(name,table=new Map());
 const key=address||'unknown',limit=address?rule.limit:rule.limit*UNKNOWN_CLIENT_MULTIPLIER,windowMs=rule.windowSeconds*1000;
 let entry=table.get(key);
 if(!entry||now-entry.start>=windowMs){
  table.delete(key);
  if(table.size>=MAX_TRACKED_CLIENTS){
   for(const [k,v] of table)if(now-v.start>=windowMs)table.delete(k);
   for(const k of table.keys()){if(table.size<MAX_TRACKED_CLIENTS)break;table.delete(k);}
  }
  entry={start:now,count:0};table.set(key,entry);
 }
 if(entry.count>=limit)return Math.max(1,Math.ceil((entry.start+windowMs-now)/1000));
 entry.count++;return null;
}
export function rateLimitedResponse(retryAfter){
 return new Response(JSON.stringify({error:'Too many requests from this connection. Please wait '+retryAfter+' seconds and try again.',code:'rate_limited',retryAfter}),
  {status:429,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','retry-after':String(retryAfter)}});
}
export function trackedClients(name){return buckets.get(name)?.size||0;}

// ---- Clean-up of unsubmitted journeys --------------------------------------
// A journey row is created when a game starts and stays empty until a result is
// saved. Rows still empty after 24 hours are deleted, at most once every
// 10 minutes per instance, when a new journey is created. A run paused for more
// than 24 hours can therefore no longer be ranked.
export const UNSUBMITTED_RUN_TTL_SECONDS=24*3600;
export const PURGE_INTERVAL_SECONDS=600;
let lastPurge=-Infinity;
export async function purgeUnsubmittedRuns(db,now){
 if(now-lastPurge<PURGE_INTERVAL_SECONDS)return false;
 lastPurge=now;
 try{await db.prepare('DELETE FROM runs WHERE submitted_at IS NULL AND started_at < ?').bind(now-UNSUBMITTED_RUN_TTL_SECONDS).run();return true;}
 catch(error){console.error('Run clean-up failed',error instanceof Error?error.message:'Unknown error');return false;}
}

// For tests: forget all counters and the last clean-up time.
export function resetProtectionState(){buckets.clear();lastPurge=-Infinity;}
