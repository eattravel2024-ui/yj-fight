'use strict';
const {test,before,after,afterEach}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{once}=require('node:events'),{existsSync,mkdirSync}=require('node:fs'),{chromium}=require('playwright');
let browser,server,base;const contexts=[];
before(async()=>{
 server=spawn(process.execPath,['-e',"const {server}=require('./server');server.on('listening',()=>process.send(server.address().port))"],{cwd:require('node:path').resolve(__dirname,'../..'),env:{...process.env,HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe','ipc']});
 const port=await once(server,'message').then(([p])=>p);base='http://127.0.0.1:'+port;
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});mkdirSync('coverage',{recursive:true});
});
afterEach(async()=>{for(const c of contexts.splice(0))await c.close();});
after(async()=>{await browser?.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}});
async function page(options={}){const c=await browser.newContext(options);contexts.push(c);const p=await c.newPage();p.errors=[];p.on('pageerror',e=>p.errors.push(e.message));return p;}
async function choose(p,id){await p.goto(base+'/?mode=practice&panel=fighters');await p.waitForFunction(()=>window.AzhiShell?.currentPanel==='fighters');await p.locator('#characterList [data-char="'+id+'"]').click();await p.locator('#mainAction').click();await p.waitForFunction(()=>AzhiShell.currentPanel==='stages');}
test('four real roles render clearly; STAGE 04 enables only with supplied art and all active maps load',async()=>{
 const p=await page({viewport:{width:1600,height:900},reducedMotion:'reduce'});const failures=[];p.on('requestfailed',r=>failures.push(r.url()));
 for(const id of ['azhi','sezi','gambler','winnie']){
  await p.goto(base+'/?mode=practice&panel=fighters');await p.waitForFunction(()=>window.AzhiShell);await p.locator('#characterList [data-char="'+id+'"]').click();
  const role=await p.evaluate(id=>AzhiCore.CHAR[id].role,id);assert.ok((await p.locator('#selectStyle').textContent()).includes(role));
  const fits=await p.evaluate(()=>{const body=document.querySelector('.app-menu-body').getBoundingClientRect();return ['.select-heading','.select-skill','.select-stats'].every(s=>{const r=document.querySelector(s).getBoundingClientRect();return r.top>=body.top-1&&r.bottom<=body.bottom+1;});});assert.ok(fits,id+' role, skill copy and stats fit above confirmation');
  if(id==='sezi'){await p.locator('#selectPlayerArt').evaluate(i=>i.decode());await p.screenshot({path:'coverage/phase4-sezi-select.png'});}
 }
 await p.locator('#mainAction').click();await p.waitForFunction(()=>AzhiShell.currentPanel==='stages');
 const available=await p.evaluate(()=>AzhiStages.PLAYABLE),ready=available.includes('legislature');assert.equal(await p.locator('[data-stage="legislature"]').isDisabled(),!ready);
 if(!ready){assert.match(await p.locator('[data-stage="legislature"]').textContent(),/素材待匯入/);await p.screenshot({path:'coverage/phase4-legislature-pending.png'});}
 for(const stage of available){
  await choose(p,'azhi');await p.locator('[data-stage="'+stage+'"]').click();await p.locator('#stageConfirm').click();await p.waitForFunction(()=>AzhiShell.currentPanel==='versus');
  if(stage==='legislature'){assert.match(await p.locator('.versus-stage').textContent(),/STAGE 04.*立法院/);await p.screenshot({path:'coverage/phase4-legislature-vs.png'});}
  await p.waitForFunction(()=>!AzhiShell.isOpen()&&AzhiGame.game?.introFrames===0);assert.equal(await p.evaluate(()=>AzhiGame.game.stage),stage);
  await p.waitForFunction(stage=>AzhiAudio.snapshot.current===AzhiStages.get(stage).bgm,stage);
  if(stage==='legislature')await p.screenshot({path:'coverage/phase4-legislature-battle.png'});
 }
 assert.deepEqual(p.errors,[]);assert.deepEqual(failures,[]);
});
test('real Sezi just guard and riposte produce zero chip, hit feedback and synchronized HUD',async()=>{
 const p=await page({viewport:{width:1600,height:900},reducedMotion:'reduce'});await choose(p,'sezi');await p.locator('#stageConfirm').click();await p.waitForFunction(()=>!AzhiShell.isOpen()&&AzhiGame.game?.introFrames===0);
 await p.locator('#stage').focus();await p.keyboard.down('KeyD');await p.waitForFunction(()=>AzhiGame.game.players[0].x>=610);await p.keyboard.up('KeyD');
 // Start a legal dummy attack and step its real input trace; never manufacture HP or impact events.
 const impact=await p.evaluate(()=>{
  const g=AzhiGame.game,C=AzhiCore;C.input(g,1,{pulses:['light']});
  for(let i=0;i<14;i++){C.input(g,0,{guard:i>=3});if(i>0)C.input(g,1,{});C.step(g);if(g.events.some(e=>e.perfectGuard))break;}
  return {hit:g.events.find(e=>e.perfectGuard),hp:g.players[0].hp};
 });
 assert.equal(impact.hit?.perfectGuard,true);assert.equal(impact.hp,100);await p.waitForFunction(()=>document.querySelector('.combat-receipt').textContent.includes('JUST GUARD'));
 assert.equal(await p.locator('#p1HP').textContent(),'100');await p.screenshot({path:'coverage/phase4-just-guard.png'});
 // Screenshot encoding may outlast the 48F counter window. Earn another real guard,
 // then submit the buffered heavy in the same legal core trace rather than extending the buff.
 await p.waitForFunction(()=>{const g=AzhiGame.game;return !g.players[1].move&&g.tick>=g.players[0].guardReadyTick;});
 const riposte=await p.evaluate(()=>{
  const g=AzhiGame.game,C=AzhiCore;C.input(g,0,{});C.input(g,1,{pulses:['light']});
  const start=g.events.length;
  for(let i=0;i<20;i++){C.input(g,0,{guard:i>=3});if(i>0)C.input(g,1,{});C.step(g);if(g.events.slice(start).some(e=>e.perfectGuard))break;}
  C.input(g,0,{pulses:['heavy']});
  for(let i=0;i<60;i++){C.step(g);if(g.events.slice(start).some(e=>e.riposte))break;}
  return g.events.slice(start).find(e=>e.riposte);
 });
 assert.equal(riposte?.riposte,true);await p.waitForFunction(()=>document.querySelector('.combat-receipt').textContent.includes('RIPOSTE'));
 assert.ok(await p.evaluate(()=>AzhiGame.game.players[1].hp<100));await p.screenshot({path:'coverage/phase4-riposte.png'});assert.deepEqual(p.errors,[]);
});
test('landscape touch keeps the same HUD and keyboard routes with the new stage slot',async()=>{
 const p=await page({viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await choose(p,'azhi');await p.locator('[data-stage="night"]').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.locator('[data-stage="garage"]').getAttribute('aria-pressed'),'true');await p.keyboard.press('Enter');await p.waitForFunction(()=>!AzhiShell.isOpen()&&AzhiGame.game?.introFrames===0);
 const rect=await p.locator('#stage').boundingBox();assert.ok(Math.abs(rect.width/rect.height-16/9)<.01);await p.locator('[data-key="special"]').first().tap();await p.waitForFunction(()=>AzhiGame.game.players[0].meter<100);await p.screenshot({path:'coverage/phase4-mobile.png'});assert.deepEqual(p.errors,[]);
});
