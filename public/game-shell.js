/* In-game navigation. Existing controls retain their IDs and gameplay handlers. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id),team=document.body.classList.contains('team-page');
 const battle=document.querySelector(team?'.board':'.game-panel');if(!battle)return;
 const labels={home:'遊戲大廳',fighters:'選擇角色',room:'對戰房間',settings:'遊戲設定',guide:'操作與招式'};
 let panel='home',lastNotice='',noticeUntil=0;
 const bar=document.createElement('header');bar.className='app-bar';bar.innerHTML='<button class="app-brand" type="button" data-panel="home" aria-label="開啟遊戲大廳"><span class="brand-icon">狠</span><strong>狠話擂台</strong></button><span class="app-status" id="appStatus" role="status"></span><nav class="app-actions" aria-label="遊戲選單"></nav>';
 const menu=document.createElement('dialog');menu.className='app-menu';menu.id='appMenu';menu.setAttribute('aria-labelledby','appMenuTitle');
 menu.innerHTML='<div class="app-menu-frame"><header class="app-menu-head"><div><small>BIG TALK / REAL FIGHT</small><h2 id="appMenuTitle">遊戲大廳</h2></div><button type="button" data-close aria-label="關閉選單並返回擂台">返回擂台 ×</button></header><nav class="app-tabs" role="tablist" aria-label="遊戲面板"></nav><div class="app-menu-body"></div></div>';
 document.body.append(menu);
 const tabs=menu.querySelector('.app-tabs'),body=menu.querySelector('.app-menu-body'),panes={};
 const foot=document.createElement('footer');foot.className='app-menu-foot';foot.hidden=true;
 foot.innerHTML='<span class="app-selection-summary" id="appConfirmSummary"></span>';menu.querySelector('.app-menu-frame').append(foot);
 for(const [name,label] of Object.entries(labels)){
  const button=document.createElement('button');button.type='button';button.dataset.panel=name;button.textContent=label;button.id='appTab-'+name;button.setAttribute('role','tab');button.setAttribute('aria-controls','appPane-'+name);tabs.append(button);
  const pane=document.createElement('section');pane.className='app-pane';pane.dataset.pane=name;pane.id='appPane-'+name;pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',button.id);panes[name]=pane;body.append(pane);
  if(name!=='guide'){const action=document.createElement('button');action.type='button';action.dataset.panel=name;action.textContent=name==='home'?'大廳':name==='fighters'?'選角':name==='room'?'房間':'設定';bar.querySelector('.app-actions').append(action);}
 }
 const fullButton=document.createElement('button');fullButton.type='button';fullButton.dataset.fullscreen='';fullButton.textContent='⛶';fullButton.setAttribute('aria-label','切換瀏覽器全螢幕');bar.querySelector('.app-actions').append(fullButton);
 panes.home.innerHTML='<div class="app-home"><div class="app-home-title"><small>CHOOSE YOUR FIGHT</small><h1>狠話先講，<em>擂台上見。</em></h1><p>選擇模式與角色，一鍵使出專屬狠招。隨時開啟選單調整設定。</p></div><div class="app-home-art" aria-hidden="true"></div><div id="appHomeModes"></div><p class="app-selection-summary" id="appSelectionSummary"></p><button type="button" class="secondary" id="appResume" data-close hidden>繼續目前對戰</button></div>';
 for(const [id,char] of Object.entries(window.AzhiCore.CHAR)){const image=document.createElement('img');image.src='art/portrait_'+id+'.webp?v=895';image.alt=char.name;panes.home.querySelector('.app-home-art').append(image);}
 const move=(element,destination)=>{if(element)destination.append(element);};
 move($('fighterSelect'),panes.fighters);
 if(team){
  const modes=document.createElement('div');modes.className='app-home-actions';modes.innerHTML='<button type="button" data-choose-mode="team">四人團隊對戰<small>2 VS 2 · 全員 Ready 開賽</small></button><button type="button" data-choose-mode="spectator">加入觀戰<small>使用房號觀看 1v1／2v2</small></button><a href="/?mode=arcade">街機闖關<small>五關故事挑戰</small></a><a href="/?mode=practice">自由練習<small>研究你的專屬連段</small></a><a href="/?mode=online&amp;panel=room">好友 1v1<small>建立或加入雙人房間</small></a>';
  $('appHomeModes')?.replaceWith(modes);
  const confirm=document.createElement('button');confirm.type='button';confirm.className='primary app-confirm-action';confirm.textContent='選好了，前往房間';confirm.addEventListener('click',()=>open('room'));foot.append(confirm);
  const aside=document.querySelector('.aside');move(aside?.firstElementChild,panes.room);for(const node of [...(aside?.children||[])])move(node,panes.guide);
  const main=$('teamPlay');for(const node of [...main.children])if(node!==battle&&!node.classList.contains('fighter-select-link'))move(node,panes.guide);
 }else{
  const modes=document.querySelector('.mode-bar');modes.classList.add('app-home-actions');$('appHomeModes')?.replaceWith(modes);
  const teamLink=modes.querySelector('.team-mode');if(teamLink)teamLink.href='/team.html?panel=room';
  move(document.querySelector('.career'),panes.home.querySelector('.app-home'));
  move($('progressPanel'),panes.fighters);$('mainAction').classList.add('app-confirm-action');move($('mainAction'),foot);
  move($('onlinePanel'),panes.room);move(document.querySelector('.sub-panel'),panes.guide);move(document.querySelector('.training-panel'),panes.guide);
  const roomModes=document.createElement('p');roomModes.innerHTML='<a class="secondary" href="/team.html?panel=room">前往 2v2／觀戰大廳 ↗</a>';panes.room.append(roomModes);
 }
 const settingsTitle=document.createElement('h3');settingsTitle.textContent='聲音與畫面';panes.settings.append(settingsTitle);
 const setting=(title,description,element)=>{if(!element)return;const row=document.createElement('div');row.className='app-setting-row';const info=document.createElement('div'),heading=document.createElement('strong'),detail=document.createElement('p');heading.textContent=title;detail.textContent=description;info.append(heading,detail);row.append(info,element);panes.settings.append(row);};
 setting('遊戲音效','切換打擊與介面音效。',$('soundToggle'));
 setting('打擊特效',team?'開關戰鬥中的視覺特效。':'選擇電影級、標準或省電效果。',$(team?'effectToggle':'fxToggle'));
 setting('判定框','練習時顯示攻擊與受擊範圍。',$(team?'boxToggle':'hitboxToggle'));
 const fullscreen=document.createElement('button');fullscreen.type='button';fullscreen.className='secondary';fullscreen.dataset.fullscreen='';fullscreen.textContent='切換全螢幕';setting('瀏覽器全螢幕','可隱藏瀏覽器工具列；不支援時仍使用滿版遊戲。',fullscreen);
 const motionNote=document.createElement('p');motionNote.textContent='選單與效果會配合裝置的「減少動態效果」偏好。';panes.settings.append(motionNote);
 move(document.querySelector('.career-panel'),panes.settings);
 const guideLink=document.createElement('p');guideLink.innerHTML='<a href="/adventure-legacy-6.8.html">經典冒險 6.8 ↗</a>';if(!panes.guide.querySelector('a[href*="adventure-legacy"]'))panes.guide.append(guideLink);
 battle.classList.add('app-battle');document.body.append(bar,battle,menu);document.body.classList.add('game-app');
 const skip=document.querySelector('.skip-link');if(skip)skip.href=team?'#arenaCanvas':'#stage';
 const canvas=$(team?'arenaCanvas':'stage');
 function game(){return team?window.AzhiTeamDebug?.game:window.AzhiDebug?.mode==='online'?window.AzhiDebug.rollback?.game:window.AzhiDebug?.local;}
 function refresh(){
  const state=game(),online=team||window.AzhiDebug?.mode==='online';
  const mode=team?(window.AzhiTeamDebug?.role==='spectator'?'即時觀戰':'四人團隊'):({arcade:'街機闖關',practice:'自由練習',online:'好友 1v1'}[window.AzhiDebug?.mode]||'遊戲大廳');
  const room=team?window.AzhiTeamDebug?.room:$('roomInput')?.value;
  $('appStatus').textContent=performance.now()<noticeUntil?lastNotice:mode+(online&&room?' · 房號 '+room:'')+(menu.open&&state?.status==='playing'?(online?' · 對戰持續進行':' · 已暫停'):'');
  $('appResume').hidden=!state;
  $('appSelectionSummary').textContent=$('selectionSummary')?.textContent||'';
  $('appConfirmSummary').textContent=$('selectionSummary')?.textContent||'';
  const action=$('mainAction');if(action&&menu.open&&panel==='fighters')action.textContent=window.AzhiDebug?.mode==='online'?'選好了，前往房間':state?.status==='playing'?'以此角色重新開始':window.AzhiDebug?.mode==='practice'?'開始自由練習':'開始本關對決';
  for(const button of bar.querySelectorAll('[data-panel]'))button.setAttribute('aria-expanded',String(menu.open&&button.dataset.panel===panel));
 }
 function open(name='home'){
  const next=Object.hasOwn(panes,name)?name:'home';if(next!==panel)body.scrollTop=0;panel=next;
  for(const [key,pane] of Object.entries(panes))pane.hidden=key!==panel;
  foot.hidden=panel!=='fighters';
  for(const button of tabs.querySelectorAll('[data-panel]')){const active=button.dataset.panel===panel;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  $('appMenuTitle').textContent=labels[panel];if(panel==='room'&&!team)$('onlinePanel').hidden=false;
  if(!menu.open)menu.showModal();document.body.classList.add('menu-open');
  window.dispatchEvent(new CustomEvent('azhi:menu',{detail:{open:true,panel}}));refresh();tabs.querySelector('[data-panel="'+panel+'"]').focus({preventScroll:true});
 }
 function close(){if(menu.open)menu.close();document.body.classList.remove('menu-open');window.dispatchEvent(new CustomEvent('azhi:menu',{detail:{open:false,panel}}));refresh();canvas.focus({preventScroll:true});}
 function onBattleStart(detail={}){document.body.dataset.battleMode=detail.mode||'playing';document.body.classList.add('is-playing');close();}
 window.AzhiShell={open,close,onBattleStart,isOpen:()=>menu.open,get currentPanel(){return panel;}};
 for(const element of [bar,tabs])element.addEventListener('click',event=>{const trigger=event.target.closest('[data-panel]');if(trigger)open(trigger.dataset.panel);});
 tabs.addEventListener('keydown',event=>{const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(event.key))return;event.preventDefault();const list=Object.keys(labels),index=list.indexOf(panel),next=event.key==='Home'?0:event.key==='End'?list.length-1:(index+(event.key==='ArrowRight'?1:-1)+list.length)%list.length;open(list[next]);});
 menu.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const focusable=[...menu.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(el=>el.tabIndex>=0&&el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}});
 menu.addEventListener('cancel',event=>{event.preventDefault();close();});menu.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',close));
 menu.addEventListener('click',event=>{if(event.target===menu){const box=menu.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.open){event.preventDefault();open('home');}});
 document.querySelectorAll('[data-fullscreen]').forEach(button=>button.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else throw Error('unsupported');}catch{lastNotice='已使用滿版遊戲；此瀏覽器無法進入全螢幕。';noticeUntil=performance.now()+4000;refresh();}}));
 if(team){
  for(const button of panes.home.querySelectorAll('[data-choose-mode]'))button.addEventListener('click',()=>{if(window.AzhiTeamDebug?.room){open('room');return}$(button.dataset.chooseMode==='spectator'?'watchTab':'playerTab').click();open('fighters');if(button.dataset.chooseMode==='spectator')open('room');});
 }else{
  for(const button of panes.home.querySelectorAll('[data-mode],.team-mode')){
   button.addEventListener('click',event=>{if(window.AzhiDebug?.mode==='online'&&($('leaveRoom')&&!$('leaveRoom').disabled)){event.preventDefault();event.stopImmediatePropagation();open('room');}},true);
   if(button.dataset.mode)button.addEventListener('click',()=>open('fighters'));
  }
  $('joinRoom').addEventListener('click',()=>{if(window.AzhiDebug.mode!=='online')window.dispatchEvent(new CustomEvent('azhi:request-mode',{detail:{mode:'online'}}));},true);
  $('mainAction').addEventListener('click',event=>{if(window.AzhiDebug.mode==='online'){event.preventDefault();event.stopImmediatePropagation();open('room');}},true);
 }
 document.querySelectorAll('.fighter-select-link').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();open('fighters');}));
 new MutationObserver(refresh).observe($('selectionSummary'),{subtree:true,childList:true,characterData:true});
 setInterval(refresh,500);
 const params=new URLSearchParams(location.search),requestedMode=params.has('room')?'online':params.get('mode');
 if(!team&&['arcade','practice','online'].includes(requestedMode))window.dispatchEvent(new CustomEvent('azhi:request-mode',{detail:{mode:requestedMode}}));
 open(params.has('room')||params.get('watch')==='1'||params.get('panel')==='room'||requestedMode==='online'?'room':requestedMode?'fighters':'home');
 if(team&&(window.AzhiTeamDebug?.session||window.AzhiTeamDebug?.frame>0))onBattleStart({mode:window.AzhiTeamDebug.role});
})();
