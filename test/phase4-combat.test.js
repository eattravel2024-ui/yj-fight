'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../public/core'),T=require('../public/team-core'),RB=require('../public/rollback');
function arena(E,a='azhi',b='sezi'){
 const g=E===C?C.create(a,b,{seed:73}):T.create([a,b,'azhi','winnie'],{seed:73});
 g.players[0].x=430;g.players[1].x=505;for(const p of g.players.slice(2))p.hp=0;return g;
}
function strike(E,g,name='heavy'){
 const p=g.players[0];C.startMove(g,p,name);p.move.frame=C.moveFor(p,name).start-1;
 if(E===T){p.move.hitSlots=[];p.move.hitCounts={};}E.step(g);if(name==='throw')for(let i=0;i<60&&!g.events.some(e=>e.kind==='hit');i++)E.step(g);return g.events.find(e=>e.kind==='hit');
}
test('Phase 4 roles are real combat data, preserving four original one-button skills',()=>{
 assert.equal(C.INPUT_BUFFER,10);assert.ok(C.CHAR.azhi.speed>C.CHAR.sezi.speed);
 assert.ok(C.moveFor('azhi','light').recovery<C.moveFor('winnie','light').recovery);
 assert.ok(C.CHAR.winnie.power>C.CHAR.gambler.power);
 assert.ok(C.moveFor('gambler','special').recovery>C.moveFor('sezi','special').recovery);
 for(const id of Object.keys(C.CHAR))for(const key of C.ATTACKS){const d=C.moveFor(id,key);if(!d){assert.ok(C.MOVE[key].characters&&!C.MOVE[key].characters.includes(id));continue;}if(d.nonContact){assert.equal(d.damage,0);assert.equal(d.gain,0);continue;}assert.ok(d.hitstun>0&&d.blockstun>=0&&d.hitstop>0&&d.blockstop>0);assert.ok(d.hitstop<=15);}
 assert.equal(C.CHAR.azhi.special,'加油加300');assert.equal(C.CHAR.sezi.special,'高雄發大財');
});
for(const [label,E] of [['1v1',C],['2v2',T]]){
 test(label+' guard uses per-move blockstun, continuous defence and a buffered recovery reversal',()=>{
  const g=arena(E,'azhi','winnie'),def=g.players[1];E.input(g,1,{guard:true});const hit=strike(E,g);
  assert.equal(hit.block,true);assert.equal(def.blockstun,C.moveFor('azhi','heavy').blockstun);assert.equal(def.stun,def.blockstun);
  while(g.hitstop>0)E.step(g);
  while(def.stun>2)E.step(g);
  E.input(g,1,{pulses:['light']});E.step(g);assert.equal(def.move,null);
  E.step(g);assert.equal(def.move?.name,'light');assert.equal(def.blockstun,0);
 });
 test(label+' Sezi just guard has zero chip, a bounded cooldown and one earned riposte',()=>{
  const g=arena(E,'azhi','sezi'),def=g.players[1];E.input(g,1,{guard:true});const hit=strike(E,g,'light');
  assert.equal(hit.perfectGuard,true);assert.equal(hit.appliedDamage,0);assert.equal(def.hp,100);assert.ok(def.riposteFrames>0);assert.ok(def.guardReadyTick>g.tick);
  E.input(g,1,{});E.input(g,1,{guard:true});assert.ok(def.guardTapUntil<g.tick,'rapid guard toggles cannot refresh just guard');
  while(g.hitstop>0||def.stun>0)E.step(g);E.input(g,1,{pulses:['upper']});E.step(g);
  assert.equal(def.move?.name,'upper');assert.equal(def.move.riposte,true);assert.equal(def.riposteFrames,0);
 });
 test(label+' Sezi late guard is normal defence; throws bypass even perfectly timed guard',()=>{
  const g=arena(E,'azhi','sezi');E.input(g,1,{guard:true});for(let i=0;i<8;i++)E.step(g);
  const hit=strike(E,g,'heavy');assert.equal(hit.perfectGuard,false);assert.ok(hit.appliedDamage>0);assert.equal(g.players[1].riposteFrames,0);
  const t=arena(E,'azhi','sezi');t.players[1].x=490;E.input(t,1,{guard:true});const thrown=strike(E,t,'throw');assert.equal(thrown.block,false);assert.equal(thrown.perfectGuard,false);assert.ok(thrown.appliedDamage>10);
 });
 test(label+' Gambler earns punish damage against recovery and exposes long whiff recovery',()=>{
  const neutral=arena(E,'gambler','winnie'),punish=arena(E,'gambler','winnie');
  const target=punish.players[1];C.startMove(punish,target,'heavy');target.move.frame=C.moveFor(target,'heavy').start+C.moveFor(target,'heavy').active+1;
  const a=strike(E,neutral),b=strike(E,punish);assert.equal(b.punish,true);assert.ok(b.damage>a.damage);
  const whiff=arena(E,'gambler','winnie');whiff.players[1].x=900;E.input(whiff,0,{pulses:['special']});E.step(whiff);
  const d=C.moveFor('gambler','special');for(let i=0;i<d.start+d.active;i++)E.step(whiff);
  assert.equal(whiff.players[0].move?.name,'special');assert.equal(whiff.players[0].armorCharges,0);assert.ok(d.recovery>=40);
 });
 test(label+' projectile hit clears stale buffered attacks and uses actual move impact timing',()=>{
  const g=arena(E,'azhi','winnie'),target=g.players[1];target.stun=5;E.input(g,1,{pulses:['heavy']});
  g.projectiles.push({owner:0,team:0,level:'mid',fromMove:'super',x:target.x,y:100,vx:0,w:10,h:20,life:2,damage:24});E.step(g);
  const hit=g.events.find(e=>e.kind==='hit');assert.equal(target.buffer.length,0);assert.equal(hit.hitstop,C.moveFor('azhi','super').hitstop);assert.equal(hit.hitstun,target.stun);
 });
 test(label+' an old projectile cannot confirm or cancel a newer cast of the same skill',()=>{
  const g=arena(E,'azhi','winnie'),p=g.players[0];p.meter=100;C.startMove(g,p,'special');const oldSerial=p.move.serial;
  C.startMove(g,p,'special');if(E===T){p.move.hitSlots=[];p.move.hitCounts={};}
  const target=g.players[1];g.projectiles.push({owner:0,team:0,activation:oldSerial,level:'mid',fromMove:'special',x:target.x,y:100,vx:0,w:10,h:20,life:2,damage:12});
  E.step(g);assert.ok(target.hp<100);assert.equal(p.move.hit,false);assert.equal(C.canCancel(p),false);
 });
 test(label+' new defensive state, hitstop inputs and punish events remain deterministic under delayed rollback',()=>{
  const initial=arena(E,'azhi','sezi'),ideal=new RB.Session(initial),late=new RB.Session(initial),pending=[];
  for(let f=1;f<=155;f++){
   if(f<=145)for(let slot=0;slot<initial.players.length;slot++){
    const entry={keys:{guard:slot===1&&f%36<12},pulses:slot===0&&f%31===1?['light']:slot===1&&f%36===16?['upper']:[]};
    ideal.submit(slot,f,entry);pending.push({at:f+1+(f+slot*3)%9,slot,f,entry});
   }
   for(const p of pending.filter(p=>p.at===f))late.submit(p.slot,p.f,p.entry);ideal.advance();late.advance();
  }
  assert.ok(late.rollbacks>0);assert.equal(late.digest(),ideal.digest());for(let f=135;f<=155;f++)assert.deepEqual(late.events.get(f),ideal.events.get(f));
 });
}
test('1v1 and 2v2 share identical damage, guard, stun and feedback on the same contact',()=>{
 for(const id of Object.keys(C.CHAR))for(const guard of [false,true]){
  const events=[];for(const E of [C,T]){const g=arena(E,id,'sezi');if(guard)E.input(g,1,{guard:true});const e=strike(E,g);events.push([e.damage,e.block,e.perfectGuard,e.hitstop,e.hitstun,e.blockstun,g.players[1].hp]);}assert.deepEqual(events[0],events[1],id);
 }
});
