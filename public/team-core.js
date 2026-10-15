/* Azhi 8.5: simultaneous 2v2 team combat, deterministic 60Hz ruleset. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiTeamCore=api})(typeof globalThis==='object'?globalThis:this,function(root){
'use strict';
const C=(typeof module==='object'&&module.exports)?require('./core.js'):root.AzhiCore;
const FPS=C.FPS, B=C.Boxes, CHAR=C.CHAR, ATTACKS=C.ATTACKS;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const teams=['紅隊','藍隊'];
function fighter(id,slot){
 const p=C.create(id,'winnie').players[0];
 p.slot=slot;p.team=slot%2;p.x=[170,790,340,620][slot];p.face=slot%2?-1:1;p.hp=100;p.wins=0;
 p.move=null;p.buffer=[];p.airHits=0;p.combo=0;p.inputs={};p.prev={};p.lastCommand=-100;
 return p;
}
function create(chars=['azhi','winnie','sezi','gambler'],opts={}){
 const players=Array.from({length:4},(_,slot)=>fighter(chars[slot]||'azhi',slot));
 return {ruleset:'team',players,tick:0,round:1,time:90,status:'playing',pause:0,events:[],difficulty:1,stage:opts.stage||'night',seed:opts.seed||1729,hitstop:0,projectiles:[],scores:[0,0],winnerTeam:null,introDuration:C.introLength(opts.introFrames),introFrames:C.introLength(opts.introFrames)};
}
function rng(m){m.seed=(Math.imul(m.seed,1664525)+1013904223)>>>0;return m.seed/4294967296;}
function input(m,slot,keys){C.input(m,slot,keys)}
function living(m,team){return m.players.filter(p=>p.team===team&&p.hp>0)}
function nearest(m,p,forwardOnly=false){
 let opponents=living(m,1-p.team).filter(f=>!forwardOnly||(f.x-p.x)*p.face>0);
 return opponents.sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x)||a.slot-b.slot)[0]||null;
}
function startMove(m,p,name){
 if(!C.startMove(m,p,name))return false;
 p.move.hitSlots=[];p.move.hitCounts={};
 return true;
}
function hit(m,attacker,target,data,move=attacker.move,source=attacker,defence=target){
 if(!target||move.hitSlots.includes(target.slot)||!B.hits(source,defence,data))return;
 const spin=attacker.char==='sezi'&&['special','super'].includes(move.name);
 if(spin&&(move.hitCounts?.[target.slot]||0)>=3)return;
 if(data.level==='throw'&&(source.y>0||defence.y>8))return;
 if(defence.dash>0&&defence.dash<=6)return;
 const block=defence.guard&&data.level!=='throw'&&(data.level==='mid'||(data.level==='low'&&defence.crouch)||(data.level==='high'&&!defence.crouch));
 const counter=!block&&!!defence.move&&defence.move.frame<C.moveFor(defence,defence.move.name).start;
 const armor=!block&&CHAR[target.char].specialMode==='counter'&&target.armorCharges>0&&target.armorTimer>0&&['light','light2','light3'].includes(move.name);
 if(armor){target.armorCharges--;if(target.move&&['special','super'].includes(target.move.name))target.move.countered=true;}
 const counterBonus=['special','super'].includes(move.name)&&CHAR[attacker.char].specialMode==='counter'&&(counter||move.countered)?1.38:1;
 const scale=C.comboScale(m,target,move.name,!block&&!armor);
 const dmg=Math.max(1,Math.round(scale*data.damage*CHAR[attacker.char].power*(spin?.45:1)*counterBonus*(block?data.level==='mid'&&move.name==='special'?.23:.10:armor?.26:1)));
 const appliedDamage=Math.min(target.hp,dmg);target.hp=clamp(target.hp-dmg,0,100);
 if(!block&&!armor){target.blockstun=0;target.stun=Math.max(target.stun,data.hitstun+(counter?10:0));target.move=null;target.buffer=[];target.chain=0;target.flash=12;
  if(move.name==='upper'){target.vy=6.5;target.y=Math.max(1,target.y)}
 }else if(block){target.stun=Math.max(target.stun,6);target.blockstun=target.stun;}
 C.applyPushback(attacker,target,source.face*(block?7:data.knock+(counter?6:0)));
 attacker.meter=clamp(attacker.meter+(block?3:data.gain),0,100);target.meter=clamp(target.meter+(block?2:4),0,100);
 attacker.combo=!block&&m.tick-attacker.lastHit<70?attacker.combo+1:block?0:1;attacker.lastHit=m.tick;
 move.hit=true;move.blocked=block;move.hitSlots.push(target.slot);
 move.hitCounts=move.hitCounts||{};move.hitCounts[target.slot]=(move.hitCounts[target.slot]||0)+1;
 const stop=block?4:move.name==='super'?12:move.name==='special'?10:move.name==='heavy'||move.name==='upper'?8:5;
 m.hitstop=Math.max(m.hitstop,stop);
 m.events.push({kind:armor?'armor':'hit',slot:attacker.slot,target:target.slot,x:target.x,y:target.y,damage:dmg,appliedDamage,block,combo:attacker.combo,counter,counterBoost:counterBonus>1,move:move.name,hitstop:stop});
}
function spawnProjectile(m,p){
 C.spawnSpecialProjectile(m,p);m.projectiles.at(-1).team=p.team;
}
function updateProjectiles(m,snapshots=C.combatSnapshots(m)){for(let i=m.projectiles.length-1;i>=0;i--){const shot=m.projectiles[i];shot.x+=shot.vx;shot.life--;
 const owner=m.players[shot.owner];const box={x:shot.x-shot.w/2,y:shot.y-shot.h/2,w:shot.w,h:shot.h};
 const defence=snapshots.filter(q=>q.hp>0&&q.team===1-shot.team&&B.intersect(box,B.hurtbox(q))).sort((a,b)=>Math.abs(a.x-shot.x)-Math.abs(b.x-shot.x)||a.slot-b.slot)[0],foe=defence?m.players[defence.slot]:null;
 if(foe){const blocked=defence.guard&&(shot.level==='low'?defence.crouch:!defence.crouch);const scale=C.comboScale(m,foe,shot.fromMove,!blocked);const dmg=Math.max(1,Math.round(scale*shot.damage*CHAR[owner.char].power*(blocked?.1:1)));
  const appliedDamage=Math.min(foe.hp,dmg);foe.hp=clamp(foe.hp-dmg,0,100);if(!blocked){foe.blockstun=0;foe.stun=Math.max(foe.stun,30);foe.move=null;foe.buffer=[];foe.chain=0;foe.flash=12}else{foe.stun=Math.max(foe.stun,5);foe.blockstun=foe.stun;}
  C.applyPushback(owner,foe,Math.sign(shot.vx)*24);if(owner.move?.name===shot.fromMove)owner.move.hit=true;
  owner.combo=!blocked&&m.tick-owner.lastHit<70?owner.combo+1:blocked?0:1;owner.lastHit=m.tick;
  owner.meter=clamp(owner.meter+(blocked?2:8),0,100);m.hitstop=Math.max(m.hitstop,blocked?4:7);
  m.events.push({kind:'hit',slot:owner.slot,target:foe.slot,x:foe.x,y:foe.y,damage:dmg,appliedDamage,block:blocked,combo:owner.combo,counter:false,move:shot.fromMove||'special',hitstop:blocked?4:7});m.projectiles.splice(i,1);continue;}
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
function resetRound(m){m.introFrames=m.introDuration||0;m.round++;m.tick=0;m.time=90;m.status='playing';m.pause=0;m.hitstop=0;m.projectiles=[];
 m.players=m.players.map(p=>fighter(p.char,p.slot));m.events.push({kind:'text',text:'ROUND '+m.round});
}
function step(m){
 if(m.status==='between'){if(--m.pause<=0)resetRound(m);return}
 if(m.status!=='playing')return;
 if(C.entranceStep(m))return;
 if(m.hitstop>0){m.hitstop--;return}
 m.tick++;m.time-=1/FPS;const pending=[];
 for(const p of m.players){
  if(p.hp<=0){p.guard=false;p.move=null;continue}
  const foe=nearest(m,p);if(foe)p.face=p.x<=foe.x?1:-1;
 }
 for(const p of m.players)if(p.hp>0)C.prepareFighter(p,m.tick);
 for(const p of m.players){if(p.hp<=0)continue;
  if(p.move){const name=p.move.name,d=C.moveFor(p,name);p.move.frame++;
   if(p.move.frame>=d.start&&p.move.frame<d.start+d.active){
    if((name==='special'||name==='super')&&['cards','shockwave'].includes(CHAR[p.char].specialMode)){
      if(!p.move.spawned){spawnProjectile(m,p);p.move.spawned=true}
    }else{
      if((name==='special'||name==='super')&&p.char==='sezi')p.x=clamp(p.x+p.face*3.3,48,912);
      if((name==='special'||name==='super')&&p.char==='sezi'&&(p.move.frame-d.start)%4===0){p.move.hitSlots=[]}
      if(p.move.frame===d.start&&(name==='heavy'||name==='upper'))p.x=clamp(p.x+p.face*11,48,912);
      for(const target of living(m,1-p.team))pending.push({p,target,d,move:p.move});
    }
   }
   if(p.move&&p.move.frame>=d.start+d.active+d.recovery){p.move=null;p.chain=0}
  }
  if(p.stun===0&&!p.move){const dir=Number(!!p.inputs.right)-Number(!!p.inputs.left);
   if(p.inputs.dash&&dir&&p.dashCd===0&&p.y===0){p.dash=12;p.dashCd=48;m.events.push({kind:'dash',slot:p.slot,x:p.x})}
   if(p.dash>0){p.x+=dir*8;p.dash--}else if(!p.guard&&!p.crouch)p.x+=dir*CHAR[p.char].speed;
   if(p.inputs.up&&p.y===0&&!p.guard){p.vy=7.5*CHAR[p.char].air;p.y=.5;m.events.push({kind:'jump',slot:p.slot,x:p.x})}
   if(!p.guard){const q=C.bufferedMove(p);if(q){p.buffer.splice(p.buffer.indexOf(q),1);startMove(m,p,q.key)}}
  }
  if(p.y>0||p.vy>0){p.y+=p.vy;p.vy-=.3375;if(p.y<=0){p.y=0;p.vy=0}}
  p.x=clamp(p.x,48,912);
 }
 const snapshots=C.combatSnapshots(m);
 for(const {p,target,d,move} of pending)hit(m,p,target,d,move,snapshots[p.slot],snapshots[target.slot]);
 updateProjectiles(m,snapshots);for(const p of m.players)C.resolveCancels(m,p,startMove);
 resolveAll(m);finishRound(m);
}
function serialize(m){return {ruleset:'team',type:'state',status:m.status,round:m.round,time:Math.max(0,Math.ceil(m.time)),tick:m.tick,introDuration:m.introDuration||0,introFrames:m.introFrames||0,serverHz:FPS,stage:m.stage,scores:m.scores.slice(),winnerTeam:m.winnerTeam,hitstop:m.hitstop,projectiles:m.projectiles.map(p=>({...p})),players:m.players.map(p=>({slot:p.slot,team:p.team,char:p.char,x:p.x,y:p.y,hp:p.hp,meter:p.meter,face:p.face,guard:p.guard,crouch:p.crouch,stun:p.stun,blockstun:p.blockstun,move:p.move?{name:p.move.name,frame:p.move.frame,hit:p.move.hit,blocked:p.move.blocked}:null,flash:p.flash,combo:p.combo,dash:p.dash,vy:p.vy,armorTimer:p.armorTimer,armorCharges:p.armorCharges})),events:m.events.splice(0,50)};}
return {FPS,CHAR,teams,ATTACKS,create,input,step,serialize,nearest,living};
});
