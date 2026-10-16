'use strict';
const crypto=require('node:crypto');
const {Pool}=require('pg');
const {createDatabase}=require('../server/db');
async function database(t){
 const connectionString=process.env.AZHI_TEST_DATABASE_URL;
 const admin=new Pool({connectionString});const schema='azhi_online_test_'+crypto.randomBytes(8).toString('hex');await admin.query('CREATE SCHEMA '+schema);
 const pool=new Pool({connectionString,options:'-csearch_path='+schema});const db=createDatabase({pool});await db.migrate();
 t.after(async()=>{await db.close();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();});
 const url=new URL(connectionString);url.searchParams.set('options','-csearch_path='+schema);return {db,connectionString:url.href,schema};
}
async function users(db,count=2){
 const {hash}=require('@node-rs/argon2'),password='testing a long unique passphrase',encoded=await hash(password,{memoryCost:8192,timeCost:1,parallelism:1});const rows=[];
 for(let i=0;i<count;i++){const id=crypto.randomUUID(),email='player-'+i+'-'+id.slice(0,8)+'@example.test';await db.query('INSERT INTO users(id,email,password_hash,display_name,email_verified) VALUES($1,$2,$3,$4,true)',[id,email,encoded,'測試玩家'+i]);rows.push({id,email,password,nickname:'測試玩家'+i});}return rows;
}
async function season(db){await db.query("UPDATE seasons SET status='active',starts_at=now()-interval '1 day',ends_at=now()+interval '90 days' WHERE id='season-01'");}
module.exports={database,users,season};
