const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const C=require('../public/core.js');
const expected=['winnie','sezi','gambler','azhi'];
test('four original fighter identities after the requested roster removal and no KOF character substitution',()=>{
 assert.deepEqual(Object.keys(C.CHAR).sort(),expected.sort());
 for(const id of expected){assert.equal(typeof C.CHAR[id].special,'string');assert.ok(fs.existsSync(path.join(__dirname,'../public/art/face_'+id+'.png')))}
});
test('all four differ in their unique normal attacks and signature frames',()=>{
 const data=expected.map(id=>[C.moveFor(id,'heavy').damage,C.moveFor(id,'special').startup,C.moveFor(id,'kick').reach,C.moveFor(id,'low').startup]);
 assert.equal(new Set(data.map(x=>x.join(','))).size,4);
});
test('Winnie creates a ground shockwave projectile and Gambler creates playing card projectile',()=>{
 for(const [id,kind,level] of [['winnie','wave','low'],['gambler','card','mid']]){
 const m=C.create(id,'winnie');m.players[0].meter=100;m.players[0].x=250;m.players[1].x=650;
 C.input(m,0,{pulses:['special']});let shot=null;
 for(let n=0;n<80;n++){C.step(m);shot=m.projectiles[0];if(shot)break}
 assert.ok(shot,`${id} missing projectile`);assert.equal(shot.kind,kind);assert.equal(shot.level,level);
 }
});
test('Azhi one-button signature grants its single-hit counter armor during startup',()=>{
 const m=C.create('azhi','winnie');m.players[0].meter=25;m.players[0].x=300;m.players[1].x=385;
 C.input(m,0,{pulses:['special']});C.step(m);
 assert.equal(m.players[0].move?.name,'special');
 C.input(m,1,{pulses:['light']});for(let n=0;n<14;n++){C.step(m);if(m.events.some(e=>e.kind==='armor'))break}
 assert.equal(m.players[0].move?.name,'special');
 assert.ok(m.events.some(e=>e.kind==='armor'),'armor event not emitted');
 assert.equal(m.players[0].armorCharges,0,'the signature armor is consumed by the jab');
});
test('sprites retain canonical 240x300, 17-row, 10-column atlas (PNG header)',()=>{
 for(const id of expected){const d=fs.readFileSync(path.join(__dirname,'../public/sprites/'+id+'.png'));assert.equal(d.subarray(1,4).toString(),'PNG');assert.equal(d.readUInt32BE(16),2400);assert.equal(d.readUInt32BE(20),5100)}
});
