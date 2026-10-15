/* Shared Ready UI; the server owns readiness, roster revisions and match start. */
(function(root){
'use strict';
function create(options){
 const $=id=>document.getElementById(id);let roster=null;
 const me=()=>roster?.players?.find(p=>p.slot===options.getSlot());
 const busy=()=>roster?.phase==='playing';
 function send(message){const ws=options.getSocket();if(ws?.readyState===1)ws.send(JSON.stringify(message));}
 function render(){
  const player=options.getRole()==='player'?me():null,players=roster?.players||[],needed=roster?.needed||2,all=players.length===needed&&players.every(p=>p.ready);
  $('readyButton').disabled=!player||busy();$('readyButton').textContent=player?.ready?'取消準備':'準備好了';$('readyButton').setAttribute('aria-pressed',String(!!player?.ready));
  $('startMatchButton').hidden=!player?.host;$('startMatchButton').disabled=!player?.host||!all||busy();
  $('readySummary').textContent=!roster?'加入房間後可準備':busy()?'比賽進行中':`${players.filter(p=>p.ready).length}/${needed} 已準備 · ${all?'等待房主開賽':'選好角色後按準備'}`;
  $('readyRoster').textContent=players.map(p=>`${p.name}${p.host?' ★':''}：${p.ready?'✓ 已準備':'尚未準備'}`).join('　｜　');
 }
 $('readyButton').onclick=()=>{if(me()&&!busy())send({type:'set_ready',ready:!me().ready});};
 $('startMatchButton').onclick=()=>send({type:'start_match',revision:roster?.revision});
 return {receive(message){roster=message;render();const player=me();if(player&&options.getRole()==='player')options.onCharacter?.(player.char);},reset(){roster=null;render();},select(char){if(me()&&!busy())send({type:'select_character',char});},get busy(){return busy();}};
}
root.AzhiLobby={create};
})(globalThis);
