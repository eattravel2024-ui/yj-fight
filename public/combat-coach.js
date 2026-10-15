/* Read-only combat hints and actual hit receipts. Never advances the simulation. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.AzhiCore);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiCoach=api;})(globalThis,function(C){
'use strict';
const KEYS={light:'J 輕拳',light2:'J 二連拳',light3:'J 三連拳',heavy:'K 重拳',kick:'Q 踢擊',low:'E 掃腿',upper:'I 升龍',throw:'H 摔技',special:'U 必殺',super:'O 超必殺'};
function advice(game,slot){
 const p=game?.players?.[slot];
 if(!p)return {state:'waiting',title:'接技提示',detail:'開戰後顯示可接招式；U 必殺 25 能量，O 超必殺 60 能量。'};
 if(game.introFrames>0||game.status!=='playing'||p.hp<=0)return {state:'waiting',title:'準備開打',detail:'J → K → U；命中或被擋後，在接技窗口按下一招。'};
 if(p.stun>0)return {state:'stun',title:'受擊／防禦硬直中',detail:'恢復後再出招；按住 L 防禦，H 摔技可破防。'};
 const char=C.CHAR[p.char],sup=C.skillStatus(game,slot,'super'),special=C.skillStatus(game,slot,'special');
 const effect=p.armorCharges>0&&p.armorTimer>0?' · 霸體剩 '+(p.armorTimer/60).toFixed(1)+' 秒（可擋一次輕拳）':'';
 if(p.move){
  const name=p.move.name,targets=['heavy','special','super'].filter(next=>C.canChain(name,next));
  const available=targets.filter(next=>{const s=C.skillStatus(game,slot,next);return s.code==='cancel'&&s.available;});
  if(available.length)return {state:'cancel',title:'現在可接：'+available.map(next=>KEYS[next]).join(' / '),detail:'命中確認！現在按下一招可取消收招。'+effect};
  const next=targets.map(key=>{const cost=C.moveFor(p,key).cost||0;return KEYS[key]+(p.meter<cost?'（還差 '+Math.ceil(cost-p.meter)+' 能量）':'');});
  return {state:'attack',title:KEYS[name]+' · '+(name==='special'?char.special:name==='super'?char.superName:'出招中'),detail:(next.length?'接下來可接 '+next.join(' / ')+'；須命中／被擋且進入接技窗口。':name==='super'?char.superDescription:'收招後再行動。')+effect};
 }
 return {state:sup.available?'super-ready':'ready',title:'J → K → U 接必殺 · U 也可單按',detail:(sup.available?'O '+char.superName+' 可用 · '+char.superDescription:special.available?'U '+char.special+' 可用 · O 還差 '+Math.max(0,Math.ceil(60-p.meter))+' 能量':special.label)+'。'+effect};
}
function create(arena){
 const guide=document.createElement('div');guide.className='combat-coach';guide.innerHTML='<strong></strong><span></span>';
 const receipt=document.createElement('div');receipt.className='combat-receipt';receipt.hidden=true;receipt.setAttribute('role','status');receipt.setAttribute('aria-live','polite');receipt.innerHTML='<strong></strong><span></span>';
 arena.append(guide,receipt);
 let expires=0;const seen=new Set(),records=new Map();
 function text(node,value){if(node.textContent!==value)node.textContent=value;}
 function show(title,detail,state,now){receipt.hidden=false;receipt.dataset.state=state;text(receipt.firstElementChild,title);text(receipt.lastElementChild,detail);expires=now+1800;}
 function events(list,game,slot,now=performance.now()){
  for(const e of list||[]){
   if(e.kind==='round'){records.clear();continue;}
   if(slot>=0&&e.slot!==slot&&!(e.kind==='armor'&&e.target===slot))continue;
   if(e.id){if(seen.has(e.id))continue;seen.add(e.id);if(seen.size>512)seen.delete(seen.values().next().value);}
   const p=game?.players?.[e.slot],char=C.CHAR[p?.char||e.char];if(!char)continue;
   let active=records.get(e.slot);
   if(e.kind==='skill'){
    active={slot:e.slot,move:e.move,char:p?.char||e.char,name:e.name,damage:0,hits:0,blocks:0,at:now,settled:false};records.set(e.slot,active);
    show(e.name+' · '+(e.move==='super'?'超必殺 60':'必殺 25')+' 能量',e.move==='super'?char.superDescription:char.skillDescription,'cast',now);
   }
   if(e.kind==='armor'&&game?.players?.[e.target]?.char==='gambler')show('霸體吸收輕拳','仍會受少量傷害；重拳與摔技可破解。','armor',now);
   if(e.kind==='fortune'&&active)active.fortune=e.fortune;
   if(e.kind==='hit'&&['special','super'].includes(e.move)){
    if(!active||active.slot!==e.slot||active.move!==e.move||active.settled)active={slot:e.slot,move:e.move,char:p.char,name:e.move==='super'?char.superName:char.special,damage:0,hits:0,blocks:0,at:now,settled:false};
    records.set(e.slot,active);
    active.damage+=e.appliedDamage??e.damage;active.hits++;if(e.block)active.blocks++;
    show(active.name+' · '+(e.block?'被防禦':'命中')+' −'+active.damage+' HP',active.hits+' 段 · 本次實際累計傷害'+(e.block?'（防禦減傷）':'')+(e.counter||e.counterBoost?' · 反擊加成':'')+(active.fortune==='jackpot'?' · 彩金加成':active.fortune==='blank'?' · 小額牌':''),'hit',now);
   }
  }
 }
 function update(game,slot,now=performance.now()){
  guide.hidden=!game||slot<0||game.status!=='playing'||game.introFrames>0;arena.classList.toggle('coaching',!guide.hidden);
  const hint=advice(game,slot);guide.dataset.state=hint.state;text(guide.firstElementChild,hint.title);text(guide.lastElementChild,hint.detail);
  for(const active of records.values())if(!active.settled&&now-active.at>100){
   const p=game?.players?.[active.slot],moving=p?.move?.name===active.move,shot=game?.projectiles?.some(x=>x.owner===active.slot&&x.fromMove===active.move);
   // Network callers deliver confirmed events before this check; leave time for packet transit.
   if(!moving&&p?.stun>0)active.interrupted=true;
   if(!moving&&!shot&&now-active.at>650){active.settled=true;if(!active.hits)show(active.name+' · 未命中',active.interrupted?'出招被打斷；觀察對手空檔再出手。':['gambler','sezi'].includes(active.char)?'這招需要靠近；確認距離再按 O／U。':'注意對手位置與跳躍高度；飛行道具也可能落空。','miss',now);}
  }
  if(now>=expires)receipt.hidden=true;
 }
 function clear(){records.clear();expires=0;seen.clear();receipt.hidden=true;receipt.dataset.state='waiting';}
 return {update,events,clear};
}
return {advice,create,KEYS};
});
