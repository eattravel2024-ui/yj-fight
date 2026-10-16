/* Presentation and local encounter configuration. Simulation/world IDs remain stable. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiStages=api;})(globalThis,function(){
'use strict';
const WORLD=Object.freeze({width:960,height:540,groundY:448,yScale:.82,minX:48,maxX:912,spawns:Object.freeze([274,686]),camera:Object.freeze({center:480,zoom:1})});
const stage=(id,number,name,slug,theme,description,bgm,fallback)=>Object.freeze({id,number,name,theme,description,bgm,available:true,layers:1,geometry:WORLD,previewAsset:'art/stages/'+slug+'/preview.webp?v=8120',backgroundAsset:'art/stages/'+slug+'/background.webp?v=8103',combatAsset:'art/stages/'+slug+'/combat.webp?v=8112',fallbackAsset:fallback});
const STAGES=Object.freeze({
 night:stage('night',1,'嘴砲夜市','night-market','NEON / 街頭擂台','霓虹招牌與夜市街頭，今晚靠拳頭決勝負。','stage_night_market','art/night.svg'),
 garage:stage('garage',2,'金沙賭城','golden-casino','GOLD / 豪賭之夜','金色賭場與紫色燈海，每一拳都是一次下注。','stage_casino','art/garage.svg'),
 harbor:stage('harbor',3,'天安門廣場','tiananmen-square','SQUARE / 廣場對決','原始廣場建築、紅牆與坦克，保留場景原貌。','stage_square','art/port-arena.svg'),
 fur_lab:Object.freeze({id:'fur_lab',number:4,name:'絨毛禁區',theme:'FUR / 準備中',description:'正式場景美術尚未提供；配樂已備妥，暫不開放選擇。',bgm:'stage_fur_lab',available:false,layers:0,geometry:WORLD})
});
const IDS=Object.freeze(Object.keys(STAGES)),PLAYABLE=Object.freeze(IDS.filter(id=>STAGES[id].available));
function get(id){return typeof id==='string'&&Object.hasOwn(STAGES,id)?STAGES[id]:null;}
function playable(id){return !!get(id)?.available;}
return Object.freeze({STAGES,IDS,PLAYABLE,WORLD,get,playable});
});
