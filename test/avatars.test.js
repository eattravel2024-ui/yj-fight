'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),sharp=require('sharp');
const A=require('../server/avatars'),Editor=require('../public/avatar-editor'),{createAccounts}=require('../server/accounts'),{database,users}=require('./online-test-helpers.cjs');
const image=(width=256,height=256,color='#00d5e8')=>sharp({create:{width,height,channels:3,background:color}}).webp().toBuffer();
test('server avatar normalization strips metadata, bounds decoding and rejects spoofed or animated/non-WebP content',async()=>{
 const raw=await sharp({create:{width:256,height:256,channels:3,background:'#ff3569'}}).withExif({IFD0:{Artist:'private camera metadata'}}).webp().toBuffer();
 assert.ok((await sharp(raw).metadata()).exif);const result=await A.normalize(raw),meta=await sharp(result.image).metadata();assert.equal(meta.width,256);assert.equal(meta.height,256);assert.equal(meta.format,'webp');assert.equal(meta.exif,undefined);assert.equal(result.digest.length,64);assert.ok(result.image.length<=A.MAX_BYTES);
 for(const raw of[Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>bad()</script></svg>'),Buffer.alloc(0),await image(512,512),await sharp(await image()).png().toBuffer()])await assert.rejects(A.normalize(raw),e=>e.code==='AVATAR_IMAGE');
 const animated=await sharp([await image(),await image(256,256,'#ff3569')],{join:{animated:true}}).webp({loop:0,delay:[100,100]}).toBuffer();assert.equal((await sharp(animated).metadata()).pages,2);await assert.rejects(A.normalize(animated),e=>e.code==='AVATAR_IMAGE');
});
test('crop geometry stays proportional and inside the source; custom URLs cannot reference external or malformed images',()=>{
 const full=Editor.cropRect(1200,600);assert.deepEqual(full,{x:300,y:0,size:600,cx:600,cy:300});const edge=Editor.cropRect(1200,600,2,-999,999);assert.deepEqual(edge,{x:0,y:300,size:300,cx:150,cy:450});
 for(const input of['https://evil.example/a.webp','/api/avatars/../private.webp','data:image/svg+xml,anything'])assert.equal(Editor.isAvatarUrl(input),false);assert.equal(Editor.isAvatarUrl(A.avatarPath('12345678-1234-1234-1234-123456789012','a'.repeat(64))),true);
});
test('real account avatar upload enforces identity/CSRF/limits, persists after service recreation and cleans replaced images',{skip:!process.env.AZHI_TEST_DATABASE_URL&&'Requires isolated PostgreSQL'},async t=>{
 const {db}=await database(t),[first,second]=await users(db);let accounts,server,base;
 async function start(){accounts=createAccounts({db,env:{}});server=http.createServer(async(req,res)=>{if(!await accounts.handle(req,res))res.writeHead(404).end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
 await start();t.after(async()=>{accounts.close();await new Promise(r=>server.close(r));});
 async function login(user){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:user.username,password:user.password})});const data=await r.json();assert.equal(r.status,200);return {Cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; '),'X-CSRF-Token':data.csrfToken};}
 const one=await login(first),two=await login(second),raw=await image();
 async function upload(payload=raw,headers=one,suffix=''){return fetch(base+'/api/profile/avatar'+suffix,{method:'POST',headers:{Origin:base,'Content-Type':'image/webp',...headers},body:payload});}
 assert.equal((await upload(raw,{})).status,401);assert.equal((await upload(raw,{Cookie:one.Cookie})).status,403);assert.equal((await upload(raw,{...one,Origin:'https://evil.example'})).status,403);
 assert.equal((await upload(Buffer.alloc(A.MAX_BYTES+1))).status,413);assert.equal((await upload(Buffer.from('<svg>not an image</svg>'))).status,400);assert.equal((await upload(raw,{...one,'Content-Type':'image/svg+xml'})).status,415);
 const chunked=await new Promise((resolve,reject)=>{const req=http.request(base+'/api/profile/avatar',{method:'POST',headers:{Origin:base,'Content-Type':'image/webp',...one}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.write(Buffer.alloc(70*1024));req.end(Buffer.alloc(70*1024));});assert.equal(chunked,413);
 await new Promise(resolve=>{const req=http.request(base+'/api/profile/avatar',{method:'POST',headers:{Origin:base,'Content-Type':'image/webp',...one}});req.on('error',()=>{});req.write(raw.subarray(0,12));setTimeout(()=>{req.destroy();resolve();},25);});
 const uploaded=await upload();assert.equal(uploaded.status,200);const profile=await uploaded.json(),url=profile.user.avatar;assert.ok(Editor.isAvatarUrl(url));assert.ok(url.includes(first.id));
 const result=await fetch(base+url),stored=Buffer.from(await result.arrayBuffer());assert.equal(result.status,200);assert.equal(result.headers.get('content-type'),'image/webp');assert.equal(result.headers.get('x-content-type-options'),'nosniff');assert.ok(result.headers.get('cache-control').includes('immutable'));assert.equal((await sharp(stored).metadata()).width,256);assert.equal((await fetch(base+url,{headers:{'If-None-Match':result.headers.get('etag')}})).status,304);
 assert.equal((await upload(await image(512,512))).status,400);assert.equal((await db.query('SELECT avatar FROM users WHERE id=$1',[first.id])).rows[0].avatar,url);
 assert.equal((await fetch(base+'/api/profile',{method:'PATCH',headers:{Origin:base,'Content-Type':'application/json',...two},body:JSON.stringify({avatar:url})})).status,400);
 const ownSecond=await upload(await image(256,256,'#ffc247'),two,'?userId='+first.id);assert.equal(ownSecond.status,200);assert.ok((await ownSecond.json()).user.avatar.includes(second.id));assert.equal((await db.query('SELECT avatar FROM users WHERE id=$1',[first.id])).rows[0].avatar,url);
 // Recreating the account service uses persisted DB bytes, not an in-memory upload cache.
 await new Promise(r=>server.close(r));accounts.close();await start();const persisted=await fetch(base+url);assert.equal(persisted.status,200);assert.deepEqual(Buffer.from(await persisted.arrayBuffer()),stored);
 const replaced=await upload(await image(256,256,'#57f2a5'));assert.equal(replaced.status,200);const newer=(await replaced.json()).user.avatar;assert.notEqual(newer,url);assert.equal((await fetch(base+url)).status,404);
 const keep=await fetch(base+'/api/profile',{method:'PATCH',headers:{Origin:base,'Content-Type':'application/json',...one},body:JSON.stringify({nickname:'改名保留頭像'})});assert.equal(keep.status,200);assert.equal((await keep.json()).user.avatar,newer);
 const reset=await fetch(base+'/api/profile',{method:'PATCH',headers:{Origin:base,'Content-Type':'application/json',...one},body:JSON.stringify({avatar:'sezi'})});assert.equal(reset.status,200);assert.equal((await fetch(base+newer)).status,404);assert.equal((await db.query('SELECT count(*)::int n FROM player_avatars WHERE user_id=$1',[first.id])).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM player_avatars WHERE user_id=$1',[second.id])).rows[0].n,1);
});
