'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {create}=require('../public/audio-manager'),manifest=require('../public/audio/manifest.json');
const root=path.resolve(__dirname,'..'),turn=()=>new Promise(r=>setImmediate(r));
function setup({fetch,failOgg=false,storage}={}){
 const sources=[];let builds=0;
 class Param{constructor(){this.value=1}setValueAtTime(n){this.value=n}linearRampToValueAtTime(n){this.value=n}exponentialRampToValueAtTime(n){this.value=n}cancelAndHoldAtTime(){}cancelScheduledValues(){}}
 class Node{constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();}connect(){}disconnect(){}start(t=0){this.started=t;sources.push(this)}stop(t=0){this.endAt=t}}
 const context={currentTime:0,state:'suspended',sampleRate:24000,destination:{},createGain:()=>new Node(),createBufferSource:()=>new Node(),createOscillator:()=>new Node(),createBiquadFilter:()=>new Node(),createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)}),async resume(){this.state='running'},async suspend(){this.state='suspended'},async close(){this.state='closed'},async decodeAudioData(b){if(failOgg&&new TextDecoder().decode(b).includes('.ogg'))throw Error('unsupported codec');return {duration:2,length:48000,numberOfChannels:2}},advance(t){this.currentTime+=t;for(const n of sources)if(n.endAt<=this.currentTime&&!n.ended){n.ended=true;n.onended?.()}}};
 const requests=[];const fetcher=fetch|| (async p=>{requests.push(p);return {ok:true,arrayBuffer:async()=>new TextEncoder().encode(p).buffer}});
 const data=new Map();const store=storage||{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 const a=create({manifest,fetch:fetcher,storage:store,contextFactory:()=>{builds++;return context}});return {a,context,requests,data,get builds(){return builds}};
}
test('all 21 supplied audio/MIDI originals are preserved and 42 runtime codec files match their manifest',()=>{
 const audit=require('../assets/source-audio/ost/asset-manifest.json');assert.equal(manifest.tracks.length,21);assert.equal(manifest.tracks.filter(t=>t.kind==='bgm'&&t.loop).length,12);assert.equal(manifest.tracks.filter(t=>t.kind==='sting'&&!t.loop).length,9);
 for(const record of audit.tracks){for(const key of ['originalAudio','midi','ogg','aac']){const a=record[key],raw=fs.readFileSync(path.join(root,a.path));assert.equal(raw.length,a.bytes);assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),a.sha256);}
 assert.equal(record.originalAudio.sha256,record.ogg.sha256);assert.equal(fs.readFileSync(path.join(root,record.midi.path)).toString('ascii',0,4),'MThd');const track=manifest.tracks.find(t=>t.id===record.id);for(const src of track.sources)assert.ok(fs.existsSync(path.join(root,'public',src)));}
});
test('audio stays locked until interaction and repeated render requests never restart the same loop',async()=>{
 const s=setup(),{a,context}=s;await a.setMusic('menu');assert.equal(s.builds,0);assert.equal(a.snapshot.musicStarts,0);await a.unlock();await turn();await turn();assert.equal(a.snapshot.current,'menu');
 for(let i=0;i<100;i++)await a.setMusic('menu');assert.equal(s.builds,1);assert.equal(a.snapshot.musicStarts,1);assert.equal(a.snapshot.activeBgm,1);
 await a.setMusic('character_select');assert.equal(a.snapshot.musicStarts,2);context.advance(.4);assert.equal(a.snapshot.activeBgm,1);await a.dispose();assert.equal(context.state,'closed');
});
test('a slow previous scene load cannot override the latest selected music',async()=>{
 let release;const pending=new Promise(r=>release=r);const s=setup({fetch:async p=>{if(p.includes('01-main'))await pending;return{ok:true,arrayBuffer:async()=>new TextEncoder().encode(p).buffer}}});await s.a.setMusic('menu');await s.a.unlock();await s.a.setMusic('character_select');release();await turn();await turn();assert.equal(s.a.snapshot.current,'character_select');assert.equal(s.a.snapshot.musicStarts,1);await s.a.dispose();
});
test('codec failures use AAC once; terminal failures do not retry on every render and explicit retry recovers',async()=>{
 const s=setup({failOgg:true});await s.a.setMusic('menu');await s.a.unlock();await turn();await turn();assert.equal(s.a.snapshot.current,'menu');assert.ok(s.a.snapshot.sourceFallbacks>=1);await s.a.dispose();
 let fail=true,count=0;const q=setup({fetch:async p=>{if(p.includes('01-main')){count++;if(fail)return{ok:false}}return{ok:true,arrayBuffer:async()=>new TextEncoder().encode(p).buffer}}});await q.a.setMusic('menu');await q.a.unlock();await turn();await turn();for(let i=0;i<20;i++)await q.a.setMusic('menu');assert.equal(count,2);assert.ok(q.a.snapshot.errors.includes('menu'));fail=false;await q.a.retry();assert.equal(q.a.snapshot.current,'menu');await q.a.dispose();
});
test('one-shot event keys deduplicate concurrent requests; stopped lanes cancel pending decodes',async()=>{
 const s=setup();await s.a.unlock();await turn();await Promise.all([s.a.sting('ko',{key:'match:round:1',lane:'ko'}),s.a.sting('ko',{key:'match:round:1',lane:'ko'})]);assert.equal(s.a.snapshot.played.filter(p=>p.id==='ko').length,1);s.context.advance(3);assert.equal(s.a.snapshot.activeSfx,0);
 const pending=s.a.sting('victory',{key:'late',lane:'result'});s.a.stopLane('result');await pending;assert.equal(s.a.snapshot.played.filter(p=>p.id==='victory').length,0);await s.a.dispose();
});
test('independent volumes persist and muting/background suspension does not restart music',async()=>{
 const s=setup();await s.a.setMusic('menu');await s.a.unlock();await turn();await turn();s.a.setVolume('bgm',.2);s.a.setVolume('sfx',.4);assert.equal(s.a.snapshot.bgm,.2);assert.equal(s.a.snapshot.sfx,.4);s.a.setEnabled(false);s.a.setEnabled(true);await s.a.setHidden(true);assert.equal(s.context.state,'suspended');await s.a.setHidden(false);assert.equal(s.context.state,'running');assert.equal(s.a.snapshot.musicStarts,1);const settings=JSON.parse(s.data.get('azhi_audio_v1'));assert.deepEqual(settings,{enabled:true,bgm:.2,sfx:.4});await s.a.dispose();
});

test('blocked storage and unsupported Web Audio fail silently without changing the selected scene',async()=>{
 const a=create({manifest,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}),storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}},contextFactory(){throw Error('unavailable')}});await a.setMusic('menu');assert.equal(await a.unlock(),false);assert.equal(a.snapshot.ready,false);assert.equal(a.snapshot.desired,'menu');a.setVolume('bgm',.4);assert.equal(a.snapshot.bgm,.4);await a.dispose();
});
test('failed manifest can be retried and starts the remembered scene without a page reload',async()=>{
 let available=false;const s=setup();const a=create({storage:{getItem:()=>null,setItem(){}},contextFactory:()=>s.context,fetch:async p=>p.startsWith('audio/manifest')?{ok:available,json:async()=>manifest}:{ok:true,arrayBuffer:async()=>new TextEncoder().encode(p).buffer}});await a.loading;await a.setMusic('menu');assert.equal(a.snapshot.desired,'menu');assert.ok(a.snapshot.errors.includes('manifest'));await a.unlock();available=true;await a.retry();assert.equal(a.snapshot.tracks.length,21);assert.equal(a.snapshot.current,'menu');assert.equal(a.snapshot.errors.length,0);await a.dispose();await s.a.dispose();
});
