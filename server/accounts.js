'use strict';

const crypto=require('node:crypto');
const {isIP}=require('node:net');
const {hash,verify,Algorithm}=require('@node-rs/argon2');
const {createMailer}=require('./mailer');
const COOKIE='azhi_session',CSRF_COOKIE='azhi_csrf',OAUTH_COOKIE='azhi_oauth';
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
 return {id:row.id,uid:row.id,nickname:row.display_name,avatar:row.avatar,email:row.email,
  emailVerified:row.email_verified,status:row.status,preferences:row.preferences||{},createdAt:row.created_at,lastLoginAt:row.last_login_at};
}
function email(value){
 if(typeof value!=='string')return null;const v=value.trim().toLowerCase();
 return v.length<=254&&/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(v)?v:null;
}
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

function createAccounts({db,env=process.env,mailer=createMailer({env})}={}){
 const oauthStates=new Map();
 let configuredOrigin=null,configurationError=false;
 if(env.APP_ORIGIN){try{const u=new URL(env.APP_ORIGIN);if(u.origin!==env.APP_ORIGIN.replace(/\/$/,'')||u.username||u.password||u.search||u.hash||!['http:','https:'].includes(u.protocol))throw 0;
   const local=['127.0.0.1','localhost','[::1]'].includes(u.hostname);if(u.protocol!=='https:'&&!local)throw 0;configuredOrigin=u.origin;
  }catch{configurationError=true;}}
 else if(env.NODE_ENV==='production')configurationError=true;
 const googleReady=Boolean(configuredOrigin&&env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET);
 function origin(req){
  if(configurationError)throw error(503,'ACCOUNT_CONFIGURATION','請先設定有效的 HTTPS APP_ORIGIN');
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
 function capabilities(){return {accounts:!!db&&!configurationError,email:{enabled:!!mailer.ready,reason:mailer.ready?null:'SMTP_NOT_CONFIGURED'},google:{enabled:googleReady},password:{minLength:12,maxLength:128},avatars:[...AVATARS]};}
 function requireMail(){if(!mailer.ready)throw error(503,'EMAIL_UNAVAILABLE','Email 服務尚未設定，請管理者設定 SMTP 後再試');}
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
 async function requireUser(req,{verified=false}={}){
  const auth=await authenticateRequest(req);if(!auth)throw error(401,'LOGIN_REQUIRED','請先登入');
  if(verified&&!auth.user.emailVerified)throw error(403,'EMAIL_VERIFICATION_REQUIRED','請先完成 Email 驗證');return auth;
 }
 function validateCsrf(req,auth){checkOrigin(req);const v=req.headers['x-csrf-token'];if(!auth||!validToken(v)||!safeEqual(sha(v),auth.session.csrfHash))throw error(403,'CSRF_REJECTED','安全驗證已過期，請重新整理');return true;}
 async function issueSession(client,userId){
  const sessionToken=token(),csrfToken=token();
  await client.query('INSERT INTO sessions(token_hash,user_id,csrf_hash,expires_at) VALUES($1,$2,$3,$4)',[sha(sessionToken),userId,sha(csrfToken),new Date(Date.now()+SESSION_MS)]);
  await client.query(`UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL AND token_hash IN
   (SELECT token_hash FROM sessions WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at DESC OFFSET 5)`,[userId]);
  return {sessionToken,csrfToken};
 }
 async function sendToken(req,user,kind){
  const value=token(),expires=new Date(Date.now()+(kind==='verify_email'?86400000:1800000));
  await db.transaction(async client=>{
   await client.query('UPDATE auth_tokens SET consumed_at=now() WHERE user_id=$1 AND kind=$2 AND consumed_at IS NULL',[user.id,kind]);
   await client.query('INSERT INTO auth_tokens(token_hash,user_id,kind,expires_at) VALUES($1,$2,$3,$4)',[sha(value),user.id,kind,expires]);
  });
  try{await mailer.send({to:user.email,kind,url:`${origin(req)}/#${kind==='verify_email'?'verify-email':'reset-password'}=${encodeURIComponent(value)}`});}
  catch{await db.query('UPDATE auth_tokens SET consumed_at=now() WHERE token_hash=$1',[sha(value)]);throw error(503,'EMAIL_DELIVERY_FAILED','Email 暫時無法寄送，請稍後重試');}
 }
 async function register(req,res,input){
  requireMail();const mail=email(input.email),name=nickname(input.nickname);
  await rate(req,'register',mail,{ipLimit:15,accountLimit:5,seconds:3600});
  if(!mail||!name||!password(input.password))throw error(400,'INVALID_REGISTRATION','請輸入有效 Email、2–16 字暱稱及 12–128 字密碼');
  const passwordHash=await hash(input.password,PASSWORD_OPTIONS);
  const created=await db.query(`INSERT INTO users(id,email,password_hash,display_name,avatar) VALUES($1,$2,$3,$4,'azhi') ON CONFLICT(email) DO NOTHING RETURNING id,email`,[crypto.randomUUID(),mail,passwordHash,name]);
  if(created.rows[0]){try{await sendToken(req,created.rows[0],'verify_email');}catch(err){if(err.code!=='EMAIL_DELIVERY_FAILED')throw err;console.error('[mail] verification delivery unavailable');}}
  json(res,202,{message:'若此 Email 可用，驗證信將寄至信箱；已註冊可直接登入或重設密碼。'});
 }
 async function login(req,res,input){
  const mail=email(input.email);await rate(req,'login',mail||'invalid');
  const found=mail?await db.query('SELECT * FROM users WHERE email=$1',[mail]):{rows:[]},user=found.rows[0];
  const encoded=user?.password_hash||await getDummyHash();let valid=false;
  try{valid=await verify(encoded,typeof input.password==='string'&&Buffer.byteLength(input.password)<=512?input.password:'');}catch{}
  if(!valid||!user||user.status!=='active')throw error(401,'INVALID_CREDENTIALS','Email 或密碼不正確');
  const session=await db.transaction(async client=>{const fresh=(await client.query('SELECT password_hash,status FROM users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];if(!fresh||fresh.status!=='active'||fresh.password_hash!==user.password_hash)throw error(401,'INVALID_CREDENTIALS','Email 或密碼不正確');await client.query('UPDATE users SET last_login_at=now() WHERE id=$1',[user.id]);return issueSession(client,user.id);});
  setSessionCookies(req,res,session.sessionToken,session.csrfToken);user.last_login_at=new Date();json(res,200,{user:publicUser(user),csrfToken:session.csrfToken});
 }
 async function consumeToken(req,res,input,kind){
  await rate(req,kind,null,{ipLimit:20});if(!validToken(input.token))throw error(400,'INVALID_TOKEN','連結無效或已過期');
  if(kind==='reset_password'&&!password(input.password))throw error(400,'WEAK_PASSWORD','密碼需為 12–128 字');
  const passwordHash=kind==='reset_password'?await hash(input.password,PASSWORD_OPTIONS):null;
  await db.transaction(async client=>{
   const result=await client.query(`UPDATE auth_tokens SET consumed_at=now() WHERE token_hash=$1 AND kind=$2 AND consumed_at IS NULL AND expires_at>now() RETURNING user_id`,[sha(input.token),kind]);
   const id=result.rows[0]?.user_id;if(!id)throw error(400,'INVALID_TOKEN','連結無效或已過期');
   const user=await client.query(`SELECT id FROM users WHERE id=$1 AND status='active' FOR UPDATE`,[id]);if(!user.rows.length)throw error(400,'INVALID_TOKEN','連結無效或已過期');
   if(kind==='verify_email')await client.query('UPDATE users SET email_verified=true,updated_at=now() WHERE id=$1',[id]);
   else{
    await client.query('UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1',[id,passwordHash]);
    await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[id]);
    await client.query("UPDATE auth_tokens SET consumed_at=now() WHERE user_id=$1 AND kind='reset_password' AND consumed_at IS NULL",[id]);
   }
  });
  if(kind==='reset_password')clearSessionCookies(req,res);json(res,200,{ok:true});
 }
 async function forgot(req,res,input){
  requireMail();const mail=email(input.email);await rate(req,'forgot',mail||'invalid',{ipLimit:15,accountLimit:4,seconds:3600});
  if(!mail)throw error(400,'INVALID_EMAIL','請輸入有效 Email');
  const result=await db.query("SELECT id,email FROM users WHERE email=$1 AND status='active'",[mail]);
  if(result.rows[0]){try{await sendToken(req,result.rows[0],'reset_password');}catch(err){if(err.code!=='EMAIL_DELIVERY_FAILED')throw err;console.error('[mail] reset delivery unavailable');}}
  json(res,202,{message:'若此 Email 已註冊，重設密碼連結將寄至信箱。'});
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
 async function googleStart(req,res){
  if(!googleReady)throw error(503,'GOOGLE_NOT_CONFIGURED','Google 登入尚未設定');checkOrigin(req);await rate(req,'google',null,{ipLimit:20});
  const state=token(),verifier=token(),nonce=token(),binding=token();
  for(const [k,v]of oauthStates)if(v.expiresAt<Date.now())oauthStates.delete(k);
  if(oauthStates.size>=1000)throw error(503,'OAUTH_BUSY','登入服務忙碌，請稍後再試');
  oauthStates.set(sha(state),{verifier,nonce,binding:sha(binding),expiresAt:Date.now()+600000});
  res.setHeader('Set-Cookie',cookie(req,OAUTH_COOKIE,binding,600));
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [k,v]of Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:`${configuredOrigin}/api/auth/google/callback`,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'}))u.searchParams.set(k,v);
  res.writeHead(302,{Location:u.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}).end();
 }
 async function googleCallback(req,res,url){
  if(!googleReady)throw error(503,'GOOGLE_NOT_CONFIGURED','Google 登入尚未設定');
  const state=url.searchParams.get('state'),code=url.searchParams.get('code'),key=sha(state),pending=oauthStates.get(key);oauthStates.delete(key);
  const binding=cookies(req)[OAUTH_COOKIE];res.setHeader('Set-Cookie',cookie(req,OAUTH_COOKIE,'',0));
  if(!validToken(state)||!validToken(binding)||!pending||pending.expiresAt<Date.now()||!safeEqual(sha(binding),pending.binding)||!code||code.length>2048)throw error(400,'OAUTH_STATE','Google 登入已過期，請重新開始');
  const reply=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:`${configuredOrigin}/api/auth/google/callback`,grant_type:'authorization_code',code_verifier:pending.verifier}),signal:AbortSignal.timeout(10000)});
  if(!reply.ok)throw error(400,'OAUTH_FAILED','Google 登入失敗，請重新開始');const tokens=await reply.json();
  const {createRemoteJWKSet,jwtVerify}=await import('jose');
  const {payload}=await jwtVerify(tokens.id_token,createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')),{issuer:['https://accounts.google.com','accounts.google.com'],audience:env.GOOGLE_CLIENT_ID,algorithms:['RS256'],clockTolerance:5});
  const mail=email(payload.email);if(!mail||payload.email_verified!==true||payload.nonce!==pending.nonce||typeof payload.sub!=='string')throw error(400,'OAUTH_IDENTITY','Google 帳號尚未驗證');
  const result=await db.transaction(async client=>{
   const existing=await client.query("SELECT u.* FROM oauth_identities o JOIN users u ON u.id=o.user_id WHERE o.provider='google' AND o.subject=$1 FOR UPDATE",[payload.sub]);
   let user=existing.rows[0];
   if(!user){
    const byEmail=await client.query('SELECT * FROM users WHERE email=$1 FOR UPDATE',[mail]);user=byEmail.rows[0];
    if(user&&!user.email_verified)throw error(409,'OAUTH_VERIFY_EXISTING','請先驗證原帳號 Email 或重設密碼，再使用 Google 登入');
    if(!user){const display=nickname(payload.name)||`選手${crypto.randomBytes(3).toString('hex')}`;
     user=(await client.query("INSERT INTO users(id,email,display_name,email_verified,avatar) VALUES($1,$2,$3,true,'azhi') RETURNING *",[crypto.randomUUID(),mail,display])).rows[0];}
    await client.query("INSERT INTO oauth_identities(provider,subject,user_id,email_at_link) VALUES('google',$1,$2,$3)",[payload.sub,user.id,mail]);
   }
   if(user.status!=='active')throw error(403,'ACCOUNT_DISABLED','帳號無法登入');await client.query('UPDATE users SET last_login_at=now() WHERE id=$1',[user.id]);
   return issueSession(client,user.id);
  });
  setSessionCookies(req,res,result.sessionToken,result.csrfToken);res.setHeader('Set-Cookie',[...res.getHeader('Set-Cookie'),cookie(req,OAUTH_COOKIE,'',0)]);
  res.writeHead(302,{Location:`${configuredOrigin}/#account`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}).end();
 }
 async function handle(req,res){
  let url;try{url=new URL(req.url,'http://localhost');}catch{return false;}
  const pathname=url.pathname;
  if(!pathname.startsWith('/api/auth/')&&pathname!=='/api/profile')return false;
  try{
   if(pathname==='/api/auth/capabilities'&&req.method==='GET'){json(res,200,capabilities());return true;}
   if(pathname==='/api/auth/me'&&req.method==='GET'){const auth=await authenticateRequest(req);json(res,200,{user:auth?.user||null,csrfToken:auth?.csrfToken||null,capabilities:capabilities()});return true;}
   if(!db)throw error(503,'DATABASE_UNAVAILABLE','帳號資料庫尚未設定');origin(req);
   if(pathname==='/api/auth/google'&&req.method==='GET'){await googleStart(req,res);return true;}
   if(pathname==='/api/auth/google/callback'&&req.method==='GET'){await googleCallback(req,res,url);return true;}
   if(pathname==='/api/profile'&&req.method==='GET'){await profile(req,res);return true;}
   if(!['POST','PATCH'].includes(req.method))throw error(405,'METHOD_NOT_ALLOWED','不支援此操作');
   checkOrigin(req);const input=await body(req);
   if(pathname==='/api/profile'&&req.method==='PATCH')await profile(req,res,input);
   else if(pathname==='/api/auth/register'&&req.method==='POST')await register(req,res,input);
   else if(pathname==='/api/auth/login'&&req.method==='POST')await login(req,res,input);
   else if(pathname==='/api/auth/verify-email'&&req.method==='POST')await consumeToken(req,res,input,'verify_email');
   else if(pathname==='/api/auth/forgot-password'&&req.method==='POST')await forgot(req,res,input);
   else if(pathname==='/api/auth/reset-password'&&req.method==='POST')await consumeToken(req,res,input,'reset_password');
   else if(pathname==='/api/auth/logout'&&req.method==='POST'){
    const auth=await requireUser(req);validateCsrf(req,auth);await db.query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1',[auth.session.tokenHash]);clearSessionCookies(req,res);json(res,200,{ok:true});
   }else if(pathname==='/api/auth/resend-verification'&&req.method==='POST'){
    const auth=await requireUser(req);validateCsrf(req,auth);requireMail();await rate(req,'resend',auth.user.email,{ipLimit:10,accountLimit:3,seconds:3600});
    if(!auth.user.emailVerified)await sendToken(req,auth.user,'verify_email');json(res,202,{message:'若帳號尚未驗證，驗證信將寄至信箱。'});
   }else throw error(404,'NOT_FOUND','找不到此功能');
  }catch(err){
   const status=Number.isInteger(err.status)?err.status:500;
   if(pathname==='/api/auth/google/callback'&&googleReady){res.writeHead(302,{Location:`${configuredOrigin}/#auth-error=${encodeURIComponent(status===500?'OAUTH_FAILED':err.code)}`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}).end();}
   else json(res,status,{error:{code:status===500?'ACCOUNT_UNAVAILABLE':err.code,message:status===500?'帳號服務暫時無法使用':err.message}});
  }
  return true;
 }
 return {handle,authenticateRequest,requireUser,validateCsrf,capabilities,close(){oauthStates.clear();mailer.close?.();}};
}

module.exports={createAccounts};
