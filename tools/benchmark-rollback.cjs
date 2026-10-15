'use strict';
// Synthetic frame-delay benchmark; does not connect to a VPS or simulate TCP throughput.
const {performance}=require('node:perf_hooks');
const C=require('../public/core'),T=require('../public/team-core'),RB=require('../public/rollback');
const chars=['winnie','sezi','gambler','azhi'];
const output=[];
for(const mode of ['duel','team'])for(const delay of [0,3,6,12,28,35]){
 const create=()=>mode==='team'?T.create(chars,{seed:87123}):C.create('gambler','winnie',{seed:87123});
 const reference=new RB.Session(create()),wire=new RB.Session(create()),pending=[];
 const samples=[];const frames=360;
 for(let f=1;f<=frames+delay+3;f++){
  if(f<=frames)for(let slot=0;slot<wire.count;slot++){
   const input={keys:{right:slot%2===0&&f%41<20,left:slot%2===1&&f%43<22,guard:f%59<8},pulses:f%37===slot*2+1?['special']:f%17===slot+1?['light']:[]};
   reference.submit(slot,f,input);
   // Fixed one-way frame delay plus reproducible 0–2 frame jitter (except baseline).
   pending.push({at:f+delay+(delay?(f+slot)%3:0),slot,frame:f,input});
  }
  reference.advance();const start=performance.now();
  for(let i=pending.length-1;i>=0;i--)if(pending[i].at<=f){const p=pending.splice(i,1)[0];wire.submit(p.slot,p.frame,p.input);}
  wire.advance();samples.push(performance.now()-start);
 }
 const converged=wire.digest()===reference.digest();let recovered=converged;
 if(!converged){wire.hardSync(reference.frame,reference.game);recovered=wire.digest()===reference.digest();}
 const sorted=samples.slice().sort((a,b)=>a-b),pct=p=>Number(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))].toFixed(3));
 const expectedConvergence=delay+2<RB.WINDOW;
 output.push({mode,delayFrames:delay,syntheticOneWayMs:Math.round(delay*1000/60),frames:reference.frame,rollbacks:wire.rollbacks,replayed:wire.replayed,dropped:wire.dropped,converged,checkpointRecovered:recovered,p50ms:pct(.5),p95ms:pct(.95),p99ms:pct(.99),maxMs:Number(sorted.at(-1).toFixed(3))});
 if((expectedConvergence&&!converged)||!recovered)process.exitCode=1;
}
console.table(output);
console.log('Synthetic engine-only results; no browser, real network, room capacity or production latency claim.');
