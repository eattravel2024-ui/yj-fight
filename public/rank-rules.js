/* Shared presentation thresholds. Only the server awards RP or changes ratings. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AzhiRankRules=api;})(globalThis,function(){
'use strict';
const TIERS=Object.freeze([
 Object.freeze({id:'bronze',name:'青銅',min:0}),
 Object.freeze({id:'silver',name:'白銀',min:900}),
 Object.freeze({id:'platinum',name:'白金',min:1800}),
 Object.freeze({id:'diamond',name:'鑽石',min:2700}),
 Object.freeze({id:'elite',name:'菁英',min:3600})
]);
const CONFIG=Object.freeze({placements:5,divisionSize:300,tiers:TIERS});
function rankFor(value,placementGames=5){
 if(!Number.isFinite(value)||value<0||placementGames<CONFIG.placements)return null;
 const rp=Math.floor(value);let index=0;for(let i=1;i<TIERS.length;i++)if(rp>=TIERS[i].min)index=i;
 const tier=TIERS[index],elite=index===TIERS.length-1,divisionIndex=elite?0:Math.min(2,Math.floor((rp-tier.min)/CONFIG.divisionSize));
 const division=elite?null:['III','II','I'][divisionIndex],minRp=elite?tier.min:tier.min+divisionIndex*CONFIG.divisionSize,nextRp=elite?null:minRp+CONFIG.divisionSize;
 return Object.freeze({id:tier.id,name:tier.name,division,label:tier.name+(division?' '+division:''),minRp,maxRp:nextRp===null?null:nextRp-1,nextRp,progress:nextRp===null?1:Math.max(0,Math.min(1,(rp-minRp)/(nextRp-minRp)))});
}
return Object.freeze({CONFIG,TIERS,rankFor});
});
