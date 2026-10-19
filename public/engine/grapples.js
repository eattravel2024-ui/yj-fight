/* Deterministic, shared 1v1/2v2 grapple lifecycle. All time is simulation frames. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./frame-data.js'):root.AzhiFrames);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiGrapples=api;})(globalThis,function(Frames){
'use strict';
const RULES=Object.freeze({techWindow:10,prebuffer:3,impactFrame:18,duration:32,wakeProtection:12,techProtection:20,techStun:12});
const clamp=x=>Math.max(48,Math.min(912,x));
function locked(p){return p?.grappleWith!==null&&p?.grappleWith!==undefined;}
function pair(a,b){return locked(a)&&a.grappleWith===b.slot;}
function release(m,g,reason){
 for(const slot of [g.attacker,g.target]){const p=m.players[slot];if(!p)continue;p.grappleWith=null;p.grappleRole=null;p.grappleFrame=0;p.y=0;p.vy=0;p.guard=false;p.throwInvuln=Math.max(p.throwInvuln||0,reason==='tech'?RULES.techProtection:RULES.wakeProtection);}
 m.grapples=(m.grapples||[]).filter(entry=>entry!==g);
}
function interrupt(m,p,reason='interrupted'){
 const g=(m.grapples||[]).find(g=>g.attacker===p.slot||g.target===p.slot);if(!g)return;
 release(m,g,reason);const attacker=m.players[g.attacker];attacker.move=null;attacker.chain=0;attacker.stun=Math.max(attacker.stun,8);
 m.events.push({kind:'grapple_break',slot:g.attacker,target:g.target,reason});
}
function clear(m){for(const g of [...m.grapples||[]])release(m,g,'round');m.grapples=[];}
function tech(m,g){
 const a=m.players[g.attacker],b=m.players[g.target];release(m,g,'tech');
 a.x=clamp(g.anchor-g.face*34);b.x=clamp(g.anchor+g.face*76);
 for(const p of [a,b]){p.move=null;p.buffer=[];p.chain=0;p.stun=Math.max(p.stun,RULES.techStun);p.blockstun=0;p.techFlash=12;}
 m.hitstop=Math.max(m.hitstop,4);m.events.push({kind:'throw_tech',slot:a.slot,target:b.slot,x:(a.x+b.x)/2,y:0,damage:0});
}
function canGrab(a,b,d){
 const upper=b&&{...Frames.MOVE.upper,...Frames.CHAR[b.char]?.moves.upper};
 return !!a&&!!b&&a.hp>0&&b.hp>0&&(a.team===undefined||a.team!==b.team)&&!locked(a)&&!locked(b)&&a.y===0&&b.y===0&&b.stun===0&&!(b.throwInvuln>0)&&!(b.dash>0&&b.dash<=6)&&!(b.move?.name==='upper'&&b.move.frame<upper.startup+upper.active)&&Math.abs(b.x-a.x)<=d.reach&&(b.x-a.x)*a.face>8;
}
function tryGrab(m,a,b,move,d){
 // team is undefined in duels; team equality only excludes real teammates.
 if(!a||!b||a.team!==undefined&&a.team===b.team)return false;
 if(!canGrab(a,b,d)||a.move!==move||move.hit)return false;
 const profile=Frames.CHAR[a.char].grapple,g={id:a.slot+':'+move.serial,attacker:a.slot,target:b.slot,frame:0,face:a.face,anchor:a.x,applied:false,style:profile.style,name:profile.name,impactFrame:profile.impactFrame||RULES.impactFrame,duration:profile.duration||RULES.duration};
 m.grapples=m.grapples||[];m.grapples.push(g);move.hit=true;move.grabbed=true;b.move=null;b.buffer=[];b.chain=0;
 for(const p of [a,b]){p.grappleWith=p===a?b.slot:a.slot;p.grappleRole=p===a?'attacker':'victim';p.grappleFrame=0;p.grappleStyle=g.style;p.guard=false;p.crouch=false;p.dash=0;p.vy=0;}
 b.x=clamp(a.x+a.face*52);m.events.push({kind:'grab',slot:a.slot,target:b.slot,name:g.name,x:a.x,y:0,techFrames:RULES.techWindow});
 if(m.tick-(b.throwPressedTick??-999)<=RULES.prebuffer)tech(m,g);
 return true;
}
function step(m,contact,moveFor){
 for(const g of [...m.grapples||[]]){
  const a=m.players[g.attacker],b=m.players[g.target];if(!a||!b||a.hp<=0||b.hp<=0){if(a)interrupt(m,a,'ko');else release(m,g,'invalid');continue;}
  if(g.frame<RULES.techWindow&&(b.throwPressedTick??-999)>=m.tick-1){tech(m,g);continue;}
  g.frame++;for(const p of [a,b]){p.grappleFrame=g.frame;p.guard=false;p.crouch=false;p.dash=0;}
  a.x=clamp(g.anchor);a.y=0;b.x=clamp(g.anchor+g.face*52);b.y=g.frame>8&&g.frame<g.impactFrame?Math.min(56,(g.frame-8)*7):0;
  if(!g.applied&&g.frame===g.impactFrame){
   g.applied=true;const move=a.move||{name:'throw',serial:a.attackSerial,frame:0};contact(m,a,b,move,moveFor(a,'throw'),{grapple:true});
   m.events.push({kind:'throw_slam',slot:a.slot,target:b.slot,name:g.name,x:b.x,y:0,style:g.style});
  }
  if(g.applied){a.x=clamp(g.anchor+(g.style==='casino_flip'?g.face*32:0));b.x=clamp(g.anchor+g.face*(g.style==='casino_flip'?-96:112));b.y=0;}
  if(g.frame>=g.duration){release(m,g,'complete');a.move=null;a.chain=0;a.stun=Math.max(a.stun,8);b.stun=Math.max(b.stun,26);b.blockstun=0;}
 }
}
return {RULES,locked,pair,canGrab,tryGrab,step,interrupt,clear};
});
