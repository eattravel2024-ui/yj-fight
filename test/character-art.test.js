'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const C=require('../public/core'),A=require('../public/character-art');
const root=path.resolve(__dirname,'..'),manifest=require('../assets/source-art/phase1_5/manifest.json');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
test('UI art maps all four real character IDs without modifying combat identities',()=>{
 assert.deepEqual([...A.IDS].sort(),Object.keys(C.CHAR).sort());
 for(const id of A.IDS){const art=A.forCharacter(id);for(const role of A.ROLES){assert.match(art[role+'Asset'],new RegExp('art/characters/'+id+'/'+role+'\\.webp'));assert.ok(Object.isFrozen(art));}}
 for(const id of ['sam','constructor','__proto__',null,{}])assert.equal(A.forCharacter(id),A.CHARACTER_ART.azhi);
 assert.equal(Object.hasOwn(C.CHAR.azhi,'portraitAsset'),false,'UI paths do not enter deterministic fighter data');
});
test('all supplied originals retain exact bytes and optimized role assets exist with recorded sizes',()=>{
 const sizes={fullbody:[768,1024],portrait:[512,512],hud:[256,256]};let sources=0,outputs=0,count=0;
 for(const id of A.IDS)for(const role of A.ROLES){
  const record=manifest.characters[id].assets[role],source=fs.readFileSync(path.join(root,record.source.path)),output=fs.readFileSync(path.join(root,record.output.path));
  assert.equal(sha(source),record.source.sha256);assert.equal(sha(output),record.output.sha256);
  assert.equal(source.subarray(1,4).toString(),'PNG');assert.equal(source.readUInt32BE(16),record.source.width);assert.equal(source.readUInt32BE(20),record.source.height);
  assert.equal(output.toString('ascii',0,4),'RIFF');assert.equal(output.toString('ascii',8,12),'WEBP');assert.deepEqual([record.output.width,record.output.height],sizes[role]);
  const relative=A.forCharacter(id)[role+'Asset'].split('?')[0];assert.equal(record.output.path,'public/'+relative);
  assert.ok(record.output.boundsAbove16[0]>0&&record.output.boundsAbove16[1]>0);assert.ok(record.output.boundsAbove16[2]<record.output.width&&record.output.boundsAbove16[3]<record.output.height);
  sources+=source.length;outputs+=output.length;count++;
 }
 assert.equal(count,12);assert.ok(outputs<sources*.1,'UI derivatives avoid shipping original-resolution PNGs');
});
test('combat code, timing, collisions, animation data and existing atlases remain byte-identical',()=>{
 const protectedFiles=require('../assets/source-art/phase1_5/protected-combat-sha256.json');
 assert.ok(Object.keys(protectedFiles).length>=15);
 for(const [file,hash] of Object.entries(protectedFiles))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);
});
