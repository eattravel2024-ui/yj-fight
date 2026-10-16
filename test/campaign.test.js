'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=require('../public/stage-registry'),M=require('../public/campaign'),C=require('../public/core'),Save=require('../public/save-state');
test('only supplied stage art is playable; legislature is STAGE 04 and fur lab remains planned',()=>{
 assert.deepEqual(S.PLAYABLE,['night','garage','harbor',...(require('../public/stage-assets').legislature.ready?['legislature']:[])]);const music=require('../public/audio/manifest.json');
 for(const id of S.PLAYABLE){const s=S.get(id);for(const key of ['previewAsset','backgroundAsset','combatAsset'])assert.ok(fs.existsSync(path.join(__dirname,'../public',s[key].split('?')[0])));assert.ok(music.tracks.some(t=>t.id===s.bgm));assert.equal(s.layers,1);assert.deepEqual(s.geometry.spawns,C.create().players.map(p=>p.x));assert.equal(s.geometry.groundY,448);assert.equal(s.geometry.width/s.geometry.height,16/9);assert.ok(Object.isFrozen(s));}
 assert.match(S.get('harbor').backgroundAsset,/tiananmen-square/);assert.equal(S.get('legislature').number,4);assert.equal(S.get('fur_lab').available,false);assert.equal(S.get('fur_lab').previewAsset,undefined);for(const bad of ['__proto__','constructor',{},null])assert.equal(S.get(bad),null);
});
test('one five-mission registry uses existing fighters, fair increasing difficulty and real stages',()=>{
 assert.equal(M.MISSIONS.length,5);let difficulty=0;for(const m of M.MISSIONS){assert.ok(Object.hasOwn(C.CHAR,m.enemy));assert.ok(S.playable(m.stage));assert.ok(m.difficulty>=difficulty&&m.difficulty<=3);difficulty=m.difficulty;assert.ok(Number.isSafeInteger(m.reward)&&m.reward>0);assert.ok(Object.isFrozen(m));}
});
test('legacy progress migrates to stable mission IDs without losing coins, purchases or clears',()=>{
 for(let chapter=0;chapter<=5;chapter++){const old={chapter,coins:740,clears:7,character:'sezi',purchased:['classic','gold'],palette:'gold'},save=Save.normalize(old);save.arcade=M.normalizeProgress(save.arcade,save.chapter);const reloaded=Save.parse(JSON.stringify(save));assert.equal(reloaded.coins,740);assert.equal(reloaded.clears,7);assert.deepEqual(reloaded.purchased,['classic','gold']);assert.equal(reloaded.palette,'gold');assert.deepEqual(reloaded.arcade.completed,M.IDS.slice(0,chapter));}
});
test('locked/invalid missions never unlock from sparse data, and replay retains highest progress',()=>{
 assert.deepEqual(M.normalizeProgress({version:1,completed:[M.IDS[4],'__proto__']}),{version:1,completed:[]});let p=M.normalizeProgress(null,3);assert.equal(M.canPlay(M.IDS[4],p),false);assert.deepEqual(M.complete(p,M.IDS[4]),p);assert.deepEqual(M.complete(p,M.IDS[0]),p);p=M.complete(p,M.IDS[3]);assert.equal(p.completed.length,4);p=M.complete(p,M.IDS[4]);assert.equal(p.completed.length,5);assert.equal(M.unlocked(p),4);
});
test('encounter plans validate actual stage/CPU and cannot substitute a different arcade opponent',()=>{
 for(const char of Object.keys(C.CHAR))for(const stage of S.PLAYABLE){const p=M.plan({mode:'practice',character:char,stageId:stage});assert.equal(p.character,char);assert.equal(p.stage,stage);assert.equal(p.enemy,'winnie');assert.equal(p.difficulty,0);}
 for(const stage of ['fur_lab','constructor',null])assert.equal(M.plan({mode:'practice',stageId:stage}),null);
 const p=M.plan({missionId:M.IDS[0],progress:M.normalizeProgress(null)});assert.equal(p.enemy,M.MISSIONS[0].enemy);assert.equal(p.stage,M.MISSIONS[0].stage);assert.ok(Object.isFrozen(p));assert.equal(M.plan({missionId:M.IDS[2],progress:{version:1,completed:[]}}),null);assert.equal(M.plan({mode:'online',missionId:M.IDS[0]}),null);
});
test('practice stage preference is validated while original save shape remains compatible',()=>{
 for(const stage of S.PLAYABLE)assert.equal(Save.normalize({practiceStage:stage}).practiceStage,stage);for(const stage of ['fur_lab','__proto__',{},null])assert.equal(Object.hasOwn(Save.normalize({practiceStage:stage}),'practiceStage'),false);
});
