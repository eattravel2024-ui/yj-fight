/* Sprite playback is presentation-only; move phases follow simulation frames. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiAnimation=api})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const ACTIONS=['idle','walk','jump','light','light2','light3','heavy','kick','low','upper','throw','dash','guard','hurt','special','ko','win'];
const WIDTH=240,HEIGHT=300,FRAMES=10;
const ENDING=new Set(['ko','win']);
function seconds(clock){return Number.isFinite(clock)?Math.max(0,clock):0;}
function spriteFrame(p,action,clock,move){
 const time=seconds(clock);
 if(ENDING.has(action)){
  const start=Number.isFinite(p?.animationStartedAt)?p.animationStartedAt:0;
  return Math.min(FRAMES-1,Math.floor(Math.max(0,time-start)*(action==='ko'?10:7)));
 }
 if(!move||!p?.move){const speed=action==='idle'?5.2:action==='walk'?11:action==='guard'?3.4:8;return Math.floor(time*speed)%FRAMES;}
 const n=Math.max(0,p.move.frame||0),starting=move.startup??move.start??4;if(n<starting)return Math.min(2,Math.floor(n/Math.max(1,starting)*3));
 if(n<starting+move.active)return 3+Math.min(4,Math.floor((n-starting)/Math.max(1,move.active)*5));
 return 8+Math.min(1,Math.floor((n-starting-move.active)/Math.max(1,move.recovery)*2));}
// Snapshots and interpolated fighters are new objects every render. Track slot identity,
// rather than mutating simulation players or attaching timestamps to network state.
function createPlayback(){
 const tracks=new Map();
 function frame(p,action,clock,move){
  const time=seconds(clock),key=p?.slot??p?.char??'single';
  let track=tracks.get(key);
  if(!track||track.action!==action||time<track.last||track.char!==p?.char){track={action,char:p?.char,start:time,last:time};tracks.set(key,track);}
  track.last=time;
  return ENDING.has(action)?spriteFrame({animationStartedAt:track.start},action,time,move):spriteFrame(p,action,time,move);
 }
 return {spriteFrame:frame,clear:()=>tracks.clear()};
}
return {ACTIONS,WIDTH,HEIGHT,FRAMES,spriteFrame,createPlayback};
});
