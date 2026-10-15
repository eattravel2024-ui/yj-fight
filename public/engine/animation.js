/* 60Hz 動畫播放資料：依有效幀分配各招式的 10-frame Spritesheet。 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiAnimation=api})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const ACTIONS=['idle','walk','jump','light','light2','light3','heavy','kick','low','upper','throw','dash','guard','hurt','special','ko','win'];
const WIDTH=240,HEIGHT=300,FRAMES=10;
function spriteFrame(p,action,clock,move){if(!move||!p.move){const speed=action==='idle'?5.2:action==='walk'?11:action==='guard'?3.4:8;return Math.floor(clock*speed)%FRAMES;}
 const n=p.move.frame||0,starting=move.startup??move.start??4;if(n<starting)return Math.min(2,Math.floor(n/Math.max(1,starting)*3));
 if(n<starting+move.active)return 3+Math.min(4,Math.floor((n-starting)/Math.max(1,move.active)*5));
 return 8+Math.min(1,Math.floor((n-starting-move.active)/Math.max(1,move.recovery)*2));}
return {ACTIONS,WIDTH,HEIGHT,FRAMES,spriteFrame};
});
