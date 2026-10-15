'use strict';
(() => {
  const $=id=>document.getElementById(id), C=window.AzhiCore, Anim=window.AzhiAnimation, V=window.AzhiVFX, RB=window.AzhiRollback;
  if(!C||!V||!RB){document.body.textContent='格鬥核心或命中特效引擎載入失敗，請檢查 core.js 與 vfx.js。';return}
  const canvas=$('stage'),ctx=canvas.getContext('2d');
  const P=window.AzhiPresentation,battleCamera=P.createCamera();let drawingGame=null,lastDraw=0;
  const hud=window.AzhiHUD.create();
  const playback=Anim.createPlayback(),motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion=motionQuery.matches;
  const skillFX=window.AzhiSkillFX.create({quality:'high',reducedMotion});
  motionQuery.addEventListener('change',event=>{reducedMotion=event.matches;skillFX.setReducedMotion(reducedMotion)});
  const roster=C.CHAR, actions=['idle','walk','jump','light','heavy','kick','low','upper','throw','dash','guard','hurt','special','ko','win'];
  const stages={night:{name:'逢甲霓虹夜市',img:'art/night.svg'},garage:{name:'夜市改車街',img:'art/garage.svg'},harbor:{name:'港都狠話擂台',img:'art/port-arena.svg'}};
  const chapters=[
    {title:'第一關 · 街頭試煉',detail:'在港都擂台挑戰阿志，練習走位與專屬必殺。',story:'「領薪水之前，先把這場打漂亮！」—— 阿志',enemy:'azhi',stage:'harbor',difficulty:1,reward:120},
    {title:'第二關 · 蜜糖霸主',detail:'面對維尼的高防守，試著使用下段攻擊或摔技。',story:'「正面硬拼可不見得划算。」—— 維尼',enemy:'winnie',stage:'garage',difficulty:2,reward:160},
    {title:'第三關 · 白毛旋風',detail:'塞子擁有高速踢擊與突然的低段進攻。',story:'「旋風登場！跟得上我的腳步再說！」—— 塞子',enemy:'sezi',stage:'harbor',difficulty:2,reward:200},
    {title:'第四關 · 金沙決勝',detail:'對戰金沙賭神，突破擅長遠距壓制的敵人。',story:'「每一次出拳都像下注，出手前要懂得算距離。」—— 金沙賭神',enemy:'gambler',stage:'night',difficulty:3,reward:260},
    {title:'最終關 · 阿志逆轉',detail:'決戰阿志！想當冠軍就要打贏最後的均衡型選手。',story:'「欠打？那就上擂台，看看誰最後還站得住！」—— 阿志',enemy:'azhi',stage:'harbor',difficulty:3,reward:350}
  ];
  const defaultSave={chapter:0,clears:0,coins:0,bestCombo:0,character:'azhi',palette:'classic',purchased:['classic'],sound:true,vfx:'cinema',storyVersion:'four-fighters-2'};
  let save={...defaultSave},selected='azhi',mode='arcade',state=null,ready=false,world='night',ws=null,room='',slot=-1,remote=null,remoteSince=0,pressed={},localPulses=[],prevInputs='',touchHeld={},snapPrev=null,shake=0,flash=0,particles=[],announced=0,lastTick=performance.now(),acc=0,audio=null,soundLock=false,noticeUntil=0,finishedHandled=false,comboAnnounce=0,frameCount=0,visualScale=1;
  const sprites={},backgrounds={};
  let rosterOnline=[],onlineNickname='',onlineIsHost=false;
  let audioEnabled=true;const effects=V.create();
  const confirmedEffects=new Set();let netSession=null,matchId='',serverFrame=0,inputDelay=RB.INPUT_DELAY,netRTT=0,lastPing=0,netPackets=0,netFrozen=false,lastPacketAt=0,pendingCheckpoint=null,netMatchComplete=false;
  const lobby=window.AzhiLobby.create({getSocket:()=>ws,getSlot:()=>slot,getRole:()=> 'player',onCharacter:char=>{selected=char;save.character=char;renderCharacters();}});
  function onlineState(){if(!netSession)return;lastRemote=remote;remote=C.serialize(RB.clone(netSession.game));remote.snapshotHz=60;remoteSince=performance.now();updateHUD(remote);}
  function reconcile(cp){if(!cp||!netSession)return;if(cp.frame>netSession.frame){if(cp.frame-netSession.frame>12){netSession.hardSync(cp.frame,cp.state);pendingCheckpoint=null;return}pendingCheckpoint=cp;return}if(netSession.digest(cp.frame)!==cp.hash)netSession.rebase(cp.frame,cp.state);pendingCheckpoint=null}
  function netStats(){const box=$('netDiagnostics');if(!box)return;box.textContent=netSession?`ROLLBACK ${netSession.rollbacks} 次 · 重算 ${netSession.replayed} F · RTT ${netRTT?Math.round(netRTT)+'ms':'測量中'} · 輸入延遲 ${inputDelay}F · 修正 ${netSession.resyncs} 次 · 本機 ${netSession.frame}F／伺服器 ${serverFrame}F`:'等待連線，尚無同步資料';}
  try{const oldSave=JSON.parse(localStorage.getItem('azhi70_save')||'{}');save={...defaultSave,...oldSave};save.storyVersion='four-fighters-2';if(save.character==='sam')save.character='azhi';save.chapter=Math.max(0,Math.min(chapters.length,Number(save.chapter)||0));selected=roster[save.character]?save.character:'azhi';save.character=selected;save.coins=Math.max(0,Number(save.coins)||0);save.purchased=Array.isArray(save.purchased)?save.purchased:['classic'];audioEnabled=save.sound!==false;effects.setQuality(save.vfx||'cinema');skillFX.setQuality(save.vfx==='low'?'low':'high')}catch{}
  function saveGame(){try{localStorage.setItem('azhi70_save',JSON.stringify(save));$('saveStatus').textContent='進度已保存於目前瀏覽器 · '+new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}catch{$('saveStatus').textContent='瀏覽器禁止儲存，本次進度僅在目前分頁有效'}}
  const handle=(f)=>{try{f()}catch(e){console.error(e);toast('發生操作錯誤，請重新嘗試')}};
  function toast(text){const el=$('toast');el.textContent=text;el.classList.add('visible');clearTimeout(el.timer);el.timer=setTimeout(()=>el.classList.remove('visible'),2600)}
  function sound(type){if(!audioEnabled)return;if(['hit','block','special','heavy','upper','counter','super','ko','light'].includes(type)){effects.sound(type,true);return}try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();let osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime,fr=type==='hit'?110:type==='block'?230:type==='win'?640:type==='special'?340:510;osc.type=type==='special'?'sawtooth':'triangle';osc.frequency.setValueAtTime(fr,t);osc.frequency.exponentialRampToValueAtTime(type==='win'?fr*1.5:Math.max(45,fr*.54),t+.13);gain.gain.setValueAtTime(type==='win'?.055:.085,t);gain.gain.exponentialRampToValueAtTime(.0001,t+.19);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(t+.2)}catch{}}
  function notify(text,duration=1100){const el=$('callout');el.textContent=text;el.classList.add('visible');clearTimeout(el.timer);el.timer=setTimeout(()=>el.classList.remove('visible'),duration)}
  function overlay(title,body,button,fn,hint='按開始進入場景；遊玩時可直接使用 Mac 鍵盤'){const el=$('battleOverlay');el.classList.remove('hidden');$('overlayTitle').textContent=title;$('overlayText').textContent=body;$('overlayStart').textContent=button;$('overlayHint').textContent=hint;$('overlayStart').onclick=()=>{el.classList.add('hidden');handle(fn);canvas.focus({preventScroll:true})}}
  function clearInput(){pressed={};touchHeld={};localPulses=[];prevInputs='';document.querySelectorAll('[data-key]').forEach(b=>b.classList.remove('held'));if(ws?.readyState===WebSocket.OPEN&&slot>=0&&netSession){sendInput(null)}}
  function menuOpen(){return !!window.AzhiShell?.isOpen()}
  addEventListener('azhi:menu',()=>{clearInput();renderCharacters()});
  function selectionBlocked(){const choosingLocal=mode!=='online'&&menuOpen()&&['home','fighters'].includes(window.AzhiShell.currentPanel);return (ready&&!choosingLocal)||(mode==='online'&&lobby.busy)}
  addEventListener('azhi:request-mode',event=>{const next=event.detail?.mode;if(!['arcade','practice','online'].includes(next))return;if((mode==='online'&&netSession&&!netMatchComplete)||(next==='online'&&ws)){window.AzhiShell?.open('room');return}setMode(next)});
  function setMode(next){hud.clear();battleCamera.reset();skillFX.clear();playback.clear();if(!['arcade','practice','online'].includes(next))return;if(ws)disconnect(true);clearInput();mode=next;ready=false;finishedHandled=false;state=null;remote=null;netSession=null;matchId='';serverFrame=0;world=next==='arcade'?(chapters[Math.min(save.chapter,chapters.length-1)].stage):'night';document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===next;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});$('onlinePanel').hidden=next!=='online';$('rematchButton').disabled=true;$('sideTitle').textContent=next==='arcade'?'劇情任務':next==='practice'?'練習項目':'好友對戰說明';$('roundProgress').style.opacity=next==='arcade'?'1':'.35';$('battleResults').classList.add('off');const ch=chapters[Math.min(save.chapter,chapters.length-1)];$('missionTitle').textContent=next==='arcade'?(save.chapter>=chapters.length?'全劇情通關 · 再戰巔峰':ch.title):next==='practice'?'自由練習 · 研究你的連段':'好友對戰 · 一對一對決';$('missionDetail').textContent=next==='arcade'?(save.chapter>=chapters.length?'恭喜完成五關！可再次挑戰並選用新角色。':ch.detail):next==='practice'?'無行動力限制，木樁不會還擊，適合練習判定。':'建立房間並邀請朋友，全員準備後由房主開戰。';$('storyText').textContent=next==='arcade'?(save.chapter>=chapters.length?'「恭喜你闖過海線格鬥大會！下一輪挑戰從夜市再出發。」':ch.story):next==='practice'?'練習路線：J 輕拳 → K 重拳；對手防禦可用 H 摔技破解，Q 是中段踢、E 是下段掃腿。':'線上對戰結果由伺服器計算。好友可使用房號或邀請連結進房；全員準備後由房主開賽。';$('mainAction').textContent=next==='arcade'?'開始本關對決':next==='practice'?'開始自由練習':'建立線上房間';$('mainAction').onclick=next==='online'?joinRoom:startLocal;renderSteps();updateHUD({players:[{char:selected,hp:100,meter:30,wins:0},{char:'winnie',hp:100,meter:30,wins:0}],time:75,round:1});overlay(next==='arcade'?'狠話擂台':next==='practice'?'格鬥訓練室':'雙人連線競技場',next==='arcade'?'五關街機挑戰，與阿志、維尼、塞子、金沙賭神過招。每位角色都有一鍵專屬技能。':next==='practice'?'在無壓力的訓練室練習連擊、必殺與走位。U 一鍵必殺、O 超必殺，不需要複雜指令。':'點擊「建立線上房間」即可產生分享連結，全員準備後由房主開始比賽。',next==='online'?'建立房間':next==='practice'?'開始練習':'開始挑戰',next==='online'?joinRoom:startLocal);$('stageLabel').textContent='01｜'+stages[world].name;renderCharacters();}
  function renderSteps(){const el=$('steps');el.textContent='';for(let i=0;i<chapters.length;i++){const s=document.createElement('span');s.className='step'+(i<(save.chapter||0)?' done':i===Math.min(save.chapter,chapters.length-1)?' active':'');s.textContent=['試煉','維尼','塞子','賭神','阿志'][i];s.title=chapters[i].title;el.append(s)}[...$('roundProgress').children].forEach((s,i)=>s.classList.toggle('done',i<Math.min(save.chapter,chapters.length)))}
  function updateProgress(){saveGame();$('coinsStat').textContent=save.coins;$('winsStat').textContent=save.clears;$('bestStat').textContent=save.bestCombo;$('soundToggle').textContent='音效：'+(audioEnabled?'開':'關');if($('fxToggle'))$('fxToggle').textContent='特效：'+({cinema:'電影級',standard:'標準',low:'省電'}[effects.quality]||'電影級');renderPalettes()}
  function renderCharacters(){$('selectionSummary').textContent='目前選擇：'+roster[selected].name+' · '+roster[selected].special;const box=$('characterList');box.textContent='';Object.entries(roster).forEach(([id,c])=>{const b=document.createElement('button');b.className='char-card'+(id===selected?' selected':'');b.type='button';b.dataset.char=id;b.disabled=selectionBlocked();b.setAttribute('aria-pressed',String(id===selected));b.style.setProperty('--role-color',c.accent||'#ffd17f');const chip=document.createElement('span');chip.className='char-number';chip.textContent=id===selected?'✓ 已選擇':'0'+(Object.keys(roster).indexOf(id)+1);b.append(chip);const img=document.createElement('img');img.src='art/portrait_'+id+'.webp?v=896';img.alt=c.name+'格鬥人物立繪';const d=document.createElement('div');d.className='data';const title=document.createElement('strong');title.textContent=c.name;const tiny=document.createElement('small');tiny.textContent=c.special;d.append(title,tiny);const portrait=document.createElement('span');portrait.className='fighter-portrait';portrait.append(img);b.append(portrait,d);b.onclick=()=>{if(selectionBlocked()){ toast('正在戰鬥，請結束本場再切換角色');return}if(mode==='online'&&slot>=0){lobby.select(id);return}selected=id;save.character=id;saveGame();renderCharacters();$('charDescription').textContent=`${c.name}｜${c.title}：${c.desc}`;toast('已選擇格鬥家：'+c.name)};box.append(b)});$('charDescription').textContent=`${roster[selected].name}｜${roster[selected].title}：${roster[selected].desc}`;const art=$('moveShowcase');if(art){art.src='art/moves/'+selected+'.webp?v=896';art.alt=roster[selected].name+'高解析招式展示圖'}renderFrameGuide();renderSignatureGuide();if(!ready&&!netSession)updateHUD({players:[{char:selected,hp:100,meter:30},{char:mode==='practice'?'winnie':chapters[Math.min(save.chapter,chapters.length-1)].enemy,hp:100,meter:30}],time:75,round:1})}

 function renderFrameGuide(){const box=$('frameGuide');if(!box)return;box.textContent='';for(const name of ['light','heavy','kick','low','upper','throw','special','super']){const d=C.moveFor(selected,name),row=document.createElement('div');row.className='frame-row';const label=document.createElement('b');label.textContent=({light:'J 輕拳',heavy:'K 重拳',kick:'Q 踢擊',low:'E 掃腿',upper:'I 升龍',throw:'H 摔技',special:'U 必殺',super:'O 超必殺'}[name]);const value=document.createElement('span');value.textContent=`${d.startup} / ${d.active} / ${d.recovery} F · ${d.damage} 傷害`;row.append(label,value);box.append(row)}}

 function renderSignatureGuide(){const guide=$('signatureGuide');if(!guide)return;const fighter=roster[selected];guide.textContent='';const mini=document.createElement('div');mini.className='tagline';mini.textContent='ONE BUTTON / YOUR SIGNATURE';const h=document.createElement('strong');h.textContent='U · '+fighter.special;const p=document.createElement('p');p.textContent=fighter.skillDescription+' 按 U 即可發動（25 能量）；O 為「'+fighter.superName+'」（60 能量）。';guide.append(mini,h,p);updateSkillUI();}
  function updateSkillUI(player){
   const game=mode==='online'?netSession?.game:ready?state:null,own=mode==='online'?slot:0,fighter=roster[player?.char||selected]||roster.azhi;
   for(const [move,key,name] of [['special','U',fighter.special],['super','O',fighter.superName]]){
    const status=C.skillStatus(game,own,move),button=$(move+'Trigger');$(move+'Name').textContent=name;$(move+'Status').textContent=status.label;
    button.disabled=!status.available&&!status.canBuffer;button.dataset.state=status.code;button.classList.toggle('available',status.available);button.classList.toggle('unavailable',!status.available);button.setAttribute('aria-label',key+' '+name+'，'+status.label);
    for(const touch of document.querySelectorAll('[data-key="'+move+'"]')){touch.disabled=button.disabled;touch.classList.toggle('unavailable',!status.available);touch.setAttribute('aria-label',name+'，'+status.label);}
   }
  }
  for(const move of ['special','super'])$(move+'Trigger').onclick=()=>{if(menuOpen()||(!ready&&mode!=='online'))return;if(mode==='online'&&(!netSession||netMatchComplete||slot<0))return;localPulses.push(move);keyReadout(move);if(audioEnabled)effects.unlock();canvas.focus({preventScroll:true})};
  function renderPalettes(){const price={classic:0,violet:150,gold:300};for(const b of $('paletteButtons').querySelectorAll('button')){const id=b.dataset.palette;b.classList.toggle('selected',save.palette===id);b.textContent=({classic:'經典',violet:'紫電',gold:'黑金'}[id])+(save.purchased.includes(id)?'':` ${price[id]}G`);b.onclick=()=>{if(!save.purchased.includes(id)){if(save.coins<price[id]){toast('格鬥幣不足，請先完成街機關卡');return}save.coins-=price[id];save.purchased.push(id)}save.palette=id;updateProgress();toast('角色配色已切換')}}}
  function startLocal(){hud.clear();battleCamera.reset();skillFX.clear();playback.clear();if(audioEnabled)effects.unlock();if(mode==='online')return joinRoom();smoothLocal[0]=null;smoothLocal[1]=null;clearInput();finishedHandled=false;const chapter=chapters[Math.min(save.chapter,chapters.length-1)];const enemy=mode==='practice'?'winnie':chapter.enemy;world=mode==='practice'?'harbor':chapter.stage;state=C.create(selected,enemy,{introFrames:90,difficulty:mode==='practice'?0:chapter.difficulty,stage:world,practice:mode==='practice'});ready=true;remote=null;$('battleOverlay').classList.add('hidden');$('stageLabel').textContent=String(Math.min(save.chapter+1,chapters.length)).padStart(2,'0')+'｜'+stages[world].name;renderCharacters();$('liveTip').textContent=mode==='practice'?'試試 J → J → K → U，或直接按 U 發動必殺。按 ▣ 可看判定框。':'J → J → K → U！必殺只需 25 能量；能量達 60 時按 O 超必殺。';sound('win');window.AzhiShell?.onBattleStart({mode})}
  function finishArcade(match){if(finishedHandled)return;finishedHandled=true;ready=false;clearInput();const won=match.players[0].wins>=2;renderCharacters();$('battleResults').classList.remove('off');const summary=$('battleResults');summary.textContent=won?'成功擊退對手！':'未能獲勝，再練習一下就能過關。';if(won){const ch=chapters[Math.min(save.chapter,chapters.length-1)];save.coins+=ch.reward;save.clears++;save.chapter=Math.min(chapters.length,save.chapter+1);updateProgress();renderSteps();sound('win');notify('STAGE CLEAR!',2200);$('storyText').textContent=save.chapter>=chapters.length?'「海線格鬥大會冠軍，從今天開始就是你！」':chapters[save.chapter].story;overlay('過關！獲得 '+ch.reward+' 格鬥幣',save.chapter>=chapters.length?'五關街機劇情全數完成！繼續再挑戰，或切換到好友對戰。':'接下來前往「'+chapters[save.chapter].title+'」。連勝與出招操作會越來越重要。',save.chapter>=chapters.length?'再次挑戰':'進入下一關',()=>{if(save.chapter>=chapters.length){save.chapter=0;updateProgress()}setMode('arcade');startLocal()})}else{notify('TRY AGAIN',1700);overlay('挑戰失敗', '觀察對方招式前搖，利用防禦與反擊創造連段機會。闖關失敗不扣格鬥幣。','重新挑戰',startLocal)}$('mainAction').textContent='開始下一場';$('mainAction').onclick=()=>{if(save.chapter>=chapters.length)save.chapter=0;setMode('arcade');startLocal()}}
  function updateHUD(s){if(!s?.players?.length)return;const a=s.players[0],b=s.players[1];if($('p1Portrait').dataset.char!==a.char){$('p1Portrait').src='art/portrait_'+a.char+'.webp?v=896';$('p1Portrait').dataset.char=a.char}if($('p2Portrait').dataset.char!==b.char){$('p2Portrait').src='art/portrait_'+b.char+'.webp?v=896';$('p2Portrait').dataset.char=b.char}$('p1Name').textContent=mode==='online'?((rosterOnline.find(x=>x.slot===0)?.name||onlineNickname||'玩家 1')+' · '+(roster[a.char]?.name||'')):(roster[a.char]?.name||'玩家 1');$('p2Name').textContent=mode==='online'?((rosterOnline.find(x=>x.slot===1)?.name||'玩家 2')+' · '+(roster[b.char]?.name||'')):(roster[b.char]?.name||'玩家 2')+(mode==='arcade'?' · CPU':mode==='practice'?' · 木樁':' · 對手');for(const [p,bar,number,meter] of [[a,'p1Bar','p1HP','p1Meter'],[b,'p2Bar','p2HP','p2Meter']]){hud.health($(bar).parentElement,$(bar),p.hp,p.slot??bar,s.round+':'+p.char);hud.meter($(meter).parentElement,p.meter);hud.wins($(bar==='p1Bar'?'p1Wins':'p2Wins'),p.wins);$(number).textContent=Math.ceil(p.hp);$(meter).style.width=Math.max(0,Math.min(100,p.meter))+'%';$(bar).parentElement.setAttribute('aria-valuenow',Math.ceil(p.hp));$(bar==='p1Bar'?'p1Energy':'p2Energy').textContent=(p.meter>=100?'MAX':p.meter>=60?'SUPER':'ENERGY')+' '+Math.floor(p.meter)+' / 100'}$('clock').textContent=Math.max(0,Math.ceil(s.time));$('roundLabel').textContent=s.introFrames>0?'登場倒數 '+Math.ceil(s.introFrames/30):'ROUND '+s.round;$('stageLabel').style.visibility=s.introFrames>0?'hidden':'visible';updateSkillUI(s.players[mode==='online'&&slot>=0?slot:0]);}
  const keyLabels={super:'O · 超必殺',left:'←',right:'→',up:'↑',down:'↓',light:'J · 快拳',heavy:'K · 重擊',kick:'Q · 踢擊',low:'E · 掃腿',upper:'I · 升龍',throw:'H · 摔技',special:'U · 必殺',guard:'L · 防禦',dash:'SHIFT · 衝刺'};
  let inputTimeout=0,comboTimeout=0;
  function keyReadout(key){const node=$('inputReadout');node.textContent='INPUT  /  '+(keyLabels[key]||key);node.classList.add('on');clearTimeout(inputTimeout);inputTimeout=setTimeout(()=>{node.textContent='READY  /  J → J → J 連拳';node.classList.remove('on')},900)}
  function combo(text){const el=$('comboBanner');el.innerHTML=text;el.classList.add('visible');clearTimeout(comboTimeout);comboTimeout=setTimeout(()=>el.classList.remove('visible'),900)}
  function addParticles(e){
    const attacker=(mode==='online'?remote:state)?.players?.[e.slot];
    const kind=V.typeFor(e),dir=attacker?.face===-1?-1:1;
    effects.emit({...e,direction:dir,accent:e.block?'#7ce5ff':(['special','super'].includes(e.move)?(roster[attacker?.char]?.accent||'#8accff'):undefined),y:448-(e.y||0)*.82-125});
    effects.sound(kind,audioEnabled);
    if(!e.block&&!reducedMotion){shake=e.move==='super'?14:e.move==='special'?10:e.counter?9:e.move==='heavy'?8:3;flash=Math.min(.55,flash+(e.move==='super'?.36:.17))}
    if(e.combo>=2){$('comboBanner').dataset.side=String(e.slot||0);combo(`${e.combo} <span style="font-size:.47em">HIT</span><small>COMBO CHAIN</small>`);if(mode==='arcade'||mode==='practice'){save.bestCombo=Math.max(save.bestCombo,e.combo);if(e.combo===3||e.combo===5)updateProgress()}}
    else if(e.counter)combo('COUNTER!<small>反擊成功</small>');
  }
  function eventsFrom(list){for(const e of list||[]){if(e.kind==='skill'&&(mode!=='online'||e.slot===slot||e.id)){const fighter=(mode==='online'?remote:state)?.players?.[e.slot];skillFX.emit({...e,direction:e.direction||fighter?.face||1},performance.now());notify(e.name,900)}if(e.kind==='hit')addParticles(e);if(e.kind==='super'){superFlash=reducedMotion?0:18;activeCutin={char:e.char||selected,born:performance.now(),slot:e.slot};sound('special')}if(e.kind==='armor'){notify('ARMOR · 霸體防禦！',700);sound('block')}if(e.kind==='buff'){notify('黑金霸體啟動！',800)}if(e.kind==='fortune'){notify(e.fortune==='jackpot'?'JACKPOT · 黃金飛牌！':e.fortune==='blank'?'爛牌！出招失誤':'幸運牌發動！',700)}if(e.kind==='command'&&e.slot===(mode==='online'?slot:0)){notify(e.key==='upper'?'升龍指令！':'波動指令！',600)}if(e.kind==='swing'&&e.slot===(mode==='online'?slot:0))keyReadout(e.name);if(e.kind==='round'){notify(e.winner<0?'DRAW':e.winner===0?'PLAYER 1 WIN':'PLAYER 2 WIN',1200);sound('win')}if(e.kind==='finish'&&mode==='online')notify('MATCH OVER',1200)}}
  function tick(){if(mode==='online'){
   if(!netSession||!ws||ws.readyState!==WebSocket.OPEN||netMatchComplete)return;
   if(performance.now()-lastPacketAt>5500){$('netMessage').textContent='超過 5 秒未收到伺服器影格資料，請檢查連線。';netFrozen=true;return;}
   netFrozen=false;
   // Record held controls at exact frame IDs. Attack pulses survive a rapid press/release.
   {
     const target=Math.max(netSession.frame,serverFrame)+inputDelay+1;
     const blocked=menuOpen(),input={keys:blocked?{}:{...pressed},pulses:blocked?[]:localPulses.splice(0,4)};if(blocked)localPulses=[];
     netSession.submit(slot,target,input);
     try{ws.send(JSON.stringify({type:'input',matchId,frame:target,...input}))}catch{}
   }
   const events=netSession.advance();
   onlineState();eventsFrom(events);
   if(netSession.frame%24===0)netStats();
   // A browser tab may start after the server: bounded catch-up without a large CPU spike.
   let catchup=0;while(netSession.frame<serverFrame+inputDelay&&catchup<3){
     const ev=netSession.advance();onlineState();eventsFrom(ev);catchup++;
   }
   if(pendingCheckpoint&&pendingCheckpoint.frame<=netSession.frame){reconcile(pendingCheckpoint);onlineState()}
   return;
  }if(menuOpen()||!ready||!state)return;smoothLocal[0]={...state.players[0]};smoothLocal[1]={...state.players[1]};C.input(state,0,{...pressed,pulses:localPulses.splice(0,6)});C.cpu(state,1,mode==='practice'?0:chapters[Math.min(save.chapter,chapters.length-1)].difficulty,mode==='practice');C.step(state);eventsFrom(state.events.splice(0));updateHUD(state);if(mode==='practice'&&state.status==='finished'){state=C.create(selected,'winnie',{difficulty:0,stage:'harbor',practice:true});notify('訓練重新開始')}
  if(state.status==='finished'&&mode==='arcade')finishArcade(state)}
  // 連線採相同主機、/ws 路徑，不需要公開 Node.js 私有埠
  function disconnect(silent=false){lobby.reset();skillFX.clear();playback.clear();if(ws){try{ws.send(JSON.stringify({type:'leave'}));ws.close(1000,'leave')}catch{}ws=null}slot=-1;room='';onlineIsHost=false;$('updateOnlineRoomTitle').disabled=true;$('onlineRoomTitle').disabled=false;$('onlineRoomTitleDisplay').textContent='尚未進入房間';rosterOnline=[];$('updateOnlineNickname').disabled=true;remote=null;lastRemote=null;remoteSince=0;netSession=null;matchId='';serverFrame=0;lastPacketAt=0;pendingCheckpoint=null;netMatchComplete=false;ready=false;netStats();clearInput();$('copyRoom').disabled=true;$('copySpectatorLink').disabled=true;$('leaveRoom').disabled=true;$('rematchButton').disabled=true;$('joinRoom').disabled=false;if(!silent)$('netMessage').textContent='已離開房間。';}
  function validatedOnlineName(value){if(typeof value!=='string')return null;const n=value.normalize('NFKC').trim().replace(/\s+/gu,' ');return Array.from(n).length>=2&&Array.from(n).length<=16&&/^[\p{L}\p{N} _.-]+$/u.test(n)&&!/^(admin|administrator|moderator|staff|system|官方|管理員|系統|客服)$/iu.test(n)?n:null}
  function storeOnlineName(name){try{localStorage.setItem('azhi_player_nickname',name)}catch{}}
  function updateOnlineName(){const name=validatedOnlineName($('onlineNickname').value);if(!name){toast('暱稱需 2–16 字且不可包含特殊符號');return}onlineNickname=name;storeOnlineName(name);if(ws?.readyState===WebSocket.OPEN&&slot>=0)ws.send(JSON.stringify({type:'set_name',name}));else toast('暱稱已保存：'+name)}
  function updateOnlineRoomTitle(){if(!onlineIsHost||!ws||ws.readyState!==WebSocket.OPEN){toast('只有房主可更改房名');return}
    const t=validatedOnlineTitle($('onlineRoomTitle').value);if(!t){toast('房名需 2–24 字且不可含特殊符號');return}
    ws.send(JSON.stringify({type:'set_title',title:t}));}
  function validatedOnlineTitle(value){if(typeof value!=='string')return null;const n=value.normalize('NFKC').trim().replace(/\s+/gu,' ');return Array.from(n).length>=2&&Array.from(n).length<=24&&/^[\p{L}\p{N} _.-]+$/u.test(n)&&!/^(admin|administrator|moderator|staff|system|官方|管理員|系統|客服)$/iu.test(n)?n:null}
  function updateOnlineRoster(list){rosterOnline=list||[];$('onlineNames').textContent=rosterOnline.length?rosterOnline.map(p=>(p.name||'玩家')+'：'+(C.CHAR[p.char]?.name||p.char)).join('　｜　'):'線上玩家：等待加入';if(mode==='online'&&remote)updateHUD(remote)}
  function joinRoom(){window.AzhiShell?.open('room');if(mode!=='online'){setMode('online');return}if(ws&&ws.readyState===WebSocket.OPEN){toast('已連入房間，請等待對手');return}disconnect(true);const nickname=validatedOnlineName($('onlineNickname').value);
   if(!nickname){toast('請先設定 2–16 字玩家暱稱');$('onlineNickname').focus();return}onlineNickname=nickname;storeOnlineName(nickname);
   let id=$('roomInput').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);$('roomInput').value=id;
   const customTitle=!id?validatedOnlineTitle($('onlineRoomTitle').value||'雙人格鬥房'):null;
   if(!id&&!customTitle){toast('房間名稱需 2–24 字');return}
   let address=(location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/ws';if(location.protocol==='file:'){toast('線上對戰需要透過 VPS 網址開啟');return}try{ws=new WebSocket(address)}catch(e){$('netMessage').textContent='連線失敗：'+e.message;return}let conn=ws;$('netMessage').textContent='正在連線伺服器…';$('joinRoom').disabled=true;const wait=setTimeout(()=>{if(conn.readyState===WebSocket.CONNECTING){conn.close();toast('連線逾時，請確認 VPS 狀態')}} ,8000);
    conn.onopen=()=>{clearTimeout(wait);if(conn!==ws)return;conn.send(JSON.stringify({type:'join',room:id,char:selected,name:onlineNickname,title:customTitle}));$('netMessage').textContent='已連線，正在加入房間…'};
    conn.onmessage=e=>{if(conn!==ws)return;let msg;try{msg=JSON.parse(e.data)}catch{return}switch(msg.type){case 'seat_updated':slot=msg.slot;break;case 'joined':slot=msg.slot;room=msg.room;onlineIsHost=!!msg.host;$('updateOnlineNickname').disabled=false;$('updateOnlineRoomTitle').disabled=!onlineIsHost;$('onlineRoomTitle').disabled=!onlineIsHost;
   $('onlineRoomTitleDisplay').textContent='房間：'+(msg.title||'雙人格鬥房')+'｜'+room;$('onlineRoomTitle').value=msg.title||'雙人格鬥房';$('roomInput').value=room;$('netMessage').textContent=`房號 ${room}｜你是 ${slot+1}P，等待好友加入`;const u=new URL(location.href);u.searchParams.set('room',room);history.replaceState(null,'',u);$('copyRoom').disabled=false;$('copySpectatorLink').disabled=false;$('leaveRoom').disabled=false;$('rematchButton').disabled=true;break;case 'roster':updateOnlineRoster(msg.players);lobby.receive(msg);onlineIsHost=!!msg.players?.find(p=>p.slot===slot)?.host;
    $('updateOnlineRoomTitle').disabled=!onlineIsHost;$('onlineRoomTitle').disabled=!onlineIsHost;
    $('onlineRoomTitleDisplay').textContent='房間：'+(msg.title||'雙人格鬥房')+'｜'+room;
    $('onlineRoomTitle').value=msg.title||'雙人格鬥房';$('netMessage').textContent=msg.phase==='playing'?'對戰開始！':'選好角色並按準備，全員準備後由房主開賽';break;case 'name_updated':onlineNickname=msg.name||onlineNickname;$('onlineNickname').value=onlineNickname;toast('暱稱已更新：'+onlineNickname);break;case 'rematch_status':$('netMessage').textContent='再戰確認：'+msg.votes+'/2 人同意；全員確認後由房主開賽';break;
    case 'start':{hud.clear();
      matchId=msg.matchId;netMatchComplete=false;inputDelay=Math.max(1,Math.min(8,Number(msg.inputDelay)||RB.INPUT_DELAY));serverFrame=0;
      skillFX.clear();playback.clear();confirmedEffects.clear();pendingCheckpoint=null;netSession=new RB.Session(msg.game);lastRemote=null;remote=null;remoteSince=performance.now();lastPacketAt=remoteSince;ready=true;
      world=msg.game.stage||'night';$('stageLabel').textContent='ROLLBACK｜'+stages[world]?.name;
      $('netMessage').textContent='60Hz 回滾同步啟動｜已加入對局';
      $('rematchButton').disabled=true;$('rematchButton').textContent='↻ 再戰一場（雙方同意）';
      $('battleOverlay').classList.add('hidden');
      if(document.activeElement===$('roomInput'))$('roomInput').blur();
      clearInput();onlineState();netStats();window.AzhiShell?.onBattleStart({mode:'online'});break;
    }
    case 'frames':{
      if(!netSession||msg.matchId!==matchId)return;
      serverFrame=Math.max(serverFrame,msg.serverFrame||0);netPackets++;lastPacketAt=performance.now();
      for(const row of msg.rows||[]){if(!Number.isSafeInteger(row.frame))continue;
        for(let i=0;i<2;i++)if(row.real?.[i])netSession.submit(i,row.frame,row.inputs?.[i]);
      }
      if(msg.checkpoint)reconcile(msg.checkpoint);
      const newEvents=(msg.events||[]).filter(e=>{const id=matchId+':'+e.id;if(confirmedEffects.has(id))return false;confirmedEffects.add(id);return true});
      if(confirmedEffects.size>250)confirmedEffects.clear();
      // Server-confirmed events are used for pronounced finish/round cut-ins.
      for(const e of newEvents)if(e.kind==='round'||e.kind==='finish'||(e.kind==='skill'&&e.slot!==slot))eventsFrom([e]);
      onlineState();netStats();
      const current=netSession.game;
      if(current.status==='finished'&&!netMatchComplete){$('netMessage').textContent='等待伺服器確認最終結果…'}else if(current.status==='playing'){ready=true;$('battleOverlay').classList.add('hidden')}
      break;
    }
    case 'match_complete':if(msg.matchId===matchId&&netSession){netMatchComplete=true;lastPacketAt=performance.now();if(msg.checkpoint)netSession.hardSync(msg.checkpoint.frame,msg.checkpoint.state);pendingCheckpoint=null;onlineState();netStats();ready=false;const won=netSession.game.winner===slot;overlay(won?'好友對戰勝利！':'本場對戰結束',won?'你贏得了這場線上決鬥。':'雙方同意後可在原房再戰。','提出再戰',requestRematch);$('rematchButton').disabled=false;updateSkillUI(netSession.game.players[slot]);window.AzhiShell?.open('room');}break;
    case 'pong':if(Number.isFinite(msg.sentAt)){const sample=Math.max(0,performance.now()-msg.sentAt);netRTT=netRTT?netRTT*.7+sample*.3:sample;inputDelay=Math.max(RB.INPUT_DELAY,Math.min(8,Math.ceil(netRTT/32)+1));netStats()}break;
    case 'peer_left':netSession=null;matchId='';updateOnlineRoster([]);remote=null;ready=false;$('rematchButton').disabled=true;$('netMessage').textContent='對手已離線，等待另一位玩家加入';overlay('好友已離線','另一位玩家仍可以使用相同房號加入；你也可以離開房間。','返回等待',()=>{$('battleOverlay').classList.add('hidden')});window.AzhiShell?.open('room');break;case 'error':$('netMessage').textContent=msg.message||'伺服器回傳錯誤';toast(msg.message||'連線錯誤');if(slot<0&&conn.readyState===WebSocket.OPEN)conn.close();break;}}
    conn.onerror=()=>{if(conn!==ws)return;$('netMessage').textContent='WebSocket 連線錯誤，請確認 /ws 反向代理與防火牆。'};
    conn.onclose=()=>{clearTimeout(wait);if(conn!==ws)return;ws=null;disconnect(true);$('netMessage').textContent='連線已中斷，可使用原房號重新加入。';overlay('線上連線已中斷','單人闖關仍可繼續遊玩；線上模式需要正常的 WebSocket 連線。','重試連線',joinRoom);window.AzhiShell?.open('room');};
  }
  function requestRematch(){if(!ws||ws.readyState!==WebSocket.OPEN||slot<0){toast('請先加入好友房間');return}
    ws.send(JSON.stringify({type:'rematch'}));$('rematchButton').disabled=true;$('rematchButton').textContent='等待好友同意…';$('netMessage').textContent='已提出再戰，正在等待另一位玩家確認';$('battleOverlay').classList.add('hidden')}
  $('rematchButton').onclick=requestRematch;
  $('updateOnlineRoomTitle').onclick=updateOnlineRoomTitle;
  $('onlineRoomTitle').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(room)updateOnlineRoomTitle()}});
  $('updateOnlineNickname').onclick=updateOnlineName;
  $('onlineNickname').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();updateOnlineName()}});
  $('joinRoom').onclick=joinRoom;$('copySpectatorLink').onclick=()=>{if(!room)return;const u=new URL('/team.html',location.href);u.searchParams.set('room',room);u.searchParams.set('watch','1');if(navigator.clipboard?.writeText)navigator.clipboard.writeText(u.href).then(()=>toast('已複製只讀觀戰連結')).catch(()=>toast('複製失敗'));else{const t=document.createElement('textarea');t.value=u.href;document.body.append(t);t.select();document.execCommand('copy');t.remove();toast('已複製觀戰連結')}};$('copyRoom').onclick=()=>{const u=new URL(location.href);u.searchParams.set('room',room);if(navigator.clipboard?.writeText)navigator.clipboard.writeText(u.href).then(()=>toast('已複製好友邀請連結')).catch(()=>toast('複製失敗，請手動複製網址'));else{const t=document.createElement('textarea');t.value=u.href;document.body.append(t);t.select();try{document.execCommand('copy');toast('已複製邀請連結')}finally{t.remove()}}};$('leaveRoom').onclick=()=>{disconnect();setMode('online')};
  const bind={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyJ:'light',KeyF:'light',Space:'light',KeyK:'heavy',KeyG:'heavy',KeyQ:'kick',KeyE:'low',KeyI:'upper',KeyH:'throw',KeyU:'special',KeyO:'super',KeyL:'guard',ShiftLeft:'dash',ShiftRight:'dash'};
  const attackKeys=new Set(C.ATTACKS);
  function sendInput(pulse){/* Network sends one frame-stamped input per 60Hz logical tick. */}
  function keyboard(e,isDown){const key=bind[e.code];if(!key)return;if(!isDown){pressed[key]=false;touchHeld[key]=false;sendInput(null);return}if(menuOpen())return;const el=document.activeElement;if(el&&(el.isContentEditable||el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.tagName==='SELECT'))return;if(e.metaKey||e.ctrlKey||e.altKey||(!ready&&!netSession)||(el?.tagName==='BUTTON'&&e.code==='Space'))return;e.preventDefault();if(isDown&&e.repeat&&attackKeys.has(key))return;
    const edge=isDown&&!pressed[key];pressed[key]=isDown;
    if(edge){if(audioEnabled)effects.unlock();keyReadout(key);if(attackKeys.has(key))localPulses.push(key);try{audio?.resume()}catch{};sendInput(attackKeys.has(key)?key:null)}else if(!isDown)sendInput(null);
  }
  addEventListener('keydown',e=>keyboard(e,true),{capture:true});addEventListener('keyup',e=>keyboard(e,false),{capture:true});addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput()});
  for(const b of document.querySelectorAll('[data-key]')){const k=b.dataset.key;b.addEventListener('pointerdown',e=>{if(menuOpen()||(!ready&&!netSession))return;e.preventDefault();b.setPointerCapture(e.pointerId);touchHeld[k]=true;pressed[k]=true;if(audioEnabled)effects.unlock();if(attackKeys.has(k))localPulses.push(k);keyReadout(k);sendInput(attackKeys.has(k)?k:null);b.classList.add('held')});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{touchHeld[k]=false;pressed[k]=false;sendInput(null);b.classList.remove('held')})}
  setInterval(()=>{if(!ws||ws.readyState!==WebSocket.OPEN||slot<0)return;lastPing=performance.now();ws.send(JSON.stringify({type:'ping',sentAt:lastPing}))},2000);
  // 高解析度原創手繪風格的多影格角色：17 動作 × 10 張影格 × 5 人物。
  const FRAME_W=Anim.WIDTH, FRAME_H=Anim.HEIGHT, FRAMES=Anim.FRAMES;
  let superFlash=0,activeCutin=null;const cutins={};for(const id of Object.keys(roster)){const image=new Image();image.src='art/cutins/'+id+'.webp?v=896';cutins[id]=image}
  const artActions=Anim.ACTIONS;
  const smoothLocal=[null,null]; let smoothRemote=[null,null], lastRemote=null;
  let showBoxes=false, focus=false;
  const dust=[];let ambientAt=0;
  const theme={night:{a:'#fa477c',b:'#1fafff'},garage:{a:'#38d7f5',b:'#a86eff'},harbor:{a:'#ffa866',b:'#53aaff'}};
  const bezier=(a,b,t)=>a+(b-a)*t;
  $('focusToggle').onclick=()=>{if(document.body.classList.contains('game-app'))return;focus=!focus;document.body.classList.toggle('fight-focus',focus);$('focusToggle').classList.toggle('on',focus);$('focusToggle').setAttribute('aria-pressed',String(focus));$('focusToggle').textContent=focus?'▣ 返回完整介面':'⛶ 專注戰鬥';canvas.focus({preventScroll:true})};
  document.querySelectorAll('.fighter-select-link').forEach(link=>link.addEventListener('click',event=>{if(window.AzhiShell){event.preventDefault();window.AzhiShell.open('fighters');return}if(focus)$('focusToggle').onclick()}));
  $('hitboxToggle').onclick=()=>{showBoxes=!showBoxes;$('hitboxToggle').classList.toggle('on',showBoxes);$('hitboxToggle').setAttribute('aria-pressed',String(showBoxes));canvas.focus({preventScroll:true});toast(showBoxes?'已顯示攻擊與受擊判定框':'已隱藏判定框')};
  for(const id of Object.keys(roster)){const img=new Image();img.src='sprites/'+id+'.png?v=896';sprites[id]=img}
  for(const [id,s] of Object.entries(stages)){const img=new Image();img.src=s.img;backgrounds[id]=img}
  function drawEnvironment(now){
    const img=backgrounds[world];if(img?.complete&&img.naturalWidth){ctx.drawImage(img,0,0,960,540)}else{const bg=ctx.createLinearGradient(0,0,0,540);bg.addColorStop(0,'#0d2043');bg.addColorStop(.57,'#26305c');bg.addColorStop(1,'#14192e');ctx.fillStyle=bg;ctx.fillRect(0,0,960,540)}
    // 不再使用原本的整張深色遮罩：保留建築顏色與舞台細節。
    const mist=ctx.createLinearGradient(0,0,0,540);mist.addColorStop(0,'#030b2020');mist.addColorStop(.60,'#070d140b');mist.addColorStop(1,'#03081a66');ctx.fillStyle=mist;ctx.fillRect(0,0,960,540);
    let t=theme[world]||theme.night;
    for(const [x,color] of [[165,t.a],[790,t.b]]){const rad=ctx.createRadialGradient(x,170,12,x,170,360);rad.addColorStop(0,color+'18');rad.addColorStop(1,color+'00');ctx.fillStyle=rad;ctx.fillRect(x-360,-190,720,720)}
    // 地面鏡面高光隨時間漂移，避免整個舞台像一張靜止的背景圖。
    ctx.save();ctx.beginPath();ctx.rect(0,416,960,124);ctx.clip();ctx.fillStyle='#050b194c';ctx.fillRect(0,420,960,120);
    for(let i=0;i<21;i++){const a=((i*219+71)%960),off=Math.sin(now*.7+i*3.1)*14;const gradient=ctx.createLinearGradient(a,422,a+off,540);gradient.addColorStop(0,(i%2?t.a:t.b)+'46');gradient.addColorStop(1,(i%2?t.a:t.b)+'00');ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(a-6,421);ctx.lineTo(a+10,421);ctx.lineTo(a+12+off,540);ctx.lineTo(a-12+off,540);ctx.fill()}
    ctx.restore();
    if(now-ambientAt>.085){ambientAt=now;if(dust.length<75)dust.push({x:Math.random()*960,y:100+Math.random()*360,r:.8+Math.random()*2.2,dx:(Math.random()-.5)*.8,dy:-.1-Math.random()*.5,a:.15+Math.random()*.36,color:Math.random()<.5?t.a:t.b})}
    for(const d of dust){d.x+=d.dx;d.y+=d.dy;d.a*=.998;ctx.globalAlpha=d.a;ctx.fillStyle=d.color;ctx.fillRect(d.x,d.y,d.r,d.r*2)}ctx.globalAlpha=1;
    if(dust.length>80)dust.splice(0,dust.length-76);
  }
  function interpolateFighters(source,prev,alpha){return source.map((p,i)=>{const prevP=prev?.[i];if(!prevP||prevP.char!==p.char)return p;
   return {...p,x:bezier(prevP.x,p.x,alpha),y:bezier(prevP.y,p.y,alpha)};});}
  function actionOf(p,prev){if(p.hp<=0)return 'ko';const game=mode==='online'?remote:state;if(game?.status==='finished'&&game.winner===p.slot)return 'win';if(p.move?.name)return p.move.name==='super'?'special':p.move.name;if((p.stun||0)>2||(p.flash||0)>0)return 'hurt';if(p.guard)return 'guard';if(p.y>1)return 'jump';if(p.dash>0)return 'dash';if(p.crouch)return 'low';if(prev&&Math.abs(p.x-prev.x)>1)return 'walk';return 'idle'}
  function animationFrame(p,action,now){return playback.spriteFrame(p,action,now,p.move?.name?C.moveFor(p,p.move.name):null,drawingGame)}
  function drawAttackFx(p,now){const move=p.move?.name;if(!move)return;const data=C.moveFor(p,move),f=p.move.frame||0;if(!data||f<data.start-1||f>=data.start+data.active+2)return;
   const alpha=f<data.start?.35:(f>data.start+data.active?0.22:1);
   const x=p.x+p.face*(['special','super'].includes(move)?116:move==='kick'?106:move==='low'?103:move==='heavy'?90:move==='upper'?72:74);
   const y=448-p.y*.82-(move==='low'?39:move==='kick'?106:move==='upper'?174:['special','super'].includes(move)?143:132);
   const typ=['light','light2','light3'].includes(move)?'#fff2b1':['special','super'].includes(move)?(roster[p.char]?.accent||'#69e7ff'):move==='upper'?'#ffa56b':'#ff9c92';
   ctx.save();const artRatio=P.FIGHTER_SCALE/1.2,feet=448-p.y*.82;ctx.translate(p.x,feet);ctx.scale(artRatio,artRatio);ctx.translate(-p.x,-feet);ctx.globalAlpha=alpha;ctx.globalCompositeOperation='lighter';
   if(move==='special'||move==='super'){
      if(roster[p.char]?.specialMode==='cards'){
        ctx.fillStyle='#fff9d8';ctx.strokeStyle='#af73f9';ctx.lineWidth=4;ctx.shadowBlur=25;ctx.shadowColor='#a176ff';
        ctx.save();ctx.translate(x-28*p.face,y);ctx.rotate(now*8);
        ctx.fillRect(-21,-32,42,64);ctx.strokeRect(-21,-32,42,64);
        ctx.fillStyle='#b656dc';ctx.font='bold 25px serif';ctx.fillText('◆',-13,9);ctx.restore();ctx.restore();return;
      }
      const core=ctx.createRadialGradient(x,y,0,x,y,99);core.addColorStop(0,'#ffffffec');core.addColorStop(.20,roster[p.char]?.accent||'#9ff5ff');core.addColorStop(.57,'#438cff7a');core.addColorStop(1,'#3184fa00');ctx.fillStyle=core;ctx.beginPath();ctx.ellipse(x,y,100,62,0,0,Math.PI*2);ctx.fill();
      for(let k=0;k<4;k++){ctx.strokeStyle=k%2?'#b8fbff9a':'#c678ff77';ctx.lineWidth=4-k*.6;ctx.beginPath();ctx.arc(x+p.face*8,y,(29+k*16)*(1+Math.sin(now*11+k)*.08),-.65,1.4);ctx.stroke()}
      ctx.strokeStyle='#ecffffc7';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(p.x+p.face*38,y);ctx.lineTo(x+p.face*68,y);ctx.stroke();
      if(p.char==='winnie'){
        ctx.save();ctx.strokeStyle='#ffdb59';ctx.lineWidth=11;ctx.shadowBlur=22;ctx.shadowColor='#ffe069';
        ctx.beginPath();ctx.ellipse(x,434-y+26,90,24,0,0,Math.PI*2);ctx.stroke();ctx.restore();
      } else if(p.char==='sezi'){
        ctx.strokeStyle='#d3fffa';ctx.lineWidth=6;for(let j=0;j<3;j++){
         ctx.beginPath();ctx.arc(x-22*p.face,y,34+j*17,now*9+j*1.4,now*9+j*1.4+2.9);ctx.stroke();
        }
      } else if(roster[p.char]?.specialMode==='counter'){
        ctx.strokeStyle='#6effb1';ctx.lineWidth=5;for(let j=0;j<6;j++){
         const phi=now*7+j*Math.PI/3;ctx.beginPath();ctx.moveTo(x+Math.cos(phi)*22,y+Math.sin(phi)*22);ctx.lineTo(x+Math.cos(phi)*103,y+Math.sin(phi)*87);ctx.stroke();
        }
      }

   }else{
     const r=move==='heavy'||move==='upper'?84:move==='kick'?80:move==='low'?63:54;ctx.strokeStyle=typ;ctx.lineWidth=move==='heavy'?17:move==='kick'?14:move==='upper'?13:10;ctx.lineCap='round';ctx.shadowBlur=23;ctx.shadowColor=typ;
     ctx.beginPath();if(move==='upper'){ctx.arc(x,y+48,r,-2.25,-.25)}else if(move==='low'){ctx.ellipse(x,y+17,r,23,-.07,3.6,5.9)}else if(move==='kick'){ctx.ellipse(x-11*p.face,y+5,r,49,-.2,.2,2.2)}else{ctx.moveTo(x-p.face*95,y+19);ctx.quadraticCurveTo(x-p.face*17,y-r*.6,x+p.face*32,y-5)}ctx.stroke();
     ctx.shadowBlur=0;ctx.strokeStyle='#fff9ea';ctx.lineWidth=3;ctx.stroke();
   }
   ctx.restore();
  }
  function drawShadow(p){ctx.save();ctx.fillStyle='#03061283';ctx.beginPath();ctx.ellipse(p.x,450,Math.max(16,36-p.y*.12),8,0,0,Math.PI*2);ctx.fill();ctx.restore()}
  function drawFighter(p,prev,now,index){const im=sprites[p.char]||sprites.azhi;if(!im?.complete||!im.naturalWidth)return;
    const {width:fw,height:fh}=Anim.frameSize(p.char);const pose=P.fighterPose(drawingGame,p,reducedMotion),action=actionOf(p,prev),row=Math.max(0,artActions.indexOf(action)),col=animationFrame(p,action,now),scale=P.FIGHTER_SCALE,tw=fw*scale,th=fh*scale,ground=448-p.y*.82;
    drawShadow({...p,x:p.x+pose.dx});ctx.save();ctx.translate(p.x+pose.dx,ground+pose.dy);ctx.rotate(pose.rotation);ctx.scale(pose.scale,pose.scale);ctx.globalAlpha=pose.alpha;
    if(p.face<0)ctx.scale(-1,1);
    // Squash-and-stretch is visual-only and never changes server collision boxes.
    let sx=1,sy=1;
    if(p.y>1&&p.vy>3){sx=.89;sy=1.11}
    else if(p.y<5&&p.vy<-.9){sx=1.075;sy=.94}
    else if(p.move?.name==='heavy'){sx=1.07;sy=.985}
    else if(p.move?.name==='upper'){sx=.95;sy=1.06}
    if(p.dash>0||p.move?.name==='super'){
       ctx.save();ctx.globalAlpha=.19;ctx.drawImage(im,col*fw,row*fh,fw,fh,-tw/2-p.face*34,-P.SPRITE_BASELINE*scale,tw,th);ctx.restore();
    }
    ctx.scale(sx,sy);
    if(p.flash>0){ctx.globalAlpha=p.flash%2===0?.63:.9;ctx.shadowBlur=20;ctx.shadowColor='#ffffff'}
    if(['special','super'].includes(p.move?.name)){ctx.shadowBlur=32;ctx.shadowColor=roster[p.char]?.accent||'#40bcff'}if(p.armorTimer>0&&p.armorCharges>0){ctx.shadowBlur=29;ctx.shadowColor='#f2c25d'}
    if(index===0){ctx.filter=save.palette==='violet'?'hue-rotate(53deg) saturate(1.2)':save.palette==='gold'?'sepia(.33) saturate(1.35)':'none'}
    ctx.drawImage(im,col*fw,row*fh,fw,fh,-tw/2,-P.SPRITE_BASELINE*scale,tw,th);
    ctx.restore();drawAttackFx(p,now);
  }
  function drawHitboxes(p){ctx.save();ctx.lineWidth=2;
   const hurt=C.Boxes.hurtbox(p),attack=p.move?.name?C.moveFor(p,p.move.name):null;
   const groundToCanvas=(v)=>448-v*.82;
   ctx.fillStyle='#42e7f825';ctx.strokeStyle='#56dafa';const y=groundToCanvas(hurt.y+hurt.h),h=hurt.h*.82;ctx.fillRect(hurt.x,y,hurt.w,h);ctx.strokeRect(hurt.x,y,hurt.w,h);
   if(attack&&p.move.frame>=attack.start&&p.move.frame<attack.start+attack.active){const rect=C.Boxes.hitbox(p,attack);const ay=groundToCanvas(rect.y+rect.h),ah=rect.h*.82;ctx.fillStyle='#ff548b35';ctx.strokeStyle='#ff729f';ctx.fillRect(rect.x,ay,rect.w,ah);ctx.strokeRect(rect.x,ay,rect.w,ah)}
   ctx.restore()}
  function drawEffects(now){effects.front(ctx,now)}
  function drawProjectiles(projectiles,now){for(const shot of projectiles||[]){
    const x=shot.x,y=448-(shot.y||110)*.82;
    if(shot.kind==='wave'){ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle='#ffce6a8f';ctx.shadowBlur=26;ctx.shadowColor='#f8bd49';ctx.beginPath();ctx.ellipse(x,y+10,49,17,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff4b2';ctx.lineWidth=5;ctx.beginPath();ctx.arc(x,y+20,27,Math.PI,Math.PI*1.95);ctx.stroke();ctx.restore();continue;}
    ctx.save();ctx.translate(x,y);ctx.rotate(now*14);ctx.shadowBlur=28;ctx.shadowColor='#b98cff';
    ctx.fillStyle='#fdf6d9';ctx.strokeStyle='#af61ec';ctx.lineWidth=4;ctx.fillRect(-19,-28,38,56);ctx.strokeRect(-19,-28,38,56);
    ctx.fillStyle=shot.fortune==='jackpot'?'#ffd661':shot.fortune==='blank'?'#888da3':'#9855e6';ctx.font='bold 27px serif';ctx.fillText('◆',-14,10);
    ctx.restore();ctx.save();ctx.strokeStyle='#bb83ff8a';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x-shot.vx*5,y+4);ctx.lineTo(x,y);ctx.stroke();ctx.restore();
   }}
  function frameDraw(now){const st=(mode==='online'?remote:state)||{players:[{char:selected,x:280,y:0,face:1,hp:100},{char:'winnie',x:680,y:0,face:-1,hp:100}]};drawingGame=st;const cameraView=battleCamera.update(st.players,lastDraw?now-lastDraw:1/60,reducedMotion||!!P.intro(st));lastDraw=now;const t=performance.now(),camera=reducedMotion?{x:0,y:0,scale:1}:effects.camera(t);ctx.save();ctx.translate(camera.x,camera.y);ctx.translate(480,270);ctx.scale(camera.scale,camera.scale);ctx.translate(-480,-270);if(shake>0&&!reducedMotion){ctx.translate(Math.sin(t*.089)*shake*.34,Math.cos(t*.071)*shake*.22);shake=Math.max(0,shake-1.4)}battleCamera.apply(ctx,cameraView);drawEnvironment(reducedMotion?0:now);effects.back(ctx,t);
    let p=st.players||[];
    if(mode==='online'&&lastRemote&&remote===st){
      const alpha=Math.min(1,acc/(1/C.FPS));p=interpolateFighters(st.players,lastRemote.players,alpha);
    }
    else if(mode!=='online'&&p.length===2&&smoothLocal[0]){const alpha=Math.min(1,acc/(1/C.FPS));p=interpolateFighters(st.players,smoothLocal,alpha)}
    if(p.length===2){drawFighter(p[0],smoothLocal[0],now,0);drawFighter(p[1],smoothLocal[1],now,1);drawProjectiles(st.projectiles,now);if(showBoxes){drawHitboxes(p[0]);drawHitboxes(p[1])}}
    drawEffects(t);skillFX.draw(ctx,t,{groundY:448,yScale:.82});ctx.restore();P.drawEntrance(ctx,st,{reducedMotion});if(!reducedMotion)effects.screen(ctx,t);if(activeCutin){const age=performance.now()-activeCutin.born;if(age>=850){activeCutin=null}else{
      const intensity=age<135?age/135:age>680?(850-age)/170:1;
      const pic=cutins[activeCutin.char];ctx.save();ctx.globalAlpha=Math.min(1,Math.max(0,intensity));
      ctx.fillStyle='rgba(3,6,24,.74)';ctx.fillRect(0,0,960,540);
      const x=activeCutin.slot===0?610:48;
      if(pic?.complete&&pic.naturalWidth){ctx.shadowBlur=35;ctx.shadowColor=roster[activeCutin.char]?.accent||'#ffbb80';ctx.drawImage(pic,x,-45,310,625)}
      const accent=roster[activeCutin.char]?.accent||'#ffe0aa';ctx.shadowBlur=15;ctx.shadowColor=accent;ctx.fillStyle=accent;ctx.font='900 italic 52px sans-serif';ctx.fillText('SUPER ART!',activeCutin.slot===0?42:525,220);ctx.font='800 30px sans-serif';ctx.fillText(roster[activeCutin.char]?.superName||'',activeCutin.slot===0?47:530,267);
      ctx.restore();
   }}if(superFlash>0){ctx.fillStyle='rgba(13,7,35,'+(Math.min(.48,superFlash*.025))+')';ctx.fillRect(0,0,960,540);superFlash--}if(flash>.015){ctx.fillStyle='rgba(255,245,210,'+(Math.min(.20,flash*.18))+')';ctx.fillRect(0,0,960,540);flash*=.79}
  }
  function loop(now){const dt=Math.min(.12,(now-lastTick)/1000);lastTick=now;acc+=dt;{let steps=0;while(acc>=1/C.FPS&&steps<6){tick();acc-=1/C.FPS;steps++}if(steps===6)acc=0}frameDraw(now/1000);requestAnimationFrame(loop)}requestAnimationFrame(loop);
  netStats();
  try{onlineNickname=localStorage.getItem('azhi_player_nickname')||''}catch{}
  if(!validatedOnlineName(onlineNickname))onlineNickname='旅人'+String(Math.floor(Math.random()*9000)+1000);
  $('onlineNickname').value=onlineNickname;$('onlineRoomTitle').value='雙人格鬥房';updateOnlineRoster([]);
  const params=new URLSearchParams(location.search);if(Object.hasOwn(roster,params.get('char'))){selected=params.get('char');save.character=selected}if(params.get('room')){$('roomInput').value=params.get('room').replace(/[^A-Za-z0-9]/g,'').slice(0,8);mode='online'}
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));$('soundToggle').onclick=()=>{audioEnabled=!audioEnabled;if(audioEnabled)effects.unlock();save.sound=audioEnabled;updateProgress();if(audioEnabled)sound('win')};$('fxToggle').onclick=()=>{const next={cinema:'standard',standard:'low',low:'cinema'}[effects.quality];effects.setQuality(next);skillFX.setQuality(next==='low'?'low':'high');save.vfx=next;updateProgress();toast('打擊特效：'+({cinema:'電影級',standard:'標準',low:'省電'}[next]));canvas.focus({preventScroll:true})};canvas.addEventListener('pointerdown',()=>{if(!menuOpen())canvas.focus({preventScroll:true})});
  updateProgress();setMode(mode);window.AzhiDebug={get core(){return C},get local(){return state},get remote(){return remote},get mode(){return mode},get vfx(){return effects},get rollback(){return netSession},get netFrame(){return serverFrame},get skillFX(){return skillFX},previewHit:(move='heavy')=>{const p=(mode==='online'?remote:state)?.players?.[0];const e={kind:'hit',slot:0,x:p?.x?Math.min(870,p.x+100):480,y:0,damage:move==='super'?44:move==='heavy'?24:9,move,combo:1,counter:false,block:false};addParticles(e)},startLocal};
})();
