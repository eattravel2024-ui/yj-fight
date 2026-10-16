'use strict';
const {enterLocalBattle,openRoomForm}=require('./flow-helpers.cjs');
const {test,before,after,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {existsSync}=require('node:fs');
const {chromium}=require('playwright');
let browser,server,base;
const contexts=[];
before(async()=>{
 server=spawn(process.execPath,['-e',"const {server}=require('./server');server.on('listening',()=>process.send(server.address().port))"],{cwd:require('node:path').resolve(__dirname,'../..'),env:{...process.env,HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe','ipc']});
 let error='';server.stderr.on('data',d=>error+=d);
 const port=await Promise.race([once(server,'message').then(([p])=>p),once(server,'exit').then(()=>{throw new Error(error||'server exited')})]);
 base='http://127.0.0.1:'+port;
 const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
});
afterEach(async()=>{for(const c of contexts.splice(0))await c.close();});
after(async()=>{for(const c of contexts)await c.close();await browser?.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}});
async function page(options={}){
 const context=await browser.newContext(options);contexts.push(context);const page=await context.newPage();
 page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));return page;
}
async function openPanel(p,panel){
 await p.waitForFunction(()=>window.AzhiShell);
 const alreadyOpen=await p.evaluate(()=>window.AzhiShell.isOpen());
 const appButton=p.locator('.app-actions [data-panel="'+panel+'"]:visible');
 if(!alreadyOpen&&await appButton.count())await appButton.first().click();
 else await p.evaluate(panel=>window.AzhiShell.open(panel),panel);
 await p.waitForFunction(panel=>window.AzhiShell.isOpen()&&window.AzhiShell.currentPanel===panel,panel);
}
async function chooseMode(p,mode){
 await openPanel(p,'home');await p.locator('[data-menu-entry="'+mode+'"]').click();await p.locator('#arcadeEnter').click();
 await p.waitForFunction(panel=>window.AzhiShell.currentPanel===panel,mode==='online'?'room':'fighters');
}
async function assertViewport(p,canvasSelector,hudSelector,viewport){
 const canvas=await p.locator(canvasSelector).boundingBox(),hud=await p.locator(hudSelector).boundingBox();
 assert.ok(hud.y>=0&&hud.y+hud.height<=viewport.height+1,'all health bars fit in the viewport');
 assert.ok(canvas.x>=0&&hud.y>=canvas.y-1&&hud.y+hud.height<=canvas.y+canvas.height+1&&canvas.x+canvas.width<=viewport.width+1&&canvas.y+canvas.height<=viewport.height+1,'entire canvas fits with health bars inside the stage');
 const display=await p.locator(canvasSelector).evaluate(el=>({width:el.width,height:el.height,fit:getComputedStyle(el).objectFit}));
 assert.equal(display.width/display.height,16/9);
 assert.ok(display.fit==='contain'||Math.abs(canvas.width/canvas.height-16/9)<.01,'the entire 960 × 540 scene is displayed without cropping');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1),'the app does not scroll');
}
test('in-game home menu opens initially, contains keyboard focus and closes with Escape',async()=>{
 const p=await page({viewport:{width:1366,height:768}});await p.goto(base);await p.waitForFunction(()=>window.AzhiShell?.isOpen());
 assert.equal(await p.evaluate(()=>window.AzhiShell.currentPanel),'home');
 assert.equal(await p.locator('dialog[open]').count(),1);
 for(let i=0;i<12;i++){
  assert.ok(await p.evaluate(()=>!!document.activeElement.closest('dialog[open]')),'native modal keeps keyboard focus inside');
  await p.keyboard.press('Tab');
 }
 await p.keyboard.press('Escape');await p.waitForFunction(()=>!window.AzhiShell.isOpen());
 assert.ok(await p.evaluate(()=>!document.activeElement.closest('dialog')),'closing does not leave focus in hidden menu controls');
 await openPanel(p,'settings');assert.equal(await p.locator('dialog[open] #soundToggle').count(),1);
 await p.keyboard.press('Escape');await p.waitForFunction(()=>window.AzhiShell.currentPanel==='home');await p.keyboard.press('Escape');await p.waitForFunction(()=>!window.AzhiShell.isOpen());
 assert.deepEqual(p.errors,[]);
});
test('main-menu navigation retains the chosen fighter across mode routes without Fight Fund',async()=>{
 const p=await page({viewport:{width:1366,height:768}});
 await p.addInitScript(()=>localStorage.setItem('azhi70_save',JSON.stringify({coins:740,character:'azhi'})));
 await p.goto(base);await p.waitForFunction(()=>window.AzhiShell?.isOpen());
 assert.equal(await p.locator('#coinsHeader,.arcade-home .career').count(),0);
 assert.doesNotMatch(await p.locator('.arcade-home').textContent(),/FIGHT FUND|740\s*G/i);
 await chooseMode(p,'practice');await p.locator('#characterList [data-char="gambler"]').click();
 assert.equal(await p.locator('#characterList .fighter-portrait').count(),4);
 await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>!AzhiShell.isOpen());await p.waitForFunction(()=>!AzhiShell.isOpen()&&AzhiGame.character==='gambler');
 await openPanel(p,'home');await p.locator('[data-menu-entry="online"]').click();
 assert.equal(new URL(p.url()).pathname,'/','choosing a mode does not navigate before confirmation');
 await p.locator('#arcadeEnter').click();await p.locator('[data-custom-mode="team"]').click();await p.waitForURL('**/team.html?**');
 await p.waitForFunction(()=>window.AzhiShell?.currentPanel==='room');
 assert.match(await p.locator('#selectionSummary').textContent(),/金沙賭神/);
 await p.locator('[data-custom-mode="spectator"]').click();assert.equal(await p.locator('#teamCharacters button:disabled').count(),4);
 await openPanel(p,'home');await p.locator('[data-menu-entry="practice"]').click();
 assert.equal(new URL(p.url()).pathname,'/team.html');await p.locator('#arcadeEnter').click();
 await p.waitForURL('**/?mode=practice**');await p.waitForFunction(()=>window.AzhiShell?.currentPanel==='fighters');
 assert.match(await p.locator('#appConfirmSummary').textContent(),/金沙賭神/);
 await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>!AzhiShell.isOpen());await p.waitForFunction(()=>window.AzhiDebug.local?.practice===true);
 assert.equal(await p.evaluate(()=>window.AzhiDebug.local.players[0].char),'gambler');
 for(const route of ['/?char=__proto__','/team.html?char=constructor']){await p.goto(base+route);await p.waitForFunction(()=>window.AzhiShell?.isOpen());assert.equal(await p.locator('#fighterSelect [aria-pressed=true]').count(),1);}
 assert.deepEqual(p.errors,[]);
});
test('local menu pauses combat and previews a character until explicit restart',async()=>{
 const p=await page();await p.goto(base);await chooseMode(p,'practice');await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>!AzhiShell.isOpen());
 await p.waitForFunction(()=>window.AzhiDebug.local.introFrames===0&&window.AzhiDebug.local.tick>2);
 assert.equal(await p.evaluate(()=>window.AzhiDebug.local.players[0].char),'azhi');
 await p.locator('#stage').focus();await p.keyboard.down('KeyD');
 const before=await p.evaluate(()=>window.AzhiDebug.local.players[0].x);await p.waitForFunction(x=>window.AzhiDebug.local.players[0].x>x+5,before);
 await openPanel(p,'fighters');const tick=await p.evaluate(()=>window.AzhiDebug.local.tick);
 await p.waitForTimeout(180);assert.equal(await p.evaluate(()=>window.AzhiDebug.local.tick),tick,'opening a local menu pauses simulation');
 assert.equal(await p.locator('#characterList button').first().isDisabled(),false);
 await p.locator('#characterList button').first().click();assert.match(await p.locator('#selectPlayerName').textContent(),/維尼/);assert.match(await p.locator('#selectionSummary').textContent(),/阿志/);
 assert.equal(await p.evaluate(()=>window.AzhiDebug.local.players[0].char),'azhi','selection preview leaves the active fighter unchanged');
 await p.keyboard.press('KeyU');await p.keyboard.up('KeyD');await p.keyboard.press('Escape');await p.keyboard.press('Escape');
 await p.waitForFunction(tick=>window.AzhiDebug.local.tick>tick+10,tick);
 assert.equal(await p.evaluate(()=>window.AzhiDebug.local.players[0].char),'azhi');
 assert.equal(await p.evaluate(()=>window.AzhiDebug.local.players[0].meter),100,'menu key presses do not queue a skill');
 const still=await p.evaluate(()=>window.AzhiDebug.local.players[0].x);await p.waitForFunction(tick=>window.AzhiDebug.local.tick>tick+10,tick+10);
 assert.ok(Math.abs(await p.evaluate(()=>window.AzhiDebug.local.players[0].x)-still)<1,'menu opening releases held movement');
 await openPanel(p,'fighters');await p.locator('#characterList button').first().click();await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>!AzhiShell.isOpen());
 await p.waitForFunction(()=>window.AzhiDebug.local.players[0].char==='winnie'&&!window.AzhiShell.isOpen());
 assert.deepEqual(p.errors,[]);
});
test('retired character save migrates without losing progress or currency',async()=>{
 const p=await page();await p.addInitScript(()=>localStorage.setItem('azhi70_save',JSON.stringify({character:'sam',chapter:3,coins:782,clears:4,storyVersion:'five-fighters-1'})));
 await p.goto(base);await p.waitForFunction(()=>window.AzhiDebug);
 const save=await p.evaluate(()=>JSON.parse(localStorage.getItem('azhi70_save')));
 assert.equal(save.character,'azhi');assert.equal(save.chapter,3);assert.equal(save.coins,782);assert.equal(save.clears,4);
 assert.deepEqual(p.errors,[]);
});
test('desktop practice: four fighters, easy skill and no classic entry',async()=>{
 const p=await page({viewport:{width:1440,height:1000}});await p.goto(base);await p.waitForFunction(()=>window.AzhiDebug);
 assert.equal(await p.locator('#characterList button').count(),4);
 assert.equal(await p.locator('a[href*="adventure-legacy"]').count(),0);
 await p.locator('[data-menu-entry="practice"]').focus();await p.keyboard.press('Space');await p.waitForFunction(()=>window.AzhiShell.currentPanel==='fighters');assert.equal(await p.evaluate(()=>window.AzhiDebug.mode),'practice');await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>!AzhiShell.isOpen());
 await p.waitForFunction(()=>window.AzhiDebug.local?.practice===true);
 await p.waitForFunction(()=>window.AzhiDebug.local.introFrames===0);await p.locator('#stage').focus();await p.keyboard.press('KeyU');
 await p.waitForFunction(()=>window.AzhiDebug.local?.players[0].meter<100);
 assert.equal(await p.evaluate(()=>window.AzhiDebug.local.players[0].char),'azhi');
 await p.evaluate(()=>{window.AzhiDebug.local.players[0].meter=0;});
 await p.waitForFunction(()=>document.querySelector('#specialStatus').textContent.includes('能量不足'));
 assert.equal(await p.locator('#specialTrigger').isDisabled(),true);
 await p.evaluate(()=>{window.AzhiDebug.local.players[0].meter=100;window.AzhiDebug.local.players[0].move=null;});
 await p.waitForFunction(()=>document.querySelector('#specialStatus').textContent.includes('可施放'));
 assert.deepEqual(p.errors,[]);await p.screenshot({path:'coverage/desktop-arena.png',fullPage:false});
});
test('each fighter has a named entrance and a matching one-button skill in the browser',async()=>{
 const p=await page({viewport:{width:1280,height:900}});await p.goto(base);await p.waitForFunction(()=>window.AzhiDebug);
 for(const [i,name] of ['不同意的請舉手','高雄發大財','膽大撐死膽小餓死','加油加300'].entries()){
  await chooseMode(p,'practice');await p.locator('#characterList button').nth(i).click();await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>!AzhiShell.isOpen());
  await p.waitForFunction(()=>window.AzhiDebug.local.introFrames>0);
  assert.equal(await p.locator('#specialName').textContent(),name);
  if(i===0)await p.screenshot({path:'coverage/entrance-8.8.png',fullPage:false});
  await p.waitForFunction(()=>window.AzhiDebug.local.introFrames===0);await p.locator('#specialTrigger').click();
  await p.waitForFunction(()=>window.AzhiDebug.skillFX.stats().bursts>0);
  const effect=await p.evaluate(()=>window.AzhiDebug.skillFX.snapshot()[0]);assert.equal(effect.char,['winnie','sezi','gambler','azhi'][i]);
 }
 assert.deepEqual(p.errors,[]);
});
test('live combat coaching follows real J K U cancels and reports actual signature damage',async()=>{
 const p=await page({viewport:{width:1366,height:768}});await p.goto(base);await chooseMode(p,'practice');await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>!AzhiShell.isOpen());
 await p.waitForFunction(()=>window.AzhiDebug.local.introFrames===0);
 await p.evaluate(()=>{const g=window.AzhiDebug.local;g.players[0].x=300;g.players[1].x=375;});
 await p.locator('#stage').focus();await p.keyboard.press('KeyJ');
 await p.waitForFunction(()=>document.querySelector('.combat-coach').dataset.state==='cancel');
 assert.match(await p.locator('.combat-coach strong').textContent(),/K 重拳/);
 await p.keyboard.press('KeyK');await p.waitForFunction(()=>window.AzhiDebug.local.players[0].move?.name==='heavy');
 await p.waitForFunction(()=>document.querySelector('.combat-coach').dataset.state==='cancel');
 assert.match(await p.locator('.combat-coach strong').textContent(),/U 必殺/);
 await p.keyboard.press('KeyU');await p.waitForFunction(()=>window.AzhiDebug.local.players[0].move?.name==='special');
 await p.waitForFunction(()=>document.querySelector('.combat-receipt').dataset.state==='hit');
 assert.match(await p.locator('.combat-receipt strong').textContent(),/加油加300.*HP/);
 assert.equal(await p.locator('#inputReadout').isVisible(),false);
 assert.deepEqual(p.errors,[]);
});
test('all four one-button supers show real damage receipts; close-range misses are explained',async()=>{
 const p=await page({viewport:{width:1366,height:768}});await p.goto(base);
 for(const [i,id] of ['winnie','sezi','gambler','azhi'].entries()){
  await chooseMode(p,'practice');await p.locator('#characterList button').nth(i).click();await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>!AzhiShell.isOpen());await p.waitForFunction(()=>window.AzhiDebug.local.introFrames===0);
  await p.evaluate(()=>{const g=window.AzhiDebug.local;g.seed=1800;g.players[0].x=300;g.players[1].x=410;});
  await p.locator('#superTrigger').click();await p.waitForFunction(()=>document.querySelector('.combat-receipt').dataset.state==='hit');
  await p.waitForFunction(()=>!window.AzhiDebug.local.players[0].move&&!window.AzhiDebug.local.projectiles.length);
  const damage=await p.evaluate(()=>100-window.AzhiDebug.local.players[1].hp);assert.equal(damage,({winnie:38,sezi:38,gambler:42,azhi:25})[id],id+' Phase 4 baseline');
  assert.match(await p.locator('.combat-receipt strong').textContent(),new RegExp('−'+damage+' HP'));
  if(id==='sezi')assert.match(await p.locator('.combat-receipt span').textContent(),/3 段/);
  if(id==='gambler')assert.equal(await p.evaluate(()=>window.AzhiDebug.local.players[0].armorTimer),0,'Phase 4 armor is limited to startup and expires before recovery ends');
  if(id==='azhi')await p.screenshot({path:'coverage/super-actual-hit.png'});
 }
 await chooseMode(p,'practice');await p.locator('#characterList [data-char="gambler"]').click();await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>!AzhiShell.isOpen());await p.waitForFunction(()=>window.AzhiDebug.local.introFrames===0);
 await p.locator('#superTrigger').click();await p.waitForFunction(()=>document.querySelector('.combat-receipt').dataset.state==='miss');
 assert.match(await p.locator('.combat-receipt span').textContent(),/靠近/);assert.equal(await p.evaluate(()=>window.AzhiDebug.local.players[1].hp),100);
 assert.deepEqual(p.errors,[]);
});
test('mobile touch skill, no horizontal page overflow and reduced motion',async()=>{
 const p=await page({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await p.goto(base);await p.waitForFunction(()=>window.AzhiDebug);
 await chooseMode(p,'practice');await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>!AzhiShell.isOpen());
 await p.waitForFunction(()=>window.AzhiDebug.local.introFrames===0);await p.locator('[data-key="special"]').first().tap();await p.waitForFunction(()=>window.AzhiDebug.local.players[0].meter<100);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(p.errors,[]);await p.screenshot({path:'coverage/mobile-arena.png',fullPage:false});
});
test('retired classic adventure and script are no longer served',async()=>{
 const p=await page();for(const route of ['/adventure-legacy-6.8.html','/legacy.js']){const r=await p.request.get(base+route);assert.equal(r.status(),404);}
});
test('two real browser clients play 1v1 and spectator stays read only',async()=>{
 const a=await page(),b=await page();
 for(const [p,n] of [[a,'Browser Alpha'],[b,'Browser Bravo']]){await p.goto(base+'/?room=E2EDUEL');await openRoomForm(p);await p.locator('#onlineNickname').fill(n);await p.locator('#joinRoom').evaluate(button=>button.click());}
 assert.equal(await a.locator('#startMatchButton').isDisabled(),true);
 for(const p of [a,b])await p.locator('#readyButton').click();
 await a.locator('#onlinePanel').screenshot({path:'coverage/ready-lobby-8.9.png'});
 await a.locator('#startMatchButton').click();
 await a.waitForFunction(()=>window.AzhiDebug.rollback?.frame>5);await b.waitForFunction(()=>window.AzhiDebug.rollback?.frame>5);
 await a.waitForFunction(()=>window.AzhiDebug.rollback.game.introFrames===0);
 assert.equal(await a.evaluate(()=>window.AzhiShell.isOpen()),false,'authoritative start closes the room menu');
 await a.locator('#stage').focus();await a.keyboard.down('KeyD');const initialX=await a.evaluate(()=>window.AzhiDebug.rollback.game.players[0].x);
 await a.waitForFunction(x=>window.AzhiDebug.rollback.game.players[0].x>x+5,initialX);await openPanel(a,'room');
 const openFrame=await a.evaluate(()=>window.AzhiDebug.rollback.frame);await a.waitForFunction(frame=>window.AzhiDebug.rollback.frame>frame+20,openFrame);
 const menuState=await a.evaluate(()=>{const s=window.AzhiDebug.rollback;return {frame:s.frame,x:s.game.players[0].x,meter:s.game.players[0].meter};});
 await openRoomForm(a);await a.locator('#onlineNickname').focus();await a.keyboard.press('KeyU');
 await a.waitForFunction(frame=>window.AzhiDebug.rollback.frame>frame+12,menuState.frame);
 const afterMenu=await a.evaluate(()=>{const s=window.AzhiDebug.rollback;return {x:s.game.players[0].x,meter:s.game.players[0].meter,input:s.used.get(s.frame).inputs[0]};});
 assert.ok(Math.abs(afterMenu.x-menuState.x)<1,'online menu releases held movement while the match continues');
 assert.equal(afterMenu.meter,menuState.meter,'typing U in a menu does not trigger combat');assert.deepEqual(afterMenu.input,{keys:{},pulses:[]},'online menu sends neutral input without pausing rollback');
 await a.keyboard.up('KeyD');if(await a.locator('.room-entry').evaluate(e=>e.open)){await a.keyboard.press('Escape');await a.waitForFunction(()=>!document.querySelector('.room-entry').open);}for(let i=0;i<2&&await a.evaluate(()=>AzhiShell.isOpen());i++){await a.keyboard.press('Escape');}await a.waitForFunction(()=>!AzhiShell.isOpen());await a.locator('#stage').focus();await a.keyboard.press('KeyU');
 await a.waitForFunction(()=>window.AzhiDebug.rollback.game.players[0].meter<25);
 await a.waitForFunction(()=>document.querySelector('.combat-receipt').dataset.state==='hit');assert.match(await a.locator('.combat-receipt strong').textContent(),/加油加300.*HP/);
 const watch=await page();await watch.goto(base+'/team.html?room=E2EDUEL&watch=1');
 await watch.waitForFunction(()=>window.AzhiTeamDebug?.role==='spectator'&&window.AzhiTeamDebug?.frame>0);
 assert.equal(await watch.evaluate(()=>window.AzhiTeamDebug.slot),-1);
 for(const p of [a,b,watch])assert.deepEqual(p.errors,[]);
});
test('real socket loss opens the room menu and permits manual rejoining in both clients',async()=>{
 for(const team of [false,true]){
  const p=await page();await p.addInitScript(()=>{const NativeWebSocket=window.WebSocket;window.WebSocket=class extends NativeWebSocket{constructor(...args){super(...args);window.testSocket=this;}};});
  const ids=team?{nickname:'playerNickname',join:'joinButton',room:'roomCode',copies:['copyPlayerLink','copyWatchLink'],rematch:'rematch'}:{nickname:'onlineNickname',join:'joinRoom',room:'roomInput',copies:['copyRoom','copySpectatorLink'],rematch:'rematchButton'},room=team?'REJOIN2':'REJOIN1';
  await p.goto(base+(team?'/team.html':'/')+'?room='+room);await openRoomForm(p);await p.locator('#'+ids.nickname).fill(team?'Reconnect Team':'Reconnect Duel');await p.locator('#'+ids.join).evaluate(button=>button.click());
  await p.waitForFunction(team=>window.testSocket?.readyState===WebSocket.OPEN&&(team?window.AzhiTeamDebug.slot>=0:!document.querySelector('#leaveRoom').disabled),team);
  assert.equal(await p.locator('#readyButton').isDisabled(),false);for(const id of ids.copies)assert.equal(await p.locator('#'+id).isDisabled(),false);
  await p.evaluate(()=>window.AzhiShell.close());await p.evaluate(()=>window.testSocket.close(4001,'test disconnect'));
  await p.waitForFunction(join=>window.AzhiShell.isOpen()&&window.AzhiShell.currentPanel==='room'&&!document.getElementById(join).disabled,ids.join);
  for(const id of ['readyButton','startMatchButton',...ids.copies,ids.rematch])assert.equal(await p.locator('#'+id).isDisabled(),true,'disconnected '+id+' is disabled');
  assert.equal(await p.locator('#'+ids.room).inputValue(),room,'manual reconnect retains the original room code');
  await p.locator('#'+ids.join).evaluate(button=>button.click());await p.waitForFunction(()=>!document.querySelector('#readyButton').disabled);
  assert.equal(await p.locator('#'+ids.room).inputValue(),room);for(const id of ids.copies)assert.equal(await p.locator('#'+id).isDisabled(),false);
  assert.deepEqual(p.errors,[]);
 }
});
test('four real browser clients start 2v2 with four retained characters',async()=>{
 const players=[];
 for(const [i,char] of ['winnie','sezi','gambler','azhi'].entries()){
  const p=await page();players.push(p);await p.goto(base+'/team.html');await openPanel(p,'fighters');
  await p.locator('#teamCharacters button').nth(i).click();await p.locator('.app-confirm-action').click();await p.waitForFunction(()=>AzhiShell.currentPanel==='room');await openRoomForm(p);await p.locator('#roomCode').fill('E2ETEAM');await openRoomForm(p);await p.locator('#playerNickname').fill('Team Player '+i);await p.locator('#joinButton').evaluate(button=>button.click());
 }
 assert.equal(await players[0].locator('#startMatchButton').isDisabled(),true);
 for(const p of players)await p.locator('#readyButton').click();
 await players[0].locator('#startMatchButton').click();
 for(const p of players)await p.waitForFunction(()=>window.AzhiTeamDebug?.session?.frame>5);
 assert.equal(await players[0].locator('.mini-track .health-readout').count(),4);
 const liveScore=await players[0].locator('.score').boundingBox(),liveStage=await players[0].locator('#arenaCanvas').boundingBox();assert.ok(liveScore.y>=0&&liveStage.y+liveStage.height<=720);
 await players[0].screenshot({path:'coverage/arcade-team-live.png'});
 const roster=await players[0].evaluate(()=>window.AzhiTeamDebug.game.players.map(p=>p.char));assert.deepEqual(new Set(roster),new Set(['winnie','sezi','gambler','azhi']));
 const previous=await players[0].evaluate(()=>{const s=window.AzhiTeamDebug.session;s.game.status='finished';return s.frame;});
 await players[0].waitForFunction(frame=>window.AzhiTeamDebug.session.frame>frame,previous);
 await players[0].waitForFunction(()=>window.AzhiTeamDebug.session.game.status==='playing');
 for(const p of players)assert.deepEqual(p.errors,[]);
});
test('full-window viewport fits health and stage, in-game selection and a fixed camera',async()=>{
 for(const viewport of [{width:1440,height:900},{width:1366,height:768},{width:390,height:844},{width:844,height:390}]){
  const p=await page({viewport,isMobile:viewport.width<600,hasTouch:viewport.width<600});
  await p.addInitScript(()=>{
   window.spriteScales=[];const draw=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
    if(this.canvas.id==='stage'&&image?.src?.includes('/sprites/')){window.spriteScales.push(Math.abs(this.getTransform().a)*args[6]/args[2]);if(window.spriteScales.length>120)window.spriteScales.shift();}
    return draw.call(this,image,...args);
   };
  });
  await p.goto(base);await chooseMode(p,'practice');
  assert.equal(await p.locator('dialog[open] #fighterSelect').count(),1,'selection lives inside the in-game menu');
  const confirm=await p.locator('#mainAction').boundingBox();assert.ok(confirm.height>=44&&confirm.y>=0&&confirm.y+confirm.height<=viewport.height,JSON.stringify({viewport,confirm}));
  await p.locator('#characterList button').first().click();
  assert.match(await p.locator('#selectPlayerName').textContent(),/維尼/);assert.match(await p.locator('#selectionSummary').textContent(),/阿志/);
  assert.equal(await p.locator('#characterList button[aria-pressed=true]').count(),1);
  assert.match(await p.locator('#characterList button').first().textContent(),/預覽/);
  await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>!AzhiShell.isOpen());await p.waitForFunction(()=>window.AzhiDebug.local.introFrames===0);
  assert.equal(await p.evaluate(()=>window.AzhiShell.isOpen()),false);
  await assertViewport(p,'#stage','.hud',viewport);
  await p.evaluate(()=>{window.spriteScales=[];window.AzhiDebug.previewHit('super');});
  await p.waitForFunction(()=>window.spriteScales.length>=20);
  const scales=await p.evaluate(()=>window.spriteScales);assert.ok(scales.every(s=>Math.abs(s-.76)<.001),'impact and idle frames retain the smaller sprite scale');
  assert.deepEqual(p.errors,[]);await p.screenshot({path:`coverage/wide-stage-${viewport.width}.png`,fullPage:false});
  const team=await page({viewport,isMobile:viewport.width<600,hasTouch:viewport.width<600});await team.goto(base+'/team.html');await openPanel(team,'fighters');
  assert.equal(await team.locator('dialog[open] #fighterSelect').count(),1);
  await team.locator('#teamCharacters button').first().click();assert.match(await team.locator('#selectPlayerName').textContent(),/維尼/);await team.locator('.app-confirm-action').click();await team.waitForFunction(()=>AzhiShell.currentPanel==='room'&&AzhiGame.character==='winnie');
  await team.evaluate(()=>window.AzhiShell.close());await assertViewport(team,'#arenaCanvas','.score',viewport);
  assert.deepEqual(team.errors,[]);await team.screenshot({path:`coverage/team-viewport-${viewport.width}.png`,fullPage:false});
  // Each viewport is independent; do not keep eight live 60Hz arenas rendering.
  for(const current of [p,team]){const context=current.context();const index=contexts.indexOf(context);if(index>=0)contexts.splice(index,1);await context.close();}
 }
});

for(const fighter of ['azhi','gambler','winnie','sezi'])test(fighter+' reference-based transparent poses cover every action and render in both directions',async()=>{
 const p=await page({viewport:{width:1366,height:768}});await p.goto(base);await p.waitForFunction(()=>window.AzhiDebug);
 const audit=await p.evaluate(async fighter=>{
  const image=new Image();image.src='sprites/'+fighter+'.png';await image.decode();const a=window.AzhiAnimation,{width,height}=a.frameSize(fighter);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),ratios=[],edges=[];
  for(let row=0;row<a.ACTIONS.length;row++)for(let col=0;col<a.FRAMES;col++){
   ctx.clearRect(0,0,width,height);ctx.drawImage(image,col*width,row*height,width,height,0,0,width,height);
   const data=ctx.getImageData(0,0,width,height).data;let opaque=0,edge=0;
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){const alpha=data[(y*width+x)*4+3];if(alpha>16)opaque++;if((x===0||x===width-1||y===0||y===height-1)&&alpha>16)edge++;}
   ratios.push(opaque/(width*height));edges.push(edge);
  }
  return {width:image.naturalWidth,height:image.naturalHeight,min:Math.min(...ratios),max:Math.max(...ratios),edges:Math.max(...edges)};
 },fighter);
 assert.equal(audit.width,3840);assert.equal(audit.height,5100);assert.ok(audit.min>.05&&audit.max<.6);assert.equal(audit.edges,0,'no hands, feet or neighbour poses clipped at cell edges');
 await chooseMode(p,'practice');await p.locator('#characterList button').nth(fighter==='azhi'?3:fighter==='gambler'?2:fighter==='sezi'?1:0).click();await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>!AzhiShell.isOpen());await p.waitForFunction(()=>window.AzhiDebug.local.introFrames===0);
 for(const face of [1,-1]){
  await p.evaluate(face=>{const g=window.AzhiDebug.local,player=g.players[0];g.status='preview';g.hitstop=0;player.face=face;player.x=400;player.move={name:'kick',frame:window.AzhiDebug.core.moveFor(player,'kick').start+2};},face);
  await p.waitForTimeout(80);await p.screenshot({path:`coverage/${fighter}-video-kick-${face}.png`});
 }
 assert.deepEqual(p.errors,[]);
});

test('arcade UI displays real health, danger, energy thresholds and round wins without external UI dependencies',async()=>{
 const p=await page({viewport:{width:1366,height:768},reducedMotion:'reduce'}),external=[];
 p.on('request',request=>{if(!request.url().startsWith(base))external.push(request.url());});
 await p.goto(base);await chooseMode(p,'practice');await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>!AzhiShell.isOpen());await p.waitForFunction(()=>window.AzhiDebug.local.introFrames===0);
 await p.evaluate(()=>{const a=window.AzhiDebug.local.players[0];a.hp=20;a.meter=60;a.wins=1;});
 await p.waitForFunction(()=>document.querySelector('#p1Bar').parentElement.dataset.health==='danger');
 const rail=p.locator('#p1Bar').locator('..');assert.equal(await rail.getAttribute('aria-valuenow'),'20');assert.equal(await rail.locator('.health-readout').textContent(),'20 / 100');
 assert.equal(await rail.locator('.health-trail').evaluate(el=>el.style.width),'20%','reduced motion skips damage trail');
 assert.equal(await p.locator('#p1Meter').locator('..').getAttribute('data-level'),'super');assert.equal(await p.locator('#p1Wins .won').count(),1);
 await p.screenshot({path:'coverage/arcade-hud-danger.png'});
 await p.evaluate(()=>{const g=window.AzhiDebug.local;g.round++;g.players[0].hp=100;g.players[0].meter=100;});
 await p.waitForFunction(()=>document.querySelector('#p1Bar').parentElement.getAttribute('aria-valuenow')==='100');
 assert.equal(await rail.locator('.health-trail').evaluate(el=>el.style.width),'100%');assert.equal(await p.locator('#p1Meter').locator('..').getAttribute('data-level'),'max');
 assert.deepEqual(external,[]);assert.deepEqual(p.errors,[]);
});
