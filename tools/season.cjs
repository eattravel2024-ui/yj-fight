#!/usr/bin/env node
'use strict';
// Operator-only CLI. No HTTP administrator or rating-edit endpoint exists.
const {createDatabase}=require('../server/db');
const {DEFAULTS}=require('../server/ranked');
function args(argv){const [command,id,...rest]=argv,options={};for(let i=0;i<rest.length;i+=2){if(!/^--[a-z]+$/.test(rest[i])||!rest[i+1])throw Error('Invalid arguments');options[rest[i].slice(2)]=rest[i+1];}return {command,id,options};}
function date(value){const n=new Date(value);if(!value||!Number.isFinite(n.getTime()))throw Error('Explicit ISO dates are required');return n;}
async function main(){
 const {command,id,options}=args(process.argv.slice(2));if(!['list','activate','end','next'].includes(command)||command!=='list'&&!/^[a-zA-Z0-9_-]{1,64}$/.test(id||''))throw Error('Usage: season.cjs list | activate ID --start ISO --end ISO | end ID | next ID --name NAME');
 const db=createDatabase();try{
  if(command==='list'){const r=await db.query('SELECT id,name,status,starts_at,ends_at FROM seasons ORDER BY created_at');for(const row of r.rows)console.log(JSON.stringify(row));return;}
  await db.transaction(async client=>{
   await client.query('SELECT pg_advisory_xact_lock(657439182042782)');
   if(command==='activate'){const start=date(options.start),end=date(options.end);if(end<=start||end<=new Date())throw Error('End must be after start and in the future');if(Object.keys(options).some(k=>!['start','end'].includes(k)))throw Error('Unsupported argument');
    const r=await client.query("UPDATE seasons SET status='active',starts_at=$2,ends_at=$3 WHERE id=$1 AND status='draft' RETURNING id",[id,start,end]);if(!r.rowCount)throw Error('Only an existing draft season may be activated');
   }else if(command==='end'){const active=await client.query("SELECT id FROM matches WHERE season_id=$1 AND status IN ('preparing','running') LIMIT 1",[id]);if(active.rowCount)throw Error('Finish or invalidate active matches before closing the season');const r=await client.query("UPDATE seasons SET status='ended' WHERE id=$1 AND status='active' RETURNING id",[id]);if(!r.rowCount)throw Error('Active season not found');
   }else{if(!options.name||options.name.length>100||Object.keys(options).some(k=>k!=='name'))throw Error('next requires --name');const last=await client.query("SELECT id FROM seasons WHERE status='ended' ORDER BY ends_at DESC NULLS LAST,created_at DESC LIMIT 1");await client.query("INSERT INTO seasons(id,name,status) VALUES($1,$2,'draft')",[id,options.name]);
    if(last.rows[0])await client.query('INSERT INTO ranked_ratings(user_id,season_id,mmr,rd,rp,peak_rp) SELECT user_id,$1,$3+(mmr-$3)*0.5,$4,0,0 FROM ranked_ratings WHERE season_id=$2',[id,last.rows[0].id,DEFAULTS.initialMmr,DEFAULTS.initialRd]);
   }
  });console.log('Season operation completed:',command,id);
 }finally{await db.close();}
}
if(require.main===module)main().catch(err=>{console.error('Season operation failed:',err.code||err.message);process.exitCode=1;});
module.exports={args};
