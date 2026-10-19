'use strict';
const crypto=require('node:crypto');
const sharp=require('sharp');
const SIZE=256,MAX_BYTES=128*1024;
const PATH=/^\/api\/avatars\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/([a-f0-9]{64})\.webp$/;
const fail=(status,code,message)=>Object.assign(new Error(message),{status,code});
function readImage(req){
 if(req.aborted||req.destroyed)throw fail(400,'AVATAR_READ','頭像上傳已中斷，請重試');
 if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='image/webp')throw fail(415,'AVATAR_TYPE','請先裁切並轉換為 WebP 頭像');
 if(Number(req.headers['content-length'])>MAX_BYTES){req.resume();throw fail(413,'AVATAR_SIZE','頭像檔案過大，請重新壓縮');}
 return new Promise((resolve,reject)=>{
  let size=0,parts=[],finished=false;
  const finish=(err,value)=>{if(finished)return;finished=true;req.off('data',data);req.off('end',end);req.off('error',bad);req.off('aborted',abort);if(err){req.on('error',()=>{});req.resume();reject(err);}else resolve(value);};
  const data=chunk=>{size+=chunk.length;if(size>MAX_BYTES)finish(fail(413,'AVATAR_SIZE','頭像檔案過大，請重新壓縮'));else parts.push(chunk);};
  const end=()=>finish(null,Buffer.concat(parts));const bad=()=>finish(fail(400,'AVATAR_READ','無法讀取頭像，請重試'));const abort=()=>bad();
  req.on('data',data);req.once('end',end);req.once('error',bad);req.once('aborted',abort);
 });
}
async function normalize(raw){
 if(!raw?.length||raw.length>MAX_BYTES)throw fail(400,'AVATAR_IMAGE','無法讀取頭像圖片');
 try{
  const image=sharp(raw,{limitInputPixels:SIZE*SIZE,failOn:'error',animated:false});
  const info=await image.metadata();
  if(info.format!=='webp'||info.width!==SIZE||info.height!==SIZE||(info.pages||1)!==1)throw new Error('Invalid avatar dimensions or animation');
  const result=await image.rotate().resize(SIZE,SIZE,{fit:'cover'}).webp({quality:82,effort:4}).toBuffer();
  if(result.length>MAX_BYTES)throw new Error('Avatar exceeds storage limit');
  return {image:result,digest:crypto.createHash('sha256').update(result).digest('hex')};
 }catch{throw fail(400,'AVATAR_IMAGE','請上傳有效的 256 × 256 靜態 WebP 頭像');}
}
function avatarPath(userId,digest){return `/api/avatars/${userId}/${digest}.webp`;}
async function store(db,userId,raw){
 const value=await normalize(raw),url=avatarPath(userId,value.digest);
 return db.transaction(async client=>{
  const active=await client.query("SELECT id FROM users WHERE id=$1 AND status='active' FOR UPDATE",[userId]);
  if(!active.rows.length)throw fail(401,'LOGIN_REQUIRED','請先登入有效玩家帳號');
  await client.query('INSERT INTO player_avatars(user_id,image,digest) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET image=EXCLUDED.image,digest=EXCLUDED.digest,updated_at=now()',[userId,value.image,value.digest]);
  return (await client.query('UPDATE users SET avatar=$2,updated_at=now() WHERE id=$1 RETURNING *',[userId,url])).rows[0];
 });
}
async function serve(db,req,res,pathname){
 const found=PATH.exec(pathname);if(!found)return false;
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return true;}
 const row=db?(await db.query("SELECT a.image FROM player_avatars a JOIN users u ON u.id=a.user_id WHERE a.user_id=$1 AND a.digest=$2 AND u.status='active'",[found[1],found[2]])).rows[0]:null;
 if(!row){res.writeHead(404,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end();return true;}
 const etag='"'+found[2]+'"',headers={'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=86400, immutable','Cross-Origin-Resource-Policy':'same-origin',ETag:etag};
 if(req.headers['if-none-match']===etag){res.writeHead(304,headers).end();return true;}
 res.writeHead(200,{...headers,'Content-Length':row.image.length});res.end(req.method==='HEAD'?undefined:row.image);return true;
}
module.exports={SIZE,MAX_BYTES,PATH,readImage,normalize,store,serve,avatarPath};
