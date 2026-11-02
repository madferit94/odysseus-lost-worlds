import fs from 'node:fs';
import vm from 'node:vm';

// Test harness for v19 continue (checkpoint.js) and boss practice (practice.js): the real game scripts, with a small fake DOM,
// a fake localStorage, a fake ranking server and a recording analytics stub.
export function memoryStorage(){const data=new Map();return{data,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>{data.set(k,String(v));},removeItem:k=>{data.delete(k);}};}
export function world({storage=memoryStorage(),storageThrows=false}={}){
 const noop=()=>{},draw=new Proxy({},{get:()=>noop,set:()=>true}),elements=new Map(),requests=[],analytics=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{id,textContent:'',innerHTML:'',value:'Hero',hidden:false,disabled:false,lang:'',className:'',children:[],attributes:{},events:{},
  getContext:()=>draw,classList:{add:noop,remove:noop,contains:()=>false},focus:noop,setAttribute(k,v){this.attributes[k]=String(v);},getAttribute(k){return this.attributes[k]??null;},
  addEventListener(k,f){this.events[k]=f;},appendChild(c){this.children.push(c);},replaceChildren(){this.children=[];}});return elements.get(id);};
 const reply=data=>({ok:true,status:200,headers:{get:()=>null},json:async()=>data});
 const ctx={console,Math,JSON,Date,Image:class{constructor(){this.complete=false;this.naturalWidth=0;}},requestAnimationFrame:noop,
  document:{getElementById:element,addEventListener:noop,createElement:()=>({children:[],textContent:'',appendChild(c){this.children.push(c);}})},
  window:{addEventListener:noop,matchMedia:()=>({matches:false})},
  fetch:async(path,opts)=>{const body=opts?.body?JSON.parse(opts.body):undefined;requests.push({path,body});
   if(path==='/api/runs')return reply({runId:'00000000-0000-4000-8000-00000000000'+requests.length%10,difficulty:body.difficulty??null});
   if(path==='/api/results')return reply({score:1,difficulty:'aegean'});return reply({entries:[],myBest:null});}};
 if(storageThrows)Object.defineProperty(ctx,'localStorage',{get(){throw Error('SecurityError');}});else ctx.localStorage=storage;
 const context=vm.createContext(ctx);
 for(const file of ['art.js','gods.js','achilles.js','caocao.js','weapons.js','progression.js','combat.js','characters.js','ui.js','game.js','checkpoint.js','practice.js','ranking.js'])vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),context);
 context.telemetry={begin:(difficulty,mode='normal')=>analytics.push({begin:difficulty,mode}),emit:(name,snapshot)=>analytics.push({name,...snapshot}),flush:noop,display:noop};
 vm.runInContext(fs.readFileSync(new URL('telemetry-hooks.js',import.meta.url),'utf8'),context);
 const run=s=>vm.runInContext('(()=>{'+s+'})()',context);run('audio=()=>{};');
 return {run,el:element,storage,requests,analytics,saved:()=>{const raw=storage.getItem('odysseus-checkpoint-v1');return raw?JSON.parse(raw):null;}};
}
export const settle=()=>new Promise(r=>setImmediate(r));
