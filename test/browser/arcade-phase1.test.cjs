'use strict';
const {enterLocalBattle,openRoomForm}=require('./flow-helpers.cjs');
const {test,before,after,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {existsSync,mkdirSync}=require('node:fs');
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
 mkdirSync('coverage',{recursive:true});
});
afterEach(async()=>{for(const context of contexts.splice(0))await context.close();});
after(async()=>{await browser?.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}});
async function page(options={}){
 const context=await browser.newContext(options);contexts.push(context);
 const p=await context.newPage();p.errors=[];p.on('pageerror',error=>p.errors.push(error.message));return p;
}
async function waitPanel(p,panel){await p.waitForFunction(panel=>window.AzhiShell?.isOpen()&&window.AzhiShell.currentPanel===panel,panel);}
async function choose(p,entry,rapid=false){
 await p.locator('[data-menu-entry="'+entry+'"]').click();assert.equal(await p.evaluate(()=>window.AzhiShell.currentPanel),'home');
 if(rapid){const transitions=await p.locator('#arcadeEnter').evaluate(button=>{const panels=[],listener=event=>panels.push(event.detail.panel);addEventListener('azhi:menu',listener);button.click();button.click();removeEventListener('azhi:menu',listener);return panels;});assert.deepEqual(transitions,['fighters'],'a queued second confirmation does not repeat the transition');}
 else await p.locator('#arcadeEnter').click();
}
async function backHome(p){await p.keyboard.press('Escape');await waitPanel(p,'home');}

test('Phase 1 five main-menu entries reach real existing panels without automatically starting combat',async()=>{
 const p=await page({viewport:{width:1366,height:768}});await p.goto(base);await waitPanel(p,'home');
 assert.deepEqual(await p.locator('.arcade-option').evaluateAll(nodes=>nodes.map(node=>node.dataset.menuEntry)),['arcade','practice','online','quick','ranked','team','account','settings','guide']);
 await p.evaluate(()=>{delete window.AzhiDebug;delete window.AzhiTeamDebug;});
 for(const [entry,panel] of [['arcade','fighters'],['practice','fighters'],['online','room'],['settings','settings'],['guide','guide']]){
  await choose(p,entry,entry==='arcade');await waitPanel(p,panel);
  assert.equal(await p.evaluate(()=>window.AzhiGame.game),null,'entering '+entry+' does not initialize a match');
  assert.equal(await p.evaluate(()=>window.AzhiGame.busy),false,'entering '+entry+' does not connect automatically');
  if(entry==='guide')assert.equal(await p.locator('#appPane-guide a[href*="adventure-legacy"]').count(),0);
  await backHome(p);
 }
 await choose(p,'online');await p.locator('[data-custom-mode="team"]').click();await p.waitForURL('**/team.html?**');await waitPanel(p,'room');
 assert.equal(await p.evaluate(()=>window.AzhiGame.mode),'team');assert.equal(await p.evaluate(()=>window.AzhiGame.busy),false);
 await p.locator('[data-custom-mode="spectator"]').click();assert.equal(await p.evaluate(()=>window.AzhiGame.mode),'spectator');
 assert.equal(await p.locator('#teamCharacters button:disabled').count(),4,'spectators retain read-only character controls');
 await backHome(p);await choose(p,'practice');await p.waitForURL('**/?mode=practice**');await waitPanel(p,'fighters');
 assert.equal(await p.evaluate(()=>window.AzhiGame.mode),'practice');assert.equal(await p.evaluate(()=>window.AzhiGame.game),null);
 assert.deepEqual(p.errors,[]);
});

test('Phase 1 keyboard selection, back and resume preserve local battle and release menu inputs',async()=>{
 const p=await page({viewport:{width:1366,height:768}});await p.goto(base);await waitPanel(p,'home');
 await p.keyboard.press('ArrowDown');assert.equal(await p.locator('.arcade-option.is-selected').getAttribute('data-menu-entry'),'practice');
 await p.keyboard.press('KeyW');assert.equal(await p.locator('.arcade-option.is-selected').getAttribute('data-menu-entry'),'arcade');
 await p.keyboard.press('KeyS');await p.keyboard.press('KeyU');await p.keyboard.press('Enter');await waitPanel(p,'fighters');
 assert.equal(await p.evaluate(()=>window.AzhiGame.game),null);
 await p.locator('#characterList [data-char="gambler"]').click();await backHome(p);
 assert.equal(await p.locator('.arcade-option.is-selected').getAttribute('data-menu-entry'),'practice');
 await p.keyboard.press('Space');await waitPanel(p,'fighters');
 assert.equal(await p.locator('#characterList [aria-pressed="true"]').getAttribute('data-char'),'azhi','return cancels an unconfirmed preview');await p.locator('#characterList [data-char="gambler"]').click();
 await p.locator('#mainAction').click();await enterLocalBattle(p);await p.waitForFunction(()=>window.AzhiGame.game?.introFrames===0);
 assert.equal(await p.evaluate(()=>window.AzhiGame.game.players[0].meter),100,'menu U was not queued into combat');
 await p.locator('#stage').focus();await p.keyboard.down('KeyD');
 const x=await p.evaluate(()=>window.AzhiGame.game.players[0].x);await p.waitForFunction(x=>window.AzhiGame.game.players[0].x>x+5,x);
 await p.keyboard.press('Escape');await waitPanel(p,'home');
 const paused=await p.evaluate(()=>({tick:window.AzhiGame.game.tick,x:window.AzhiGame.game.players[0].x}));
 await p.keyboard.press('KeyS');await p.keyboard.press('KeyU');await p.waitForTimeout(150);
 assert.equal(await p.evaluate(()=>window.AzhiGame.game.tick),paused.tick,'home pauses the existing local simulation');
 assert.equal(await p.evaluate(()=>window.AzhiGame.mode),'practice','highlighting another entry does not change the active mode');
 await p.keyboard.up('KeyD');await p.keyboard.down('Escape');await p.keyboard.down('Escape');await p.keyboard.up('Escape');await p.waitForFunction(()=>!window.AzhiShell.isOpen());
 await p.waitForFunction(tick=>window.AzhiGame.game.tick>tick+12,paused.tick);
 assert.ok(Math.abs(await p.evaluate(()=>window.AzhiGame.game.players[0].x)-paused.x)<1,'held movement is released when opening the menu');
 assert.equal(await p.evaluate(()=>window.AzhiGame.game.players[0].meter),100);assert.equal(await p.evaluate(()=>window.AzhiGame.game.players[0].char),'gambler');
 assert.deepEqual(p.errors,[]);
});

test('Phase 1 changing menu modes while joined keeps the existing online room and connection',async()=>{
 const p=await page();await p.goto(base+'/?room=P1GUARD');await waitPanel(p,'room');
 await openRoomForm(p);await p.locator('#onlineNickname').fill('Phase One');await p.locator('#joinRoom').evaluate(button=>button.click());
 await p.waitForFunction(()=>window.AzhiGame.connected&&window.AzhiGame.room==='P1GUARD'&&!document.querySelector('#readyButton').disabled);
 for(const entry of ['practice','arcade','online']){
  await p.evaluate(()=>window.AzhiShell.open('home'));await choose(p,entry);await waitPanel(p,'room');
  assert.equal(new URL(p.url()).pathname,'/');assert.equal(await p.evaluate(()=>window.AzhiGame.mode),'online');
  assert.equal(await p.evaluate(()=>window.AzhiGame.connected),true);assert.equal(await p.evaluate(()=>window.AzhiGame.room),'P1GUARD');
 }
 await p.locator('[data-custom-mode="team"]').evaluate(button=>button.click());assert.equal(new URL(p.url()).pathname,'/');assert.equal(await p.evaluate(()=>window.AzhiGame.room),'P1GUARD','secondary room navigation also preserves an occupied room');
 await openRoomForm(p);await p.locator('#onlineNickname').fill('Typed W S');await p.locator('#onlineNickname').press('Enter');
 assert.equal(await p.evaluate(()=>window.AzhiShell.currentPanel),'room','text-field Enter is not consumed by main-menu navigation');
 assert.equal(await p.evaluate(()=>window.AzhiGame.connected),true);assert.deepEqual(p.errors,[]);
});

test('Phase 1 invalid legacy save recovers safely while retaining progress, purchases and currency',async()=>{
 const p=await page();await p.addInitScript(()=>localStorage.setItem('azhi70_save',JSON.stringify({chapter:1.5,character:'constructor',coins:740,clears:4,bestCombo:11,purchased:['classic','gold'],palette:'gold',sound:false,vfx:'low'})));
 await p.goto(base);await waitPanel(p,'home');
 const save=await p.evaluate(()=>JSON.parse(localStorage.getItem('azhi70_save')));
 assert.equal(save.chapter,0);assert.equal(save.character,'azhi');assert.equal(save.coins,740);assert.equal(save.clears,4);assert.equal(save.bestCombo,11);
 assert.deepEqual(save.purchased,['classic','gold']);assert.equal(save.palette,'gold');assert.equal(save.sound,false);assert.equal(save.vfx,'low');
 assert.equal(await p.locator('#coinsHeader,.arcade-home .career').count(),0);assert.doesNotMatch(await p.locator('.arcade-home').textContent(),/YOUR FIGHT FUND|740\s*G/i);
 await choose(p,'arcade');await waitPanel(p,'fighters');assert.match(await p.locator('#selectionSummary').textContent(),/阿志/);assert.doesNotMatch(await p.locator('#selectionSummary').textContent(),/undefined|Object/);
 assert.equal(await p.locator('#characterList [aria-pressed="true"]').count(),1);assert.deepEqual(p.errors,[]);
});

test('Phase 1 desktop main menu has a full-window key visual, five visible slanted choices and selection feedback',async()=>{
 const p=await page({viewport:{width:1920,height:1080}});await p.goto(base);await waitPanel(p,'home');
 await p.locator('.arcade-hero').evaluate(image=>image.decode());await p.evaluate(()=>document.fonts.ready);
 for(const viewport of [{width:1920,height:1080},{width:1600,height:900},{width:1366,height:768},{width:1280,height:720}]){
  await p.setViewportSize(viewport);await p.locator('[data-menu-entry="arcade"]').click();
  await p.waitForTimeout(220);
  const geometry=await p.evaluate(()=>{
   const rect=element=>{const b=element.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};
   return {menu:rect(document.querySelector('#appMenu')),hero:rect(document.querySelector('.arcade-hero')),heroFit:getComputedStyle(document.querySelector('.arcade-hero')).objectFit,
    options:[...document.querySelectorAll('.arcade-option')].map(element=>{const copy=element.querySelector('.arcade-option-copy');return {...rect(element),shape:getComputedStyle(element).clipPath,textFits:copy.scrollWidth<=copy.clientWidth+1};}),
    confirm:rect(document.querySelector('#arcadeEnter')),overflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1};
  });
  assert.ok(Math.abs(geometry.menu.width-viewport.width)<=1&&Math.abs(geometry.menu.height-viewport.height)<=1,'home fills the viewport');
  assert.equal(geometry.heroFit,'contain','the main illustration keeps its original proportions');assert.ok(geometry.hero.width>viewport.width*.35&&geometry.hero.height>viewport.height*.4);
  for(const option of geometry.options){assert.ok(option.x>=0&&option.y>=0&&option.x+option.width<=viewport.width+1&&option.y+option.height<=viewport.height+1,JSON.stringify({viewport,option}));assert.ok(option.height>=44);assert.equal(option.textFits,true);}
  assert.ok(geometry.confirm.y+geometry.confirm.height<=viewport.height+1);assert.equal(geometry.overflow,false);
  await p.screenshot({path:`coverage/phase1-main-menu-${viewport.width}.png`,fullPage:false});
 }
 const unselected=await p.locator('[data-menu-entry="practice"]').evaluate(element=>({panel:getComputedStyle(element).backgroundColor,number:getComputedStyle(element).transform}));
 await p.locator('[data-menu-entry="practice"]').click();await p.waitForTimeout(220);
 const selected=await p.locator('[data-menu-entry="practice"]').evaluate(element=>({panel:getComputedStyle(element).backgroundColor,number:getComputedStyle(element).transform}));
 assert.notEqual(selected.panel,unselected.panel);assert.notEqual(selected.number,unselected.number);
 await p.screenshot({path:'coverage/phase1-main-menu-selected.png',fullPage:false});assert.deepEqual(p.errors,[]);
});

test('Phase 1 reduced-motion mobile menu remains touchable with no horizontal overflow',async()=>{
 const p=await page({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await p.goto(base);await waitPanel(p,'home');await p.locator('.arcade-hero').evaluate(image=>image.decode());
 assert.equal(await p.locator('.arcade-option').count(),9);
 for(const button of await p.locator('.arcade-option').all())assert.ok((await button.boundingBox()).height>=44);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const animations=await p.locator('.arcade-home').evaluate(element=>element.getAnimations({subtree:true}).filter(animation=>animation.effect.getTiming().duration>10).length);assert.equal(animations,0,'reduced motion disables menu entrance and selection animations');
 await p.screenshot({path:'coverage/phase1-main-menu-mobile.png',fullPage:false});
 await p.locator('[data-menu-entry="settings"]').tap();await p.locator('#arcadeEnter').tap();await waitPanel(p,'settings');assert.equal(await p.locator('#soundToggle').isVisible(),true);
 await p.locator('[data-home]').tap();await waitPanel(p,'home');
 await p.setViewportSize({width:844,height:390});
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 for(const button of await p.locator('.arcade-option').all()){const box=await button.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=390&&box.height>=44);}
 assert.ok((await p.locator('#arcadeEnter').boundingBox()).height>=44,'landscape confirmation retains a 44px touch target');
 await p.screenshot({path:'coverage/phase1-main-menu-mobile-landscape.png',fullPage:false});assert.deepEqual(p.errors,[]);
});
