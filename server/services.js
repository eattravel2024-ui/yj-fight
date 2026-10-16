'use strict';
const {createDatabase}=require('./db');
const {createAccounts}=require('./accounts');
const {createCompetition}=require('./ranked');
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(value));}
function createServices({env=process.env,mailer}={}){
 const db=env.DATABASE_URL?createDatabase({connectionString:env.DATABASE_URL}):null;
 const accounts=createAccounts({db,env,mailer});const competition=db?createCompetition({db}):null;
 let failure=null;
 const ready=(async()=>{if(!db)return;if(env.AZHI_AUTO_MIGRATE==='1'&&env.NODE_ENV!=='production')await db.migrate();await db.query('SELECT 1 FROM schema_migrations LIMIT 1');await db.query('SELECT 1 FROM casual_ratings LIMIT 1');await competition.recoverInterruptedMatches();await db.query('DELETE FROM matchmaking_queue');})().catch(err=>{failure=err;console.error('[online] database initialization failed:',err.code||err.name);});
 async function handle(req,res){
  const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/'))return false;await ready;
  if(failure){json(res,503,{error:{code:'DATABASE_UNAVAILABLE',message:'玩家資料庫暫時無法使用'}});return true;}
  if(await accounts.handle(req,res))return true;
  try{
   if(req.method!=='GET')throw Object.assign(new Error('不支援此操作'),{status:405,code:'METHOD_NOT_ALLOWED'});
   if(!competition)throw Object.assign(new Error('線上競技尚未設定資料庫'),{status:503,code:'ONLINE_NOT_CONFIGURED'});
   const route=url.pathname;let result;
   if(['/api/player/me','/api/players/me'].includes(route)){const auth=await accounts.requireUser(req);result=await competition.getPlayer(auth.user.id);}
   else if(['/api/player/history','/api/history','/api/profile/history'].includes(route)){const auth=await accounts.requireUser(req);result=await competition.history(auth.user.id,{limit:url.searchParams.get('limit')||20,before:url.searchParams.get('cursor')||url.searchParams.get('before')||undefined});}
   else if(['/api/player/seasons','/api/seasons'].includes(route)){const auth=await accounts.requireUser(req);result=await competition.seasons(auth.user.id);}
   else if(route==='/api/leaderboard'){const auth=await accounts.authenticateRequest(req);result=await competition.leaderboard({seasonId:url.searchParams.get('season')||undefined,page:url.searchParams.get('page')||1,query:url.searchParams.get('search')||'',eliteOnly:url.searchParams.get('elite')==='1',userId:auth?.user.id});}
   else if(route==='/api/competition/status')result={online:true,season:await competition.currentSeason(),reconnectGraceMs:30000};
   else if(/^\/api\/players\/[a-f\d-]{36}$/i.test(route))result=await competition.getPlayer(route.split('/').pop());
   else throw Object.assign(new Error('找不到此功能'),{status:404,code:'NOT_FOUND'});
   json(res,200,result);
  }catch(err){json(res,err.status||500,{error:{code:err.status?err.code:'SERVICE_UNAVAILABLE',message:err.status?err.message:'玩家服務暫時無法使用'}});}
  return true;
 }
 return {db,accounts,competition,ready,handle,get healthy(){return !failure;},async close(){accounts.close();await db?.close();}};
}
module.exports={createServices};
