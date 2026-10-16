'use strict';
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

async function panel(p,name){await p.waitForFunction(name=>AzhiShell.isOpen()&&AzhiShell.currentPanel===name,name);}
async function fighters(p,mode,char){await p.goto(base+'/?mode='+mode+'&panel=fighters');await panel(p,'fighters');await p.locator('#characterList [data-char="'+char+'"]').click();await p.locator('#mainAction').click();await panel(p,mode==='practice'?'stages':'missions');}
async function started(p){await p.waitForFunction(()=>!AzhiShell.isOpen()&&AzhiGame.game?.introFrames===0);}
async function actualFight(p,win=true){
 return p.evaluate(win=>{
  const g=AzhiGame.game,C=AzhiCore;let frames=0,hits=0,kos=0,timeouts=0;
  // Accelerate the actual deterministic engine with legal inputs and the mission CPU.
  // Never assign HP, timer, wins, status or winner to manufacture a result.
  while(g.status!=='finished'&&frames++<25000){
   const a=g.players[0],b=g.players[1],d=Math.abs(a.x-b.x),keys={};
   if(win){if(d>55)keys[a.x<b.x?'right':'left']=true;keys.pulses=[d<86?'throw':a.meter>=60?'super':a.meter>=25?'special':'heavy'];}
   C.input(g,0,keys);C.cpu(g,1,g.difficulty);C.step(g);
   for(const e of g.events){if(e.kind==='hit')hits++;if(e.kind==='round'){if(g.time<=0)timeouts++;if(g.players.some(p=>p.hp<=0))kos++;}}
   if(g.status!=='finished')g.events.splice(0);
  }
  return {winner:g.winner,status:g.status,hits,kos,timeouts,frames};
 },win);
}
test('four selected fighters and three real practice maps reach VS and live battle with matching HUD, art and BGM',async()=>{
 const p=await page({viewport:{width:1366,height:768},reducedMotion:'reduce'});
 for(const [i,char] of ['azhi','sezi','gambler','winnie'].entries()){
  const stage=['night','garage','harbor'][i%3];await fighters(p,'practice',char);assert.equal(await p.locator('[data-stage="fur_lab"]').isDisabled(),true);await p.locator('[data-stage="'+stage+'"]').click();
  if(i===1){await p.locator('#appPane-stages .journey-stage-image>img').evaluate(img=>img.decode());await p.screenshot({path:'coverage/phase3-stage-select.png'});}
  await p.locator('#stageConfirm').click();await panel(p,'versus');assert.equal(await p.evaluate(()=>AzhiGame.game),null,'local simulation begins only after VS/resource preparation');await started(p);
  assert.equal(await p.evaluate(()=>AzhiGame.game.players[0].char),char);assert.equal(await p.evaluate(()=>AzhiGame.game.stage),stage);assert.equal(await p.locator('#p1Portrait').getAttribute('data-character-art'),char);
  await p.waitForFunction(stage=>AzhiAudio.snapshot.current===AzhiStages.get(stage).bgm,stage);const starts=await p.evaluate(()=>AzhiAudio.snapshot.musicStarts);await p.waitForTimeout(550);assert.equal(await p.evaluate(()=>AzhiAudio.snapshot.musicStarts),starts);
  await p.locator('#stage').focus();await p.keyboard.press('KeyU');await p.waitForFunction(()=>AzhiGame.game.players[0].meter<100);
  if(stage==='harbor')await p.screenshot({path:'coverage/phase3-square-battle.png'});
 }
 assert.equal(await p.evaluate(()=>AzhiAudio.snapshot.played.filter(e=>e.id==='vs').length),1,'each fresh page has one VS sting for its one encounter');assert.deepEqual(p.errors,[]);
});
test('real engine losses/timeouts retry the same encounter; five real wins unlock the campaign and persist completion',async()=>{
 const p=await page({viewport:{width:1366,height:900},reducedMotion:'reduce'});await fighters(p,'arcade','gambler');await p.locator('.journey-stage-image>img').first().evaluate(img=>img.decode());await p.screenshot({path:'coverage/phase3-mission-select.png'});assert.equal(await p.locator('[data-mission="honey-ruler"]').isDisabled(),true);
 await p.locator('#missionConfirm').click();await panel(p,'versus');await p.screenshot({path:'coverage/phase3-versus.png'});await started(p);const loss=await actualFight(p,false);assert.equal(loss.winner,1);assert.ok(loss.timeouts>0,'real countdown expiration resolves the passive-player loss');await panel(p,'results');assert.match(await p.locator('.result-actions').textContent(),/重新挑戰/);assert.equal(await p.evaluate(()=>AzhiGame.campaignProgress.completed.length),0);await p.screenshot({path:'coverage/phase3-defeat.png'});
 await p.locator('#resultContinue').click();await started(p);assert.equal(await p.evaluate(()=>AzhiGame.game.players[1].char),'azhi');let total=0;
 const ids=await p.evaluate(()=>AzhiCampaign.IDS);
 for(let i=0;i<ids.length;i++){
  const mission=await p.evaluate(id=>AzhiCampaign.get(id),ids[i]);assert.equal(await p.evaluate(()=>AzhiGame.game.stage),mission.stage);assert.equal(await p.evaluate(()=>AzhiGame.game.difficulty),mission.difficulty);
  const result=await actualFight(p,true);assert.equal(result.winner,0,mission.id);assert.ok(result.hits>0);assert.ok(result.kos>0);await panel(p,'results');total+=mission.reward;assert.equal(await p.evaluate(()=>AzhiGame.campaignProgress.completed.length),i+1);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('azhi70_save')).coins),total);assert.equal(await p.evaluate(()=>AzhiGame.lastLocalResult.missionId),ids[i]);
  const coins=await p.evaluate(()=>JSON.parse(localStorage.getItem('azhi70_save')).coins);await p.evaluate(()=>AzhiArcadeFlow.showResult(AzhiGame.lastLocalResult));assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('azhi70_save')).coins),coins,'re-rendering results never grants duplicate rewards');
  if(i<ids.length-1){await p.locator('#resultContinue').click();await started(p);}
 }
 assert.equal(await p.evaluate(()=>AzhiGame.lastLocalResult.complete),true);assert.match(await p.locator('.journey-result h2').textContent(),/全五關通關/);await p.screenshot({path:'coverage/phase3-complete.png'});await p.locator('.result-actions button').last().click();await panel(p,'home');await p.reload();await p.waitForFunction(()=>window.AzhiGame);assert.equal(await p.evaluate(()=>AzhiGame.campaignProgress.completed.length),5);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('azhi70_save')).coins),total);assert.deepEqual(p.errors,[]);
});
test('cancelling VS prevents delayed starts; failed sprite preload can retry without fabricating a battle',async()=>{
 const p=await page({viewport:{width:1280,height:720}});await p.route('**/sprites/azhi.png*',route=>route.abort());await fighters(p,'practice','azhi');await p.locator('#stageConfirm').click();await panel(p,'versus');await p.waitForFunction(()=>document.querySelector('.versus-foot').textContent.includes('載入失敗'));assert.equal(await p.evaluate(()=>AzhiGame.game),null);await p.keyboard.press('Escape');await panel(p,'stages');await p.unroute('**/sprites/azhi.png*');await p.locator('#stageConfirm').click();await panel(p,'versus');await p.keyboard.press('Escape');await panel(p,'stages');await p.waitForTimeout(1300);assert.equal(await p.evaluate(()=>AzhiGame.game),null);await p.locator('#stageConfirm').click();await started(p);assert.equal(await p.evaluate(()=>AzhiGame.game.practice),true);assert.deepEqual(p.errors,[]);
});
test('mobile landscape supports keyboard stage selection, proportional combat and preserved local menu pause',async()=>{
 const p=await page({viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await fighters(p,'practice','sezi');await p.locator('[data-stage="night"]').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.locator('[data-stage="garage"]').getAttribute('aria-pressed'),'true');await p.screenshot({path:'coverage/phase3-mobile-stage.png'});await p.keyboard.press('Enter');await started(p);
 const rect=await p.locator('#stage').boundingBox();assert.ok(Math.abs(rect.width/rect.height-16/9)<.01);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.locator('[data-key="special"]').first().tap();await p.waitForFunction(()=>AzhiGame.game.players[0].meter<100);await p.evaluate(()=>AzhiShell.open('home'));const tick=await p.evaluate(()=>AzhiGame.game.tick);await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>AzhiGame.game.tick),tick);assert.deepEqual(p.errors,[]);
});
