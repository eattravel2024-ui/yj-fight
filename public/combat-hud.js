/* Read-only battle presentation. No simulation, Ready authority or independent HP. */
'use strict';
(()=>{
 const C=window.AzhiCore,Art=window.AzhiCharacterArt;
 let arena,battle,team=false,announcement,headline,caption,portrait,roomAction,energySides=[],timer,observer,resizeFrame=0;
 let generation=0,round=0,introducing=false,lastIntro=0,finished=false,seen=new Set(),timers=new Set(),options={};
 const text=(el,value)=>{if(el&&el.textContent!==String(value))el.textContent=value;};
 const later=(fn,ms)=>{const gen=generation,id=setTimeout(()=>{timers.delete(id);if(gen===generation)fn();},ms);timers.add(id);};
 function announce(kind,title,detail='',duration=1150,char){
  if(!announcement)return;announcement.hidden=false;announcement.dataset.kind=kind;
  announcement.classList.remove('enter');text(headline,title);text(caption,detail);
  portrait.hidden=!char;if(char)Art.bindImage(portrait,char,'portrait');
  void announcement.offsetWidth;announcement.classList.add('enter');
  const serial=announcement.dataset.serial=String(Number(announcement.dataset.serial||0)+1);
  if(duration)later(()=>{if(announcement.dataset.serial===serial)announcement.hidden=true;},duration);
 }
 function fit(){
  if(!arena||!battle)return;const touch=battle.querySelector(':scope > .touch');
  const controls=touch&&getComputedStyle(touch).display!=='none'?touch.getBoundingClientRect().height:0;
  const style=getComputedStyle(battle),height=battle.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  const w=Math.max(1,Math.min(battle.clientWidth,(height-controls)*16/9));
  arena.style.width=w+'px';arena.style.height=w*9/16+'px';
 }
 function scheduleFit(){cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(fit);}
 function mount(root,isTeam){
  if(arena)return;team=!!isTeam;battle=root;arena=root.querySelector('.arena');
  document.body.classList.add('combat-layout');
  const hud=root.querySelector(team?'.score':'.hud');hud.classList.add('combat-top');arena.append(hud);
  timer=hud.querySelector(team?'.timer':'.roundtime');
  const power=document.createElement('div');power.className='combat-power';power.setAttribute('aria-label','雙方能量');
  for(let side=0;side<2;side++){
   const el=document.createElement('div');el.className='combat-energy side-'+side;
   if(team){el.innerHTML='<div class="team-energy-list"></div>';}
   else{
    const bars=document.getElementById('p'+(side+1)+'Meter').parentElement,cap=document.getElementById('p'+(side+1)+'Energy');
    const label=document.createElement('b');label.textContent=side?'P2 / DRIVE':'P1 / DRIVE';el.append(label,bars,cap);
   }
   energySides.push(el);power.append(el);
  }
  arena.append(power);const skills=root.querySelector('.skill-dock');skills.classList.add('combat-skills');arena.append(skills);
  const menu=document.createElement('button');menu.type='button';menu.className='combat-menu-toggle';menu.textContent='ESC / 選單';menu.setAttribute('aria-label','暫停／開啟遊戲選單');menu.onclick=()=>window.AzhiShell.open('home');arena.append(menu);
  announcement=document.createElement('div');announcement.className='combat-announcement';announcement.hidden=true;announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');
  portrait=document.createElement('img');portrait.alt='勝利角色肖像';portrait.hidden=true;
  const copy=document.createElement('div');headline=document.createElement('strong');caption=document.createElement('span');copy.append(headline,caption);announcement.append(portrait,copy);arena.append(announcement);
  roomAction=document.createElement('button');roomAction.type='button';roomAction.className='combat-result-room primary';roomAction.textContent='返回房間 / 準備再戰 →';roomAction.hidden=true;roomAction.onclick=()=>window.AzhiShell.open('room');arena.append(roomAction);
  observer=new ResizeObserver(scheduleFit);observer.observe(root);const touch=root.querySelector('.touch');if(touch)observer.observe(touch);fit();
 }
 function begin(game,opts={}){
  generation++;for(const id of timers)clearTimeout(id);timers.clear();seen.clear();round=game?.round||1;finished=false;options=opts;introducing=!!game?.introFrames;lastIntro=game?.introFrames||0;
  if(!arena)return;delete battle.dataset.result;announcement.hidden=true;roomAction.hidden=true;
  if(introducing)announce('round','ROUND '+round,'選手就位 · READY',0);
 }
 function update(game,opts={}){
  if(!arena||!game?.players?.length)return;options={...options,...opts};
  timer.dataset.urgent=String(game.time<=10&&game.time>0&&game.status==='playing'&&!game.introFrames);
  const nr=game.round||1;
  if(!finished&&nr>round&&game.introFrames>0){round=nr;introducing=true;lastIntro=game.introFrames;announce('round','ROUND '+round,'下一回合 · READY',0);}
  if(!finished&&nr===round&&introducing){
   if(game.introFrames>0&&game.introFrames<=30&&lastIntro>30)announce('fight','FIGHT!','開打！',0);
   if(game.introFrames===0){introducing=false;announce('fight','FIGHT!','',420);}
   lastIntro=game.introFrames;
  }
  if(!team){
   const badges=arena.querySelectorAll('.combat-player-tag');if(!badges.length)for(const [i,node] of [...arena.querySelectorAll('.hud-person')].entries()){const tag=document.createElement('b');tag.className='combat-player-tag';tag.dataset.side=i;node.prepend(tag);}
   const tags=arena.querySelectorAll('.combat-player-tag');text(tags[0],'P1');text(tags[1],options.mode==='online'?'P2':options.mode==='practice'?'DUMMY':'CPU');
  }else{
   for(let side=0;side<2;side++){
    const list=energySides[side].firstElementChild,players=game.players.filter(p=>(p.team??p.slot%2)===side);
    for(const p of players){
     let row=list.querySelector('[data-slot="'+p.slot+'"]');
     if(!row){row=document.createElement('div');row.dataset.slot=p.slot;row.innerHTML='<b></b><div class="energy"><div></div></div><span></span>';list.append(row);}
     const value=Math.max(0,Math.min(100,p.meter||0));text(row.firstElementChild,'P'+(p.slot+1)+' '+C.CHAR[p.char].name);row.children[1].firstElementChild.style.width=value+'%';row.children[1].dataset.level=value>=100?'max':value>=60?'super':value>=25?'special':'charging';text(row.lastElementChild,Math.floor(value)+(value>=100?' MAX':' / 100'));
    }
    for(const row of list.children)if(!players.some(p=>String(p.slot)===row.dataset.slot))row.remove();
   }
  }
 }
 function events(list,game){
  if(!arena)return;
  for(const e of list||[]){
   const key=e.id||e.kind+':'+(game?.round||round)+':'+(e.slot??'');
   if(seen.has(key))continue;seen.add(key);if(seen.size>512)seen.delete(seen.values().next().value);
   if(e.kind==='round'){
    const timeOver=game?.time<=0,allKO=(game?.players||[]).every(p=>p.hp<=0),hasKO=(game?.players||[]).some(p=>p.hp<=0);
    const title=timeOver?'TIME OVER':hasKO?(allKO?'DOUBLE KO!':'KO!'):'DRAW';
    announce(timeOver?'time-over':'ko',title,e.winner<0?'平手 · DRAW':'回合結束',1350);
   }
  }
 }
 function finish(game){
  if(!arena||finished||!game)return;finished=true;battle.dataset.result='true';
  const win=game.ruleset==='team'?game.winnerTeam:game.winner;
  const winners=game.players.filter(p=>game.ruleset==='team'?(p.team??p.slot%2)===win:p.slot===win);
  const title=winners.length?winners.map(p=>C.CHAR[p.char]?.name||'選手').join(' ＆ '):'平手';
  const delay=announcement.dataset.kind==='ko'||announcement.dataset.kind==='time-over'?950:0;
  later(()=>{announce('winner',winners.length?'WINNER':'DRAW',title,0,winners[0]?.char);roomAction.hidden=!['team','spectator'].includes(options.mode);},delay);
 }
 addEventListener('pagehide',event=>{if(event.persisted)return;for(const id of timers)clearTimeout(id);observer?.disconnect();cancelAnimationFrame(resizeFrame);});
 addEventListener('pageshow',event=>{if(event.persisted)scheduleFit();});
 window.AzhiCombatHUD=Object.freeze({mount,begin,update,events,finish,clear:()=>begin(null)});
})();
