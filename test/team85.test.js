'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Team=require('../public/team-core.js'),Core=require('../public/core.js'),RB=require('../public/rollback.js');
test('2v2 initializes four independent fighter slots and two teams',()=>{
 const m=Team.create(['azhi','winnie','sezi','gambler'],{seed:127});
 assert.equal(m.ruleset,'team');assert.equal(m.players.length,4);assert.deepEqual(m.players.map(x=>x.team),[0,1,0,1]);
 assert.equal(Team.FPS,60);assert.equal(m.time,90);
});
test('2v2 allows four independent rollback input channels',()=>{
 const a=new RB.Session(Team.create()),b=new RB.Session(Team.create());
 assert.equal(a.count,4);assert.ok(a.submit(3,1,{keys:{left:true},pulses:['kick']}));
 assert.equal(a.submit(4,1,{}),false);assert.equal(a.submit(-1,1,{}),false);
 for(let f=1;f<=65;f++){
  for(let slot=0;slot<4;slot++){
   const payload={keys:{right:slot%2===0&&f<20,left:slot%2===1&&f<20},pulses:f===24?['light']:[]};
   a.submit(slot,f,payload);b.submit(slot,f,payload);
  }
  a.advance();b.advance();
 }
 assert.equal(a.frame,65);assert.equal(a.digest(),b.digest());
});
test('late remote input converges through 4-player rollback',()=>{
 const ideal=new RB.Session(Team.create(['azhi','winnie','sezi','gambler'],{seed:888}));
 const delayed=new RB.Session(Team.create(['azhi','winnie','sezi','gambler'],{seed:888}));
 for(let f=1;f<=90;f++){
  for(let slot=0;slot<4;slot++){
   const input={keys:{right:slot%2===0&&f%35<20,left:slot%2===1&&f%47<24},pulses:f%23===slot*3+2?['light']:[]};
   ideal.submit(slot,f,input);
   if(slot!==3)delayed.submit(slot,f,input);
  }
  ideal.advance();delayed.advance();
  if(f>5)delayed.submit(3,f-5,{keys:{left:(f-5)%47<24},pulses:(f-5)%23===11?['light']:[]});
 }
 for(let f=86;f<=90;f++)delayed.submit(3,f,{keys:{left:f%47<24},pulses:f%23===11?['light']:[]});
 assert.ok(delayed.rollbacks>0);assert.equal(ideal.digest(),delayed.digest());
});
test('team game never attacks a teammate even within the hitbox',()=>{
 const m=Team.create(['winnie','azhi','sezi','gambler']);
 m.players[0].x=430;m.players[2].x=483;m.players[1].x=770;m.players[3].x=850;
 Team.input(m,0,{pulses:['heavy']});for(let i=0;i<18;i++)Team.step(m);
 assert.equal(m.players[2].hp,100);
});
test('team game resolves attacks on opposing fighters',()=>{
 const m=Team.create(['winnie','azhi','sezi','gambler']);
 m.players[0].x=400;m.players[1].x=475;m.players[2].x=175;m.players[3].x=825;
 Team.input(m,0,{pulses:['heavy']});for(let i=0;i<22;i++)Team.step(m);
 assert.ok(m.players[1].hp<100,'opposing fighter must be damaged');
 assert.equal(m.players[2].hp,100,'teammate undamaged');
});
test('team round KO requires eliminating BOTH enemy players',()=>{
 const m=Team.create();m.players[1].hp=0;Team.step(m);assert.equal(m.status,'playing');
 m.players[3].hp=0;Team.step(m);assert.equal(m.status,'between');assert.deepEqual(m.scores,[1,0]);
 for(let i=0;i<121;i++)Team.step(m);
 assert.equal(m.round,2);assert.equal(m.status,'playing');
 m.players[1].hp=0;m.players[3].hp=0;Team.step(m);
 assert.equal(m.status,'finished');assert.equal(m.winnerTeam,0);assert.deepEqual(m.scores,[2,0]);
});
test('spectators can receive compact serializable authoritative team state',()=>{
 const m=Team.create();Team.input(m,2,{pulses:['special']});Team.step(m);
 const snap=Team.serialize(m);assert.equal(snap.players.length,4);assert.equal(snap.type,'state');assert.equal(snap.ruleset,'team');
 assert.ok(Array.isArray(snap.projectiles));assert.deepEqual(snap.scores,[0,0]);
});
test('1v1 rollback still supports exactly two players',()=>{
 const s=new RB.Session(Core.create());assert.equal(s.count,2);assert.equal(s.submit(2,1,{}),false);
 s.advance();assert.equal(s.game.players.length,2);
});
