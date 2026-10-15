/* User-supplied UI art. No dependency is added to deterministic combat data. */
(function(root,factory){
 const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiCharacterArt=api;
 if(root.document)api.bindDeclared(root.document);
})(typeof globalThis==='object'?globalThis:this,function(root){
'use strict';
const REVISION='8101',IDS=Object.freeze(['winnie','sezi','gambler','azhi']);
const ROLES=Object.freeze(['fullbody','portrait','hud']),states=new WeakMap();
const CHARACTER_ART=Object.freeze(Object.fromEntries(IDS.map(id=>[id,Object.freeze({
 fullbodyAsset:`art/characters/${id}/fullbody.webp?v=${REVISION}`,
 portraitAsset:`art/characters/${id}/portrait.webp?v=${REVISION}`,
 hudAsset:`art/characters/${id}/hud.webp?v=${REVISION}`,
 legacyPortraitAsset:`art/portrait_${id}.webp?v=8100`
})])));
function safeId(id){return typeof id==='string'&&Object.hasOwn(CHARACTER_ART,id)?id:'azhi';}
function forCharacter(id){return CHARACTER_ART[safeId(id)];}
function nameOf(id){return root.AzhiCore?.CHAR?.[id]?.name||id;}
function removeNotice(state){if(state.notice){state.notice.remove();state.notice=null;}}
function bindImage(image,id,role='portrait'){
 if(!image||typeof image.addEventListener!=='function')throw new TypeError('Expected an image element');
 id=safeId(id);role=ROLES.includes(role)?role:'portrait';
 const key=id+':'+role,old=states.get(image);if(old?.key===key)return image;
 if(old)removeNotice(old);
 const art=forCharacter(id),urls=[art[role+'Asset'],art.legacyPortraitAsset];
 const state={key,id,role,urls,index:0,notice:null};states.set(image,state);
 image.hidden=false;image.dataset.characterArt=id;image.dataset.artRole=role;image.dataset.artStatus='loading';
 image.alt=nameOf(id)+(role==='fullbody'?'角色立繪':role==='hud'?'戰鬥頭像':'角色肖像');
 if(!old){
  image.addEventListener('load',()=>{const current=states.get(image);if(!current)return;removeNotice(current);image.hidden=false;image.dataset.artStatus=current.index?'fallback':'loaded';});
  image.addEventListener('error',()=>{
   const current=states.get(image);if(!current)return;
   if(current.index+1<current.urls.length){current.index++;image.dataset.artStatus='fallback-loading';image.src=current.urls[current.index];return;}
   // Terminal failures stay terminal until the character/purpose changes, avoiding render/retry loops.
   image.hidden=true;image.dataset.artStatus='missing';
   if(!current.notice&&image.parentElement){const note=image.ownerDocument.createElement('span');note.className='art-unavailable';note.dataset.artRole=current.role;note.textContent=nameOf(current.id)+'圖片暫未載入';note.setAttribute('role','status');image.after(note);current.notice=note;}
  });
 }
 image.src=urls[0];return image;
}
function bindDeclared(scope){for(const image of scope.querySelectorAll('img[data-character-art]'))bindImage(image,image.dataset.characterArt,image.dataset.artRole);}
return Object.freeze({REVISION,IDS,ROLES,CHARACTER_ART,forCharacter,bindImage,bindDeclared});
});
