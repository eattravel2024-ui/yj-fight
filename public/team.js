/* Azhi 8.6: four-player online team fighting & read-only live spectator. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id),C=window.AzhiCore,T=window.AzhiTeamCore,RB=window.AzhiRollback,A=window.AzhiAnimation;
 if(!C||!T||!RB||!A){document.body.textContent='格鬥核心未載入，請重新整理';return;}
 const canvas=$('arenaCanvas'),ctx=canvas.getContext('2d',{alpha:false});
 const P=window.AzhiPresentation,battleCamera=P.createCamera();let lastDraw=0;
 const playback=A.createPlayback(),motionQuery=matchMedia('(prefers-reduced-motion: reduce)');let reducedMotion=motionQuery.matches;
 const skillFX=window.AzhiSkillFX.create({quality:'high',reducedMotion});motionQuery.addEventListener('change',event=>{reducedMotion=event.matches;skillFX.setReducedMotion(reducedMotion)});
 const charIds=Object.keys(C.CHAR),stageAssets={night:'art/night.svg',garage:'art/garage.svg',harbor:'art/port-arena.svg'},stageNames={night:'逢甲霓虹夜市',garage:'海線改車廠',harbor:'港都狠話擂台'};
 const portraits={},sprites={},stages={};for(const id of charIds){let p=new Image(),s=new Image();p.src='art/portrait_'+id+'.webp?v=881';s.src='sprites/'+id+'.png?v=881';portraits[id]=p;sprites[id]=s;}
 for(const [id,path] of Object.entries(stageAssets)){const image=new Image();image.src=path;stages[id]=image;}
 let playerNames=[],roomTitle='海線格鬥房',isHost=false,onlineName='';
 let ws=null,room='',role='player',selected='azhi',slot=-1,session=null,state=null,prevState=null,matchId='',serverFrame=0,serverMode='team',lastPacket=0,inputs={},pulses=[],delay=RB.INPUT_DELAY,rollbackCount=0,rtt=0,networkComplete=false,pending=null,watchers=0,waiting=true,watching=false,matchDone=false;
 let lastClock=performance.now(),acc=0,lastHud=0,shake=0,flash=0,effects=[],showBoxes=false,visualEffects=true,audioOn=true,audio=null,soundEnabled=false;
 const pressed={},attackKeys=new Set(C.ATTACKS),keyMap={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyJ:'light',Space:'light',KeyK:'heavy',KeyQ:'kick',KeyE:'low',KeyH:'throw',KeyI:'upper',KeyU:'special',KeyO:'super',KeyL:'guard',ShiftLeft:'dash',ShiftRight:'dash'};
 const overlay=(title,subtitle)=>{$('arenaWait').hidden=false;$('arenaMessage').textContent=title;$('arenaSub').textContent=subtitle||''};
 const hideOverlay=()=>{$('arenaWait').hidden=true};
 function status(s){$('roomStatus').textContent=s;$('quickMessage').textContent=s;}
 function toast(t){const c=$('battleCallout');c.classList.remove('show');void c.offsetWidth;c.textContent=t;c.classList.add('show')}
 function audioHit(kind){if(!audioOn||!soundEnabled)return;try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();audio.resume();const now=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain();osc.type=kind==='heavy'?'sawtooth':'triangle';osc.frequency.setValueAtTime(kind==='heavy'?115:260,now);osc.frequency.exponentialRampToValueAtTime(55,now+.13);gain.gain.setValueAtTime(kind==='heavy'?.08:.045,now);gain.gain.exponentialRampToValueAtTime(.001,now+.16);osc.connect(gain).connect(audio.destination);osc.start(now);osc.stop(now+.17);}catch{}}
 function renderChars(){$('teamCharacters').textContent='';for(const [id,c] of Object.entries(C.CHAR)){let b=document.createElement('button');b.type='button';b.className=id===selected?'on':'';b.setAttribute('aria-pressed',String(id===selected));b.disabled=role==='spectator'||slot>=0;b.innerHTML='<img src="art/portrait_'+id+'.webp?v=881" alt=""><span></span>';b.querySelector('span').textContent=c.name;const skill=document.createElement('small');skill.textContent=c.special;b.querySelector('span').append(skill);b.title=c.skillDescription;b.onclick=()=>{selected=id;renderChars()};$('teamCharacters').append(b)}$('teamCharacterInfo').textContent=`${C.CHAR[selected].name}｜${C.CHAR[selected].title}：${C.CHAR[selected].desc}`;updateSkillUI()}
 function updateSkillUI(player){const fighter=C.CHAR[player?.char||selected]||C.CHAR.azhi,meter=Math.floor(player?.meter??30),playing=role==='player'&&slot>=0&&!!session&&!networkComplete&&!session.game.introFrames;for(const [move,key,cost,name] of [['special','U',25,fighter.special],['super','O',60,fighter.superName]]){const usable=meter>=cost,button=$(move+'Trigger');$(move+'Name').textContent=name;$(move+'Status').textContent=role==='spectator'?'只讀觀戰 · 不可操作':playing?(usable?'可施放 · '+cost+' 能量':'還差 '+(cost-meter)+' 能量'):(cost+' 能量 · '+(move==='special'?'開戰即可使用':'攻擊累積能量'));button.disabled=!playing;button.classList.toggle('available',playing&&usable);button.classList.toggle('unavailable',playing&&!usable);button.setAttribute('aria-label',key+' '+name+'，'+$(move+'Status').textContent);for(const touch of document.querySelectorAll('[data-key="'+move+'"]')){touch.classList.toggle('unavailable',playing&&!usable);touch.setAttribute('aria-label',name+'，'+cost+' 能量')}}}
 for(const move of ['special','super'])$(move+'Trigger').onclick=()=>{if(role!=='player'||slot<0||!session||networkComplete)return;pulses.push(move);soundEnabled=true;canvas.focus({preventScroll:true})};
 function renderRoster(list=[]){playerNames=list;const el=$('teamRoster');el.textContent='';for(let i=0;i<(serverMode==='team'?4:2);i++){let p=list.find(x=>x.slot===i),seat=document.createElement('div');seat.className='seat '+(i%2?'blue-team':'red-team');let small=document.createElement('small');small.textContent=(i%2?'藍':'紅')+'隊 '+(Math.floor(i/2)+1)+' 號席';seat.append(small);if(p){const im=document.createElement('img');im.src='art/portrait_'+p.char+'.webp?v=881';im.alt='';seat.append(im)}const title=document.createElement('strong');title.textContent=p?(p.name||'玩家')+(p.host?' ★':''):'等待加入';if(p)title.classList.add('player-name','joined');seat.append(title);
 if(p){const sub=document.createElement('div');sub.className='character-caption';sub.textContent='使用：'+(C.CHAR[p.char]?.name||p.char);seat.append(sub)}el.append(seat)}}
 function updateHud(g){const players=g?.players||[],scores=g?.scores||[players[0]?.wins||0,players[1]?.wins||0];$('redScore').textContent=scores[0];$('blueScore').textContent=scores[1];$('matchTime').textContent=Math.max(0,Math.ceil(g?.time??90));$('roundInfo').textContent=g?.introFrames>0?'登場倒數 '+Math.ceil(g.introFrames/30):'ROUND '+(g?.round||1);$('stageName').style.visibility=g?.introFrames>0?'hidden':'visible';$('stageName').textContent=(stageNames[g?.stage]||stageNames.night)+' / '+(g?.ruleset==='team'?'2V2':'1V1')+(role==='spectator'?' · LIVE':' · FIGHT');
  for(const team of [0,1]){const el=$(team?'blueFighters':'redFighters');el.textContent='';const teamPlayers=players.filter(p=>(p.team??(p.slot%2))===team).sort((a,b)=>a.slot-b.slot);
   for(let i=0;i<(g?.ruleset==='team'?2:serverMode==='team'?2:1);i++){
    const p=teamPlayers[i],row=document.createElement('div');row.className='mini-fighter';let im=document.createElement('img');im.src='art/portrait_'+(p?.char||'azhi')+'.webp?v=881';im.alt='';row.append(im);
    const wrapper=document.createElement('div');wrapper.className='mini-wrap';const top=document.createElement('div');top.className='mini-top';const name=document.createElement('span');name.textContent=p?(playerNames.find(n=>n.slot===p.slot)?.name||('玩家 '+(p.slot+1)))+' · '+(C.CHAR[p.char]?.name||'角色'):'尚未加入';const hp=document.createElement('span');hp.textContent=p?Math.ceil(p.hp)+' HP':'--';top.append(name,hp);wrapper.append(top);
    const rail=document.createElement('div');rail.className='mini-track';const fill=document.createElement('div');fill.className='mini-fill';fill.style.width=Math.max(0,p?.hp||0)+'%';rail.append(fill);wrapper.append(rail);
    const meter=document.createElement('div');meter.className='mini-meter';const meterBar=document.createElement('div');meterBar.style.width=(p?.meter||0)+'%';meter.append(meterBar);wrapper.append(meter);row.append(wrapper);el.append(row);
   }
  }
  updateSkillUI(players[slot]);
 }
 function renderNetwork(){const d=$('diagnostics');if(role==='spectator'){d.textContent=`只讀觀戰｜伺服器 ${serverFrame} F｜觀戰者 ${watchers} 人｜${serverMode==='team'?'2v2':'1v1'}`;return}
 d.textContent=session?`60Hz Rollback｜RTT ${rtt?Math.round(rtt):'--'}ms｜回滾 ${session.rollbacks} 次｜重算 ${session.replayed}F｜重同步 ${session.resyncs} 次｜本機 ${session.frame} F／伺服器 ${serverFrame} F`:'等待比賽開始…';}
 function setRole(watch){role=watch?'spectator':'player';document.body.classList.toggle('spectating',watch);$('playerTab').setAttribute('aria-pressed',String(!watch));$('watchTab').setAttribute('aria-pressed',String(watch));$('playerTab').classList.toggle('active',!watch);$('watchTab').classList.toggle('active',watch);$('joinButton').textContent=watch?'加入觀戰':'建立／加入';$('roomCode').placeholder=watch?'輸入要觀戰的房號':'房號（留空建立新房）';$('rematch').hidden=watch;$('teamCharacters').style.opacity=watch?'.6':'1';renderChars();}
 function copy(text){if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>toast('邀請連結已複製')).catch(()=>fallback());else fallback();function fallback(){const t=document.createElement('textarea');t.value=text;document.body.append(t);t.select();document.execCommand('copy');t.remove();toast('邀請連結已複製')}}
 function link(watch){const u=new URL(location.href);u.pathname='/team.html';u.searchParams.set('room',room);if(watch)u.searchParams.set('watch','1');else u.searchParams.delete('watch');return u.href}
 function leave(){skillFX.clear();playback.clear();seenEvents.clear();if(ws){const old=ws;ws=null;try{old.send(JSON.stringify({type:'leave'}));old.close(1000,'leave')}catch{}}room='';slot=-1;isHost=false;playerNames=[];roomTitle='海線格鬥房';$('applyNickname').disabled=true;$('applyRoomTitle').disabled=true;$('roomTitleInput').disabled=false;$('roomTitleDisplay').textContent='尚未進入房間';$('spectatorNames').textContent='觀眾：尚無';session=null;state=null;prevState=null;serverFrame=0;matchId='';waiting=true;watching=false;networkComplete=false;matchDone=false;pending=null;Object.keys(pressed).forEach(k=>delete pressed[k]);pulses=[];$('joinButton').disabled=false;$('disconnect').disabled=true;$('copyPlayerLink').disabled=true;$('copyWatchLink').disabled=true;$('rematch').disabled=true;renderChars();renderRoster();renderNetwork();overlay('等待玩家加入','建立四人房間，或輸入房號觀看正在進行的對戰。')}
 function startPlayer(msg){battleCamera.reset();if(role!=='player'||slot<0)return;skillFX.clear();playback.clear();seenEvents.clear();pending=null;clearHeld();matchId=msg.matchId;serverFrame=msg.frame||0;delay=Number(msg.inputDelay)||3;session=new RB.Session(msg.game);state=session.game;prevState=null;waiting=false;watching=false;matchDone=false;networkComplete=false;lastPacket=performance.now();$('rematch').disabled=true;hideOverlay();status('四人就位！現在由 60Hz 回滾引擎同步戰鬥。');}
 function startWatching(msg){battleCamera.reset();if(role!=='spectator')return;skillFX.clear();playback.clear();seenEvents.clear();matchId=msg.matchId;serverFrame=msg.frame||0;session=null;state=msg.game;prevState=null;waiting=false;watching=true;matchDone=false;lastPacket=performance.now();hideOverlay();status('正在觀戰第 '+(state.round||1)+' 回合（只讀模式）');toast('LIVE SPECTATE');}
 function syncCheckpoint(cp){if(!cp||!session)return;if(cp.frame>session.frame){if(cp.frame-session.frame>12){session.hardSync(cp.frame,cp.state);state=session.game;pending=null;return}pending=cp;return}if(session.digest(cp.frame)!==cp.hash)session.rebase(cp.frame,cp.state);state=session.game;pending=null;}
 const seenEvents=new Set();function eventVisual(e){if(e.kind==='skill'&&(role==='spectator'||e.slot===slot||e.id)){skillFX.emit({...e,direction:e.direction||state?.players?.[e.slot]?.face||1},performance.now());toast(e.name)}if(e.kind==='hit'){const attacker=state?.players?.[e.slot],x=e.x||500,y=448-(e.y||0)*.82-110;effects.push({x,y,at:performance.now(),color:e.block?'#6fd8ff':e.move==='super'?'#ffe585':e.counter?'#fb85e5':'#ff9a66',r:e.move==='super'?92:e.move==='heavy'?66:40,dmg:e.damage});if(!reducedMotion){shake=Math.max(shake,e.move==='super'?11:e.move==='heavy'?6:3);flash=Math.max(flash,e.move==='super'?.22:.08);}if(attacker){audioHit(e.move==='heavy'||e.move==='super'?'heavy':'light')}if(e.combo>1)toast(e.combo+' HIT COMBO!');}
 else if(e.kind==='super')toast((C.CHAR[e.char]?.name||'')+' SUPER!');else if(e.kind==='round')toast(e.winner>=0?(e.winnerTeam!==undefined?'TEAM '+(e.winnerTeam?'BLUE':'RED')+' WIN':'ROUND END'):'DRAW');else if(e.kind==='finish')toast('MATCH OVER');}
 function eventsFrom(events,sourceId='local'){for(const [index,e] of (events||[]).entries()){const k=matchId+':'+sourceId+':'+index+':'+(e.kind||'');if(seenEvents.has(k))continue;seenEvents.add(k);eventVisual(e)}if(seenEvents.size>320)seenEvents.clear();}
 function finish(game){if(!game||matchDone)return;matchDone=true;waiting=false;networkComplete=true;const team=game.winnerTeam??game.winner;const who=team===null||team===undefined?'平手':team===0?'紅隊勝利！':'藍隊勝利！';
 overlay('比賽結束 · '+who,role==='spectator'?'可留在房間觀看下一場。':'四位玩家皆同意再戰後，會使用原房間開始新對局。');$('rematch').disabled=role!=='player';status(who+' 等待是否再戰。')}
 function onMessage(m){switch(m.type){
  case 'joined':role=m.role==='spectator'?'spectator':'player';setRole(role==='spectator');slot=m.slot;room=m.room;serverMode=m.mode||'duel';watching=m.role==='spectator';waiting=true;isHost=role==='player'&&!!m.host;roomTitle=m.title||roomTitle;onlineName=m.name||onlineName;
   $('roomTitleDisplay').textContent='房間：'+roomTitle+'｜'+room;$('roomTitleInput').value=roomTitle;$('applyNickname').disabled=false;$('applyRoomTitle').disabled=!isHost;$('roomTitleInput').disabled=!isHost;
   $('roomCode').value=room;$('disconnect').disabled=false;$('copyPlayerLink').disabled=false;$('copyWatchLink').disabled=false;
   history.replaceState(null,'',link(role==='spectator'));status(role==='spectator'?'已進入觀戰席，正在等候場內戰況。':`房號 ${room}｜第 ${slot+1} 位選手，${slot%2?'藍':'紅'}隊`);renderChars();break;
  case 'roster':serverMode=m.mode||serverMode;roomTitle=m.title||roomTitle;isHost=role==='player'&&!!m.players?.find(p=>p.slot===slot)?.host;
   $('roomTitleDisplay').textContent='房間：'+roomTitle+'｜'+(room||'');$('roomTitleInput').value=roomTitle;$('applyRoomTitle').disabled=!isHost;$('roomTitleInput').disabled=!isHost;
   $('spectatorNames').textContent='觀眾：'+((m.spectators||[]).map(p=>p.name).join('、')||'尚無');renderRoster(m.players);if(waiting){overlay('等待隊伍集合',`已加入 ${m.players.length}/${m.needed||4} 名選手；觀眾隨時可加入。`)}break;
  case 'name_updated':onlineName=m.name||onlineName;$('playerNickname').value=onlineName;status('暱稱已更新：'+onlineName);break;
  case 'spectator_count':watchers=m.count||0;$('spectatorCount').textContent=`◉ 目前 ${watchers} 位觀戰者`;break;
  case 'start':startPlayer(m);break;
  case 'watch_start':startWatching(m);break;
  case 'watch_wait':waiting=true;overlay(m.completed?'本場比賽已結束':'等待比賽開始',m.completed?'留在觀戰席，等待四位選手同意再戰。':'觀戰連結已生效，玩家集合後自動開始。');break;
  case 'watch_frame':if(role!=='spectator'||m.matchId!==matchId)return;prevState=state;state=m.game;serverFrame=m.serverFrame;lastPacket=performance.now();waiting=false;hideOverlay();for(const e of m.events||[])eventsFrom([e],e.id||m.serverFrame);if(state.status==='finished')finish(state);break;
  case 'frames':if(role!=='player'||!session||m.matchId!==matchId)return;serverFrame=Math.max(serverFrame,m.serverFrame||0);lastPacket=performance.now();
   for(const row of m.rows||[]){if(!Number.isSafeInteger(row.frame))continue;for(let i=0;i<Math.min(session.count,row.inputs?.length||0);i++)if(row.real?.[i])session.submit(i,row.frame,row.inputs[i]);}
   if(m.checkpoint)syncCheckpoint(m.checkpoint);for(const [i,e] of (m.events||[]).entries())if(['finish','round'].includes(e.kind)||(e.kind==='skill'&&e.slot!==slot))eventsFrom([e],e.id||m.serverFrame+':'+i);break;
  case 'match_complete':if(role!=='player'||!session||m.matchId!==matchId)return;networkComplete=true;if(m.checkpoint){session.hardSync(m.checkpoint.frame,m.checkpoint.state);pending=null;state=session.game;}finish(state);updateSkillUI(state?.players?.[slot]);break;
  case 'watch_complete':if(role!=='spectator'||m.matchId!==matchId)return;prevState=state;state=m.game;serverFrame=m.serverFrame;finish(state);break;
  case 'peer_left':session=null;waiting=true;networkComplete=true;matchDone=false;status(m.message||'有玩家離線');overlay('有選手離線',m.message||'等候玩家重新入場。');$('rematch').disabled=true;break;
  case 'watch_end':waiting=true;watching=false;matchDone=false;networkComplete=true;status(m.message||'本場比賽結束');overlay('比賽已中止','有選手離線，請等待重新配對。');break;
  case 'rematch_status':status(`再戰確認：${m.votes}/${m.needed} 位選手同意，四人全數同意後自動開始`);break;
  case 'pong':if(Number.isFinite(m.sentAt)){const sample=Math.max(0,performance.now()-m.sentAt);rtt=rtt?rtt*.72+sample*.28:sample;delay=Math.max(3,Math.min(8,Math.ceil(rtt/33)+1))}break;
  case 'error':status(m.message||'房間發生錯誤');if(ws&&slot<0){const failed=ws;ws=null;failed.close();$('joinButton').disabled=false}break;
 }}
 const NAME_KEY='azhi_player_nickname';
 function checkNickname(input){if(typeof input!=='string')return null;const v=input.normalize('NFKC').trim().replace(/\s+/gu,' ');return Array.from(v).length>=2&&Array.from(v).length<=16&&/^[\p{L}\p{N} _.-]+$/u.test(v)&&!/^(admin|administrator|moderator|staff|system|官方|管理員|系統|客服)$/iu.test(v)?v:null}
 function checkTitle(input){if(typeof input!=='string')return null;const v=input.normalize('NFKC').trim().replace(/\s+/gu,' ');return Array.from(v).length>=2&&Array.from(v).length<=24&&/^[\p{L}\p{N} _.-]+$/u.test(v)&&!/^(admin|administrator|moderator|staff|system|官方|管理員|系統|客服)$/iu.test(v)?v:null}
 function rememberNickname(n){try{localStorage.setItem(NAME_KEY,n)}catch{}}
 function nameChange(){const n=checkNickname($('playerNickname').value);if(!n){status('暱稱需 2–16 字，不能包含特殊控制字元');return}onlineName=n;rememberNickname(n);$('playerNickname').value=n;
  if(ws?.readyState===WebSocket.OPEN&&room){ws.send(JSON.stringify({type:'set_name',name:n}));status('正在更新暱稱…')}else status('已儲存暱稱：'+n)}
 function titleChange(){if(!isHost||!ws||ws.readyState!==WebSocket.OPEN){status('只有房主能更改房名');return}const title=checkTitle($('roomTitleInput').value);if(!title){status('房名需 2–24 字，不可包含特殊字元');return}ws.send(JSON.stringify({type:'set_title',title}));status('正在更新房間名稱…')}
 function connect(){if(location.protocol==='file:'){status('線上模式需要從 VPS 網址開啟，不能用 file://');return}
  if(ws){status('已連線，如需重新加入請先離開房間。');return}
  const requested=$('roomCode').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
  if(role==='spectator'&&!requested){status('觀戰需要輸入既有房號。');return}
  const displayName=checkNickname($('playerNickname').value);if(!displayName){status('請設定 2–16 字有效暱稱（中英文字、數字、空格、_ . -）');$('playerNickname').focus();return}
  onlineName=displayName;rememberNickname(onlineName);
  const title=role==='player'&&(!requested)?checkTitle($('roomTitleInput').value||'海線格鬥房'):'海線格鬥房';
  if(!title){status('房間名稱需 2–24 字，不能包含特殊符號');$('roomTitleInput').focus();return}
  const url=(location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws';let socket;
  try{socket=new WebSocket(url)}catch(e){status('WebSocket 失敗：'+e.message);return}
  ws=socket;$('joinButton').disabled=true;status('正在連線到 60Hz 格鬥伺服器…');
  socket.onopen=()=>{if(socket!==ws)return;socket.send(JSON.stringify(role==='spectator'?{type:'watch',room:requested,name:onlineName}:{type:'join',mode:'team',room:requested,char:selected,name:onlineName,title}));status('已連線，等待房間回應。')};
  socket.onmessage=e=>{if(socket!==ws)return;let m;try{m=JSON.parse(e.data)}catch{return}onMessage(m)};
  socket.onerror=()=>{if(socket!==ws)return;status('連線錯誤：請檢查 VPS /ws 反向代理。')};
  socket.onclose=()=>{if(socket!==ws)return;ws=null;session=null;networkComplete=true;$('joinButton').disabled=false;$('applyNickname').disabled=true;$('applyRoomTitle').disabled=true;$('roomTitleInput').disabled=false;slot=-1;waiting=true;status('連線已中斷。可使用原房號重新加入。');overlay('連線已中斷','檢查網路連線後重新連接。')};
 }
 function tick(){if(!session||!ws||ws.readyState!==WebSocket.OPEN||slot<0||networkComplete)return;
 if(performance.now()-lastPacket>6000){status('超過 6 秒沒有收到更新，請檢查連線。');return}
 // Predicted endings must keep logical frames moving until authoritative confirmation.
 const frame=Math.max(session.frame,serverFrame)+delay+1;
 const keys={};for(const [k,v] of Object.entries(pressed))if(v)keys[k]=true;
 const input={keys,pulses:pulses.splice(0,4)};
 session.submit(slot,frame,input);
 ws.send(JSON.stringify({type:'input',matchId,frame,...input}));
 prevState=state?{...state,players:state.players?.map(p=>({...p}))}:null;
 const events=session.advance();state=session.game;for(const [i,e] of events.entries())if(e.kind==='hit'||e.kind==='super'||e.kind==='skill')eventsFrom([e],session.frame+':'+i);
 let catchup=0;while(session.frame<serverFrame+delay&&catchup<3){session.advance();catchup++}
 if(pending&&pending.frame<=session.frame)syncCheckpoint(pending);state=session.game;
 }
 function keyPressed(e,on){const k=keyMap[e.code];if(!k||role==='spectator'||slot<0||!session)return;if(e.metaKey||e.ctrlKey||e.altKey||(document.activeElement?.tagName==='BUTTON'&&e.code==='Space'))return;
 if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;e.preventDefault();const old=!!pressed[k];pressed[k]=on;
 if(on&&!old&&attackKeys.has(k))pulses.push(k);if(on){soundEnabled=true;try{audio?.resume()}catch{}}
 }
 addEventListener('keydown',e=>keyPressed(e,true),{capture:true});addEventListener('keyup',e=>keyPressed(e,false),{capture:true});
 function clearHeld(){Object.keys(pressed).forEach(k=>pressed[k]=false);pulses=[];for(const button of document.querySelectorAll('[data-key]'))button.classList.remove('held')}
 addEventListener('blur',clearHeld);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearHeld()});
 for(const b of document.querySelectorAll('[data-key]')){const k=b.dataset.key;
  b.addEventListener('pointerdown',e=>{if(role==='spectator'||slot<0||!session||networkComplete)return;e.preventDefault();b.setPointerCapture(e.pointerId);const was=!!pressed[k];pressed[k]=true;if(!was&&attackKeys.has(k))pulses.push(k);soundEnabled=true;b.classList.add('held')});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{pressed[k]=false;b.classList.remove('held')});
 }
 function drawStage(now){const id=state?.stage||'night',img=stages[id];if(img?.complete&&img.naturalWidth)ctx.drawImage(img,0,0,960,540);else{const grad=ctx.createLinearGradient(0,0,0,540);grad.addColorStop(0,'#111a3a');grad.addColorStop(1,'#432846');ctx.fillStyle=grad;ctx.fillRect(0,0,960,540)}
 const shade=ctx.createLinearGradient(0,0,0,540);shade.addColorStop(0,'#070c1744');shade.addColorStop(.65,'#090a1720');shade.addColorStop(1,'#03051170');ctx.fillStyle=shade;ctx.fillRect(0,0,960,540);
 ctx.save();ctx.fillStyle='#050c1e6a';ctx.fillRect(0,420,960,120);const c=now*.3;for(let k=0;k<18;k++){const x=(k*149)%960;ctx.fillStyle=k%2?'#56bfff19':'#ff729e20';ctx.beginPath();ctx.moveTo(x,426);ctx.lineTo(x+5,426);ctx.lineTo(x+Math.sin(c+k)*9+11,538);ctx.lineTo(x+Math.sin(c+k)*9-5,538);ctx.fill()}ctx.restore();}
 function drawFighter(p,now){const image=sprites[p.char]||sprites.azhi;if(!image?.complete||!image.naturalWidth)return;
 const pose=P.fighterPose(state,p,reducedMotion),game=state,winner=game?.ruleset==='team'?game.winnerTeam===(p.team??p.slot%2):game?.winner===p.slot;
 const action=p.hp<=0?'ko':game?.status==='finished'&&winner?'win':p.move?.name?(p.move.name.startsWith('light')?p.move.name:p.move.name==='super'?'special':p.move.name):p.stun>2?'hurt':p.guard?'guard':p.y>1?'jump':p.dash>0?'dash':p.crouch?'low':Math.abs(p.x-(prevState?.players?.[p.slot]?.x??p.x))>.35?'walk':'idle';
 const row=Math.max(0,A.ACTIONS.indexOf(action));const frame=playback.spriteFrame(p,action,now,p.move?.name?C.moveFor(p,p.move.name):null);
 const sw=A.WIDTH,sh=A.HEIGHT,scale=.94,h=sh*scale,w=sw*scale,x=p.x,y=448-(p.y||0)*.82;
 ctx.save();ctx.fillStyle='#0009';ctx.beginPath();ctx.ellipse(x,450,38,9,0,0,Math.PI*2);ctx.fill();ctx.restore();
 ctx.save();ctx.translate(x+pose.dx,y+pose.dy);ctx.rotate(pose.rotation);ctx.scale(pose.scale,pose.scale);ctx.globalAlpha=pose.alpha;if(p.face<0)ctx.scale(-1,1);
 if(p.move?.name==='super'||p.dash>0){ctx.globalAlpha=.25;ctx.drawImage(image,frame*sw,row*sh,sw,sh,-w/2-28,-h+28,w,h);ctx.globalAlpha=1}
 if(p.move?.name==='heavy')ctx.scale(1.06,.98);if(p.move?.name==='upper')ctx.scale(.96,1.04);
 if(p.flash>0){ctx.shadowBlur=22;ctx.shadowColor='#fff';ctx.globalAlpha=p.flash%2===0?.73:.94}
 else if(p.move?.name==='super'){ctx.shadowBlur=30;ctx.shadowColor=C.CHAR[p.char]?.accent||'#fff'}
 ctx.drawImage(image,frame*sw,row*sh,sw,sh,-w/2,-h+28,w,h);ctx.restore();
 const side=p.team??(p.slot%2),txt=(playerNames.find(n=>n.slot===p.slot)?.name||((side?'B':'A')+(Math.floor(p.slot/2)+1)));ctx.save();ctx.font='900 17px system-ui';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#091126';ctx.strokeText(txt,x,y-h+24);ctx.fillStyle=side?'#84e5ff':'#ffb3ba';ctx.fillText(txt,x,y-h+24);if(p.hp<=0){ctx.font='900 29px system-ui';ctx.strokeText('KO',x,y-116);ctx.fillStyle='#ffda76';ctx.fillText('KO',x,y-116)}ctx.restore();}
 function drawProjectile(p,now){const x=p.x,y=448-p.y*.82;ctx.save();ctx.globalCompositeOperation='lighter';ctx.translate(x,y);ctx.rotate(now*8);ctx.shadowBlur=25;ctx.shadowColor='#8d94ff';ctx.fillStyle=p.kind==='wave'?'#ffe1a3':'#cba4ff';ctx.beginPath();ctx.ellipse(0,0,p.w*.7,p.h*.7,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.stroke();ctx.restore()}
 function drawHitboxes(p){const hurt=C.Boxes.hurtbox(p);ctx.save();ctx.lineWidth=2;ctx.strokeStyle='#59f1d1';ctx.fillStyle='#4affa81c';ctx.fillRect(hurt.x,448-(hurt.y+hurt.h)*.82,hurt.w,hurt.h*.82);ctx.strokeRect(hurt.x,448-(hurt.y+hurt.h)*.82,hurt.w,hurt.h*.82);
 if(p.move?.name){const d=C.moveFor(p,p.move.name);if(p.move.frame>=d.start&&p.move.frame<d.start+d.active){const hit=C.Boxes.hitbox(p,d);ctx.strokeStyle='#fb658b';ctx.fillStyle='#ff608929';ctx.fillRect(hit.x,448-(hit.y+hit.h)*.82,hit.w,hit.h*.82);ctx.strokeRect(hit.x,448-(hit.y+hit.h)*.82,hit.w,hit.h*.82)}}ctx.restore();}
 function drawEffects(now){effects=effects.filter(e=>now-e.at<460);for(const e of effects){const age=(now-e.at)/460,r=e.r*(.75+age*.95);ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.max(0,1-age);const grad=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,r);grad.addColorStop(0,'#fff');grad.addColorStop(.2,e.color);grad.addColorStop(1,e.color+'00');ctx.fillStyle=grad;ctx.beginPath();ctx.arc(e.x,e.y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=e.color;ctx.lineWidth=4*(1-age);ctx.beginPath();ctx.arc(e.x,e.y,r*.82,0,Math.PI*2);ctx.stroke();ctx.restore()}}
 function render(now){const t=now/1000;const age=performance.now()-lastPacket;
 const view=battleCamera.update(state?.players, lastDraw?(now-lastDraw)/1000:1/60,reducedMotion||!!P.intro(state));lastDraw=now;ctx.save();ctx.clearRect(0,0,960,540);battleCamera.apply(ctx,view);if(shake>0&&!reducedMotion){ctx.translate(Math.sin(now*.084)*shake*.4,Math.cos(now*.061)*shake*.26);shake=Math.max(0,shake-.47)}drawStage(t);
 let players=state?.players||[{slot:0,team:0,char:'azhi',x:190,y:0,face:1,hp:100},{slot:1,team:1,char:'gambler',x:760,y:0,face:-1,hp:100},{slot:2,team:0,char:'sezi',x:340,y:0,face:1,hp:100},{slot:3,team:1,char:'winnie',x:610,y:0,face:-1,hp:100}];
 if(role==='spectator'&&prevState?.players&&age<70&&state?.players){const ratio=Math.min(1,age/70);players=players.map((p,i)=>{const b=prevState.players[i];return b?{...p,x:b.x+(p.x-b.x)*ratio,y:b.y+(p.y-b.y)*ratio}:p})}
 for(const p of [...players].sort((a,b)=>b.y-a.y||a.x-b.x))drawFighter(p,t);
 for(const p of state?.projectiles||[])drawProjectile(p,t);if(showBoxes)for(const p of players)drawHitboxes(p);
 if(visualEffects){drawEffects(performance.now());skillFX.draw(ctx,performance.now(),{groundY:448,yScale:.82})}ctx.restore();P.drawEntrance(ctx,state,{reducedMotion});if(flash>0&&!reducedMotion){ctx.fillStyle='rgba(255,236,196,'+Math.min(.22,flash)+')';ctx.fillRect(0,0,960,540);flash*=.8}
 if(state&&now-lastHud>110){updateHud(state);lastHud=now;}
 }
 function loop(now){const dt=Math.min(.1,(now-lastClock)/1000);lastClock=now;acc+=dt;let steps=0;while(acc>=1/60&&steps++<6){tick();acc-=1/60}if(steps>=6)acc=0;render(now);requestAnimationFrame(loop)}
 $('applyNickname').onclick=nameChange;$('applyRoomTitle').onclick=titleChange;
 $('playerNickname').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();nameChange()}});
 $('roomTitleInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(room)titleChange()}});
 $('playerTab').onclick=()=>{if(ws){status('請先離開房間，再切換模式');return}setRole(false)};
 $('watchTab').onclick=()=>{if(ws){status('請先離開房間，再切換模式');return}setRole(true)};
 $('joinButton').onclick=connect;$('disconnect').onclick=leave;
 $('copyPlayerLink').onclick=()=>room&&copy(link(false));$('copyWatchLink').onclick=()=>room&&copy(link(true));
 $('rematch').onclick=()=>{if(role!=='player'||!ws||ws.readyState!==WebSocket.OPEN||slot<0)return;ws.send(JSON.stringify({type:'rematch'}));$('rematch').disabled=true;status('已提出再戰，等待全部四名選手同意。');};
 $('effectToggle').onclick=()=>{visualEffects=!visualEffects;$('effectToggle').textContent='特效：'+(visualEffects?'開':'關')};$('soundToggle').onclick=()=>{audioOn=!audioOn;if(audioOn)soundEnabled=true;$('soundToggle').textContent='音效：'+(audioOn?'開':'關')};$('boxToggle').onclick=()=>{showBoxes=!showBoxes;$('boxToggle').classList.toggle('on',showBoxes);$('boxToggle').setAttribute('aria-pressed',String(showBoxes));};
 canvas.addEventListener('pointerdown',()=>{canvas.focus({preventScroll:true});soundEnabled=true});
 setInterval(()=>{if(ws?.readyState===WebSocket.OPEN){const ts=performance.now();ws.send(JSON.stringify({type:'ping',sentAt:ts}))}},2000);
 setInterval(renderNetwork,550);
 try{onlineName=localStorage.getItem(NAME_KEY)||''}catch{}if(!checkNickname(onlineName))onlineName='旅人'+String(Math.floor(Math.random()*9000)+1000);
 $('playerNickname').value=onlineName;$('roomTitleInput').value='海線格鬥房';
 const qs=new URLSearchParams(location.search);const watch=qs.get('watch')==='1';$('roomCode').value=(qs.get('room')||'').replace(/[^0-9a-zA-Z]/g,'').slice(0,8);setRole(watch);renderRoster();renderNetwork();requestAnimationFrame(loop);if(watch&&$('roomCode').value)setTimeout(connect,100);
 window.AzhiTeamDebug={get session(){return session},get game(){return state},get role(){return role},get room(){return room},get slot(){return slot},get frame(){return serverFrame},get skillFX(){return skillFX}};
})();
