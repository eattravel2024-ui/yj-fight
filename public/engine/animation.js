/* Presentation-only atlas playback. Attacks and airborne poses follow simulation state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiAnimation=api})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const ACTIONS=['idle','walk','jump','light','light2','light3','heavy','kick','low','upper','throw','dash','guard','hurt','special','ko','win'];
const WIDTH=240,HEIGHT=300,FRAMES=10;
const DEFAULT_SIZE=Object.freeze({width:WIDTH,height:HEIGHT}),VIDEO_SIZE=Object.freeze({width:384,height:HEIGHT});
function frameSize(char){return char==='azhi'||char==='gambler'?VIDEO_SIZE:DEFAULT_SIZE;}
const ENDING=new Set(['ko','win']);
// Hold distinct anticipation/contact poses in the existing ten-frame skill atlases.
const SKILL_POSES={
 winnie:[[0,0,1,2],[3,4,5,5,6,7],[8,8,9]],
 sezi:[[0,1,2],[3,4,5,6,7,3,4,5,6,7],[8,9]],
 gambler:[[0,1,1,2],[3,3,4,5,6,7],[8,9,9]],
 azhi:[[0,1,2,2],[3,4,4,5,6,7],[8,9,9]]
};
function seconds(clock){return Number.isFinite(clock)?Math.max(0,clock):0;}
function sample(poses,progress){return poses[Math.min(poses.length-1,Math.floor(Math.max(0,progress)*poses.length))];}
function spriteFrame(p,action,clock,move){
 const time=seconds(clock);
 if(ENDING.has(action)){
  const start=Number.isFinite(p?.animationStartedAt)?p.animationStartedAt:0;
  return Math.min(FRAMES-1,Math.floor(Math.max(0,time-start)*(action==='ko'?10:7)));
 }
 if(!move||!p?.move){
  if(action==='jump')return p?.vy>1?sample([0,1,2,3],1-p.vy/9):p?.vy>=-1?4:sample([5,6,7,8,9],Math.abs(p?.vy||0)/9);
  if(action==='dash')return Math.min(9,Math.floor((12-Math.max(0,p?.dash||0))*10/12));
  if(action==='hurt')return p?.flash>0?Math.min(4,Math.floor((12-p.flash)*5/12)):8;
  const speed=action==='idle'?5.2:action==='walk'?11:action==='guard'?3.4:8;return Math.floor(time*speed)%FRAMES;
 }
 const n=Math.max(0,p.move.frame||0),starting=move.startup??move.start??4;
 const poses=action==='special'&&SKILL_POSES[p.char]||[[0,1,2],[3,4,5,6,7],[8,9]];
 if(n<starting)return sample(poses[0],n/Math.max(1,starting));
 if(n<starting+move.active)return sample(poses[1],(n-starting)/Math.max(1,move.active));
 return sample(poses[2],(n-starting-move.active)/Math.max(1,move.recovery));
}
// Track slot identity, never attach clocks to rollback simulation objects.
function createPlayback(){
 const tracks=new Map();
 function frame(p,action,clock,move,game){
  const time=seconds(clock),key=p?.slot??p?.char??'single';let track=tracks.get(key);
  if(!track||time<track.last||track.char!==p?.char){track={action,char:p?.char,start:time,last:time,paused:0,frame:0};tracks.set(key,track);}
  // All characters hold their last rendered pose during hitstop, including idle/hurt.
  if(game?.hitstop>0){track.paused+=time-track.last;track.last=time;return track.frame;}
  const visualTime=time-track.paused;
  if(track.action!==action){track.action=action;track.start=visualTime;}
  track.last=time;
  track.frame=ENDING.has(action)?spriteFrame({animationStartedAt:track.start},action,visualTime,move):spriteFrame(p,action,visualTime,move);
  return track.frame;
 }
 return {spriteFrame:frame,clear:()=>tracks.clear()};
}
return {ACTIONS,WIDTH,HEIGHT,FRAMES,frameSize,spriteFrame,createPlayback};
});
