/* Read-only combat hints and actual hit receipts. Never advances the simulation. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.AzhiCore);if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiCoach=api;})(globalThis,function(C){
'use strict';
const KEYS={light:'J 輕拳',light2:'J 二連拳',light3:'J 三連拳',heavy:'K 重拳',kick:'Q 踢擊',low:'E 掃腿',upper:'I 升龍',throw:'H 摔技',special:'U 必殺',super:'O 超必殺',rush:'→＋K 突進',feint:'↓＋K 假動作',chip:'→＋U 籌碼衝擊',finisher:'→＋O 終結連打'};
function advice(game,slot){
 const p=game?.players?.[slot];
 if(!p)return {state:'waiting',title:'接技提示',detail:'開戰後顯示可接招式；U 必殺 25 能量，O 超必殺 60 能量。'};
 if(game.introFrames>0||game.status!=='playing'||p.hp<=0)return {state:'waiting',title:'準備開打',detail:'J → K → U；命中或被擋後，在接技窗口按下一招。'};
 if(p.grappleRole){const left=Math.max(0,C.Grapples.RULES.techWindow-(p.grappleFrame||0));return {state:'grapple',title:p.grappleRole==='victim'?(left?'現在按 H 解摔 · '+left+' F':'解摔窗口已結束'):left?'投技命中 · 對手可按 H 解摔':'摔投中 · 解摔窗口已結束',detail:'近身 H 抓取；落空有硬直。解摔不扣血，結束後有短暫防連抓保護。'};}
 if(p.stun>0)return {state:'stun',title:p.riposteFrames>0?'精準防禦成功 · 等待反擊':'受擊／防禦硬直 '+p.stun+' F',detail:p.riposteFrames>0?'恢復後放開 L，按 K／I／U／O 強化反擊。':p.stun<=C.INPUT_BUFFER?'可預輸入下一招；恢復後放開 L 施放。':'按住 L 防禦，H 摔技可破防。'};
 const char=C.CHAR[p.char],sup=C.skillStatus(game,slot,'super'),special=C.skillStatus(game,slot,'special');
 const effect=p.armorCharges>0&&p.armorTimer>0?' · 霸體剩 '+p.armorTimer+' F（可擋一次輕拳）':p.riposteFrames>0?' · 反擊窗口 '+p.riposteFrames+' F，K／I／U／O 傷害 +20%':'';
 if(p.move){
  const name=p.move.name,targets=['heavy','special','super','rush','feint','chip','finisher','kick','upper'].filter(next=>C.canChain(name,next)&&C.moveFor(p,next));
  const available=targets.filter(next=>{const s=C.skillStatus(game,slot,next);return s.code==='cancel'&&s.available;});
  if(available.length)return {state:'cancel',title:'現在可接：'+available.slice(0,4).map(next=>KEYS[next]).join(' / '),detail:(name==='feint'?'假動作取消窗口！':'命中確認！')+'現在按下一招可取消收招。'+effect};
  const next=targets.map(key=>{const cost=C.moveFor(p,key).cost||0;return KEYS[key]+(p.meter<cost?'（還差 '+Math.ceil(cost-p.meter)+' 能量）':'');});
  return {state:'attack',title:KEYS[name]+' · '+(C.moveFor(p,name)?.label||(name==='special'?char.special:name==='super'?char.superName:'出招中')),detail:(next.length?'接下來可接 '+next.slice(0,4).join(' / ')+(name==='feint'?'；假動作窗口內可直接取消。':'；須命中／被擋且進入接技窗口。'):C.moveFor(p,name)?.description||(name==='super'?char.superDescription:'收招後再行動。'))+effect};
 }
 return {state:sup.available?'super-ready':'ready',title:char.role==='高速近身連打'?'J → K → U · →＋K 突進／→＋O 終結':p.char==='gambler'?'↓＋K 假動作 · →＋U 籌碼衝擊 · O ALL IN':'J → K → U 接必殺 · U 也可單按',detail:(sup.available?'O '+char.superName+' 可用 · '+char.superDescription:special.available?'U '+char.special+' 可用 · O 還差 '+Math.max(0,Math.ceil(60-p.meter))+' 能量':special.label)+'。'+effect};
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
   if(slot>=0&&e.slot!==slot&&!((e.kind==='armor'||e.perfectGuard||e.kind==='grab'||e.kind==='throw_tech')&&e.target===slot))continue;
   if(e.id){if(seen.has(e.id))continue;seen.add(e.id);if(seen.size>512)seen.delete(seen.values().next().value);}
   const p=game?.players?.[e.slot],char=C.CHAR[p?.char||e.char];if(!char)continue;
   let active=records.get(e.slot);
   if(e.kind==='throw_tech')show('THROW TECH · 解摔成功','雙方零傷害 · 分離並保留短暫防連抓保護','perfect-guard',now);
   if(e.kind==='grab')show(e.name+' · 抓取成功','被抓方立即按 H 可解摔（10 F）','cast',now);
   if(e.kind==='throw_whiff')show('抓空！','近身且雙方在地面才能抓取；收招期間可能被反擊。','miss',now);
   if(e.kind==='hit'&&e.move==='throw')show('投技命中 −'+e.appliedDamage+' HP','本次只結算一次摔投傷害','hit',now);
   if(e.kind==='skill'){
    active={slot:e.slot,move:e.move,char:p?.char||e.char,name:e.name,damage:0,hits:0,blocks:0,at:now,settled:false};records.set(e.slot,active);
    show(e.name+' · '+(C.moveFor(p,e.move)?.cost||0)+' 能量',C.moveFor(p,e.move)?.description||(e.move==='super'?char.superDescription:char.skillDescription),'cast',now);
   }
   if(e.kind==='armor'&&game?.players?.[e.target]?.char==='gambler')show('霸體吸收輕拳','仍會受少量傷害；重拳與摔技可破解。','armor',now);
   if(e.kind==='hit'&&e.perfectGuard){show('JUST GUARD · 精準防禦','零削血 · 硬直 '+e.blockstun+' F · 放開 L 接 K／I／U／O 強化反擊。','perfect-guard',now);continue;}
   if(e.kind==='hit'&&!['special','super','chip','finisher'].includes(e.move)&&(e.riposte||e.punish||e.counter))show(e.riposte?'RIPOSTE · 反擊成功':e.punish?'PUNISH · 抓到破綻':'COUNTER · 反擊命中','−'+e.appliedDamage+' HP · '+e.hitstun+' F 命中硬直',e.riposte?'riposte':'punish',now);
   if(e.kind==='fortune'&&active)active.fortune=e.fortune;
   if(e.kind==='hit'&&['special','super','chip','finisher'].includes(e.move)){
    if(!active||active.slot!==e.slot||active.move!==e.move||active.settled)active={slot:e.slot,move:e.move,char:p.char,name:C.moveFor(p,e.move)?.label||(e.move==='super'?char.superName:char.special),damage:0,hits:0,blocks:0,at:now,settled:false};
    records.set(e.slot,active);
    active.damage+=e.appliedDamage??e.damage;active.hits++;if(e.block)active.blocks++;
    show(active.name+' · '+(e.block?'被防禦':e.riposte?'反擊命中':e.punish?'破綻懲罰':'命中')+' −'+active.damage+' HP',active.hits+' 段 · 本次實際累計傷害'+(e.block?'（防禦減傷）':'')+(e.counter||e.counterBoost?' · 反擊加成':'')+(active.fortune==='jackpot'?' · 彩金加成':active.fortune==='blank'?' · 小額牌':''),'hit',now);
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
   if(!moving&&!shot&&now-active.at>650){active.settled=true;if(!active.hits)show(active.name+' · 未命中',active.interrupted?'出招被打斷；觀察對手空檔再出手。':active.move==='chip'?'籌碼未擊中；注意對手位置、跳躍與彈道距離。':['gambler','sezi'].includes(active.char)||active.move==='finisher'?'這招需要靠近；確認距離後再出招。':'注意對手位置與跳躍高度；飛行道具也可能落空。','miss',now);}
  }
  if(now>=expires)receipt.hidden=true;
 }
 function clear(){records.clear();expires=0;seen.clear();receipt.hidden=true;receipt.dataset.state='waiting';}
 return {update,events,clear};
}
return {advice,create,KEYS};
});
