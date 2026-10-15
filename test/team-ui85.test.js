'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../public');
test('new 2v2 UI has four fighters, player/watch modes and 4 visible team seats',()=>{
 const html=fs.readFileSync(path.join(dir,'team.html'),'utf8');const ui=fs.readFileSync(path.join(dir,'team.js'),'utf8');
 for(const id of ['teamRoster','teamCharacters','watchTab','playerTab','copyWatchLink','rematch','joinButton','arenaCanvas'])assert.ok(html.includes(`id="${id}"`));
 assert.match(ui,/for\(let i=0;i<\(serverMode==='team'\?4:2\)/);assert.match(ui,/role==='spectator'/);
 assert.match(ui,/return[ ;]?/);assert.match(html,/60Hz/);
});
test('classic 1v1 still links to team arena and invites spectators',()=>{
 const index=fs.readFileSync(path.join(dir,'index.html'),'utf8'),game=fs.readFileSync(path.join(dir,'game.js'),'utf8');
 assert.match(index,/href="\/team\.html"/);assert.match(index,/id="copySpectatorLink"/);
 assert.match(game,/\/team\.html/);assert.match(game,/watch','1'/);
});
test('server snapshots to spectators never include remote input rows',()=>{
 const s=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
 assert.match(s,/type:'watch_frame'/);assert.match(s,/type:'watch_start'/);
 assert.match(s,/room\.spectators\.delete\(ws\)/);assert.match(s,/if\(!session\|\|!p/);
});
