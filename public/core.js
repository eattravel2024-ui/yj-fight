/* 阿志向錢衝 8.2：確定性 60Hz 格鬥引擎，雙端共用 */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiCore=api})(typeof globalThis==='object'?globalThis:this,function(root){
'use strict';
const FPS=60, INPUT_BUFFER=8, MIN_X=48, MAX_X=912;
const {CHAR,MOVE}=typeof require==='function'&&typeof module==='object'?require('./engine/frame-data.js'):root.AzhiFrames;
const Commands=typeof require==='function'&&typeof module==='object'?require('./engine/commands.js'):root.AzhiCommands;
const Boxes=typeof require==='function'&&typeof module==='object'?require('./engine/boxes.js'):root.AzhiBoxes;
const AI=typeof require==='function'&&typeof module==='object'?require('./engine/ai.js'):root.AzhiAI;
function moveFor(p,name){const base=Object.hasOwn(MOVE,name)?MOVE[name]:null;if(!base)return null;const cid=typeof p==='string'?p:p?.char;const mod=Object.hasOwn(CHAR,cid)?CHAR[cid].moves?.[name]:null;if(!mod)return base;const m={...base,...mod};m.start=m.startup;m.cancelStart=m.startup+Math.max(1,Math.floor(m.active*.45));m.cancelEnd=m.startup+m.active+Math.max(2,Math.floor(m.recovery*.36));m.cancelable=true;m.cancelWindow=[m.cancelStart,m.cancelEnd];return m;}
const ATTACKS=['light','heavy','kick','low','upper','throw','special','super'];
const bound=(v,a,b)=>Math.max(a,Math.min(b,v));
function fighter(char,slot){char=Object.hasOwn(CHAR,char)?char:'azhi';return {slot,char,x:slot?686:274,y:0,vy:0,face:slot?-1:1,hp:100,meter:30,wins:0,stun:0,guard:false,crouch:false,move:null,combo:0,lastHit:-999,flash:0,dash:0,dashCd:0,inputs:{},prev:{},buffer:[],ko:false,chain:0,airHits:0,cpuWait:0,motion:[],lastCommand:-100,guardFrames:0,lastDashCommand:-100,armorTimer:0,armorCharges:0}}
function create(a='azhi',b='winnie',opts={}){const m={players:[fighter(a,0),fighter(b,1)],tick:0,round:1,time:75,status:'playing',pause:0,events:[],difficulty:opts.difficulty??1,stage:opts.stage||'night',seed:opts.seed||137,hitstop:0,projectiles:[],practice:!!opts.practice,introDuration:introLength(opts.introFrames),introFrames:introLength(opts.introFrames)};if(opts.practice){m.players[0].meter=100;m.players[1].meter=100;}return m;}
function introLength(value){return Number.isSafeInteger(value)?bound(value,0,180):0}
function entranceStep(m){if(!(m.introFrames>0))return false;m.introFrames--;for(const p of m.players){p.inputs={};p.prev={};p.buffer=[];p.motion=[];}return true}
function rng(m){m.seed=(m.seed*1664525+1013904223)>>>0;return m.seed/4294967296}
function reset(m){m.introFrames=m.introDuration||0;m.tick=0;m.time=75;m.status='playing';m.pause=0;m.hitstop=0;m.events=[];m.projectiles=[];m.players=m.players.map(p=>{const f=fighter(p.char,p.slot);f.wins=p.wins;return f});m.events.push({kind:'text',text:'ROUND '+m.round})}
function input(m,slot,keys){
 const p=m.players[slot];if(!p||m.introFrames>0)return;
 const k={};for(const key of ['left','right','up','down','guard','dash',...ATTACKS])k[key]=keys?.[key]===true;
 Commands.record(p,k,m.tick);if(Commands.doubleTap(p,m.tick))k.dash=true;
 const pulses=Array.isArray(keys?.pulses)?keys.pulses.filter(x=>ATTACKS.includes(x)).slice(0,6):[];
 for(const key of ATTACKS){if(k[key]&&!p.inputs[key]&&!pulses.includes(key))pulses.push(key)}
 for(const original of pulses){let key=original;
   if((original==='light'||original==='heavy')&&p.lastCommand!==m.tick){const motion=Commands.command(p,original,m.tick);if(motion==='special'&&p.meter>=MOVE.special.cost||motion==='upper'&&original==='heavy'){key=motion;p.lastCommand=m.tick;m.events.push({kind:'command',slot,key,motion:original})}}
   p.buffer.push({key,until:m.tick+INPUT_BUFFER});m.events.push({kind:'press',slot,key});
 }
 p.buffer=p.buffer.slice(-8);p.prev=p.inputs;p.inputs=k;
}
function startMove(m,p,name){let key=name;
 if(key==='light'){if(p.chain===1)key='light2';else if(p.chain>=2)key='light3';}
 const d=moveFor(p,key);if(!d||p.meter<(d.cost||0))return false;
 const wasLight=p.move&&p.move.name.startsWith('light');
 p.chain=key.startsWith('light')?(key==='light'?1:key==='light2'?2:0):0;
 p.move={name:key,frame:0,hit:false,blocked:false,hits:0,spawned:false};p.meter=bound(p.meter-(d.cost||0),0,100);p.crouch=false;
 if(CHAR[p.char].specialMode==='counter'&&(key==='special'||key==='super')){p.armorTimer=key==='super'?180:d.startup;p.armorCharges=1;m.events.push({kind:'buff',slot:p.slot,style:'black-gold'})}
 if(key==='special'&&p.char==='sezi')p.x=bound(p.x+p.face*23,48,912);
 m.events.push({kind:'swing',slot:p.slot,name:key,chain:!!wasLight});
 if(key==='special'||key==='super'){const char=CHAR[p.char];m.events.push({kind:'skill',slot:p.slot,char:p.char,move:key,name:key==='super'?char.superName:char.special,style:char.specialMode,direction:p.face,x:p.x,y:p.y})}
 if(key==='super')m.events.push({kind:'super',slot:p.slot,char:p.char,x:p.x,y:p.y});return true;
}
function canAfford(p,name){const data=moveFor(p,name);return !!data&&p.meter>=(data.cost||0)}
function bufferedMove(p,predicate=()=>true){return p.buffer.find(q=>predicate(q.key)&&canAfford(p,q.key))}
// Resolve timer expiry and guard for every fighter before either side can hit.
function prepareFighter(p,tick){
 p.stun=Math.max(0,p.stun-1);p.flash=Math.max(0,p.flash-1);p.armorTimer=Math.max(0,p.armorTimer-1);if(!p.armorTimer)p.armorCharges=0;p.dashCd=Math.max(0,p.dashCd-1);
 p.buffer=p.buffer.filter(q=>q.until>=tick);p.crouch=!!p.inputs.down&&p.y===0&&!p.move;
 p.guard=!!p.inputs.guard&&p.stun===0&&!p.move&&p.y===0;
}
function overlap(p,foe,d){return Boxes.hits(p,foe,d)}
function hit(m,p,foe){const a=p.move;if(!a||a.hit)return;const d=moveFor(p,a.name);if(!overlap(p,foe,d))return;
 if(d.level==='throw'&&(p.y>0||foe.y>8))return;
 if(foe.dash>0&&foe.dash<=6)return;
 const blocking=foe.guard&&d.level!=='throw'&&(d.level==='mid'||(d.level==='low'&&foe.crouch)||(d.level==='high'&&!foe.crouch));
 const counter=!blocking&&!!foe.move&&foe.move.frame<moveFor(foe,foe.move.name).start;
 const multi=(a.name==='special'||a.name==='super')&&p.char==='sezi'?0.45:1;
 const counterBonus=(a.name==='special'||a.name==='super')&&CHAR[p.char].specialMode==='counter'&&(counter||a.countered)?1.38:1;
 const counterArmor=!blocking&&CHAR[foe.char].specialMode==='counter'&&foe.armorCharges>0&&foe.armorTimer>0&&['light','light2','light3'].includes(a.name);
 const armored=counterArmor;
 if(counterArmor){foe.armorCharges--;if(foe.move&&['special','super'].includes(foe.move.name))foe.move.countered=true;}
 const dmg=Math.max(1,Math.round(d.damage*CHAR[p.char].power*multi*counterBonus*(blocking?d.level==='mid'&&a.name==='special'?.23:.10:armored?.26:1)));
 a.hit=true;a.blocked=blocking;a.hits=(a.hits||0)+1;
 foe.hp=bound(foe.hp-dmg,0,100);
 if(!blocking&&!armored){foe.stun=Math.max(foe.stun,d.hitstun+(counter?10:0));foe.move=null;foe.buffer=[];foe.chain=0;foe.flash=12;
  if(a.name==='upper'){foe.vy=6.5;foe.y=Math.max(foe.y,1)}
 }else if(!armored)foe.stun=Math.max(6,foe.stun);
 applyPushback(p,foe,p.face*(blocking?7:d.knock+(counter?6:0)));
 p.meter=bound(p.meter+(blocking?3:d.gain),0,100);foe.meter=bound(foe.meter+(blocking?2:4),0,100);
 p.combo=(!blocking&&m.tick-p.lastHit<70)?p.combo+1:(blocking?0:1);p.lastHit=m.tick;
 const stop=blocking?4:a.name==='super'?12:a.name==='special'?10:a.name==='heavy'||a.name==='upper'?8:5;m.hitstop=Math.max(m.hitstop,stop);
 m.events.push({kind:armored?'armor':'hit',slot:p.slot,x:foe.x,y:foe.y,damage:dmg,block:blocking,combo:p.combo,counter,move:a.name,hitstop:stop});
}
function spawnSpecialProjectile(m,p){
 const isSuper=p.move?.name==='super';const isWave=p.char==='winnie';
 // Deterministic seeded roulette: every client/server running identical inputs gets the same outcome.
 const roll=CHAR[p.char].specialMode==='cards'?rng(m):.5;
 const fortune=CHAR[p.char].specialMode==='cards'?(roll<.16?'jackpot':roll>.91?'blank':'standard'):'standard';
 if(CHAR[p.char].specialMode==='cards'){m.events.push({kind:'fortune',slot:p.slot,fortune});if(fortune==='blank')p.stun=Math.max(p.stun,9)}
 const py=isWave?35:p.y+112;
 m.projectiles.push({owner:p.slot,char:p.char,kind:isWave?'wave':'card',level:isWave?'low':'mid',x:p.x+p.face*(isWave?65:62),y:py,vx:p.face*(isWave?8.2:10.5),life:isWave?45:42,w:isWave?(isSuper?81:58):(isSuper?52:38),h:isWave?34:24,damage:(isWave?14:16)*(isSuper?1.85:1)*(fortune==='jackpot'?1.75:fortune==='blank'?.3:1),fortune,fromMove:p.move?.name||'special'});
 m.events.push({kind:'projectile',slot:p.slot,x:p.x,y:py,style:isWave?'wave':'card',super:isSuper});
}
function updateProjectiles(m){
 for(let i=m.projectiles.length-1;i>=0;i--){const shot=m.projectiles[i];shot.x+=shot.vx;shot.life--;
  const foe=m.players[1-shot.owner],p=m.players[shot.owner];
  const rect={x:shot.x-shot.w/2,y:shot.y-shot.h/2,w:shot.w,h:shot.h};
  if(Boxes.intersect(rect,Boxes.hurtbox(foe))){
   const blocked=foe.guard&&(shot.level==='low'?foe.crouch:!foe.crouch);
   const dmg=Math.max(1,Math.round(shot.damage*CHAR[p.char].power*(blocked?.1:1)));
   foe.hp=bound(foe.hp-dmg,0,100);
   if(!blocked){foe.stun=Math.max(foe.stun,30);foe.move=null;foe.chain=0;foe.flash=12;}else foe.stun=Math.max(foe.stun,5);
   applyPushback(p,foe,Math.sign(shot.vx)*24);
   if(p.move?.name===shot.fromMove)p.move.hit=true;
   p.combo=(!blocked&&m.tick-p.lastHit<70)?p.combo+1:(blocked?0:1);p.lastHit=m.tick;
   p.meter=bound(p.meter+(blocked?2:8),0,100);m.hitstop=Math.max(m.hitstop,blocked?4:7);
   m.events.push({kind:'hit',slot:p.slot,x:foe.x,y:foe.y,damage:dmg,block:blocked,combo:p.combo,counter:false,move:shot.fromMove||'special',hitstop:blocked?4:7});
   m.projectiles.splice(i,1);continue;
  }
  if(shot.life<=0||shot.x<0||shot.x>960)m.projectiles.splice(i,1);
 }
}
// When the defender touches a wall, any blocked knockback transfers to the attacker.
function applyPushback(attacker,defender,delta){
 const old=defender.x, goal=old+delta;defender.x=bound(goal,MIN_X,MAX_X);
 const blocked=goal-defender.x;if(Math.abs(blocked)>0.01)attacker.x=bound(attacker.x-blocked,MIN_X,MAX_X);
}
function resolvePushboxes(a,b){
 const margin=58;const dist=b.x-a.x; if(Math.abs(dist)>=margin)return;
 const sign=dist>=0?1:-1;const need=margin-Math.abs(dist);
 const shiftA=bound(a.x-sign*need/2,MIN_X,MAX_X);const shiftB=bound(b.x+sign*need/2,MIN_X,MAX_X);
 a.x=shiftA;b.x=shiftB;
 const remain=margin-Math.abs(b.x-a.x);if(remain>0.01){
  const roomA=sign>0?a.x-MIN_X:MAX_X-a.x,roomB=sign>0?MAX_X-b.x:b.x-MIN_X;
  if(roomA>=roomB)a.x=bound(a.x-sign*remain,MIN_X,MAX_X);else b.x=bound(b.x+sign*remain,MIN_X,MAX_X);
 }
}
function endRound(m){if(m.status!=='playing')return;const [a,b]=m.players;const winner=a.hp===b.hp?-1:a.hp>b.hp?0:1;if(winner>=0)m.players[winner].wins++;
 m.status='between';m.pause=120;m.events.push({kind:'round',winner,round:m.round});if(m.players.some(p=>p.wins>=2)){m.status='finished';m.pause=0;m.winner=winner;m.events.push({kind:'finish',winner})}
}
function canCancel(p){if(!p.move)return false;const a=p.move,d=moveFor(p,a.name);return !!d.cancelable&&(a.hit||a.blocked)&&a.frame>=d.cancelWindow[0]&&a.frame<=d.cancelWindow[1]}
// Strict gatling tree. The next button is only consumed on a confirmed hit or block.
function canChain(from,next){
 const tree={
  light:['light','heavy','kick','low','upper','special'],
  light2:['light','heavy','kick','low','upper','special'],
  light3:['special','super'],
  kick:['heavy','low','upper','special'],low:['heavy','upper','special'],
  heavy:['special','super'],upper:['super'],throw:[],special:['super'],super:[]
 };
 return !!tree[from]?.includes(next);
}

function step(m){if(m.status==='between'){if(--m.pause<=0){m.round++;reset(m)}return}if(m.status!=='playing')return;
 if(entranceStep(m))return;
 // Hitstop freezes the scene, but input() still buffers new key edges. This allows responsive hit confirms.
 if(m.hitstop>0){m.hitstop--;return;}
 m.tick++;m.time-=1/FPS;const [a,b]=m.players;a.face=a.x<=b.x?1:-1;b.face=-a.face;
 // Resolve defensive state simultaneously before resolving either player's attack.
 for(const p of m.players)prepareFighter(p,m.tick);
 for(const p of m.players){const foe=m.players[1-p.slot];
  if(p.move){const name=p.move.name,d=moveFor(p,name);p.move.frame++;
    if(p.move.frame>=d.start&&p.move.frame<d.start+d.active){
      if((name==='special'||name==='super')&&['cards','shockwave'].includes(CHAR[p.char].specialMode)){
       if(!p.move.spawned){spawnSpecialProjectile(m,p);p.move.spawned=true}
      }else{
       if((name==='special'||name==='super')&&p.char==='sezi'){
        p.x=bound(p.x+p.face*3.3,48,912);
        if((p.move.frame-d.start)%4===0&&(p.move.hits||0)<3)p.move.hit=false;
       }
      }
      if(p.move.frame===d.start&&(name==='heavy'||name==='upper'))p.x=bound(p.x+p.face*11,48,912);if(!((name==='special'||name==='super')&&['cards','shockwave'].includes(CHAR[p.char].specialMode)))hit(m,p,foe)}
    if(p.move&&canCancel(p)){const q=bufferedMove(p,key=>canChain(p.move.name,key));if(q){p.buffer.splice(p.buffer.indexOf(q),1);startMove(m,p,q.key)}}
    if(p.move&&p.move.frame>=d.start+d.active+d.recovery){p.move=null;p.chain=0}
  }
  if(p.stun===0&&!p.move){const direction=Number(!!p.inputs.right)-Number(!!p.inputs.left);
   if(p.inputs.dash&&direction&&p.dashCd===0&&p.y===0){p.dash=12;p.dashCd=48;m.events.push({kind:'dash',slot:p.slot,x:p.x})}
   if(p.dash>0){p.x+=direction*8;p.dash--}else if(!p.guard&&!p.crouch)p.x+=direction*CHAR[p.char].speed;
   if(p.inputs.up&&p.y===0&&!p.guard){p.vy=7.5*CHAR[p.char].air;p.y=.5;m.events.push({kind:'jump',slot:p.slot,x:p.x})}
   if(!p.guard){const q=bufferedMove(p);if(q){p.buffer.splice(p.buffer.indexOf(q),1);startMove(m,p,q.key)}}
  }
  if(p.y>0||p.vy>0){p.y+=p.vy;p.vy-=.3375;if(p.y<=0){p.y=0;p.vy=0}}
  p.x=bound(p.x,48,912);
 }
 updateProjectiles(m);
 resolvePushboxes(a,b);
 if(m.time<=0||m.players.some(p=>p.hp<=0))endRound(m);
}
function serialize(m){return {type:'state',status:m.status,round:m.round,time:Math.max(0,Math.ceil(m.time)),tick:m.tick,introDuration:m.introDuration||0,introFrames:m.introFrames||0,serverHz:FPS,stage:m.stage,difficulty:m.difficulty,winner:m.winner??null,hitstop:m.hitstop,projectiles:m.projectiles.map(p=>({...p})),players:m.players.map(p=>({slot:p.slot,char:p.char,x:p.x,y:p.y,hp:p.hp,meter:p.meter,face:p.face,guard:p.guard,crouch:p.crouch,stun:p.stun,move:p.move?{name:p.move.name,frame:p.move.frame,hit:p.move.hit}:null,flash:p.flash,combo:p.combo,dash:p.dash,wins:p.wins,vy:p.vy,armorTimer:p.armorTimer,armorCharges:p.armorCharges})),events:m.events.splice(0,40)}}
function cpu(m,slot,skill=1,passive=false){
 const p=m.players[slot],foe=m.players[1-slot];if(passive){input(m,slot,{});return}
 if(p.cpuWait>0){p.cpuWait--;input(m,slot,p.cpuKeys||{});return}
 // 0.12s reaction at 60Hz. Faster CPU only at higher difficulty.
 p.cpuWait=skill>=3?5:skill>=2?7:10;
 p.cpuKeys=AI.decide(p,foe,()=>rng(m),skill);
 input(m,slot,p.cpuKeys);
}
return {FPS,INPUT_BUFFER,CHAR,MOVE,moveFor,ATTACKS,applyPushback,resolvePushboxes,create,reset,input,step,serialize,cpu,overlap,canChain,canCancel,startMove,bufferedMove,prepareFighter,spawnSpecialProjectile,introLength,entranceStep,Boxes,Commands,AI};
});
