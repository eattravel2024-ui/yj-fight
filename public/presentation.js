/* Original cinematic presentation. State-derived entrances and visual-only adaptive camera. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./engine/frame-data.js'):root.AzhiFrames,typeof module==='object'&&module.exports?require('./skill-vfx.js'):root.AzhiSkillFX);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiPresentation=api})(typeof globalThis==='object'?globalThis:this,function(Frames,FX){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function intro(game){const duration=game?.introDuration,remaining=game?.introFrames;if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(remaining)||remaining<=0)return null;return {progress:clamp(1-remaining/duration,0,1),remaining,count:Math.ceil(remaining/30)};}
function skillPose(p,reducedMotion=false){
 const base={dx:0,dy:0,rotation:0,scale:1,alpha:1};
 if(p?.grappleRole&&!reducedMotion){const f=p.grappleFrame||0,face=p.face===-1?-1:1;if(p.grappleRole==='victim'){base.rotation=face*(f<8?0:Math.min(1.8,(f-8)*.15));}else{base.rotation=face*(p.grappleStyle==='casino_flip'?-.13:.08)*Math.sin(Math.min(1,f/30)*Math.PI);}return base;}
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
// Soft contact shadow follows x and jump height; never touches the collision model.
function drawContactShadow(ctx,p){
 const lift=clamp((p.y||0)/180,0,1),rx=34-13*lift;
 ctx.save();const shade=ctx.createRadialGradient(p.x,450,0,p.x,450,rx);
 shade.addColorStop(0,'rgba(0,4,12,'+(.45-.20*lift)+')');shade.addColorStop(1,'rgba(0,4,12,0)');
 ctx.fillStyle=shade;ctx.translate(p.x,450);ctx.scale(1,.27);ctx.translate(-p.x,-450);ctx.beginPath();ctx.arc(p.x,450,rx,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawEntrance(ctx,game,options={}){
 const entry=intro(game);if(!entry)return false;
 // Fighter arrival/skills keep their existing choreography. Compact state-derived
 // name ribbons leave the new in-scene health/timer and announcer unobstructed.
 const reduced=!!options.reducedMotion;
 ctx.save();ctx.globalAlpha=reduced?.9:clamp(entry.progress*5,0,1);ctx.textAlign='center';
 for(const p of game.players||[]){const data=Frames.CHAR[p.char];if(!data)continue;
  const x=clamp(p.x,125,835),y=game.ruleset==='team'?365+Math.floor(p.slot/2)*25:385;
  ctx.fillStyle='#06111cdd';ctx.fillRect(x-116,y,232,22);ctx.fillStyle=data.accent;ctx.fillRect(x-116,y,3,22);
  ctx.font='800 11px system-ui';ctx.fillStyle='#f5efe1';ctx.fillText(data.name+' / '+data.special,x,y+15,216);
 }
 ctx.restore();return true;
}
function drawCombatAccent(ctx,p,clock,reduced=false){
 const key=p.move?.name,ground=448-(p.y||0)*.82;if(!['rush','feint','finisher'].includes(key)&&!(p.techFlash>0))return;
 ctx.save();ctx.strokeStyle=p.techFlash>0?'#66ebff':p.char==='gambler'?'#ffc247':'#57f2a5';ctx.globalAlpha=reduced?.45:.75;ctx.lineWidth=3;
 if(p.techFlash>0){ctx.beginPath();ctx.arc(p.x,ground-90,42,0,Math.PI*2);ctx.stroke();}
 else if(key==='feint'){ctx.setLineDash([5,8]);ctx.beginPath();ctx.arc(p.x,ground-92,40,-2.8,-.3);ctx.stroke();}
 else{for(let i=0;i<3;i++){const y=ground-55-i*28;ctx.beginPath();ctx.moveTo(p.x-p.face*(60+i*8),y);ctx.lineTo(p.x-p.face*(18+i*3),y-4);ctx.stroke();}if(key==='finisher'){ctx.beginPath();ctx.arc(p.x+p.face*64,ground-100,38,-1.2,1.2);ctx.stroke();}}
 ctx.restore();
}
function drawChip(ctx,shot,clock){if(shot.kind!=='chip')return false;const x=shot.x,y=448-shot.y*.82;ctx.save();ctx.translate(x,y);ctx.rotate(clock*8);ctx.fillStyle='#4b235d';ctx.strokeStyle='#ffc247';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#fff4cf';ctx.lineWidth=2;ctx.setLineDash([3,5]);ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffc247';ctx.fillRect(-3,-5,6,10);ctx.restore();return true;}
return {intro,fighterPose,skillPose,createCamera,drawEntrance,drawContactShadow,drawCombatAccent,drawChip,FIGHTER_SCALE,SPRITE_BASELINE};
});
