'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Flow=require('../public/game-flow');

test('menu navigation reaches every Phase 1 panel and returns without starting a game',()=>{
 const flow=Flow.create();
 assert.equal(flow.screen,'home');assert.equal(flow.isOpen(),true);
 for(const panel of Flow.PANELS){flow.open(panel);assert.equal(flow.screen,panel);assert.equal(flow.currentPanel,panel);}
 flow.close();assert.equal(flow.screen,'battle');assert.equal(flow.currentPanel,Flow.PANELS.at(-1));assert.equal(flow.isOpen(),false);
 flow.open('fighters');assert.equal(flow.screen,'fighters');
 assert.equal(flow.open('missions'),true);assert.equal(flow.open('stages'),true);assert.equal(flow.open('stage-select'),false);assert.equal(flow.screen,'stages');
});

test('mode drafts and cancelled navigation have no gameplay authority',()=>{
 const flow=Flow.create({mode:'practice'});
 for(const mode of Flow.MODES){flow.selectMode(mode);assert.equal(flow.draftMode,mode);assert.equal(flow.screen,'home');}
 flow.open('room');flow.close();flow.open('home');
 assert.equal(flow.screen,'home');assert.equal(flow.draftMode,'spectator');
 assert.equal(flow.selectMode('legacy'),false);assert.equal(flow.draftMode,'spectator');
 // Only the actual client's start callback changes the flow to the battle view.
 flow.battleStarted({mode:'team'});assert.equal(flow.screen,'battle');assert.equal(flow.draftMode,'team');
});

test('navigation subscriptions are idempotent, immutable and removable',()=>{
 const flow=Flow.create({initialScreen:'settings',mode:'online'}),changes=[];
 const unsubscribe=flow.subscribe(state=>changes.push(state));
 assert.equal(flow.open('settings'),false);assert.equal(changes.length,0);
 flow.open('room');flow.selectMode('arcade');flow.battleStarted({mode:'online'});
 assert.equal(changes.length,3);assert.equal(changes[0].screen,'room');assert.equal(changes[0].draftMode,'online');
 assert.ok(Object.isFrozen(flow.snapshot));assert.throws(()=>{flow.snapshot.screen='missions';},TypeError);
 assert.equal(flow.close(),false);assert.equal(flow.battleStarted({mode:'online'}),false);assert.equal(changes.length,3);
 unsubscribe();flow.open('home');assert.equal(changes.length,3);
});

test('invalid initial flow state recovers to the existing arcade home',()=>{
 const flow=Flow.create({initialScreen:'constructor',mode:'sam'});
 assert.deepEqual(flow.snapshot,{screen:'home',panel:'home',draftMode:'arcade'});
 const preview=Flow.create({initialScreen:'battle',mode:'team'});
 assert.equal(preview.isOpen(),false);assert.equal(preview.currentPanel,'home');
});
