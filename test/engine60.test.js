'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../public/core.js'),Data=require('../public/engine/frame-data.js'),Cmd=require('../public/engine/commands.js'),Box=require('../public/engine/boxes.js'),Ani=require('../public/engine/animation.js'),AI=require('../public/engine/ai.js');
function tick(m,n=1){for(let i=0;i<n;i++)C.step(m)}
test('shared 60Hz engine advances one second in 60 idle ticks',()=>{
 const m=C.create();tick(m,60);assert.equal(C.FPS,60);assert.ok(Math.abs(m.time-74)<1e-9);assert.equal(m.tick,60);
});
test('frame-data is composable, action registry covers independent sprites',()=>{
 assert.equal(Object.keys(Data.CHAR).length,4);assert.equal(Ani.ACTIONS.length,17);
 for(const char of Object.keys(Data.CHAR)){for(const move of C.ATTACKS){const d=C.moveFor(char,move);assert.ok(d.startup>=1&&d.active>=1&&d.recovery>=1,`${char}.${move}`);assert.equal(d.start,d.startup);assert.ok(d.cancelStart<d.cancelEnd)}}
});
test('separate hit and hurt boxes: standing hit confirmed and distant hit misses',()=>{
 const m=C.create('azhi','winnie');const [p,foe]=m.players;p.x=410;foe.x=490;
 assert.ok(Box.intersect(Box.hitbox(p,C.moveFor(p,'heavy')),Box.hurtbox(foe)));
 foe.x=910;assert.equal(Box.intersect(Box.hitbox(p,C.moveFor(p,'heavy')),Box.hurtbox(foe)),false);
});
test('motion recognition resolves quarter circle forward on either facing',()=>{
 for(const face of [1,-1]){const p={face,motion:[]};
  const seq=face===1?[{down:true},{down:true,right:true},{right:true}]:[{down:true},{down:true,left:true},{left:true}];
  seq.forEach((k,t)=>Cmd.record(p,k,t*3));assert.equal(Cmd.command(p,'light',9),'special');
 }
});
test('motion recognition resolves forward down diagonal DP and skips incorrect motion',()=>{
 const p={face:1,motion:[]};[{right:true},{down:true},{down:true,right:true}].forEach((k,t)=>Cmd.record(p,k,t*3));
 assert.equal(Cmd.command(p,'heavy',10),'upper');assert.equal(Cmd.command(p,'light',10),'light');
});
test('motion special spends meter and is triggered from directional input',()=>{
 const m=C.create('gambler','winnie');m.players[0].meter=100;
 const seq=[{down:true},{down:true,right:true},{right:true},{right:true,light:true}];
 for(const k of seq){C.input(m,0,k);C.input(m,1,{});C.step(m)}
 assert.equal(m.players[0].move?.name,'special');assert.ok(m.players[0].meter<100);
});
test('short press pulse is accepted at 60Hz',()=>{
 const m=C.create();C.input(m,0,{pulses:['heavy']});C.step(m);
 assert.equal(m.players[0].move.name,'heavy');
});
test('deterministic simulation with fixed initial seed, same input trace same state',()=>{
 const a=C.create('sezi','winnie',{seed:1234}),b=C.create('sezi','winnie',{seed:1234});
 for(let i=0;i<450;i++)for(const m of [a,b]){
  C.input(m,0,{right:i<65,light:i===89||i===112,down:i>200&&i<250,kick:i===270});
  C.cpu(m,1,2);C.step(m);
 }
 assert.deepEqual(C.serialize(a),C.serialize(b));
});
test('CPU styles return only approved input keys',()=>{
 const m=C.create('gambler','winnie');for(const id of Object.keys(C.CHAR)){
  m.players[0].char=id;for(let i=0;i<30;i++){
   const keys=AI.decide(m.players[0],m.players[1],()=>i/30,2);
   for(const k of Object.keys(keys))assert.ok(['left','right','up','down','guard','dash',...C.ATTACKS].includes(k));
  }
 }
});
test('state snapshot exposes serverHz and removes events after reading',()=>{
 const m=C.create();C.input(m,0,{light:true});C.step(m);const s=C.serialize(m);
 assert.equal(s.serverHz,60);assert.ok(Array.isArray(s.events));assert.equal(C.serialize(m).events.length,0);
});
test('right-side character specials respect mirrored facing and active boxes',()=>{
 const m=C.create('winnie','gambler');const [a,b]=m.players;a.x=370;b.x=500;b.face=-1;
 assert.ok(C.overlap(b,a,C.moveFor(b,'special')));
});
test('Azhi launches the transferred real projectile that crosses distance and hits',()=>{
 const m=C.create('azhi','winnie');const [p,foe]=m.players;p.x=275;foe.x=540;p.meter=100;
 C.input(m,0,{special:true});C.input(m,1,{});
 let spawned=false,hit=false;
 for(let i=0;i<90;i++){
  if(i>0)C.input(m,0,{});C.step(m);
  if(m.projectiles.length)spawned=true;
  if(foe.hp<100)hit=true;
 }
 assert.equal(spawned,true,'projectile should exist outside the attack animation');
 assert.equal(hit,true,'projectile should cause authoritative damage');
});
test('each playable character has a distinctive special mechanic',()=>{
 assert.equal(new Set(Object.values(C.CHAR).map(x=>x.specialMode)).size,4);
 for(const [id,character] of Object.entries(C.CHAR))assert.ok(character.specialLabel,`${id} special label`);
});
test('standing guard is vulnerable to winnie ground shockwave but crouch guard works',()=>{
 function run(down){const m=C.create('winnie','winnie'),[p,foe]=m.players;
  p.meter=100;p.x=450;foe.x=530;C.input(m,0,{special:true});C.input(m,1,{guard:true,down});
  for(let i=0;i<43;i++){if(i>0)C.input(m,0,{});C.input(m,1,{guard:true,down});C.step(m)}return foe.hp;
 }
 assert.ok(run(false)<run(true));
});
