'use strict';

const crypto=require('node:crypto');
const {isIP}=require('node:net');
const {hash,verify,Algorithm}=require('@node-rs/argon2');
const COOKIE='azhi_session',CSRF_COOKIE='azhi_csrf';
const AVATARS=new Set(['azhi','sezi','gambler','winnie']);
const PASSWORD_OPTIONS={algorithm:Algorithm.Argon2id,memoryCost:65536,timeCost:3,parallelism:1,outputLen:32};
const SESSION_MS=7*24*60*60*1000;
const sha=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const token=()=>crypto.randomBytes(32).toString('base64url');
const error=(status,code,message)=>Object.assign(new Error(message),{status,code});
let dummyHash;
function getDummyHash(){return dummyHash||(dummyHash=hash(crypto.randomBytes(32),PASSWORD_OPTIONS));}
function safeEqual(a,b){return typeof a==='string'&&typeof b==='string'&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function cookies(req){
 const out={};for(const part of String(req.headers.cookie||'').split(';')){
  const at=part.indexOf('=');if(at>0){const key=part.slice(0,at).trim();if(!Object.hasOwn(out,key))out[key]=part.slice(at+1).trim();}
 }return out;
}
function publicUser(row){
 return {id:row.id,uid:row.id,username:row.username,nickname:row.display_name,avatar:row.avatar,
  hasRecoveryCode:!!row.recovery_code_hash,status:row.status,preferences:row.preferences||{},createdAt:row.created_at,lastLoginAt:row.last_login_at};
}
function username(value){if(typeof value!=='string')return null;const v=value.trim().toLowerCase();return /^[a-z0-9_]{3,32}$/.test(v)?v:null;}
function recoveryCode(){return 'AZHI-'+crypto.randomBytes(24).toString('hex').toUpperCase().match(/.{8}/g).join('-');}
function recoveryHash(value){if(typeof value!=='string'||value.length>100)return null;const v=value.toUpperCase().replace(/[-\s]/g,'');return /^AZHI[A-F0-9]{48}$/.test(v)?sha(v):null;}
function nickname(value){
 if(typeof value!=='string')return null;const v=value.normalize('NFKC').trim().replace(/\s+/gu,' '),length=Array.from(v).length;
 return length>=2&&length<=16&&/^[\p{L}\p{N} _.-]+$/u.test(v)&&!/^(admin|administrator|moderator|staff|system|官方|管理員|系統|客服)$/iu.test(v)?v:null;
}
function password(value){return typeof value==='string'&&Array.from(value).length>=12&&Array.from(value).length<=128&&Buffer.byteLength(value)<=512;}
function validToken(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);}
function preferences(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw error(400,'INVALID_PREFERENCES','偏好設定格式不正確');
 const allowed={region:v=>['auto','asia','europe','americas','oceania'].includes(v),preferredCharacter:v=>AVATARS.has(v),
  reducedMotion:v=>typeof v==='boolean',language:v=>['zh-TW','en'].includes(v)};
 const out={};for(const [key,v]of Object.entries(value)){
  if(!Object.hasOwn(allowed,key)||!allowed[key](v))throw error(400,'INVALID_PREFERENCES','偏好設定含不支援的內容');out[key]=v;
 }return out;
}
async function body(req){
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw error(415,'JSON_REQUIRED','請使用 JSON 格式');
 let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>8192)throw error(413,'BODY_TOO_LARGE','請求內容過大');parts.push(chunk);}
 try{const value=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw 0;return value;}
 catch{throw error(400,'INVALID_JSON','JSON 格式不正確');}
}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});res.end(JSON.stringify(value));}

function createAccounts({db,env=process.env}={}){
 let configuredOrigin=null,configurationError=false;
 if(env.APP_ORIGIN){try{const u=new URL(env.APP_ORIGIN);if(u.origin!==env.APP_ORIGIN.replace(/\/$/,'')||u.username||u.password||u.search||u.hash||!['http:','https:'].includes(u.protocol))throw 0;
   const local=['127.0.0.1','localhost','[::1]'].includes(u.hostname);if(u.protocol!=='https:'&&!local&&env.ALLOW_INSECURE_HTTP!=='true')throw 0;configuredOrigin=u.origin;
  }catch{configurationError=true;}}
 else if(env.NODE_ENV==='production')configurationError=true;
 function origin(req){
  if(configurationError)throw error(503,'ACCOUNT_CONFIGURATION','請設定 APP_ORIGIN；使用公網 HTTP 需明確設定 ALLOW_INSECURE_HTTP=true');
  if(configuredOrigin)return configuredOrigin;
  try{const u=new URL(`http://${req.headers.host}`);if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname))throw 0;return u.origin;}
  catch{throw error(503,'ACCOUNT_CONFIGURATION','請先設定 APP_ORIGIN');}
 }
 function checkOrigin(req){
  const expected=origin(req),supplied=req.headers.origin;
  if(supplied){try{if(new URL(supplied).origin!==expected||supplied==='null')throw 0;}catch{throw error(403,'ORIGIN_REJECTED','請從遊戲網站操作');}}
  else if(req.headers['sec-fetch-site']==='cross-site')throw error(403,'ORIGIN_REJECTED','請從遊戲網站操作');
 }
 function cookie(req,name,value,maxAge=SESSION_MS/1000){return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${origin(req).startsWith('https:')?'; Secure':''}`;}
 function setSessionCookies(req,res,sessionToken,csrfToken){res.setHeader('Set-Cookie',[cookie(req,COOKIE,sessionToken),cookie(req,CSRF_COOKIE,csrfToken)]);}
 function clearSessionCookies(req,res){res.setHeader('Set-Cookie',[cookie(req,COOKIE,'',0),cookie(req,CSRF_COOKIE,'',0)]);}
 function capabilities(){return {accounts:!!db&&!configurationError,authMethod:'username',recovery:{enabled:true,oneTime:true},transport:{encrypted:!!configuredOrigin?.startsWith('https:'),insecureHttp:!!configuredOrigin?.startsWith('http:')},password:{minLength:12,maxLength:128},avatars:[...AVATARS]};}
 async function rate(req,purpose,account,{ipLimit=30,accountLimit=10,seconds=900}={}){
  // Deliberately use the TCP peer. Never trust arbitrary X-Forwarded-For. A proxy
  // can configure a separate trusted real-IP transport at deployment time.
  const peer=req.socket?.remoteAddress||'unknown',forwarded=req.headers['x-real-ip'];
  const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer);
  const address=env.TRUST_PROXY_LOOPBACK==='true'&&loopback&&typeof forwarded==='string'&&isIP(forwarded)?forwarded:peer;
  for(const [key,limit]of [[`ip:${purpose}:${sha(address)}`,ipLimit],...(account?[[`account:${purpose}:${sha(account)}`,accountLimit]]:[])]){
   const r=await db.query(`INSERT INTO auth_rate_limits(key,window_started_at,attempts,last_attempt_at) VALUES($1,now(),1,now())
    ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_rate_limits.window_started_at<now()-($2::int*interval '1 second') THEN 1 ELSE auth_rate_limits.attempts+1 END,
    window_started_at=CASE WHEN auth_rate_limits.window_started_at<now()-($2::int*interval '1 second') THEN now() ELSE auth_rate_limits.window_started_at END,last_attempt_at=now() RETURNING attempts`,[key,seconds]);
   if(r.rows[0].attempts>limit)throw error(429,'RATE_LIMITED','嘗試次數過多，請稍後再試');
  }
 }
 async function authenticateRequest(req){
  if(!db)return null;const sessionToken=cookies(req)[COOKIE];if(!validToken(sessionToken))return null;
  const result=await db.query(`SELECT u.*,s.token_hash,s.csrf_hash,s.expires_at,s.created_at AS session_created_at FROM sessions s JOIN users u ON u.id=s.user_id
   WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active'`,[sha(sessionToken)]);
  if(!result.rows.length)return null;const row=result.rows[0],csrfToken=cookies(req)[CSRF_COOKIE];
  return {user:publicUser(row),session:{tokenHash:row.token_hash,csrfHash:row.csrf_hash,expiresAt:row.expires_at},
   csrfToken:validToken(csrfToken)&&safeEqual(sha(csrfToken),row.csrf_hash)?csrfToken:null};
 }
 async function requireUser(req){const auth=await authenticateRequest(req);if(!auth)throw error(401,'LOGIN_REQUIRED','請先登入有效玩家帳號');return auth;}
 function validateCsrf(req,auth){checkOrigin(req);const v=req.headers['x-csrf-token'];if(!auth||!validToken(v)||!safeEqual(sha(v),auth.session.csrfHash))throw error(403,'CSRF_REJECTED','安全驗證已過期，請重新整理');return true;}
 async function issueSession(client,userId){
  const sessionToken=token(),csrfToken=token();
  await client.query('INSERT INTO sessions(token_hash,user_id,csrf_hash,expires_at) VALUES($1,$2,$3,$4)',[sha(sessionToken),userId,sha(csrfToken),new Date(Date.now()+SESSION_MS)]);
  await client.query(`UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL AND token_hash IN
   (SELECT token_hash FROM sessions WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at DESC OFFSET 5)`,[userId]);
  return {sessionToken,csrfToken};
 }
 async function register(req,res,input){
  const account=username(input.username),name=nickname(input.nickname);
  await rate(req,'register',account||'invalid',{ipLimit:15,accountLimit:5,seconds:3600});
  if(!account||!name||!password(input.password)||Object.hasOwn(input,'email'))throw error(400,'INVALID_REGISTRATION','帳號需為 3–32 位英文字母、數字或底線；暱稱 2–16 字，密碼 12–128 字');
  const passwordHash=await hash(input.password,PASSWORD_OPTIONS),code=recoveryCode();
  const result=await db.transaction(async client=>{
   const created=await client.query(`INSERT INTO users(id,username,password_hash,display_name,avatar,recovery_code_hash,recovery_issued_at) VALUES($1,$2,$3,$4,'azhi',$5,now()) ON CONFLICT(username) DO NOTHING RETURNING *`,[crypto.randomUUID(),account,passwordHash,name,recoveryHash(code)]);
   if(!created.rows[0])throw error(409,'USERNAME_UNAVAILABLE','此玩家帳號無法使用，請換一個');
   return {user:created.rows[0],session:await issueSession(client,created.rows[0].id)};
  });
  setSessionCookies(req,res,result.session.sessionToken,result.session.csrfToken);json(res,201,{user:publicUser(result.user),csrfToken:result.session.csrfToken,recoveryCode:code});
 }
 async function login(req,res,input){
  // Existing email-based password accounts retain a migration-only login alias.
  // It is never required for new accounts or returned by public/account APIs.
  const value=typeof input.username==='string'?input.username.trim().toLowerCase():'',account=username(value),legacy=value.length<=254&&value.includes('@')?value:null;
  await rate(req,'login',account||legacy||'invalid');
  const found=account||legacy?await db.query('SELECT * FROM users WHERE username=$1 OR (email IS NOT NULL AND email=$2)',[account,legacy]):{rows:[]},user=found.rows[0];
  const encoded=user?.password_hash||await getDummyHash();let valid=false;
  try{valid=await verify(encoded,typeof input.password==='string'&&Buffer.byteLength(input.password)<=512?input.password:'');}catch{}
  if(!valid||!user||user.status!=='active')throw error(401,'INVALID_CREDENTIALS','玩家帳號或密碼不正確');
  const session=await db.transaction(async client=>{const fresh=(await client.query('SELECT password_hash,status FROM users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];if(!fresh||fresh.status!=='active'||fresh.password_hash!==user.password_hash)throw error(401,'INVALID_CREDENTIALS','玩家帳號或密碼不正確');await client.query('UPDATE users SET last_login_at=now() WHERE id=$1',[user.id]);return issueSession(client,user.id);});
  setSessionCookies(req,res,session.sessionToken,session.csrfToken);user.last_login_at=new Date();json(res,200,{user:publicUser(user),csrfToken:session.csrfToken});
 }
 async function resetPassword(req,res,input){
  const account=username(input.username),supplied=recoveryHash(input.recoveryCode);
  await rate(req,'recovery',account||'invalid',{ipLimit:15,accountLimit:5,seconds:3600});
  if(!password(input.password))throw error(400,'WEAK_PASSWORD','密碼需為 12–128 字');
  if(!account||!supplied)throw error(400,'INVALID_RECOVERY','帳號或救援碼不正確，或救援碼已使用');
  const encoded=await hash(input.password,PASSWORD_OPTIONS),replacement=recoveryCode();
  await db.transaction(async client=>{
   const user=(await client.query('SELECT id,status,recovery_code_hash FROM users WHERE username=$1 FOR UPDATE',[account])).rows[0];
   if(!user||user.status!=='active'||!safeEqual(user.recovery_code_hash,supplied))throw error(400,'INVALID_RECOVERY','帳號或救援碼不正確，或救援碼已使用');
   await client.query('UPDATE users SET password_hash=$2,recovery_code_hash=$3,recovery_issued_at=now(),updated_at=now() WHERE id=$1',[user.id,encoded,recoveryHash(replacement)]);
   await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[user.id]);
  });
  clearSessionCookies(req,res);json(res,200,{ok:true,recoveryCode:replacement});
 }
 async function rotateRecovery(req,res,input){
  const auth=await requireUser(req);validateCsrf(req,auth);await rate(req,'rotate_recovery',auth.user.id,{ipLimit:15,accountLimit:5,seconds:3600});
  const user=(await db.query('SELECT password_hash FROM users WHERE id=$1',[auth.user.id])).rows[0];let valid=false;
  try{valid=await verify(user?.password_hash||await getDummyHash(),typeof input.password==='string'&&Buffer.byteLength(input.password)<=512?input.password:'');}catch{}
  if(!valid)throw error(401,'INVALID_PASSWORD','目前密碼不正確');
  const code=recoveryCode();await db.transaction(async client=>{const fresh=(await client.query('SELECT status,password_hash FROM users WHERE id=$1 FOR UPDATE',[auth.user.id])).rows[0];if(!fresh||fresh.status!=='active'||fresh.password_hash!==user.password_hash)throw error(401,'INVALID_PASSWORD','目前密碼不正確');await client.query('UPDATE users SET recovery_code_hash=$2,recovery_issued_at=now(),updated_at=now() WHERE id=$1',[auth.user.id,recoveryHash(code)]);});
  json(res,200,{ok:true,recoveryCode:code});
 }
 async function profile(req,res,input){
  const auth=await requireUser(req);if(req.method==='GET'){json(res,200,{user:auth.user});return;}
  validateCsrf(req,auth);
  if(Object.keys(input).some(k=>!['nickname','avatar','preferences'].includes(k)))throw error(400,'PROFILE_FIELDS','只可修改暱稱、頭像與偏好設定');
  const name=input.nickname===undefined?auth.user.nickname:nickname(input.nickname),avatar=input.avatar===undefined?auth.user.avatar:input.avatar;
  if(!name||!AVATARS.has(avatar))throw error(400,'INVALID_PROFILE','暱稱或頭像不正確');
  const prefs=input.preferences===undefined?auth.user.preferences:preferences(input.preferences);
  const r=await db.query('UPDATE users SET display_name=$2,avatar=$3,preferences=$4,updated_at=now() WHERE id=$1 RETURNING *',[auth.user.id,name,avatar,JSON.stringify(prefs)]);
  json(res,200,{user:publicUser(r.rows[0])});
 }
 async function handle(req,res){
  let url;try{url=new URL(req.url,'http://localhost');}catch{return false;}
  const pathname=url.pathname;
  if(!pathname.startsWith('/api/auth/')&&pathname!=='/api/profile')return false;
  try{
   if(pathname==='/api/auth/capabilities'&&req.method==='GET'){json(res,200,capabilities());return true;}
   if(pathname==='/api/auth/me'&&req.method==='GET'){const auth=await authenticateRequest(req);json(res,200,{user:auth?.user||null,csrfToken:auth?.csrfToken||null,capabilities:capabilities()});return true;}
   if(!['/api/profile','/api/auth/register','/api/auth/login','/api/auth/reset-password','/api/auth/recovery-code','/api/auth/logout'].includes(pathname))throw error(404,'NOT_FOUND','找不到此功能');
   if(!db)throw error(503,'DATABASE_UNAVAILABLE','帳號資料庫尚未設定');origin(req);
   if(pathname==='/api/profile'&&req.method==='GET'){await profile(req,res);return true;}
   if(!['POST','PATCH'].includes(req.method))throw error(405,'METHOD_NOT_ALLOWED','不支援此操作');
   checkOrigin(req);const input=await body(req);
   if(pathname==='/api/profile'&&req.method==='PATCH')await profile(req,res,input);
   else if(pathname==='/api/auth/register'&&req.method==='POST')await register(req,res,input);
   else if(pathname==='/api/auth/login'&&req.method==='POST')await login(req,res,input);
   else if(pathname==='/api/auth/reset-password'&&req.method==='POST')await resetPassword(req,res,input);
   else if(pathname==='/api/auth/recovery-code'&&req.method==='POST')await rotateRecovery(req,res,input);
   else if(pathname==='/api/auth/logout'&&req.method==='POST'){
    const auth=await requireUser(req);validateCsrf(req,auth);await db.query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1',[auth.session.tokenHash]);clearSessionCookies(req,res);json(res,200,{ok:true});
   }else throw error(404,'NOT_FOUND','找不到此功能');
  }catch(err){
   const status=Number.isInteger(err.status)?err.status:500;
   json(res,status,{error:{code:status===500?'ACCOUNT_UNAVAILABLE':err.code,message:status===500?'帳號服務暫時無法使用':err.message}});
  }
  return true;
 }
 return {handle,authenticateRequest,requireUser,validateCsrf,capabilities,close(){}};
}

module.exports={createAccounts};
