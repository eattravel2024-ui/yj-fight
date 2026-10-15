/* Visual mapping only: existing simulation stage IDs and geometry remain unchanged. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiStageArt=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const STAGES=Object.freeze({
 night:Object.freeze({name:'嘴砲夜市',img:'art/stages/night-market/background.webp?v=8103',fallback:'art/night.svg'}),
 garage:Object.freeze({name:'金沙賭城',img:'art/stages/golden-casino/background.webp?v=8103',fallback:'art/garage.svg'}),
 harbor:Object.freeze({name:'天安門廣場',img:'art/stages/tiananmen-square/background.webp?v=8103',fallback:'art/port-arena.svg'})
});
function create(){
 const images={};
 for(const [id,stage] of Object.entries(STAGES)){
  const image=new Image();let usedFallback=false;
  image.addEventListener('error',()=>{if(!usedFallback){usedFallback=true;image.src=stage.fallback;}});
  image.src=stage.img;images[id]=image;
 }
 return {draw(ctx,id,width=960,height=540){
  const image=images[Object.hasOwn(STAGES,id)?id:'night'];
  // An opaque underlay makes the supplied night-market alpha deterministic on every background.
  ctx.fillStyle='#101522';ctx.fillRect(0,0,width,height);
  if(!image.complete||!image.naturalWidth)return;
  const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  ctx.drawImage(image,(width-w)/2,(height-h)/2,w,h);
 }};
}
return Object.freeze({STAGES,create});
});
