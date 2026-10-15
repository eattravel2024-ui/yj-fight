/* v8.2 格鬥資料表。設計借鏡 KOF13 逐招式矩形區塊概念；數值與原創素材均為本遊戲創作。 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiFrames=api})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const CHAR={
 winnie:{name:'維尼',title:'蜜糖霸主',speed:2.55,power:1.08,guard:.36,air:.90,special:'蜂蜜不用錢',superName:'全場蜂蜜喝到飽',skillDescription:'低空蜂蜜震波；對手需蹲下防禦。',style:'guard',accent:'#ffd04b',desc:'防守穩健，以地面震波控制對手的進攻路線',moves:{light:{startup:4,damage:8,reach:83},heavy:{startup:12,damage:18,hitstun:40},kick:{startup:10,damage:13,reach:120},low:{startup:9,damage:12,reach:139},upper:{startup:13,damage:20},throw:{startup:7,damage:19},special:{startup:17,active:11,reach:145,damage:21,hitstun:43,level:'low',impactY:48,hitHeight:42,recovery:36}}},
 sezi:{name:'塞子',title:'白毛旋風',speed:3.65,power:.88,guard:.24,air:1.20,special:'轉到你破產',superName:'白毛全自動洗衣機',skillDescription:'向前旋轉突進，最多三段命中；可接超必殺。',style:'rush',accent:'#fff4ae',desc:'移動快，空中突進與掃腿擅長連段',moves:{light:{startup:2,recovery:10,damage:5},heavy:{startup:10,recovery:21,damage:12},kick:{startup:6,reach:170,recovery:15,damage:10},low:{reach:151,startup:5,recovery:15},upper:{startup:8,damage:15,recovery:27},throw:{startup:6,damage:13},special:{startup:9,active:20,reach:195,damage:15,recovery:30,hitstun:29}}},
 gambler:{name:'金沙賭神',title:'幸運操盤手',speed:3.05,power:.95,guard:.27,air:1.05,special:'刷卡不用還',superName:'本月帳單你買單',skillDescription:'發射幸運牌；可能抽中加倍彩金或小額帳單。',style:'zoner',accent:'#bb7eff',desc:'擅長控制距離，以遠程必殺創造節奏',moves:{light:{startup:3,reach:100,damage:5},heavy:{startup:11,reach:133,damage:13},kick:{startup:10,reach:161,damage:10},low:{startup:9,reach:120},upper:{startup:11,damage:14},throw:{startup:10,damage:13},special:{startup:11,reach:296,damage:17,active:14,recovery:37}}},
 azhi:{name:'阿志',title:'欠打反擊王',speed:3.2,power:1.02,guard:.29,air:1.11,special:'薪水反擊日',superName:'年終獎金加倍奉還',skillDescription:'起手吸收一次輕拳並強化反擊；摔技與重擊仍可破解。',style:'balanced',accent:'#57f2a5',desc:'均衡型格鬥家；能用輕拳連段接升龍與必殺',moves:{light:{startup:3,damage:6},heavy:{startup:10,damage:15},kick:{startup:8,reach:146},low:{startup:7,damage:9},upper:{startup:7,damage:19,active:11,hitstun:41},throw:{damage:16},special:{startup:11,active:12,reach:221,damage:23,recovery:30}}}
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
const SPECIAL_STYLES={winnie:{mode:'shockwave',label:'低空蜂蜜震波'},sezi:{mode:'spin',label:'三段旋風突進'},gambler:{mode:'cards',label:'幸運牌遠程牽制'},azhi:{mode:'counter',label:'吸收輕拳反擊'}};
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
