'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../public/core'),T=require('../public/team-core'),RB=require('../public/rollback');
const names=['不同意的請舉手','高雄發大財','加油加300','膽大撐死膽小餓死'];
test('requested signature names preserve all four character identities',()=>{
 assert.deepEqual(Object.values(C.CHAR).map(c=>c.special),names);
 assert.ok(Object.values(C.CHAR).every(c=>c.entrance&&c.entrance.line));
});
for(const core of [C,T]){
 const create=opts=>core===C?C.create('winnie','azhi',opts):T.create(undefined,opts);
 test(`${core===C?'duel':'team'}: entrance blocks damage, movement, clock and buffered inputs`,()=>{
  const m=create({introFrames:90}),start=m.players.map(p=>p.x),time=m.time;
  for(let f=0;f<90;f++){core.input(m,0,{right:true,pulses:['special']});core.step(m);}
  assert.equal(m.introFrames,0);assert.equal(m.time,time);assert.equal(m.tick,0);
  assert.deepEqual(m.players.map(p=>p.x),start);assert.ok(m.players.every(p=>p.hp===100));
  core.input(m,0,{});core.step(m);assert.equal(m.tick,1);assert.equal(m.players[0].move,null);
  assert.equal(core.serialize(RB.clone(m)).introDuration,90);
 });
 test(`${core===C?'duel':'team'}: intro state rewinds and converges with late packets`,()=>{
  const a=new RB.Session(create({introFrames:12,seed:88})),b=new RB.Session(create({introFrames:12,seed:88}));
  for(let f=1;f<=24;f++){const input={keys:{right:f>12},pulses:f===14?['special']:[]};a.submit(0,f,input);a.advance();b.advance();if(f>3)b.submit(0,f-3,{keys:{right:f-3>12},pulses:f-3===14?['special']:[]});}
  for(let f=22;f<=24;f++)b.submit(0,f,{keys:{right:true},pulses:[]});
  assert.equal(a.digest(),b.digest());
 });
 test(`${core===C?'duel':'team'}: grounded throw cannot grab airborne fighters`,()=>{
  const m=create({});m.players[0].x=400;m.players[1].x=455;m.players[1].y=45;m.players[1].vy=0;
  if(core===T){m.players[2].x=100;m.players[3].x=850;}
  core.input(m,0,{pulses:['throw']});
  for(let i=0;i<12;i++){m.players[1].y=45;m.players[1].vy=0;core.step(m);}
  assert.equal(m.players[1].hp,100);
 });
 test(`${core===C?'duel':'team'}: double tap direction starts a dash without Shift`,()=>{
  const m=create({}),p=m.players[0];
  for(const keys of [{right:true},{},{right:true}]){core.input(m,0,keys);core.step(m);}
  assert.ok(p.dash>0);assert.equal(m.events.filter(e=>e.kind==='dash').length,1);
 });
}
test('double tap rejects a held direction and slow taps, supports mirrored backdash and keeps Shift',()=>{
 const slow=C.create();C.input(slow,0,{right:true});C.step(slow);
 for(let i=0;i<14;i++){C.input(slow,0,{});C.step(slow);}
 C.input(slow,0,{right:true});C.step(slow);assert.equal(slow.players[0].dash,0);
 const held=C.create();for(let i=0;i<20;i++){C.input(held,0,{right:true});C.step(held);}assert.equal(held.events.filter(e=>e.kind==='dash').length,0);
 const mirrored=C.create();for(const keys of [{right:true},{},{right:true}]){C.input(mirrored,1,keys);C.step(mirrored);}assert.ok(mirrored.players[1].dash>0);
 const shift=C.create();C.input(shift,0,{left:true,dash:true});C.step(shift);assert.ok(shift.players[0].dash>0);
});
