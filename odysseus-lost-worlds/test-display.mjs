import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// v17 display controls (display.js) on top of the real game scripts, with a small fake DOM.
function world({fullscreenApi=true}={}){
 const noop=()=>{},draw=new Proxy({},{get:()=>noop,set:()=>true}),elements=new Map(),created=[],docHandlers={},capture=[],bubble=[];
 class El{
  constructor(id=null,tag='div'){this.id=id;this.tagName=tag.toUpperCase();this.attributes={};this.textContent='';this.hidden=false;this.className='';const names=new Set();
   this.classList={add:(...c)=>c.forEach(n=>names.add(n)),remove:(...c)=>c.forEach(n=>names.delete(n)),contains:n=>names.has(n)||this.className.split(' ').includes(n),toggle:(n,force)=>{const on=force===undefined?!names.has(n):!!force;on?names.add(n):names.delete(n);return on;}};
   if(fullscreenApi)this.requestFullscreen=async()=>{doc.fullscreenElement=this;docHandlers.fullscreenchange?.();};}
  getContext(){return draw;}focus(){doc.activeElement=this;}setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}
  before(){}append(){}
 }
 const element=id=>{if(!elements.has(id))elements.set(id,new El(id,id==='game'?'canvas':'div'));return elements.get(id);};
 const doc={getElementById:element,querySelector:sel=>sel==='.play-layout'?element('play-layout'):null,createElement:tag=>{const e=new El(null,tag);created.push(e);return e;},
  addEventListener:(name,fn)=>{docHandlers[name]=fn;},body:new El('body','body'),fullscreenElement:null,activeElement:null,
  exitFullscreen:async()=>{doc.fullscreenElement=null;docHandlers.fullscreenchange?.();}};
 const context=vm.createContext({console,Image:class{constructor(){this.complete=false;this.naturalWidth=0;}},document:doc,requestAnimationFrame:noop,
  window:{addEventListener:(name,fn,useCapture)=>{if(name==='keydown')(useCapture?capture:bubble).push(fn);}}});
 for(const file of ['art.js','gods.js','achilles.js','caocao.js','weapons.js','progression.js','combat.js','characters.js','ui.js','game.js','display.js'])vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),context);
 const run=s=>vm.runInContext('(()=>{'+s+'})()',context);run('audio=()=>{};');
 // Window capture listeners run before bubble listeners; stopImmediatePropagation ends dispatch.
 const press=key=>{let stopped=false;const ev={key,code:key,target:element('game'),repeat:false,ctrlKey:false,altKey:false,metaKey:false,preventDefault:noop,stopImmediatePropagation(){stopped=true;}};
  for(const fn of capture){fn(ev);if(stopped)return;}for(const fn of bubble)fn(ev);};
 const surface=created.find(e=>e.className==='play-surface');
 const status=created.find(e=>e.id==='display-status');
 return {doc,surface,status,run,press,el:element,state:()=>run('return state;'),fullscreenChange:()=>docHandlers.fullscreenchange?.()};
}
const settle=()=>new Promise(r=>setImmediate(r));

test('Esc closes the controls guide first, then leaves fullscreen, without resuming play',async()=>{
 const w=world();w.run('reset();');
 await w.el('display-fullscreen').onclick();
 assert.equal(w.doc.fullscreenElement,w.surface);assert.equal(w.state(),'play');
 w.el('display-guide').onclick();
 assert.ok(w.surface.classList.contains('guide-open'));assert.equal(w.state(),'pause');
 w.press('Escape');
 assert.ok(!w.surface.classList.contains('guide-open'),'first Esc closes the guide');
 assert.equal(w.doc.fullscreenElement,w.surface,'first Esc keeps fullscreen');assert.equal(w.state(),'pause','first Esc does not resume');
 w.press('Escape');await settle();
 assert.equal(w.doc.fullscreenElement,null,'second Esc leaves fullscreen');assert.equal(w.state(),'pause','second Esc does not resume');
 assert.ok(!w.doc.body.classList.contains('display-fullscreen'));
 assert.equal(w.el('display-fullscreen').attributes['aria-pressed'],'false');
});

test('Esc outside fullscreen still closes an open guide before pausing or resuming',()=>{
 const w=world();w.run('reset();');
 w.el('display-guide').onclick();assert.equal(w.state(),'pause');
 w.press('Escape');assert.ok(!w.surface.classList.contains('guide-open'));assert.equal(w.state(),'pause');
 w.press('Escape');assert.equal(w.state(),'play','with the guide closed, Esc resumes as before');
 w.press('Escape');assert.equal(w.state(),'pause');
});

test('leaving fullscreen through the browser pauses a running game',async()=>{
 const w=world();w.run('reset();');
 await w.el('display-fullscreen').onclick();
 assert.ok(w.doc.body.classList.contains('display-fullscreen'));assert.equal(w.state(),'play');
 w.run("keys.add('ArrowRight');");
 w.doc.fullscreenElement=null;w.fullscreenChange();
 assert.equal(w.state(),'pause');assert.equal(w.run('return keys.size;'),0);
 assert.ok(!w.doc.body.classList.contains('display-fullscreen'));
 assert.equal(w.doc.activeElement,w.el('game'));
});

test('without the Fullscreen API the game expands inside the window and can be closed',async()=>{
 const w=world({fullscreenApi:false});w.run('reset();');
 await w.el('display-fullscreen').onclick();
 assert.equal(w.doc.fullscreenElement,null);
 assert.ok(w.surface.classList.contains('fullscreen-fallback'));assert.ok(w.doc.body.classList.contains('display-fullscreen'));
 assert.equal(w.status.textContent,'Fullscreen unavailable; expanded inside this browser window.');
 assert.equal(w.el('display-fullscreen').textContent,'Exit fullscreen');assert.equal(w.el('display-fullscreen').disabled,false);
 assert.equal(w.state(),'play','entering the expanded view does not pause');
 w.press('Escape');await settle();
 assert.ok(!w.surface.classList.contains('fullscreen-fallback'),'Esc leaves the expanded view');
 assert.ok(!w.doc.body.classList.contains('display-fullscreen'));assert.equal(w.state(),'pause');
 assert.equal(w.el('display-fullscreen').textContent,'Fullscreen');
});
