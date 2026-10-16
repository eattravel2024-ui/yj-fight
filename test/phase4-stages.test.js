'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('../public/stage-registry'),Assets=require('../public/stage-assets');
test('STAGE 04 has no borrowed art and no encounter until validated source assets exist',()=>{
 const stage=S.get('legislature');assert.equal(stage.number,4);assert.equal(stage.name,'立法院');assert.equal(stage.available,Assets.legislature.ready);
 if(stage.available){const manifest=require('../public/art/stages/legislature/manifest.json');assert.equal(manifest.ready,true);assert.equal(manifest.source.sha256,Assets.legislature.sourceSha256);for(const a of Object.values(manifest.assets))assert.ok(fs.existsSync(path.join(__dirname,'../public',a.path)));}
 else{assert.equal(stage.previewAsset,undefined);assert.equal(S.playable('legislature'),false);assert.equal(require('../public/campaign').plan({mode:'practice',stageId:'legislature'}),null);}
});
test('validating the asset registry activates legislature selection and final mission without changing save IDs or geometry',()=>{
 const sandbox={AzhiStageAssets:{legislature:{ready:true}}};vm.createContext(sandbox);
 for(const file of ['stage-registry.js','campaign.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'),sandbox);
 const stages=sandbox.AzhiStages,campaign=sandbox.AzhiCampaign,stage=stages.get('legislature');
 assert.ok(stages.PLAYABLE.includes('legislature'));assert.equal(stage.layers,1);assert.equal(stage.fallbackAsset,null);assert.equal(stage.bgm,'stage_fur_lab');assert.equal(stage.geometry.groundY,448);assert.deepEqual(Array.from(stage.geometry.spawns),[274,686]);
 const final=campaign.MISSIONS.at(-1);assert.equal(final.id,'azhi-finale');assert.equal(final.stage,'legislature');assert.equal(campaign.plan({missionId:final.id,progress:campaign.normalizeProgress(null,4)}).stage,'legislature');assert.equal(campaign.MISSIONS.length,5);
});
