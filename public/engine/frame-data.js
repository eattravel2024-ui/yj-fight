/* v8.2 格鬥資料表。設計借鏡 KOF13 逐招式矩形區塊概念；數值與原創素材均為本遊戲創作。 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiFrames=api})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const CHAR={
 winnie:{name:'維尼',title:'蜜糖霸主',speed:2.55,power:1.08,guard:.36,air:.90,special:'不同意的請舉手',superName:'全票通過掌',superDescription:'大型下段掌波；可遠距離命中，蹲防可擋。',skillDescription:'舉手蓄勢，掌印震波沿地面推進；蹲防可擋。',entrance:{title:'全場焦點',line:'不同意的，現在就舉手。',pose:'vote'},style:'guard',accent:'#ffd04b',desc:'防守穩健，舉手掌印控制地面進攻路線',moves:{light:{startup:4,damage:8,reach:83},heavy:{startup:12,damage:18,hitstun:40},kick:{startup:10,damage:13,reach:120},low:{startup:9,damage:12,reach:139},upper:{startup:13,damage:20},throw:{startup:7,damage:19},special:{startup:17,active:11,reach:145,damage:21,hitstun:43,level:'low',impactY:48,hitHeight:42,recovery:36}}},
 sezi:{name:'塞子',title:'白毛旋風',speed:3.65,power:.88,guard:.24,air:1.20,special:'高雄發大財',superName:'港都金流大爆發',superDescription:'向前旋風突進，最多三段命中；須靠近目標。',skillDescription:'金幣旋風向前突進，最多三段命中；可接超必殺。',entrance:{title:'港都旋風',line:'風起港都，今天換我發財！',pose:'gold'},style:'rush',accent:'#fff4ae',desc:'移動快，空中突進與掃腿擅長連段',moves:{light:{startup:2,recovery:10,damage:5},heavy:{startup:10,recovery:21,damage:12},kick:{startup:6,reach:170,recovery:15,damage:10},low:{reach:151,startup:5,recovery:15},upper:{startup:8,damage:15,recovery:27},throw:{startup:6,damage:13},special:{startup:9,active:20,reach:195,damage:15,recovery:30,hitstun:29}}},
 gambler:{name:'金沙賭神',title:'膽量操盤手',speed:3.05,power:.95,guard:.27,air:1.05,special:'膽大撐死膽小餓死',superName:'梭哈人生不回頭',superDescription:'近身重擊；3 秒內吸收一次輕拳並強化反擊，重拳／摔技可破解。',skillDescription:'起手吸收一次輕拳，金色膽量拳強化反擊；重擊與摔技可破解。',entrance:{title:'膽量全押',line:'膽量上桌，這把我全押！',pose:'courage'},style:'balanced',accent:'#bb7eff',desc:'近身吸收輕拳，抓住破綻全押反擊',moves:{light:{startup:3,reach:100,damage:5},heavy:{startup:11,reach:133,damage:13},kick:{startup:10,reach:161,damage:10},low:{startup:9,reach:120},upper:{startup:11,damage:14},throw:{startup:10,damage:13},special:{startup:11,active:12,reach:221,damage:23,recovery:30}}},
 azhi:{name:'阿志',title:'滿油先鋒',speed:3.2,power:1.02,guard:.29,air:1.11,special:'加油加300',superName:'油箱滿到天靈蓋',superDescription:'強化遠程幸運牌；保底正常傷害，仍有彩金加成。',skillDescription:'射出 300 加油幸運牌，保留彩金與小額抽牌機制。',entrance:{title:'滿油上場',line:'先加三百，這局一路到底。',pose:'fuel'},style:'zoner',accent:'#57f2a5',desc:'加油幸運牌控制距離；拳腳連段接遠程必殺',moves:{light:{startup:3,damage:6},heavy:{startup:10,damage:15},kick:{startup:8,reach:146},low:{startup:7,damage:9},upper:{startup:7,damage:19,active:11,hitstun:41},throw:{damage:16},special:{startup:11,reach:296,damage:17,active:14,recovery:37}}}
};
const MOVE={
 light:{startup:3,active:5,recovery:11,reach:86,impactY:107,hitHeight:31,damage:6,knock:9,level:'mid',gain:8,hitstun:22},
 light2:{startup:3,active:5,recovery:11,reach:94,impactY:111,hitHeight:31,damage:7,knock:12,level:'mid',gain:9,hitstun:24},
 light3:{startup:6,active:7,recovery:20,reach:108,impactY:116,hitHeight:34,damage:11,knock:28,level:'mid',gain:11,hitstun:34},
 heavy:{startup:12,active:8,recovery:26,reach:113,impactY:106,hitHeight:39,damage:14,knock:29,level:'mid',gain:12,hitstun:34},
 kick:{startup:8,active:9,recovery:17,reach:140,impactY:90,hitHeight:34,damage:11,knock:22,level:'mid',gain:10,hitstun:28},
 low:{startup:7,active:8,recovery:18,reach:126,impactY:30,hitHeight:24,damage:8,knock:16,level:'low',gain:10,hitstun:26},
 upper:{startup:10,active:10,recovery:32,reach:101,impactY:137,hitHeight:70,damage:17,knock:29,level:'high',gain:12,hitstun:38},
 throw:{startup:8,active:6,recovery:32,reach:79,impactY:100,hitHeight:48,damage:16,knock:53,level:'throw',gain:12,hitstun:44},
 special:{startup:14,active:13,recovery:31,reach:245,impactY:116,hitHeight:62,damage:20,knock:36,level:'mid',gain:0,cost:25,hitstun:44},
 super:{startup:18,active:15,recovery:42,reach:285,impactY:121,hitHeight:83,damage:34,knock:65,level:'mid',gain:0,cost:60,hitstun:49}
};
// Phase 4.5: additions retain the existing U/O signatures and use easy direction + button inputs.
Object.assign(MOVE,{
 rush:{startup:6,active:8,recovery:20,reach:108,impactY:108,hitHeight:34,damage:12,knock:12,level:'mid',gain:10,cost:0,hitstun:30,blockstun:14,hitstop:8,blockstop:4,travel:4.2,characters:['azhi'],label:'三百起步・突進拳'},
 feint:{startup:5,active:1,recovery:9,reach:0,impactY:110,hitHeight:0,damage:0,knock:0,level:'mid',gain:0,cost:0,hitstun:0,blockstun:0,hitstop:0,blockstop:0,nonContact:true,cancelOnWhiff:true,characters:['gambler'],label:'我沒梭哈・假動作'},
 chip:{startup:13,active:4,recovery:27,reach:260,impactY:110,hitHeight:28,damage:20,knock:26,level:'mid',gain:8,cost:25,hitstun:32,blockstun:16,hitstop:9,blockstop:5,projectile:'chip',characters:['gambler'],label:'籌碼衝擊',description:'向前射出一枚籌碼；站防／蹲防均可擋，命中一次後消失。'},
 finisher:{startup:10,active:16,recovery:30,reach:124,impactY:112,hitHeight:44,damage:13,knock:5,level:'mid',gain:0,cost:60,hitstun:34,blockstun:16,hitstop:7,blockstop:4,repeatEvery:5,maxHits:3,travel:1.7,characters:['azhi'],label:'加滿三百・收工連打',description:'近身三段連打；逐段判定與傷害遞減，落空有完整收招硬直。'}
});
// Phase 4: one shared tuning source for both deterministic rulesets and selection UI.
const PROFILES={
 azhi:{role:'高速近身連打',style:'rush',speed:3.8,power:1.0,desc:'高速貼身三連拳與短收招；加油幸運牌用來掩護接近。',combat:{},moves:{light:{startup:3,active:5,recovery:8,damage:6,knock:7},light2:{startup:3,recovery:8,knock:9},light3:{startup:5,recovery:16,knock:22},kick:{startup:7,recovery:15},special:{recovery:24},super:{hitstop:12}},projectile:{damage:12,superDamage:25}},
 sezi:{role:'防禦反擊',style:'counter',speed:3.1,power:.92,desc:'防禦按下後 4F 內可精準防禦；零削血、縮短硬直，接 K／I／U／O 反擊。',combat:{perfectGuardWindow:4,guardCooldown:24,riposteWindow:48,riposteBonus:1.20,blockstunScale:.85},moves:{light:{startup:4,recovery:12},heavy:{startup:9,recovery:23,damage:14},kick:{startup:8,reach:151},special:{startup:10,recovery:28}}},
 gambler:{role:'技巧爆發／高風險高報酬',style:'balanced',speed:3.05,power:1,desc:'抓住對手收招破綻獲得 22% 傷害加成；全押必殺傷害高，落空後收招較長。',superDescription:'高傷害近身全押；起手短暫吸收一次輕拳，落空會留下長破綻。',combat:{punishBonus:1.22,armorWindow:8,superArmorWindow:12},moves:{special:{startup:15,damage:29,recovery:42},super:{startup:21,damage:42,recovery:52,hitstop:14}}},
 winnie:{role:'重量級高傷害壓制',style:'heavy',speed:2.45,power:1.14,desc:'移動較慢、重拳與投技威力最高；低空掌波封鎖地面，重擊落空可被反打。',combat:{},moves:{light:{startup:5,recovery:14,damage:8},heavy:{startup:14,recovery:30,damage:20,blockstun:21,hitstop:11},kick:{damage:14},throw:{damage:20},special:{recovery:38}},projectile:{damage:18,superDamage:33}}
};
PROFILES.azhi.combat.inputBuffer=12;
Object.assign(PROFILES.azhi.moves,{upper:{...PROFILES.azhi.moves.upper,rise:4.1},throw:{startup:6,active:3,recovery:30,reach:76,damage:16}});
Object.assign(PROFILES.gambler.moves,{light:{startup:3,active:4,recovery:10,reach:112,damage:5},throw:{startup:8,active:3,recovery:34,reach:80,damage:18}});
for(const [id,profile] of Object.entries(PROFILES)){
 const c=CHAR[id];for(const key of ['role','style','speed','power','desc','superDescription'])if(profile[key]!==undefined)c[key]=profile[key];
 c.combat=Object.freeze(profile.combat);c.projectile=profile.projectile?Object.freeze(profile.projectile):null;
 for(const [key,values] of Object.entries(profile.moves))c.moves[key]={...c.moves[key],...values};
 for(const values of Object.values(c.moves))Object.freeze(values);Object.freeze(c.moves);
}
const TIMING={light:[11,6,4],light2:[12,6,4],light3:[15,8,5],heavy:[18,10,5],kick:[14,7,4],low:[13,7,4],upper:[18,10,5],throw:[0,9,4],special:[18,10,5],super:[23,13,6]};
for(const [key,[blockstun,hitstop,blockstop]] of Object.entries(TIMING))Object.assign(MOVE[key],{blockstun,hitstop,blockstop});
const SPECIAL_STYLES={winnie:{mode:'shockwave',label:'重量壓制／低空掌波'},sezi:{mode:'spin',label:'精準防禦／旋風反擊'},gambler:{mode:'counter',label:'破綻懲罰／全押爆發'},azhi:{mode:'cards',label:'高速連打／幸運牌掩護'}};
const GRAPPLES={azhi:{name:'加油站快摔',style:'fuel_toss',impactFrame:16,duration:29},gambler:{name:'莊家通吃・換位摔',style:'casino_flip',impactFrame:20,duration:34},winnie:{name:'全票通過・壓制摔',style:'heavy_slam',impactFrame:20,duration:34},sezi:{name:'港都迴旋摔',style:'vortex_toss',impactFrame:18,duration:32}};
CHAR.gambler.superName='梭哈人生不回頭・ALL IN';
for(const [id,c] of Object.entries(CHAR))c.grapple=Object.freeze(GRAPPLES[id]);
for(const [id,v] of Object.entries(CHAR)){v.specialMode=SPECIAL_STYLES[id].mode;v.specialLabel=SPECIAL_STYLES[id].label;Object.freeze(v);}

for(const key of Object.keys(MOVE)){
 const m=MOVE[key];m.start=m.startup; // 舊畫面、格鬥教學相容別名
 m.cancelStart=m.startup+Math.max(1,Math.floor(m.active*.45));
 m.cancelEnd=m.startup+m.active+Math.max(2,Math.floor(m.recovery*.36));
 m.cancelable=true;m.cancelWindow=[m.cancelStart,m.cancelEnd];
 m.priority=['throw','upper','special'].includes(key)?2:1;
 Object.freeze(m);
}
return {CHAR,MOVE,SPECIAL_STYLES};
});
