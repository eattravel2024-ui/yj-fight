'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../public/core.js'),Team=require('../public/team-core.js'),RB=require('../public/rollback.js');
const IDS=['winnie','sezi','gambler','azhi'];
const NAMES={winnie:'不同意的請舉手',sezi:'高雄發大財',gambler:'加油加300',azhi:'膽大撐死膽小餓死'};
function game(core,id='azhi'){
 const m=core===Core?core.create(id,'winnie',{seed:73}):core.create([id,'winnie','gambler','sezi'],{seed:73});
 m.players.forEach((p,i)=>{p.x=[340,450,100,850][i];});
 return m;
}
function advance(core,m,n){for(let i=0;i<n;i++)core.step(m);}
test('four-character roster has distinct, named one-button signature skills',()=>{
 assert.deepEqual(Object.keys(Core.CHAR),IDS);
 assert.equal(Core.CHAR.sam,undefined);
 assert.equal(Core.create().players[1].char,'winnie');
 assert.deepEqual(Team.create().players.map(p=>p.char),['azhi','winnie','sezi','gambler']);
 assert.equal(new Set(IDS.map(id=>Core.CHAR[id].specialMode)).size,4);
 for(const id of IDS){
  const data=Core.CHAR[id];assert.equal(data.special,NAMES[id]);
  assert.ok(data.superName&&data.superName!==data.special);assert.ok(data.skillDescription);
 }
});
for(const [mode,core] of [['1v1',Core],['2v2',Team]]){
 test(`${mode}: every signature skill starts from one button with opening meter and emits its actual activation`,()=>{
  for(const id of IDS){const m=game(core,id),p=m.players[0],opening=p.meter;
   assert.ok(opening>=25);core.input(m,0,{pulses:['special']});
   assert.equal(m.events.some(e=>e.kind==='skill'),false,'input alone must not announce an unstarted skill');
   core.step(m);assert.equal(p.move?.name,'special',id);assert.equal(p.meter,opening-25,id);
   assert.deepEqual(m.events.find(e=>e.kind==='skill'),{kind:'skill',slot:0,char:id,move:'special',name:NAMES[id],style:Core.CHAR[id].specialMode,direction:1,x:p.x,y:0});
  }
 });
 test(`${mode}: insufficient meter neither spends meter nor announces a skill`,()=>{
  for(const move of ['special','super']){const m=game(core),p=m.players[0];p.meter=move==='special'?24:59;
   core.input(m,0,{pulses:[move]});core.step(m);assert.equal(p.move,null);
   assert.equal(p.meter,move==='special'?24:59);assert.equal(m.events.some(e=>e.kind==='skill'),false);
  }
 });
 test(`${mode}: supers keep a separate 60-meter cost and character animation event`,()=>{
  for(const id of IDS){const m=game(core,id),p=m.players[0];p.meter=60;
   core.input(m,0,{pulses:['super']});core.step(m);assert.equal(p.move?.name,'super');assert.equal(p.meter,0);
   const event=m.events.find(e=>e.kind==='skill');assert.equal(event?.name,Core.CHAR[id].superName);assert.equal(event?.move,'super');
  }
 });
 test(`${mode}: skill animation direction records the facing at activation`,()=>{
  const m=game(core),p=m.players[1];core.input(m,1,{pulses:['special']});core.step(m);
  const event=m.events.find(e=>e.kind==='skill'&&e.slot===1);assert.equal(event?.direction,-1);
  p.face=1;assert.equal(event.direction,-1,'later facing changes must not reverse an activated effect');
 });
 test(`${mode}: projectile super impacts preserve the source move for visual feedback`,()=>{
  for(const id of ['winnie','gambler']){const m=game(core,id);m.players[0].meter=100;
   core.input(m,0,{pulses:['super']});advance(core,m,50);
   const impact=m.events.find(e=>e.kind==='hit'&&e.slot===0);assert.ok(impact,`${id} projectile should hit`);
   assert.equal(impact.move,'super',`${id} super impact must keep its source move`);
   assert.equal(impact.hitstop,7,'impact metadata must match the unblocked projectile hitstop');
  }
 });
 test(`${mode}: blocked projectile impact reports the shorter guard hitstop`,()=>{
  const m=game(core,'winnie');m.players[0].meter=100;
  core.input(m,0,{pulses:['super']});core.input(m,1,{guard:true,down:true});advance(core,m,50);
  const impact=m.events.find(e=>e.kind==='hit'&&e.slot===0);assert.equal(impact?.block,true);assert.equal(impact.hitstop,4);
 });
 test(`${mode}: unavailable cancel does not hide a valid queued follow-up`,()=>{
  const m=game(core),p=m.players[0];p.meter=0;
  p.move={name:'light',frame:5,hit:true,blocked:false,hits:1,spawned:false,hitSlots:[1]};p.chain=1;
  p.buffer=[{key:'special',until:100},{key:'heavy',until:100}];
  core.step(m);assert.equal(p.move?.name,'heavy');
 });
 test(`${mode}: held guard protects either slot on the same simulation frame`,()=>{
  const hp=[];
  for(const slot of [0,1]){const m=game(core),attacker=m.players[slot],defender=m.players[1-slot];
   attacker.char='azhi';defender.char='winnie';attacker.x=slot===0?340:450;defender.x=slot===0?450:340;
   attacker.move={name:'heavy',frame:Core.moveFor(attacker,'heavy').start-1,hit:false,blocked:false,hits:0,spawned:false,hitSlots:[]};
   defender.stun=1;core.input(m,1-slot,{guard:true});core.step(m);hp.push(defender.hp);
   assert.ok(m.events.some(e=>e.kind==='hit'&&e.block),'guard should become active after the final stun frame');
  }
  assert.equal(hp[0],hp[1]);
 });
 test(`${mode}: Azhi signature absorbs an opening jab once and records the counter charge`,()=>{
  const m=game(core),p=m.players[0],foe=m.players[1];foe.char='azhi';foe.x=p.x+75;
  core.input(m,0,{special:true});core.step(m);
  foe.move={name:'light',frame:Core.moveFor(foe,'light').start-1,hit:false,blocked:false,hits:0,spawned:false,hitSlots:[]};
  core.step(m);assert.equal(p.move?.name,'special');assert.equal(p.move?.countered,true);
  assert.equal(p.armorCharges,0);assert.ok(m.events.some(e=>e.kind==='armor'));
 });
 test(`${mode}: late skill input replays to the same state and events under jitter`,()=>{
  const initial=game(core,'gambler');initial.players.forEach(p=>{p.meter=100});
  const ideal=new RB.Session(initial),delayed=new RB.Session(initial),pending=[];
  const total=110,delay=9;
  for(let frame=1;frame<=total+delay;frame++){
   if(frame<=total)for(let slot=0;slot<initial.players.length;slot++){
    const entry={keys:{guard:frame%41<7},pulses:frame===2+slot*3?['special']:frame===75+slot?['super']:[]};
    ideal.submit(slot,frame,entry);pending.push({at:frame+1+(frame*3+slot*5)%delay,slot,frame,entry});
   }
   for(const packet of pending.filter(p=>p.at===frame))delayed.submit(packet.slot,packet.frame,packet.entry);
   ideal.advance();delayed.advance();
  }
  assert.ok(delayed.rollbacks>0);assert.equal(delayed.digest(),ideal.digest());
  for(let frame=total;frame<=total+delay;frame++)assert.deepEqual(delayed.events.get(frame),ideal.events.get(frame));
 });
}
test('Sezi spin damage is bounded equally in 1v1 and 2v2',()=>{
 const damage=[];
 for(const core of [Core,Team]){const m=game(core,'sezi');m.players[1].x=420;
  core.input(m,0,{special:true});advance(core,m,85);damage.push(100-m.players[1].hp);
  assert.ok(damage.at(-1)>0&&damage.at(-1)<30);
 }
 assert.equal(damage[0],damage[1]);
});
