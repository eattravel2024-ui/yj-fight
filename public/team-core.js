/* Azhi 8.5: simultaneous 2v2 team combat, deterministic 60Hz ruleset. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiTeamCore=api})(typeof globalThis==='object'?globalThis:this,function(root){
'use strict';
const C=(typeof module==='object'&&module.exports)?require('./core.js'):root.AzhiCore;
const FPS=C.FPS, B=C.Boxes, CHAR=C.CHAR, ATTACKS=C.ATTACKS;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const teams=['紅隊','藍隊'];
function fighter(id,slot){
 const p=C.create(id,'sam').players[0];
 p.slot=slot;p.team=slot%2;p.x=[170,790,340,620][slot];p.face=slot%2?-1:1;p.hp=100;p.wins=0;
 p.move=null;p.buffer=[];p.airHits=0;p.combo=0;p.inputs={};p.prev={};p.lastCommand=-100;
 return p;
}
function create(chars=['azhi','sam','sezi','gambler'],opts={}){
 const players=Array.from({length:4},(_,slot)=>fighter(chars[slot]||'azhi',slot));
 return {ruleset:'team',players,tick:0,round:1,time:90,status:'playing',pause:0,events:[],difficulty:1,stage:opts.stage||'night',seed:opts.seed||1729,hitstop:0,projectiles:[],scores:[0,0],winnerTeam:null};
}
function rng(m){m.seed=(Math.imul(m.seed,1664525)+1013904223)>>>0;return m.seed/4294967296;}
function input(m,slot,keys){C.input(m,slot,keys)}
function living(m,team){return m.players.filter(p=>p.team===team&&p.hp>0)}
function nearest(m,p,forwardOnly=false){
 let opponents=living(m,1-p.team).filter(f=>!forwardOnly||(f.x-p.x)*p.face>0);
 return opponents.sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x)||a.slot-b.slot)[0]||null;
}
function startMove(m,p,name){
 let move=name;
 if(move==='light'){if(p.chain===1)move='light2';else if(p.chain>=2)move='light3';}
 const data=C.moveFor(p,move);if(!data||p.meter<(data.cost||0))return false;
 p.chain=move.startsWith('light')?(move==='light'?1:move==='light2'?2:0):0;
 p.move={name:move,frame:0,hit:false,blocked:false,hits:0,spawned:false,hitSlots:[]};p.meter=clamp(p.meter-(data.cost||0),0,100);p.crouch=false;
 if(p.char==='azhi'&&move==='super'){p.armorTimer=180;p.armorCharges=1}
 m.events.push({kind:'swing',slot:p.slot,name:move});
 if(move==='super')m.events.push({kind:'super',slot:p.slot,char:p.char,x:p.x,y:p.y});
 return true;
}
function canCancel(p){if(!p.move)return false;const a=p.move,d=C.moveFor(p,a.name);return !!d.cancelable&&(a.hit||a.blocked)&&a.frame>=d.cancelWindow[0]&&a.frame<=d.cancelWindow[1]}
function hit(m,attacker,target,data){
 const move=attacker.move;if(!target||move.hitSlots.includes(target.slot)||!B.hits(attacker,target,data))return;
 if(target.dash>0&&target.dash<=6)return;
 const block=target.guard&&data.level!=='throw'&&(data.level==='mid'||(data.level==='low'&&target.crouch)||(data.level==='high'&&!target.crouch));
 const counter=!block&&!!target.move&&target.move.frame<C.moveFor(target,target.move.name).start;
 const armor=!block&&target.char==='azhi'&&target.armorCharges>0&&target.armorTimer>0&&move.name==='light';
 if(armor)target.armorCharges--;
 const dmg=Math.max(1,Math.round(data.damage*CHAR[attacker.char].power*(block?.12:armor?.25:1)*(counter&&attacker.char==='azhi'?1.35:1)));
 target.hp=clamp(target.hp-dmg,0,100);
 if(!block&&!armor){target.stun=Math.max(target.stun,data.hitstun+(counter?9:0));target.move=null;target.buffer=[];target.chain=0;target.flash=12;
  if(move.name==='upper'){target.vy=6.4;target.y=Math.max(1,target.y)}
 }else if(block){target.stun=Math.max(target.stun,5)}
 C.applyPushback(attacker,target,attacker.face*(block?7:data.knock||19));
 attacker.meter=clamp(attacker.meter+(block?3:data.gain||5),0,100);target.meter=clamp(target.meter+4,0,100);
 attacker.combo=!block&&m.tick-attacker.lastHit<70?attacker.combo+1:1;attacker.lastHit=m.tick;
 move.hit=true;move.blocked=block;move.hitSlots.push(target.slot);
 m.hitstop=Math.max(m.hitstop,block?4:move.name==='super'?12:move.name==='heavy'?8:5);
 m.events.push({kind:'hit',slot:attacker.slot,target:target.slot,x:target.x,y:target.y,damage:dmg,block,combo:attacker.combo,counter,move:move.name});
}
function spawnProjectile(m,p){
 const superMove=p.move?.name==='super';const wave=p.char==='winnie';
 const value=p.char==='gambler'?rng(m):.5;const fortune=p.char==='gambler'?(value<.16?'jackpot':value>.91?'blank':'standard'):'standard';
 if(p.char==='gambler')m.events.push({kind:'fortune',slot:p.slot,fortune});
 const x=p.x+p.face*60,y=wave?35:p.y+112;
 m.projectiles.push({owner:p.slot,team:p.team,char:p.char,kind:wave?'wave':'card',level:wave?'low':'mid',x,y,vx:p.face*(wave?8:10),life:44,w:wave?64:38,h:wave?38:27,damage:(superMove?30:16)*(fortune==='jackpot'?1.7:fortune==='blank'?.35:1),fortune,hitSlots:[]});
 m.events.push({kind:'projectile',slot:p.slot,x,y,style:wave?'wave':'card',super:superMove});
}
function updateProjectiles(m){for(let i=m.projectiles.length-1;i>=0;i--){const shot=m.projectiles[i];shot.x+=shot.vx;shot.life--;
 const owner=m.players[shot.owner];const box={x:shot.x-shot.w/2,y:shot.y-shot.h/2,w:shot.w,h:shot.h};
 const foe=living(m,1-shot.team).filter(q=>B.intersect(box,B.hurtbox(q))).sort((a,b)=>Math.abs(a.x-shot.x)-Math.abs(b.x-shot.x)||a.slot-b.slot)[0];
 if(foe){const blocked=foe.guard&&(shot.level==='low'?foe.crouch:!foe.crouch);const dmg=Math.max(1,Math.round(shot.damage*CHAR[owner.char].power*(blocked?.12:1)));
  foe.hp=clamp(foe.hp-dmg,0,100);if(!blocked){foe.stun=Math.max(foe.stun,28);foe.move=null;foe.buffer=[];foe.flash=12}else foe.stun=Math.max(foe.stun,5);
  C.applyPushback(owner,foe,Math.sign(shot.vx)*23);owner.combo=1;owner.lastHit=m.tick;m.hitstop=Math.max(m.hitstop,blocked?4:7);
  m.events.push({kind:'hit',slot:owner.slot,target:foe.slot,x:foe.x,y:foe.y,damage:dmg,block:blocked,combo:1,counter:false,move:'special'});m.projectiles.splice(i,1);continue;}
 if(shot.life<=0||shot.x<-50||shot.x>1010)m.projectiles.splice(i,1);
}}
function resolveAll(m){for(let rep=0;rep<3;rep++)for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
 const a=m.players[i],b=m.players[j];if(a.hp<=0||b.hp<=0)continue;C.resolvePushboxes(a,b);
}}
function finishRound(m){if(m.status!=='playing')return;
 const red=living(m,0),blue=living(m,1);
 const total=t=>living(m,t).reduce((n,p)=>n+p.hp,0);
 let winner=null;
 if(!red.length&&blue.length)winner=1;else if(!blue.length&&red.length)winner=0;
 else if(!red.length&&!blue.length)winner=-1;
 else if(m.time<=0)winner=total(0)===total(1)?-1:total(0)>total(1)?0:1;
 if(winner===null)return;
 if(winner>=0)m.scores[winner]++;
 m.events.push({kind:'round',winner,round:m.round,team:winner});
 if(m.scores.some(n=>n>=2)){m.status='finished';m.winnerTeam=m.scores[0]>m.scores[1]?0:1;m.events.push({kind:'finish',winnerTeam:m.winnerTeam});return}
 m.status='between';m.pause=120;
}
function resetRound(m){m.round++;m.tick=0;m.time=90;m.status='playing';m.pause=0;m.hitstop=0;m.projectiles=[];
 m.players=m.players.map(p=>fighter(p.char,p.slot));m.events.push({kind:'text',text:'ROUND '+m.round});
}
function step(m){
 if(m.status==='between'){if(--m.pause<=0)resetRound(m);return}
 if(m.status!=='playing')return;
 if(m.hitstop>0){m.hitstop--;return}
 m.tick++;m.time-=1/FPS;
 for(const p of m.players){
  if(p.hp<=0){p.guard=false;p.move=null;continue}
  const foe=nearest(m,p);if(foe)p.face=p.x<=foe.x?1:-1;
 }
 for(const p of m.players){if(p.hp<=0)continue;
  p.stun=Math.max(0,p.stun-1);p.flash=Math.max(0,p.flash-1);p.armorTimer=Math.max(0,p.armorTimer-1);p.dashCd=Math.max(0,p.dashCd-1);if(!p.armorTimer)p.armorCharges=0;
  p.buffer=p.buffer.filter(q=>q.until>=m.tick);p.crouch=!!p.inputs.down&&!p.move&&p.y===0;p.guard=!!p.inputs.guard&&p.stun===0&&!p.move&&p.y===0;
  if(p.move){const name=p.move.name,d=C.moveFor(p,name);p.move.frame++;
   if(p.move.frame>=d.start&&p.move.frame<d.start+d.active){
    if((name==='special'||name==='super')&&['gambler','winnie'].includes(p.char)){
      if(!p.move.spawned){spawnProjectile(m,p);p.move.spawned=true}
    }else{
      if((name==='special'||name==='super')&&['sam','sezi'].includes(p.char))p.x=clamp(p.x+p.face*3.9,48,912);
      if((name==='special'||name==='super')&&p.char==='sezi'&&(p.move.frame-d.start)%4===0){p.move.hitSlots=[]}
      for(const target of living(m,1-p.team))hit(m,p,target,d);
    }
   }
   if(p.move&&canCancel(p)){const q=p.buffer.find(item=>C.canChain(p.move.name,item.key));if(q){p.buffer.splice(p.buffer.indexOf(q),1);startMove(m,p,q.key)}}
   if(p.move&&p.move.frame>=d.start+d.active+d.recovery){p.move=null;p.chain=0}
  }
  if(p.stun===0&&!p.move){const dir=Number(!!p.inputs.right)-Number(!!p.inputs.left);
   if(p.inputs.dash&&dir&&p.dashCd===0&&p.y===0){p.dash=12;p.dashCd=48;m.events.push({kind:'dash',slot:p.slot,x:p.x})}
   if(p.dash>0){p.x+=dir*8;p.dash--}else if(!p.guard&&!p.crouch)p.x+=dir*CHAR[p.char].speed;
   if(p.inputs.up&&p.y===0&&!p.guard){p.vy=7.5*CHAR[p.char].air;p.y=.5;m.events.push({kind:'jump',slot:p.slot,x:p.x})}
   if(!p.guard&&p.buffer.length){const q=p.buffer.shift();startMove(m,p,q.key)}
  }
  if(p.y>0||p.vy>0){p.y+=p.vy;p.vy-=.3375;if(p.y<=0){p.y=0;p.vy=0}}
  p.x=clamp(p.x,48,912);
 }
 updateProjectiles(m);resolveAll(m);finishRound(m);
}
function serialize(m){return {ruleset:'team',type:'state',status:m.status,round:m.round,time:Math.max(0,Math.ceil(m.time)),tick:m.tick,serverHz:FPS,stage:m.stage,scores:m.scores.slice(),winnerTeam:m.winnerTeam,hitstop:m.hitstop,projectiles:m.projectiles.map(p=>({...p})),players:m.players.map(p=>({slot:p.slot,team:p.team,char:p.char,x:p.x,y:p.y,hp:p.hp,meter:p.meter,face:p.face,guard:p.guard,crouch:p.crouch,stun:p.stun,move:p.move?{name:p.move.name,frame:p.move.frame,hit:p.move.hit}:null,flash:p.flash,combo:p.combo,dash:p.dash,vy:p.vy,armorTimer:p.armorTimer,armorCharges:p.armorCharges})),events:m.events.splice(0,50)};}
return {FPS,CHAR,teams,ATTACKS,create,input,step,serialize,nearest,living};
});
