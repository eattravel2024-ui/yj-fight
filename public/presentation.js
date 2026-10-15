/* Original cinematic presentation. State-derived entrances and visual-only adaptive camera. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./engine/frame-data.js'):root.AzhiFrames,typeof module==='object'&&module.exports?require('./skill-vfx.js'):root.AzhiSkillFX);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiPresentation=api})(typeof globalThis==='object'?globalThis:this,function(Frames,FX){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function intro(game){const duration=game?.introDuration,remaining=game?.introFrames;if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(remaining)||remaining<=0)return null;return {progress:clamp(1-remaining/duration,0,1),remaining,count:Math.ceil(remaining/30)};}
function skillPose(p,reducedMotion=false){
 const base={dx:0,dy:0,rotation:0,scale:1,alpha:1};
 if(reducedMotion||!['special','super'].includes(p?.move?.name)||!Object.hasOwn(Frames.CHAR,p.char))return base;
 const data=Frames.CHAR[p.char].moves?.special||{},duration=(data.startup||14)+(data.active||13)+(data.recovery||31);
 const t=clamp(p.move.frame/duration,0,1),pulse=Math.sin(t*Math.PI),face=p.face===-1?-1:1;
 if(p.char==='winnie'){base.rotation=-face*.12*pulse;base.dy=-8*pulse;base.scale=1+.035*pulse;}
 if(p.char==='sezi'){base.rotation=face*.2*Math.sin(t*Math.PI*4);base.dy=-12*pulse;}
 if(Frames.CHAR[p.char]?.entrance.pose==='fuel'){base.dx=-face*10*pulse;base.rotation=face*.055*pulse;}
 if(Frames.CHAR[p.char]?.entrance.pose==='courage'){base.dx=face*9*pulse;base.scale=1+.06*pulse;base.dy=3*pulse;}
 return base;
}
function fighterPose(game,p,reducedMotion=false){
 const entry=intro(game);if(!entry||reducedMotion)return skillPose(p,reducedMotion);
 const t=entry.progress,arrival=1-Math.pow(1-clamp(t/.55,0,1),3),side=(p.team??p.slot%2)?1:-1;
 const base={dx:side*210*(1-arrival),dy:0,rotation:0,scale:.84+.16*arrival,alpha:.2+.8*arrival};
 const flourish=Math.sin(Math.PI*clamp((t-.2)/.65,0,1));
 if(p.char==='winnie'){base.dy=-16*flourish;base.rotation=-side*.055*flourish;}
 if(p.char==='sezi'){base.rotation=side*Math.PI*2*(1-arrival);base.dy=-42*Math.sin(Math.PI*arrival);}
 if(Frames.CHAR[p.char]?.entrance.pose==='fuel'){base.dx+=side*16*flourish;base.dy=-9*Math.abs(Math.sin(t*Math.PI*4))*(1-t);}
 if(Frames.CHAR[p.char]?.entrance.pose==='courage'){base.scale+=.06*flourish;base.rotation=side*.09*flourish;}
 return base;
}
// Keep the complete arena visible before, during and after every fight.
// Character movement and hit feedback must never change the viewing distance.
const FIGHTER_SCALE=.76,SPRITE_BASELINE=292;
function createCamera(){
 return {update(){return {center:480,zoom:1};},apply(){},reset(){}};
}
function drawEntrance(ctx,game,options={}){
 const entry=intro(game);if(!entry)return false;
 const players=game.players||[],reduced=!!options.reducedMotion,t=reduced?.6:entry.progress;
 ctx.save();ctx.fillStyle='#060b13dc';ctx.fillRect(0,0,960,75);ctx.fillRect(0,475,960,65);
 ctx.fillStyle='#e5bc75';ctx.font='700 12px system-ui';ctx.textAlign='left';ctx.fillText('街頭狠話 / CHARACTER INTRO',26,28);
 ctx.fillStyle='#f5efe3';ctx.font='900 24px system-ui';ctx.fillText('狠話擂台',26,58);
 ctx.textAlign='right';ctx.fillStyle='#f4cc79';ctx.font='900 42px system-ui';ctx.fillText(String(entry.count).padStart(2,'0'),930,55);
 for(const p of players){const data=Frames.CHAR[p.char];if(!data)continue;const side=p.slot%2,row=Math.floor(p.slot/2),x=26+side*477,y=95+row*83;
  ctx.save();ctx.translate(x,y);ctx.globalAlpha=reduced?.9:Math.min(1,entry.progress*6+.2);ctx.fillStyle='#0a1425dd';ctx.fillRect(0,0,431,68);
  ctx.fillStyle=data.accent;ctx.fillRect(side?427:0,0,4,68);ctx.textAlign='left';ctx.font='800 12px system-ui';ctx.fillText(data.name+' / '+data.entrance.title,16,20,398);
  ctx.fillStyle='#fff4dc';ctx.font='900 20px system-ui';ctx.fillText(data.special,16,46,398);ctx.restore();
  ctx.save();ctx.translate(p.x,355-p.y*.82);ctx.scale(.65,.65);ctx.globalAlpha=.65;FX.drawEmblem(ctx,p.char,t,true);ctx.restore();
 }
 ctx.textAlign='center';ctx.font='700 16px system-ui';ctx.fillStyle='#e2dbc7';
 const who=players[Math.min(players.length-1,Math.floor(entry.progress*players.length))];ctx.fillText(Frames.CHAR[who?.char]?.entrance.line||'全員就位，倒數後開戰。',480,511,880);
 ctx.restore();return true;
}
return {intro,fighterPose,skillPose,createCamera,drawEntrance,FIGHTER_SCALE,SPRITE_BASELINE};
});
