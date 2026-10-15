# 四將美術素材與授權說明

## 取材界線
- 參考來源：https://github.com/vincent-li/kof13 （master，原始 README 表示 MIT 授權；未提供獨立 LICENSE 檔）。可研究其 **Cocos2d 動畫結構、`idcards.js` 的逐招式切圖描述、`movement.js` 的影格播放和 `gladiator.js` 動作狀態**。
- 該倉庫中的部分角色肖像、KOF13 Sprite Sheet、背景、音效可能是 SNK 等權利人的原作內容。README 的 MIT 程式碼條款不等同 SNK 美術素材的重用授權。**本包不含 KOF 原作角色圖、背景或音效，也不提供自動抓取器。**
- 目前維持維尼、塞子、金沙賭神、阿志四位原創角色與既有肖像、完整向量幀動畫。原第五位角色 Sam 已依使用者要求移除；其專屬肖像、精靈、招式圖、特寫，以及包含該角色的舊合照不再隨遊戲散布。

## 匯入你有權使用的舊式 Sprite Sheet
已附 `tools/import_legacy_atlas.py`，可把自行持有且已取得相關使用權的 KOF-style `[w,h,{x,y},frameCount]` 圖集切圖轉換成遊戲的 17 動作 × 10 影格、240×300 每格 PNG。

```bash
python3 tools/import_legacy_atlas.py --fighter azhi \
  --image /path/to/authorized_sheet.png \
  --metadata /path/to/authorized_rects.json \
  --authorized
```

- `--fighter` 支援 `winnie / sezi / gambler / azhi`，不新增 KOF 原作角色；肖像和角色資料仍由本遊戲維持。
- 匯入工具會先建立 `{fighter}.backup.png` 以保存原始角色 Sprite Sheet；若已有備份則停止以避免覆蓋。
- 若資料只含少數動畫，未提供的動作會回退 `stand` 姿勢。可自行提供每一種動作的 `aliases` 對應。
- 正式公開遊戲之前請確保所有傳入圖像、聲音與修改版素材均有合法使用及公開散布權；本包維持四位原創角色動畫。

## 技術更新
- 伺服器仍 60Hz 固定戰鬥判定／30Hz 狀態快照，沿用既有 `azhi71` 服務，不新增 Nginx 設定。
- 維尼「蜂蜜不用錢」發射低段地面震波；塞子「轉到你破產」為移動多段命中；金沙賭神「刷卡不用還」投擲獨立飛牌；阿志「薪水反擊日」具短暫單次輕擊霸體與反擊判定。
- 四位角色皆有差異化的基本拳腳幀數與原創逐幀動作素材；必殺技按 U 或觸控按鈕即可觸發，花費 25 氣量，並保留方向指令操作。
- 著重角色招式清楚易讀，不嘗試直接使用老舊 `koa.io`、舊版 Socket.io 或 2016 年的依賴，以降低部署風險。

## 8.2 增補
- `public/art/moves/*.webp`：四位角色原創招式圖與美術概念，作 UI 展示，不以不規則海報裁片偽裝完整 Sprite Sheet。舊五人合照已移除，選角介面直接呈現四位角色肖像。
- `public/art/vfx/impacts.png`：本版獨立製作的透明逐幀 8×3 透明特效圖集，實際在戰鬥命中時播放。
- `public/sprites/*.png` 仍沿用 8.1 的可完整播放的 17×10 角色圖集。
- 未複製 `vincent-li/kof13` 倉庫中可能包含第三方版權的 KOF 角色／音效素材。

- `public/art/cutins/*.webp`：保留四位角色的原創超必殺戰鬥特寫；僅作畫面演出，不改變伺服器攻擊判定。
- `make_sprites.py` 與 `tools/import_legacy_atlas.py` 的角色清單同步為四位；`make_art.py` 僅產生原創場景，不從舊宣傳合照裁切或覆寫角色肖像。

## 8.8 原創出場與狠話招式

新增 public/presentation.js、手繪 SVG 港都舞台 public/art/port-arena.svg；技能掌印、金幣港景、300 加油機與骰子拳弧為原創 Canvas 幾何圖形。參考 vincent-li/kof13 的動作資料設計，以及 Cubicheng/StreetFighter README／展示截圖的自適應鏡頭概念，未引入其 Blueprint、程式碼、人物、場景或聲音資產。

## 8.9.2 阿志影片參考動作

使用者提供 `gemini_generated_video_6dc43df0.mp4` 並明確選擇製作阿志透明戰鬥動作。影片 SHA-256 為 `9d1c5288c4ada8fc46fbb5c45974a7b7c9a21d812b7c3fa12f7b16ec565948dc`。原始影片留在本次工作區附件，未作為遊戲影片、音軌或背景散布。

`assets/azhi/video-poses.png` 是依影片人物與姿勢參考，使用影像生成工具製作的 21 個透明關鍵姿勢；並非從原影片逐格去背後直接拷貝。跳躍、受擊、倒地等原片不完整的姿勢為補製。沒有帶入影片中的對手、血條、文字、場景與音軌。

`assets/azhi/video-poses.json` 記錄姿勢裁切、角色根節點及 17 動作／10 時序影格的對應；`tools/build_azhi_video_atlas.py` 僅作 alpha 元件隔離、錨點正規化及圖集打包。遊戲中的阿志改為每格 384×300，其餘角色維持 240×300；共用相同 300px 高度、292px 腳底錨點與原世界比例。`make_sprites.py` 會沿用此來源重建，避免覆寫回舊角色素材。

影片目前只有部分出招，這版使用 21 個關鍵姿勢安排播放，未宣稱具備 170 張不同的流暢手繪中間張。後續可針對跨姿勢的過渡補張，維持既有招式前搖／有效／收招與判定。

## 8.9.3 金沙賭神影片參考動作

使用者提供 `gemini_generated_video_2c4aa8a5.mp4` 並要求用於金沙賭神動作。影片 SHA-256 為 `3a91e5446d3f35e1b4156f237d7fcac5aec20695f8a2bb22b361fc1fc2bd811a`，原始影片保留於工作區附件，未作遊戲影片或音軌散布。

`assets/gambler/video-poses.png` 是依影片眼鏡、黑色戰衣及青藍光條外觀和拳腳姿勢，用影像生成工具製作的 21 個透明關鍵姿勢；非原片逐格去背。跳躍、受擊、倒地等影片未完整呈現的姿勢為補製，未帶入影片背景、對手、文字或介面。

`assets/gambler/video-poses.json` 記錄來源與姿勢錨點；沿用 `tools/build_azhi_video_atlas.py --fighter gambler` 打包 17 動作 × 10 時序格。阿志與金沙賭神共用 384×300 影格及 292px 腳底錨點，其他兩人維持 240×300。角色名稱、「膽大撐死膽小餓死」、霸體反擊與數值不受素材變更影響。此版為關鍵姿勢播放，後續仍可補製過渡影格。
