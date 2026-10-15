/* Azhi 8.4: deterministic rollback, shared between browser and Node. MIT-style original implementation. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiRollback=api})(typeof globalThis==='object'?globalThis:this,function(root){
'use strict';
const Core=(typeof module==='object'&&module.exports)?require('./core.js'):root.AzhiCore;
const TeamCore=(typeof module==='object'&&module.exports)?require('./team-core.js'):root.AzhiTeamCore;
const WINDOW=30, INPUT_DELAY=3, FUTURE=90;
const KEYS=['left','right','up','down','guard','dash',...Core.ATTACKS];
function clone(x){return typeof structuredClone==='function'?structuredClone(x):JSON.parse(JSON.stringify(x));}
function normalize(raw){const keys={};const src=raw?.keys&&typeof raw.keys==='object'?raw.keys:raw||{};
 for(const k of KEYS)if(src[k]===true)keys[k]=true;
 const pulses=Array.isArray(raw?.pulses)?raw.pulses.filter(k=>Core.ATTACKS.includes(k)).slice(0,4):[];
 return {keys,pulses};}
function predict(prev){return {keys:{...(prev?.keys||{})},pulses:[]};}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function hash(state){const data=JSON.stringify({...state,events:[]});let h=2166136261;for(let i=0;i<data.length;i++){h^=data.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0');}
class Session{
 constructor(game,options={}){
  this.game=clone(game);this.game.events=[];this.frame=0;this.window=options.window||WINDOW;
  this.core=game.ruleset==='team'?TeamCore:Core;this.count=game.players.length;
  if(![2,4].includes(this.count))throw new Error('Rollback supports only 2 or 4 fighters');
  this.history=new Map([[0,clone(this.game)]]);this.inputs=Array.from({length:this.count},()=>new Map());this.used=new Map();this.events=new Map();
  this.rollbacks=0;this.replayed=0;this.lastRollback=0;this.dropped=0;this.resyncs=0;this.correctionFrom=null;
 }
 state(frame=this.frame){return this.history.get(frame);}
 digest(frame=this.frame){const s=this.history.get(frame);return s?hash(s):null;}
 oldest(){return Math.max(0,this.frame-this.window);}
 submit(slot,frame,raw,options={}){
  if(!Number.isSafeInteger(slot)||slot<0||slot>=this.count||!Number.isSafeInteger(frame)||frame<1||frame>this.frame+FUTURE)return false;
  if(frame<=this.frame&&(frame-1<this.oldest()||!this.history.has(frame-1))){this.dropped++;return false;}
  const entry=normalize(raw), prior=this.inputs[slot].get(frame);if(prior&&same(prior,entry))return true;
  if(prior&&options.lockExisting)return false;
  this.inputs[slot].set(frame,entry);
  const used=this.used.get(frame)?.inputs[slot];
  if(used&&!same(used,entry)){this.replay(frame);}
  return true;
 }
 doFrame(frame){
  const earlier=this.used.get(frame-1);
  const current=Array.from({length:this.count},(_,slot)=>this.inputs[slot].get(frame)||predict(earlier?.inputs[slot]));
  const real=Array.from({length:this.count},(_,slot)=>this.inputs[slot].has(frame));
  for(let slot=0;slot<this.count;slot++)this.core.input(this.game,slot,{...current[slot].keys,pulses:current[slot].pulses});
  this.core.step(this.game);
  const ev=this.game.events.splice(0);
  this.frame=frame;this.used.set(frame,{frame,inputs:clone(current),real});this.events.set(frame,ev);
  this.history.set(frame,clone(this.game));this.prune();return ev;
 }
 advance(){return this.doFrame(this.frame+1);}
 replay(from){
  if(!this.history.has(from-1)){this.dropped++;return false;}
  const end=this.frame;this.game=clone(this.history.get(from-1));this.frame=from-1;
  for(let f=from;f<=end;f++)this.doFrame(f);
  this.rollbacks++;this.replayed+=end-from+1;this.lastRollback=end-from+1;
  this.correctionFrom=this.correctionFrom===null?from:Math.min(this.correctionFrom,from);
  return true;
 }
 hardSync(frame,state){
  if(!Number.isSafeInteger(frame)||frame<0||!state?.players||state.players.length!==this.count)return false;
  const snap=clone(state);snap.events=[];this.game=snap;this.frame=frame;
  this.history.clear();this.history.set(frame,clone(snap));this.used.clear();this.events.clear();
  for(const inputs of this.inputs)for(const f of inputs.keys())if(f<=frame)inputs.delete(f);
  this.resyncs++;this.correctionFrom=null;return true;
 }
 rebase(frame,state){
  if(!Number.isSafeInteger(frame)||frame<0||frame>this.frame||!state?.players||state.players.length!==this.count)return false;
  const target=this.frame;const snap=clone(state);snap.events=[];
  if(this.history.has(frame)){
   if(this.digest(frame)===hash(snap))return false;
   this.game=snap;this.frame=frame;this.history.set(frame,clone(snap));
   for(let f=frame+1;f<=target;f++)this.doFrame(f);
  }else{
   this.hardSync(frame,snap);return true;
  }
  this.resyncs++;this.correctionFrom=this.correctionFrom===null?frame+1:Math.min(this.correctionFrom,frame+1);
  this.prune();return true;
 }
 rows(from,to=this.frame){const out=[];for(let f=Math.max(1,from);f<=to;f++){const row=this.used.get(f);if(row)out.push(clone(row));}return out;}
 prune(){const keep=this.oldest();for(const store of [this.history,this.used,this.events])for(const f of store.keys())if(f<keep)store.delete(f);
  for(const input of this.inputs)for(const f of input.keys())if(f<keep)input.delete(f);
 }
}
return {Session,WINDOW,INPUT_DELAY,FUTURE,KEYS,normalize,predict,hash,clone};
});
