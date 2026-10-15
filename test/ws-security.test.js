'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {WebSocket}=require('ws');
process.env.HOST='127.0.0.1';
process.env.PORT='0';
const {server,wss,rooms}=require('../server.js');
const VERSION=require('../package.json').version;

// Use real loopback WebSockets: a bad message must survive JSON parsing, socket
// dispatch, room admission and match creation without terminating the process.
test('real WebSocket admission and spectator security boundaries',async t=>{
 if(!server.listening)await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 const clients=[];
 t.after(async()=>{
  for(const client of clients)client.ws.terminate();
  for(const ws of wss.clients)ws.terminate();
  await new Promise(resolve=>server.close(resolve));
  wss.close();
 });
 async function connect(){
  const ws=new WebSocket(base.replace('http:','ws:')+'/ws');
  const messages=[];
  ws.on('message',data=>messages.push(JSON.parse(data)));
  await once(ws,'open');
  const client={ws,messages,send:msg=>ws.send(JSON.stringify(msg)),count:type=>messages.filter(m=>m.type===type).length};
  client.wait=async(type,after=0)=>{
   const matching=()=>messages.filter(m=>m.type===type)[after];
   if(matching())return matching();
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.off('message',check);reject(new Error(`Timed out waiting for ${type}`))},3000);
    const check=()=>{const found=matching();if(found){clearTimeout(timer);ws.off('message',check);resolve(found)}};
    ws.on('message',check);check();
   });
  };
  client.fence=async()=>{const sentAt=Date.now()+Math.random(),n=client.count('pong');client.send({type:'ping',sentAt});assert.equal((await client.wait('pong',n)).sentAt,sentAt)};
  clients.push(client);return client;
 }
 async function join(client,room,char='azhi',mode='duel',name,title){
  const n=client.count('joined');client.send({type:'join',room,char,mode,name,title});return client.wait('joined',n);
 }
 async function start(players,room){for(const p of players){p.send({type:'set_ready',ready:true});await p.fence();}players[0].send({type:'start_match',revision:rooms.get(room).revision});await players[0].fence();}
 async function rejected(client,message){
  const n=client.count('error');client.send(message);await client.wait('error',n);await client.fence();
 }

 await t.test('malformed character types do not coerce keys, allocate rooms or crash',async()=>{
  const bad=await connect(),before=rooms.size;
  for(const char of [null,true,42,[],{}, {toString:null,valueOf:null}]){
   await rejected(bad,{type:'join',room:'BADCHAR',char});
   assert.equal(rooms.size,before);assert.equal(rooms.has('BADCHAR'),false);
  }
  bad.ws.send('{not json');bad.ws.send('[]');bad.ws.send('null');await bad.fence();
  const health=await fetch(base+'/healthz').then(response=>response.json());
  assert.equal(health.ok,true);assert.equal(health.version,VERSION);
 });

 await t.test('prototype keys and retired Sam resolve to a real safe character',async()=>{
  const a=await connect(),b=await connect();
  for(const [index,char] of ['constructor','__proto__','toString','hasOwnProperty','sam'].entries()){
   const room=`SAFE${index}`;await join(a,room,char);await join(b,room,char);
   await start([a,b],room);const live=rooms.get(room);assert.ok(live.session);
   assert.deepEqual(live.players.map(p=>p.char),['azhi','azhi']);
   assert.deepEqual(live.session.game.players.map(p=>p.char),['azhi','azhi']);
   a.send({type:'leave'});b.send({type:'leave'});await a.fence();await b.fence();
  }
 });

 await t.test('invalid join/watch transfers preserve membership and the running match',async()=>{
  const a=await connect(),b=await connect(),x=await connect(),y=await connect();
  await join(a,'ORIGINAL','azhi','duel','原房房主');await join(b,'ORIGINAL','sezi','duel','原房選手',null); // Existing main UI sends title:null when joining.
  await join(x,'FULLROOM','winnie','duel','目標房主');await join(y,'FULLROOM','gambler','duel','目標選手');
  await start([a,b],'ORIGINAL');await start([x,y],'FULLROOM');
  const original=rooms.get('ORIGINAL'),session=original.session;
  for(const request of [
   {type:'join',room:'FULLROOM',char:'azhi'},
   {type:'join',room:'FULLROOM',mode:'team',char:'azhi'},
   {type:'join',room:'NEWROOM',char:{toString:null}},
   {type:'join',room:'NEWROOM',char:'azhi',name:'<script>'},
   {type:'join',room:'NEWROOM',char:'azhi',title:42},
   {type:'join',room:{id:'NEWROOM'},char:'azhi'},
   {type:'join',room:'NEWROOM',mode:'invalid'},
   {type:'watch',room:'MISSING'},
   {type:'watch',room:'FULLROOM',name:'<script>'},
   {type:'watch',room:'FULLROOM',name:'目標房主'},
   {type:'watch',room:null}
  ]){
   await rejected(a,request);
   assert.equal(rooms.get('ORIGINAL'),original);assert.equal(original.session,session);
   assert.equal(original.players.length,2);assert.equal(original.hostWs,original.players[0].ws);
   assert.equal(a.count('peer_left'),0);assert.equal(b.count('peer_left'),0);
   assert.equal(rooms.has('NEWROOM'),false);
  }
  // A successful transfer still follows the existing disconnect/cancel flow.
  const n=a.count('joined');a.send({type:'watch',room:'FULLROOM',name:'安全觀眾'});await a.wait('joined',n);
  await b.wait('peer_left');assert.equal(original.session,null);
  assert.equal(rooms.get('FULLROOM').spectators.size,1);
 });

 await t.test('2v2 retains four players; spectators cannot submit inputs or change host state',async()=>{
  const players=await Promise.all(Array.from({length:4},()=>connect()));
  for(const [index,player] of players.entries())await join(player,'TEAMSAFE',['azhi','winnie','sezi','gambler'][index],'team');
  await start(players,'TEAMSAFE');await players[0].wait('start');
  const room=rooms.get('TEAMSAFE'),session=room.session,matchId=room.matchId;
  const watcher=await connect();watcher.send({type:'watch',room:'TEAMSAFE',name:'唯讀觀眾'});
  await watcher.wait('watch_start');await watcher.wait('watch_frame');
  watcher.send({type:'input',matchId,frame:session.frame+5,keys:{heavy:true},pulses:['super']});
  watcher.send({type:'rematch'});await rejected(watcher,{type:'set_title',title:'非法接管房'});
  assert.equal(session.inputs.reduce((sum,input)=>sum+input.size,0),0);
  assert.equal(room.rematchVotes.size,0);assert.equal(watcher.count('frames'),0);
  assert.equal(room.players.length,4);assert.equal(room.session,session);
  const outsider=await connect();await join(outsider,'OUTSIDE');
  const outside=rooms.get('OUTSIDE');await rejected(outsider,{type:'join',room:'TEAMSAFE',mode:'team'});
  assert.equal(rooms.get('OUTSIDE'),outside);assert.equal(outside.players.length,1);
  // Fill all 24 observer seats, then verify failed transfers remain atomic too.
  for(let index=1;index<24;index++){
   const observer=await connect();observer.send({type:'watch',room:'TEAMSAFE'});await observer.wait('joined');
  }
  await rejected(outsider,{type:'watch',room:'TEAMSAFE'});
  assert.equal(outside.players.length,1);assert.equal(room.spectators.size,24);
  watcher.send({type:'leave'});await watcher.fence();
  assert.equal(room.spectators.size,23);assert.equal(room.session,session);
  assert.equal(room.players.length,4);
 });
});
