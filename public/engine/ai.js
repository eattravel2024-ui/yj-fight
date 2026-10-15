/* 角色差異化 CPU：分離行為選擇與戰鬥結果；僅用傳入的 seeded RNG，確保可重現。 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiAI=api})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function decide(p,foe,rand,skill=1){
 const keys={},style=({winnie:'guard',sezi:'rush',gambler:'zoner',azhi:'balanced'})[p.char]||'balanced';
 const distance=Math.abs(p.x-foe.x),toward=foe.x<p.x?'left':'right',away=toward==='left'?'right':'left';
 const attack=foe.move?.name,active=attack&&foe.move.frame>=2&&foe.move.frame<=16;
 const aggression=skill>=3?1.3:skill>=2?1:0.72;
 const zoner=style==='zoner',defender=style==='guard'||style==='counter';
 const range=zoner?230:style==='rush'?84:style==='counter'?101:110;
 if(distance>range+8)keys[toward]=true;
 if(distance<range-20&&(zoner||style==='counter'))keys[away]=true;
 if(foe.y>25&&distance<124&&rand()<.065*aggression)keys.upper=true;
 // Guard is intentional: opponent has started an attack and the CPU is within reach.
 if(distance<156&&active&&rand()<(defender?.70:.40)*aggression){keys.guard=true;delete keys[toward];delete keys[away];return keys;}
 // Roll for a possible action once every few frames in caller to avoid move spam.
 const r=rand();if(p.meter>=25&&distance<(zoner?310:style==='guard'?330:style==='rush'?190:210)&&r<(zoner?.12:style==='guard'?.09:.067)*aggression)keys.special=true;
 else if(distance<80&&r<.065*aggression)keys.throw=true;
 else if(distance<range+30&&r<(style==='rush'?.22:.16)*aggression){keys[r<.04?'low':r<.095?'kick':r<.15?'light':'heavy']=true;}
 else if(distance>155&&r<.045*aggression)keys.dash=true;
 if(style==='rush'&&distance<220&&rand()<.015*aggression)keys.up=true;
 return keys;
}
return {decide};
});
