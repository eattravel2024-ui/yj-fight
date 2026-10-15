'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const Module=require('node:module');
const http=require('node:http');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class FakeSocket extends EventEmitter {
 static OPEN=1;
 constructor(){super();this.readyState=1;this.bufferedAmount=0;this.sent=[];this.record=null;}
 send(raw){this.sent.push(JSON.parse(raw))}
 ping() { this.emit('pong') }
 close(){this.readyState=3;this.emit('close')}
 terminate(){this.close()}
 sendToServer(msg){this.emit('message',Buffer.from(JSON.stringify(msg)))}
 find(type){return this.sent.filter(x=>x.type===type)}
}
class FakeWSS extends EventEmitter {
 constructor(){super();this.clients=new Set();FakeWSS.instance=this;}
 handleUpgrade(){}
}
const originalLoad=Module._load;
const originalCreateServer=http.createServer;
Module._load=function(name,...args){if(name==='ws')return {WebSocketServer:FakeWSS,WebSocket:FakeSocket};return originalLoad.call(this,name,...args)};
http.createServer=function(...args){const server=originalCreateServer.apply(this,args);FakeWSS.http=server;return server};
process.env.PORT='0';process.env.HOST='127.0.0.1';
require('../server.js');
Module._load=originalLoad;http.createServer=originalCreateServer;
test('room-to-room rollback protocol: join, frame IDs, late corrections, checkpoint hashes',async()=>{
 const wss=FakeWSS.instance;
 const closeServer=()=>new Promise(resolve=>FakeWSS.http.close(resolve));
 // Ensure we always close the listener even if an assertion fails.
 FakeWSS.http.unref();
 const a=new FakeSocket(),b=new FakeSocket();
 wss.clients.add(a);wss.clients.add(b);
 wss.emit('connection',a);wss.emit('connection',b);
 a.sendToServer({type:'join',room:'ROLL84',char:'azhi'});
 b.sendToServer({type:'join',room:'ROLL84',char:'winnie'});
 assert.equal(a.find('joined').length,1);assert.equal(b.find('joined')[0].slot,1);
 assert.equal(a.find('start').length,1);assert.equal(b.find('start').length,1);
 const matchId=a.find('start')[0].matchId;
 assert.equal(a.find('start')[0].serverHz,60);
 await sleep(610);
 const frames=a.find('frames');assert.ok(frames.length>=12,`got ${frames.length}`);
 const current=frames.at(-1).serverFrame;
 assert.ok(current>=20);
 const cp=frames.find(x=>x.checkpoint);
 assert.ok(cp&&cp.checkpoint.hash);
 const nBefore=a.find('frames').length;
 a.sendToServer({type:'input',matchId,frame:current-4,keys:{right:true},pulses:['light']});
 await sleep(100);
 const after=a.find('frames').at(-1);
 assert.ok(after.serverRollbacks>=1,'server rewound on late frame input');
 assert.ok(a.find('frames').slice(nBefore).some(x=>x.checkpoint),'late correction includes full authoritative checkpoint');
 assert.ok(a.find('frames').slice(nBefore).some(x=>x.rows.some(r=>r.frame===current-4 && r.real[0]===true)),'confirmed input present');
 const oldCount=after.serverRollbacks;
 a.sendToServer({type:'input',matchId,frame:current-4,keys:{left:true},pulses:['super']});
 await sleep(70);
 assert.equal(a.find('frames').at(-1).serverRollbacks,oldCount,'cannot replace already accepted authoritative input');
 a.sendToServer({type:'ping',sentAt:17.5});assert.equal(a.find('pong').at(-1).sentAt,17.5);
 b.close();a.close();wss.clients.clear();
 await closeServer();
});
