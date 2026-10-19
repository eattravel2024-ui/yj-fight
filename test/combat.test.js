'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../public/core.js');
function attack(type,{defender={},attacker={},facing=1}={}){
 const m=C.create('azhi','winnie',{seed:42});m.players[0].x=440;m.players[0].face=1;m.players[1].x=510;m.players[1].face=-1;
 Object.assign(m.players[0],attacker);Object.assign(m.players[1],defender);
 C.input(m,0,{[type]:true});C.input(m,1,{});for(let i=0;i<36;i++){if(i>0)C.input(m,0,{});C.step(m)}return m;
}
test('characters and independent frame-data available',()=>{
 assert.equal(Object.keys(C.CHAR).length,4);assert.notEqual(C.MOVE.light.start,C.MOVE.heavy.start);assert.notEqual(C.MOVE.kick.reach,C.MOVE.low.reach);assert.equal(C.FPS,60);
});
test('light punch hitbox reduces opponent health',()=>{const m=attack('light');assert.ok(m.players[1].hp<100);assert.ok(m.players[1].hp>=90)});
test('heavy punch causes greater damage than light',()=>{assert.ok(attack('heavy').players[1].hp<attack('light').players[1].hp)});
test('standing guard reduces mid attacks',()=>{const m=C.create('azhi','winnie');m.players[0].x=455;m.players[1].x=535;C.input(m,1,{guard:true});C.input(m,0,{heavy:true});for(let i=0;i<18;i++){if(i>0)C.input(m,0,{});C.step(m)}assert.ok(m.players[1].hp>85, 'blocked damage should be small')});
test('throw bypasses guarding',()=>{const m=C.create('azhi','winnie');m.players[0].x=460;m.players[1].x=515;C.input(m,1,{guard:true});C.input(m,0,{throw:true});for(let i=0;i<70;i++){if(i>0)C.input(m,0,{});C.step(m)}assert.ok(m.players[1].hp<92);assert.equal(m.grapples.length,0)});
test('one-button special accepts exactly 25 meter and rejects 24',()=>{
 for(const meter of [24,25]){
  const m=C.create('azhi','winnie');m.players[0].meter=meter;
  C.input(m,0,{pulses:['special']});C.step(m);
  assert.equal(m.players[0].move?.name,meter===25?'special':undefined);
  assert.equal(m.players[0].meter,meter===25?0:24,'meter is spent once when the skill starts');
 }
 assert.ok(attack('special',{attacker:{meter:25}}).players[1].hp<100);
});
test('player movement and wall clamp remain valid',()=>{const m=C.create();C.input(m,0,{left:true});for(let i=0;i<180;i++)C.step(m);assert.ok(m.players[0].x>=48)});
test('server state is serializable and event queue drains',()=>{const m=attack('kick');let s=C.serialize(m);assert.equal(s.type,'state');assert.ok(Array.isArray(s.players));assert.equal(s.players[0].char,'azhi');assert.equal(C.serialize(m).events.length,0)});
test('anti-air launch remains inside visible fighting arena physics',()=>{const m=attack('upper');assert.ok(m.players[1].y<250,'uppercut should not launch victim thousands of pixels')});
test('after a complete round the match can start another round',()=>{const m=C.create();m.players[1].hp=0;C.step(m);assert.equal(m.status,'between');for(let i=0;i<145;i++)C.step(m);assert.equal(m.status,'playing');assert.equal(m.round,2)});

test('three distinct jab animations chain after confirmed contact',()=>{
 const m=C.create('azhi','winnie');m.players[1].x=m.players[0].x+75;
 const seen=[];
 for(let t=0;t<32;t++){
   C.input(m,0,{light:[0,10,19].includes(t)});C.input(m,1,{});C.step(m);
   if(m.players[0].move?.name&&!seen.includes(m.players[0].move.name))seen.push(m.players[0].move.name);
 }
 assert.deepEqual(seen.slice(0,3),['light','light2','light3']);
 assert.ok(m.players[1].hp<80);
});

test('network key pulse is not lost when a short press is released before a server tick',()=>{
 const m=C.create('sezi','winnie');m.players[1].x=m.players[0].x+80;
 C.input(m,0,{light:false,pulses:['light']});C.step(m);
 assert.equal(m.players[0].move?.name,'light');
});

test('hitstop pauses frames while retaining input in the buffer',()=>{
 const m=C.create('azhi','winnie');m.players[1].x=m.players[0].x+80;
 C.input(m,0,{light:true});C.step(m);C.input(m,0,{light:false});
 for(let i=0;i<4;i++)C.step(m);
 assert.ok(m.hitstop>0);
 const current=m.players[0].move.frame;
 C.input(m,0,{light:false,pulses:['light']});C.step(m);
 assert.equal(m.players[0].move.frame,current);
 assert.ok(m.players[0].buffer.some(x=>x.key==='light'));
});

test('attack frames have separate startup active recovery windows and real height data',()=>{
 for(const key of C.ATTACKS){const m=C.MOVE[key];assert.ok(m.start>0&&m.active>0&&m.recovery>0);if(m.nonContact){assert.equal(m.damage,0);assert.equal(C.Boxes.hitbox({x:400,y:0,face:1},m),null)}else assert.ok(m.hitHeight>0&&m.impactY>0)}
 assert.ok(C.MOVE.kick.reach>C.MOVE.light.reach);
 assert.ok(C.MOVE.low.impactY<C.MOVE.upper.impactY);
});
