/* 60Hz 指令辨識：朝向相對，支援斜向、容錯與連續按鍵（不依賴鍵盤語系）。 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiCommands=api})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function direction(keys,face){const horiz=(Number(!!keys.right)-Number(!!keys.left))*(face||1);const vertical=Number(!!keys.up)-Number(!!keys.down);return horiz===0?(vertical<0?2:vertical>0?8:5):horiz>0?(vertical<0?3:vertical>0?9:6):(vertical<0?1:vertical>0?7:4)}
function record(p,keys,tick){p.motion=p.motion||[];const next=direction(keys,p.face);if(p.motion.length===0||p.motion.at(-1).dir!==next)p.motion.push({dir:next,tick});p.motion=p.motion.filter(x=>tick-x.tick<=32).slice(-24);return next;}
function match(p,pattern,tick,window=22){let cursor=(p.motion||[]).length-1;let lastTick=tick;for(let i=pattern.length-1;i>=0;i--){let found=false;while(cursor>=0){const entry=p.motion[cursor--];if(lastTick-entry.tick>window)break;if(entry.dir===pattern[i]){lastTick=entry.tick;found=true;break;}}if(!found)return false;}return true;}
function command(p,key,tick){
 if(key==='light'&&match(p,[2,3,6],tick,24))return 'special';
 if(key==='heavy'&&match(p,[6,2,3],tick,24))return 'upper';
 return key;
}
return {direction,record,match,command};
});
