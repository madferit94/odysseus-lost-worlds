'use strict';
(()=>{
 const layout=document.querySelector('.play-layout');
 const surface=document.createElement('section');surface.id='play-surface';surface.className='play-surface';
 surface.setAttribute('aria-label','Game display');layout.before(surface);
 const toolbar=document.createElement('div');toolbar.className='play-toolbar';
 toolbar.innerHTML='<span class="display-version">v17</span><button id="display-language" type="button"></button><button id="display-sound" type="button"></button><button id="display-guide" type="button" aria-expanded="false" aria-controls="guide-ko guide-en"></button><button id="display-fullscreen" type="button" aria-pressed="false"></button>';
 const status=document.createElement('p');status.id='display-status';status.className='display-status';status.setAttribute('role','status');
 surface.append(toolbar,layout,status);
 const guide=document.getElementById('display-guide'),full=document.getElementById('display-fullscreen'),sound=document.getElementById('display-sound'),language=document.getElementById('display-language');
 let busy=false,wasFull=false,lastExitAt=0;
 const isFull=()=>document.fullscreenElement===surface||surface.classList.contains('fullscreen-fallback');
 function labels(){
  const ko=controlLanguage==='ko',open=surface.classList.contains('guide-open'),active=isFull();
  surface.setAttribute('aria-label',ko?'게임 화면':'Game display');
  guide.textContent=ko?(open?'안내 닫기':'조작 안내'):(open?'Close controls':'Controls');
  guide.setAttribute('aria-expanded',String(open));
  full.textContent=ko?(active?'전체 화면 나가기':'전체 화면'):(active?'Exit fullscreen':'Fullscreen');
  full.setAttribute('aria-pressed',String(active));
  language.textContent=ko?'English':'한국어';sound.textContent=document.getElementById('sound').textContent;
 }
 const previousLanguage=refreshControlLanguage;
 refreshControlLanguage=function(...args){const result=previousLanguage(...args);labels();return result;};
 const previousSound=refreshSoundLabel;
 refreshSoundLabel=function(...args){const result=previousSound(...args);sound.textContent=document.getElementById('sound').textContent;return result;};
 function pauseSafely(){keys.clear();if(state==='play')pause();}
 function setGuide(open){
  if(open)pauseSafely();surface.classList.toggle('guide-open',open);labels();
  if(!open)canvas.focus();
 }
 guide.onclick=()=>setGuide(!surface.classList.contains('guide-open'));
 language.onclick=()=>{setControlLanguage(controlLanguage==='ko'?'en':'ko');if(!surface.classList.contains('guide-open'))canvas.focus();};
 sound.onclick=()=>document.getElementById('sound').click();
 function changed(){
  const active=isFull();document.body.classList.toggle('display-fullscreen',active);
  if(wasFull&&!active){lastExitAt=Date.now();pauseSafely();}wasFull=active;labels();canvas.focus();
 }
 async function toggleFullscreen(){
  if(busy)return;busy=true;full.disabled=true;status.textContent='';keys.clear();
  try{
   if(surface.classList.contains('fullscreen-fallback')){surface.classList.remove('fullscreen-fallback');changed();}
   else if(document.fullscreenElement===surface){await document.exitFullscreen();}
   else{
    setGuide(false);
    try{
     if(!surface.requestFullscreen)throw Error('Fullscreen unavailable');
     await surface.requestFullscreen();
    }catch{
     surface.classList.add('fullscreen-fallback');changed();
     status.textContent=controlLanguage==='ko'?'브라우저가 전체 화면을 허용하지 않아 창 안에서 확대했습니다.':'Fullscreen unavailable; expanded inside this browser window.';
    }
   }
  }finally{busy=false;full.disabled=false;labels();canvas.focus();}
 }
 full.onclick=toggleFullscreen;
 document.addEventListener('fullscreenchange',changed);
 // Escape closes help first, then leaves fullscreen; it must not also resume combat.
 window.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if(surface.classList.contains('guide-open')){
   event.preventDefault();event.stopImmediatePropagation();setGuide(false);
  }else if(isFull()||wasFull||Date.now()-lastExitAt<250){
   // Some browsers exit natively before delivering Escape to page listeners.
   // Consume that same key instead of immediately resuming the paused game.
   event.preventDefault();event.stopImmediatePropagation();
   if(isFull())toggleFullscreen();else pauseSafely();
  }
 },true);
 labels();
})();
