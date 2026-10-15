/* Original vector skill choreography. Never imported by the combat simulation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiSkillFX=api})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const TAU=Math.PI*2;
const STYLES=Object.freeze({
 winnie:Object.freeze({style:'shockwave',color:'#ffc44e',light:'#fff1b0',count:18}),
 sezi:Object.freeze({style:'spin',color:'#ffd15b',light:'#fff3b2',count:16}),
 gambler:Object.freeze({style:'cards',color:'#69dce9',light:'#fff0c7',count:13}),
 azhi:Object.freeze({style:'counter',color:'#eabb63',light:'#fff3c6',count:12})
});
const cap=(n,min,max)=>Math.max(min,Math.min(max,n));
function clock(){return typeof performance==='object'?performance.now():Date.now();}
function polygon(ctx,sides,r,offset=0){ctx.beginPath();for(let i=0;i<sides;i++){const a=offset+i*TAU/sides,x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}
function arc(ctx,x,y,r,start,end,width,color){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,start,end);ctx.stroke();}
function ghost(ctx,x,y,size){
 ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.lineWidth=7;ctx.lineCap='round';
 ctx.beginPath();ctx.arc(0,-25,8,0,TAU);ctx.fill();
 ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(-3,13);ctx.moveTo(-1,-7);ctx.lineTo(-20,1);ctx.moveTo(-1,-7);ctx.lineTo(18,-20);ctx.moveTo(-3,13);ctx.lineTo(-20,30);ctx.moveTo(-3,13);ctx.lineTo(19,23);ctx.stroke();ctx.restore();
}
function card(ctx,x,y,rotation,size,index,palette){
 ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(size,size);
 ctx.fillStyle='#171a2f';ctx.strokeStyle=palette.light;ctx.lineWidth=1.6;
 ctx.fillRect(-12,-18,24,36);ctx.strokeRect(-12,-18,24,36);
 ctx.fillStyle=index%2?palette.color:'#ffd5df';
 polygon(ctx,4,7,0);ctx.fill();
 ctx.fillRect(-8,-13,3,4);ctx.fillRect(5,9,3,4);ctx.restore();
}
function palm(ctx,size){
 ctx.save();ctx.scale(size,size);ctx.fillRect(-14,-5,28,29);
 for(let i=0;i<4;i++)ctx.fillRect(-14+i*8,-32-(i===1||i===2?5:0),6,34);
 ctx.save();ctx.rotate(-.75);ctx.fillRect(-25,-1,7,24);ctx.restore();
 ctx.strokeRect(-12,-3,24,25);ctx.restore();
}
function honey(ctx,b,t){
 const p=b.palette,r=32+t*102;ctx.fillStyle=p.light;ctx.strokeStyle=p.color;ctx.lineWidth=2;
 for(let i=0;i<Math.min(6,b.count);i++){
  const angle=(i/5-.5)*1.6,x=30+Math.cos(angle)*r,y=Math.sin(angle)*r;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle*.3);ctx.globalAlpha*=.35+(i%2)*.3;palm(ctx,.45+(i%3)*.12);ctx.restore();
 }
 ctx.save();ctx.translate(40+t*75,-8);palm(ctx,1.2);ctx.restore();
 arc(ctx,20,8,r,-1.5,1.5,4,p.color);
 ctx.font='900 15px system-ui';ctx.fillStyle=p.color;ctx.fillText('舉手！',10,73);
}
function spin(ctx,b,t){
 const p=b.palette,r=45+t*80,turn=t*TAU;ctx.fillStyle=p.color;ctx.strokeStyle=p.light;ctx.lineWidth=2;
 for(let i=0;i<b.count;i++){
  const angle=turn+i*TAU/b.count;ctx.save();ctx.translate(Math.cos(angle)*r,Math.sin(angle)*r*.65);ctx.rotate(angle);
  ctx.fillStyle=i%2?'#ffd26e':p.color;ctx.beginPath();ctx.ellipse(0,0,7,11,0,0,TAU);ctx.fill();ctx.stroke();ctx.restore();
 }
 for(let i=0;i<5;i++){ctx.fillStyle=i%2?'#edc577aa':'#f8e5b2aa';ctx.fillRect(-40+i*18,-20-i%3*17,12,50+i%3*17);}
 arc(ctx,0,0,r,-turn,Math.PI*1.4-turn,4,p.light);ctx.font='900 17px system-ui';ctx.fillStyle=p.light;ctx.fillText('發大財',-27,65);
}
function cards(ctx,b,t){
 const p=b.palette;ctx.strokeStyle=p.light;ctx.fillStyle=p.color;ctx.lineWidth=3;
 for(let i=0;i<Math.min(b.count,9);i++){const angle=(i/8-.5)*1.6,dist=35+t*120;card(ctx,25+Math.cos(angle)*dist,Math.sin(angle)*dist*.6,angle,.65,i,p);}
 ctx.save();ctx.translate(28,-10);ctx.fillStyle='#132638';ctx.fillRect(-24,-38,49,70);ctx.strokeRect(-24,-38,49,70);
 ctx.fillStyle=p.light;ctx.fillRect(-16,-29,31,16);ctx.fillStyle='#15202b';ctx.font='900 12px system-ui';ctx.fillText('300',-13,-17);
 ctx.strokeStyle=p.color;ctx.beginPath();ctx.moveTo(25,-24);ctx.lineTo(39,-10);ctx.lineTo(39,25);ctx.quadraticCurveTo(39,39,28,29);ctx.stroke();ctx.restore();
 for(let i=0;i<6;i++){ctx.strokeStyle=i%2?'#ffc078':p.light;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-55-i*8,25-i*9);ctx.lineTo(5+t*30,16-i*7);ctx.stroke();}
}
function counter(ctx,b,t){
 const p=b.palette,r=45+90*t;
 for(let i=0;i<6;i++){arc(ctx,2,8,r+i*7,-1.2+i*.09,.9+t*.6,9-i,'#10151f');arc(ctx,2,8,r+i*7+5,-1.2+i*.09,.9+t*.6,2,p.color);}
 ctx.save();ctx.translate(38+t*55,-8);ctx.rotate(-.15+t*.2);ctx.fillStyle='#111927';ctx.strokeStyle=p.light;ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(-24,-9);ctx.lineTo(-9,-24);ctx.lineTo(23,-18);ctx.lineTo(30,2);ctx.lineTo(14,20);ctx.lineTo(-16,15);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 for(let i=0;i<4;i++){ctx.save();ctx.translate(-28+i*25,35-Math.sin(t*Math.PI+i)*20);ctx.rotate(t+i);ctx.fillStyle=p.color;ctx.fillRect(-9,-9,18,18);ctx.fillStyle='#13202a';ctx.fillRect(-5,-5,3,3);ctx.fillRect(2,2,3,3);ctx.restore();}
 ctx.fillStyle=p.light;ctx.font='900 16px system-ui';ctx.fillText('膽量全押',-15,75);
}
const DRAWERS={shockwave:honey,spin,cards,counter};
function create(options={}){
 let quality=options.quality==='low'?'low':'high';
 let reducedMotion=options.reducedMotion===true;
 let bursts=[];
 const limits=()=>quality==='low'?{bursts:6,particles:48}:{bursts:12,particles:160};
 function trim(){const budget=limits();let count=bursts.reduce((n,b)=>n+b.count,0);while(bursts.length>budget.bursts||count>budget.particles){count-=bursts.shift().count;}}
 function prune(now){bursts=bursts.filter(b=>now-b.at<b.life);}
 function emit(event,at=clock()){
  if(!event||event.kind!=='skill'||!Object.hasOwn(STYLES,event.char)||!['special','super'].includes(event.move)||!Number.isFinite(event.x)||!Number.isFinite(event.y)||!Number.isFinite(at))return false;
  prune(at);
  const palette=STYLES[event.char];
  bursts.push({char:event.char,style:palette.style,palette,x:cap(event.x,-1000,2000),y:cap(event.y,-1000,2000),direction:event.direction===-1||event.face===-1?-1:event.direction===1||event.face===1?1:(event.slot%2===1?-1:1),at,super:event.move==='super',life:event.move==='super'?1250:900,count:quality==='low'?Math.ceil(palette.count*.32):palette.count});
  trim();return true;
 }
 function draw(ctx,now=clock(),view={}){
  if(!ctx||!Number.isFinite(now))return;
  prune(now);
  const ground=Number.isFinite(view.groundY)?view.groundY:448,yScale=Number.isFinite(view.yScale)?view.yScale:.82,xScale=Number.isFinite(view.scaleX)?view.scaleX:1;
  for(const b of bursts){
   if(now<b.at)continue;
   const progress=cap((now-b.at)/b.life,0,1),t=reducedMotion?.48:1-Math.pow(1-progress,2),fade=reducedMotion?(1-progress)*.65:Math.min(1,progress*8+.1)*Math.pow(1-progress,1.3);
   const point=typeof view.project==='function'?view.project(b.x,b.y):{x:b.x*xScale,y:ground-b.y*yScale};
   if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))continue;
   ctx.save();ctx.translate(point.x,point.y-110);ctx.scale(b.direction,1);ctx.globalAlpha=fade;ctx.lineCap='round';
   DRAWERS[b.style](ctx,b,t);
   if(b.super){ctx.save();ctx.globalAlpha*=.5;ctx.scale(1,.6);arc(ctx,0,0,112+t*35,0,TAU,2,b.palette.light);ctx.restore();}
   ctx.restore();
  }
 }
 function snapshot(now=clock()){prune(now);return bursts.map(b=>({char:b.char,style:b.style,x:b.x,y:b.y,direction:b.direction,at:b.at,life:b.life,particles:b.count,super:b.super}));}
 function stats(now=clock()){prune(now);return {bursts:bursts.length,particles:bursts.reduce((n,b)=>n+b.count,0),budget:limits(),quality,reducedMotion};}
 return {emit,draw,snapshot,stats,clear:()=>{bursts=[];},setQuality:value=>{quality=value==='low'?'low':'high';trim();return quality;},setReducedMotion:value=>{reducedMotion=!!value;}};
}
function drawEmblem(ctx,char,progress,superMove=false){
 if(!Object.hasOwn(STYLES,char))return false;
 const palette=STYLES[char];DRAWERS[palette.style](ctx,{palette,count:palette.count,super:superMove},cap(progress,0,1));return true;
}
return {create,STYLES,drawEmblem};
});
