/* Phase 2 UI controller: drafts do not change combat, storage or server-owned Ready. */
'use strict';
window.AzhiCharacterSelect={create({pane,action,game,openRoom,playSound,onLocalConfirm}){
 const C=window.AzhiCore,Art=window.AzhiCharacterArt,ids=Object.keys(C.CHAR),$=s=>pane.querySelector(s);
 const container=$('#fighterSelect'),grid=$('#characterList,#teamCharacters');
 let draft=game.character,active=false,pending=null,timer=null,serial=0,visualKey='',opponentKey='';
 const view=document.createElement('div');view.className='select-screen';
 view.innerHTML='<header class="select-heading"><div><small>CHARACTER SELECT / 選手就位</small><h2>今天，誰來陪公子練武？</h2></div><span class="select-count">04 FIGHTERS<span>ONE GOOD FIGHT.</span></span></header><div class="select-layout"><section class="select-player select-figure" aria-labelledby="selectPlayerName"><div class="select-side-label"><span id="selectPlayerLabel">01 / YOUR FIGHTER</span><b id="selectPlayerBadge">PLAYER</b></div><div class="select-art"><span class="select-giant" aria-hidden="true">1P</span><img id="selectPlayerArt" width="768" height="1024" alt=""></div><div class="select-identity"><small id="selectPlayerTitle"></small><h3 id="selectPlayerName"></h3><p id="selectQuote"></p></div><div class="select-stats" id="selectStats"></div></section><section class="select-center" aria-label="角色列表與技能"><header><span>CHOOSE YOUR FIGHTER</span><b id="selectDraftLabel">選擇角色</b></header><div id="selectRoster"></div><div class="select-skill"><small>FIGHTING STYLE</small><h3 id="selectStyle"></h3><p id="selectDescription"></p><div class="select-move"><kbd>U</kbd><div><strong id="selectSpecial"></strong><p id="selectSpecialInfo"></p></div></div><div class="select-move select-super"><kbd>O</kbd><div><strong id="selectSuper"></strong><p id="selectSuperInfo"></p></div></div></div></section><section class="select-opponent select-figure" aria-labelledby="selectOpponentName"><div class="select-side-label"><span id="selectOpponentLabel">02 / OPPONENT</span><b id="selectOpponentBadge">RIVAL</b></div><div class="select-art"><span class="select-giant" aria-hidden="true">VS</span><img id="selectOpponentArt" width="768" height="1024" alt=""><span class="select-waiting" hidden>？</span></div><div class="select-identity"><small id="selectOpponentTitle"></small><h3 id="selectOpponentName"></h3><p id="selectOpponentStatus"></p></div><div id="selectOnlineRoster" class="select-online-roster"></div></section></div><div class="select-bottom"><span><kbd>←</kbd><kbd>→</kbd> 選擇　<kbd>Enter</kbd> 確認　<kbd>Esc</kbd> 返回</span><p id="selectNotice" role="status" aria-live="polite"></p></div>';
 container.prepend(view);$('#selectRoster').append(grid);
 const text=(selector,value)=>{const el=$(selector);if(el.textContent!==value)el.textContent=value;};
 function animate(el){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;el.animate([{opacity:.25,transform:'translateX(16px)'},{opacity:1,transform:'translateX(0)'}],{duration:280,easing:'ease-out'});}
 function renderPlayer(){
  const c=C.CHAR[draft];if(!c)return;
  if(visualKey!==draft){visualKey=draft;view.style.setProperty('--fighter-accent',c.accent);Art.bindImage($('#selectPlayerArt'),draft,'fullbody');animate($('.select-player'));}
  text('#selectPlayerName',c.name);text('#selectPlayerTitle',c.title);text('#selectQuote','「'+c.entrance.line+'」');text('#selectStyle',c.role);text('#selectDescription',c.desc);
  text('#selectSpecial',c.special);text('#selectSpecialInfo',C.moveFor(draft,'special').cost+' 能量 · '+c.skillDescription);text('#selectSuper',c.superName);text('#selectSuperInfo',C.moveFor(draft,'super').cost+' 能量 · '+c.superDescription);
  const stats=[['招式威力','×'+c.power.toFixed(2),c.power/Math.max(...ids.map(id=>C.CHAR[id].power))],['移動速度',c.speed.toFixed(2)+' px/F',c.speed/Math.max(...ids.map(id=>C.CHAR[id].speed))],['跳躍係數','×'+c.air.toFixed(2),c.air/Math.max(...ids.map(id=>C.CHAR[id].air))]];
  if($('#selectStats').dataset.statsCharacter!==draft){$('#selectStats').dataset.statsCharacter=draft;$('#selectStats').replaceChildren(...stats.map(([label,value,fraction])=>{const row=document.createElement('div');row.className='select-stat';const caption=document.createElement('span');caption.textContent=label;const number=document.createElement('b');number.textContent=value;const rail=document.createElement('i'),fill=document.createElement('i');fill.style.width=fraction*100+'%';if(!matchMedia('(prefers-reduced-motion: reduce)').matches)fill.animate([{width:'0%'},{width:fraction*100+'%'}],{duration:320,easing:'ease-out'});rail.append(fill);row.append(caption,number,rail);return row;}));}
 }
 function renderOpponent(context){
  const p=context.opponent,c=C.CHAR[p?.char],key=p?.char||'waiting',img=$('#selectOpponentArt');
  if(c){if(opponentKey!==key){Art.bindImage(img,p.char,'fullbody');animate($('.select-opponent'));}img.hidden=img.dataset.artStatus==='missing';}else img.hidden=true;
  opponentKey=key;$('.select-waiting').hidden=!!c;
  text('#selectOpponentLabel',context.opponentLabel);text('#selectOpponentName',c?c.name:context.spectator?'等待比賽名單':'等待對手加入');text('#selectOpponentTitle',c?c.title:'WHO WILL STEP UP?');
  text('#selectOpponentStatus',p?(p.status||((p.name||'玩家')+' · '+(context.phase==='playing'?'比賽中':p.ready?'已準備':'尚未準備'))):'建立或加入房間後，顯示實際對手。');
  const roster=$('#selectOnlineRoster'),keyRoster=JSON.stringify(context.players);
  if(roster.dataset.roster!==keyRoster){roster.dataset.roster=keyRoster;roster.replaceChildren(...context.players.map(p=>{const row=document.createElement('div');row.className='select-seat';const pic=document.createElement('img');pic.width=32;pic.height=32;Art.bindImage(pic,p.char,'hud');const caption=document.createElement('span');caption.textContent=(p.slot===context.selfSlot?'你 · ':'')+(p.name||'玩家')+' / '+(C.CHAR[p.char]?.name||'等待')+' · '+(p.ready?'READY':'未準備');row.append(pic,caption);return row;}));}
 }
 function cancel(){serial++;clearTimeout(timer);pending=null;action.disabled=false;view.classList.remove('is-confirming');}
 function reset(){cancel();draft=game.character;visualKey='';}
 function refresh(){
  if(!active)return;const context=game.selectionContext();text('#selectPlayerLabel',context.spectator?'角色資料 / READ ONLY':'01 / YOUR FIGHTER');text('#selectPlayerBadge',context.spectator?'VIEWER':'PLAYER');text('#selectOpponentBadge',context.spectator?'LIVE':'RIVAL');
  if(!context.canSelect&&!pending)draft=game.character;
  if(pending){
   if(game.character===pending.id){const next=pending;pending=null;view.classList.add('is-confirming');text('#selectNotice','已確認：'+C.CHAR[next.id].name);playSound('confirm');timer=setTimeout(()=>{if(active&&next.serial===serial){action.disabled=false;if(context.online)openRoom();else if(onLocalConfirm)onLocalConfirm();else action.onclick?.call(action,new Event('click'));}},matchMedia('(prefers-reduced-motion: reduce)').matches?0:180);}
   else if(performance.now()>pending.until){cancel();text('#selectNotice','尚未收到選角確認，請重試。');}
  }
  renderPlayer();renderOpponent(context);
  for(const b of grid.querySelectorAll('[data-char]')){const preview=b.dataset.char===draft;b.classList.toggle('is-preview',preview);b.classList.toggle('is-confirmed',b.dataset.char===game.character);b.setAttribute('aria-pressed',String(preview));b.tabIndex=preview&&!b.disabled?0:-1;const badge=b.querySelector('.char-number,.selection-badge');if(badge)badge.textContent=preview?'▶ 預覽':b.dataset.char===game.character?'✓ 已確認':'';}
  text('#selectDraftLabel',context.spectator?'觀戰模式':draft===game.character?'目前角色':'角色預覽');
  action.disabled=!!pending||view.classList.contains('is-confirming');
  action.textContent=context.spectator?'返回觀戰房間 →':!context.canSelect?'返回對戰房間 →':context.online?'確認角色・前往房間 →':'確認角色・'+(game.mode==='practice'?'選擇場景':'選擇關卡')+' →';
  const summary=document.getElementById('appConfirmSummary');if(summary)summary.textContent=context.spectator?'觀戰不需選角':C.CHAR[draft].name+' · '+C.CHAR[draft].special;
  if(!pending&&!view.classList.contains('is-confirming')&&!$('#selectNotice').textContent.startsWith('尚未收到'))text('#selectNotice',context.spectator?'觀戰者只能查看角色與比賽名單。':!context.canSelect?'比賽進行中，選角已鎖定。':context.online?'確認選角後，請至房間按 Ready。':'切換卡片預覽，確認後選擇'+(game.mode==='practice'?'場景。':'街機關卡。'));
 }
 function preview(id,{focus=false}={}){if(!active||pending||view.classList.contains('is-confirming')||!game.selectionContext().canSelect||!Object.hasOwn(C.CHAR,id))return;const changed=id!==draft;draft=id;refresh();if(changed)playSound('move');if(focus)grid.querySelector('[data-char="'+id+'"]').focus({preventScroll:true});}
 function confirm(){
  if(pending||view.classList.contains('is-confirming'))return;
  const context=game.selectionContext();if(!context.canSelect){if(context.online)openRoom();return;}
  const id=draft;if(!game.selectCharacter(id)){text('#selectNotice','目前無法更換角色，請回房間確認狀態。');return;}
  pending={id,serial:++serial,until:performance.now()+4000};text('#selectNotice',context.online?'確認選角中…':'角色確認！');refresh();
 }
 grid.addEventListener('pointerover',e=>{const b=e.target.closest('button[data-char]');if(active&&b&&!b.disabled&&!b.contains(e.relatedTarget)&&matchMedia('(hover:hover)').matches)playSound('move');});
 grid.addEventListener('click',e=>{const b=e.target.closest('[data-char]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();preview(b.dataset.char);},true);
 pane.addEventListener('keydown',e=>{if(!active||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select'))return;
  let offset=({ArrowLeft:-1,KeyA:-1,ArrowRight:1,KeyD:1,ArrowUp:-2,KeyW:-2,ArrowDown:2,KeyS:2})[e.code];
  if(offset!==undefined){e.preventDefault();preview(ids[(ids.indexOf(draft)+offset+ids.length)%ids.length],{focus:true});}
  if(['Enter','Space'].includes(e.code)){e.preventDefault();if(!e.repeat)confirm();}
 });
 action.addEventListener('click',e=>{if(!active)return;e.preventDefault();e.stopImmediatePropagation();confirm();},true);
 return {refresh,open(){active=true;reset();refresh();pane.closest('.app-menu-body').scrollTop=0;grid.querySelector('[data-char="'+draft+'"]:not(:disabled)')?.focus({preventScroll:true});},leave(){active=false;reset();},get draft(){return draft;}};
}};
