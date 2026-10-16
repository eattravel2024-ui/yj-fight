/* UI adapter only. Room membership, character acknowledgements and Ready stay server-owned. */
'use strict';
window.AzhiCustomRoom={create({pane,game,team,open,changeMode}){
 const $=id=>document.getElementById(id),Art=window.AzhiCharacterArt,C=window.AzhiCore;
 const ids=team?{root:'.panel',name:'playerNickname',rename:'applyNickname',title:'roomTitleInput',retitle:'applyRoomTitle',code:'roomCode',join:'joinButton',status:'roomStatus',titleDisplay:'roomTitleDisplay',diagnostics:'diagnostics',leave:'disconnect',rematch:'rematch',invite:'copyPlayerLink',watch:'copyWatchLink'}:{root:'#onlinePanel',name:'onlineNickname',rename:'updateOnlineNickname',title:'onlineRoomTitle',retitle:'updateOnlineRoomTitle',code:'roomInput',join:'joinRoom',status:'netMessage',titleDisplay:'onlineRoomTitleDisplay',diagnostics:'netDiagnostics',leave:'leaveRoom',rematch:'rematchButton',invite:'copyRoom',watch:'copySpectatorLink'};
 const native=pane.querySelector(ids.root);if(!native)return {refresh(){},focus(){}};
 const original=[...native.childNodes],root=document.createElement('div');root.className='custom-room';
 root.innerHTML='<header class="custom-heading"><div><small>CUSTOM MATCH</small><h3>自己的擂台，自己的對手。</h3></div><span>不計排名 · 好友自訂</span></header><div class="custom-modes" role="group" aria-label="自訂對戰類型"><button type="button" data-custom-mode="online"><b>1 VS 1</b><span>雙人對決</span></button><button type="button" data-custom-mode="team"><b>2 VS 2</b><span>四人團隊</span></button><button type="button" data-custom-mode="spectator"><b>LIVE</b><span>輸入房號觀戰</span></button></div><div class="custom-layout"><section class="custom-profile"><div class="custom-player"><img width="768" height="1024" alt=""><div><small>YOUR FIGHTER</small><strong id="customFighterName"></strong><span id="customFighterSkill"></span><button type="button" id="customSelectFighter">更換角色 ↗</button></div></div><div class="custom-name"></div><p class="custom-flow"><b>01</b> 建立或加入房間<br><b>02</b> 選角後按 Ready<br><b>03</b> 全員就位，由房主開賽</p></section><section class="custom-lobby"><div class="custom-access"><div class="custom-create"><div class="custom-room-title"></div><button type="button" id="customCreateRoom" class="primary">＋ 建立新房</button></div><div class="custom-join"><div class="custom-room-code"></div><button type="button" id="customJoinRoom" class="secondary">加入房間 →</button></div><p id="customAccessHint">建立後分享房號或邀請連結，朋友即可加入。</p></div><div class="custom-room-meta" hidden><div><small>ROOM CODE / 房號</small><strong id="customRoomCode"></strong></div><div class="custom-meta-title"></div></div><p class="custom-rules"></p><div class="custom-seats" aria-label="選手席位"></div><div class="custom-status" role="status"></div></section></div><footer class="custom-ready"><div class="custom-ready-main"></div><div class="custom-tools"></div></footer><details class="custom-diagnostics"><summary>房間設定與連線資訊</summary></details>';
 const hidden=document.createElement('div');hidden.hidden=true;hidden.className='custom-native';hidden.append(...original);native.append(root,hidden);native.classList.add('custom-native-root');
 const field=(container,id,label,button)=>{const holder=root.querySelector(container),caption=document.createElement('label'),row=document.createElement('div');caption.htmlFor=id;caption.textContent=label;row.className='custom-field';row.append($(id));if(button)row.append($(button));holder.append(caption,row);};
 const entry=document.createElement('dialog');entry.className='room-entry';entry.setAttribute('aria-labelledby','roomEntryTitle');entry.innerHTML='<h3 id="roomEntryTitle">建立你的擂台</h3><p>輸入必要資訊後，連接真實對戰伺服器。</p><div class="room-entry-fields"></div><div class="room-entry-actions"><button type="button" data-entry-cancel class="secondary">取消</button><button type="button" data-entry-confirm class="primary">連接擂台 →</button></div>';document.body.append(entry);
 field('.custom-name',ids.name,'玩家暱稱',ids.rename);field('.custom-room-title',ids.title,'房間名稱',ids.retitle);field('.custom-room-code',ids.code,'已有房號？輸入後加入');$(ids.code).placeholder='例如 ABC123';
 const fields=['.custom-name','.custom-room-title','.custom-room-code'].map(selector=>root.querySelector(selector));for(const field of fields)entry.querySelector('.room-entry-fields').append(field);fields[0].style.display='block';let entryIntent='create';
 function editRoom(intent){entryIntent=intent;entry.querySelector('h3').textContent=intent==='create'?'建立你的擂台':intent==='join'?'輸入好友房號':'玩家與房間設定';fields[1].hidden=intent==='join';fields[2].hidden=intent!=='join';access.hidden=intent==='join';entry.querySelector('[data-entry-confirm]').hidden=intent==='settings';entry.showModal();fields[intent==='join'?2:0].querySelector('input').focus();}
 entry.querySelector('[data-entry-cancel]').onclick=()=>entry.close();entry.querySelector('[data-entry-confirm]').onclick=()=>{if(connect(entryIntent)!==false)entry.close();};entry.addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();entry.close();});
 const access=document.createElement('div');access.className='room-permissions';access.innerHTML='<label><input id="customPrivate" type="checkbox"> 私人房間（需要登入與房號）</label><label><input id="customSpectators" type="checkbox" checked> 允許觀戰</label><small>對戰進行中鎖定權限。房號即為邀請碼，請只分享給朋友。</small>';entry.querySelector('.room-entry-fields').append(access);for(const input of access.querySelectorAll('input'))input.addEventListener('change',()=>{if(game.room)game.setRoomAccess?.({private:$('customPrivate').checked,spectatorsAllowed:$('customSpectators').checked});});
 const edit=document.createElement('button');edit.type='button';edit.id='customEditRoom';edit.textContent='玩家／房間設定';edit.onclick=()=>editRoom('settings');root.querySelector('.custom-tools').append(edit);
 root.querySelector('.custom-status').append($(ids.status));root.querySelector('.custom-meta-title').append($(ids.titleDisplay));
 const ready=root.querySelector('.custom-ready-main'),summary=$('readySummary'),roster=$('readyRoster'),actions=document.createElement('div');actions.className='custom-ready-actions';actions.append($('readyButton'),$('startMatchButton'),$(ids.rematch));ready.append(summary,actions,roster);roster.hidden=true;
 const tools=root.querySelector('.custom-tools');tools.append($(ids.invite),$(ids.watch),$(ids.leave));root.querySelector('.custom-diagnostics').append($(ids.diagnostics));
 if(team){const people=document.createElement('div');people.className='custom-audience';people.append($('spectatorCount'),$('spectatorNames'));root.querySelector('.custom-lobby').append(people);}
 const pic=root.querySelector('.custom-player img'),seats=root.querySelector('.custom-seats'),modeButtons=[...root.querySelectorAll('[data-custom-mode]')];let artKey='',seatKey='',lastBusy=null;
 const write=(node,value)=>{if(node.textContent!==String(value))node.textContent=value;};
 function selectMode(next){
  if(game.busy){write($('customAccessHint'),'請先離開目前房間，再切換對戰類型。');return;}
  if(next==='online'){if(team)changeMode('online');else game.requestMode('online');}
  else if(team)game.requestMode(next);else changeMode(next);
  refresh();
 }
 for(const button of modeButtons)button.onclick=()=>selectMode(button.dataset.customMode);
 $('customSelectFighter').onclick=()=>{if(!team&&game.mode!=='online'&&!game.requestMode('online'))return;open('fighters');};
 function connect(intent){
  if(game.busy)return false;
  if(intent==='create')$(ids.code).value='';
  else if(!$(ids.code).value.trim()){write($(ids.status),'請輸入朋友提供的房號。');$(ids.code).focus();return false;}
  game.connectRoom(intent);refresh();
 }
 $('customCreateRoom').onclick=()=>editRoom('create');$('customJoinRoom').onclick=()=>editRoom('join');
 $(ids.code).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();connect('join');}});
 function refresh(){
  const context=game.selectionContext(),spectating=game.mode==='spectator',players=context.players||[],needed=context.needed||(team?4:2),connected=!!game.room,busy=game.busy,mode=team?game.mode:'online';
  for(const button of modeButtons){button.setAttribute('aria-pressed',String(button.dataset.customMode===mode));button.disabled=busy;}
  const fighter=C.CHAR[game.character];write($('customFighterName'),spectating?'觀戰席':fighter.name);write($('customFighterSkill'),spectating?'只讀觀戰 · 不占選手席':fighter.special);
  if(artKey!==game.character){artKey=game.character;Art.bindImage(pic,artKey,'fullbody');}pic.hidden=spectating;$('customSelectFighter').disabled=spectating||context.phase==='playing';
  if(connected&&entry.open&&entryIntent!=='settings')entry.close();
  const host=players.find(p=>p.slot===context.selfSlot)?.host;const inMatch=context.phase==='playing';$('customPrivate').disabled=connected?(!host||inMatch):!window.AzhiPlayer?.user;$('customSpectators').disabled=connected&&(!host||inMatch);if(connected){$('customPrivate').checked=!!context.private;$('customSpectators').checked=context.spectatorsAllowed!==false;}
  const stage=window.AzhiStages?.get(game.game?.stage);write(root.querySelector('.custom-rules'),context.phase==='playing'&&stage?'STAGE / '+stage.name+' · 伺服器同步對戰':'伺服器抽選正式場景 · 全員 Ready 後由房主開賽');
  const legacyDisabled=$(ids.join).disabled;
  root.querySelector('.custom-create').hidden=spectating;
  $('customCreateRoom').hidden=spectating;$('customCreateRoom').disabled=busy||legacyDisabled;$('customJoinRoom').disabled=busy||legacyDisabled;
  root.dataset.connection=connected?(context.phase==='playing'?'in-match':players.some(p=>p.ready)?'ready':'connected'):busy?'connecting':'empty';
  edit.textContent=connected?'房間／玩家設定':'玩家暱稱';
  root.querySelector('.custom-access').hidden=connected;root.querySelector('.custom-room-meta').hidden=!connected;write($('customRoomCode'),game.room||'');
  $(ids.rename).hidden=!connected;$(ids.retitle).hidden=!connected;
  $(ids.invite).hidden=!connected;$(ids.watch).hidden=!connected;$(ids.leave).hidden=!busy;$(ids.rematch).hidden=!connected||spectating||game.game?.status!=='finished';
  $('readyButton').hidden=spectating;
  if(spectating)write(summary,connected?'觀戰席 · 只讀觀看，不占選手席':'輸入房號，加入正在進行的對戰');else if(!connected)write(summary,'建立或加入房間後，選角並按 Ready');
  const flow=root.querySelector('.custom-flow');const flowMode=spectating?'watch':'play';if(flow.dataset.mode!==flowMode){flow.dataset.mode=flowMode;flow.innerHTML=spectating?'<b>01</b> 輸入朋友的房號<br><b>02</b> 加入觀戰席<br><b>03</b> 只讀觀看，不占選手席':'<b>01</b> 建立或加入房間<br><b>02</b> 選角後按 Ready<br><b>03</b> 全員就位，由房主開賽';}
  if(!busy){write($('customAccessHint'),spectating?'觀戰需要既有房號；可觀看 1v1 或 2v2。':'建立後分享房號或邀請連結，朋友即可加入。');}
  if(lastBusy!==busy){lastBusy=busy;}root.classList.toggle('is-connected',connected);
  const key=JSON.stringify([players,needed,context.selfSlot]);
  if(key!==seatKey){if(seatKey&&game.soundEnabled)game.playMenuSound(players.some(p=>p.ready)?'confirm':'move');seatKey=key;seats.replaceChildren();for(let slot=0;slot<needed;slot++){
   const p=players.find(p=>p.slot===slot),seat=document.createElement('div');seat.className='custom-seat';seat.dataset.ready=String(!!p?.ready);const index=document.createElement('small');index.textContent='P'+(slot+1)+(needed===4?' / '+(slot%2?'藍隊':'紅隊'):'');seat.append(index);
   if(p){const image=document.createElement('img');image.width=56;image.height=56;Art.bindImage(image,p.char,'hud');const copy=document.createElement('div'),name=document.createElement('strong'),char=document.createElement('span'),status=document.createElement('b');name.textContent=(slot===context.selfSlot?'你 · ':'')+p.name+(p.host?' ★':'');char.textContent=C.CHAR[p.char]?.name||'';status.textContent=p.connected===false?'DISCONNECTED':p.ready?'✓ READY':'SELECTING / 尚未準備';copy.append(name,char,status);seat.append(image,copy);}else{const mark=document.createElement('b');mark.className='custom-empty-mark';mark.textContent='＋';const label=document.createElement('span');label.textContent='EMPTY / 等待朋友加入';seat.append(mark,label);}seats.append(seat);
  }}
 }
 return {refresh,focus(){refresh();(game.room?$('readyButton').hidden?$(ids.leave):$('readyButton'):modeButtons.find(b=>b.getAttribute('aria-pressed')==='true'))?.focus({preventScroll:true});}};
}};
