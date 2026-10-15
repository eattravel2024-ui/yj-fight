'use strict';
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
test('retired character save migrates without losing progress or currency',async()=>{
 const p=await page();await p.addInitScript(()=>localStorage.setItem('azhi70_save',JSON.stringify({character:'sam',chapter:3,coins:782,clears:4,storyVersion:'five-fighters-1'})));
 await p.goto(base);await p.waitForFunction(()=>window.AzhiDebug);
 const save=await p.evaluate(()=>JSON.parse(localStorage.getItem('azhi70_save')));
 assert.equal(save.character,'azhi');assert.equal(save.chapter,3);assert.equal(save.coins,782);assert.equal(save.clears,4);
 assert.deepEqual(p.errors,[]);
});
test('desktop practice: four fighters, easy skill and preserved legacy entry',async()=>{
 const p=await page({viewport:{width:1440,height:1000}});await p.goto(base);await p.waitForFunction(()=>window.AzhiDebug);
 assert.equal(await p.locator('#characterList button').count(),4);
 assert.ok(await p.locator('a[href*="adventure-legacy"]').count());
 await p.locator('[data-mode="practice"]').focus();await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>window.AzhiDebug.mode),'practice');await p.locator('#mainAction').click();
 await p.waitForFunction(()=>window.AzhiDebug.local?.practice===true);
 await p.locator('#stage').focus();await p.keyboard.press('KeyU');
 await p.waitForFunction(()=>window.AzhiDebug.local?.players[0].meter<100);
 assert.equal(await p.evaluate(()=>window.AzhiDebug.local.players[0].char),'azhi');
 assert.deepEqual(p.errors,[]);await p.screenshot({path:'coverage/desktop-arena.png',fullPage:true});
});
test('mobile touch skill, no horizontal page overflow and reduced motion',async()=>{
 const p=await page({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await p.goto(base);await p.waitForFunction(()=>window.AzhiDebug);
 await p.locator('[data-mode="practice"]').click();await p.locator('#mainAction').click();
 await p.locator('[data-key="special"]').first().tap();await p.waitForFunction(()=>window.AzhiDebug.local.players[0].meter<100);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(p.errors,[]);await p.screenshot({path:'coverage/mobile-arena.png',fullPage:true});
});
test('legacy adventure remains usable under real CSP',async()=>{
 const p=await page();await p.goto(base+'/adventure-legacy-6.8.html');await p.locator('#nav button').first().waitFor();
 await p.locator('#nav [data-legacy-action="go(\'city\')"]').click();await p.locator('.map').waitFor();
 assert.match(await p.locator('#pagetitle').textContent(),/城市/);
 await p.locator('[data-legacy-action="job()"]').click();assert.match(await p.locator('#toast').textContent(),/完成/);
 assert.deepEqual(p.errors,[]);
});
test('two real browser clients play 1v1 and spectator stays read only',async()=>{
 const a=await page(),b=await page();
 for(const [p,n] of [[a,'Browser Alpha'],[b,'Browser Bravo']]){await p.goto(base+'/?room=E2EDUEL');await p.locator('#onlineNickname').fill(n);await p.locator('#joinRoom').click();}
 await a.waitForFunction(()=>window.AzhiDebug.rollback?.frame>5);await b.waitForFunction(()=>window.AzhiDebug.rollback?.frame>5);
 await a.locator('#stage').focus();await a.keyboard.press('KeyU');
 await a.waitForFunction(()=>window.AzhiDebug.rollback.game.players[0].meter<25);
 const watch=await page();await watch.goto(base+'/team.html?room=E2EDUEL&watch=1');
 await watch.waitForFunction(()=>window.AzhiTeamDebug?.role==='spectator'&&window.AzhiTeamDebug?.frame>0);
 assert.equal(await watch.evaluate(()=>window.AzhiTeamDebug.slot),-1);
 for(const p of [a,b,watch])assert.deepEqual(p.errors,[]);
});
test('four real browser clients start 2v2 with four retained characters',async()=>{
 const players=[];
 for(const [i,char] of ['winnie','sezi','gambler','azhi'].entries()){
  const p=await page();players.push(p);await p.goto(base+'/team.html');await p.locator('#roomCode').fill('E2ETEAM');await p.locator('#playerNickname').fill('Team Player '+i);
  await p.locator('#teamCharacters button').nth(i).click();await p.locator('#joinButton').click();
 }
 for(const p of players)await p.waitForFunction(()=>window.AzhiTeamDebug?.session?.frame>5);
 const roster=await players[0].evaluate(()=>window.AzhiTeamDebug.game.players.map(p=>p.char));assert.deepEqual(new Set(roster),new Set(['winnie','sezi','gambler','azhi']));
 const previous=await players[0].evaluate(()=>{const s=window.AzhiTeamDebug.session;s.game.status='finished';return s.frame;});
 await players[0].waitForFunction(frame=>window.AzhiTeamDebug.session.frame>frame,previous);
 await players[0].waitForFunction(()=>window.AzhiTeamDebug.session.game.status==='playing');
 for(const p of players)assert.deepEqual(p.errors,[]);
});
