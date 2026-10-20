'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../public/core'),T=require('../public/training');
function setup(id,char='azhi'){const lab=T.create();assert.equal(lab.configure(id),true);const game=C.create(char,'winnie',{practice:true});lab.begin(game);return {lab,game};}
function step(lab,game,keys={}){C.input(game,0,keys);C.input(game,1,lab.input(game));C.step(game);const events=game.events.splice(0);lab.observe(game,events);return events;}
test('movement lesson uses actual engine position and does not pass on a button alone',()=>{const {lab,game}=setup('movement');assert.equal(lab.configure('made-up'),false);for(let i=0;i<40;i++)step(lab,game,{right:true});assert.equal(lab.snapshot.complete,true);assert.ok(lab.snapshot.progress>=80);});
for(const id of ['azhi','sezi','gambler','winnie'])test(id+' can complete first-hit, signature and throw lessons through real combat',()=>{
 for(const [lesson,key]of [['strike','light'],['signature','special'],['throw','throw']]){const {lab,game}=setup(lesson,id);let damage=0;for(let i=0;i<160&&!lab.snapshot.complete;i++){const events=step(lab,game,{pulses:i%60===0?[key]:[]});damage+=events.filter(e=>e.slot===0&&!e.block).reduce((n,e)=>n+(e.appliedDamage||0),0);}assert.equal(lab.snapshot.complete,true,id+' '+lesson);assert.ok(damage>0);}
});
test('guard and combo lessons require genuine contact and expose actual phases',()=>{
 const g=setup('guard');for(let i=0;i<160&&!g.lab.snapshot.complete;i++)step(g.lab,g.game,{guard:true});assert.equal(g.lab.snapshot.complete,true);assert.ok(g.game.players[0].hp>0);
 const {lab,game}=setup('combo');for(let i=0;i<160&&!lab.snapshot.complete;i++){const p=game.players[0],cancel=p.move&&C.canCancel(p);step(lab,game,{pulses:i===0?['light']:cancel?['heavy']:[]});}assert.equal(lab.snapshot.complete,true);assert.ok(lab.snapshot.lastHit.combo>=2);assert.match(T.frame(game),/HITSTOP|RECOVERY|ACTIVE|STARTUP/);
});
test('blocked/wrong-side/zero-damage contacts never complete attack lessons; free practice remains open',()=>{
 const {lab,game}=setup('signature');lab.observe(game,[{kind:'skill',slot:0,move:'special'},{kind:'hit',slot:1,target:0,move:'special',appliedDamage:40},{kind:'hit',slot:0,move:'special',appliedDamage:0},{kind:'hit',slot:0,move:'special',block:true,appliedDamage:2}]);assert.equal(lab.snapshot.complete,false);assert.equal(lab.setDummy('attack'),false);
 lab.configure('free');lab.begin(game);assert.equal(lab.setDummy('guard'),true);assert.equal(lab.setDummy('__proto__'),false);assert.deepEqual(lab.input(game),{guard:true});lab.observe(game,[{kind:'hit',slot:0,move:'light',appliedDamage:9,combo:1}]);assert.equal(lab.snapshot.lastHit.damage,9);assert.equal(lab.snapshot.complete,false);
});
