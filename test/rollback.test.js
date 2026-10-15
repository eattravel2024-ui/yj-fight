'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../public/core.js'),RB=require('../public/rollback.js');
function runInputs(n=100){
 const a=new RB.Session(C.create('gambler','winnie',{seed:3719}));
 const b=new RB.Session(C.create('gambler','winnie',{seed:3719}));
 for(let f=1;f<=n;f++){
  for(let slot=0;slot<2;slot++){
   const keys={left:slot===1&&f%53<25,right:slot===0&&f%57<28,guard:f%29<6};
   const pulses=f%31===0?['special']:f%17===0?['light']:[];
   a.submit(slot,f,{keys,pulses});
   b.submit(slot,f,{keys,pulses});
  }
  a.advance();b.advance();
 }
 return [a,b];
}
test('deterministic 60Hz snapshot hashes match for same inputs',()=>{
 const [a,b]=runInputs(150);assert.equal(a.frame,150);assert.equal(a.digest(),b.digest());
});
test('predicted input is corrected by rollback of the past',()=>{
 const source=new RB.Session(C.create('azhi','sam',{seed:888}));
 const delayed=new RB.Session(C.create('azhi','sam',{seed:888}));
 for(let f=1;f<=25;f++){
  const p0={keys:{right:f<20},pulses:f===7?['light']:[]};
  const p1={keys:{left:f<14},pulses:f===9?['heavy']:[]};
  source.submit(0,f,p0);source.submit(1,f,p1);
  delayed.submit(0,f,p0);
  source.advance();delayed.advance();
  if(f>=12)delayed.submit(1,f-3,{keys:{left:f-3<14},pulses:f-3===9?['heavy']:[]});
 }
 for(let f=1;f<=25;f++)delayed.submit(1,f,{keys:{left:f<14},pulses:f===9?['heavy']:[]});
 assert.ok(delayed.rollbacks>0);assert.equal(delayed.digest(),source.digest());
});
test('prediction never repeats one shot pulses',()=>{
 const s=new RB.Session(C.create());s.submit(0,1,{keys:{light:true},pulses:['light']});s.advance();s.advance();
 assert.deepEqual(s.used.get(2).inputs[0].pulses,[]);
});
test('rollback frame remains monotonic through core hitstop and round reset',()=>{
 const s=new RB.Session(C.create());for(let i=0;i<130;i++)s.advance();
 assert.equal(s.frame,130);assert.ok(s.history.has(130));
});
test('window bounds and invalid frames are rejected',()=>{
 const s=new RB.Session(C.create());for(let i=0;i<50;i++)s.advance();
 assert.equal(s.submit(0,1,{keys:{light:true}}),false);
 assert.equal(s.submit(0,150,{keys:{light:true}}),false);
 assert.equal(s.submit(2,52,{}),false);
});
test('checkpoint rebase converges to authoritative state',()=>{
 const original=new RB.Session(C.create('sezi','gambler',{seed:99}));
 const client=new RB.Session(C.create('sezi','gambler',{seed:99}));
 for(let f=1;f<=60;f++){original.submit(0,f,{keys:{right:f<30}});original.advance();client.advance()}
 assert.notEqual(original.digest(),client.digest());
 assert.equal(client.rebase(45,original.state(45)),true);
 // The client needs authoritative inputs after its checkpoint to match.
 for(let f=46;f<=60;f++)client.submit(0,f,{keys:{right:f<30}});
 assert.equal(original.digest(),client.digest());
});
test('projectile RNG remains deterministic across late command rewind',()=>{
 const a=new RB.Session(C.create('gambler','winnie',{seed:93}));
 const b=new RB.Session(C.create('gambler','winnie',{seed:93}));
 for(let f=1;f<=38;f++){
  const input={keys:{},pulses:f===2?['special']:[]};a.submit(0,f,input);a.advance();b.advance();
  if(f===8)b.submit(0,2,{keys:{},pulses:['special']});
 }
 assert.equal(a.digest(),b.digest());
});
test('serialize snapshot does not consume rollback event history',()=>{
 const s=new RB.Session(C.create('azhi','sam'));s.submit(0,1,{pulses:['light']});s.advance();
 const before=s.events.get(1).length;C.serialize(RB.clone(s.game));assert.equal(s.events.get(1).length,before);
});
test('server locks existing submitted frame to prevent history rewriting exploit',()=>{
 const s=new RB.Session(C.create());
 assert.equal(s.submit(0,4,{keys:{right:true}},{lockExisting:true}),true);
 assert.equal(s.submit(0,4,{keys:{left:true}},{lockExisting:true}),false);
 assert.deepEqual(s.inputs[0].get(4).keys,{right:true});
});
test('future accepted inputs can be scheduled without advancing early',()=>{
 const s=new RB.Session(C.create());
 assert.equal(s.submit(0,20,{pulses:['light']}),true);
 for(let f=1;f<20;f++)s.advance();
 assert.equal(s.game.players[0].move,null);
 s.advance();assert.equal(s.game.players[0].move?.name,'light');
});
test('late packets with variable network jitter converge to 60Hz reference state',()=>{
 const ref=new RB.Session(C.create('sam','sezi',{seed:15438}));
 const wire=new RB.Session(C.create('sam','sezi',{seed:15438}));
 const pending=[];const N=170;
 for(let f=1;f<=N+18;f++){
  if(f<=N)for(let slot=0;slot<2;slot++){
   const entry={keys:{right:slot===0&&f%47<31,left:slot===1&&f%61<39,guard:f%57===0},pulses:f%27===slot*4+3?['light']:[]};
   ref.submit(slot,f,entry);
   const delay=1+((f*11+slot*7)%12);
   pending.push({at:f+delay,slot,f,entry});
  }
  for(const pkt of pending.filter(x=>x.at===f))wire.submit(pkt.slot,pkt.f,pkt.entry);
  ref.advance();wire.advance();
 }
 assert.ok(wire.rollbacks>0);
 assert.equal(wire.digest(N),ref.digest(N));
 assert.equal(wire.digest(),ref.digest());
});
test('full authority snapshot restores simulation after a long tab suspension',()=>{
 const authority=new RB.Session(C.create('winnie','azhi',{seed:110}));
 const client=new RB.Session(C.create('winnie','azhi',{seed:110}));
 for(let f=1;f<=72;f++)authority.advance();
 assert.equal(client.hardSync(72,authority.state(72)),true);
 assert.equal(client.frame,72);assert.equal(client.digest(),authority.digest());
 client.advance();authority.advance();assert.equal(client.digest(),authority.digest());
});
