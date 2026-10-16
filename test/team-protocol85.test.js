'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const Module=require('node:module'),http=require('node:http');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class FakeSocket extends EventEmitter{
 static OPEN=1;
 constructor(){super();this.readyState=1;this.bufferedAmount=0;this.sent=[];this.record=null;}
 send(raw){this.sent.push(JSON.parse(raw));}
 ping(){this.emit('pong')}
 close(){if(this.readyState!==1)return;this.readyState=3;this.emit('close')}
 terminate(){this.close()}
 incoming(message){this.emit('message',Buffer.from(JSON.stringify(message)));return this.messageChain;}
 get(type){return this.sent.filter(m=>m.type===type)}
}
class FakeWSS extends EventEmitter{
 constructor(){super();this.clients=new Set();FakeWSS.instance=this}
 handleUpgrade(){}
}
const originalLoad=Module._load,createServer=http.createServer;
Module._load=function(name,...args){if(name==='ws')return {WebSocketServer:FakeWSS,WebSocket:FakeSocket};return originalLoad.call(this,name,...args)};
http.createServer=function(...args){const s=createServer.apply(this,args);FakeWSS.http=s;return s};
process.env.PORT='0';process.env.HOST='127.0.0.1';
const {rooms}=require('../server.js');Module._load=originalLoad;http.createServer=createServer;
const wss=FakeWSS.instance,server=FakeWSS.http;
function connect(){const ws=new FakeSocket();wss.clients.add(ws);wss.emit('connection',ws);return ws}
async function stop(){for(const ws of wss.clients)ws.close();await new Promise(resolve=>server.close(resolve))}
test('four fighters + spectators + readonly late join + no side effects on spectator leave',async()=>{
 server.unref();
 try{
  const actors=[connect(),connect(),connect(),connect()];
  const roster=['azhi','winnie','sezi','gambler'];
  for(let i=0;i<4;i++)await actors[i].incoming({type:'join',mode:'team',room:'HAIXIAN',char:roster[i]});
  for(const player of actors)await player.incoming({type:'set_ready',ready:true});
  await actors[0].incoming({type:'start_match',revision:actors[0].get('roster').at(-1).revision});
  assert.deepEqual(actors.map(ws=>ws.get('joined')[0].slot),[0,1,2,3]);
  assert.equal(actors[0].get('start').length,1);assert.equal(actors[3].get('start')[0].game.players.length,4);
  assert.equal(actors[0].get('start')[0].game.ruleset,'team');
  const spectator=connect();await spectator.incoming({type:'watch',room:'HAIXIAN'});
  assert.equal(spectator.get('joined')[0].role,'spectator');assert.equal(spectator.get('joined')[0].slot,-1);
  assert.equal(spectator.get('watch_start')[0].game.players.length,4);
  const full=connect();await full.incoming({type:'join',mode:'team',room:'HAIXIAN',char:'azhi'});
  assert.match(full.get('error')[0].message,/已滿/);
  const start=actors[0].get('start')[0];const matchId=start.matchId;
  await wait(520);
  assert.ok(spectator.get('watch_frame').length>=4,'spectators receive live read-only frames');
  assert.equal(spectator.get('frames').length,0,'spectator must not get player rollback input rows');
  const live=spectator.get('watch_frame').at(-1);assert.ok(live.serverFrame>10);
  assert.equal(live.game.players.length,4);
  await spectator.incoming({type:'input',matchId,frame:live.serverFrame+2,keys:{heavy:true},pulses:['super']});
  await spectator.incoming({type:'rematch'});
  assert.equal(spectator.get('rematch_status').length,0,'spectator cannot vote');
  const outsider=connect();await outsider.incoming({type:'watch',room:'INVALID1'});assert.ok(outsider.get('error').length);
  const before=actors[0].get('frames').length;
  spectator.close();await wait(170);
  assert.ok(actors[0].get('frames').length>before,'spectator leaving must not interrupt active 2v2 game');
  assert.equal(actors[0].get('spectator_count').at(-1).count,0);
  const check=await fetch('http://127.0.0.1:'+server.address().port+'/healthz').then(r=>r.json());
  assert.equal(check.version,require('../package.json').version);assert.ok(check.teamRooms>=1);
  const page=await fetch('http://127.0.0.1:'+server.address().port+'/team.html');assert.equal(page.status,200);
  assert.match(await page.text(),/四人同場/);
  const liveRoom=rooms.get('HAIXIAN');assert.ok(liveRoom.session);
  liveRoom.session.game.status='finished';liveRoom.session.game.winnerTeam=0;
  await wait(700);assert.equal(liveRoom.completed,true);assert.equal(actors[0].get('match_complete').length,1);
  const watching=connect();await watching.incoming({type:'watch',room:'HAIXIAN'});
  assert.equal(watching.get('watch_wait').length,1,'joining after a completed match waits for rematch');
  await actors[0].incoming({type:'rematch'});assert.equal(actors[0].get('rematch_status').at(-1).votes,1);
  await watching.incoming({type:'rematch'});assert.equal(actors[0].get('rematch_status').at(-1).votes,1,'observer cannot vote');
  await actors[1].incoming({type:'rematch'});await actors[2].incoming({type:'rematch'});
  assert.equal(actors[0].get('start').length,1,'only three out of four votes cannot restart');
  await actors[3].incoming({type:'rematch'});assert.equal(actors[0].get('start').length,1,'all ready still needs host start');
  await actors[0].incoming({type:'start_match',revision:actors[0].get('roster').at(-1).revision});assert.equal(actors[0].get('start').length,2,'host starts ready rematch');
  assert.equal(watching.get('watch_start').length,1,'spectator is carried into the next match');
  actors[2].close();assert.ok(actors[0].get('peer_left').length);assert.equal(actors[0].get('start').length,2);
 }finally{await stop()}
});
