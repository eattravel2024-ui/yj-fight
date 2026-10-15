'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../public/engine/animation'),C=require('../public/core');
test('four skill atlases follow startup, active and recovery at any display refresh rate',()=>{
 const profiles=[];
 for(const char of Object.keys(C.CHAR)){
  const move=C.moveFor(char,'special'),p={char,slot:0,move:{name:'special',frame:0}},frames=[];
  for(let n=0;n<move.start+move.active+move.recovery;n++){
   p.move.frame=n;const f=A.spriteFrame(p,'special',n/30,move);frames.push(f);
   assert.equal(A.spriteFrame(p,'special',n/144,move),f);
   assert.ok(n<move.start?f<=2:n<move.start+move.active?f>=3&&f<=7:f>=8);
  }
  profiles.push(frames.join(','));
 }
 assert.equal(new Set(profiles).size,4);
});
test('jump, dash and hurt poses use fighter state instead of wall clock loops',()=>{
 for(const [action,p] of [['jump',{y:80,vy:-5}],['dash',{dash:6}],['hurt',{flash:4,stun:12}]])assert.equal(A.spriteFrame(p,action,1),A.spriteFrame(p,action,500));
 assert.ok(A.spriteFrame({vy:7},'jump',0)<A.spriteFrame({vy:-7},'jump',0));
});
test('hitstop freezes every slot and resumes without idle animation time skipping',()=>{
 const playback=A.createPlayback(),p={char:'azhi',slot:0};const f=playback.spriteFrame(p,'idle',1);
 for(const t of [1.1,1.2,1.3])assert.equal(playback.spriteFrame(p,'idle',t,null,{hitstop:3}),f);
 assert.equal(playback.spriteFrame(p,'idle',1.31,null,{hitstop:0}),f);
 assert.equal(playback.spriteFrame(p,'hurt',1.4,null,{hitstop:2}),f);
 assert.notEqual(playback.spriteFrame({...p,flash:12},'hurt',1.41,null,{hitstop:0}),f);
});

test('Sezi holds the crouch pose without replaying sweep attacks',()=>{
 const p={char:'sezi',crouch:true};
 for(const time of [0,1,500])assert.equal(A.spriteFrame(p,'low',time),1);
 const move=C.moveFor('sezi','low');p.move={name:'low',frame:move.start+1};
 const active=A.spriteFrame(p,'low',1,move);assert.ok(active>=3&&active<=7);
 assert.equal(A.frameSize('sezi').width,384);
});
