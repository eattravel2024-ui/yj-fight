/* 阿志向錢衝 8.2：確定性 60Hz 格鬥引擎，雙端共用 */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiCore=api})(typeof globalThis==='object'?globalThis:this,function(root){
'use strict';
const FPS=60, INPUT_BUFFER=10, MIN_X=48, MAX_X=912;
const {CHAR,MOVE}=typeof require==='function'&&typeof module==='object'?require('./engine/frame-data.js'):root.AzhiFrames;
const Commands=typeof require==='function'&&typeof module==='object'?require('./engine/commands.js'):root.AzhiCommands;
const Boxes=typeof require==='function'&&typeof module==='object'?require('./engine/boxes.js'):root.AzhiBoxes;
const AI=typeof require==='function'&&typeof module==='object'?require('./engine/ai.js'):root.AzhiAI;
function moveFor(p,name){const base=Object.hasOwn(MOVE,name)?MOVE[name]:null;if(!base)return null;const cid=typeof p==='string'?p:p?.char;const mod=Object.hasOwn(CHAR,cid)?CHAR[cid].moves?.[name]:null;if(!mod)return base;const m={...base,...mod};m.start=m.startup;m.cancelStart=m.startup+Math.max(1,Math.floor(m.active*.45));m.cancelEnd=m.startup+m.active+Math.max(2,Math.floor(m.recovery*.36));m.cancelable=true;m.cancelWindow=[m.cancelStart,m.cancelEnd];return m;}
const ATTACKS=['light','heavy','kick','low','upper','throw','special','super'];
const bound=(v,a,b)=>Math.max(a,Math.min(b,v));
function fighter(char,slot){char=Object.hasOwn(CHAR,char)?char:'azhi';return {slot,char,x:slot?686:274,y:0,vy:0,face:slot?-1:1,hp:100,meter:30,wins:0,stun:0,blockstun:0,guard:false,crouch:false,move:null,combo:0,lastHit:-999,comboTaken:0,comboFrameBase:0,lastDamageTick:-999,flash:0,dash:0,dashCd:0,inputs:{},prev:{},buffer:[],ko:false,chain:0,airHits:0,cpuWait:0,motion:[],lastCommand:-100,guardFrames:0,lastDashCommand:-100,armorTimer:0,armorCharges:0,attackSerial:0,guardTapUntil:-1,guardReadyTick:0,guardAwardedUntil:-1,riposteFrames:0}}
function create(a='azhi',b='winnie',opts={}){const m={players:[fighter(a,0),fighter(b,1)],tick:0,round:1,time:75,status:'playing',pause:0,events:[],difficulty:opts.difficulty??1,stage:opts.stage||'night',seed:opts.seed||137,hitstop:0,projectiles:[],practice:!!opts.practice,introDuration:introLength(opts.introFrames),introFrames:introLength(opts.introFrames)};if(opts.practice){m.players[0].meter=100;m.players[1].meter=100;}return m;}
function introLength(value){return Number.isSafeInteger(value)?bound(value,0,180):0}
function entranceStep(m){if(!(m.introFrames>0))return false;m.introFrames--;for(const p of m.players){p.inputs={};p.prev={};p.buffer=[];p.motion=[];}return true}
function rng(m){m.seed=(m.seed*1664525+1013904223)>>>0;return m.seed/4294967296}
function reset(m){m.introFrames=m.introDuration||0;m.tick=0;m.time=75;m.status='playing';m.pause=0;m.hitstop=0;m.events=[];m.projectiles=[];m.players=m.players.map(p=>{const f=fighter(p.char,p.slot);f.wins=p.wins;return f});m.events.push({kind:'text',text:'ROUND '+m.round})}
function input(m,slot,keys){
 const p=m.players[slot];if(!p||m.introFrames>0)return;
 const k={};for(const key of ['left','right','up','down','guard','dash',...ATTACKS])k[key]=keys?.[key]===true;
 Commands.record(p,k,m.tick);if(Commands.doubleTap(p,m.tick))k.dash=true;
 if(k.guard&&!p.inputs.guard){
  const timing=CHAR[p.char].combat;
  p.guardTapUntil=timing.perfectGuardWindow&&p.stun===0&&m.tick>=(p.guardReadyTick||0)?m.tick+timing.perfectGuardWindow:-1;
  if(timing.perfectGuardWindow)p.guardReadyTick=Math.max(p.guardReadyTick||0,m.tick+timing.guardCooldown);
 }
 if(!k.guard)p.guardTapUntil=-1;
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
 const riposte=p.riposteFrames>0&&['heavy','upper','special','super'].includes(key);if(riposte)p.riposteFrames=0;
 p.attackSerial=(p.attackSerial||0)+1;
 p.move={name:key,serial:p.attackSerial,frame:0,hit:false,blocked:false,hits:0,spawned:false,riposte};p.meter=bound(p.meter-(d.cost||0),0,100);p.crouch=false;
 if(CHAR[p.char].specialMode==='counter'&&(key==='special'||key==='super')){p.armorTimer=key==='super'?CHAR[p.char].combat.superArmorWindow:CHAR[p.char].combat.armorWindow;p.armorCharges=1;m.events.push({kind:'buff',slot:p.slot,style:'black-gold'})}
 if(key==='special'&&p.char==='sezi')p.x=bound(p.x+p.face*23,48,912);
 m.events.push({kind:'swing',slot:p.slot,name:key,chain:!!wasLight});
 if(key==='special'||key==='super'){const char=CHAR[p.char];m.events.push({kind:'skill',slot:p.slot,char:p.char,move:key,name:key==='super'?char.superName:char.special,style:char.specialMode,direction:p.face,x:p.x,y:p.y})}
 if(key==='super')m.events.push({kind:'super',slot:p.slot,char:p.char,x:p.x,y:p.y});return true;
}
function canAfford(p,name){const data=moveFor(p,name);return !!data&&p.meter>=(data.cost||0)}
function bufferedMove(p,predicate=()=>true){return p.buffer.find(q=>predicate(q.key)&&canAfford(p,q.key))}
// Resolve timer expiry and guard for every fighter before either side can hit.
function prepareFighter(p,tick){
 p.riposteFrames=Math.max(0,(p.riposteFrames||0)-1);
 p.stun=Math.max(0,p.stun-1);p.blockstun=Math.max(0,(p.blockstun||0)-1);p.flash=Math.max(0,p.flash-1);p.armorTimer=Math.max(0,p.armorTimer-1);if(!p.armorTimer)p.armorCharges=0;p.dashCd=Math.max(0,p.dashCd-1);
 p.buffer=p.buffer.filter(q=>q.until>=tick);p.crouch=!!p.inputs.down&&p.y===0&&!p.move;
 p.guard=!!p.inputs.guard&&(p.stun===0||p.blockstun>0)&&!p.move&&p.y===0;
}
function overlap(p,foe,d){return Boxes.hits(p,foe,d)}
// Freeze contact geometry/defence before applying any same-frame damage or pushback.
function combatSnapshots(m){return m.players.map(p=>({...p,move:p.move?{...p.move}:null}));}
function comboScale(m,target,name,contact=true){
 if(!contact)return 1;
 const sameFrame=target.lastDamageTick===m.tick;
 const prior=sameFrame?(target.comboFrameBase||0):m.tick-(target.lastDamageTick??-999)<70?(target.comboTaken||0):0;
 target.comboTaken=sameFrame?target.comboTaken+1:prior+1;target.comboFrameBase=prior;target.lastDamageTick=m.tick;
 return Math.max(name==='super'?.60:.45,1-prior*.10);
}
function resolveCancels(m,p,start=startMove){if(p.hp>0&&p.stun===0&&canCancel(p)){const q=bufferedMove(p,key=>canChain(p.move.name,key));if(q){p.buffer.splice(p.buffer.indexOf(q),1);start(m,p,q.key)}}}
// All contact outcomes are shared with 2v2. Read frozen defence for fair same-frame trades.
function applyContact(m,p,foe,a,d,{defence=foe,block=false,counter=false,armor=false,damageScale=1,projectile=false,face=p.face}={}){
 const profile=CHAR[p.char].combat,defender=CHAR[foe.char].combat;
 const perfect=block&&defender.perfectGuardWindow>0&&defence.guardTapUntil>=m.tick;
 const punish=!block&&!armor&&!!defence.move&&defence.move.frame>=moveFor(defence,defence.move.name).start+moveFor(defence,defence.move.name).active;
 const counterBonus=['special','super'].includes(a.name)&&CHAR[p.char].specialMode==='counter'&&(counter||a.countered)?1.38:1;
 const riposte=!!a.riposte&&!block&&!armor;
 const scale=comboScale(m,foe,a.name,!block&&!armor);
 const bonus=counterBonus*(punish?(profile.punishBonus||1):1)*(riposte?(profile.riposteBonus||1):1);
 const chip=block?(perfect?0:d.level==='mid'&&a.name==='special'?.23:.10):armor?.26:1;
 const dmg=perfect?0:Math.max(1,Math.round(scale*d.damage*CHAR[p.char].power*damageScale*bonus*chip));
 const appliedDamage=Math.min(foe.hp,dmg);foe.hp=bound(foe.hp-dmg,0,100);
 const hitstun=d.hitstun+(counter?10:0)+(riposte?3:0),blockstun=Math.max(1,Math.round(d.blockstun*(defender.blockstunScale||1)*(perfect?.55:1)));
 if(!block&&!armor){foe.blockstun=0;foe.stun=Math.max(foe.stun,hitstun);foe.move=null;foe.buffer=[];foe.chain=0;foe.riposteFrames=0;foe.flash=12;
  if(a.name==='upper'&&!projectile){foe.vy=6.5;foe.y=Math.max(foe.y,1)}
 }else if(block){foe.stun=Math.max(foe.stun,blockstun);foe.blockstun=foe.stun;}
 if(perfect&&foe.guardAwardedUntil!==defence.guardTapUntil){foe.guardAwardedUntil=defence.guardTapUntil;foe.riposteFrames=defender.riposteWindow;foe.meter=bound(foe.meter+4,0,100);}
 applyPushback(p,foe,face*(block?7:d.knock+(counter?6:0)));
 p.meter=bound(p.meter+(block?3:d.gain),0,100);foe.meter=bound(foe.meter+(block?2:4),0,100);
 p.combo=(!block&&m.tick-p.lastHit<70)?p.combo+1:(block?0:1);p.lastHit=m.tick;
 a.hit=true;a.blocked=block;a.hits=(a.hits||0)+1;
 const stop=block?d.blockstop+(perfect?2:0):d.hitstop;m.hitstop=Math.max(m.hitstop,stop);
 const event={kind:armor?'armor':'hit',slot:p.slot,target:foe.slot,x:foe.x,y:foe.y,damage:dmg,appliedDamage,block,combo:p.combo,counter,counterBoost:counterBonus>1||riposte,move:a.name,hitstop:stop,hitstun:block||armor?0:foe.stun,blockstun:block?foe.blockstun:0,perfectGuard:perfect,punish,riposte};
 m.events.push(event);return event;
}
function hit(m,p,foe,a=p.move,source=p,defence=foe){if(!a||a.hit)return;const d=moveFor(p,a.name);if(!overlap(source,defence,d))return;
 if(d.level==='throw'&&(source.y>0||defence.y>8))return;
 if(defence.dash>0&&defence.dash<=6)return;
 const block=defence.guard&&d.level!=='throw'&&(d.level==='mid'||(d.level==='low'&&defence.crouch)||(d.level==='high'&&!defence.crouch));
 const counter=!block&&!!defence.move&&defence.move.frame<moveFor(defence,defence.move.name).start;
 const armor=!block&&CHAR[foe.char].specialMode==='counter'&&foe.armorCharges>0&&foe.armorTimer>0&&['light','light2','light3'].includes(a.name);
 if(armor){foe.armorCharges--;if(foe.move&&['special','super'].includes(foe.move.name))foe.move.countered=true;}
 applyContact(m,p,foe,a,d,{defence,block,counter,armor,face:source.face,damageScale:['special','super'].includes(a.name)&&p.char==='sezi'?.45:1});
}
function spawnSpecialProjectile(m,p){
 const isSuper=p.move?.name==='super';const isWave=p.char==='winnie';
 // Deterministic seeded roulette: every client/server running identical inputs gets the same outcome.
 const roll=CHAR[p.char].specialMode==='cards'?rng(m):.5;
 const fortune=CHAR[p.char].specialMode==='cards'?(roll<.16?'jackpot':roll>.91&&!isSuper?'blank':'standard'):'standard';
 if(CHAR[p.char].specialMode==='cards'){m.events.push({kind:'fortune',slot:p.slot,fortune});if(fortune==='blank')p.stun=Math.max(p.stun,9)}
 const py=isWave?35:p.y+112;
 m.projectiles.push({owner:p.slot,activation:p.move?.serial,riposte:!!p.move?.riposte,char:p.char,kind:isWave?'wave':'card',level:isWave?'low':'mid',x:p.x+p.face*(isWave?65:62),y:py,vx:p.face*(isWave?8.2:10.5),life:isWave?45:42,w:isWave?(isSuper?81:58):(isSuper?52:38),h:isWave?34:24,damage:(isSuper?CHAR[p.char].projectile.superDamage:CHAR[p.char].projectile.damage)*(fortune==='jackpot'?1.75:fortune==='blank'?.3:1),fortune,fromMove:p.move?.name||'special'});
 m.events.push({kind:'projectile',slot:p.slot,x:p.x,y:py,style:isWave?'wave':'card',super:isSuper});
}
function updateProjectiles(m,snapshots=combatSnapshots(m)){
 for(let i=m.projectiles.length-1;i>=0;i--){const shot=m.projectiles[i];shot.x+=shot.vx;shot.life--;
  const foe=m.players[1-shot.owner],p=m.players[shot.owner];
  const rect={x:shot.x-shot.w/2,y:shot.y-shot.h/2,w:shot.w,h:shot.h};
  const defence=snapshots[foe.slot];
  if(Boxes.intersect(rect,Boxes.hurtbox(defence))){
   const blocked=defence.guard&&(shot.level==='low'?defence.crouch:!defence.crouch);
   const name=shot.fromMove||'special',move=p.move?.name===name&&p.move.serial===shot.activation?p.move:{name,riposte:!!shot.riposte};
   applyContact(m,p,foe,move,{...moveFor(p,name),damage:shot.damage,knock:24,gain:8,hitstun:30},{defence,block:blocked,projectile:true,face:Math.sign(shot.vx)||p.face});
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
// Shared by both interfaces: energy alone does not mean a move can start.
function skillStatus(game,slot,name){
 const p=game?.players?.[slot],d=p?moveFor(p,name):null;
 const state=(code,label,available=false,canBuffer=false)=>({code,label,available,canBuffer});
 if(!p||!d)return state('waiting','等待開賽');
 if(game.status==='finished'||p.hp<=0)return state('finished','本場已結束');
 if(game.introFrames>0)return state('intro','開場倒數 '+Math.ceil(game.introFrames/60)+' 秒');
 if(game.status!=='playing')return state('between','等待下一回合');
 if(p.stun>0)return state('stun',(p.blockstun>0?'防禦':'受擊')+'硬直 '+p.stun+' F'+(p.stun<=INPUT_BUFFER?' · 可預輸入':''),false,p.stun<=INPUT_BUFFER);
 if(p.meter<(d.cost||0))return state('energy','能量不足 · 還差 '+Math.ceil(d.cost-p.meter));
 if(p.guard)return state('guard','放開防禦後施放');
 if(p.move){
  const current=moveFor(p,p.move.name),remaining=Math.max(0,current.start+current.active+current.recovery-p.move.frame);
  if(canCancel(p)&&canChain(p.move.name,name))return state('cancel','可取消施放 · '+d.cost+' 能量',true);
  const code=p.move.frame<current.start?'startup':p.move.frame<current.start+current.active?'active':'recovery';
  const phase={startup:'前搖中',active:'出招中',recovery:'收招中'}[code];
  return state(code,phase+' · '+remaining+' F'+(remaining<=INPUT_BUFFER?' · 可預輸入':''),false,remaining<=INPUT_BUFFER);
 }
 if(game.hitstop>0)return state('hitstop','命中停頓 · 可預輸入',false,true);
 return state('ready','可施放 · '+d.cost+' 能量',true);
}
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
 m.tick++;m.time-=1/FPS;const pending=[];const [a,b]=m.players;a.face=a.x<=b.x?1:-1;b.face=-a.face;
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
      if(p.move.frame===d.start&&(name==='heavy'||name==='upper'))p.x=bound(p.x+p.face*11,48,912);if(!((name==='special'||name==='super')&&['cards','shockwave'].includes(CHAR[p.char].specialMode)))pending.push({p,foe,move:p.move})}
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
 const snapshots=combatSnapshots(m);
 for(const {p,foe,move} of pending)hit(m,p,foe,move,snapshots[p.slot],snapshots[foe.slot]);
 updateProjectiles(m,snapshots);
 for(const p of m.players)resolveCancels(m,p);
 resolvePushboxes(a,b);
 if(m.time<=0||m.players.some(p=>p.hp<=0))endRound(m);
}
function serialize(m){return {type:'state',status:m.status,round:m.round,time:Math.max(0,Math.ceil(m.time)),tick:m.tick,introDuration:m.introDuration||0,introFrames:m.introFrames||0,serverHz:FPS,stage:m.stage,difficulty:m.difficulty,winner:m.winner??null,hitstop:m.hitstop,projectiles:m.projectiles.map(p=>({...p})),players:m.players.map(p=>({slot:p.slot,char:p.char,x:p.x,y:p.y,hp:p.hp,meter:p.meter,face:p.face,guard:p.guard,crouch:p.crouch,stun:p.stun,blockstun:p.blockstun,move:p.move?{name:p.move.name,frame:p.move.frame,hit:p.move.hit,blocked:p.move.blocked,riposte:!!p.move.riposte}:null,flash:p.flash,combo:p.combo,dash:p.dash,wins:p.wins,vy:p.vy,armorTimer:p.armorTimer,armorCharges:p.armorCharges,riposteFrames:p.riposteFrames})),events:m.events.splice(0,40)}}
function cpu(m,slot,skill=1,passive=false){
 const p=m.players[slot],foe=m.players[1-slot];if(passive){input(m,slot,{});return}
 if(p.cpuWait>0){p.cpuWait--;input(m,slot,p.cpuKeys||{});return}
 // 0.12s reaction at 60Hz. Faster CPU only at higher difficulty.
 p.cpuWait=skill>=3?5:skill>=2?7:10;
 p.cpuKeys=AI.decide(p,foe,()=>rng(m),skill);
 input(m,slot,p.cpuKeys);
}
return {FPS,INPUT_BUFFER,CHAR,MOVE,moveFor,ATTACKS,applyPushback,resolvePushboxes,combatSnapshots,comboScale,resolveCancels,applyContact,create,reset,input,step,serialize,cpu,overlap,canChain,canCancel,startMove,bufferedMove,prepareFighter,spawnSpecialProjectile,introLength,entranceStep,skillStatus,Boxes,Commands,AI};
});
