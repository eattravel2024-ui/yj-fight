/* 阿志向錢衝 8.3：多層真實打擊感特效，僅影響渲染，不更改戰鬥結果 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiVFX=api})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const cap=(v,a,b)=>Math.min(b,Math.max(a,v));
const MODES=['cinema','standard','low'];
const STYLE={riposte:{radius:92,life:360,count:22,kick:5,color:'#91fff0'},punish:{radius:105,life:400,count:26,kick:6,color:'#ffd982'},parry:{radius:82,life:350,count:18,kick:0,color:'#82fff2'},light:{radius:62,life:255,count:14,kick:2,color:'#ffe6a8'},heavy:{radius:105,life:430,count:30,kick:8,color:'#ffb675'},upper:{radius:118,life:465,count:35,kick:9,color:'#ffbc71'},special:{radius:140,life:560,count:44,kick:11,color:'#83caff'},super:{radius:195,life:730,count:66,kick:15,color:'#e6a3ff'},block:{radius:60,life:315,count:12,kick:2,color:'#74e9ff'},counter:{radius:137,life:530,count:42,kick:12,color:'#ff6dba'},ko:{radius:160,life:850,count:70,kick:17,color:'#fff1a5'}};
function typeFor(e){return e.perfectGuard?'parry':e.block?'block':e.riposte?'riposte':e.punish?'punish':e.counter?'counter':e.move==='super'?'super':e.move==='special'?'special':e.move==='upper'?'upper':e.move==='heavy'?'heavy':'light'}
function rgba(hex,a){const s=hex.replace('#','');return `rgba(${parseInt(s.slice(0,2),16)},${parseInt(s.slice(2,4),16)},${parseInt(s.slice(4,6),16)},${cap(a,0,1)})`}
function create(opts={}){
 let mode=MODES.includes(opts.quality)?opts.quality:'cinema',bursts=[],context=null,noise=null,lastSound=-1;
 const reduce=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const atlas=typeof Image==='function'?new Image():null;if(atlas)atlas.src=opts.atlas||'art/vfx/impact_energy.png?v=830';
 const factor=()=>(mode==='low'?.3:mode==='standard'?.65:1)*(reduce?.5:1);
 function setQuality(q){mode=MODES.includes(q)?q:'cinema';return mode}
 function emit(e,at){const type=typeFor(e),style=STYLE[type],direction=e.direction===-1?-1:1;
  const count=Math.floor(style.count*factor());const flecks=[];
  for(let i=0;i<count;i++){const angle=(Math.random()-.5)*Math.PI*1.72+(direction>0?0:Math.PI);flecks.push({ang:angle,dx:Math.cos(angle)*(2+Math.random()*6),dy:Math.sin(angle)*(2+Math.random()*6)-1.5,len:8+Math.random()*30,width:1+Math.random()*3,delay:Math.random()*37})}
  const burst={type,style,x:cap(Number(e.x)||480,10,950),y:cap(Number(e.y)||330,20,515),direction,at:Number.isFinite(at)?at:performance.now(),accent:e.accent||style.color,flecks};bursts.push(burst);if(bursts.length>30)bursts.shift();return burst;
 }
 function list(now){bursts=bursts.filter(b=>now-b.at<b.style.life);return bursts}
 function camera(now){if(mode==='low'||reduce)return{x:0,y:0,scale:1};let x=0,y=0;
  for(const b of list(now)){const t=(now-b.at)/b.style.life;if(t>.45)continue;const energy=Math.pow(1-t/.45,2)*b.style.kick*factor();x+=Math.sin(t*115+b.x*.02)*energy;y+=Math.cos(t*140+b.y*.01)*energy*.5}
  return{x:cap(x,-18,18),y:cap(y,-10,10),scale:1};
 }
 function back(ctx,now){for(const b of list(now)){
  const t=cap((now-b.at)/b.style.life,0,1),r=b.style.radius,fade=(1-t)*(1-t);
  ctx.save();ctx.globalCompositeOperation='screen';const glow=ctx.createRadialGradient(b.x,b.y,4,b.x,b.y,r*2.4);glow.addColorStop(0,rgba('#fffcf4',fade*.23));glow.addColorStop(.25,rgba(b.accent,fade*.29));glow.addColorStop(1,rgba(b.accent,0));ctx.fillStyle=glow;ctx.beginPath();ctx.arc(b.x,b.y,r*2.4,0,Math.PI*2);ctx.fill();ctx.restore();
  if(!['light','block','parry'].includes(b.type)){const u=cap((now-b.at-44)/330,0,1);ctx.save();ctx.strokeStyle=rgba(b.accent,(1-u)*.24);ctx.lineWidth=(1-u)*4;ctx.beginPath();ctx.ellipse(b.x,446,r*(.2+1.2*u),4+12*u,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle=rgba('#e1dfcc',.25*(1-u));for(let i=-3;i<=3;i++){ctx.beginPath();ctx.ellipse(b.x+i*r*.28*u,437-Math.abs(i)*u*3,6+12*(1-u),3+11*(1-u),0,0,Math.PI*2);ctx.fill()}ctx.restore()}
 }}
 function front(ctx,now){for(const b of list(now)){
  const age=now-b.at,t=cap(age/b.style.life,0,1),fade=Math.pow(1-t,1.4),r=b.style.radius,strength=reduce?.55:['parry','riposte','punish'].includes(b.type)?.75:1;ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=strength;
  if(atlas?.complete&&atlas.naturalWidth>=1024){const column=['block','parry'].includes(b.type)?2:b.type==='super'||b.type==='special'||b.type==='ko'?3:['heavy','upper','counter','riposte','punish'].includes(b.type)?1:0;
   const pop=.8+.6*Math.sin(Math.PI*cap(age/220,0,1));ctx.globalAlpha=fade*.92*factor()*strength;ctx.drawImage(atlas,column*256,0,256,256,b.x-r*pop,b.y-r*pop,r*2*pop,r*2*pop);ctx.globalAlpha=strength}
  const grad=ctx.createRadialGradient(b.x,b.y,1,b.x,b.y,r*.85);grad.addColorStop(0,rgba('#fffdfa',fade*.88));grad.addColorStop(.21,rgba('#fff5c9',fade*.66));grad.addColorStop(.7,rgba(b.accent,fade*.14));grad.addColorStop(1,rgba(b.accent,0));ctx.fillStyle=grad;ctx.beginPath();ctx.arc(b.x,b.y,r*.85,0,Math.PI*2);ctx.fill();
  // Angled slash burst, timed to contact, not looping continuously.
  if(mode!=='low')for(let i=0;i<13;i++){const a=i*2*Math.PI/13+.18,span=r*(.35+1.22*t),len=r*(.31+.14*(i%3))*fade;ctx.beginPath();ctx.moveTo(b.x+Math.cos(a)*span*.36,b.y+Math.sin(a)*span*.32);ctx.lineTo(b.x+Math.cos(a)*(span+len),b.y+Math.sin(a)*(span+len)*.86);ctx.lineTo(b.x+Math.cos(a)*span*.36+Math.sin(a)*3,b.y+Math.sin(a)*span*.32-Math.cos(a)*3);ctx.fillStyle=rgba(i%3===0?'#fffdfa':b.accent,fade*(i%3===0?.55:.29));ctx.fill()}
  const shock=cap((age-32)/245,0,1);if(age<310){ctx.beginPath();ctx.ellipse(b.x,b.y,r*(.35+1.65*shock),r*(.22+.85*shock),b.direction*.12,0,Math.PI*2);ctx.lineWidth=(1-shock)*8+1;ctx.strokeStyle=rgba('#ffffff',Math.pow(1-shock,1.4)*.83);ctx.stroke()}
  // Flying fragments and sparks (alpha texture alone cannot produce this directional kinetic motion).
  for(const p of b.flecks){const u=age-p.delay;if(u<0)continue;const f=u/16.667,remain=cap(1-u/b.style.life,0,1);if(remain===0)continue;const travel=(1-Math.exp(-f*.12))/.12,x=b.x+p.dx*travel*2.6,y=b.y+p.dy*travel*2.6+.16*f*f;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(p.ang)*p.len*remain,y-Math.sin(p.ang)*p.len*remain);ctx.lineWidth=p.width*remain;ctx.lineCap='round';ctx.strokeStyle=rgba(p.width>2.4?'#fffafa':b.accent,remain*.82);ctx.stroke()}
  if(['block','parry'].includes(b.type)){const u=cap(age/300,0,1);ctx.beginPath();ctx.ellipse(b.x-b.direction*20,b.y,39+92*u,49+22*u,0,Math.PI*.6,Math.PI*1.4);ctx.lineWidth=5*(1-u)+.5;ctx.strokeStyle=rgba('#91edff',.7*(1-u));ctx.stroke()}
  ctx.restore();
 }}
 function screen(ctx,now){for(const b of list(now)){
  const t=cap((now-b.at)/145,0,1),fade=(1-t)*(1-t);if(fade<=0)continue;ctx.save();ctx.fillStyle=rgba(['block','parry'].includes(b.type)?'#c3f5ff':'#fff7de',fade*factor()*Math.min(.22,b.style.kick*.017));ctx.fillRect(0,0,960,540);
  if(['counter','super','ko'].includes(b.type)&&mode!=='low'){const rad=ctx.createRadialGradient(b.x,b.y,60,b.x,b.y,650);rad.addColorStop(0,'rgba(0,0,0,0)');rad.addColorStop(1,rgba(b.accent,fade*.24));ctx.fillStyle=rad;ctx.fillRect(0,0,960,540)}ctx.restore();
 }}
 function unlock(){if(typeof window==='undefined')return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;context=context||new AC();if(context.state==='suspended')context.resume()}catch(_){}}
 // WebAudio synthesis: layered sub-bass impact + filtered broadband crackle; no external files.
 function sound(kind='hit',enabled=true){if(!enabled||typeof window==='undefined')return;try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;context=context||new AC();if(context.state==='suspended')context.resume();const t=context.currentTime;if(t-lastSound<.025&&kind!=='super')return;lastSound=t;
  const heavy=['heavy','upper','special','super','counter','ko','hit'].includes(kind),block=kind==='block';const dur=kind==='super'?.35:heavy?.23:.14;
  const bus=context.createGain();bus.gain.value=.30;bus.connect(context.destination);
  const osc=context.createOscillator(),gain=context.createGain();osc.type=block?'triangle':'sine';osc.frequency.setValueAtTime(block?260:heavy?113:205,t);osc.frequency.exponentialRampToValueAtTime(block?105:37,t+dur);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(heavy?.48:.24,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+dur);osc.connect(gain).connect(bus);osc.start(t);osc.stop(t+dur+.01);
  if(!noise){const len=Math.floor(context.sampleRate*.5);noise=context.createBuffer(1,len,context.sampleRate);const a=noise.getChannelData(0);for(let i=0;i<len;i++)a[i]=Math.random()*2-1}
  const src=context.createBufferSource(),f=context.createBiquadFilter(),n=context.createGain();src.buffer=noise;f.type='bandpass';f.frequency.value=block?1900:heavy?580:1150;f.Q.value=.6;n.gain.setValueAtTime(.0001,t);n.gain.exponentialRampToValueAtTime(heavy?.32:.17,t+.004);n.gain.exponentialRampToValueAtTime(.0001,t+dur*.85);src.connect(f).connect(n).connect(bus);src.start(t);src.stop(t+dur+.01);
  if(kind==='super'||kind==='ko'){const overtone=context.createOscillator(),env=context.createGain();overtone.type='sawtooth';overtone.frequency.setValueAtTime(420,t);overtone.frequency.exponentialRampToValueAtTime(70,t+.30);env.gain.setValueAtTime(.10,t);env.gain.exponentialRampToValueAtTime(.0001,t+.3);overtone.connect(env).connect(bus);overtone.start(t);overtone.stop(t+.31)}
 }catch(_){/* Browser may block autoplay; visual effects remain available. */}}
 return{emit,front,back,screen,camera,sound,unlock,setQuality,clear:()=>{bursts=[]},get quality(){return mode},get count(){return bursts.length},snapshot:now=>list(now).map(b=>({kind:b.type,sparks:b.flecks.length,x:b.x,y:b.y}))};
}
return{create,typeFor,STYLE};
});
