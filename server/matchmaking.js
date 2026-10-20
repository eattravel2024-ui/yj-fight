'use strict';
// Quick is forgiving; ranked retains its competitive limits. RTT is server-measured.
const POLICIES=Object.freeze({
 quick:Object.freeze({initial:400,step:200,every:5000,max:1200}),
 ranked:Object.freeze({initial:150,step:75,every:10000,max:600})
});
const LIMITS=Object.freeze({rtt:250,rttDifference:120,timeout:120000,probeEvery:5000});
function range(entry,now){const p=POLICIES[entry.kind];return Math.min(p.max,p.initial+Math.floor(Math.max(0,now-entry.since)/p.every)*p.step);}
function eligible(a,b,now){return a!==b&&a.user.id!==b.user.id&&a.kind===b.kind&&a.ws.readyState===1&&b.ws.readyState===1&&Number.isFinite(a.ws.rtt)&&Number.isFinite(b.ws.rtt)&&a.ws.rtt<=LIMITS.rtt&&b.ws.rtt<=LIMITS.rtt&&Math.abs(a.ws.rtt-b.ws.rtt)<=LIMITS.rttDifference&&Math.abs(a.mmr-b.mmr)<=Math.max(range(a,now),range(b,now));}
function opponent(a,entries,now){return entries.filter(b=>eligible(a,b,now)).sort((x,y)=>(Math.abs(a.mmr-x.mmr)+2*Math.abs(a.ws.rtt-x.ws.rtt))-(Math.abs(a.mmr-y.mmr)+2*Math.abs(a.ws.rtt-y.ws.rtt))||x.since-y.since)[0];}
function status(entry,entries,now){
 const peers=entries.filter(e=>e.kind===entry.kind&&e.ws.readyState===1),count=peers.length;
 const reason=entry.ws.rtt===null?'measuring':count<2?'waiting_players':peers.some(e=>e.ws.rtt===null)?'measuring_peer':'widening';
 return {state:'searching',kind:entry.kind,queueSince:entry.since,searchingPlayers:count,reason,expanded:range(entry,now)>POLICIES[entry.kind].initial,latencyMs:entry.ws.rtt===null?null:Math.round(entry.ws.rtt)};
}
module.exports={POLICIES,LIMITS,range,eligible,opponent,status};
