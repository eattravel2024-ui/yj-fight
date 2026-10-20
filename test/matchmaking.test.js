'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../server/matchmaking');
const entry=(id,kind='quick',mmr=1000,rtt=40,since=100000)=>({user:{id},kind,mmr,since,ws:{rtt,readyState:1}});
test('quick widens immediately and progressively while ranked keeps stricter limits',()=>{
 const a=entry('a'),b=entry('b','quick',1400);assert.equal(M.range(a,100000),400);assert.equal(M.opponent(a,[a,b],100000),b);
 b.mmr=1800;assert.equal(M.opponent(a,[a,b],100000),undefined);assert.equal(M.opponent(a,[a,b],110000),b);assert.equal(M.range(a,200000),1200);
 a.kind=b.kind='ranked';b.mmr=1400;assert.equal(M.opponent(a,[a,b],100000),undefined);assert.equal(M.range(a,110000),225);assert.equal(M.opponent(a,[a,b],140000),b);assert.equal(M.range(a,200000),600);
});
test('modes, accounts, measured latency and fairness caps remain enforced even after long waits',()=>{
 const a=entry('a'),b=entry('b');for(const change of [{kind:'ranked'},{user:{id:'a'}},{ws:{rtt:null,readyState:1}},{ws:{rtt:251,readyState:1}},{ws:{rtt:161,readyState:1}},{ws:{rtt:40,readyState:3}},{mmr:2400}])assert.equal(M.opponent(a,[a,{...b,...change}],210000),undefined);
 a.ws.rtt=251;assert.equal(M.opponent(a,[a,b],210000),undefined);
});
test('queue status reports real same-mode people, network checks and widening without private ratings',()=>{
 const a=entry('a'),b=entry('b'),r=entry('r','ranked');assert.equal(M.status(a,[a,r],100000).reason,'waiting_players');assert.equal(M.status(a,[a,r],100000).searchingPlayers,1);
 a.ws.rtt=null;assert.equal(M.status(a,[a,b],100000).reason,'measuring');a.ws.rtt=45;b.ws.rtt=null;assert.equal(M.status(a,[a,b],100000).reason,'measuring_peer');b.ws.rtt=45;
 const info=M.status(a,[a,b],105000);assert.equal(info.reason,'widening');assert.equal(info.expanded,true);assert.equal(info.searchingPlayers,2);assert.equal(JSON.stringify(info).includes('mmr'),false);
});
