'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHealthTracker}=require('../public/hud');
test('damage trail settles despite continuous HUD updates and never changes real health',()=>{
 const h=createHealthTracker();h.sample(0,100,'match',0);const damage=h.sample(0,40,'match',100);assert.equal(damage.hp,40);assert.equal(damage.trail,100);
 for(let t=120;t<=440;t+=20)assert.equal(h.sample(0,40,'match',t).trail,100);
 assert.ok(h.sample(0,40,'match',600).trail<100);assert.equal(h.sample(0,40,'match',1100).trail,40);
});
test('trails reset for healing, corrected state, new round, and reduced motion',()=>{
 const h=createHealthTracker();h.sample(0,100,'r1',0);h.sample(0,20,'r1',100);
 assert.equal(h.sample(0,80,'r1',200).trail,80);assert.equal(h.sample(0,100,'r2',300).trail,100);
 assert.equal(h.sample(0,10,'r2',400,true).trail,10);assert.equal(h.sample(0,40,'r2',200).trail,40);
 assert.equal(h.sample(1,-10,'r2',500).level,'ko');assert.equal(h.sample(2,25,'r2',500).level,'danger');
});
