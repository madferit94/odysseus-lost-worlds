// Offline operator tool. Inputs must come from authenticated Sites database reads.
// Never expose this tool or its source JSON through the public asset map.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const sessionFields=['id','started_at','version','difficulty','source','is_test','consent_version'];
const eventFields=['session_id','seq','received_at','name','active_ms','stage','attempt','hp','energy','lives','damage_taken','normal_kills','boss_kills','retries','god','boss','outcome','duration_ms'];
const pick=(row,fields)=>Object.fromEntries(fields.map(key=>[key,row[key]??'']));
export function prepareExport(sessions,events,{includeTests=false,now=Date.now()}={}){
 const cutoff=Math.floor(now/1000)-90*86400;
 const allowed=sessions.filter(s=>s.started_at>=cutoff&&(includeTests||s.is_test===0));
 const ids=new Set(allowed.map(s=>s.id));const unique=new Map();
 for(const e of events)if(ids.has(e.session_id)&&e.received_at>=cutoff)unique.set(e.session_id+':'+e.seq,pick(e,eventFields));
 const selected=[...unique.values()].sort((a,b)=>a.session_id.localeCompare(b.session_id)||a.seq-b.seq);
 const summaries=allowed.map(s=>{
  const rows=selected.filter(e=>e.session_id===s.id),last=rows.at(-1),terminal=rows.filter(e=>['game_clear','game_over'].includes(e.name));
  const missing=[];const seqs=new Set(rows.map(e=>e.seq));for(let i=0;i<=(last?.seq??-1);i++)if(!seqs.has(i))missing.push(i);
  return{...pick(s,sessionFields),outcome:terminal.some(e=>e.name==='game_clear')?'clear':terminal.some(e=>e.name==='game_over')?'game_over':'unknown',observed_active_ms:last?.active_ms??0,last_stage:last?.stage??'',event_count:rows.length,missing_sequences:missing.join('|'),has_start:Number(rows.some(e=>e.name==='game_start')),terminal_conflict:Number(new Set(terminal.map(e=>e.name)).size>1)};
 });
 return{sessions:summaries,events:selected};
}
export function csv(rows,headers){
 const cell=v=>'"'+String(v??'').replace(/^[=+@\-]/,"'$&").replaceAll('"','""')+'"';
 return '\uFEFF'+[headers.map(cell).join(','),...rows.map(r=>headers.map(h=>cell(r[h])).join(','))].join('\r\n')+'\r\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [inputPath,outputDirectory,flag]=process.argv.slice(2);
 if(!inputPath||!outputDirectory||(flag&&flag!=='--include-tests'))throw Error('Usage: node export-analytics.mjs owner-snapshot.json new-output-directory [--include-tests]');
 const input=JSON.parse(fs.readFileSync(inputPath,'utf8'));if(!Array.isArray(input.sessions)||!Array.isArray(input.events)||input.complete!==true)throw Error('Complete owner-only snapshot required; fetch every returned page first.');
 const result=prepareExport(input.sessions,input.events,{includeTests:flag==='--include-tests'});
 if(fs.existsSync(outputDirectory))throw Error('Output exists. Choose a new version directory.');
 fs.mkdirSync(outputDirectory,{recursive:true});
 const summaryFields=[...sessionFields,'outcome','observed_active_ms','last_stage','event_count','missing_sequences','has_start','terminal_conflict'];
 fs.writeFileSync(path.join(outputDirectory,'sessions.csv'),csv(result.sessions,summaryFields),{flag:'wx'});
 fs.writeFileSync(path.join(outputDirectory,'events.csv'),csv(result.events,eventFields),{flag:'wx'});
 console.log(JSON.stringify({sessions:result.sessions.length,events:result.events.length,testsIncluded:flag==='--include-tests'}));
}
