'use strict';
/** 阿志向錢衝 8.4：60Hz 伺服器權威回滾 + 輸入影格同步 + 狀態校驗 */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');
const Combat=require('./public/core.js');
const Rollback=require('./public/rollback.js');
const Team=require('./public/team-core.js');
const VERSION=require('./package.json').version;
const PORT=Number(process.env.PORT||31071);
const HOST=process.env.HOST||'127.0.0.1';
const ROOT=path.resolve(__dirname,'public');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const ROOM_LIMIT=200,CLIENT_LIMIT=500,SPECTATOR_LIMIT=24,SNAPSHOT_DIVISOR=process.env.AZHI_SNAPSHOT_HZ==='60'?1:2;
const FRAME_NS=BigInt(Math.round(1e9/Combat.FPS));
const rooms=new Map();
let connections=0;
// Presentation-only identity: never place names/titles inside rollback simulation snapshots.
const LABEL=/^[\p{L}\p{N} _.-]+$/u;
const RESERVED=/^(admin|administrator|moderator|staff|system|官方|管理員|系統|客服)$/iu;
function cleanLabel(value,max=16){
 if(typeof value!=='string')return null;
 const name=value.normalize('NFKC').trim().replace(/\s+/gu,' ');
 const size=Array.from(name).length;
 return size>=2&&size<=max&&LABEL.test(name)&&!RESERVED.test(name)?name:null;
}
function nameTaken(room,name,self){return [...room.players,...[...room.spectators].map(ws=>({name:ws.displayName,ws}))].some(p=>p.ws!==self&&p.name.toLocaleLowerCase()===name.toLocaleLowerCase())}
function roomSummary(room){return {title:room.title,players:room.players.map(p=>({slot:p.slot,team:p.slot%2,char:p.char,name:p.name,host:p.ws===room.hostWs})),spectators:[...room.spectators].map(ws=>({name:ws.displayName}))}}

function send(ws,msg){if(ws.readyState!==WebSocket.OPEN)return; if(ws.bufferedAmount>1024*1024){ws.terminate();return}ws.send(JSON.stringify(msg))}
function group(room,msg){for(const p of room.players)send(p.ws,msg)}
function audience(room,msg){for(const ws of room.spectators||[])send(ws,msg)}
function all(room,msg){group(room,msg);audience(room,msg)}
function compactGame(room){const engine=room.mode==='team'?Team:Combat;return engine.serialize(Rollback.clone(room.session.game))}
function newCode(){let s;do{s=crypto.randomBytes(4).toString('hex').toUpperCase()}while(rooms.has(s));return s}
function roomRoster(room){all(room,{type:'roster',mode:room.mode,needed:room.maxPlayers,...roomSummary(room)})}
function begin(room){
 const sorted=[...room.players].sort((a,b)=>a.slot-b.slot);room.rematchVotes=new Set();room.completed=false;
 room.matchId=crypto.randomBytes(8).toString('hex');room.finishingSince=null;room.playerEventBuffer=[];room.watchEventBuffer=[];
 const opts={stage:['night','garage','harbor'][crypto.randomInt(3)],seed:crypto.randomInt(1,2**31)};
 room.session=new Rollback.Session(room.mode==='team'?Team.create(sorted.map(p=>p.char),opts):Combat.create(sorted[0].char,sorted[1].char,opts));
 room.game=room.session.game;
 roomRoster(room);
 group(room,{type:'start',mode:room.mode,matchId:room.matchId,frame:0,game:Rollback.clone(room.session.game),inputDelay:Rollback.INPUT_DELAY,rollbackWindow:Rollback.WINDOW,serverHz:60});
 audience(room,{type:'watch_start',mode:room.mode,matchId:room.matchId,frame:0,game:compactGame(room)});
}
function leave(ws){
 const record=ws.record;ws.record=null;if(!record)return;
 const room=rooms.get(record.room);if(!room)return;
 room.lastActive=Date.now();
 if(record.role==='spectator'){
  room.spectators.delete(ws);roomRoster(room);all(room,{type:'spectator_count',count:room.spectators.size});
  if(!room.players.length&&!room.spectators.size)rooms.delete(room.id);return;
 }
 room.players=room.players.filter(p=>p.ws!==ws);
 if(room.hostWs===ws)room.hostWs=room.players[0]?.ws||null;
 room.game=null;room.session=null;room.finishingSince=null;room.completed=false;room.rematchVotes=new Set();
 if(room.mode==='duel'&&room.players.length===1)room.players[0].slot=0;
 for(const player of room.players)send(player.ws,{type:'peer_left',message:'有玩家離線，本場比賽已取消；等待新玩家加入。'});
 audience(room,{type:'watch_end',message:'玩家已離線，正在等待房間重新開賽。'});
 roomRoster(room);
 if(!room.players.length&&!room.spectators.size)rooms.delete(room.id);
}
const server=http.createServer((req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return}
 let u;try{u=new URL(req.url,'http://localhost')}catch{res.writeHead(400).end();return}
 if(u.pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify({ok:true,version:VERSION,serverHz:Combat.FPS,snapshotHz:Combat.FPS/SNAPSHOT_DIVISOR,netcode:'rollback-authoritative',rollbackWindow:Rollback.WINDOW,inputDelay:Rollback.INPUT_DELAY,rooms:rooms.size,clients:connections,teamRooms:[...rooms.values()].filter(r=>r.mode==='team').length,spectators:[...rooms.values()].reduce((n,r)=>n+(r.spectators?.size||0),0)}));return}
 let decoded;try{decoded=decodeURIComponent(u.pathname)}catch{res.writeHead(400).end();return}
 if(decoded.includes('\0')||decoded.includes('\\')){res.writeHead(400).end();return}
 const file=path.resolve(ROOT,'.'+(decoded==='/'?'/index.html':decoded));
 if(!file.startsWith(ROOT+path.sep)){res.writeHead(403).end();return}
 fs.stat(file,(err,st)=>{if(err||!st.isFile()){res.writeHead(404).end('Not found');return}
 const headers={'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Cache-Control':file.endsWith('.png')||file.endsWith('.webp')?'public, max-age=3600':'no-cache','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self' ws: wss:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
 res.writeHead(200,headers);if(req.method==='HEAD')return res.end();fs.createReadStream(file).on('error',()=>{if(!res.headersSent)res.writeHead(500);res.end()}).pipe(res)});
});
const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
server.on('upgrade',(req,socket,head)=>{let pathname;try{pathname=new URL(req.url,'http://localhost').pathname}catch{socket.destroy();return}if(pathname!=='/ws'||connections>=CLIENT_LIMIT){socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');socket.destroy();return}
 const origin=req.headers.origin;
 if(origin){try{const host=new URL(origin).host;if(host!==req.headers.host){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return}}catch{socket.destroy();return}}
 wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req))});
wss.on('connection',ws=>{
 connections++;ws.isAlive=true;ws.joinedAt=Date.now();ws.msgCount=0;ws.lastSecond=Date.now();
 ws.on('pong',()=>{ws.isAlive=true});
 ws.on('message',raw=>{const now=Date.now();if(now-ws.lastSecond>1000){ws.lastSecond=now;ws.msgCount=0}if(++ws.msgCount>160){ws.close(1008,'Rate limit');return}
  let msg;try{msg=JSON.parse(raw.toString())}catch{return}if(!msg||typeof msg!=='object'||Array.isArray(msg))return;
  if(msg.type==='watch'){
   if(typeof msg.room!=='string'){send(ws,{type:'error',message:'請提供有效房號'});return}
   const id=msg.room.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
   const room=rooms.get(id);
   if(!room){send(ws,{type:'error',message:'找不到房間，請確認房號後再觀戰'});return}
   if(room.spectators.size-(room.spectators.has(ws)?1:0)>=SPECTATOR_LIMIT){send(ws,{type:'error',message:'觀戰席已滿，請稍候'});return}
   let displayName=msg.name===undefined?`觀眾${room.spectators.size+1}`:cleanLabel(msg.name);
   if(msg.name===undefined){let i=room.spectators.size+1;while(nameTaken(room,displayName,ws))displayName=`觀眾${++i}`}
   if(!displayName){send(ws,{type:'error',message:'觀戰暱稱需 2–16 字，只能使用中英文字、數字、空格、底線、句點及連字號'});return}
   if(nameTaken(room,displayName,ws)){send(ws,{type:'error',message:'暱稱已被使用，請換一個'});return}
   // Rejected transfers keep the caller's current room and running match intact.
   leave(ws);rooms.set(id,room);
   ws.displayName=displayName;room.spectators.add(ws);ws.record={room:id,role:'spectator'};room.lastActive=now;
   send(ws,{type:'joined',room:id,role:'spectator',mode:room.mode,slot:-1,title:room.title,name:displayName});roomRoster(room);
   if(room.session)send(ws,{type:'watch_start',mode:room.mode,matchId:room.matchId,frame:room.session.frame,game:compactGame(room)});
   else send(ws,{type:'watch_wait',mode:room.mode,completed:room.completed});
   all(room,{type:'spectator_count',count:room.spectators.size});return;
  }
  if(msg.type==='join'){
   // Never coerce an untrusted object into a character lookup key. Own-property
   // lookup also excludes Object.prototype names. Unknown/retired IDs (Sam in
   // pre-8.7 clients) use Azhi so older clients can still join safely.
   if(msg.char!==undefined&&typeof msg.char!=='string'){send(ws,{type:'error',message:'角色代號必須是文字'});return}
   const char=typeof msg.char==='string'&&Object.hasOwn(Combat.CHAR,msg.char)?msg.char:'azhi';
   if(msg.room!==undefined&&typeof msg.room!=='string'){send(ws,{type:'error',message:'請提供有效房號'});return}
   if(msg.mode!==undefined&&!['duel','team'].includes(msg.mode)){send(ws,{type:'error',message:'房間模式必須是 1v1 或 2v2'});return}
   let id=msg.room?msg.room.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8):'';
   if(!id)id=newCode();let room=rooms.get(id);const requestedMode=msg.mode==='team'?'team':'duel';
   // Validate before allocating a room: malformed nicknames must not exhaust the room limit.
   if(msg.name!==undefined&&!cleanLabel(msg.name)){send(ws,{type:'error',message:'玩家暱稱需 2–16 字，只能使用中英文字、數字、空格、底線、句點及連字號'});return}
   if(msg.title!==undefined&&msg.title!==null&&msg.title!==''&&!cleanLabel(msg.title,24)){send(ws,{type:'error',message:'房間名稱需 2–24 字，不能含特殊控制字元'});return}
   if(!room){if(rooms.size>=ROOM_LIMIT){send(ws,{type:'error',message:'目前房間數已達上限，請稍後再試'});return}
    const title=msg.title?cleanLabel(msg.title,24):'海線格鬥房';
    if(!title){send(ws,{type:'error',message:'房間名稱需 2–24 字，不能含特殊控制字元'});return}
    room={id,title,hostWs:null,mode:requestedMode,maxPlayers:requestedMode==='team'?4:2,players:[],spectators:new Set(),game:null,session:null,completed:false,rematchVotes:new Set(),lastActive:now};
   }
   if(room.mode!==requestedMode){send(ws,{type:'error',message:'房間模式不同，請確認是 1v1 還是 2v2'});return}
   if(room.players.filter(p=>p.ws!==ws).length>=room.maxPlayers){send(ws,{type:'error',message:'玩家席已滿，可以改用觀戰模式'});return}
   let displayName=msg.name===undefined?`選手${room.players.length+1}`:cleanLabel(msg.name);
   if(msg.name===undefined){let i=room.players.length+1;while(nameTaken(room,displayName,ws))displayName=`選手${++i}`}
   if(!displayName){send(ws,{type:'error',message:'玩家暱稱需 2–16 字，只能使用中英文字、數字、空格、底線、句點及連字號'});return}
   if(nameTaken(room,displayName,ws)){send(ws,{type:'error',message:'暱稱已被使用，請換一個'});return}
   // All target validation completed before leaving or allocating any room.
   leave(ws);rooms.set(id,room);
   const used=new Set(room.players.map(p=>p.slot));let slot=Array.from({length:room.maxPlayers},(_,i)=>i).find(i=>!used.has(i));
   room.players.push({ws,slot,char,name:displayName,keys:{},pulses:[]});ws.record={room:id,role:'player'};room.lastActive=now;
   if(!room.hostWs)room.hostWs=ws;
   send(ws,{type:'joined',room:id,mode:room.mode,slot,team:slot%2,needed:room.maxPlayers,title:room.title,name:displayName,host:ws===room.hostWs});roomRoster(room);
   if(room.players.length===room.maxPlayers)begin(room);
   return;
  }
  if(msg.type==='set_name'&&ws.record){
   const room=rooms.get(ws.record.room);if(!room)return;
   if(ws.lastNameChange&&now-ws.lastNameChange<1500){send(ws,{type:'error',message:'更改暱稱太頻繁，請稍候再試'});return}
   const name=cleanLabel(msg.name);
   if(!name){send(ws,{type:'error',message:'暱稱需 2–16 字，限中英文字、數字、空格、底線、句點及連字號'});return}
   if(nameTaken(room,name,ws)){send(ws,{type:'error',message:'暱稱已被使用，請換一個'});return}
   const p=room.players.find(p=>p.ws===ws);
   if(p)p.name=name;else if(ws.record.role==='spectator')ws.displayName=name;
   else return;
   ws.lastNameChange=now;send(ws,{type:'name_updated',name});room.lastActive=now;roomRoster(room);return;
  }
  if(msg.type==='set_title'&&ws.record){
   const room=rooms.get(ws.record.room);if(!room)return;
   if(room.hostWs!==ws){send(ws,{type:'error',message:'只有房主可以更改房間名稱'});return}
   if(ws.lastTitleChange&&now-ws.lastTitleChange<1500){send(ws,{type:'error',message:'更改房名太頻繁，請稍候再試'});return}
   const title=cleanLabel(msg.title,24);
   if(!title){send(ws,{type:'error',message:'房間名稱需 2–24 字且不可包含特殊字元'});return}
   ws.lastTitleChange=now;room.title=title;room.lastActive=now;roomRoster(room);return;
  }
  if(msg.type==='input'&&ws.record){
   const room=rooms.get(ws.record.room),p=room?.players.find(p=>p.ws===ws),session=room?.session;
   if(!session||!p||msg.matchId!==room.matchId)return;
   if(!Number.isSafeInteger(msg.frame)||msg.frame<1)return;
   session.submit(p.slot,msg.frame,{keys:msg.keys,pulses:msg.pulses},{lockExisting:true});
   room.game=session.game;room.lastActive=now;return;
  }
  if(msg.type==='ping'){
   if(Number.isFinite(msg.sentAt))send(ws,{type:'pong',sentAt:msg.sentAt,serverTime:Date.now()});return;
  }
  if(msg.type==='rematch'&&ws.record){
   const room=rooms.get(ws.record.room);
   if(!room||room.players.length!==room.maxPlayers||!room.players.some(p=>p.ws===ws)||(!room.completed&&room.session?.game.status!=='finished'))return;
   room.rematchVotes=room.rematchVotes||new Set();room.rematchVotes.add(ws);room.lastActive=now;
   all(room,{type:'rematch_status',votes:room.rematchVotes.size,needed:room.maxPlayers});
   if(room.rematchVotes.size===room.maxPlayers&&room.completed)begin(room);
   return;
  }
  if(msg.type==='leave')leave(ws);
 });
 ws.on('close',()=>{connections--;leave(ws)});ws.on('error',()=>{leave(ws)});
});
// Monotonic accumulator prevents setInterval drift; simulate every logical frame at 60Hz.
// Network publishes 30 authoritative snapshots/s to bound bandwidth for mobile clients.
let simulationFrame=0;let lastClock=process.hrtime.bigint(),lag=0n;
function simulateFrame(){
 const now=Date.now();simulationFrame++;
 for(const [id,room] of rooms){
  if(now-room.lastActive>1000*60*15){for(const ws of room.spectators||[])ws.close(1000,'Room timeout');for(const p of room.players){send(p.ws,{type:'error',message:'房間閒置過久，已關閉'});p.ws.close(1000,'Room timeout')}rooms.delete(id);continue}
  const session=room.session;if(!session||room.players.length!==room.maxPlayers)continue;
  const events=session.advance();room.game=session.game;
  for(const [index,event] of events.entries()){const tagged={...event,id:`${session.frame}:${index}`};room.playerEventBuffer.push(tagged);room.watchEventBuffer.push(tagged);}
  if(room.watchEventBuffer.length>120)room.watchEventBuffer.splice(0,room.watchEventBuffer.length-120);
  if(session.frame%SNAPSHOT_DIVISOR===0){
   const from=session.correctionFrom===null?Math.max(1,session.frame-2):Math.max(1,session.correctionFrom);
   const data={type:'frames',matchId:room.matchId,serverFrame:session.frame,
      rows:session.rows(from),events:room.playerEventBuffer.splice(0),
      serverRollbacks:session.rollbacks};
   if(session.frame%30===0||session.correctionFrom!==null){
    // Keyframe captures all collision, command, meter, and RNG state; not just x/y/hp.
    data.checkpoint={frame:session.frame,state:Rollback.clone(session.game),hash:session.digest()};
   }
   group(room,data);session.correctionFrom=null;
  }
  // Spectators receive 15Hz read-only authoritative rendered states; not input rows or rewind internals.
  if(session.frame%Math.max(4,SNAPSHOT_DIVISOR*2)===0&&room.spectators.size){
   audience(room,{type:'watch_frame',mode:room.mode,matchId:room.matchId,serverFrame:session.frame,game:compactGame(room),events:room.watchEventBuffer.splice(0)});
  }
  if(!room.spectators.size)room.watchEventBuffer.length=0;
  // Wait a complete rewind window before committing KO. Late inputs may undo a predicted finish.
  if(session.game.status==='finished'){
   if(room.finishingSince===null)room.finishingSince=session.frame;
   if(session.frame-room.finishingSince>=Rollback.WINDOW){
    room.lastActive=now;room.completed=true;
    group(room,{type:'match_complete',matchId:room.matchId,frame:session.frame,checkpoint:{frame:session.frame,state:Rollback.clone(session.game),hash:session.digest()}});
    audience(room,{type:'watch_complete',mode:room.mode,matchId:room.matchId,serverFrame:session.frame,game:compactGame(room)});
    room.session=null;room.game=null;
    if(room.rematchVotes.size===room.maxPlayers)begin(room);
   }
  }else{
   room.finishingSince=null;
   if(room.rematchVotes.size>0){room.rematchVotes.clear();all(room,{type:'rematch_status',votes:0,needed:room.maxPlayers})}
  }
 }
}
const timer=setInterval(()=>{
 const now=process.hrtime.bigint();let elapsed=now-lastClock;lastClock=now;
 if(elapsed>FRAME_NS*8n)elapsed=FRAME_NS*8n;lag+=elapsed;
 let steps=0;while(lag>=FRAME_NS&&steps<6){simulateFrame();lag-=FRAME_NS;steps++}
 if(lag>FRAME_NS*2n)lag=FRAME_NS; // avoid spiral-of-death on overloaded VPS
},8);timer.unref();
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue}ws.isAlive=false;ws.ping()}},30000);heartbeat.unref();
server.listen(PORT,HOST,()=>console.log(`阿志向錢衝 ${VERSION} named rooms & spectator rollback ready at http://${HOST}:${server.address().port}`));
function shutdown(){for(const ws of wss.clients)ws.close(1001,'Server restarting');server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref()}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
// Export in-process handles solely for deterministic tests and maintenance tooling.
// They are not exposed as HTTP endpoints.
module.exports={server,rooms,wss,simulateFrame,cleanLabel};
