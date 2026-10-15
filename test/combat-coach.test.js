'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../public/core'),T=require('../public/team-core'),Coach=require('../public/combat-coach'),RB=require('../public/rollback');
function setup(core,id,gap=110,seed=73){const m=core===C?C.create(id,'winnie',{seed}):T.create([id,'winnie','azhi','gambler'],{seed});m.players.forEach((p,i)=>{p.x=[300,300+gap,48,912][i];p.meter=100});return m;}
function attack(core,m,move,frames=110){core.input(m,0,{pulses:[move]});for(let i=0;i<frames;i++)core.step(m);return m.events.filter(e=>e.kind==='hit'&&e.slot===0&&e.target===1);}
test('live combo advice follows confirmed contact, valid chains and actual energy',()=>{
 const m=C.create('azhi','winnie'),p=m.players[0];p.meter=30;
 assert.match(Coach.advice(m,0).detail,/還差 30/);
 C.startMove(m,p,'light');p.move.frame=C.moveFor(p,'light').cancelWindow[0];
 assert.notEqual(Coach.advice(m,0).state,'cancel','a whiff never advertises a usable cancel');
 p.move.hit=true;const hint=Coach.advice(m,0);assert.equal(hint.state,'cancel');assert.match(hint.title,/K 重拳/);assert.match(hint.title,/U 必殺/);assert.doesNotMatch(hint.title,/O 超必殺/);
 p.meter=100;p.move.name='heavy';p.move.frame=C.moveFor(p,'heavy').cancelWindow[0];assert.match(Coach.advice(m,0).title,/O 超必殺/);
 p.stun=10;assert.equal(Coach.advice(m,0).state,'stun');p.stun=0;p.move=null;p.meter=59;assert.match(Coach.advice(m,0).detail,/還差 1/);
 assert.equal(Coach.advice(null,0).state,'waiting');
});
for(const [label,core] of [['1v1',C],['2v2',T]]){
 test(label+': all four supers spend real energy and deal character-specific damage',()=>{
  for(const [id,expected] of Object.entries({winnie:28,sezi:36,gambler:32,azhi:30})){
   const m=setup(core,id),hits=attack(core,m,'super');assert.equal(100-m.players[1].hp,expected,id);
   assert.equal(hits.reduce((n,e)=>n+e.appliedDamage,0),expected,id);assert.ok(m.players[0].meter<100);assert.equal(hits.length,id==='sezi'?3:1);
  }
 });
 test(label+': guarding mitigates supers, and near-range supers can whiff at long distance',()=>{
  for(const id of Object.keys(C.CHAR)){
   const m=setup(core,id);core.input(m,1,{guard:true,down:id==='winnie'});attack(core,m,'super');assert.ok(m.players[1].hp>=94,id+' guard');
  }
  for(const id of ['gambler','sezi']){const m=setup(core,id,430);assert.equal(attack(core,m,'super').length,0);assert.equal(m.players[1].hp,100);}
 });
 test(label+': releasing guard or using the wrong stance does not grant automatic defence',()=>{
  const m=setup(core,'sezi');core.input(m,1,{guard:true});core.input(m,0,{pulses:['super']});
  for(let f=0;f<90&&!m.events.some(e=>e.kind==='hit');f++)core.step(m);
  assert.equal(m.events.find(e=>e.kind==='hit').block,true);core.input(m,1,{});
  for(let f=0;f<100;f++)core.step(m);assert.ok(m.events.some(e=>e.kind==='hit'&&!e.block));
  const low=setup(core,'winnie');core.input(low,1,{guard:true});attack(core,low,'super');assert.equal(low.players[1].hp,72,'a standing guard cannot block the low wave');
 });
 test(label+': Azhi super never draws a blank, while the ordinary signature keeps roulette',()=>{
  const superGame=setup(core,'azhi',110,1800);attack(core,superGame,'super');assert.equal(superGame.events.find(e=>e.kind==='fortune').fortune,'standard');assert.equal(superGame.players[1].hp,70);
  const specialGame=setup(core,'azhi',110,1800);attack(core,specialGame,'special');assert.equal(specialGame.events.find(e=>e.kind==='fortune').fortune,'blank');assert.ok(100-specialGame.players[1].hp<10);
 });
 test(label+': receipts report HP actually removed rather than overkill',()=>{
  const m=setup(core,'winnie');m.players[1].hp=3;const [e]=attack(core,m,'super');assert.ok(e.damage>3);assert.equal(e.appliedDamage,3);assert.equal(m.players[1].hp,0);
 });
 test(label+': Gambler super absorbs one jab, retains the buff and strengthens its actual hit',()=>{
  const m=setup(core,'gambler',75),p=m.players[0],foe=m.players[1];foe.char='azhi';core.input(m,0,{pulses:['super']});core.step(m);
  assert.equal(p.armorTimer,180);assert.equal(p.armorCharges,1);
  foe.move={name:'light',frame:C.moveFor(foe,'light').start-1,hit:false,hits:0,spawned:false,hitSlots:[],hitCounts:{}};
  core.step(m);assert.equal(p.armorCharges,0);assert.equal(p.move.countered,true);
  for(let i=0;i<95;i++)core.step(m);const e=m.events.find(e=>e.kind==='hit'&&e.slot===0&&e.move==='super');assert.ok(e.counterBoost);assert.ok(e.appliedDamage>32);
 });
}
test('late Azhi super input replays its guaranteed projectile and real hit receipt deterministically',()=>{
 const initial=setup(C,'azhi',110,1800),a=new RB.Session(initial),b=new RB.Session(initial);
 for(let f=1;f<=100;f++){
  const entry={pulses:f===2?['super']:[]};a.submit(0,f,entry);if(f!==2)b.submit(0,f,entry);
  if(f===10)b.submit(0,2,{pulses:['super']});a.advance();b.advance();
 }
 assert.ok(b.rollbacks>0);assert.equal(a.digest(),b.digest());assert.equal(a.game.players[1].hp,70);
});
for(const core of [C,T])test((core===C?'1v1':'2v2')+' late guard input preserves multi-hit defence across rollback',()=>{
 const initial=setup(core,'sezi',110),a=new RB.Session(initial),b=new RB.Session(initial);
 for(let f=1;f<=115;f++){
  for(const slot of [0,1]){const e={keys:slot===1?{guard:f>=18}:{},pulses:slot===0&&f===2?['super']:[]};a.submit(slot,f,e);if(!(slot===1&&f===18))b.submit(slot,f,e);}
  if(f===26){b.submit(1,18,{keys:{guard:true}});assert.ok(b.state(25).players[1].blockstun>0);assert.equal(a.digest(25),b.digest(25));}
  a.advance();b.advance();
 }
 assert.ok(b.rollbacks>0);assert.equal(a.digest(),b.digest());assert.equal(a.game.players[1].hp,97);
});
