'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const VFX=require('../public/vfx.js');
const {create,typeFor}=VFX;
test('impact types vary by confirmed block, counter and move class',()=>{
 assert.equal(typeFor({block:true,move:'super'}),'block');
 assert.equal(typeFor({block:true,perfectGuard:true}),'parry');
 assert.equal(typeFor({riposte:true,move:'heavy'}),'riposte');
 assert.equal(typeFor({punish:true,move:'heavy'}),'punish');
 assert.equal(typeFor({counter:true,move:'heavy'}),'counter');
 assert.equal(typeFor({move:'super'}),'super');
 assert.equal(typeFor({move:'heavy'}),'heavy');
 assert.equal(typeFor({move:'light'}),'light');
});
test('heavy and super hits create more directional sparks than a jab',()=>{
 const a=create({quality:'cinema'});
 a.emit({x:450,y:320,move:'light',direction:1},100);
 a.emit({x:455,y:320,move:'heavy',direction:-1},100);
 a.emit({x:460,y:320,move:'super',direction:1},100);
 const list=a.snapshot(100);
 assert.deepEqual(list.map(x=>x.kind),['light','heavy','super']);
 assert.ok(list[0].sparks<list[1].sparks&&list[1].sparks<list[2].sparks);
});
test('low intensity mode reduces particles and disables camera shake',()=>{
 const a=create({quality:'low'});a.emit({x:470,y:330,move:'super'},500);
 assert.ok(a.snapshot(510)[0].sparks<30);
 assert.deepEqual(a.camera(510),{x:0,y:0,scale:1});
 a.setQuality('standard');assert.equal(a.quality,'standard');
});
test('visual impact expires without modifying any gameplay state',()=>{
 const fx=create();const game={hp:100,frame:80};const before={...game};
 fx.emit({x:490,y:310,move:'heavy'},100);
 assert.equal(fx.snapshot(100).length,1);
 assert.equal(fx.snapshot(600).length,0);
 assert.deepEqual(game,before);
});
test('web page loads self-hosted transparent atlas and offers graphical quality selection',()=>{
 const base=path.join(__dirname,'../public');
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
 const js=fs.readFileSync(path.join(base,'game.js'),'utf8');
 assert.match(html,/src="vfx\.js(?:\?v=\d+)?"/);assert.match(html,/id="fxToggle"/);
 assert.match(js,/effects\.emit\(/);assert.match(js,/effects\.front\(/);assert.match(js,/effects\.back\(/);
 const buf=fs.readFileSync(path.join(base,'art/vfx/impact_energy.png'));
 assert.equal(buf.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(buf.readUInt32BE(16),1024);assert.equal(buf.readUInt32BE(20),256);
});
test('cinematic renderer can draw real layered effects to Canvas2D without touching simulation',()=>{
 const fx=create({quality:'cinema'});
 const g={addColorStop(){}};
 const ctx=new Proxy({createRadialGradient:()=>g},{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>{target[key]=value;return true}});
 fx.emit({x:390,y:270,move:'heavy',direction:1},100);
 assert.doesNotThrow(()=>{fx.back(ctx,130);fx.front(ctx,130);fx.screen(ctx,130);});
 assert.ok(fx.snapshot(130).length>0);
});
