/* One ordered mission registry; pure progress migration and encounter validation. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./stage-registry.js'):root.AzhiStages);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiCampaign=api;})(globalThis,function(Stages){
'use strict';
const mission=(id,title,short,detail,story,enemy,stage,difficulty,reward)=>Object.freeze({id,title,short,detail,story,enemy,stage,difficulty,reward});
const MISSIONS=Object.freeze([
 mission('street-trial','第一關 · 街頭試煉','街頭試煉','在嘴砲夜市挑戰阿志，熟悉走位、防禦與一鍵必殺。','「領薪水之前，先把這場打漂亮！」—— 阿志','azhi','night',1,120),
 mission('honey-ruler','第二關 · 蜜糖霸主','蜜糖霸主','金沙賭城迎戰維尼，利用下段攻擊或摔技突破防守。','「正面硬拼可不見得划算。」—— 維尼','winnie','garage',2,160),
 mission('white-vortex','第三關 · 白毛旋風','白毛旋風','在天安門廣場迎戰塞子，提防快速踢擊與低段進攻。','「旋風登場！跟得上我的腳步再說！」—— 塞子','sezi','harbor',2,200),
 mission('golden-duel','第四關 · 金沙決勝','金沙決勝','回到嘴砲夜市，利用出招距離破解金沙賭神的壓制。','「每一次出拳都像下注，出手前要懂得算距離。」—— 金沙賭神','gambler','night',3,260),
 mission('azhi-finale','最終關 · 阿志逆轉','阿志逆轉','天安門廣場的最後對決，打贏阿志，拿下街機冠軍。','「欠打？那就上擂台，看看誰最後還站得住！」—— 阿志','azhi','harbor',3,350)
]);
const IDS=Object.freeze(MISSIONS.map(m=>m.id));
function indexOf(id){return typeof id==='string'?IDS.indexOf(id):-1;}
function get(id){const i=indexOf(id);return i>=0?MISSIONS[i]:null;}
function normalizeProgress(value,legacyChapter=0){
 const old=Number.isSafeInteger(legacyChapter)?Math.max(0,Math.min(MISSIONS.length,legacyChapter)):0;
 const completed=new Set(IDS.slice(0,old));
 if(value?.version===1&&Array.isArray(value.completed))for(const id of value.completed)if(IDS.includes(id))completed.add(id);
 let count=0;while(count<IDS.length&&completed.has(IDS[count]))count++;
 // Only a contiguous, validated prefix unlocks future missions.
 return {version:1,completed:IDS.slice(0,count)};
}
function unlocked(progress){return Math.min(normalizeProgress(progress).completed.length,MISSIONS.length-1);}
function canPlay(id,progress){const i=indexOf(id);return i>=0&&i<=unlocked(progress);}
function complete(progress,id){const p=normalizeProgress(progress);if(!canPlay(id,p))return p;return normalizeProgress({version:1,completed:[...p.completed,id]});}
function plan({mode='arcade',character='azhi',missionId,stageId,progress}={}){
 if(!['arcade','practice'].includes(mode)||!['azhi','winnie','sezi','gambler'].includes(character))return null;
 if(mode==='practice'){if(!Stages.playable(stageId))return null;return Object.freeze({mode,character,enemy:'winnie',stage:stageId,difficulty:0,missionId:null});}
 const m=get(missionId);if(!m||!canPlay(m.id,progress)||!Stages.playable(m.stage))return null;
 return Object.freeze({mode,character,enemy:m.enemy,stage:m.stage,difficulty:m.difficulty,missionId:m.id});
}
return Object.freeze({MISSIONS,IDS,get,indexOf,normalizeProgress,unlocked,canPlay,complete,plan});
});
