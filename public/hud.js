/* Presentation-only HUD adapted from the user's arcade UI reference. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiHUD=api})(typeof globalThis==='object'?globalThis:this,function(root){
'use strict';
const clamp=value=>Math.max(0,Math.min(100,Number.isFinite(value)?value:0));
function createHealthTracker(){
 const tracks=new Map();
 function sample(key,value,identity,time,instant=false){
  const hp=clamp(value);let track=tracks.get(key);
  if(!track||track.identity!==identity||time<track.time){track={hp,trail:hp,hold:time,time,identity};tracks.set(key,track);}
  if(hp<track.hp){track.trail=Math.max(track.trail,track.hp);track.hold=time+350;}
  else if(hp>track.hp){track.trail=hp;track.hold=time;}
  if(instant)track.trail=hp;
  else track.trail=Math.max(hp,track.trail-Math.max(0,time-Math.max(track.time,track.hold))*.12);
  track.hp=hp;track.time=time;
  return {hp,trail:track.trail,level:hp<=0?'ko':hp<=25?'danger':hp<=55?'warning':'healthy'};
 }
 return {sample,clear:()=>tracks.clear()};
}
function create(){
 const tracker=createHealthTracker(),motion=root.matchMedia?.('(prefers-reduced-motion: reduce)');
 function health(rail,fill,value,key,identity){
  if(!rail||!fill)return;
  const state=tracker.sample(key,value,identity,performance.now(),!!motion?.matches);
  let trail=rail.querySelector('.health-trail'),readout=rail.querySelector('.health-readout');
  if(!trail){trail=document.createElement('div');trail.className='health-trail';trail.setAttribute('aria-hidden','true');rail.prepend(trail);}
  if(!readout){readout=document.createElement('span');readout.className='health-readout';readout.setAttribute('aria-hidden','true');rail.append(readout);}
  const previous=Number(rail.dataset.hp??state.hp);rail.dataset.hit=String(state.hp<previous);rail.dataset.hp=state.hp;const person=rail.closest('.hud-person,.mini-fighter');if(person)person.dataset.hit=String(state.hp<previous);
  fill.style.width=state.hp+'%';trail.style.width=state.trail+'%';readout.textContent=Math.ceil(state.hp)+' / 100';
  rail.dataset.health=state.level;rail.setAttribute('role','meter');rail.setAttribute('aria-label',state.level==='danger'?'血量偏低':'血量');
  rail.setAttribute('aria-valuemin','0');rail.setAttribute('aria-valuemax','100');rail.setAttribute('aria-valuenow',Math.ceil(state.hp));
 }
 function meter(rail,value){
  if(!rail)return;const energy=clamp(value),level=energy>=100?'max':energy>=60?'super':energy>=25?'special':'charging';
  const before=Number(rail.dataset.energy??energy);rail.dataset.change=energy>before?'gain':energy<before?'spend':'steady';rail.dataset.energy=energy;
  rail.dataset.level=level;rail.setAttribute('role','meter');rail.setAttribute('aria-label','能量，必殺需 25、超必殺需 60');
  rail.setAttribute('aria-valuemin','0');rail.setAttribute('aria-valuemax','100');rail.setAttribute('aria-valuenow',Math.floor(energy));
  rail.title=Math.floor(energy)+' / 100 · U 25 · O 60'+(level==='max'?' · MAX':'');
 }
 function wins(el,value){
  if(!el)return;const count=Math.max(0,Math.min(2,Math.floor(value||0)));
  if(el.dataset.wins===String(count))return;el.dataset.wins=String(count);el.setAttribute('aria-label','已勝 '+count+' 回合');el.textContent='';
  for(let i=0;i<2;i++){const mark=document.createElement('span');mark.className=i<count?'round-mark won':'round-mark';mark.setAttribute('aria-hidden','true');el.append(mark);}
 }
 return {health,meter,wins,clear:()=>tracker.clear()};
}
return {create,createHealthTracker};
});
