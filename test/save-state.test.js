'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Save=require('../public/save-state'),C=require('../public/core');
const options={chapterCount:5,characters:C.CHAR};

test('valid existing progress, currency, purchases and settings survive normalization',()=>{
 const old={chapter:3,clears:7,coins:740,bestCombo:12,character:'sezi',palette:'gold',purchased:['classic','violet','gold'],sound:false,vfx:'low',storyVersion:'five-fighters-1'};
 assert.deepEqual(Save.normalize(old,options),old);assert.deepEqual(Save.parse(JSON.stringify(old),options),old);
});

test('fractional and non-finite chapters recover before chapter-array lookup',()=>{
 for(const chapter of [1.5,NaN,Infinity,-Infinity,'2',null,{},[],Number.MAX_SAFE_INTEGER+1]){
  const save=Save.normalize({chapter,coins:740},options);
  assert.equal(save.chapter,0,String(chapter));assert.equal(save.coins,740);
 }
 assert.equal(Save.normalize({chapter:-2},options).chapter,0);
 assert.equal(Save.normalize({chapter:90},options).chapter,5);
 assert.equal(Save.normalize({chapter:5},options).chapter,5);
 assert.equal(Save.normalize({chapter:5},{...options,chapterCount:3}).chapter,3);
});

test('retired and inherited character keys cannot become a selected fighter',()=>{
 for(const character of ['sam','constructor','toString','__proto__','hasOwnProperty','unknown',null,3,{}]){
  const save=Save.normalize({character,chapter:3,coins:782,clears:4},options);
  assert.equal(save.character,'azhi');assert.equal(save.chapter,3);assert.equal(save.coins,782);assert.equal(save.clears,4);
 }
 for(const character of Object.keys(C.CHAR))assert.equal(Save.normalize({character},options).character,character);
});

test('malformed saves and JSON recover to a complete independent save object',()=>{
 const empty=Save.normalize(null,options);
 for(const value of [undefined,null,true,2,'text',[],['azhi']])assert.deepEqual(Save.normalize(value,options),empty);
 for(const text of [undefined,'{broken','null','[]','42','"text"'])assert.deepEqual(Save.parse(text,options),empty);
 const first=Save.normalize({},options),second=Save.normalize({},options);first.purchased.push('gold');
 assert.deepEqual(second.purchased,['classic']);
});

test('economic counters, visual settings and purchased palettes require valid types',()=>{
 for(const bad of [-1,1.5,Infinity,NaN,'740',true,{},Number.MAX_SAFE_INTEGER+1]){
  const save=Save.normalize({coins:bad,clears:bad,bestCombo:bad},options);
  assert.equal(save.coins,0);assert.equal(save.clears,0);assert.equal(save.bestCombo,0);
 }
 const save=Save.normalize({palette:'gold',purchased:['violet','violet','bogus',{}],sound:'false',vfx:'ultra',storyVersion:{}},options);
 assert.deepEqual(save.purchased,['classic','violet']);assert.equal(save.palette,'classic');assert.equal(save.sound,true);assert.equal(save.vfx,'cinema');assert.equal(save.storyVersion,'four-fighters-2');
 assert.equal(Save.normalize({palette:'violet',purchased:['violet'],sound:false,vfx:'standard'},options).palette,'violet');
});
