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

async function trackStages(p){await p.addInitScript(()=>{window.stageDraws=[];const original=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(image?.src?.match(/\/art\/(stages\/|night\.svg|garage\.svg|port-arena\.svg)/)){window.stageDraws.push({src:image.src,args});if(window.stageDraws.length>40)window.stageDraws.shift();}return original.call(this,image,...args);};});}

test('renamed desktop and mobile main menu keeps gambler and Azhi regardless of saved fighter',async()=>{
 const p=await page({viewport:{width:1920,height:1080}});await p.addInitScript(()=>localStorage.setItem('azhi70_save',JSON.stringify({character:'sezi'})));await p.goto(base);await p.waitForFunction(()=>window.AzhiShell?.isOpen());await decoded(p.locator('.arcade-hero,.arcade-support-hero'));await p.evaluate(()=>document.fonts.ready);
 assert.match(await p.title(),/陪公子練武/);assert.equal((await p.locator('.arcade-wordmark').innerText()).replace(/\s/g,''),'陪公子練武');assert.equal(await p.evaluate(()=>window.AzhiGame.character),'sezi');
 assert.equal(await p.locator('.arcade-hero').getAttribute('data-character-art'),'azhi');assert.equal(await p.locator('.arcade-support-hero').getAttribute('data-character-art'),'gambler');
 await p.screenshot({path:'coverage/spar-menu-1920.png'});
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(250);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok((await p.locator('#arcadeEnter').boundingBox()).height>=44);await p.screenshot({path:'coverage/spar-menu-mobile.png'});assert.deepEqual(p.errors,[]);
});

test('all three supplied maps are actually drawn by existing arcade chapters with matching labels',async()=>{
 for(const [chapter,id,asset,name] of [[0,'harbor','tiananmen-square','天安門廣場'],[1,'garage','golden-casino','金沙賭城'],[3,'night','night-market','嘴砲夜市']]){
  const p=await page({viewport:{width:1366,height:768}});await trackStages(p);await p.addInitScript(chapter=>localStorage.setItem('azhi70_save',JSON.stringify({chapter,character:'azhi'})),chapter);await p.goto(base);await p.waitForFunction(()=>window.AzhiShell);await p.evaluate(()=>window.AzhiShell.open('fighters'));await p.locator('#mainAction').click();await p.waitForFunction(()=>!AzhiShell.isOpen()&&!!AzhiGame.game);
  await p.waitForFunction(asset=>window.stageDraws.some(d=>d.src.includes('/stages/'+asset+'/background.webp')),asset);
  assert.equal(await p.evaluate(()=>window.AzhiGame.game.stage),id);assert.match(await p.locator('#stageLabel').textContent(),new RegExp(name));
  const draw=await p.evaluate(()=>window.stageDraws.at(-1));assert.ok(Math.abs(draw.args[2]/draw.args[3]-1672/941)<.0001,'no stretched background');
  await p.waitForFunction(()=>window.AzhiGame.game.introFrames===0);await p.screenshot({path:'coverage/spar-stage-'+id+'.png'});assert.deepEqual(p.errors,[]);
 }
 const team=await page();await trackStages(team);await team.goto(base+'/team.html');await team.waitForFunction(()=>window.stageDraws.some(d=>d.src.includes('/stages/night-market/background.webp')));assert.match(await team.title(),/陪公子練武/);assert.deepEqual(team.errors,[]);
});

test('missing new map falls back once to the old background and keeps combat playable',async()=>{
 const p=await page();let requests=0;await trackStages(p);await p.route('**/art/stages/**/background.webp*',route=>{requests++;return route.abort();});await p.goto(base+'/?mode=practice');await p.waitForFunction(()=>window.AzhiShell);await p.evaluate(()=>window.AzhiShell.open('fighters'));await p.locator('#mainAction').click();await p.waitForFunction(()=>!AzhiShell.isOpen()&&!!AzhiGame.game);await p.waitForFunction(()=>window.stageDraws.some(d=>d.src.endsWith('/art/port-arena.svg')));await p.waitForFunction(()=>window.AzhiGame.game.tick>30);assert.equal(requests,3);assert.deepEqual(p.errors,[]);
});
