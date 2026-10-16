'use strict';

// Tokens travel only to the configured SMTP transport; never write mail bodies,
// recipients or reset/verification URLs to application logs.
function createMailer({env=process.env,transport}={}) {
 const configured=Boolean(transport||(env.SMTP_HOST&&env.SMTP_FROM));
 let client=transport;
 function getClient(){
  if(!client){
   const nodemailer=require('nodemailer');
   const port=Number(env.SMTP_PORT||587);
   if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid SMTP port');
   client=nodemailer.createTransport({host:env.SMTP_HOST,port,secure:env.SMTP_SECURE==='true'||port===465,
    requireTLS:env.SMTP_REQUIRE_TLS!=='false',connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
    ...(env.SMTP_USER?{auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD||''}}:{})});
  }
  return client;
 }
 return {
  ready:configured,
  async send({to,kind,url}){
   if(!configured)throw Object.assign(new Error('Email service is not configured'),{code:'MAIL_UNAVAILABLE'});
   if(!['verify_email','reset_password'].includes(kind))throw new Error('Invalid email kind');
   const verify=kind==='verify_email';
   const title=verify?'陪公子練武 — 驗證 Email':'陪公子練武 — 重設密碼';
   const text=verify?`請開啟以下連結驗證 Email。連結在 24 小時後失效，且只能使用一次。\n\n${url}\n\n如果你沒有註冊，請忽略這封信。`:
    `請開啟以下連結設定新密碼。連結在 30 分鐘後失效，且只能使用一次。\n\n${url}\n\n如果你沒有要求重設密碼，請忽略這封信。`;
   const result=await getClient().sendMail({from:env.SMTP_FROM||'Game <noreply@example.invalid>',to,subject:title,text});
   if(result.rejected?.length||(!result.accepted?.length&&result.accepted))throw new Error('SMTP rejected delivery');
  },
  close(){client?.close?.();}
 };
}

module.exports={createMailer};
