/* Local crop/preview only. The original image never leaves this browser. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiAvatarEditor=api;})(globalThis,function(root){
'use strict';
const SIZE=256,MAX_SOURCE=12*1024*1024,MAX_OUTPUT=96*1024;
const URL_PATTERN=/^\/api\/avatars\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/[a-f0-9]{64}\.webp$/;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function cropRect(width,height,zoom=1,x=width/2,y=height/2){
 const size=Math.min(width,height)/clamp(zoom,1,4),cx=clamp(x,size/2,width-size/2),cy=clamp(y,size/2,height-size/2);
 return {x:cx-size/2,y:cy-size/2,size,cx,cy};
}
function supported(bytes){return bytes[0]===255&&bytes[1]===216&&bytes[2]===255||bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71||String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';}
async function decode(file){
 if(typeof root.createImageBitmap==='function')return root.createImageBitmap(file,{imageOrientation:'from-image'});
 // data: fallback obeys the existing image CSP; no blob: or external image origin is needed.
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('無法讀取這張圖片。'));reader.readAsDataURL(file);});
 const img=new Image();img.src=data;await img.decode();return img;
}
async function compress(canvas){
 for(const quality of [.86,.75,.62,.48]){
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
  if(!blob||blob.type!=='image/webp')throw new Error('此瀏覽器不支援 WebP 壓縮，請使用新版 Chrome、Safari 或 Firefox。');
  if(blob.size<=MAX_OUTPUT)return blob;
 }
 throw new Error('圖片細節過多，請縮小裁切範圍或選擇其他圖片。');
}
let active=null;
function open(file,{onSave,onClose}={}){
 if(active)return;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const dialog=el('dialog','avatar-editor');dialog.id='playerAvatarEditor';dialog.setAttribute('aria-labelledby','avatarEditorTitle');
 const title=el('h2','','裁切你的玩家頭像');title.id='avatarEditorTitle';
 const top=el('header','avatar-editor-heading');top.append(el('small','','PLAYER ID / MAKE IT YOURS'),title,el('p','','拖曳圖片調整位置，放大後裁切。儲存前不會上傳原圖。'));
 const body=el('div','avatar-editor-layout'),workspace=el('div','avatar-editor-workspace'),frame=el('div','avatar-editor-frame'),canvas=el('canvas','avatar-editor-canvas');
 canvas.width=560;canvas.height=560;canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','拖曳或使用方向鍵移動裁切位置');frame.append(canvas,el('span','avatar-editor-grid'));
 const tip=el('p','player-muted','拖曳或使用方向鍵移動 · Shift＋方向鍵加速');
 const zoomLabel=el('label','avatar-editor-zoom','縮放圖片'),range=el('input');range.type='range';range.min='1';range.max='4';range.step='.01';range.value='1';range.id='avatarZoom';range.setAttribute('aria-label','縮放圖片');zoomLabel.append(range);
 workspace.append(frame,tip,zoomLabel);
 const aside=el('aside','avatar-editor-previews'),square=el('canvas','avatar-preview-square'),circle=el('canvas','avatar-preview-circle');for(const preview of [square,circle]){preview.width=128;preview.height=128;preview.setAttribute('role','img');preview.setAttribute('aria-label',preview===square?'方形頭像預覽':'圓形頭像預覽');}
 aside.append(el('small','player-kicker','LIVE PREVIEW'),square,circle,el('p','player-muted','自動壓縮為 256 × 256 WebP。只儲存裁切後的頭像。'));body.append(workspace,aside);
 const notice=el('p','player-notice','正在讀取圖片…');notice.id='avatarEditorStatus';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 const footer=el('footer','avatar-editor-actions'),reset=el('button','player-secondary','重設裁切'),cancel=el('button','player-secondary','取消'),save=el('button','player-primary','儲存頭像');for(const b of[reset,cancel,save])b.type='button';save.id='avatarSave';save.disabled=true;reset.disabled=true;footer.append(reset,cancel,save);dialog.append(top,body,notice,footer);document.body.append(dialog);
 let image=null,cx=0,cy=0,zoom=1,drag=null,closed=false,busy=false;
 const previous=document.activeElement;active=dialog;dialog.showModal();cancel.focus();
 function close(){if(busy)return;dialog.close();}
 dialog.addEventListener('close',()=>{closed=true;active=null;drag=null;image=null;dialog.remove();onClose?.();(previous?.isConnected?previous:document.getElementById('playerAvatarUpload'))?.focus();});
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
 cancel.onclick=close;
 function paint(){if(!image||closed)return;const rect=cropRect(image.width,image.height,zoom,cx,cy);cx=rect.cx;cy=rect.cy;
  for(const target of[canvas,square,circle]){const ctx=target.getContext('2d');ctx.clearRect(0,0,target.width,target.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,rect.x,rect.y,rect.size,rect.size,0,0,target.width,target.height);}
 }
 range.oninput=()=>{zoom=Number(range.value);paint();};reset.onclick=()=>{zoom=1;range.value='1';cx=image.width/2;cy=image.height/2;paint();};
 canvas.addEventListener('pointerdown',event=>{if(!image||busy)return;event.preventDefault();canvas.focus();canvas.setPointerCapture(event.pointerId);drag={id:event.pointerId,x:event.clientX,y:event.clientY};});
 canvas.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const ratio=cropRect(image.width,image.height,zoom,cx,cy).size/canvas.getBoundingClientRect().width;cx-=(event.clientX-drag.x)*ratio;cy-=(event.clientY-drag.y)*ratio;drag.x=event.clientX;drag.y=event.clientY;paint();});
 for(const type of['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>drag=null);
 canvas.addEventListener('keydown',event=>{if(!image||busy||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();const step=cropRect(image.width,image.height,zoom,cx,cy).size*(event.shiftKey?.1:.025);cx+=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0;cy+=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;paint();});
 save.onclick=async()=>{if(busy||!image)return;busy=true;for(const control of[save,cancel,reset,range])control.disabled=true;notice.className='player-notice';notice.textContent='正在壓縮並儲存頭像…';
  try{const target=document.createElement('canvas');target.width=SIZE;target.height=SIZE;const rect=cropRect(image.width,image.height,zoom,cx,cy);target.getContext('2d').drawImage(image,rect.x,rect.y,rect.size,rect.size,0,0,SIZE,SIZE);const blob=await compress(target);await onSave(blob);busy=false;dialog.close();}
  catch(error){notice.className='player-notice error';notice.textContent=error.message||'頭像儲存失敗，請重試。';busy=false;for(const control of[save,cancel,reset,range])control.disabled=false;}
 };
 (async()=>{
  let decoded;
  try{
   if(!file||file.size>MAX_SOURCE||!supported(new Uint8Array(await file.slice(0,12).arrayBuffer())))throw new Error('請選擇 12 MB 以內的 JPG、PNG 或 WebP 圖片。');
   if(closed)return;decoded=await decode(file);if(closed)return;const width=decoded.naturalWidth||decoded.width,height=decoded.naturalHeight||decoded.height;
   if(!width||!height||width*height>50e6)throw new Error('圖片解析度過大，請先縮小至 5,000 萬畫素以內。');
   const scale=Math.min(1,2048/Math.max(width,height)),source=document.createElement('canvas');source.width=Math.max(1,Math.round(width*scale));source.height=Math.max(1,Math.round(height*scale));source.getContext('2d').drawImage(decoded,0,0,source.width,source.height);image=source;cx=image.width/2;cy=image.height/2;paint();save.disabled=false;reset.disabled=false;notice.textContent='預覽確認後按「儲存頭像」。原圖保留在你的裝置中。';canvas.focus();
  }catch(error){if(!closed){notice.className='player-notice error';notice.textContent=error.message||'無法讀取這張圖片，請選擇其他檔案。';}}
  finally{decoded?.close?.();}
 })();
 return dialog;
}
return {open,cropRect,supported,compress,isAvatarUrl:value=>typeof value==='string'&&URL_PATTERN.test(value),SIZE,MAX_SOURCE,MAX_OUTPUT};
});
