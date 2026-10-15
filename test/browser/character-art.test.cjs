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

test('Phase 1.5 all twelve UI assets decode with real transparency, safe edges and light/dark previews',async()=>{
 const p=await page({viewport:{width:1800,height:1380}});await p.goto(base);await p.waitForFunction(()=>window.AzhiCharacterArt);
 const audit=await p.evaluate(async()=>{
  const A=window.AzhiCharacterArt,results=[];
  for(const id of A.IDS)for(const role of A.ROLES){
   const image=new Image();image.src=A.forCharacter(id)[role+'Asset'];await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,image.width,image.height).data;let transparent=0,painted=0,edges=0;
   for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const alpha=rgba[(y*image.width+x)*4+3];if(alpha===0)transparent++;if(alpha>200)painted++;if((!x||!y||x===image.width-1||y===image.height-1)&&alpha>16)edges++;}
   results.push({id,role,width:image.width,height:image.height,transparent:transparent/(image.width*image.height),painted:painted/(image.width*image.height),edges});
  }
  // QA-only DOM; this is not a new production gallery or Character Select screen.
  window.AzhiShell.close();const gallery=document.createElement('main');gallery.id='artQa';Object.assign(gallery.style,{position:'fixed',inset:'0',zIndex:9999,background:'#686b72',display:'grid',gridTemplateColumns:'repeat(6,1fr)',gridTemplateRows:'repeat(4,1fr)',gap:'8px',padding:'8px'});
  for(const id of A.IDS)for(const role of A.ROLES)for(const color of ['#f5f1e8','#09090f']){const tile=document.createElement('figure');Object.assign(tile.style,{margin:'0',minHeight:'0',display:'flex',flexDirection:'column',background:color});const label=document.createElement('figcaption');label.textContent=id+' / '+role+' / '+(color==='#09090f'?'DARK':'LIGHT');Object.assign(label.style,{font:'12px monospace',color:color==='#09090f'?'white':'black',padding:'6px'});const image=new Image();image.src=A.forCharacter(id)[role+'Asset'];Object.assign(image.style,{width:'100%',height:'calc(100% - 28px)',minHeight:'0',objectFit:'contain'});await image.decode();tile.append(label,image);gallery.append(tile);}document.body.append(gallery);return results;
 });
 const sizes={fullbody:[768,1024],portrait:[512,512],hud:[256,256]};assert.equal(audit.length,12);
 for(const a of audit){assert.deepEqual([a.width,a.height],sizes[a.role]);assert.ok(a.transparent>.05&&a.painted>.1);assert.equal(a.edges,0,a.id+' '+a.role+' has no added boundary clipping');}
 await p.screenshot({path:'coverage/phase15-art-light-dark.png'});assert.deepEqual(p.errors,[]);
});

test('Phase 1.5 actual menu, existing cards and HUD use role assets while combat still draws sprite atlases',async()=>{
 const p=await page({viewport:{width:1920,height:1080}});await p.goto(base);await p.waitForFunction(()=>window.AzhiShell?.isOpen());await decoded(p.locator('.arcade-hero,.arcade-support-hero'));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);await p.screenshot({path:'coverage/phase15-menu-1920.png'});
 await p.evaluate(()=>window.AzhiShell.open('fighters'));await decoded(p.locator('#characterList img'));
 const frames=await p.locator('#characterList .fighter-portrait').evaluateAll(nodes=>nodes.map(node=>{const img=node.querySelector('img'),box=node.getBoundingClientRect(),image=img.getBoundingClientRect(),css=getComputedStyle(img);return {id:img.dataset.characterArt,role:img.dataset.artRole,src:img.getAttribute('src'),width:img.naturalWidth,height:img.naturalHeight,contained:Math.abs(image.x-box.x)<1&&Math.abs(image.y-box.y)<1&&Math.abs(image.width-box.width)<1&&Math.abs(image.height-box.height)<1,fit:css.objectFit,transform:css.transform};}));
 assert.equal(frames.length,4);for(const f of frames){assert.equal(f.role,'portrait');assert.deepEqual([f.width,f.height],[512,512]);assert.equal(f.contained,true,'old photo zoom must not crop '+f.id);assert.equal(f.fit,'contain');assert.equal(f.transform,'none');}
 await p.setViewportSize({width:1366,height:768});await p.waitForTimeout(250);await p.screenshot({path:'coverage/phase15-portraits.png'});
 for(const id of ['winnie','sezi','gambler','azhi']){await p.locator('#characterList [data-char="'+id+'"]').click();await p.evaluate(()=>window.AzhiShell.open('home'));await decoded(p.locator('.arcade-hero'));assert.match(await p.locator('.arcade-hero').getAttribute('src'),new RegExp('/'+id+'/fullbody\\.webp'));await p.evaluate(()=>window.AzhiShell.open('fighters'));}
 await p.evaluate(()=>{window.artDraws=[];const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(this.canvas.id==='stage'&&image?.src?.includes('/sprites/'))window.artDraws.push({src:image.src,width:image.naturalWidth,height:image.naturalHeight});return draw.call(this,image,...args);};});
 await p.locator('#mainAction').click();await p.waitForFunction(()=>window.AzhiGame.game?.introFrames===0);await decoded(p.locator('#p1Portrait,#p2Portrait'));assert.match(await p.locator('#p1Portrait').getAttribute('src'),/\/azhi\/hud\.webp/);
 const draw=await p.evaluate(()=>window.artDraws.at(-1));assert.equal(draw.width,3840);assert.equal(draw.height,5100);assert.match(draw.src,/\/sprites\//);
 await p.screenshot({path:'coverage/phase15-combat-hud.png'});assert.deepEqual(p.errors,[]);
 const team=await page();await team.goto(base+'/team.html');await team.evaluate(()=>window.AzhiShell.open('fighters'));await decoded(team.locator('#teamCharacters img'));for(const image of await team.locator('#teamCharacters img').all())assert.equal(await image.getAttribute('data-art-role'),'portrait');assert.deepEqual(team.errors,[]);
});

test('Phase 1.5 missing art uses a same-character backup and terminal failures show text without retry loops',async()=>{
 const p=await page(),requests=[];
 await p.route('**/art/characters/winnie/portrait.webp*',route=>{requests.push('new-winnie');return route.abort()});
 await p.route('**/art/characters/gambler/hud.webp*',route=>{requests.push('new-gambler');return route.abort()});
 await p.route('**/art/portrait_gambler.webp*',route=>{requests.push('old-gambler');return route.abort()});
 await p.goto(base);await p.waitForFunction(()=>window.AzhiShell?.isOpen());await p.evaluate(()=>window.AzhiShell.open('fighters'));
 await p.waitForFunction(()=>document.querySelector('#characterList [data-char="winnie"] img').dataset.artStatus==='fallback');assert.match(await p.locator('#characterList [data-char="winnie"] img').getAttribute('src'),/portrait_winnie/);
 await p.locator('#characterList [data-char="gambler"]').click();await p.waitForFunction(()=>document.querySelector('#p1Portrait').dataset.artStatus==='missing');
 assert.equal(await p.locator('#p1Portrait').isHidden(),true);assert.match(await p.locator('.art-unavailable').textContent(),/金沙賭神圖片暫未載入/);
 await p.evaluate(()=>{for(let i=0;i<20;i++)window.AzhiCharacterArt.bindImage(document.querySelector('#p1Portrait'),'gambler','hud');});await p.waitForTimeout(600);
 assert.equal(requests.filter(x=>x==='new-gambler').length,1);assert.equal(requests.filter(x=>x==='old-gambler').length,1);assert.deepEqual(p.errors,[]);
});
