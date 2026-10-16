'use strict';
const crypto=require('node:crypto');
const Combat=require('../public/core');
const RB=require('../public/rollback');
const Stages=require('../public/stage-registry');
const digest=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const fail=(code,message,status=400)=>{throw Object.assign(new Error(message),{code,status});};
/* Transport adapter for the existing authoritative engine. No HTTP/client result API. */
function createOnline({services,rooms,send,all,begin,finalize,roster,env=process.env}){
 const queue=new Map(),occupied=new Map();let mutation=Promise.resolve(),closed=false;
 const grace=30000,queueTimeout=120000,acceptTimeout=20000,loadTimeout=15000;
 const serial=fn=>{const work=mutation.then(fn);mutation=work.catch(err=>{if(!err.status||err.status>=500)console.error('[online] operation failed:',err.code||err.name)});return work;};
 const error=(ws,err)=>send(ws,{type:'error',code:err.code||'ONLINE_UNAVAILABLE',message:err.status?err.message:'線上服務暫時無法使用，請稍後重試'});
 const service=()=>{if(!services.competition||!services.healthy)fail('ONLINE_NOT_CONFIGURED','線上競技尚未設定或資料庫無法連線',503);return services.competition;};
 async function auth(ws){const value=await services.accounts.requireUser(ws.request);ws.auth=value;return value.user;}
 function packet(room){return {matchId:room.matchId,kind:room.kind,stage:room.stage,deadline:room.deadline,players:room.players.map(p=>({userId:p.userId,slot:p.slot,name:p.name,char:p.char,avatar:p.avatar,rank:p.rank,accepted:!!p.accepted,ready:!!p.loaded,connected:!!p.ws}))};}
 function found(room,type='match_found'){all(room,{type,...packet(room)});}
 function tokenFor(player){const value=crypto.randomBytes(32).toString('base64url');player.resumeHash=digest(value);return value;}
 function attach(ws,req){ws.request=req;ws.rtt=null;ws.pingAt=0;ws.auth=null;ws.initialized=services.ready.then(()=>services.accounts.authenticateRequest(req)).then(value=>{ws.auth=value;}).catch(()=>{});probe(ws);}
 function probe(ws){if(ws.readyState!==1)return;ws.pingAt=Date.now();ws.pingValue=crypto.randomBytes(6).toString('hex');try{ws.ping(ws.pingValue);}catch{}}
 function pong(ws,data){if(!data)return;if(data.toString()!==ws.pingValue)return;const sample=Math.max(1,Date.now()-ws.pingAt);ws.rtt=ws.rtt===null?sample:Math.round(ws.rtt*.7+sample*.3);}
 async function cancel(ws,state='cancelled',message='已取消搜尋'){
  const id=ws.auth?.user.id,entry=id&&queue.get(id);if(!entry||entry.ws!==ws){send(ws,{type:'queue_status',state});return;}
  queue.delete(id);await services.db.query('DELETE FROM matchmaking_queue WHERE user_id=$1',[id]);send(ws,{type:'queue_status',state,kind:entry.kind,message});
 }
 async function invalidate(room,reason,message){
  if(room.settling)return;room.settling=true;room.paused=true;
  try{const result=room.persisted?await service().voidMatch(room.matchId,reason):null;
   all(room,{type:'match_void',...packet(room),reason,message,settlement:result});
   for(const p of room.players){occupied.delete(p.userId);if(p.ws){p.ws.record=null;send(p.ws,{type:'queue_status',state:'idle',message});}}
   for(const ws of room.spectators){ws.record=null;send(ws,{type:'watch_end',message});}rooms.delete(room.id);
  }catch(err){room.settling=false;room.retryAt=Date.now()+2000;error(room.players.find(p=>p.ws)?.ws,err);}
 }
 async function reservePair(a,b){
  if(a.ws.readyState!==1||b.ws.readyState!==1)return;
  await auth(a.ws);await auth(b.ws);
  const id=crypto.randomBytes(16).toString('hex'),stage=Stages.PLAYABLE[crypto.randomInt(Stages.PLAYABLE.length)],seed=crypto.randomInt(1,2**31);
  await service().reserveMatch({id,mode:a.kind,stage,seed,participants:[a,b].map((p,slot)=>({userId:p.user.id,slot,char:p.char}))});
  let roomCode;do{roomCode=crypto.randomBytes(4).toString('hex').toUpperCase();}while(rooms.has(roomCode));
  const room={id:roomCode,title:a.kind==='ranked'?'正式排位':'快速對戰',mode:'duel',kind:a.kind,maxPlayers:2,players:[],spectators:new Set(),game:null,session:null,completed:false,revision:0,rematchVotes:new Set(),lastActive:Date.now(),matchId:id,persisted:true,stage,seed,deadline:Date.now()+acceptTimeout,prepare:'accept',private:true,spectatorsAllowed:false};
  for(const [slot,entry]of[a,b].entries()){
   queue.delete(entry.user.id);await services.db.query('DELETE FROM matchmaking_queue WHERE user_id=$1',[entry.user.id]);
   const profile=await service().getPlayer(entry.user.id),p={ws:entry.ws,userId:entry.user.id,name:entry.user.nickname,avatar:entry.user.avatar,char:entry.char,slot,rank:profile.ranked?.rank||null,ready:false,accepted:false,loaded:false,keys:{},pulses:[]};room.players.push(p);occupied.set(p.userId,room);entry.ws.explicitLeave=false;entry.ws.record={room:roomCode,role:'player'};
   send(entry.ws,{type:'joined',room:roomCode,slot,mode:'duel',kind:room.kind,title:room.title,name:p.name,host:slot===0,resumeToken:tokenFor(p)});
  }
  room.hostWs=a.ws;room.hostUserId=a.user.id;rooms.set(roomCode,room);found(room);
 }
 async function matchQueue(){
  const now=Date.now();for(const entry of [...queue.values()]){
   if(entry.ws.readyState!==1){await cancel(entry.ws);continue;}
   if(now-entry.since>=queueTimeout){await cancel(entry.ws,'expired','搜尋逾時，請稍後再試');continue;}
   if(entry.ws.rtt!==null&&entry.ws.rtt>250){await cancel(entry.ws,'error','目前實測延遲超過 250ms，請改善網路後再試');continue;}
  }
  const entries=[...queue.values()].sort((a,b)=>a.since-b.since);
  for(const a of entries){if(!queue.has(a.user.id)||a.ws.rtt===null)continue;
   const range=Math.min(600,150+Math.floor((now-a.since)/10000)*75);
   const b=entries.filter(b=>b.user.id!==a.user.id&&queue.has(b.user.id)&&b.kind===a.kind&&b.ws.rtt!==null&&b.ws.rtt<=250&&Math.abs(a.ws.rtt-b.ws.rtt)<=120&&Math.abs(a.mmr-b.mmr)<=range).sort((x,y)=>(Math.abs(a.mmr-x.mmr)+2*Math.abs(a.ws.rtt-x.ws.rtt))-(Math.abs(a.mmr-y.mmr)+2*Math.abs(a.ws.rtt-y.ws.rtt))||x.since-y.since)[0];
   if(b){try{await reservePair(a,b);}catch(err){for(const entry of[a,b]){await cancel(entry.ws,'error',err.status?err.message:'匹配暫時無法完成');}}}
  }
 }
 async function enqueue(ws,msg){
  const user=await auth(ws);service();
  if(!['quick','ranked'].includes(msg.kind)||typeof msg.char!=='string'||!Object.hasOwn(Combat.CHAR,msg.char))fail('INVALID_QUEUE','請選擇有效模式及角色');
  if(ws.record||occupied.has(user.id))fail('PLAYER_BUSY','請先完成或離開目前的房間',409);
  const old=queue.get(user.id);if(old){if(old.ws!==ws)fail('PLAYER_BUSY','此帳號正在其他分頁搜尋對手',409);send(ws,{type:'queue_status',state:'searching',kind:old.kind,queueSince:old.since});return;}
  if(queue.size>=200)fail('QUEUE_FULL','目前搜尋人數已滿，請稍後再試',503);
  const season=await service().currentSeason();if(msg.kind==='ranked'&&!season)fail('SEASON_CLOSED','目前沒有開放中的排位賽季',409);
  if(ws.rtt!==null&&ws.rtt>250)fail('LATENCY_HIGH','目前實測延遲超過 250ms，請改善網路後再試');
  const recent=await services.db.query("SELECT count(*)::int n FROM matches m JOIN match_participants p ON p.match_id=m.id WHERE p.user_id=$1 AND m.mode='ranked' AND m.ended_at>now()-interval '10 minutes' AND (m.invalid_reason IN ('declined','accept_timeout','early_disconnect') OR m.reason='forfeit')",[user.id]);if(msg.kind==='ranked'&&recent.rows[0].n>=5)fail('QUEUE_COOLDOWN','近期對戰多次未完成，請稍後再加入排位',429);
  const rating=await service().internalMatchmakingStats(user.id,msg.kind),since=Date.now();
  const inserted=await services.db.query("INSERT INTO matchmaking_queue(user_id,mode,season_id,character_id,stage,region,latency_ms,mmr,expires_at) SELECT $1,$2,$3,$4,'auto',$5,$6,$7,$8 WHERE NOT EXISTS(SELECT 1 FROM active_match_users WHERE user_id=$1) ON CONFLICT(user_id) DO NOTHING RETURNING user_id",[user.id,msg.kind,msg.kind==='ranked'?season.id:null,msg.char,env.AZHI_REGION||'auto',Math.min(2000,ws.rtt||2000),rating.mmr,new Date(since+queueTimeout)]);
  if(!inserted.rowCount)fail('PLAYER_BUSY','此帳號已有搜尋或比賽預約',409);
  queue.set(user.id,{ws,user,char:msg.char,kind:msg.kind,mmr:rating.mmr,since});send(ws,{type:'queue_status',state:'searching',kind:msg.kind,queueSince:since});await matchQueue();
 }
 async function prepare(room){
  if(room.players.some(p=>!p.loaded||!p.ws))return;
  for(const p of room.players)await auth(p.ws);
  const started=await service().startMatch(room.matchId);if(started.status!=='running'){await invalidate(room,'start_rejected','比賽未能開始，不計積分');return;}
  if(room.players.some(p=>!p.ws)){await invalidate(room,'preparation_disconnected','有人離線，本場不計積分');return;}room.prepare=null;room.deadline=null;room.startedAt=Date.now();begin(room);found(room,'match_playing');
 }
 async function beforeStart(room){
  if(!services.competition||room.mode!=='duel'||room.persisted)return;
  if(room.players.length!==2||room.players.some(p=>!p.userId))return;
  for(const p of room.players)await auth(p.ws);
  const id=crypto.randomBytes(16).toString('hex');room.stage=Stages.PLAYABLE[crypto.randomInt(Stages.PLAYABLE.length)];room.seed=crypto.randomInt(1,2**31);
  await service().reserveMatch({id,mode:'custom',stage:room.stage,seed:room.seed,participants:room.players.map(p=>({userId:p.userId,slot:p.slot,char:p.char}))});
  room.persisted=true;room.matchId=id;room.startedAt=Date.now();room.hostUserId=room.players.find(p=>p.ws===room.hostWs)?.userId||null;await service().startMatch(id);for(const p of room.players)occupied.set(p.userId,room);
 }
 async function abortStart(room){if(room.persisted){await service().voidMatch(room.matchId,'roster_changed_before_start');room.persisted=false;room.settling=false;room.stage=null;room.seed=null;}for(const [userId,held]of occupied)if(held===room&&!room.players.some(p=>p.userId===userId&&p.ws))occupied.delete(userId);}
 function afterJoin(ws){ws.explicitLeave=false;const room=rooms.get(ws.record?.room),p=room?.players.find(p=>p.ws===ws);if(!p||!ws.auth)return;p.userId=ws.auth.user.id;p.avatar=ws.auth.user.avatar;if(room.hostWs===ws)room.hostUserId=p.userId;occupied.set(p.userId,room);send(ws,{type:'resume_token',room:room.id,resumeToken:tokenFor(p)});}
 function protect(ws,msg){
  const target=typeof msg.room==='string'?rooms.get(msg.room.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,32)):null;
  if(target?.kind)fail('MATCH_PRIVATE','自動匹配房間僅限已配對的兩名玩家',403);
  if(target?.private&&!ws.auth)fail('LOGIN_REQUIRED','私人房間需要登入才能加入',401);
  if(msg.type==='watch'&&target&&target.spectatorsAllowed===false)fail('SPECTATOR_FORBIDDEN','房主未開放觀戰',403);
  if(msg.type==='join'&&ws.auth){if(queue.has(ws.auth.user.id))fail('PLAYER_BUSY','請先取消匹配',409);const old=occupied.get(ws.auth.user.id);if(old&&old.players.some(p=>p.userId===ws.auth.user.id&&p.ws!==ws))fail('PLAYER_BUSY','此帳號已在其他分頁或保留的比賽席位',409);}
 }
 async function handle(ws,msg){
  await ws.initialized;if(ws.readyState!==1&&msg.type!=='leave')return true;
  if(msg.type==='resume_match')return serial(async()=>{
   const user=await auth(ws),room=rooms.get(msg.room),p=room?.players.find(p=>p.userId===user.id);
   if(!p||p.ws||!p.disconnectedAt||Date.now()>p.deadline||typeof msg.token!=='string'||!p.resumeHash||digest(msg.token)!==p.resumeHash)fail('RESUME_REJECTED','重連保留已過期或身分不符',403);
   p.ws=ws;p.disconnectedAt=null;p.deadline=null;ws.record={room:room.id,role:'player'};if(room.hostUserId===user.id)room.hostWs=ws;
   send(ws,{type:'resumed',room:room.id,slot:p.slot,kind:room.kind,title:room.title,resumeToken:tokenFor(p)});
   if(room.session){const frame=room.session.frame,state=RB.clone(room.session.game);for(const input of room.session.inputs)input.clear();room.session.hardSync(frame,state);room.resumeFloor=frame;if(room.players.every(p=>p.ws)){room.paused=false;all(room,{type:'match_resumed',matchId:room.matchId,frame,checkpoint:{frame,state,hash:room.session.digest()},inputDelay:RB.INPUT_DELAY});}}
   else found(room);roster?.(room);return true;
  }).then(()=>true);
  if(msg.type==='queue_join'){await serial(()=>enqueue(ws,msg));return true;}
  if(msg.type==='queue_cancel'){await serial(()=>cancel(ws));return true;}
  const room=rooms.get(ws.record?.room),player=room?.players.find(p=>p.ws===ws);
  if(['join','watch'].includes(msg.type)){if(ws.auth)await auth(ws);protect(ws,msg);return false;}
  if(msg.type==='set_access'){
   if(!room||room.hostWs!==ws||room.kind||room.session)fail('HOST_ONLY','只有等待中的房主可以調整觀戰權限',403);
   if(typeof msg.spectatorsAllowed!=='boolean'||typeof msg.private!=='boolean')fail('INVALID_ACCESS','房間權限格式錯誤');
   if(msg.private){await auth(ws);if(room.id.length<16)fail('PRIVATE_RECREATE','請建立新的私人房間，以取得安全的長邀請碼',409);}room.private=msg.private;room.spectatorsAllowed=msg.spectatorsAllowed;
   if(!room.spectatorsAllowed){for(const observer of room.spectators){send(observer,{type:'watch_end',message:'房主已關閉觀戰'});observer.record=null;}room.spectators.clear();}
   all(room,{type:'room_access',private:room.private,spectatorsAllowed:room.spectatorsAllowed});roster?.(room);return true;
  }
  if(room?.kind){
   if(['set_ready','start_match','select_character','rematch','set_title'].includes(msg.type))fail('MATCH_LOCKED','自動匹配請使用對戰確認，角色與規則已鎖定',409);
   if(msg.type==='match_accept'){await serial(async()=>{await auth(ws);if(room.prepare!=='accept'||!player||typeof msg.accept!=='boolean')fail('NOT_PREPARING','比賽不在確認階段',409);if(Date.now()>room.deadline){await invalidate(room,'accept_timeout','確認逾時，不計積分');return;}if(!msg.accept){await invalidate(room,'declined','有人婉拒對戰，請重新搜尋');return;}player.accepted=true;found(room);if(room.players.every(p=>p.accepted&&p.ws)){room.prepare='resources';room.deadline=Date.now()+loadTimeout;found(room,'resources_required');}});return true;}
   if(msg.type==='resources_ready'){await serial(async()=>{if(!player||room.prepare!=='resources'||msg.matchId!==room.matchId)fail('NOT_LOADING','資源同步狀態已更新',409);if(msg.ok!==true){await invalidate(room,'resource_failed','必要素材載入失敗，不計積分');return;}player.loaded=true;found(room,'resources_required');await prepare(room);});return true;}
  }
  if(player?.userId&&['set_ready','start_match','select_character','set_name','set_title'].includes(msg.type))await auth(ws);
  if(msg.type==='input'&&room?.paused)return true;
  return false;
 }
 function detach(ws,{unexpected=false}={}){
  const userId=ws.auth?.user.id;if(userId&&queue.get(userId)?.ws===ws)serial(()=>cancel(ws,'cancelled','連線中斷，搜尋已取消')).catch(()=>{});
  const room=rooms.get(ws.record?.room),p=room?.players.find(p=>p.ws===ws);
  if(!p||!p.userId||room.mode!=='duel'){if(p?.userId&&occupied.get(p.userId)===room)occupied.delete(p.userId);return false;}
  if(room.settling){ws.record=null;p.ws=null;return true;}
  if(!room.session){if(room.kind){serial(()=>invalidate(room,'preparation_disconnected','有人離線，對戰取消且不計積分')).catch(()=>{});ws.record=null;return true;}occupied.delete(p.userId);return false;}
  ws.record=null;p.ws=null;p.disconnectedAt=Date.now();p.deadline=p.disconnectedAt+(unexpected?grace:0);room.paused=true;room.hostUserId=room.players.find(p=>p.ws===room.hostWs)?.userId||room.hostUserId||null;
  all(room,{type:'match_paused',matchId:room.matchId,slot:p.slot,deadline:p.deadline,message:unexpected?'對手斷線，比賽暫停並保留 30 秒重連':'玩家已離開，正在由伺服器結算'});roster?.(room);return true;
 }
 async function settle(room,reasonOverride,winnerOverride){
  if(room.settling||!room.session)return;room.settling=true;room.paused=true;
  const game=room.session.game;let result=room.pendingSettlement||{winnerSlot:winnerOverride===undefined?game.winner:winnerOverride,rounds:game.players.map(p=>p.wins),reason:reasonOverride||(game.players.some(p=>p.hp===0)?'ko':'time_over'),checksum:room.session.digest()};
  if(!room.pendingSettlement&&reasonOverride==='forfeit'&&room.kind==='ranked'&&room.session.frame<600){room.settling=false;await invalidate(room,'early_disconnect','開賽後過早離場，本場無效且不計積分');return;}
  if(!room.pendingSettlement&&reasonOverride==='forfeit'){game.winner=winnerOverride;game.status='finished';game.players[winnerOverride].wins=Math.max(game.players[winnerOverride].wins,2);result.rounds=game.players.map(p=>p.wins);room.session.hardSync(room.session.frame,game);result.checksum=room.session.digest();}
  room.pendingSettlement=result;
  try{const saved=room.persisted?await service().completeMatch(room.matchId,result):null;finalize(room,saved);for(const p of room.players)if(p.userId)occupied.delete(p.userId);
   if(room.kind){for(const p of room.players)if(p.ws)p.ws.record=null;rooms.delete(room.id);}
   else{room.persisted=false;room.settling=false;room.expiring=false;room.lastActive=Date.now();room.pendingSettlement=null;room.stage=null;room.seed=null;room.players=room.players.filter(p=>p.ws);if(room.players.length===1&&room.players[0].slot!==0){room.players[0].slot=0;send(room.players[0].ws,{type:'seat_updated',slot:0});}room.hostWs=room.players.find(p=>p.ws===room.hostWs)?.ws||room.players[0]?.ws||null;for(const p of room.players)if(p.userId)occupied.set(p.userId,room);roster?.(room);if(!room.players.length&&!room.spectators.size)rooms.delete(room.id);}

  }catch(err){room.settling=false;room.retryAt=Date.now()+2000;console.error('[online] settlement pending:',err.code||err.name);all(room,{type:'settlement_pending',message:'伺服器正在保存正式結果，請稍候'});}
 }
 function finished(room){serial(()=>settle(room)).catch(()=>{});}
 function expire(room){if(room.expiring)return;room.expiring=true;room.paused=true;serial(()=>room.pendingSettlement?settle(room):invalidate(room,'room_timeout','房間已過期，本場無效且不計積分')).catch(()=>{});}
 async function maintain(){
  const now=Date.now();for(const [id,held]of occupied)if(rooms.get(held.id)!==held)occupied.delete(id);await matchQueue();
  for(const room of rooms.values()){
   if(room.pendingSettlement&&!room.settling&&(!room.retryAt||now>=room.retryAt)){await settle(room);continue;}
   if(room.expiring&&!room.settling&&(!room.retryAt||now>=room.retryAt)){await invalidate(room,'room_timeout','房間已過期，本場無效且不計積分');continue;}
   if(room.infrastructureFault&&!room.settling&&(!room.retryAt||now>=room.retryAt)){await invalidate(room,'database_unavailable','伺服器資料服務中斷，本場無效且不計積分');continue;}
   if(room.persisted&&room.session&&room.startedAt&&now-room.startedAt>30*60*1000){await invalidate(room,'match_timeout','本場超過時間限制，無效且不計積分');continue;}
   if(room.prepare&&now>room.deadline){await invalidate(room,room.prepare==='accept'?'accept_timeout':'resource_timeout','準備逾時，本場不計積分');continue;}
   if(room.paused&&!room.settling&&room.session&&(!room.retryAt||now>=room.retryAt)){
    const missing=room.players.filter(p=>!p.ws);if(missing.some(p=>now>=p.deadline)){
     if(missing.length===2)await invalidate(room,'double_disconnect','雙方斷線，本場無效且不計積分');
     else await settle(room,'forfeit',1-missing[0].slot);
    }else if(!missing.length&&room.finishingSince!==null)await settle(room);
   }
  }
 }
 const maintenance=setInterval(()=>{if(!closed)serial(maintain).catch(()=>{});},500);maintenance.unref();
 const authTimer=setInterval(()=>{for(const room of rooms.values())for(const p of room.players)if(p.userId&&p.ws){const ws=p.ws;services.accounts.authenticateRequest(ws.request).then(auth=>{if(!auth){send(ws,{type:'session_expired',message:'登入已過期，請重新登入'});ws.close(1008,'Session expired');}}).catch(()=>{if(room.persisted&&!room.pendingSettlement){room.paused=true;room.infrastructureFault=true;all(room,{type:'match_paused',matchId:room.matchId,message:'伺服器資料服務暫時中斷，本場將作廢且不計積分'});}});}},15000);authTimer.unref();
 return {attach,pong,probe,handle,error,afterJoin,beforeStart,abortStart,detach,finished,expire,queue,occupied,async close(){closed=true;clearInterval(maintenance);clearInterval(authTimer);await serial(async()=>{for(const room of rooms.values())if(room.persisted&&!room.completed)await service().voidMatch(room.matchId,'server_shutdown');await services.db?.query('DELETE FROM matchmaking_queue');});}};
}
module.exports={createOnline};
