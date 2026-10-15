'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
// Ubuntu deployment uses Linux flock; keep general Node tests usable on macOS.
const deployTest=process.platform==='linux'?test:test.skip;
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const rollbackSource=fs.readFileSync(path.join(__dirname,'../deploy/rollback-ubuntu.sh'),'utf8');
const upgradeSource=fs.readFileSync(path.join(__dirname,'../deploy/upgrade-ubuntu.sh'),'utf8');
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";

// Exercise the actual upgrade control flow in a private fixture. Never execute
// deploy/upgrade-ubuntu.sh itself: its COPY uses temporary app/log/lock paths and
// inert systemctl/npm/user-management commands, and cannot contact the network.
function fixture(t,scenario='success'){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'azhi-deploy-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const app=path.join(root,'live'),src=path.join(root,'source'),bin=path.join(root,'bin');
 for(const dir of [app,src,bin,path.join(src,'deploy')])fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(app,'server.js'),'old-server');
 fs.writeFileSync(path.join(app,'package.json'),JSON.stringify({version:'8.6.0'}));
 fs.writeFileSync(path.join(root,'azhi71.service'),'fixture service');
 const required=['public/index.html','public/team.html','public/team-core.js','public/team.js','public/engine/frame-data.js','public/rollback.js','public/engine/commands.js','public/engine/boxes.js','public/sprites/manifest.json','public/skill-vfx.js','public/legacy.js','test/fixture.test.js','README.md','server.js'];
 for(const file of required){const filename=path.join(src,file);fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,'new fixture content');}
 fs.writeFileSync(path.join(src,'package.json'),JSON.stringify({version:'8.7.0'}));
 fs.writeFileSync(path.join(src,'package-lock.json'),'fixture reviewed lockfile');
 function stub(name,body){fs.writeFileSync(path.join(bin,name),'#!/usr/bin/env bash\nset -euo pipefail\n'+body+'\n',{mode:0o755});}
 stub('id','exit 0');stub('chown','exit 0');stub('sleep','exit 0');
 stub('runuser','[[ "$1" == -u && "$3" == -- ]]\nshift 3\nexec "$@"');
 stub('npm',`printf '%s\\n' "$*" >> "$TEST_ROOT/npm.calls"
if [[ $1 == --prefix ]];then
 [[ "$3" == ci && "$*" == *--omit=dev* && "$*" == *--ignore-scripts* ]]
 mkdir -p "$2/node_modules/ws"
fi`);
 stub('systemctl',`printf '%s\\n' "$*" >> "$TEST_ROOT/service.calls"
if [[ "$1" == start && "$TEST_SCENARIO" == start-failure && ! -e "$TEST_ROOT/failed-start" ]];then
 touch "$TEST_ROOT/failed-start";exit 1
fi`);
 stub('curl','if [[ "$TEST_SCENARIO" == health-failure ]];then printf \'%s\\n\' \'{"ok":true,"version":"wrong"}\';else printf \'%s\\n\' \'{"ok":true,"version":"8.7.0"}\';fi');
 stub('mv',`if [[ "$TEST_SCENARIO" == rename-failure && "$1" == "$TEST_ROOT"/live.next.* ]];then exit 73;fi
exec /bin/mv "$@"`);
 let source=upgradeSource
  .replace('APP=/opt/azhi71',`APP=${quote(app)}`)
  .replace('BACKUP="/opt/azhi71.backup.$STAMP"','BACKUP="${APP}.backup.$STAMP"')
  .replace('STAGING="/opt/azhi71.next.$STAMP.$$"','STAGING="${APP}.next.$STAMP.$$"')
  .replace('LOG="/var/log/azhi71-upgrade-$STAMP.log"','LOG="${APP}.upgrade-$STAMP.log"')
  .replace('"/etc/systemd/system/$SERVICE.service"',quote(path.join(root,'azhi71.service')))
  .replace('exec 9>/run/lock/azhi71-upgrade.lock',`exec 9>${quote(path.join(root,'upgrade.lock'))}`)
  .replace("[[ ${EUID:-99} -eq 0 ]] || fail '實際更新請用 root 執行'",': # fixture: no root or host services');
 const script=path.join(src,'deploy/upgrade-fixture.sh');fs.writeFileSync(script,source);
 const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,TEST_ROOT:root,TEST_SCENARIO:scenario};
 const result=spawnSync('bash',[script,...(scenario==='check'?['--check']:[])],{
  env,
  encoding:'utf8',timeout:15000
 });
 assert.equal(result.error,undefined,result.error?.message);
 return {root,app,src,result,env,files:()=>fs.readdirSync(root),calls:name=>fs.readFileSync(path.join(root,name),'utf8')};
}

deployTest('deployment --check leaves live app, service, log and lock untouched',t=>{
 const f=fixture(t,'check');assert.equal(f.result.status,0,f.result.stderr);
 assert.equal(fs.readFileSync(path.join(f.app,'server.js'),'utf8'),'old-server');
 assert.equal(fs.existsSync(path.join(f.root,'service.calls')),false);
 assert.equal(fs.existsSync(path.join(f.root,'upgrade.lock')),false);
 assert.equal(f.files().some(name=>name.includes('.upgrade-')||name.includes('.backup.')||name.includes('.next.')),false);
 assert.doesNotMatch(f.calls('npm.calls'),/\bci\b/);
});

deployTest('deployment stages complete public assets and frozen runtime dependencies before replacing live app',t=>{
 const f=fixture(t);assert.equal(f.result.status,0,f.result.stderr);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.app,'package.json'))).version,'8.7.0');
 for(const file of ['public/skill-vfx.js','public/legacy.js','package-lock.json','node_modules/ws'])assert.equal(fs.existsSync(path.join(f.app,file)),true,file);
 const backups=f.files().filter(name=>name.startsWith('live.backup.'));assert.equal(backups.length,1);
 assert.equal(fs.readFileSync(path.join(f.root,backups[0],'server.js'),'utf8'),'old-server');
 assert.match(f.calls('npm.calls'),/ci --omit=dev --ignore-scripts/);
 assert.doesNotMatch(f.calls('service.calls'),/nginx|ssh|docker/);
});

for(const scenario of ['start-failure','health-failure','rename-failure']){
 deployTest(`deployment restores previous app after ${scenario}`,t=>{
  const f=fixture(t,scenario);assert.notEqual(f.result.status,0,f.result.stdout);
  assert.equal(fs.readFileSync(path.join(f.app,'server.js'),'utf8'),'old-server');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.app,'package.json'))).version,'8.6.0');
  const serviceCalls=f.calls('service.calls').trim().split('\n');
  assert.equal(serviceCalls.at(-1),'start azhi71','restart the previously active service after restoring old files');
  assert.match(f.result.stdout,/還原/);
 });
}

function copiedRollback(f){
 const source=rollbackSource
  .replace("[[ ${EUID:-99} -eq 0 ]] || { echo '需要 root';exit 1; }",': # fixture: no root or host services')
  .replaceAll('/opt/azhi71',f.app)
  .replace('/etc/systemd/system/azhi71.service',path.join(f.root,'azhi71.service'))
  .replace('/run/lock/azhi71-upgrade.lock',path.join(f.root,'upgrade.lock'));
 const filename=path.join(f.src,'deploy/rollback-fixture.sh');fs.writeFileSync(filename,source);return filename;
}

deployTest('manual rollback restores the selected backup after explicit YES',t=>{
 const f=fixture(t),script=copiedRollback(f);
 assert.equal(f.result.status,0,f.result.stderr);
 const result=spawnSync('bash',[script],{env:f.env,input:'YES\n',encoding:'utf8',timeout:5000});
 assert.equal(result.status,0,result.stderr);
 assert.equal(fs.readFileSync(path.join(f.app,'server.js'),'utf8'),'old-server');
 assert.equal(f.files().some(name=>name.startsWith('live.rollback.terminal.')),true);
});

deployTest('manual rollback refuses the shared lock while another update holds it',t=>{
 const f=fixture(t),script=copiedRollback(f);
 assert.equal(f.result.status,0,f.result.stderr);
 const before=f.calls('service.calls');
 // Outer flock holds the same lock open for the child; the inner nonblocking
 // lock must fail before reaching stop, rename or confirmation.
 const result=spawnSync('flock',[path.join(f.root,'upgrade.lock'),'bash',script],{env:f.env,input:'YES\n',encoding:'utf8',timeout:5000});
 assert.notEqual(result.status,0);assert.match(result.stdout,/另一個更新或回滾/);
 assert.equal(f.calls('service.calls'),before);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.app,'package.json'))).version,'8.7.0');
});
