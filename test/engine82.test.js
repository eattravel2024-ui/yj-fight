'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const C=require('../public/core.js');
function step(m,n=1){for(let i=0;i<n;i++)C.step(m)}
test('input buffer defaults to 10F, Azhi uses 12F, and both expire deterministically',()=>{
 assert.equal(C.INPUT_BUFFER,10);
 for(const [char,window]of [['azhi',12],['gambler',10],['sezi',10],['winnie',10]]){const m=C.create(char),p=m.players[0];p.stun=30;C.input(m,0,{pulses:['light']});assert.equal(p.buffer[0].until-m.tick,window);step(m,window+1);assert.equal(p.buffer.length,0);}
});
test('buffered button during the final 6 frames of recovery executes automatically',()=>{
 const m=C.create(),p=m.players[0];m.players[1].x=880;
 C.input(m,0,{pulses:['heavy']});C.step(m);
 const d=C.moveFor(p,'heavy');
 while(p.move?.frame<d.start+d.active+d.recovery-6)C.step(m);
 C.input(m,0,{pulses:['light']});
 for(let i=0;i<9;i++)C.step(m);
 assert.equal(p.move?.name,'light');
});
test('cancel tree supports light -> heavy -> special -> super, not the reverse',()=>{
 assert.ok(C.canChain('light','heavy'));assert.ok(C.canChain('heavy','special'));
 assert.ok(C.canChain('special','super'));assert.equal(C.canChain('heavy','light'),false);
 assert.equal(C.canChain('super','special'),false);
});
test('confirmed special can cancel to super when 60 meter remains',()=>{
 const m=C.create(),p=m.players[0],d=C.moveFor(p,'special');
 p.meter=100;p.move={name:'special',frame:d.cancelStart,hit:true,blocked:false,hits:1,spawned:true};
 C.input(m,0,{pulses:['super']});C.step(m);
 assert.equal(p.move?.name,'super');assert.equal(p.meter,40);
 assert.ok(m.events.some(e=>e.kind==='super'));
});
test('melee super requires meter, and its hitstop is stronger than a light jab',()=>{
 const m=C.create('gambler','winnie');
 C.input(m,0,{pulses:['super']});C.step(m);assert.equal(m.players[0].move,null);
 m.players[0].meter=100;m.players[0].x=430;m.players[1].x=515;
 C.input(m,0,{pulses:['super']});
 for(let i=0;i<60;i++){C.step(m);if(m.hitstop>0)break}
 assert.equal(m.hitstop,14);assert.ok(m.players[1].hp<100);
});
test('corner knockback transfers excess velocity to the attacker',()=>{
 const m=C.create();const a=m.players[0],b=m.players[1];
 a.x=854;b.x=912;C.applyPushback(a,b,42);
 assert.equal(b.x,912);assert.equal(a.x,812);
 a.x=48;b.x=48;C.resolvePushboxes(a,b);
 assert.ok(b.x-a.x>=58-1e-6,'pushboxes should not intersect at the left wall');
});
test('gallery artwork and transparent effect atlas are shipped with all four originals',()=>{
 const art=path.join(__dirname,'../public/art');
 for(const id of Object.keys(C.CHAR))assert.ok(fs.statSync(path.join(art,'moves',id+'.webp')).size>10_000);
 for(const id of Object.keys(C.CHAR))assert.ok(fs.statSync(path.join(art,'portrait_'+id+'.webp')).size>10_000);
 const fx=fs.readFileSync(path.join(art,'vfx','impacts.png'));
 assert.equal(fx.toString('hex',0,8),'89504e470d0a1a0a');
 assert.equal(fx.readUInt32BE(16),1440);assert.equal(fx.readUInt32BE(20),540);
});
test('browser includes I uppercut, O super and rematch controls',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const browser=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 assert.match(html,/data-key="upper"/);assert.match(html,/data-key="super"/);
 assert.match(html,/id="rematchButton"/);assert.match(browser,/KeyO:'super'/);
 assert.match(server,/msg\.type==='rematch'/);assert.match(server,/room\.players\.every\(p=>p\.ready\)/);
});
test('Gambler black-gold armor absorbs the first light hit without hitstun',()=>{
 const m=C.create('winnie','gambler');const attacker=m.players[0],foe=m.players[1];
 attacker.x=430;foe.x=510;foe.armorTimer=90;foe.armorCharges=1;
 C.input(m,0,{pulses:['light']});
 for(let i=0;i<8;i++)C.step(m);
 assert.ok(foe.hp<100);assert.equal(foe.stun,0);assert.equal(foe.armorCharges,0);
 assert.ok(m.events.some(e=>e.kind==='armor'));
});
test('Transferred fortune effects use deterministic seeded RNG, not Math.random',()=>{
 const a=C.create('azhi','winnie',{seed:199}),b=C.create('azhi','winnie',{seed:199});
 for(const m of [a,b]){
  m.players[0].meter=100;
  C.input(m,0,{pulses:['special']});
  for(let i=0;i<20;i++)C.step(m);
 }
 assert.ok(a.projectiles.length>0);assert.deepEqual(a.projectiles,b.projectiles);
 assert.ok(['jackpot','blank','standard'].includes(a.projectiles[0].fortune));
});
