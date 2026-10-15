'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../public/core'),T=require('../public/team-core'),RB=require('../public/rollback');
function duel(engine,health=100){const g=engine===C?C.create('azhi','azhi'):T.create(['azhi','azhi','azhi','azhi']);g.players[0].x=430;g.players[1].x=500;for(const p of g.players.slice(2))p.hp=0;for(const p of g.players.slice(0,2)){p.hp=health;C.startMove(g,p,'light');p.move.frame=C.moveFor(p,'light').start-1;if(engine===T){p.move.hitSlots=[];p.move.hitCounts={}}}return g;}
for(const [label,engine] of [['1v1',C],['2v2',T]]){
 test(label+' same-frame attacks trade regardless of slot, including double KO',()=>{
  for(const hp of [100,1]){const g=duel(engine,hp);engine.step(g);assert.ok(g.players[0].hp<hp);assert.equal(g.players[0].hp,g.players[1].hp);assert.equal(g.events.filter(e=>e.kind==='hit').length,2);}
 });
 test(label+' combo damage scales, excludes chip, and resets after neutral',()=>{
  const g=duel(engine);g.players[1].move=null;engine.step(g);const first=g.events.find(e=>e.kind==='hit').damage;
  function strike(){g.hitstop=0;const [a,b]=g.players;a.x=430;b.x=500;b.stun=0;b.hp=100;a.chain=0;C.startMove(g,a,'light');a.move.frame=C.moveFor(a,'light').start-1;if(engine===T){a.move.hitSlots=[];a.move.hitCounts={}}g.events=[];engine.step(g);return g.events.find(e=>e.kind==='hit').damage;}
  assert.ok(strike()<=first);assert.ok(strike()<first);for(let i=0;i<10;i++)strike();assert.ok(strike()>=Math.round(first*.45));
  g.tick+=71;assert.equal(strike(),first);
  const target=g.players[1],count=target.comboTaken;assert.equal(C.comboScale(g,target,'light',false),1);assert.equal(target.comboTaken,count);
  g.tick++;assert.equal(C.comboScale(g,target,'super'),.9); 
 });
 test(label+' simultaneous combat survives rollback replay',()=>{
  const original=duel(engine),a=new RB.Session(RB.clone(original)),b=new RB.Session(RB.clone(original));
  const keys=f=>({right:f<10,pulses:f===15?['light']:[]});
  for(let f=1;f<=65;f++){a.submit(0,f,keys(f));a.advance();b.advance();if(f>6)b.submit(0,f-6,keys(f-6));}
  for(let f=60;f<=65;f++)b.submit(0,f,keys(f));
  assert.ok(b.rollbacks>0);assert.equal(RB.hash(a.game),RB.hash(b.game));
 });
}
for(const [label,engine] of [['1v1',C],['2v2',T]])test(label+' crossing projectiles preserve same-frame contacts despite pushback or KO',()=>{
 const g=duel(engine,1);for(const p of g.players)p.move=null;
 for(const owner of [0,1])g.projectiles.push({owner,team:owner,level:'mid',fromMove:'special',x:g.players[1-owner].x,y:100,vx:0,w:10,h:20,life:2,damage:16});
 engine.step(g);assert.equal(g.players[0].hp,0);assert.equal(g.players[1].hp,0);
 assert.equal(g.events.filter(e=>e.kind==='hit').length,2);
});

test('2v2 simultaneous team hits scale equally when allies exchange slots',()=>{
 function damage(swap){const g=T.create(['azhi','azhi','azhi','azhi']);g.players[3].hp=0;g.players[1].x=500;
  for(const [slot,name] of [[0,swap?'heavy':'light'],[2,swap?'light':'heavy']]){const p=g.players[slot];p.x=430;C.startMove(g,p,name);p.move.frame=C.moveFor(p,name).start-1;p.move.hitSlots=[];p.move.hitCounts={};}
  T.step(g);return g.events.filter(e=>e.kind==='hit').map(e=>[e.move,e.damage]).sort();
 }
 assert.deepEqual(damage(false),damage(true));assert.equal(damage(false).length,2);
});
