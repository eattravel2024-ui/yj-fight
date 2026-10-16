'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{once}=require('node:events'),net=require('node:net');
test('health waits for database initialization and rejects a broken account service before deployment succeeds',async t=>{
 const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const closedPort=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const child=spawn(process.execPath,['-e',"const {server}=require('./server');server.on('listening',()=>process.send(server.address().port))"],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,HOST:'127.0.0.1',PORT:'0',DATABASE_URL:`postgres://postgres@127.0.0.1:${closedPort}/unavailable_test`},stdio:['ignore','pipe','pipe','ipc']});
 t.after(async()=>{if(child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}});let stderr='';child.stderr.on('data',data=>stderr+=data);const [port]=await once(child,'message');const response=await fetch(`http://127.0.0.1:${port}/healthz`);assert.equal(response.status,503);const health=await response.json();assert.equal(health.ok,false);assert.equal(health.accounts,false);assert.equal(health.version,require('../package.json').version);assert.ok(!stderr.includes('postgres://'),'connection secrets are not logged');
});
