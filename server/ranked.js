'use strict';
const crypto=require('node:crypto');
const Rules=require('../public/rank-rules');
const Stages=require('../public/stage-registry');
const CHARACTERS=new Set(['azhi','sezi','gambler','winnie']);
const MODES=new Set(['custom','quick','ranked']);
const DEFAULTS=Object.freeze({initialMmr:1000,initialRd:350,minRd:60,maxRd:350,rdDecay:.88,inactivityRdPerDay:4,kMin:16,kMax:48,placements:5,initialRpMaximum:1800,rpWinBase:28,rpLossBase:24,rpExpectationAdjustment:16,rpMinDelta:8,rpMaxDelta:45,newPlayerProtectionGames:10,newPlayerLossMultiplier:.5,seasonFinishGraceMs:15*60*1000,maxMatchAgeMs:30*60*1000});
class CompetitionError extends Error{constructor(code,message,status=400){super(message);this.name='CompetitionError';this.code=code;this.status=status;}}
const fail=(code,message,status)=>{throw new CompetitionError(code,message,status);};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const iso=value=>value?new Date(value).toISOString():null;
const int=value=>Number(value)||0;
const publicSeason=row=>row?{id:row.id,name:row.name,status:row.status,startsAt:iso(row.starts_at),endsAt:iso(row.ends_at)}:null;
function validateConfig(config={}){
 const c={...DEFAULTS,...config};
 for(const key of Object.keys(DEFAULTS))if(!Number.isFinite(c[key])||c[key]<0)throw new TypeError('Invalid competition configuration: '+key);
 if(c.placements!==5||c.initialRd<c.minRd||c.maxRd<c.initialRd||c.rdDecay<=0||c.rdDecay>=1||c.kMax<c.kMin||c.newPlayerLossMultiplier>1)throw new TypeError('Invalid competition rating configuration');
 return Object.freeze(c);
}
/* Mature Elo expected-score update, with a bounded uncertainty-derived K factor.
   RD contracts after games and grows with inactivity; it is never exposed publicly. */
function ratePair(a,b,score,{config={},now=Date.now()}={}){
 const c=validateConfig(config);if(![0,.5,1].includes(score))throw new TypeError('Invalid expected match score');
 function current(x){const days=x.last_played_at?Math.max(0,(now-new Date(x.last_played_at).getTime())/86400000):0;return {mmr:clamp(Number(x.mmr??c.initialMmr),0,10000),rd:clamp(Math.sqrt(Math.pow(Number(x.rd??c.initialRd),2)+Math.pow(days*c.inactivityRdPerDay,2)),c.minRd,c.maxRd)};}
 const ra=current(a),rb=current(b),expected=1/(1+Math.pow(10,(rb.mmr-ra.mmr)/400));
 function next(r,s,e){const k=c.kMin+(c.kMax-c.kMin)*(r.rd/c.maxRd);return {mmr:clamp(r.mmr+k*(s-e),0,10000),rd:clamp(r.rd*Math.sqrt(c.rdDecay),c.minRd,c.maxRd),expected:e};}
 return [next(ra,score,expected),next(rb,1-score,1-expected)];
}
function awardRating(previous,next,score,config={}){
 const c=validateConfig(config),beforeRp=int(previous.rp),beforePlacement=int(previous.placement_games),games=int(previous.wins)+int(previous.losses)+int(previous.draws),placementGames=Math.min(c.placements,beforePlacement+1);
 let rp=beforeRp;
 if(beforePlacement<c.placements){if(placementGames===c.placements)rp=clamp(Math.round((next.mmr-600)*1.5),0,c.initialRpMaximum);}
 else if(score!==.5){
  let change=score===1?c.rpWinBase+c.rpExpectationAdjustment*(.5-next.expected):-c.rpLossBase+c.rpExpectationAdjustment*(.5-next.expected);
  change=(change>=0?1:-1)*clamp(Math.round(Math.abs(change)),c.rpMinDelta,c.rpMaxDelta);
  if(score===0&&games<c.newPlayerProtectionGames)change=Math.ceil(change*c.newPlayerLossMultiplier);
  rp=Math.max(0,beforeRp+change);
 }
 const rank=Rules.rankFor(rp,placementGames),previousRank=Rules.rankFor(beforeRp,beforePlacement);
 const promotion=!previousRank&&rank?'placed':previousRank&&rank&&rank.minRp>previousRank.minRp?'promoted':previousRank&&rank&&rank.minRp<previousRank.minRp?'demoted':null;
 return {rp,placementGames,previousRank,rank,promotion,rpDelta:rp-beforeRp,peakRp:Math.max(int(previous.peak_rp),rp),streak:score===1?int(previous.streak)+1:0};
}
function createCompetition({db,config={},now=()=>Date.now()}={}){
 if(!db||typeof db.query!=='function'||typeof db.transaction!=='function')throw new TypeError('Competition requires a persistent database');
 const c=validateConfig(config),clock=()=>{const value=now();const ms=value instanceof Date?value.getTime():Number(value);if(!Number.isFinite(ms))throw new Error('Invalid competition clock');return ms;};
 const tx=fn=>db.transaction(fn);
 async function currentSeason(client=db){const {rows}=await client.query("SELECT * FROM seasons WHERE status='active' AND starts_at <= $1 AND ends_at > $1 ORDER BY starts_at DESC LIMIT 1",[new Date(clock())]);return publicSeason(rows[0]);}
 async function lockSeason(client,id){const {rows}=await client.query('SELECT * FROM seasons WHERE id=$1 FOR SHARE',[id]);return rows[0];}
 function liveSeason(season,time=clock()){return season&&season.status==='active'&&season.starts_at&&season.ends_at&&new Date(season.starts_at).getTime()<=time&&new Date(season.ends_at).getTime()>time;}
 async function participants(client,id){const {rows}=await client.query('SELECT p.*, u.display_name, u.avatar FROM match_participants p JOIN users u ON u.id=p.user_id WHERE p.match_id=$1 ORDER BY p.slot',[id]);return rows;}
 function publicParticipant(p){return {userId:p.user_id,displayName:p.display_name,avatar:p.avatar,slot:int(p.slot),character:p.character_id,outcome:p.outcome,rpBefore:p.rp_before===null?null:int(p.rp_before),rpAfter:p.rp_after===null?null:int(p.rp_after),rpDelta:p.rp_before===null||p.rp_after===null?null:int(p.rp_after)-int(p.rp_before)};}
 async function publicMatch(client,row){return {id:row.id,mode:row.mode,status:row.status,seasonId:row.season_id,stage:row.stage,seed:row.seed===null?null:Number(row.seed),startedAt:iso(row.started_at),endedAt:iso(row.ended_at),winnerSlot:row.winner_slot===null?null:int(row.winner_slot),reason:row.reason||row.invalid_reason||null,rounds:row.rounds,players:(await participants(client,row.id)).map(p=>({...publicParticipant(p),...(row.result?.players?.find(x=>x.slot===int(p.slot))||{})})),result:row.result};}
 function checkId(id){if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(id))fail('invalid_match','Invalid match ID');}
 function validateReservation(value){
  if(!value||!MODES.has(value.mode))fail('invalid_mode','Invalid competitive match mode');checkId(value.id);
  if(!Stages.playable(value.stage))fail('invalid_stage','This stage is not playable');
  if(!Array.isArray(value.participants)||value.participants.length!==2)fail('invalid_participants','A match requires two players');
  const ps=value.participants.map(p=>({userId:p?.userId,slot:p?.slot,char:p?.char})).sort((a,b)=>a.slot-b.slot);
  if(ps.some((p,i)=>typeof p.userId!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(p.userId)||p.slot!==i||!CHARACTERS.has(p.char))||ps[0].userId===ps[1].userId)fail('invalid_participants','Distinct valid accounts and fighter slots are required');
  if(value.seed!==undefined&&(!Number.isSafeInteger(value.seed)||value.seed<0||value.seed>4294967295))fail('invalid_seed','Invalid deterministic seed');return ps;
 }
 async function reserveMatch(value){const ps=validateReservation(value);return tx(async client=>{
  // Lock accounts in a stable order before acquiring per-player active-match rows.
  const {rows:users}=await client.query('SELECT id,status FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ps.map(p=>p.userId)]);
  if(users.length!==2||users.some(u=>u.status!=='active'))fail('account_unavailable','Both players must be active accounts',403);
  const found=await client.query('SELECT * FROM matches WHERE id=$1 FOR UPDATE',[value.id]);
  if(found.rows[0]){const row=found.rows[0],old=await participants(client,row.id);if(row.mode!==value.mode||row.stage!==value.stage||old.some((p,i)=>p.user_id!==ps[i].userId||int(p.slot)!==ps[i].slot||p.character_id!==ps[i].char)||old.length!==2)fail('match_id_conflict','Match ID is already in use',409);return {...await publicMatch(client,row),alreadyReserved:true};}
  let season=null;if(value.mode==='ranked'){const active=await currentSeason(client);if(!active)fail('season_closed','No ranked season is currently open',409);season=await lockSeason(client,active.id);if(!liveSeason(season))fail('season_closed','The ranked season is closed',409);}
  const seed=value.seed??crypto.randomInt(0,4294967296);
  const inserted=await client.query("INSERT INTO matches(id,mode,status,season_id,stage,seed,created_at) VALUES($1,$2,'preparing',$3,$4,$5,$6) RETURNING *",[value.id,value.mode,season?.id||null,value.stage,seed,new Date(clock())]);
  for(const p of [...ps].sort((a,b)=>a.userId.localeCompare(b.userId))){await client.query('INSERT INTO match_participants(match_id,user_id,slot,character_id) VALUES($1,$2,$3,$4)',[value.id,p.userId,p.slot,p.char]);const active=await client.query('INSERT INTO active_match_users(user_id,match_id) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING RETURNING user_id',[p.userId,value.id]);if(!active.rowCount)fail('player_busy','A player already belongs to another match',409);}
  return publicMatch(client,inserted.rows[0]);
 });}
 async function invalidateLocked(client,row,reason){
  await client.query("UPDATE matches SET status='invalid',invalid_reason=$2,ended_at=$3 WHERE id=$1 AND status IN ('preparing','running')",[row.id,reason,new Date(clock())]);
  await client.query("UPDATE match_participants SET outcome='invalid' WHERE match_id=$1",[row.id]);await client.query('DELETE FROM active_match_users WHERE match_id=$1',[row.id]);
  const updated=await client.query('SELECT * FROM matches WHERE id=$1',[row.id]);return {...await publicMatch(client,updated.rows[0]),alreadySettled:false};
 }
 async function startMatch(id){checkId(id);return tx(async client=>{const {rows}=await client.query('SELECT * FROM matches WHERE id=$1 FOR UPDATE',[id]);const row=rows[0];if(!row)fail('match_missing','Match not found',404);if(row.status==='running')return {...await publicMatch(client,row),alreadyStarted:true};if(row.status!=='preparing')fail('match_closed','This match is already closed',409);
  if(row.mode==='ranked'){const season=await lockSeason(client,row.season_id);if(!liveSeason(season))return invalidateLocked(client,row,'season_closed_before_start');}
  const {rows:users}=await client.query('SELECT u.status FROM users u JOIN match_participants p ON p.user_id=u.id WHERE p.match_id=$1',[id]);if(users.length!==2||users.some(u=>u.status!=='active'))return invalidateLocked(client,row,'account_unavailable');
  const updated=await client.query("UPDATE matches SET status='running',started_at=$2 WHERE id=$1 AND status='preparing' RETURNING *",[id,new Date(clock())]);return publicMatch(client,updated.rows[0]);
 });}
 function validateResult(result){if(!result||![0,1,null].includes(result.winnerSlot)||!['ko','time_over','forfeit'].includes(result.reason)||!Array.isArray(result.rounds)||result.rounds.length!==2||result.rounds.some(x=>!Number.isSafeInteger(x)||x<0||x>9))fail('invalid_result','A validated authoritative result is required');if(result.winnerSlot===null&&(result.reason!=='time_over'||result.rounds[0]!==result.rounds[1]))fail('invalid_result','Only a tied time-over can be a draw');if(result.winnerSlot!==null&&result.reason!=='forfeit'&&result.rounds[result.winnerSlot]<=result.rounds[1-result.winnerSlot])fail('invalid_result','Winner and round scores disagree');}
 async function ensureRatings(client,userIds,seasonId){for(const id of [...userIds].sort()){await client.query('INSERT INTO ranked_ratings(user_id,season_id,mmr,rd) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,season_id) DO NOTHING',[id,seasonId,c.initialMmr,c.initialRd]);}const {rows}=await client.query('SELECT * FROM ranked_ratings WHERE season_id=$1 AND user_id=ANY($2::uuid[]) ORDER BY user_id FOR UPDATE',[seasonId,userIds]);return new Map(rows.map(r=>[r.user_id,r]));}
 async function completeMatch(id,result){checkId(id);validateResult(result);return tx(async client=>{
  const {rows}=await client.query('SELECT * FROM matches WHERE id=$1 FOR UPDATE',[id]);const row=rows[0];if(!row)fail('match_missing','Match not found',404);
  if(['completed','invalid'].includes(row.status))return {...await publicMatch(client,row),alreadySettled:true};if(row.status!=='running'||!row.started_at)fail('match_not_running','A match must start before settlement',409);
  const finish=clock(),start=new Date(row.started_at).getTime();if(finish<start||finish-start>c.maxMatchAgeMs)return invalidateLocked(client,row,'match_lifetime_exceeded');
  const ps=await participants(client,id);if(ps.length!==2)return invalidateLocked(client,row,'invalid_roster');
  const {rows:users}=await client.query('SELECT id,status FROM users WHERE id=ANY($1::uuid[])',[ps.map(p=>p.user_id)]);if(users.length!==2||users.some(u=>u.status!=='active'))return invalidateLocked(client,row,'account_unavailable');
  if(row.mode==='ranked'&&result.reason==='forfeit'){const recent=await client.query("SELECT m.id FROM matches m JOIN match_participants a ON a.match_id=m.id JOIN match_participants b ON b.match_id=m.id WHERE m.mode='ranked' AND m.status='completed' AND m.reason='forfeit' AND m.ended_at>$3 AND a.user_id=$1 AND b.user_id=$2 LIMIT 1",[ps[0].user_id,ps[1].user_id,new Date(finish-3600000)]);if(recent.rowCount)return invalidateLocked(client,row,'repeated_pair_forfeit');}
  const score=result.winnerSlot===null?.5:result.winnerSlot===0?1:0,playerResults=[];let ratings=null,nextPair=null;
  if(row.mode==='ranked'){
   const season=await lockSeason(client,row.season_id),end=season?.ends_at?new Date(season.ends_at).getTime():NaN;
   if(!season||season.status!=='active'||!Number.isFinite(end)||start>=end||finish>end+c.seasonFinishGraceMs)return invalidateLocked(client,row,'season_settlement_expired');
   ratings=await ensureRatings(client,ps.map(p=>p.user_id),row.season_id);nextPair=ratePair(ratings.get(ps[0].user_id),ratings.get(ps[1].user_id),score,{config:c,now:finish});
  }
  if(row.mode==='quick'){
   for(const id of ps.map(p=>p.user_id).sort())await client.query('INSERT INTO casual_ratings(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING',[id]);
   const {rows}=await client.query('SELECT * FROM casual_ratings WHERE user_id=ANY($1::uuid[]) ORDER BY user_id FOR UPDATE',[ps.map(p=>p.user_id)]),map=new Map(rows.map(r=>[r.user_id,r]));
   const pair=ratePair(map.get(ps[0].user_id),map.get(ps[1].user_id),score,{config:c,now:finish});
   for(const p of ps)await client.query('UPDATE casual_ratings SET mmr=$2,rd=$3,games=games+1,last_played_at=$4 WHERE user_id=$1',[p.user_id,pair[int(p.slot)].mmr,pair[int(p.slot)].rd,new Date(finish)]);
  }
  for(const p of ps){const slot=int(p.slot),pScore=slot===0?score:1-score,outcome=pScore===.5?'draw':pScore===1?'win':'loss';let publicRating={rpBefore:null,rpAfter:null,rpDelta:null,previousRank:null,rank:null,promotion:null,placementGames:null};
   if(ratings){const prior=ratings.get(p.user_id),next=nextPair[slot],award=awardRating(prior,next,pScore,c);publicRating={rpBefore:int(prior.rp),rpAfter:award.rp,rpDelta:award.rpDelta,previousRank:award.previousRank,rank:award.rank,promotion:award.promotion,placementGames:award.placementGames};
    await client.query('UPDATE ranked_ratings SET mmr=$3,rd=$4,rp=$5,placement_games=$6,wins=wins+$7,losses=losses+$8,draws=draws+$9,streak=$10,best_streak=GREATEST(best_streak,$10),peak_rp=GREATEST(peak_rp,$5),last_played_at=$11 WHERE user_id=$1 AND season_id=$2',[p.user_id,row.season_id,next.mmr,next.rd,award.rp,award.placementGames,pScore===1?1:0,pScore===0?1:0,pScore===.5?1:0,award.streak,new Date(finish)]);
    await client.query('UPDATE match_participants SET outcome=$3,rp_before=$4,rp_after=$5,mmr_before=$6,mmr_after=$7 WHERE match_id=$1 AND slot=$2',[id,slot,outcome,prior.rp,award.rp,prior.mmr,next.mmr]);
   }else await client.query('UPDATE match_participants SET outcome=$3 WHERE match_id=$1 AND slot=$2',[id,slot,outcome]);
   playerResults.push({userId:p.user_id,displayName:p.display_name,avatar:p.avatar,slot,character:p.character_id,outcome,...publicRating});
  }
  const saved={winnerSlot:result.winnerSlot,reason:result.reason,rounds:[...result.rounds],players:playerResults};if(typeof result.checksum==='string'&&/^[a-f0-9]{8,128}$/i.test(result.checksum))saved.checksum=result.checksum;
  const updated=await client.query("UPDATE matches SET status='completed',winner_slot=$2,winner_user_id=$3,reason=$4,rounds=$5::jsonb,result=$6::jsonb,ended_at=$7 WHERE id=$1 AND status='running' RETURNING *",[id,result.winnerSlot,result.winnerSlot===null?null:ps[result.winnerSlot].user_id,result.reason,JSON.stringify(result.rounds),JSON.stringify(saved),new Date(finish)]);
  if(updated.rowCount!==1)throw new Error('Match settlement compare-and-set failed');await client.query('DELETE FROM active_match_users WHERE match_id=$1',[id]);return {...await publicMatch(client,updated.rows[0]),alreadySettled:false};
 });}
 async function voidMatch(id,reason='cancelled'){checkId(id);if(typeof reason!=='string'||!/^[a-z0-9_:-]{1,80}$/i.test(reason))fail('invalid_reason','Invalid invalidation reason');return tx(async client=>{const {rows}=await client.query('SELECT * FROM matches WHERE id=$1 FOR UPDATE',[id]);if(!rows[0])fail('match_missing','Match not found',404);if(['completed','invalid'].includes(rows[0].status))return {...await publicMatch(client,rows[0]),alreadySettled:true};return invalidateLocked(client,rows[0],reason);});}
 async function recoverInterruptedMatches(){return tx(async client=>{const {rows}=await client.query("SELECT * FROM matches WHERE status IN ('preparing','running') ORDER BY id FOR UPDATE");for(const row of rows)await invalidateLocked(client,row,'server_restart');return {invalidated:rows.length};});}
 async function internalMatchmakingStats(userId,kind='ranked'){if(kind==='quick'){const {rows}=await db.query('SELECT mmr,rd FROM casual_ratings WHERE user_id=$1',[userId]);return rows[0]?{mmr:Number(rows[0].mmr),rd:Number(rows[0].rd)}:{mmr:c.initialMmr,rd:c.initialRd};}const season=await currentSeason();if(!season)return {mmr:c.initialMmr,rd:c.initialRd};const {rows}=await db.query('SELECT mmr,rd,last_played_at FROM ranked_ratings WHERE user_id=$1 AND season_id=$2',[userId,season.id]);return rows[0]?{mmr:Number(rows[0].mmr),rd:Number(rows[0].rd)}:{mmr:c.initialMmr,rd:c.initialRd};}
 function ratingPublic(row){return row?{seasonId:row.season_id,rp:int(row.rp),rank:Rules.rankFor(int(row.rp),int(row.placement_games)),peakRank:Rules.rankFor(int(row.peak_rp),int(row.placement_games)),placementGames:int(row.placement_games),placementsRequired:c.placements,wins:int(row.wins),losses:int(row.losses),draws:int(row.draws),streak:int(row.streak),bestStreak:int(row.best_streak),winRate:int(row.wins)+int(row.losses)+int(row.draws)?int(row.wins)/(int(row.wins)+int(row.losses)+int(row.draws)):0}:null;}
 async function getPlayer(userId){
  const {rows:users}=await db.query("SELECT id,display_name,avatar,created_at FROM users WHERE id=$1 AND status='active'",[userId]);if(!users[0])fail('player_missing','Player not found',404);
  const [summary,characters,ordered,season,peak]=await Promise.all([
   db.query("SELECT count(*)::int games,count(*) FILTER(WHERE p.outcome='win')::int wins,count(*) FILTER(WHERE p.outcome='loss')::int losses,count(*) FILTER(WHERE p.outcome='draw')::int draws,count(*) FILTER(WHERE m.mode='ranked')::int ranked_games,count(*) FILTER(WHERE m.mode='ranked' AND p.outcome='win')::int ranked_wins,count(*) FILTER(WHERE m.mode='ranked' AND p.outcome='loss')::int ranked_losses FROM match_participants p JOIN matches m ON m.id=p.match_id WHERE p.user_id=$1 AND m.status='completed'",[userId]),
   db.query("SELECT p.character_id,count(*)::int games,count(*) FILTER(WHERE p.outcome='win')::int wins,count(*) FILTER(WHERE p.outcome='loss')::int losses,count(*) FILTER(WHERE p.outcome='draw')::int draws FROM match_participants p JOIN matches m ON m.id=p.match_id WHERE p.user_id=$1 AND m.status='completed' GROUP BY p.character_id ORDER BY count(*) DESC,p.character_id",[userId]),
   db.query("SELECT p.outcome FROM match_participants p JOIN matches m ON m.id=p.match_id WHERE p.user_id=$1 AND m.status='completed' ORDER BY m.ended_at,m.id",[userId]),currentSeason(),db.query('SELECT max(peak_rp)::int rp FROM ranked_ratings WHERE user_id=$1 AND placement_games=5',[userId])
  ]);
  const total=summary.rows[0];let streak=0,best=0;for(const row of ordered.rows){streak=row.outcome==='win'?streak+1:0;best=Math.max(best,streak);}
  const stats={games:int(total.games),wins:int(total.wins),losses:int(total.losses),draws:int(total.draws),winRate:int(total.games)?int(total.wins)/int(total.games):0,streak,bestStreak:best,rankedGames:int(total.ranked_games),rankedWins:int(total.ranked_wins),rankedLosses:int(total.ranked_losses),characters:characters.rows.map(r=>({character:r.character_id,games:int(r.games),wins:int(r.wins),losses:int(r.losses),draws:int(r.draws),winRate:int(r.games)?int(r.wins)/int(r.games):0}))};
  let ranked=null;if(season){const {rows}=await db.query('SELECT * FROM ranked_ratings WHERE user_id=$1 AND season_id=$2',[userId,season.id]);ranked=ratingPublic(rows[0])||{seasonId:season.id,rp:0,rank:null,peakRank:null,placementGames:0,placementsRequired:c.placements,wins:0,losses:0,draws:0,streak:0,bestStreak:0,winRate:0};}
  const achievements=[];if(stats.wins>=1)achievements.push({id:'first-win',name:'首場勝利'});if(best>=3)achievements.push({id:'streak-3',name:'三連勝'});if(stats.characters.filter(x=>x.games>0).length===4)achievements.push({id:'four-fighters',name:'四方好手'});if(stats.games>=100)achievements.push({id:'hundred-battles',name:'百戰擂主'});if(ranked?.placementGames===5)achievements.push({id:'placed',name:'定位完成'});
  return {highestRank:peak.rows[0]?.rp===null?null:Rules.rankFor(int(peak.rows[0]?.rp)),id:users[0].id,displayName:users[0].display_name,avatar:users[0].avatar,createdAt:iso(users[0].created_at),stats,ranked,achievements};
 }
 async function history(userId,{limit=20,before}={}){const size=clamp(Number.isSafeInteger(Number(limit))?Number(limit):20,1,50);let cursor=null;if(before){checkId(before);const got=await db.query('SELECT m.ended_at,m.id FROM matches m JOIN match_participants p ON p.match_id=m.id WHERE m.id=$1 AND p.user_id=$2 AND m.status IN (\'completed\',\'invalid\')',[before,userId]);if(!got.rows[0])fail('invalid_cursor','History cursor not found',400);cursor=got.rows[0];}
  const {rows}=await db.query("SELECT m.* FROM matches m JOIN match_participants p ON p.match_id=m.id WHERE p.user_id=$1 AND m.status IN ('completed','invalid') AND ($2::timestamptz IS NULL OR (m.ended_at,m.id)<($2::timestamptz,$3::text)) ORDER BY m.ended_at DESC,m.id DESC LIMIT $4",[userId,cursor?.ended_at||null,cursor?.id||null,size+1]);const items=await Promise.all(rows.slice(0,size).map(r=>publicMatch(db,r)));return {items,nextCursor:rows.length>size?items.at(-1).id:null};
 }
 async function leaderboard({seasonId,page=1,query='',eliteOnly=false,userId}={}){
  const size=25,p=clamp(Number.isSafeInteger(Number(page))?Number(page):1,1,10000),search=typeof query==='string'?query.trim().slice(0,64):'';let season;if(seasonId){const got=await db.query('SELECT * FROM seasons WHERE id=$1 AND status <> \'draft\'',[seasonId]);season=publicSeason(got.rows[0]);}else season=await currentSeason();if(!season)return {season:null,items:[],page:p,pageSize:size,total:0,personal:null};
  const conditions="r.season_id=$1 AND r.placement_games=5 AND u.status='active'",filter="($2::text='' OR u.display_name ILIKE $2 ESCAPE '\\' OR u.id::text=$3) AND ($4::boolean=false OR r.rp >= $5)",pattern=search?'%'+search.replace(/[\\%_]/g,'\\$&')+'%':'';
  const base=`SELECT r.*,u.display_name,u.avatar,row_number() OVER(ORDER BY r.rp DESC,r.wins DESC,r.user_id)::int position FROM ranked_ratings r JOIN users u ON u.id=r.user_id WHERE ${conditions}`;
  const [{rows},count,personal]=await Promise.all([
   db.query(`SELECT * FROM (${base}) ranked_rows WHERE ${filter.replaceAll('u.display_name','display_name').replaceAll('u.id','user_id').replaceAll('r.rp','rp')} ORDER BY position LIMIT $6 OFFSET $7`,[season.id,pattern,search,!!eliteOnly,Rules.TIERS.at(-1).min,size,(p-1)*size]),
   db.query(`SELECT count(*)::int total FROM ranked_ratings r JOIN users u ON u.id=r.user_id WHERE ${conditions} AND ${filter}`,[season.id,pattern,search,!!eliteOnly,Rules.TIERS.at(-1).min]),
   userId?db.query(`SELECT * FROM (${base}) ranked_rows WHERE user_id=$2`,[season.id,userId]):Promise.resolve({rows:[]})
  ]);
  const entry=r=>({position:int(r.position),userId:r.user_id,displayName:r.display_name,avatar:r.avatar,rp:int(r.rp),rank:Rules.rankFor(int(r.rp),int(r.placement_games)),wins:int(r.wins),losses:int(r.losses),draws:int(r.draws),winRate:int(r.wins)+int(r.losses)+int(r.draws)?int(r.wins)/(int(r.wins)+int(r.losses)+int(r.draws)):0});return {season,items:rows.map(entry),page:p,pageSize:size,total:int(count.rows[0].total),personal:personal.rows[0]?entry(personal.rows[0]):null};
 }
 async function seasons(userId){const {rows}=await db.query('SELECT r.*,s.id,s.name,s.status,s.starts_at,s.ends_at FROM ranked_ratings r JOIN seasons s ON s.id=r.season_id WHERE r.user_id=$1 ORDER BY s.created_at DESC,s.id',[userId]);return {items:rows.map(r=>({...publicSeason(r),...ratingPublic(r)}))};}
 return Object.freeze({reserveMatch,startMatch,completeMatch,voidMatch,currentSeason,recoverInterruptedMatches,getPlayer,history,leaderboard,seasons,internalMatchmakingStats});
}
module.exports={createCompetition,CompetitionError,DEFAULTS,ratePair,awardRating};
