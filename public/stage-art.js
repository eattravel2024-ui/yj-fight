/* Visual mapping only: existing simulation stage IDs and geometry remain unchanged. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./stage-registry.js'):root.AzhiStages);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiStageArt=api;})(typeof globalThis==='object'?globalThis:this,function(Registry){
'use strict';
const STAGES=Object.freeze(Object.fromEntries(Registry.PLAYABLE.map(id=>{const s=Registry.get(id);return [id,Object.freeze({name:s.name,img:s.backgroundAsset,fallback:s.fallbackAsset})];})));
// Preprocessed once at authoring time: no per-frame filter touches fighters or HUD.
const VISUALS=Object.freeze({
 night:Object.freeze({saturation:.80,brightness:.91,contrast:.93,combat:'art/stages/night-market/combat.webp?v=8112'}),
 garage:Object.freeze({saturation:.78,brightness:.90,contrast:.92,combat:'art/stages/golden-casino/combat.webp?v=8112'}),
 harbor:Object.freeze({saturation:.78,brightness:.91,contrast:.94,combat:'art/stages/tiananmen-square/combat.webp?v=8112'})
});
function create(){
 const images={},promises={},reloaders={};
 for(const [id,stage] of Object.entries(STAGES)){
  const image=new Image();let attempt=0,resolve;
  const sources=[VISUALS[id].combat,stage.img,stage.fallback];
  image.addEventListener('load',()=>resolve?.(true));
  image.addEventListener('error',()=>{if(++attempt<sources.length)image.src=sources[attempt];else resolve?.(false);});
  const load=(retry=false)=>{attempt=0;promises[id]=new Promise(done=>resolve=done);image.src=sources[0]+(retry?'&retry='+Date.now():'');return promises[id];};
  reloaders[id]=load;images[id]=image;load();
 }
 return {ready:(id,{retry=false}={})=>!Registry.playable(id)?Promise.resolve(false):retry&&images[id].complete&&!images[id].naturalWidth?reloaders[id](true):promises[id],draw(ctx,id,width=960,height=540){
  const image=images[Object.hasOwn(STAGES,id)?id:'night'];
  // An opaque underlay makes the supplied night-market alpha deterministic on every background.
  ctx.fillStyle='#101522';ctx.fillRect(0,0,width,height);
  if(!image.complete||!image.naturalWidth)return;
  const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  ctx.drawImage(image,(width-w)/2,(height-h)/2,w,h);
  const vignette=ctx.createRadialGradient(width/2,height*.48,height*.28,width/2,height*.48,width*.65);
  vignette.addColorStop(0,'#050b1700');vignette.addColorStop(1,'#050b1738');ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
 }};
}
return Object.freeze({STAGES,VISUALS,create});
});
