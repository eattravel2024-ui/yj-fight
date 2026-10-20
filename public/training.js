/* Local training adapter. Lessons observe the shared 60Hz engine; they never award online results. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core'):root.AzhiCore);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiTraining=api;})(globalThis,function(C){
'use strict';
const root=globalThis;
const LESSONS=Object.freeze([
 {id:'movement',title:'先會走，再開打',keys:'A / D · W',detail:'向任一方向移動一小段距離，熟悉走位。',goal:'完成走位練習',dummy:'idle'},
 {id:'strike',title:'打出第一拳',keys:'J',detail:'靠近對手，用輕拳真正命中一次。',goal:'輕拳命中',dummy:'idle'},
 {id:'guard',title:'擋下再反擊',keys:'L',detail:'按住 L，擋下訓練對手的重拳。S＋L 可蹲防。',goal:'成功防禦一次',dummy:'attack'},
 {id:'combo',title:'連打，有節奏',keys:'J → K → U',detail:'輕拳命中時接重拳，完成至少 2 HIT；下方提示會顯示可取消窗口。',goal:'同一連段 2 HIT',dummy:'idle'},
 {id:'signature',title:'你的專屬狠招',keys:'U · 25 能量',detail:'使用角色專屬必殺並命中。O 是 60 能量超必殺，可於自由練習研究。',goal:'必殺命中',dummy:'idle'},
 {id:'throw',title:'抱歉，借摔一下',keys:'H',detail:'近身按 H 抓取，等摔投落地造成傷害。被抓時立即按 H 可解摔（10 F）。',goal:'摔投造成傷害',dummy:'guard'}
].map(Object.freeze));
const DUMMIES=Object.freeze({idle:'站立',guard:'持續防禦',crouch:'蹲下防禦',attack:'定時重拳'});
function create(){
 let lesson='free',dummy='idle',complete=false,progress=0,origin=0,elapsed=0,lastHit=null;
 function configure(id){if(id!=='free'&&!LESSONS.some(l=>l.id===id))return false;lesson=id;dummy=LESSONS.find(l=>l.id===id)?.dummy||'idle';complete=false;progress=0;lastHit=null;return true;}
 function begin(game){complete=false;progress=0;elapsed=0;lastHit=null;origin=game.players[0].x;
  if(lesson!=='free'){const near=lesson!=='movement';game.players[0].x=near?390:274;game.players[1].x=near?454:686;origin=game.players[0].x;}
 }
 function input(game){elapsed++;if(game.introFrames>0||game.status!=='playing')return {};const p=game.players[1],q=game.players[0];
  if(dummy==='guard')return {guard:true};if(dummy==='crouch')return {guard:true,down:true};
  if(dummy==='attack')return {left:p.x>q.x+65,right:p.x<q.x-65,pulses:elapsed%90===0?['heavy']:[]};return {};
 }
 function observe(game,events){
  const p=game.players[0];if(lesson==='movement'){progress=Math.max(progress,Math.min(80,Math.abs(p.x-origin)));if(progress>=80)complete=true;}
  for(const e of events||[]){
   if(e.kind!=='hit')continue;
   if(e.slot===0){lastHit={move:e.move,damage:e.appliedDamage??e.damage,block:!!e.block,combo:e.combo||0};}
   if(lesson==='guard'&&e.target===0&&e.block){progress=1;complete=true;}
   if(e.slot!==0||e.block||!(e.appliedDamage>0))continue;
   if(lesson==='strike'&&['light','light2','light3'].includes(e.move)||lesson==='combo'&&e.combo>=2||lesson==='signature'&&e.move==='special'||lesson==='throw'&&e.move==='throw'){progress=1;complete=true;}
  }
 }
 return Object.freeze({configure,begin,input,observe,setDummy(value){if(!Object.hasOwn(DUMMIES,value)||lesson!=='free')return false;dummy=value;return true;},get snapshot(){return {lesson,dummy,complete,progress,lastHit: lastHit&&{...lastHit}};}});
}
function frame(game){const p=game?.players?.[0];if(!p)return '等待開始';if(game.hitstop)return 'HITSTOP · '+game.hitstop+' F';if(p.grappleRole)return (p.grappleRole==='victim'?'被抓取 · H 解摔':'摔投中');if(p.stun)return (p.blockstun?'BLOCKSTUN':'HITSTUN')+' · '+p.stun+' F';if(!p.move)return 'NEUTRAL · 自由行動';const d=C.moveFor(p,p.move.name),f=p.move.frame;if(!d)return '出招中';return (f<d.start?'STARTUP':f<d.start+d.active?'ACTIVE':'RECOVERY')+' · '+f+' / '+(d.start+d.active+d.recovery)+' F';}
function mount({pane,guide,game,arena,open,team,navigate}){
 const node=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text)n.textContent=text;return n;};
 let completed=[];try{const value=JSON.parse(localStorage.getItem('azhi_bootcamp_v1')||'[]');if(Array.isArray(value))completed=value.filter(id=>LESSONS.some(l=>l.id===id));}catch{}
 pane.classList.add('training-hub');const head=node('header','training-heading');head.append(node('small','','TRAINING CAMP / LEARN BY FIGHTING'),node('h2','','從第一拳，到你的第一勝。'),node('p','','選一堂課就能下場練。招式、技能幀表與自由練習都在這裡。'));pane.append(head);
 const grid=node('div','training-grid'),lessons=node('section','training-lessons'),cards=[];grid.append(lessons);
 const start=id=>{if(game.busy){open(game.onlineStatus?.kind?'competition':'room');return;}if(team){navigate('practice','training');return;}if(!game.requestMode('practice')||!game.setTrainingLesson(id))return;open('fighters');};
 for(const [i,l]of LESSONS.entries()){const b=node('button','training-lesson');b.type='button';b.dataset.lesson=l.id;b.append(node('span','training-number',String(i+1).padStart(2,'0')),node('strong','',l.title),node('kbd','',l.keys),node('span','training-lesson-goal',l.goal),node('span','training-check',completed.includes(l.id)?'已完成 ✓':'開始 →'));b.addEventListener('click',()=>start(l.id));lessons.append(b);cards.push(b);}
 const lab=node('aside','training-lab-card'),art=node('img','training-art');art.alt='';art.width=384;art.height=512;root.AzhiCharacterArt?.bindImage(art,game.character,'fullbody');lab.append(node('small','','FREE LAB / YOUR PACE'),node('h3','','自由練習'),node('p','','四位角色、四張舞台。自由切換木樁、查看出招階段，或重置場面重新練習。'),art);const free=node('button','player-primary','進入自由練習 →');free.id='trainingFree';free.type='button';free.addEventListener('click',()=>start('free'));lab.append(free);grid.append(lab);pane.append(grid);
 const details=node('details','training-reference'),summary=node('summary','','招式手冊 · 操作、角色技能與真實幀表');details.append(summary,...guide.children);for(const section of details.querySelectorAll('.training-panel details'))section.open=true;pane.append(details);
 if(team)return {refresh(){}};
 const overlay=node('section','training-session');overlay.hidden=true;overlay.setAttribute('aria-label','實際操作訓練');overlay.innerHTML='<div class="training-task"><small>TRAINING CAMP / LESSON</small><strong id="trainingTaskTitle"></strong><span id="trainingTaskHint"></span><output id="trainingTaskProgress" aria-live="polite"></output><button type="button" id="trainingNext" hidden>下一課 →</button></div><details class="training-tools"><summary>訓練控制</summary><label>對手 <select id="trainingDummy"></select></label><div class="training-tool-actions"><button type="button" id="trainingReset">重置場面</button><button type="button" id="trainingHitboxes">判定框</button><button type="button" id="trainingReturn">課程／招式</button></div><output id="trainingFrame"></output><small id="trainingHitReceipt"></small></details>';
 arena.append(overlay);overlay.querySelector('.training-tools').addEventListener('toggle',event=>arena.classList.toggle('training-controls-open',event.currentTarget.open));const $=id=>overlay.querySelector('#'+id);for(const [id,label]of Object.entries(DUMMIES)){const opt=node('option','',label);opt.value=id;$('trainingDummy').append(opt);}
 $('trainingDummy').addEventListener('change',()=>game.setTrainingDummy($('trainingDummy').value));$('trainingReset').addEventListener('click',()=>game.resetTraining());$('trainingReturn').addEventListener('click',()=>open('training'));
 $('trainingHitboxes').addEventListener('click',()=>document.getElementById('hitboxToggle')?.click());
 $('trainingNext').addEventListener('click',()=>{const s=game.training;if(!s?.complete)return;const index=LESSONS.findIndex(l=>l.id===s.lesson);if(index<LESSONS.length-1){game.setTrainingLesson(LESSONS[index+1].id);game.resetTraining();}else open('training');});
 let lastLesson='',lastCharacter=game.character;
 function text(id,value){const el=$(id);if(el.textContent!==value)el.textContent=value;}
 function refresh(){if(lastCharacter!==game.character){lastCharacter=game.character;root.AzhiCharacterArt?.bindImage(art,game.character,'fullbody');}const active=game.mode==='practice'&&!!game.game;overlay.hidden=!active;arena.classList.toggle('training-active',active);if(!active)return;const s=game.training,l=LESSONS.find(l=>l.id===s.lesson);if(!s)return;
  text('trainingTaskTitle',l?l.title:'自由練習 · '+C.CHAR[game.game.players[0].char].name);text('trainingTaskHint',l?l.keys+' / '+l.detail:'J → K → U · H 抓／解摔 · 展開控制調整木樁');
  text('trainingTaskProgress',l?(s.complete?'CLEAR ✓ · 可進入下一課':l.id==='movement'?'走位進度 '+Math.round(s.progress/80*100)+'%':l.goal):'自由練習不計勝負');
  overlay.dataset.complete=String(s.complete);$('trainingNext').hidden=!l||!s.complete;$('trainingNext').textContent=l?.id==='throw'?'訓練完成 →':'下一課 →';$('trainingDummy').disabled=!!l;if($('trainingDummy').value!==s.dummy)$('trainingDummy').value=s.dummy;
  text('trainingFrame',frame(game.game));text('trainingHitReceipt',s.lastHit?'上次接觸：'+(s.lastHit.block?'防禦':'命中')+' −'+s.lastHit.damage+' HP / '+s.lastHit.combo+' HIT':'前搖 → 有效 → 收招 · 60Hz 真實幀數');
  if(lastLesson!==s.lesson){lastLesson=s.lesson;overlay.querySelector('.training-tools').open=false;}
  if(s.complete&&!completed.includes(s.lesson)){completed.push(s.lesson);try{localStorage.setItem('azhi_bootcamp_v1',JSON.stringify(completed));}catch{}cards.find(b=>b.dataset.lesson===s.lesson)?.querySelector('.training-check')?.replaceChildren(document.createTextNode('已完成 ✓'));}
 }
 function liveFrames(){if(!overlay.hidden&&overlay.querySelector('.training-tools').open)text('trainingFrame',frame(game.game));requestAnimationFrame(liveFrames);}requestAnimationFrame(liveFrames);
 return {refresh};
}
return Object.freeze({LESSONS,DUMMIES,create,frame,mount});
});
