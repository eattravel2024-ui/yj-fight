/* Original vector skill choreography. Never imported by the combat simulation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiSkillFX=api})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const TAU=Math.PI*2;
const STYLES=Object.freeze({
 winnie:Object.freeze({style:'shockwave',color:'#ffc44e',light:'#fff1b0',count:18}),
 sezi:Object.freeze({style:'spin',color:'#78e7f2',light:'#f4fcff',count:16}),
 gambler:Object.freeze({style:'cards',color:'#b795ff',light:'#f9e5ff',count:13}),
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
function honey(ctx,b,t){
 const p=b.palette,r=24+114*t,m=b.super?1.35:1;
 ctx.strokeStyle=p.color;ctx.lineWidth=3;ctx.fillStyle=p.light;
 // An open honeycomb front grows forward from the caster, with honey droplets.
 for(let i=0;i<b.count;i++){
  const a=(i/b.count-.5)*Math.PI*1.7,x=24+Math.cos(a)*r*m,y=Math.sin(a)*r*.67;
  ctx.save();ctx.translate(x,y);polygon(ctx,6,(7+(i%3)*3)*(1-t*.35),Math.PI/6);ctx.globalAlpha*=i%3===0?.9:.5;ctx.stroke();if(i%5===0){ctx.globalAlpha*=.25;ctx.fill();}ctx.restore();
 }
 ctx.save();ctx.translate(18+r*.5,63);ctx.scale(1,.22);arc(ctx,0,0,r*.88,Math.PI*.7,Math.PI*2.3,5*(1-t)+1,p.light);ctx.restore();
 arc(ctx,10,0,r*.76,-1.25,1.25,3,p.light);
}
function spin(ctx,b,t){
 const p=b.palette,r=43+t*64,turn=t*TAU*1.6;
 ctx.fillStyle=p.color;ctx.strokeStyle=p.color;
 for(let i=0;i<Math.min(b.count,6);i++){
  const a=turn-i*.65;ctx.save();ctx.globalAlpha*=.12+(i/6)*.28;
  ghost(ctx,Math.cos(a)*r,Math.sin(a)*r*.4,.7+i*.055);ctx.restore();
 }
 for(let i=0;i<b.count;i++){
  const a=turn+i*TAU/b.count,rad=r*(.45+(i%3)*.3);
  arc(ctx,0,0,rad,a,a+.55,1+(i%3),i%3?p.color:p.light);
 }
}
function cards(ctx,b,t){
 const p=b.palette,n=b.count,spread=.4+t*1.15;
 for(let i=0;i<n;i++){
  const fraction=n===1?.5:i/(n-1),angle=(fraction-.5)*spread*Math.PI;
  const x=35+Math.cos(angle)*(28+95*t),y=Math.sin(angle)*(25+90*t);
  card(ctx,x,y,angle+t*TAU*(i%2?1:-1)*.22,.55+(i%3)*.13,i,p);
 }
 arc(ctx,32,0,25+94*t,-spread*1.5,spread*1.5,2,p.color);
 // Casino chip ring is a visual marker only; it has no random gameplay result.
 ctx.save();ctx.rotate(t*2);polygon(ctx,8,20);ctx.strokeStyle=p.light;ctx.lineWidth=2;ctx.stroke();polygon(ctx,4,9,Math.PI/4);ctx.fillStyle=p.color;ctx.fill();ctx.restore();
}
function counter(ctx,b,t){
 const p=b.palette,r=44+90*t;
 // Heavy black ink sweeps edged in gold, followed by an original geometric fist.
 for(let i=0;i<Math.min(b.count,6);i++){
  const radius=r+i*7,start=-1.25+i*.07,end=.85+t*.6;
  arc(ctx,3,8,radius,start,end,10-i,'#111721');
  arc(ctx,3,8,radius+5,start,end,2,p.color);
 }
 ctx.save();ctx.translate(43+t*56,-8);ctx.rotate(-.22+t*.2);
 ctx.fillStyle='#141b28';ctx.strokeStyle=p.light;ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(-22,-11);ctx.lineTo(-8,-23);ctx.lineTo(23,-17);ctx.lineTo(29,2);ctx.lineTo(13,20);ctx.lineTo(-17,15);ctx.closePath();ctx.fill();ctx.stroke();
 for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-2+i*8,-17);ctx.lineTo(1+i*8,-3);ctx.stroke();}ctx.restore();
 for(let i=6;i<b.count;i++){const a=(i-6)*.24-1.1;ctx.save();ctx.translate(Math.cos(a)*r,Math.sin(a)*r);polygon(ctx,4,3+i%3,.25);ctx.fillStyle=p.color;ctx.fill();ctx.restore();}
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
return {create,STYLES};
});
