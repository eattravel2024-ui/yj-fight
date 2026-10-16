/* Phase 3: real encounter selection and presentation; combat/results remain client-owned. */
'use strict';
window.AzhiArcadeFlowFactory={create({panes,game,battle,open,playSound}){
 const S=window.AzhiStages,M=window.AzhiCampaign,C=window.AzhiCore,Art=window.AzhiCharacterArt,A=window.AzhiAudio;
 const local=typeof game.planLocal==='function',motion=matchMedia('(prefers-reduced-motion: reduce)');
 let missionId=null,stageId=game.practiceStage||'harbor',renderKey='',generation=0,pendingPlan=null,resultTimer=null,vsTimer=null,loadTimer=null;
 const text=(node,value)=>{if(node.textContent!==String(value))node.textContent=value;};
 const by=(pane,id)=>panes[pane].querySelector('#'+id);
 const button=(label,fn,className='secondary')=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.className=className;b.onclick=fn;return b;};
 function imageStage(image,id,large=false){
  const stage=S.get(id),key=id+':'+large;if(image.dataset.stageKey===key)return;image.dataset.stageKey=key;image.hidden=!stage?.available;if(stage?.available&&!motion.matches){for(const animation of image.getAnimations())animation.cancel();image.animate([{opacity:.4,transform:'translateX(10px)'},{opacity:1,transform:'translateX(0)'}],{duration:220,easing:'ease-out'});}
  if(!stage?.available)return;const paths=[large?stage.combatAsset:stage.previewAsset,stage.backgroundAsset,stage.fallbackAsset].filter(Boolean);let index=0;
  image.alt=stage.name+' · '+stage.theme;image.onerror=()=>{if(image.dataset.stageKey!==key)return;if(++index<paths.length)image.src=paths[index];else image.hidden=true;};image.src=paths[0];
 }
 const heading=(title,kicker)=>'<header class="journey-heading"><div><small>'+kicker+'</small><h2>'+title+'</h2></div><span>01 選手　/　<span class="active">02 擂台</span>　/　03 FIGHT</span></header>';
 function selector(pane,kind){
  pane.classList.add('journey-pane');pane.innerHTML=heading(kind==='missions'?'下一戰，打出你的名號。':'選擇你的擂台。',kind==='missions'?'ARCADE / MISSION SELECT':'TRAINING / STAGE SELECT')+'<div class="journey-layout"><section class="journey-choices" aria-label="'+(kind==='missions'?'街機關卡':'場景')+'"></section><section class="journey-preview"><div class="journey-stage-image"><img alt=""><span class="journey-stage-number"></span><div><small></small><h3></h3></div></div><div class="journey-opponent"><img width="88" height="88" alt=""><div><small></small><h3></h3><p></p></div></div><p class="journey-description"></p><div class="journey-meta"></div></section></div><footer class="journey-actions"><span>← → / ↑ ↓ 選擇　Enter 確認　Esc 返回</span><div></div></footer>';
  const list=pane.querySelector('.journey-choices');
  const records=kind==='missions'?M.MISSIONS:S.IDS.map(S.get);
  for(const [index,record] of records.entries()){
   const b=button('',()=>choose(kind,record.id),'journey-choice');b.dataset[kind==='missions'?'mission':'stage']=record.id;
   b.innerHTML='<b>'+String(index+1).padStart(2,'0')+'</b><div><strong></strong><span></span></div><small></small>';
   b.querySelector('strong').textContent=kind==='missions'?record.title:record.name;
   b.querySelector('span').textContent=kind==='missions'?C.CHAR[record.enemy].name+' / '+S.get(record.stage).name:record.theme;if(kind==='stages'&&record.available){const thumb=document.createElement('img');thumb.width=100;thumb.height=56;thumb.loading='lazy';imageStage(thumb,record.id);b.prepend(thumb);}list.append(b);
  }
  const actions=pane.querySelector('.journey-actions>div'),back=button('← 返回選角',()=>open('fighters'));back.dataset.journeyBack='';actions.append(back);
  const confirm=button(kind==='missions'?'挑戰本關 →':'進入練習 →',()=>confirmChoice(kind),'primary');confirm.id=kind==='missions'?'missionConfirm':'stageConfirm';actions.append(confirm);
  pane.addEventListener('keydown',event=>{
   if(event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return;
   const choices=[...list.querySelectorAll('button:not(:disabled)')],selected=kind==='missions'?missionId:stageId,focused=event.target.closest('.journey-choice'),index=focused?choices.indexOf(focused):choices.findIndex(b=>(b.dataset.mission||b.dataset.stage)===selected);
   const delta={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[event.key];
   if(delta){event.preventDefault();const b=choices[(index+delta+choices.length)%choices.length];if(b){choose(kind,b.dataset.mission||b.dataset.stage);b.focus({preventScroll:true});}}
   if(event.key==='Enter'&&!event.repeat&&!event.target.closest('[data-journey-back]')){event.preventDefault();confirmChoice(kind);}
  });
 }
 selector(panes.missions,'missions');selector(panes.stages,'stages');
 function choose(kind,id){
  if(!local||game.busy)return;
  if(kind==='missions'){if(!M.canPlay(id,game.campaignProgress))return;missionId=id;}else{if(!S.playable(id))return;stageId=id;}
  renderKey='';refresh();playSound('move');
 }
 function renderSelection(kind){
  const progress=game.campaignProgress,mission=M.get(missionId),stage=S.get(kind==='missions'?mission?.stage:stageId),pane=panes[kind];if(!stage?.available)return;
  for(const b of pane.querySelectorAll('.journey-choice')){
   const id=b.dataset.mission||b.dataset.stage,available=kind==='missions'?M.canPlay(id,progress):S.playable(id),selected=id===(kind==='missions'?missionId:stageId);
   b.disabled=!available;b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected));b.tabIndex=selected?0:-1;
   text(b.querySelector('small'),kind==='missions'?(progress.completed.includes(id)?'✓ CLEAR':available?'挑戰':'未解鎖'):available?'READY':id==='legislature'?'素材待匯入':'準備中');
  }
  imageStage(pane.querySelector('.journey-stage-image>img'),stage.id,true);text(pane.querySelector('.journey-stage-number'),'STAGE '+String(stage.number).padStart(2,'0'));
  text(pane.querySelector('.journey-stage-image small'),stage.theme);text(pane.querySelector('.journey-stage-image h3'),stage.name);
  const opponent=pane.querySelector('.journey-opponent'),char=kind==='missions'?mission.enemy:game.character;Art.bindImage(opponent.querySelector('img'),char,'portrait');text(opponent.querySelector('small'),kind==='missions'?'CPU / 本關對手':'PLAYER / 你的選手');text(opponent.querySelector('h3'),C.CHAR[char].name);text(opponent.querySelector('p'),C.CHAR[char].special);
  text(pane.querySelector('.journey-description'),kind==='missions'?mission.detail:stage.description);
  text(pane.querySelector('.journey-meta'),kind==='missions'?'CPU 強度 '+mission.difficulty+' / 3　·　勝利獎勵 '+mission.reward+' G　·　三戰兩勝':'自由練習　·　木樁：維尼　·　獨立地圖 BGM　·　16:9');
 }
 function refresh(){
  if(!local)return;const panel=window.AzhiShell?.currentPanel;if(!['missions','stages'].includes(panel))return;
  const key=JSON.stringify([panel,game.character,game.campaignProgress,missionId,stageId]);if(key===renderKey)return;renderKey=key;renderSelection(panel);
 }
 function confirmChoice(kind){
  if(!local||game.busy||window.AzhiShell?.currentPanel!==kind||(kind==='missions'?game.mode!=='arcade':game.mode!=='practice'))return;const plan=game.planLocal(kind==='missions'?{missionId}:{stage:stageId});if(plan)showVersus(plan);
 }
 function fillVersus(root,players,stageId,labels=[]){
  const stage=S.get(stageId);root.replaceChildren();
  const backdrop=document.createElement('img');backdrop.className='versus-background';imageStage(backdrop,stage?.id||'night',true);root.append(backdrop);
  const teams=document.createElement('div');teams.className='versus-fighters';
  for(const side of [0,1]){
   const group=document.createElement('section');group.className='versus-side side-'+side;const list=players.filter((p,i)=>(p.team??p.slot??i)%2===side);
   for(const p of list){const card=document.createElement('div');card.className='versus-fighter';const img=document.createElement('img');img.width=768;img.height=1024;Art.bindImage(img,p.char,'fullbody');const name=document.createElement('h3'),label=document.createElement('small');name.textContent=C.CHAR[p.char]?.name||'';label.textContent=labels[p.slot]||(side?'CPU / RIVAL':'PLAYER 1');card.append(img,label,name);group.append(card);}teams.append(group);
  }
  const center=document.createElement('strong');center.className='versus-word';center.textContent='VS';const info=document.createElement('div');info.className='versus-stage';info.textContent=(stage?'STAGE '+String(stage.number).padStart(2,'0')+' / '+stage.name:'擂台對決');root.append(teams,center,info);
 }
 panes.versus.classList.add('journey-versus');const vs=document.createElement('div');vs.className='versus-screen';panes.versus.append(vs);
 const vsFoot=document.createElement('div');vsFoot.className='versus-foot';const vsStatus=document.createElement('span');vsStatus.setAttribute('role','status');const retry=button('重試載入',()=>pendingPlan&&showVersus(pendingPlan));retry.hidden=true;vsFoot.append(vsStatus,retry,button('Esc / 返回',()=>back('versus')));panes.versus.append(vsFoot);
 function cancelPending(){generation++;clearTimeout(vsTimer);clearTimeout(loadTimer);clearTimeout(resultTimer);vsTimer=loadTimer=resultTimer=null;}
 async function showVersus(plan){
  cancelPending();const token=generation;pendingPlan=plan;open('versus');fillVersus(vs,[{slot:0,char:plan.character},{slot:1,char:plan.enemy}],plan.stage);text(vsStatus,'正在準備擂台…');retry.hidden=true;
  A.sting('vs',{key:'journey-vs:'+token,lane:'announcer',duration:.85,guard:()=>generation===token});A.preload([S.get(plan.stage).bgm,'round_start','ko','victory','defeat']);
  const started=performance.now();
  const loaded=await Promise.race([game.preloadLocal(plan),new Promise(resolve=>{loadTimer=setTimeout(()=>resolve(false),5000);})]);clearTimeout(loadTimer);
  if(token!==generation||window.AzhiShell?.currentPanel!=='versus'||!window.AzhiShell.isOpen())return;
  if(!loaded){text(vsStatus,'必要戰鬥素材載入失敗，請重試或返回選擇。');retry.hidden=false;return;}
  text(vsStatus,'選手就位 · READY TO FIGHT');
  vsTimer=setTimeout(()=>{if(token!==generation||!window.AzhiShell.isOpen()||window.AzhiShell.currentPanel!=='versus')return;if(!game.startLocal({missionId:plan.missionId,stage:plan.stage,vsShown:true})){text(vsStatus,'目前無法開戰，請返回確認角色與關卡。');retry.hidden=false;}},Math.max(0,(motion.matches?350:1150)-(performance.now()-started)));
 }
 const battleVS=document.createElement('div');battleVS.className='battle-versus';battleVS.hidden=true;battleVS.setAttribute('aria-hidden','true');const battleVSView=document.createElement('div');battleVSView.className='versus-screen';battleVS.append(battleVSView);battle.querySelector('.arena').append(battleVS);let introRound=0;
 window.AzhiVersusPresentation={update(state){if(!battleVS.hidden&&(!state||state.round!==introRound||state.introFrames<=18))battleVS.hidden=true;}};
 function battleStart(detail={}){
  cancelPending();battleVS.hidden=true;const state=game.game;
  if(!state||detail.vsShown||state.introFrames<=18)return;introRound=state.round;
  const labels=[];for(const p of game.selectionContext().players||[])labels[p.slot]=p.name+(p.host?' / HOST':'');
  fillVersus(battleVSView,state.players,state.stage,labels);battleVS.hidden=false;
 }
 panes.results.classList.add('journey-result-pane');
 function showResult(result){
  if(!local||!result||game.lastLocalResult?.id!==result.id)return;cancelPending();const pane=panes.results,mission=M.get(result.missionId),winner=result.won?result.character:result.enemy;
  pane.innerHTML='<div class="journey-result"><div class="journey-result-art"><img width="768" height="1024" alt=""></div><section><small></small><h2></h2><h3></h3><p class="result-mission"></p><div class="result-score"></div><p class="result-reward"></p><p class="result-detail"></p><div class="result-actions"></div></section></div>';
  Art.bindImage(pane.querySelector('img'),winner,'fullbody');text(pane.querySelector('small'),result.complete?'ARCADE COMPLETE':result.won?'YOU WIN':'TRY AGAIN');text(pane.querySelector('h2'),result.complete?'全五關通關！':result.won?'這一場，你說了算。':'再練一拳，下場討回來。');text(pane.querySelector('h3'),C.CHAR[winner].name+' · WINNER');text(pane.querySelector('.result-mission'),mission.title+' / '+S.get(result.stage).name);text(pane.querySelector('.result-score'),result.scores[0]+' : '+result.scores[1]);text(pane.querySelector('.result-reward'),result.won?'本場獎勵 +'+result.reward+' G · 進度已保存':'本場未獲勝 · 不扣格鬥幣');
  text(pane.querySelector('.result-detail'),result.complete?'街機冠軍就是你。保留解鎖進度，再來一輪也行。':result.won?'下一關：'+(M.get(result.nextMissionId)?.title||'闖關完成'):'觀察出招空檔，防禦後接 J → K → U。');
  const actions=pane.querySelector('.result-actions'),primary=button(result.complete?'再闖第一關 →':result.won?'下一關 →':'重新挑戰 →',()=>{
   if(window.AzhiShell?.currentPanel!=='results')return;const next=result.complete?M.IDS[0]:result.won?result.nextMissionId:result.missionId;const plan=game.planLocal({missionId:next});if(plan)showVersus(plan);
  },'primary');primary.id='resultContinue';actions.append(primary,button('返回關卡',()=>{missionId=result.missionId;open('missions');}),button('返回主選單',()=>open('home')));open('results');primary.focus({preventScroll:true});
 }
 function onResult(result){cancelPending();const token=generation;resultTimer=setTimeout(()=>{if(token===generation&&!window.AzhiShell.isOpen()&&game.lastLocalResult?.id===result.id)showResult(result);},motion.matches?1250:1950);}
 function onLocalConfirm(){
  if(!local||!['arcade','practice'].includes(game.mode)||game.busy)return;
  missionId=M.IDS[M.unlocked(game.campaignProgress)];stageId=game.practiceStage||'harbor';renderKey='';open(game.mode==='arcade'?'missions':'stages');
 }
 function enter(panel){
  if(panel!=='versus')cancelPending();battleVS.hidden=true;
  if(panel==='missions'&&local){if(!M.canPlay(missionId,game.campaignProgress))missionId=M.IDS[M.unlocked(game.campaignProgress)];renderKey='';renderSelection('missions');}
  if(panel==='stages'&&local){if(!S.playable(stageId))stageId=game.practiceStage||'harbor';renderKey='';renderSelection('stages');}
 }
 function back(panel){if(!local)return false;if(panel==='versus'){cancelPending();open(game.mode==='practice'?'stages':'missions');return true;}if(['missions','stages'].includes(panel)){open('fighters');return true;}return false;}
 function focus(panel){const el=panes[panel]?.querySelector('.journey-choice.is-selected,.result-actions button,.versus-foot button:not([hidden])');el?.focus({preventScroll:true});}
 addEventListener('pagehide',event=>{if(!event.persisted)cancelPending();});
 const api={onLocalConfirm,refresh,enter,back,focus,battleStart,onResult,showResult,cancel:cancelPending};window.AzhiArcadeFlow=api;return api;
}};
