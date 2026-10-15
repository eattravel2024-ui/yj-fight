'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const Module=require('node:module'),http=require('node:http');
class FakeSocket extends EventEmitter{
 static OPEN=1;
 constructor(){super();this.readyState=1;this.bufferedAmount=0;this.sent=[];this.record=null;}
 send(raw){this.sent.push(JSON.parse(raw))}
 ping(){this.emit('pong')}
 close(){if(this.readyState!==1)return;this.readyState=3;this.emit('close')}
 terminate(){this.close()}
 incoming(obj){this.emit('message',Buffer.from(JSON.stringify(obj)))}
 last(type){return this.sent.filter(x=>x.type===type).at(-1)}
}
class FakeWSS extends EventEmitter{constructor(){super();this.clients=new Set();FakeWSS.instance=this}handleUpgrade(){}}
const originalLoad=Module._load,originalCreate=http.createServer;
Module._load=function(id,...args){if(id==='ws')return {WebSocketServer:FakeWSS,WebSocket:FakeSocket};return originalLoad.call(this,id,...args)};
http.createServer=function(...args){const s=originalCreate.apply(this,args);FakeWSS.http=s;return s};
process.env.PORT='0';process.env.HOST='127.0.0.1';
const {rooms,cleanLabel}=require('../server.js');Module._load=originalLoad;http.createServer=originalCreate;
const srv=FakeWSS.http,wss=FakeWSS.instance;
function connect(){const a=new FakeSocket();wss.clients.add(a);wss.emit('connection',a);return a}
async function done(){for(const ws of wss.clients)ws.close();await new Promise(resolve=>srv.close(resolve))}
test('8.6 player names, room title, spectator identity and XSS protection', async()=>{
 srv.unref();try{
  assert.equal(cleanLabel(' 海線 王  '),'海線 王');assert.equal(cleanLabel('<script>'),null);
  assert.equal(cleanLabel('系統'),null);assert.equal(cleanLabel('a'),null);assert.equal(cleanLabel('a'.repeat(17)),null);
  assert.equal(cleanLabel('逢甲格鬥賽',24),'逢甲格鬥賽');
  const bad=connect();bad.incoming({type:'join',mode:'team',room:'BADNAME1',name:'<svg/onload=1>'});
  assert.match(bad.last('error').message,/暱稱/);assert.equal(rooms.has('BADNAME1'),false,'malformed name does not allocate room');
  const a=connect();a.incoming({type:'join',mode:'team',room:'NAMETEST',name:'海線 王者',title:'逢甲冠軍賽',char:'gambler'});
  assert.equal(a.last('joined').name,'海線 王者');assert.equal(a.last('joined').host,true);
  assert.equal(a.last('roster').title,'逢甲冠軍賽');assert.equal(a.last('roster').players[0].name,'海線 王者');
  const b=connect();b.incoming({type:'join',mode:'team',room:'NAMETEST',name:'海線 王者',char:'azhi'});
  assert.match(b.last('error').message,/已被使用/);assert.equal(rooms.get('NAMETEST').players.length,1);
  b.incoming({type:'join',mode:'team',room:'NAMETEST',name:'第二位選手',char:'azhi'});
  assert.equal(b.last('joined').slot,1);
  b.incoming({type:'set_title',title:'我來接管'});assert.match(b.last('error').message,/房主/);
  a.incoming({type:'set_title',title:'決戰台中港'});assert.equal(b.last('roster').title,'決戰台中港');
  b.incoming({type:'set_name',name:'新的拳王'});assert.equal(a.last('roster').players[1].name,'新的拳王');
  const old=connect();old.incoming({type:'join',mode:'team',room:'NAMETEST',char:'sezi'});
  assert.equal(old.last('joined').name,'選手3','legacy clients without a name receive a safe fallback');
  const d=connect();d.incoming({type:'join',mode:'team',room:'NAMETEST',char:'winnie',name:'第四名選手'});
  for(const player of [a,b,old,d])player.incoming({type:'set_ready',ready:true});
  a.incoming({type:'start_match',revision:a.last('roster').revision});
  assert.equal(d.last('start').game.players.length,4,'names never change rollback player count');
  assert.equal(JSON.stringify(d.last('start').game).includes('第四名選手'),false,'identity not embedded in deterministic gameplay snapshots');
  const v=connect();v.incoming({type:'watch',room:'NAMETEST',name:'觀戰小王'});
  assert.equal(v.last('joined').name,'觀戰小王');assert.deepEqual(a.last('roster').spectators,[{name:'觀戰小王'}]);
  v.incoming({type:'set_name',name:'觀眾王'});assert.deepEqual(a.last('roster').spectators,[{name:'觀眾王'}]);
  v.incoming({type:'set_title',title:'非法改名'});assert.match(v.last('error').message,/房主/);
  v.close();assert.equal(a.last('roster').spectators.length,0);
  a.close();assert.equal(b.last('roster').players.find(x=>x.slot===1).host,true,'room ownership transfers on disconnect');
  const duel=connect();duel.incoming({type:'join',mode:'duel',room:'DUEL86',name:'單挑大師',title:'單挑冠軍房'});
  assert.equal(duel.last('joined').title,'單挑冠軍房');duel.incoming({type:'set_title',title:'夜市挑戰室'});
  assert.equal(duel.last('roster').title,'夜市挑戰室');
 }finally{await done()}
});
test('8.6 naming UI includes forms and safe text insertion',()=>{
 const fs=require('node:fs'),path=require('node:path');const base=path.join(__dirname,'../public');
 const team=fs.readFileSync(path.join(base,'team.html'),'utf8'),ui=fs.readFileSync(path.join(base,'team.js'),'utf8');
 const home=fs.readFileSync(path.join(base,'index.html'),'utf8'),game=fs.readFileSync(path.join(base,'game.js'),'utf8');
 for(const id of ['playerNickname','roomTitleInput','roomTitleDisplay','applyNickname','applyRoomTitle','spectatorNames'])assert.ok(team.includes(`id="${id}"`),id);
 for(const id of ['onlineNickname','updateOnlineNickname','onlineNames','onlineRoomTitle','updateOnlineRoomTitle','onlineRoomTitleDisplay'])assert.ok(home.includes(`id="${id}"`),id);
 assert.match(ui,/nameChange\(\)/);assert.match(ui,/titleChange\(\)/);assert.match(ui,/name\.textContent=/);
 assert.match(game,/updateOnlineRoster\(/);assert.match(game,/mode==='online'/);
});
