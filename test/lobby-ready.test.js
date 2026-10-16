'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events'),WS=require('ws');
process.env.PORT='0';process.env.HOST='127.0.0.1';
const {server,wss,rooms}=require('../server');
test('Ready is authoritative for 1v1 and 2v2, with explicit host start and membership invalidation',async t=>{
 if(!server.listening)await once(server,'listening');const sockets=[];
 t.after(async()=>{for(const s of sockets)s.terminate();await new Promise(r=>server.close(r));wss.close();});
 async function connect(){const ws=new WS(`ws://127.0.0.1:${server.address().port}/ws`);ws.messages=[];ws.on('message',d=>ws.messages.push(JSON.parse(d)));await once(ws,'open');sockets.push(ws);return ws;}
 async function send(ws,msg){const n=ws.messages.length;ws.send(JSON.stringify(msg));const stamp=Date.now()+Math.random();ws.send(JSON.stringify({type:'ping',sentAt:stamp}));if(!ws.messages.some(m=>m.type==='pong'&&m.sentAt===stamp))await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('fence timeout')),2500);function check(){if(ws.messages.some(m=>m.type==='pong'&&m.sentAt===stamp)){clearTimeout(timer);ws.off('message',check);resolve();}}ws.on('message',check);check();});return ws.messages.slice(n);}
 // Explicit custom-room intents must not turn a mistyped join into room creation.
 const creator=await connect(),guest=await connect(),probe=await connect(),initial=rooms.size;
 assert.ok((await send(probe,{type:'join',room:'MISSING',intent:'join'})).some(m=>m.type==='error'));
 assert.equal(rooms.size,initial);
 assert.ok((await send(probe,{type:'join',intent:{}})).some(m=>m.type==='error'));assert.equal(rooms.size,initial);
 await send(creator,{type:'join',room:'EXPLICIT',intent:'create',char:'azhi'});assert.ok(rooms.has('EXPLICIT'));
 assert.ok((await send(probe,{type:'join',room:'EXPLICIT',intent:'create'})).some(m=>m.type==='error'));assert.equal(rooms.get('EXPLICIT').players.length,1);
 await send(guest,{type:'join',room:'EXPLICIT',intent:'join',char:'winnie'});assert.equal(rooms.get('EXPLICIT').players.length,2);
 assert.ok((await send(creator,{type:'join',room:'MISSING',intent:'join'})).some(m=>m.type==='error'));assert.equal(rooms.get('EXPLICIT').players.length,2,'rejected transfer retains current membership');
 await send(creator,{type:'leave'});await send(guest,{type:'leave'});
 for(const count of [2,4]){
  const id='READY'+count,mode=count===4?'team':'duel',actors=[];
  for(let i=0;i<count;i++){const p=await connect();actors.push(p);await send(p,{type:'join',room:id,mode,char:['azhi','winnie','sezi','gambler'][i]});}
  const room=rooms.get(id);assert.equal(room.session,null);assert.equal(actors[0].messages.some(m=>m.type==='start'),false);
  const spectator=await connect();await send(spectator,{type:'watch',room:id});
  assert.ok((await send(spectator,{type:'set_ready',ready:true})).some(m=>m.type==='error'));
  assert.ok((await send(actors[0],{type:'select_character',char:{toString:null}})).some(m=>m.type==='error'));
  assert.ok((await send(actors[0],{type:'select_character',char:'__proto__'})).some(m=>m.type==='error'));
  assert.ok((await send(actors[0],{type:'set_ready',ready:'yes'})).some(m=>m.type==='error'));
  assert.ok((await send(actors[0],{type:'start_match',revision:room.revision})).some(m=>m.type==='error'));
  for(const p of actors)await send(p,{type:'set_ready',ready:true});
  const stale=room.revision;await send(actors[1],{type:'select_character',char:'gambler'});
  assert.ok(room.players.every(p=>!p.ready));assert.equal(room.players[1].char,'gambler');
  for(const p of actors)await send(p,{type:'set_ready',ready:true});
  assert.ok((await send(actors[1],{type:'start_match',revision:room.revision})).some(m=>m.type==='error'));
  assert.ok((await send(actors[0],{type:'start_match',revision:stale})).some(m=>m.type==='error'));
  await send(actors[0],{type:'start_match',revision:room.revision});assert.ok(room.session);assert.equal(actors[0].messages.filter(m=>m.type==='start').length,1);
  assert.ok((await send(actors[0],{type:'set_ready',ready:false})).some(m=>m.type==='error'));
  await send(actors[0],{type:'start_match',revision:room.revision});assert.equal(actors[0].messages.filter(m=>m.type==='start').length,1);
  await send(actors[0],{type:'leave'});assert.equal(room.session,null);assert.ok(room.players.every(p=>!p.ready));assert.equal(room.hostWs,room.players[0].ws);
  if(count===2)assert.equal(actors[1].messages.filter(m=>m.type==='seat_updated').at(-1)?.slot,0);
  const replacement=await connect();await send(replacement,{type:'join',room:id,mode,char:'azhi'});
  const remaining=[...actors.slice(1),replacement];assert.ok(room.players.every(p=>!p.ready));
  for(const p of remaining)await send(p,{type:'set_ready',ready:true});
  await send(remaining[0],{type:'start_match',revision:room.revision});assert.ok(room.session);
  assert.deepEqual(room.players.map(p=>p.slot).sort(),Array.from({length:count},(_,i)=>i));
  for(const p of remaining)await send(p,{type:'leave'});await send(spectator,{type:'leave'});
 }
});
