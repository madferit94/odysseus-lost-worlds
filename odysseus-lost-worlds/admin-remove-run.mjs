// Offline operator tool: find ranking rows by journey ID or nickname and remove them.
// Dry run by default. Never expose this tool through the public asset map.
//
//   node admin-remove-run.mjs --db <file.sqlite> (--run <id> | --nickname <name>) [--confirm]
//     Works on a SQLite copy of the database (for example a local development
//     database). With --confirm the matching rows are deleted in one transaction.
//   node admin-remove-run.mjs --snapshot <runs.json> (--run <id> | --nickname <name>) [--confirm]
//     For the live database: read the runs table through the owner's authenticated
//     Sites database connection (as in TELEMETRY-v16.md), save it as
//     {"complete":true,"runs":[...]}, then run this. With --confirm it prints the
//     DELETE statement to run through that same owner connection.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {normalizeNickname} from './server/nickname.mjs';

const FIELDS=['id','nickname','score','elapsed','normal_kills','boss_kills','damage_taken','retries','started_at','submitted_at'];
const ID=/^[-A-Za-z0-9]{1,64}$/;
const sameName=(a,b)=>normalizeNickname(a).toLowerCase()===normalizeNickname(b).toLowerCase();

// rows: objects from the runs table. Nickname matching ignores case and the same
// width/space differences the server removes before saving a nickname.
export function findRuns(rows,{runId,nickname}){
 if(runId)return rows.filter(r=>r.id===runId);
 return rows.filter(r=>typeof r.nickname==='string'&&sameName(r.nickname,nickname));
}
export function deleteStatement(ids){
 if(!ids.length)return '';
 if(!ids.every(id=>ID.test(id)))throw Error('Unexpected characters in a journey ID; refusing to build SQL.');
 return 'DELETE FROM runs WHERE id IN ('+ids.map(id=>"'"+id+"'").join(',')+');';
}
export function formatRows(rows){
 const time=v=>Number.isInteger(v)?new Date(v*1000).toISOString().replace('.000Z','Z'):'';
 return rows.map(r=>FIELDS.map(f=>f+'='+(f.endsWith('_at')?time(r[f]):r[f]??'')).join('  ')).join('\n');
}

// Works with any SQLite handle that has prepare(sql).all()/run() (node:sqlite DatabaseSync).
export function removeFromDatabase(sqlite,{runId,nickname,confirm=false}){
 const rows=runId?sqlite.prepare('SELECT '+FIELDS.join(',')+' FROM runs WHERE id=?').all(runId)
  :sqlite.prepare('SELECT '+FIELDS.join(',')+' FROM runs WHERE nickname IS NOT NULL').all();
 const matches=findRuns(rows,{runId,nickname});
 let deleted=0;
 if(confirm&&matches.length){
  sqlite.exec('BEGIN');
  try{const del=sqlite.prepare('DELETE FROM runs WHERE id=?');for(const r of matches)deleted+=Number(del.run(r.id).changes);sqlite.exec('COMMIT');}
  catch(error){sqlite.exec('ROLLBACK');throw error;}
 }
 return {matches,deleted};
}

function parseArgs(argv){
 const args={confirm:false};
 for(let i=0;i<argv.length;i++){
  const a=argv[i];
  if(a==='--confirm')args.confirm=true;
  else if(['--db','--snapshot','--run','--nickname'].includes(a)&&i+1<argv.length)args[a.slice(2)]=argv[++i];
  else throw Error('Unknown or incomplete option: '+a);
 }
 if(!!args.db===!!args.snapshot||!!args.run===!!args.nickname)throw Error('Usage: node admin-remove-run.mjs (--db file.sqlite | --snapshot runs.json) (--run <id> | --nickname <name>) [--confirm]');
 if(args.run&&!ID.test(args.run))throw Error('A journey ID contains only letters, digits and dashes.');
 return args;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const args=parseArgs(process.argv.slice(2)),filter={runId:args.run,nickname:args.nickname};
 let matches,deleted=0;
 if(args.db){
  if(!fs.existsSync(args.db))throw Error('Database file not found: '+args.db);
  const {DatabaseSync}=await import('node:sqlite');const sqlite=new DatabaseSync(args.db);
  try{({matches,deleted}=removeFromDatabase(sqlite,{...filter,confirm:args.confirm}));}finally{sqlite.close();}
 }else{
  const input=JSON.parse(fs.readFileSync(args.snapshot,'utf8'));
  if(input.complete!==true||!Array.isArray(input.runs))throw Error('Complete owner-only snapshot required: {"complete":true,"runs":[...]}');
  matches=findRuns(input.runs,filter);
 }
 console.log(matches.length?formatRows(matches):'No matching ranking rows.');
 console.log(matches.length+' matching row(s).');
 if(matches.length&&!args.confirm)console.log('Dry run: nothing was deleted. Add --confirm to remove these rows.');
 else if(matches.length&&args.db)console.log('Deleted '+deleted+' row(s).');
 else if(matches.length)console.log('Nothing was deleted locally. Run this through the owner database connection:\n'+deleteStatement(matches.map(r=>r.id)));
}
