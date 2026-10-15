'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const VFX=require('../public/skill-vfx.js'),Animation=require('../public/engine/animation.js');
const characters=['winnie','sezi','gambler','azhi'];
function event(char,extra={}){return {kind:'skill',char,slot:0,move:'special',x:320,y:20,...extra};}
function recordingContext(){const calls=[];const ctx=new Proxy({}, {get:(target,key)=>key in target?target[key]:(...args)=>{calls.push([key,...args]);},set:(target,key,value)=>{target[key]=value;calls.push(['set',key,value]);return true;}});return {ctx,calls};}
test('each original fighter has distinct skill choreography without mutating confirmed events',()=>{
 const fx=VFX.create();const events=characters.map(char=>Object.freeze(event(char)));
 for(const e of events)assert.equal(fx.emit(e,100),true);
 assert.deepEqual(fx.snapshot(100).map(b=>b.style),['shockwave','spin','cards','counter']);
 const paths=characters.map(char=>{const one=VFX.create();one.emit(event(char),100);const {ctx,calls}=recordingContext();one.draw(ctx,350);return JSON.stringify(calls);});
 assert.equal(new Set(paths).size,4);
 assert.equal(events[0].x,320);
});
test('skills align with gameplay world height and honor facing and camera projection',()=>{
 const fx=VFX.create();fx.emit(event('winnie',{x:400,y:100,face:-1}),100);
 const {ctx,calls}=recordingContext();fx.draw(ctx,200);
 assert.deepEqual(calls.find(c=>c[0]==='translate'),['translate',400,256]);
 assert.deepEqual(calls.find(c=>c[0]==='scale'),['scale',-1,1]);
 const custom=recordingContext();fx.draw(custom.ctx,200,{project:(x,y)=>({x:x/2,y:y*2})});
 assert.deepEqual(custom.calls.find(c=>c[0]==='translate'),['translate',200,90]);
});
test('replayed visual events are bounded and expire after a match is abandoned',()=>{
 for(const quality of ['high','low']){
  const fx=VFX.create({quality});
  for(let i=0;i<1000;i++)fx.emit(event(characters[i%4],{move:'super'}),100);
  const stats=fx.stats(100);
  assert.ok(stats.bursts<=stats.budget.bursts);assert.ok(stats.particles<=stats.budget.particles);
  assert.equal(fx.snapshot(1350).length,0);
 }
 const fx=VFX.create();fx.emit(event('azhi'),10);fx.clear();assert.equal(fx.stats(10).particles,0);
});
test('malformed or unrelated network events do not allocate effects',()=>{
 const fx=VFX.create();
 for(const bad of [null,{},event('sam'),event('__proto__'),event('constructor'),event('azhi',{x:NaN}),event('azhi',{y:Infinity}),event('azhi',{kind:'hit'}),event('azhi',{move:'__proto__'})])assert.equal(fx.emit(bad,100),false);
 assert.equal(fx.stats(100).bursts,0);
});
test('reduced motion keeps geometry stationary and only fades, with no screen flash or shake',()=>{
 const fx=VFX.create({reducedMotion:true});for(const char of characters)fx.emit(event(char),100);
 const first=recordingContext(),second=recordingContext();fx.draw(first.ctx,250);fx.draw(second.ctx,600);
 const geometry=calls=>calls.filter(c=>!(c[0]==='set'&&c[1]==='globalAlpha'));
 assert.deepEqual(geometry(first.calls),geometry(second.calls));
 assert.equal(first.calls.some(c=>c[0]==='set'&&c[1]==='globalCompositeOperation'),false);
 assert.equal(first.calls.some(c=>c[0]==='fillRect'&&c[3]>=960),false);
});
test('rendering skills does not need random numbers or external sprite assets',()=>{
 const source=require('node:fs').readFileSync(require.resolve('../public/skill-vfx.js'),'utf8');
 assert.doesNotMatch(source,/Math\.random|new Image|fetch\(/);
 const fx=VFX.create();for(const char of characters)fx.emit(event(char,{move:'super'}),100);
 const {ctx}=recordingContext();assert.doesNotThrow(()=>fx.draw(ctx,400));
});
test('knockout and win play once and hold their final pose across new state snapshots',()=>{
 for(const action of ['ko','win']){
  const playback=Animation.createPlayback();
  assert.equal(playback.spriteFrame({slot:0,char:'azhi'},action,120),0);
  const middle=playback.spriteFrame({slot:0,char:'azhi'},action,120.4);
  assert.ok(middle>0&&middle<9);
  assert.equal(playback.spriteFrame({slot:0,char:'azhi'},action,122),9);
  assert.equal(playback.spriteFrame({slot:0,char:'azhi'},action,125),9);
  playback.spriteFrame({slot:0,char:'azhi'},'idle',126);
  assert.equal(playback.spriteFrame({slot:0,char:'azhi'},action,127),0);
 }
});
test('animation playback isolates slots, clears on new matches, and preserves simulation move phases',()=>{
 const playback=Animation.createPlayback(),move={startup:5,active:5,recovery:8};
 playback.spriteFrame({slot:0,char:'azhi'},'ko',10);
 assert.equal(playback.spriteFrame({slot:1,char:'winnie'},'ko',12),0);
 assert.equal(playback.spriteFrame({slot:0,char:'azhi'},'ko',12),9);
 for(const [frame,expected] of [[0,0],[5,3],[9,7],[10,8],[17,9]])assert.equal(playback.spriteFrame({slot:0,move:{frame}},'special',20,move),expected);
 playback.clear();assert.equal(playback.spriteFrame({slot:0,char:'azhi'},'ko',30),0);
});
