# 五將美術素材與授權說明

## 取材界線
- 參考來源：https://github.com/vincent-li/kof13 （master，原始 README 表示 MIT 授權；未提供獨立 LICENSE 檔）。可研究其 **Cocos2d 動畫結構、`idcards.js` 的逐招式切圖描述、`movement.js` 的影格播放和 `gladiator.js` 動作狀態**。
- 該倉庫中的部分角色肖像、KOF13 Sprite Sheet、背景、音效可能是 SNK 等權利人的原作內容。README 的 MIT 程式碼條款不等同 SNK 美術素材的重用授權。**本包不含 KOF 原作角色圖、背景或音效，也不提供自動抓取器。**
- 7.2 使用者提供的 Sam、維尼、塞子、金沙賭神、阿志人物參考肖像與 8.0 原創向量幀動畫都保留；8.1 為五位人物重新設計各自的招式姿勢、效果與數值。

## 匯入你有權使用的舊式 Sprite Sheet
已附 `tools/import_legacy_atlas.py`，可把自行持有且已取得相關使用權的 KOF-style `[w,h,{x,y},frameCount]` 圖集切圖轉換成遊戲的 17 動作 × 10 影格、240×300 每格 PNG。

```bash
python3 tools/import_legacy_atlas.py --fighter sam \
  --image /path/to/authorized_sheet.png \
  --metadata /path/to/authorized_rects.json \
  --authorized
```

- `--fighter` 支援 `sam / winnie / sezi / gambler / azhi`，不新增 KOF 原作角色；肖像和角色資料仍由本遊戲維持。
- 匯入工具會先建立 `{fighter}.backup.png` 以保存原始角色 Sprite Sheet；若已有備份則停止以避免覆蓋。
- 若資料只含少數動畫，未提供的動作會回退 `stand` 姿勢。可自行提供每一種動作的 `aliases` 對應。
- 正式公開遊戲之前請確保所有傳入圖像、聲音與修改版素材均有合法使用及公開散布權；若未取得原作素材授權，建議維持本包內的五位原創角色動畫。

## 技術更新
- 伺服器仍 60Hz 固定戰鬥判定／30Hz 狀態快照，沿用既有 `azhi71` 服務，不新增 Nginx 設定。
- Sam 有突進霸體；維尼的特殊招式會發射真正的低段地面震波；塞子為移動多段命中；金沙賭神投擲獨立飛牌；阿志擅長反擊判定。
- 五位角色皆有差異化的基本拳腳幀數與原創逐幀動作素材。
- 著重角色招式清楚易讀，不嘗試直接使用老舊 `koa.io`、舊版 Socket.io 或 2016 年的依賴，以降低部署風險。

## 8.2 增補
- `public/art/moves/*.webp` 與 `public/art/roster_promo.webp`：整理本次會話原先製作的原創五人招式圖、美術概念；作 UI 展示，不以不規則海報裁片偽裝完整 Sprite Sheet。
- `public/art/vfx/impacts.png`：本版獨立製作的透明逐幀 8×3 透明特效圖集，實際在戰鬥命中時播放。
- `public/sprites/*.png` 仍沿用 8.1 的可完整播放的 17×10 角色圖集。
- 未複製 `vincent-li/kof13` 倉庫中可能包含第三方版權的 KOF 角色／音效素材。

- `public/art/cutins/*.webp`：根據先前生成的五人同框原創美術切割成獨立超必殺戰鬥特寫；僅作畫面演出，不改變伺服器攻擊判定。
