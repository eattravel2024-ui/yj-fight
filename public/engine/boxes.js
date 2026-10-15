/* 獨立 Hitbox/Hurtbox/Pushbox；單位為 960x540 戰鬥世界座標。 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiBoxes=api})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function hurtbox(p){const feet=p.y||0;return {x:p.x-29,y:feet+(p.crouch?10:13),w:58,h:p.crouch?75:154};}
function pushbox(p){return {x:p.x-29,y:p.y,w:58,h:65};}
function hitbox(p,d){if(!d)return null;const start=p.x+p.face*15,end=p.x+p.face*d.reach;const bottom=p.y+d.impactY-d.hitHeight;return {x:Math.min(start,end),y:bottom,w:Math.max(1,Math.abs(end-start)),h:d.hitHeight*2};}
function intersect(a,b){return !!(a&&b&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)}
function hits(p,foe,d){const forward=(foe.x-p.x)*p.face;return forward>8&&intersect(hitbox(p,d),hurtbox(foe));}
return {hurtbox,pushbox,hitbox,intersect,hits};
});
