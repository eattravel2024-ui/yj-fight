/* Menu navigation only. Combat, room membership and starts remain owned by the clients. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiGameFlow=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const PANELS=Object.freeze(['home','fighters','room','settings','guide','missions','stages','versus','results']);
const SCREENS=Object.freeze([...PANELS,'battle']);
const MODES=Object.freeze(['arcade','practice','online','team','spectator']);
function create(options={}){
 const screen=SCREENS.includes(options.initialScreen)?options.initialScreen:'home';
 let state=Object.freeze({screen,panel:screen==='battle'?'home':screen,draftMode:MODES.includes(options.mode)?options.mode:'arcade'});
 const listeners=new Set();
 function update(next){
  if(next.screen===state.screen&&next.panel===state.panel&&next.draftMode===state.draftMode)return false;
  state=Object.freeze(next);for(const listener of [...listeners])listener(state);return true;
 }
 function close(){return update({...state,screen:'battle'});}
 return Object.freeze({
  get screen(){return state.screen;},
  get currentPanel(){return state.panel;},
  get draftMode(){return state.draftMode;},
  get snapshot(){return state;},
  isOpen:()=>state.screen!=='battle',
  open(panel='home'){if(!SCREENS.includes(panel))return false;return panel==='battle'?close():update({...state,screen:panel,panel});},
  close,
  selectMode(mode){if(!MODES.includes(mode))return false;return update({...state,draftMode:mode});},
  battleStarted(detail={}){return update({...state,screen:'battle',draftMode:MODES.includes(detail.mode)?detail.mode:state.draftMode});},
  subscribe(listener){if(typeof listener!=='function')throw new TypeError('A navigation listener must be a function');listeners.add(listener);return ()=>listeners.delete(listener);}
 });
}
return Object.freeze({create,PANELS,SCREENS,MODES});
});
