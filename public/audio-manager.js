/* A single Web Audio graph. No simulation state or browser autoplay bypass. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiAudioManager=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const KEY='azhi_audio_v1',clamp=(n,fallback)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback;
function create(options={}){
 const fetcher=options.fetch||globalThis.fetch.bind(globalThis);let storage=options.storage;try{if(storage===undefined)storage=globalThis.localStorage;}catch{}
 let settings={enabled:true,bgm:.65,sfx:.8},hasSettings=false;
 try{const v=JSON.parse(storage?.getItem(KEY));if(v&&typeof v==='object'){settings={enabled:v.enabled!==false,bgm:clamp(v.bgm,.65),sfx:clamp(v.sfx,.8)};hasSettings=true;}}catch{}
 let context=null,master,bgmBus,sfxBus,ready=false,disposed=false,hidden=false,desired=null,current=null,version=0,unlocking=null,noise=null,lastSynth=-1;
 const tracks=new Map(),raw=new Map(),decoded=new Map(),decoding=new Map(),music=new Set(),shots=new Set(),lanes=new Map(),seen=new Map(),listeners=new Set();
 const stats={musicStarts:0,stingStarts:0,sourceFallbacks:0,played:[],errors:[],preloaded:0};
 function readManifest(){return Promise.resolve().then(()=>options.manifest||fetcher('audio/manifest.json?v=8111').then(r=>{if(!r.ok)throw Error('manifest');return r.json()})).then(m=>{
  for(const t of m.tracks||[]){if(!/^[a-z][a-z0-9_]*$/.test(t.id)||!['bgm','sting'].includes(t.kind)||!Array.isArray(t.sources)||!t.sources.every(s=>/^audio\/ost\/[a-z0-9-]+\.(ogg|m4a)$/.test(s)))throw Error('invalid audio manifest');tracks.set(t.id,Object.freeze({...t,volume:clamp(t.volume,.5)}));}stats.errors=stats.errors.filter(e=>e!=='manifest');notify();return true;
 }).catch(()=>{tracks.clear();failure('manifest');return false;});}
 let loading=readManifest();
 function notify(){for(const f of listeners)f(snapshot());}
 function failure(id){if(!stats.errors.includes(id))stats.errors.push(id);notify();}
 function save(){try{storage?.setItem(KEY,JSON.stringify(settings));}catch{}notify();}
 function ramp(param,to,duration=.3,at=context.currentTime){if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(at);else{param.cancelScheduledValues(at);param.setValueAtTime(param.value,at);}param.linearRampToValueAtTime(to,at+duration);}
 function duck(){if(bgmBus)ramp(bgmBus.gain,settings.bgm*(shots.size?.3:1),.18);}
 function volume(){if(!context)return; ramp(master.gain,settings.enabled?1:0,.05);ramp(sfxBus.gain,settings.sfx,.05);duck();}
 function snapshot(){return {ready,enabled:settings.enabled,bgm:settings.bgm,sfx:settings.sfx,hasSettings,hidden,desired,current:current?.id||null,activeBgm:music.size,activeSfx:shots.size,contextState:context?.state||'locked',decoded:decoded.size,tracks:[...tracks.values()],...stats,played:[...stats.played],errors:[...stats.errors]};}
 function encoded(path){if(!raw.has(path)){raw.set(path,fetcher(path+'?v=8111').then(r=>{if(!r.ok)throw Error('audio HTTP');return r.arrayBuffer()}).then(b=>{stats.preloaded++;return b;}));}return raw.get(path);}
 async function buffer(id){
  await loading;if(!context||!tracks.has(id))return null;
  if(decoded.has(id)){const b=decoded.get(id);decoded.delete(id);decoded.set(id,b);return b;}
  if(decoding.has(id))return decoding.get(id);
  const task=(async()=>{const t=tracks.get(id);for(const [index,path] of t.sources.entries()){try{const bytes=await encoded(path);const b=await context.decodeAudioData(bytes.slice(0));if(disposed)return null;if(index)stats.sourceFallbacks++;stats.errors=stats.errors.filter(e=>e!==id);decoded.set(id,b);
    // Bound PCM cache; active sources retain their own buffers, encoded originals stay small.
    while(decoded.size>10||[...decoded.values()].reduce((n,b)=>n+(b.length||b.duration*context.sampleRate)*(b.numberOfChannels||2)*4,0)>32*1024*1024){const victim=[...decoded.keys()].find(key=>key!==id&&key!==current?.id);if(!victim)break;decoded.delete(victim);}return b;
   }catch{}}
   failure(id);return null;})();decoding.set(id,task);return task.finally(()=>decoding.delete(id));
 }
 async function preload(ids,{decode=false}={}){await loading;const list=(ids||[...tracks.keys()]).filter(id=>tracks.has(id));let cursor=0;await Promise.all(Array.from({length:Math.min(3,list.length)},async()=>{while(cursor<list.length){const id=list[cursor++];try{if(decode&&ready)await buffer(id);else await encoded(tracks.get(id).sources[0]);}catch{failure(id);}}}));return list.length;}
 function stop(node,duration=.3){if(node.stopped)return;node.stopped=true;const t=context.currentTime;ramp(node.gain.gain,0,duration,t);try{node.source.stop(t+duration+.02)}catch{}}
 async function startMusic(token){
  const id=desired;if(!ready||disposed||!id)return false;const t=tracks.get(id);if(!t||t.kind!=='bgm')return false;
  const b=await buffer(id);if(!b||token!==version||desired!==id||disposed||!ready)return false;
  if(current?.id===id&&!current.stopped)return true;
  for(const node of music){if(node!==current||node.stopped){try{node.source.stop()}catch{}music.delete(node);}else stop(node);}
  const source=context.createBufferSource(),gain=context.createGain(),node={id,source,gain,stopped:false};source.buffer=b;source.loop=t.loop===true;gain.gain.setValueAtTime(0,context.currentTime);source.connect(gain);gain.connect(bgmBus);music.add(node);current=node;
  source.onended=()=>{music.delete(node);source.disconnect();gain.disconnect();if(current===node)current=null;};source.start();ramp(gain.gain,t.volume,.3);stats.musicStarts++;notify();return true;
 }
 async function setMusic(id,{force=false}={}){await loading;if(id!==null&&tracks.get(id)?.kind!=='bgm'){if(stats.errors.includes('manifest')&&typeof id==='string'&&/^[a-z][a-z0-9_]*$/.test(id))desired=id;return false;}if(!force&&desired===id)return true;desired=id;const token=++version;if(id===null){for(const n of music)stop(n);current=null;return true;}if(!ready){preload([id]);return true;}return startMusic(token);}
 async function unlock(){
  if(disposed)return false;if(ready&&context?.state==='running')return true;if(unlocking)return unlocking;
  unlocking=(async()=>{try{
   if(!context){const AC=options.contextFactory||(()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)());context=AC();master=context.createGain();bgmBus=context.createGain();sfxBus=context.createGain();bgmBus.connect(master);sfxBus.connect(master);master.connect(context.destination);master.gain.value=settings.enabled?1:0;bgmBus.gain.value=settings.bgm;sfxBus.gain.value=settings.sfx;}
   // resume is called in the trusted input handler before any network await.
   await context.resume();ready=context.state==='running';if(ready){await loading;startMusic(++version);preload([...tracks.values()].filter(t=>t.kind==='sting').map(t=>t.id),{decode:true});}notify();return ready;
  }catch{ready=false;notify();return false;}finally{unlocking=null;}})();return unlocking;
 }
 async function sting(id,{key,lane='event',delay=0,level=1,duration,guard=()=>true}={}){
  if(!ready||disposed||hidden||!settings.enabled||settings.sfx===0||!guard())return false;
  if(key&&seen.has(key))return false;if(key){seen.set(key,true);if(seen.size>1024)seen.delete(seen.keys().next().value);}
  const generation=lanes.get(lane)||0,b=await buffer(id),t=tracks.get(id);
  if(!b||t?.kind!=='sting'||disposed||!ready||hidden||!settings.enabled||generation!==(lanes.get(lane)||0)||!guard())return false;
  for(const n of shots)if(n.lane===lane)stop(n,.04);
  const source=context.createBufferSource(),gain=context.createGain(),at=context.currentTime+Math.max(0,delay),length=Math.min(duration||b.duration,b.duration),node={id,lane,source,gain,stopped:false};source.buffer=b;source.loop=false;source.connect(gain);gain.connect(sfxBus);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(t.volume*level,at+.015);gain.gain.setValueAtTime(t.volume*level,Math.max(at+.015,at+length-.06));gain.gain.linearRampToValueAtTime(0,at+length);shots.add(node);duck();source.onended=()=>{shots.delete(node);source.disconnect();gain.disconnect();if(!disposed)duck();};source.start(at);source.stop(at+length+.01);stats.stingStarts++;stats.played.push({id,key:key||null});if(stats.played.length>128)stats.played.shift();notify();return true;
 }
 function stopLane(lane){lanes.set(lane,(lanes.get(lane)||0)+1);for(const node of shots)if(node.lane===lane)stop(node,.05);}
 function synth(kind='hit'){
  if(!ready||hidden||!settings.enabled||settings.sfx===0||disposed)return;
  const t=context.currentTime;if(t-lastSynth<.025)return;lastSynth=t;
  const heavy=['heavy','upper','special','super','counter','riposte','punish','ko','hit'].includes(kind),block=kind==='block'||kind==='parry',menu=['menu','move','confirm'].includes(kind),dur=menu?.08:heavy?.23:.14;
  const bus=context.createGain();bus.gain.value=menu?.12:.30;bus.connect(sfxBus);const osc=context.createOscillator(),gain=context.createGain();osc.type=block||menu?'triangle':'sine';osc.frequency.setValueAtTime(menu?kind==='confirm'?660:440:kind==='parry'?880:block?260:heavy?113:205,t);osc.frequency.exponentialRampToValueAtTime(menu?330:block?105:37,t+dur);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(heavy?.48:.24,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+dur);osc.connect(gain);gain.connect(bus);osc.start(t);osc.stop(t+dur+.01);osc.onended=()=>{osc.disconnect();gain.disconnect();setTimeout(()=>bus.disconnect(),100);};
  if(menu)return;
  if(!noise){noise=context.createBuffer(1,Math.floor(context.sampleRate*.5),context.sampleRate);const a=noise.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;}
  const src=context.createBufferSource(),filter=context.createBiquadFilter(),n=context.createGain();src.buffer=noise;filter.type='bandpass';filter.frequency.value=block?1900:heavy?580:1150;filter.Q.value=.6;n.gain.setValueAtTime(.0001,t);n.gain.exponentialRampToValueAtTime(heavy?.32:.17,t+.004);n.gain.exponentialRampToValueAtTime(.0001,t+dur*.85);src.connect(filter);filter.connect(n);n.connect(bus);src.start(t);src.stop(t+dur+.01);src.onended=()=>{src.disconnect();filter.disconnect();n.disconnect();};
 }
 async function setHidden(value){hidden=value;if(!context)return;if(hidden){for(const lane of ['announcer','intro','ko','result','preview'])stopLane(lane);try{await context.suspend()}catch{}}else if(ready){try{await context.resume()}catch{}}notify();}
 async function dispose(){disposed=true;version++;for(const n of [...music,...shots]){try{n.source.stop()}catch{}}music.clear();shots.clear();decoded.clear();raw.clear();listeners.clear();try{await context?.close()}catch{}}
 return {get loading(){return loading;},unlock,setMusic,sting,synth,preload,stopLane,setHidden,dispose,subscribe(f){listeners.add(f);return()=>listeners.delete(f);},get snapshot(){return snapshot();},get enabled(){return settings.enabled;},get hasSettings(){return hasSettings;},setEnabled(v){settings.enabled=!!v;if(!settings.enabled)for(const lane of new Set([...shots].map(n=>n.lane)))stopLane(lane);volume();save();},setVolume(kind,v){if(!['bgm','sfx'].includes(kind))return;settings[kind]=clamp(v,settings[kind]);volume();save();},async retry(){if(stats.errors.includes('manifest')){loading=readManifest();if(!await loading)return false;}for(const id of stats.errors){decoding.delete(id);const t=tracks.get(id);for(const p of t?.sources||[])raw.delete(p);}stats.errors=[];return setMusic(desired,{force:true});}};
}
return {create,KEY};
});
