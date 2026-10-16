'use strict';
const {enterLocalBattle}=require('./flow-helpers.cjs');
const {test,before,after,afterEach}=require('node:test');
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{once}=require('node:events'),{existsSync,mkdirSync}=require('node:fs');
const {chromium}=require('playwright');let browser,server,base;const contexts=[];
before(async()=>{
 server=spawn(process.execPath,['-e',"const {server}=require('./server');server.on('listening',()=>process.send(server.address().port))"],{cwd:require('node:path').resolve(__dirname,'../..'),env:{...process.env,HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe','ipc']});
 let error='';server.stderr.on('data',d=>error+=d);const port=await Promise.race([once(server,'message').then(([p])=>p),once(server,'exit').then(()=>{throw new Error(error||'server exited')})]);base='http://127.0.0.1:'+port;
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});mkdirSync('coverage',{recursive:true});
});
afterEach(async()=>{for(const c of contexts.splice(0))await c.close()});
after(async()=>{await browser?.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await once(server,'exit')}});
async function page(options={}){const c=await browser.newContext(options);contexts.push(c);const p=await c.newPage();p.errors=[];p.on('pageerror',e=>p.errors.push(e.message));return p;}
async function decoded(locator){await locator.evaluateAll(images=>Promise.all(images.map(i=>i.decode())));}

async function practice(p){await p.goto(base+'/?mode=practice&panel=fighters');await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>AzhiGame.game?.introFrames===0&&!AzhiShell.isOpen());await p.waitForTimeout(500);}
async function geometry(p){
 return p.evaluate(()=>{const arena=document.querySelector('.arena').getBoundingClientRect(),hud=document.querySelector('.combat-top').getBoundingClientRect(),canvas=document.querySelector('canvas').getBoundingClientRect();return {arena:{x:arena.x,y:arena.y,width:arena.width,height:arena.height},inside:hud.x>=arena.x-1&&hud.right<=arena.right+1&&hud.top>=arena.top-1&&hud.bottom<=arena.bottom+1,ratio:canvas.width/canvas.height,scroll:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1};});
}
test('in-scene combat HUD, real HP/energy, skill input, viewport fit and retry work',async()=>{
 const p=await page({viewport:{width:1366,height:768}});await practice(p);
 assert.equal(await p.locator('.arena .hud').count(),1);assert.equal(await p.locator('.arena #specialTrigger').count(),1);assert.equal(await p.locator('.combat-energy #p1Meter').count(),1);
 for(const viewport of [{width:1920,height:1080},{width:1600,height:900},{width:1366,height:768},{width:1280,height:720}]){await p.setViewportSize(viewport);await p.waitForTimeout(100);const g=await geometry(p);assert.ok(g.inside);assert.ok(Math.abs(g.ratio-16/9)<.005);assert.equal(g.scroll,false);}
 await p.setViewportSize({width:1366,height:768});await p.waitForTimeout(100);
 await p.evaluate(()=>{const g=AzhiGame.game;g.players[0].hp=22;g.players[0].meter=24;});await p.waitForFunction(()=>document.querySelector('#p1Bar').parentElement.dataset.health==='danger');assert.equal(await p.locator('#p1HP').textContent(),'22');assert.equal(await p.locator('#specialTrigger').isDisabled(),true);assert.equal(await p.locator('#p1Meter').locator('..').getAttribute('aria-valuenow'),'24');
 await p.waitForFunction(()=>parseFloat(document.querySelector('#p1Bar').parentElement.querySelector('.health-trail').style.width)<=22);
 await p.evaluate(()=>{AzhiGame.game.players[0].hp=100;AzhiGame.game.players[0].meter=100;});await p.waitForFunction(()=>!document.querySelector('#specialTrigger').disabled);await p.locator('#specialTrigger').click();await p.waitForFunction(()=>AzhiGame.game.players[0].meter<100);
 await p.waitForTimeout(750);const receipt=await p.locator('.combat-receipt').boundingBox();assert.ok(receipt.height<100,'hit receipt cannot stretch across the arena');await p.screenshot({path:'coverage/combat-after-8112.png'});
 // Start the real arcade flow, then use a minimal state fixture for the engine result.
 await p.evaluate(()=>{AzhiGame.requestMode('arcade');AzhiGame.startLocal();});await p.waitForFunction(()=>AzhiGame.game.introFrames===0);
 await p.evaluate(()=>{const g=AzhiGame.game;g.practice=false;g.players[0].wins=1;g.players[1].hp=0;g.hitstop=0;});await p.waitForFunction(()=>AzhiGame.game.status==='finished');await p.waitForFunction(()=>document.querySelector('.combat-announcement').dataset.kind==='winner'&&!document.querySelector('.combat-announcement').hidden);
 assert.match(await p.locator('.combat-announcement').textContent(),/WINNER.*阿志/);assert.equal(await p.locator('#p2HP').textContent(),'0');await p.waitForFunction(()=>parseFloat(document.querySelector('#p2Bar').parentElement.querySelector('.health-trail').style.width)===0);await p.locator('.combat-announcement img').evaluate(i=>i.decode());await p.screenshot({path:'coverage/combat-winner-8112.png'});
 await p.waitForFunction(()=>AzhiShell.isOpen()&&AzhiShell.currentPanel==='results');await p.locator('#resultContinue').click();await p.waitForFunction(()=>AzhiGame.game.status==='playing'&&!document.querySelector('.app-battle').dataset.result);await p.locator('.combat-menu-toggle').click();await p.waitForFunction(()=>AzhiShell.isOpen());assert.deepEqual(p.errors,[]);
});
test('real timeout/round transition, stage variants and reduced-motion mobile controls work',async()=>{
 const p=await page({viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await practice(p);
 const g=await geometry(p);assert.ok(g.inside);assert.ok(Math.abs(g.ratio-16/9)<.005);assert.equal(g.scroll,false);
 await p.locator('[data-key="special"]').first().tap();await p.waitForFunction(()=>AzhiGame.game.players[0].meter<100);await p.waitForTimeout(800);await p.screenshot({path:'coverage/combat-mobile-8112.png'});
 await p.evaluate(()=>{const g=AzhiGame.game;g.practice=false;g.time=.001;g.players[0].hp=90;g.players[1].hp=80;g.hitstop=0;});await p.waitForFunction(()=>document.querySelector('.combat-announcement').textContent.includes('TIME OVER'));assert.equal(await p.locator('.combat-announcement').evaluate(e=>getComputedStyle(e).animationName),'none');
 await p.waitForFunction(()=>AzhiGame.game.round===2);await p.waitForFunction(()=>AzhiGame.game.introFrames===0);
 for(const stage of ['night','garage','harbor']){
  const r=await p.request.get(base+'/'+await p.evaluate(stage=>AzhiStageArt.VISUALS[stage].combat,stage));assert.equal(r.status(),200);
 }
 assert.deepEqual(p.errors,[]);
});
test('two real clients and late spectator retain Ready authority, in-scene team HUD and real energy',async()=>{
 const players=[];
 for(let i=0;i<2;i++){const p=await page({viewport:{width:1280,height:720}});players.push(p);await p.goto(base+'/?mode=online&panel=room');await p.locator('#roomInput').fill('HUDTEST');await p.locator('#joinRoom').evaluate(button=>button.click());await p.waitForFunction(()=>!document.querySelector('#readyButton').disabled);}
 for(const p of players)await p.locator('#readyButton').click();await players[0].waitForFunction(()=>!document.querySelector('#startMatchButton').disabled);await players[0].locator('#startMatchButton').click();
 for(const p of players){await p.waitForFunction(()=>AzhiGame.game?.introFrames===0&&!AzhiShell.isOpen());assert.ok((await geometry(p)).inside);}
 const watch=await page({viewport:{width:1366,height:768}});await watch.goto(base+'/team.html?watch=1&room=HUDTEST');await watch.waitForFunction(()=>AzhiGame.game?.introFrames===0&&!AzhiShell.isOpen());assert.equal(await watch.locator('.arena .score').count(),1);await watch.waitForFunction(()=>document.querySelectorAll('.team-energy-list [data-slot]').length===2);assert.equal(await watch.locator('.team-energy-list [data-slot]').count(),2);assert.ok((await geometry(watch)).inside);assert.equal(await watch.locator('#specialTrigger').isDisabled(),true);await watch.screenshot({path:'coverage/combat-spectator-8112.png'});
 const row=await watch.locator('#redFighters .mini-fighter').first().elementHandle();await watch.waitForTimeout(350);assert.equal(await row.evaluate(el=>el.isConnected),true,'HUD updates preserve health nodes and transitions');
 for(const p of [...players,watch])assert.deepEqual(p.errors,[]);
});
test('2v2 authoritative room renders four independent portraits, health bars and bottom energy meters',async()=>{
 const WebSocket=require('ws'),actors=[];let roster;
 function message(ws,predicate){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{ws.off('message',read);reject(Error('socket message timeout'));},5000);function read(raw){const m=JSON.parse(raw);if(predicate(m)){clearTimeout(timeout);ws.off('message',read);resolve(m);}}ws.on('message',read);});}
 try{
  for(const char of ['azhi','gambler','sezi','winnie']){const ws=new WebSocket(base.replace('http:','ws:')+'/ws');actors.push(ws);ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='roster')roster=m;});await once(ws,'open');const joined=message(ws,m=>m.type==='joined');ws.send(JSON.stringify({type:'join',mode:'team',room:'HUD4P',char}));await joined;}
  const ready=message(actors[0],m=>m.type==='roster'&&m.players.length===4&&m.players.every(p=>p.ready));for(const ws of actors)ws.send(JSON.stringify({type:'set_ready',ready:true}));await ready;
  const started=message(actors[0],m=>m.type==='start');actors[0].send(JSON.stringify({type:'start_match',revision:roster.revision}));await started;
  const p=await page({viewport:{width:1366,height:768}});await p.goto(base+'/team.html?room=HUD4P&watch=1');await p.waitForFunction(()=>AzhiGame.game?.ruleset==='team'&&AzhiGame.game.introFrames===0&&!AzhiShell.isOpen());
  await p.waitForFunction(()=>document.querySelectorAll('.combat-top .mini-fighter img').length===4&&document.querySelectorAll('.combat-power .energy').length===4);assert.equal(await p.locator('.combat-top .mini-fighter img').count(),4);assert.equal(await p.locator('.combat-top .mini-track').count(),4);assert.equal(await p.locator('.combat-power .energy').count(),4);assert.ok((await geometry(p)).inside);await p.screenshot({path:'coverage/combat-team-8112.png'});assert.deepEqual(p.errors,[]);
 }finally{for(const ws of actors)ws.close();}
});
