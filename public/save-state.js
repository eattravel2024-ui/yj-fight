/* Validate the existing browser save; do not invent missions or replace its economic data. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./campaign.js'):root.AzhiCampaign,typeof module==='object'&&module.exports?require('./stage-registry.js'):root.AzhiStages);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiSaveState=api;})(typeof globalThis==='object'?globalThis:this,function(Campaign,Stages){
'use strict';
const CHARACTERS=Object.freeze({winnie:true,sezi:true,gambler:true,azhi:true});
const PALETTES=Object.freeze(['classic','violet','gold']),VFX=Object.freeze(['cinema','standard','low']);
const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
function normalize(value,options={}){
 const input=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const chapterCount=Number.isSafeInteger(options.chapterCount)&&options.chapterCount>=0?options.chapterCount:5;
 const characters=options.characters&&typeof options.characters==='object'?options.characters:CHARACTERS;
 const purchased=['classic'];
 if(Array.isArray(input.purchased))for(const id of input.purchased)if(PALETTES.includes(id)&&!purchased.includes(id))purchased.push(id);
 const character=typeof input.character==='string'&&Object.hasOwn(characters,input.character)?input.character:'azhi';
 const palette=PALETTES.includes(input.palette)&&purchased.includes(input.palette)?input.palette:'classic';
 const result={
  chapter:Number.isSafeInteger(input.chapter)?Math.max(0,Math.min(chapterCount,input.chapter)):0,
  clears:count(input.clears),coins:count(input.coins),bestCombo:count(input.bestCombo),character,palette,purchased,
  sound:typeof input.sound==='boolean'?input.sound:true,
  vfx:VFX.includes(input.vfx)?input.vfx:'cinema',
  storyVersion:typeof input.storyVersion==='string'&&input.storyVersion.length?input.storyVersion:'four-fighters-2'
 };
 if(Stages?.playable(input.practiceStage))result.practiceStage=input.practiceStage;
 if(input.arcade&&Campaign)result.arcade=Campaign.normalizeProgress(input.arcade,result.chapter);
 return result;
}
function parse(text,options){try{return normalize(JSON.parse(text),options);}catch{return normalize(null,options);}}
return Object.freeze({normalize,parse});
});
