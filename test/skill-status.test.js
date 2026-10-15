'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../public/core');
test('one skill status distinguishes ready, energy, stun, phases and valid cancel windows',()=>{
 const m=C.create('gambler','winnie'),p=m.players[0];p.meter=100;
 const status=()=>C.skillStatus(m,0,'special');assert.equal(status().code,'ready');
 p.meter=24;assert.equal(status().code,'energy');p.meter=100;
 p.stun=12;assert.equal(status().code,'stun');p.stun=0;
 p.guard=true;assert.equal(status().code,'guard');p.guard=false;
 m.introFrames=30;assert.equal(status().code,'intro');m.introFrames=0;
 C.startMove(m,p,'heavy');p.move.frame=1;assert.equal(status().code,'startup');
 const d=C.moveFor(p,'heavy');p.move.frame=d.start;assert.equal(status().code,'active');
 p.move.hit=true;p.move.frame=d.cancelWindow[0];assert.equal(status().code,'cancel');assert.equal(status().available,true);
 p.move.frame=d.start+d.active+d.recovery-3;assert.equal(status().code,'recovery');assert.equal(status().canBuffer,true);
 p.move=null;m.status='finished';assert.equal(status().code,'finished');
 assert.equal(C.skillStatus(null,0,'special').code,'waiting');
});
