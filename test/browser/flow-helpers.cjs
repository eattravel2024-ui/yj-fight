'use strict';
// Historical combat/animation tests enter the new local selection flow normally.
// Online confirmation still returns to its server-owned room without local starts.
async function enterLocalBattle(page){
 const mode=await page.evaluate(()=>window.AzhiGame?.mode);
 if(!['arcade','practice'].includes(mode))return;
 await page.waitForFunction(()=>!AzhiShell.isOpen()||['missions','stages','home'].includes(AzhiShell.currentPanel));
 const panel=await page.evaluate(()=>AzhiShell.currentPanel);
 if(panel==='missions')await page.locator('#missionConfirm').click();
 if(panel==='stages')await page.locator('#stageConfirm').click();
 if(['missions','stages'].includes(panel))await page.waitForFunction(()=>!AzhiShell.isOpen()&&!!AzhiGame.game);
}
async function openRoomForm(page,intent='join'){
 if(await page.locator('.room-entry').evaluate(el=>el.open))return;
 const connected=await page.evaluate(()=>!!AzhiGame.room);
 await page.locator(connected?'#customEditRoom':intent==='create'?'#customCreateRoom':'#customJoinRoom').click();
 await page.waitForFunction(()=>document.querySelector('.room-entry').open);
}
module.exports={enterLocalBattle,openRoomForm};
