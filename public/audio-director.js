/* Presentation-only music/event routing; confirmed network events own result sounds. */
'use strict';
(()=>{
 const A=window.AzhiAudio=window.AzhiAudioManager.create();
 const STAGE=Object.fromEntries(window.AzhiStages.IDS.map(id=>[id,window.AzhiStages.get(id).bgm]));
 Object.assign(STAGE,{night_market:STAGE.night,casino:STAGE.garage,square:STAGE.harbor});
 const INTRO={azhi:'intro_azhi',sezi:'intro_saizi',gambler:'intro_gambler',winnie:'intro_winnie'};
 let match=null,routeKey='',defaultMusic='menu',preview=null,lastPanel=null,localSerial=0;
 const started=new Set();
 function guard(id){return ()=>match?.id===id&&!['home','fighters'].includes(lastPanel);}
 function musicFor(game,mode,finalBoss=false){return finalBoss?'final_boss':STAGE[game?.stage]||'stage_night_market';}
 function begin({id,game,slot=0,mode='arcade',finalBoss=false,skipVS=false}){
  id=id||'local:'+ ++localSerial;if(match?.id===id)return;
  for(const lane of ['announcer','intro','ko','result'])A.stopLane(lane);
  match={id,slot,mode,finalBoss,round:game.round||1,finished:false,awaiting:game.introFrames>0,track:musicFor(game,mode,finalBoss)};routeKey='';
  A.preload([match.track,'vs','round_start','ko','victory','defeat',...Object.values(INTRO)]);
  if(game.introFrames>0){if(!skipVS)A.sting('vs',{key:id+':vs',lane:'announcer',duration:.85,guard:()=>match?.id===id});
   const who=game.players?.find(p=>p.slot===slot)||game.players?.[0];if(INTRO[who?.char])A.sting(INTRO[who.char],{key:id+':intro',lane:'intro',delay:.4,level:.48,guard:()=>match?.id===id});}
  A.setMusic(match.track);
 }
 function observe(game){
  if(!game||!match)return;
  if((game.round||1)>match.round){match.round=game.round;match.awaiting=game.introFrames>0;}
  if((game.round||1)!==match.round)return;
  if(match.awaiting&&game.introFrames===0&&game.status==='playing'){
   match.awaiting=false;const key=match.id+':round-start:'+game.round;if(!started.has(key)){started.add(key);if(started.size>128)started.delete(started.values().next().value);A.stopLane('announcer');A.sting('round_start',{key,lane:'announcer',guard:guard(match.id)});}
  }
 }
 function events(list,game){
  if(!match)return;
  for(const e of list||[])if(e.kind==='round'&&e.winner>=0&&game?.players?.some(p=>p.hp<=0))A.sting('ko',{key:match.id+':ko:'+e.round,lane:'ko',duration:1.6,guard:guard(match.id)});
 }
 function finish(game){
  if(!match||match.finished||game?.status!=='finished')return;match.finished=true;routeKey='';A.stopLane('intro');
  const winner=game.winnerTeam??game.winner,own=game.ruleset==='team'?match.slot%2:match.slot;
  if(Number.isInteger(winner)&&winner>=0){const id=match.id;A.sting(match.slot<0||winner===own?'victory':'defeat',{key:id+':result',lane:'result',delay:1.65,guard:()=>match?.id===id&&match.finished&&!['home','fighters'].includes(lastPanel)});}
  A.setMusic('results');
 }
 function route({panel,open,game,mode}){
  const scene=open?panel:'battle',key=scene+':'+mode+':'+(match?.id||'')+':'+!!match?.finished+':'+!!game;
  if(key===routeKey)return;routeKey=key;if(lastPanel!==scene){preview=null;A.stopLane('preview');}lastPanel=scene;
  if(['home','fighters','missions','stages'].includes(scene)){for(const lane of ['announcer','intro','ko','result'])A.stopLane(lane);}
  defaultMusic=scene==='fighters'?'character_select':scene==='missions'?'mission_select':scene==='stages'?'stage_select':scene==='versus'?null:scene==='results'?'results':scene==='battle'&&game&&match?(match.finished?'results':match.track):scene==='battle'&&!game&&mode==='arcade'?'mission_select':scene==='battle'&&!game&&mode==='practice'?'training':['room','competition'].includes(scene)&&game&&match?.finished?'results':'menu';
  A.setMusic(defaultMusic);
 }
 function setScene(id){preview=null;return A.setMusic(id);}
 function previewTrack(id){const track=A.snapshot.tracks.find(t=>t.id===id);if(!track)return;preview=id;if(track.kind==='bgm')A.setMusic(id);else A.sting(id,{lane:'preview'});}
 function stopPreview(){preview=null;A.stopLane('preview');A.setMusic(defaultMusic);}
 function mountSettings(pane){
  const box=document.createElement('section');box.className='audio-settings';box.innerHTML='<h3>原創配樂與音效</h3><p>第一次操作後啟用音訊。背景音樂與打擊音效可分開調整。</p><label for="bgmVolume">背景音樂 BGM <output id="bgmVolumeValue"></output></label><input id="bgmVolume" type="range" min="0" max="100" step="1"><label for="sfxVolume">音效 SFX <output id="sfxVolumeValue"></output></label><input id="sfxVolume" type="range" min="0" max="100" step="1"><p id="audioStatus" role="status"></p><div class="audio-actions"><button type="button" id="audioMasterToggle">關閉全部音訊</button><button type="button" id="audioUnlock">啟用音訊</button><button type="button" id="audioRetry">重試音檔載入</button></div><label for="audioTrackPreview">OST 音樂試聽</label><select id="audioTrackPreview" aria-label="OST 音樂試聽"></select><div class="audio-actions"><button type="button" id="audioPreviewPlay">播放選取曲目</button><button type="button" id="audioPreviewStop">結束試聽</button></div><p class="audio-note">四首場景配樂均可試聽；「絨毛禁區」地圖尚未加入遊戲。任務曲用於選關、選圖曲用於場景選擇；製作名單曲保留未來使用。</p>';pane.append(box);
  const $=id=>box.querySelector('#'+id);
  function render(s){if($('audioTrackPreview').options.length!==s.tracks.length){$('audioTrackPreview').replaceChildren(...s.tracks.map(t=>{const option=document.createElement('option');option.value=t.id;option.textContent=(t.kind==='bgm'?'BGM':'短曲')+' · '+t.title_zh;return option;}));}for(const k of ['bgm','sfx']){const input=$(k+'Volume');if(document.activeElement!==input)input.value=Math.round(s[k]*100);$(k+'VolumeValue').textContent=Math.round(s[k]*100)+'%';}
   $('audioStatus').textContent=s.errors.length?'部分音檔載入失敗，遊戲可繼續；可重試載入。':!s.enabled?'音訊已關閉。':s.contextState==='suspended'&&s.ready?'音訊已暫停；返回遊戲或按啟用音訊。':s.ready?'音訊已就緒 · '+(s.tracks.find(t=>t.id===s.current)?.title_zh||'等待播放'):'等待首次點擊或按鍵啟用音訊。';$('audioMasterToggle').textContent=s.enabled?'關閉全部音訊':'開啟全部音訊';$('audioUnlock').disabled=s.ready&&s.contextState==='running';}
  for(const k of ['bgm','sfx'])$(k+'Volume').addEventListener('input',e=>A.setVolume(k,Number(e.target.value)/100));
  $('audioMasterToggle').onclick=()=>{A.setEnabled(!A.enabled);A.unlock()};$('audioUnlock').onclick=()=>A.unlock();$('audioRetry').onclick=()=>{A.unlock();A.retry()};$('audioPreviewPlay').onclick=async()=>{await A.unlock();previewTrack($('audioTrackPreview').value)};$('audioPreviewStop').onclick=stopPreview;
  A.loading.then(()=>render(A.snapshot));A.subscribe(render);render(A.snapshot);
 }
 const unlock=e=>{if(e.isTrusted)A.unlock();};document.addEventListener('pointerdown',unlock,{capture:true,passive:true});document.addEventListener('keydown',unlock,{capture:true});
 document.addEventListener('visibilitychange',()=>A.setHidden(document.hidden));addEventListener('pagehide',e=>{if(e.persisted)A.setHidden(true);else A.dispose()});addEventListener('pageshow',e=>{if(e.persisted)A.setHidden(document.hidden)});
 addEventListener('azhi:audio-scene',e=>setScene(e.detail?.scene));
 A.loading.then(()=>A.preload(['menu','character_select','vs','round_start',...Object.values(INTRO)]));
 window.AzhiAudioDirector={begin,observe,events,finish,route,mountSettings,setScene,previewTrack,stopPreview,musicFor,STAGE:Object.freeze(STAGE),INTRO:Object.freeze(INTRO)};
})();
