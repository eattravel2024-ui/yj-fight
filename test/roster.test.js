'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const C=require('../public/core.js');
const IDs=['winnie','sezi','gambler','azhi'];
test('all four fighters can be chosen in both player slots',()=>{
 assert.deepEqual(Object.keys(C.CHAR),IDs);
 for(const a of IDs){for(const b of IDs){const m=C.create(a,b);assert.equal(m.players[0].char,a);assert.equal(m.players[1].char,b)}}
});
test('each fighter has an independently balanced special attack',()=>{
 const stats=new Set();for(const id of IDs){const d=C.moveFor(id,'special');assert.ok(d.damage>0&&d.reach>0&&d.active>0);stats.add(`${d.start}/${d.reach}/${d.damage}/${d.recovery}`)}assert.equal(stats.size,4)
});
test('all fighters have a usable one-button signature hitbox',()=>{
 for(const id of IDs){const m=C.create(id,'winnie',{seed:33});m.players[0].x=440;m.players[1].x=535;m.players[0].meter=100;
  C.input(m,0,{special:true});C.input(m,1,{});
  for(let i=0;i<45;i++){if(i===1)C.input(m,0,{});C.step(m)}
  assert.ok(m.players[1].hp<100,`${id} special should hit at 95px distance`);
 }
});
test('portraits and 17x10 animation atlases are present for every character',()=>{
 const base=path.resolve(__dirname,'../public');const m=JSON.parse(fs.readFileSync(path.join(base,'sprites/manifest.json'),'utf8'));
 assert.equal(m.actions.length,17);assert.equal(m.framesPerAction,10);assert.equal(m.frameWidth,240);assert.equal(m.frameHeight,300);
 assert.deepEqual(Object.keys(m.characters),IDs,'the atlas manifest matches the playable roster');
 for(const id of IDs){assert.ok(m.characters[id]);for(const f of [`art/portrait_${id}.webp`,`sprites/${id}.png`]){let s=fs.statSync(path.join(base,f));assert.ok(s.size>10000,`${f} should not be empty`)}}
});
test('retired character cannot be regenerated or imported by authoring tools',()=>{
 const base=path.resolve(__dirname,'..');
 for(const file of ['make_sprites.py','tools/import_legacy_atlas.py']){
  const source=fs.readFileSync(path.join(base,file),'utf8');
  assert.doesNotMatch(source,/['"]sam['"]/,'authoring tools must use the current four identities');
  for(const id of IDs)assert.ok(source.includes(`'${id}'`),`${file} must support ${id}`);
 }
 for(const file of ['art/portrait_sam.webp','art/face_sam.png','art/moves/sam.webp','art/cutins/sam.webp','sprites/sam.png']){
  assert.equal(fs.existsSync(path.join(base,'public',file)),false,`${file} must be removed`);
 }
});
