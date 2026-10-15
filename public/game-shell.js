/* Arcade menu/navigation adapter. Existing controls retain their IDs and gameplay handlers. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id),team=document.body.classList.contains('team-page'),gameAPI=window.AzhiGame;
 const battle=document.querySelector(team?'.board':'.game-panel');if(!battle||!gameAPI||!window.AzhiGameFlow)return;
 const labels={home:'主選單',fighters:'選擇角色',room:'對戰房間',settings:'遊戲設定',guide:'操作與招式'};
 const flow=window.AzhiGameFlow.create({mode:gameAPI.mode});
 let panel='home',lastNotice='',noticeUntil=0,navigating=false,lastMenuSound=-Infinity;
 const entries=[
  {id:'arcade',name:'街機闖關',english:'ARCADE / STORY',note:'五關街機挑戰。選好角色，走進你的下一場。'},
  {id:'practice',name:'自由練習',english:'TRAINING',note:'研究走位與連段。一鍵必殺，練到順手再上場。'},
  {id:'online',name:'好友對戰',english:'VERSUS / 1 VS 1',note:'建立或加入房間，全員 Ready 後由房主開賽。'},
  {id:'multiplayer',name:'團隊・觀戰',english:'2 VS 2 / LIVE',note:'四人同場，或使用房號進入只讀觀戰席。'},
  {id:'settings',name:'遊戲設定',english:'SETTINGS',note:'調整音效、打擊特效與畫面。找出你的戰鬥節奏。'},
  {id:'guide',name:'操作與招式',english:'HOW TO PLAY',note:'查看真實招式幀表、單鍵技能與接技提示。'}
 ];
 let selectedEntry=['team','spectator'].includes(gameAPI.mode)?'multiplayer':gameAPI.mode;
 const move=(element,destination)=>{if(element)destination.append(element);};
 const bar=document.createElement('header');bar.className='app-bar';bar.innerHTML='<button class="app-brand" type="button" data-panel="home" aria-label="開啟主選單"><span class="brand-icon">武</span><strong>陪公子練武</strong></button><span class="app-status" id="appStatus" role="status"></span><nav class="app-actions" aria-label="遊戲選單"></nav>';
 const menu=document.createElement('dialog');menu.className='app-menu';menu.id='appMenu';menu.setAttribute('aria-labelledby','appMenuTitle');
 menu.innerHTML='<div class="app-menu-frame"><header class="app-menu-head"><div><small>陪公子練武 / SPAR WITH THE YOUNG MASTER</small><h2 id="appMenuTitle">主選單</h2></div><div class="app-menu-back"><button type="button" data-home>← 主選單</button><button type="button" data-close aria-label="關閉選單並返回擂台">返回擂台 ×</button></div></header><nav class="app-tabs" role="tablist" aria-label="遊戲面板"></nav><div class="app-menu-body"></div></div>';
 document.body.append(menu);
 const tabs=menu.querySelector('.app-tabs'),body=menu.querySelector('.app-menu-body'),panes={};
 const foot=document.createElement('footer');foot.className='app-menu-foot';foot.hidden=true;
 foot.innerHTML='<div class="app-confirm-info"><small id="appConfirmMode"></small><span class="app-selection-summary" id="appConfirmSummary"></span></div>';menu.querySelector('.app-menu-frame').append(foot);
 for(const [name,label] of Object.entries(labels)){
  const button=document.createElement('button');button.type='button';button.dataset.panel=name;button.textContent=label;button.id='appTab-'+name;button.setAttribute('role','tab');button.setAttribute('aria-controls','appPane-'+name);tabs.append(button);
  const pane=document.createElement('section');pane.className='app-pane';pane.dataset.pane=name;pane.id='appPane-'+name;pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',button.id);panes[name]=pane;body.append(pane);
  if(name!=='guide'){const action=document.createElement('button');action.type='button';action.dataset.panel=name;action.textContent=name==='home'?'主選單':name==='fighters'?'選角':name==='room'?'房間':'設定';bar.querySelector('.app-actions').append(action);}
 }
 const fullButton=document.createElement('button');fullButton.type='button';fullButton.dataset.fullscreen='';fullButton.textContent='⛶';fullButton.setAttribute('aria-label','切換瀏覽器全螢幕');bar.querySelector('.app-actions').append(fullButton);
 panes.home.innerHTML='<div class="app-home arcade-home"><section class="arcade-keyart" aria-label="陪公子練武角色主視覺"><small class="arcade-edition">ARCADE FIGHTING GAME / 2.0</small><h1 class="arcade-wordmark"><span class="wordmark-big">陪公子</span><span class="wordmark-real">練武</span></h1><p class="arcade-subtitle">有請公子，上擂台</p><img class="arcade-support-hero" width="768" height="1024" alt="" aria-hidden="true"><img class="arcade-hero" width="768" height="1024" alt="" fetchpriority="high"><div class="arcade-hero-caption"><small>ALL TALK. ALL FIGHT.</small><strong>公子，該練武了。</strong></div><div class="arcade-stamp" aria-hidden="true">4 FIGHTERS<br>ONE ARENA</div><div class="arcade-ticker" aria-hidden="true">陪公子練武 / SPAR WITH THE YOUNG MASTER　／　陪公子練武 / SPAR WITH THE YOUNG MASTER　／　陪公子練武 / SPAR WITH THE YOUNG MASTER</div></section><section class="arcade-navigation" aria-labelledby="appModeTitle"><header class="arcade-nav-heading"><small>MAIN MENU / SELECT YOUR NEXT MOVE</small><h2 id="appModeTitle">選擇戰鬥模式</h2></header><div id="arcadeMenuOptions" class="arcade-options" aria-label="主選單"></div><p class="arcade-nav-note" id="arcadeMenuNote" aria-live="polite"></p><div class="arcade-controls"><div class="arcade-key-hints"><span><kbd>↑</kbd><kbd>↓</kbd> 選擇</span><span><kbd>Enter</kbd> 確認</span><span><kbd>Esc</kbd> 返回</span></div><button type="button" class="arcade-enter" id="arcadeEnter">進入街機闖關 <span>↗</span></button><button type="button" class="secondary" id="appResume" data-close hidden>繼續目前對戰 →</button></div><div id="appHomeModes" hidden aria-hidden="true"></div></section></div>';
 const hero=panes.home.querySelector('.arcade-hero'),supportHero=panes.home.querySelector('.arcade-support-hero'),Art=window.AzhiCharacterArt;
 function refreshHero(){Art.bindImage(hero,'azhi','fullbody');Art.bindImage(supportHero,'gambler','fullbody');}
 refreshHero();
 const optionList=$('arcadeMenuOptions');
 for(const [index,entry] of entries.entries()){
  const button=document.createElement('button');button.type='button';button.className='arcade-option';button.dataset.menuEntry=entry.id;button.setAttribute('aria-describedby','arcadeMenuNote');
  button.innerHTML='<span class="arcade-option-number">'+String(index+1).padStart(2,'0')+'</span><span class="arcade-option-copy"><strong>'+entry.name+'</strong><small>'+entry.english+'</small></span><span class="arcade-option-arrow" aria-hidden="true">↗</span>';
  button.addEventListener('click',()=>selectEntry(entry.id));button.addEventListener('dblclick',()=>activateEntry());
  button.addEventListener('focus',()=>selectEntry(entry.id));
  optionList.append(button);
 }
 move($('fighterSelect'),panes.fighters);$('fighterSelectTitle').firstChild.textContent='選擇你的角色';
 $('fighterSelect').querySelector('.section-kicker,.section-label').textContent='CHOOSE YOUR FIGHTER';
 if(team){
  const confirm=document.createElement('button');confirm.type='button';confirm.className='primary app-confirm-action';confirm.textContent='前往對戰房間 →';confirm.addEventListener('click',()=>open('room'));foot.append(confirm);
  const aside=document.querySelector('.aside');move(aside?.firstElementChild,panes.room);for(const node of [...(aside?.children||[])])move(node,panes.guide);
  const main=$('teamPlay');for(const node of [...main.children])if(node!==battle&&!node.classList.contains('fighter-select-link'))move(node,panes.guide);
 }else{
  move(document.querySelector('.mode-bar'),$('appHomeModes'));
  move($('progressPanel'),panes.guide);$('mainAction').classList.add('app-confirm-action');move($('mainAction'),foot);
  move($('onlinePanel'),panes.room);move(document.querySelector('.sub-panel'),panes.guide);move(document.querySelector('.training-panel'),panes.guide);
  const roomModes=document.createElement('p');roomModes.innerHTML='<a class="secondary" href="/team.html?panel=room">前往 2v2／觀戰大廳 ↗</a>';roomModes.querySelector('a').addEventListener('click',event=>{event.preventDefault();navigateMode('team')});panes.room.append(roomModes);
 }
 const characterSelect=window.AzhiCharacterSelect.create({pane:panes.fighters,action:foot.querySelector('.app-confirm-action'),game:gameAPI,openRoom:()=>open('room'),playSound:menuSound});
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
 const skip=document.querySelector('.skip-link');if(skip)skip.href=team?'#arenaCanvas':'#stage';const canvas=$(team?'arenaCanvas':'stage');
 function menuSound(type){const now=performance.now();if(type==='move'&&now-lastMenuSound<90)return;lastMenuSound=now;if(gameAPI.soundEnabled)gameAPI.playMenuSound(type);}
 function selectEntry(id,{focus=false,sound=true}={}){
  const entry=entries.find(e=>e.id===id);if(!entry)return;
  const changed=id!==selectedEntry;selectedEntry=id;
  if(['arcade','practice','online'].includes(id))flow.selectMode(id);else if(id==='multiplayer')flow.selectMode('team');
  for(const b of optionList.children){const active=b.dataset.menuEntry===id;b.classList.toggle('is-selected',active);b.setAttribute('aria-current',String(active));b.tabIndex=active?0:-1;}
  $('arcadeMenuNote').textContent=entry.note;$('arcadeEnter').firstChild.textContent='進入'+entry.name+' ';
  if(changed&&sound)menuSound('move');if(focus)optionList.querySelector('[data-menu-entry="'+id+'"]').focus({preventScroll:true});
 }
 function busy(){return gameAPI.busy;}
 function navigateMode(mode){
  if(navigating||busy()){if(busy())open('room');return;}
  const url=new URL(['team','spectator'].includes(mode)?'/team.html':'/',location.href);
  if(mode==='spectator')url.searchParams.set('watch','1');else if(mode!=='team')url.searchParams.set('mode',mode);
  url.searchParams.set('panel',['arcade','practice'].includes(mode)?'fighters':'room');url.searchParams.set('char',gameAPI.character);
  navigating=true;$('arcadeEnter').disabled=true;location.assign(url.href);
 }
 function activateEntry(){
  if(panel!=='home'||navigating)return;menuSound('confirm');
  if(selectedEntry==='settings'||selectedEntry==='guide'){open(selectedEntry);return;}
  if(busy()){open('room');return;}
  if(selectedEntry==='multiplayer'){if(team){gameAPI.requestMode('team');open('room')}else navigateMode('team');return;}
  if(team){navigateMode(selectedEntry);return;}
  if(gameAPI.requestMode(selectedEntry))open(selectedEntry==='online'?'room':'fighters');
 }
 $('arcadeEnter').addEventListener('click',activateEntry);
 function refresh(){
  refreshHero();
  const state=gameAPI.game,online=team||gameAPI.mode==='online';
  const mode=({arcade:'街機闖關',practice:'自由練習',online:'好友 1v1',team:'四人團隊',spectator:'即時觀戰'})[gameAPI.mode]||'主選單';
  $('appStatus').textContent=performance.now()<noticeUntil?lastNotice:mode+(online&&gameAPI.room?' · 房號 '+gameAPI.room:'')+(menu.open&&state?.status==='playing'?(online?' · 對戰持續進行':' · 已暫停'):'');
  $('appResume').hidden=!state;$('appConfirmSummary').textContent=($('selectionSummary')?.textContent||'').replace(/^目前選擇：/,'');$('appConfirmMode').textContent=mode;
  const action=foot.querySelector('.app-confirm-action');if(action&&menu.open&&panel==='fighters')action.textContent=online?(gameAPI.mode==='spectator'?'加入觀戰 →':'前往對戰房間 →'):state?.status==='playing'?'重新開始戰鬥 →':'開始戰鬥 →';
  for(const button of bar.querySelectorAll('[data-panel]'))button.setAttribute('aria-expanded',String(menu.open&&button.dataset.panel===panel));
  characterSelect.refresh();
 }
 function open(name='home'){
  const next=Object.hasOwn(panes,name)?name:'home';if(next!==panel)body.scrollTop=0;panel=next;flow.open(next);
  for(const [key,pane] of Object.entries(panes))pane.hidden=key!==panel;foot.hidden=panel!=='fighters';menu.dataset.panel=panel;
  for(const button of tabs.querySelectorAll('[data-panel]')){const active=button.dataset.panel===panel;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  $('appMenuTitle').textContent=labels[panel];if(panel==='room'&&!team)$('onlinePanel').hidden=false;
  if(!menu.open)menu.showModal();document.body.classList.add('menu-open');
  window.dispatchEvent(new CustomEvent('azhi:menu',{detail:{open:true,panel}}));refresh();
  if(panel==='home')selectEntry(selectedEntry,{focus:true,sound:false});else tabs.querySelector('[data-panel="'+panel+'"]').focus({preventScroll:true});
  if(panel==='fighters')characterSelect.open();else characterSelect.leave();
 }
 function close(){characterSelect.leave();flow.close();if(menu.open)menu.close();document.body.classList.remove('menu-open');window.dispatchEvent(new CustomEvent('azhi:menu',{detail:{open:false,panel}}));refresh();canvas.focus({preventScroll:true});}
 function onBattleStart(detail={}){flow.battleStarted(detail);document.body.dataset.battleMode=detail.mode||'playing';document.body.classList.add('is-playing');close();}
 window.AzhiShell={open,close,onBattleStart,isOpen:()=>menu.open,get currentPanel(){return panel;},get flow(){return flow.snapshot;}};
 for(const element of [bar,tabs])element.addEventListener('click',event=>{const trigger=event.target.closest('[data-panel]');if(trigger)open(trigger.dataset.panel);});
 tabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const list=Object.keys(labels),index=list.indexOf(panel),next=event.key==='Home'?0:event.key==='End'?list.length-1:(index+(event.key==='ArrowRight'?1:-1)+list.length)%list.length;open(list[next]);});
 menu.addEventListener('keydown',event=>{
  // Handle Escape explicitly so repeated native dialog cancel events cannot close a new panel.
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!event.repeat){menuSound('back');if(panel==='home')close();else open('home');}return;}
  if(event.isComposing||event.ctrlKey||event.altKey||event.metaKey)return;
  if(event.key==='Tab'){const focusable=[...menu.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(el=>el.tabIndex>=0&&el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}return;}
  if(panel!=='home'||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  const index=entries.findIndex(e=>e.id===selectedEntry);let next;
  if(['ArrowDown','KeyS','ArrowRight','KeyD'].includes(event.code))next=(index+1)%entries.length;
  if(['ArrowUp','KeyW','ArrowLeft','KeyA'].includes(event.code))next=(index-1+entries.length)%entries.length;
  if(next!==undefined){event.preventDefault();selectEntry(entries[next].id,{focus:true});return;}
  if(['Enter','Space'].includes(event.code)&&event.target.closest('.arcade-option,.arcade-enter')){event.preventDefault();if(!event.repeat)activateEntry();}
 });
 menu.addEventListener('cancel',event=>{event.preventDefault();menuSound('back');if(panel==='home')close();else open('home');});
 menu.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',close));menu.querySelector('[data-home]').addEventListener('click',()=>{menuSound('back');open('home')});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.repeat&&!event.defaultPrevented&&!menu.open){event.preventDefault();open('home');}});
 document.querySelectorAll('[data-fullscreen]').forEach(button=>button.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else throw Error('unsupported');}catch{lastNotice='已使用滿版遊戲；此瀏覽器無法進入全螢幕。';noticeUntil=performance.now()+4000;refresh();}}));
 if(!team){
  $('joinRoom').addEventListener('click',()=>{if(gameAPI.mode!=='online')gameAPI.requestMode('online');},true);
  $('mainAction').addEventListener('click',event=>{if(gameAPI.mode==='online'){event.preventDefault();event.stopImmediatePropagation();open('room');}},true);
 }
 document.querySelectorAll('.fighter-select-link').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();open('fighters');}));
 const observer=new MutationObserver(refresh);let refreshTimer;
 function startRefresh(){observer.observe($('selectionSummary'),{subtree:true,childList:true,characterData:true});clearInterval(refreshTimer);refreshTimer=setInterval(refresh,500);}
 startRefresh();addEventListener('pagehide',()=>{observer.disconnect();clearInterval(refreshTimer)});
 addEventListener('pageshow',event=>{if(event.persisted){navigating=false;$('arcadeEnter').disabled=false;startRefresh();refresh();}});
 const params=new URLSearchParams(location.search),requestedMode=params.has('room')?'online':params.get('mode');
 if(!team&&['arcade','practice','online'].includes(requestedMode))gameAPI.requestMode(requestedMode);
 if(['arcade','practice','online'].includes(gameAPI.mode))selectedEntry=gameAPI.mode;
 selectEntry(selectedEntry,{sound:false});
 open(params.has('room')||params.get('watch')==='1'||params.get('panel')==='room'||requestedMode==='online'?'room':params.get('panel')==='fighters'?'fighters':'home');
 if(team&&gameAPI.game&&gameAPI.room)onBattleStart({mode:gameAPI.mode});
})();
