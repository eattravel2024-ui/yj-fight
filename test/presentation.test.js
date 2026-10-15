'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../public/presentation'),C=require('../public/core');
function ctx(){return new Proxy({},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>{o[k]=v;return true}});}
test('entrances have four distinct poses, derive only from authoritative countdown, and never mutate fighters',()=>{
 const game={introDuration:90,introFrames:60,players:Object.keys(C.CHAR).map((char,slot)=>({slot,char,x:200+slot*150,y:0}))};
 const before=JSON.stringify(game),poses=game.players.map(p=>P.fighterPose(game,p));
 assert.equal(new Set(poses.map(p=>JSON.stringify(p))).size,4);
 for(let i=0;i<4;i++)assert.deepEqual(P.fighterPose(game,game.players[i],true),{dx:0,dy:0,rotation:0,scale:1,alpha:1});
 assert.equal(P.drawEntrance(ctx(),game),true);assert.equal(JSON.stringify(game),before);
 game.introFrames=0;assert.equal(P.drawEntrance(ctx(),game),false);
});
test('view remains full-stage through entrances, close combat, corners and reduced motion',()=>{
 const camera=P.createCamera();
 for(const locked of [true,false])for(const players of [[{x:400},{x:550}],[{x:48},{x:912}],[{x:48},{x:100}],[]]){
  for(let frame=0;frame<120;frame++)assert.deepEqual(camera.update(players,1/60,locked),{center:480,zoom:1});
 }
 camera.reset();assert.deepEqual(camera.update([{x:500}]),{center:480,zoom:1});
});
test('intro options are bounded and per-round reset keeps a synchronized entrance',()=>{
 for(const bad of [-8,Infinity,NaN,'90',{},2.5])assert.equal(C.introLength(bad),0);
 assert.equal(C.introLength(999),180);const m=C.create('azhi','winnie',{introFrames:30});
 m.introFrames=0;C.reset(m);assert.equal(m.introFrames,30);
});

test('each skill also has unique frame-driven body choreography with reduced-motion fallback',()=>{
 const moves=Object.keys(C.CHAR).map(char=>({char,face:1,move:{name:'special',frame:15}}));
 assert.equal(new Set(moves.map(p=>JSON.stringify(P.skillPose(p)))).size,4);
 for(const p of moves){assert.deepEqual(P.fighterPose(null,p),P.skillPose(p));assert.deepEqual(P.skillPose(p,true),{dx:0,dy:0,rotation:0,scale:1,alpha:1});}
});
