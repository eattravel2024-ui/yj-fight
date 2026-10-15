# Phase 1.5 正式美術整合：前置盤點與待補素材

日期：2026-10-16（UTC+8）。基準：8.10.0／`6ea6007`，分支 `feat/arcade-phase1`。

## 後續更新

2026-10-16 已成功讀取另行提供的 `人物圖.zip`（28,467,892 bytes），含四角色各三用途，共 12 張 PNG。人物部分已整合，完整結果見 [Phase 1.5 人物交付](ARCADE_2_PHASE1_5.md)。場景圖仍待提供。

以下保留較早的 Phase 1 前置盤點與傳輸阻擋紀錄，不代表人物整合後仍未收到檔案。

## 原前置狀態：素材傳輸受限，尚未開始替換

使用者已上傳 `美術圖.zip`，但附件下載工具回報 `file exceeds the executor transfer limit of 32 MiB`。本次搜尋 `/workspace`、`/tmp` 及可用附件路徑，未發現同一壓縮檔或已解壓的新美術。這表示附件已在對話提供，但尚未能進入執行工作區；不能聲稱已看過壓縮檔內容、尺寸或 Alpha。

沒有使用其他圖片代替，也沒有新增假素材路徑或改動遊戲 UI／引擎。需先取得可讀的新圖，才能確認檔名／內容對應、邊緣、透明度、縮放與深淺底顯示。原始檔不應為了傳輸而降低畫質。

## 已確認的正式 ID 與圖片來源

| 顯示名稱 | 正式 ID | 選角／HUD 目前共用來源 | 戰鬥動畫 |
| --- | --- | --- | --- |
| 維尼 | `winnie` | `public/art/portrait_winnie.webp` | `public/sprites/winnie.png` |
| 塞子 | `sezi` | `public/art/portrait_sezi.webp` | `public/sprites/sezi.png` |
| 金沙賭神 | `gambler` | `public/art/portrait_gambler.webp` | `public/sprites/gambler.png` |
| 阿志 | `azhi` | `public/art/portrait_azhi.webp` | `public/sprites/azhi.png` |

來源資料為 `public/engine/frame-data.js` 的 `CHAR`。名稱與 ID 不相同；新檔須依內容及原檔名再次對應，不能依 ZIP 順序猜測。

- 四張目前 portrait 均為 **510×625 RGB WebP**，沒有 Alpha；`game.js` 的選角及 HUD、`team.js` 的選角／房間／隊伍 HUD 均由這組路徑載入。目前沒有分離的正式 fullbody／portrait／hud 資料欄位。
- 主選單為 `public/art/menu/arcade-heroes.webp`（1536×1024 透明主視覺），由 `game-shell.js` 載入。原始生成 PNG 在 `assets/menu/`。
- 超必殺海報位於 `public/art/cutins/{id}.webp`；UI 動作展示位於 `public/art/moves/{id}.webp`。不得混同成專用頭像或新的戰鬥動作。
- 四張戰鬥圖集都是 **3840×5100 RGBA PNG**，每格 384×300、17 動作×10 時序格；來源及編排在 `assets/{id}/*-poses.png/.json`。本階段不得用靜態立繪替換。
- `public/art/face_{id}.png` 是 90×106 歷史小頭像，不能冒充新提供的正式 HUD 頭像。

## 可讀素材到位後的整合方式（尚未實作）

1. 原圖獨立保留於作者來源目錄，記錄原檔名、內容對應、SHA256、格式、尺寸、位元組、Alpha 範圍與主體邊界；先看圖再決定裁切。
2. 新 UI 輸出集中到 `public/art/characters/{正式ID}/`，按用途提供 fullbody／portrait／hud，使用單一資產對應模組供主選單、既有卡片與 HUD 讀取，避免散落重複路徑。
3. Fullbody 保持比例與透明輪廓，視來源決定合理的 UI 尺寸；Portrait 目標 512×512、HUD 256×256。裁切不能切掉必要頭部輪廓，不拉伸、不把假透明格紋當成 Alpha。
4. 若只提供高解析立繪，先判斷是否足以裁出肖像／HUD；若已有專用 Portrait／HUD 也一併使用。無法取得合理構圖或透明度者單獨列為待處理，不冒充合格輸出。
5. 只在現有主選單／角色卡／適用的血條頭像整合，不新增 Phase 2 選角版面。圖片錯誤須有可辨識 fallback，並避免重複失敗迴圈。
6. 三個新場景「嘴砲夜市、金沙賭城、天安門廣場」只保留原圖、最佳化預覽與 metadata。資產鍵不冒充已整合 stageId，不碰場景載入、地面、邊界、出生點、鏡頭或 server 選圖。

## 需要重新提供的檔案

請將 `美術圖.zip` 拆成每包 **小於 32 MiB，建議 25 MB 以下** 的獨立 ZIP，或直接分批上傳原始圖片。建議按下列方式分包，保留原檔名：

- 維尼：Fullbody，及已有的 Portrait／HUD。
- 塞子：Fullbody，及已有的 Portrait／HUD。
- 金沙賭神：Fullbody，及已有的 Portrait／HUD。
- 阿志：Fullbody，及已有的 Portrait／HUD。
- 場景：嘴砲夜市、金沙賭城、天安門廣場；若仍超過限制，再按場景各一包。

不需要為拆包另找圖片或重新生成；需要的是使用者已製作的原素材。尚未讀到 ZIP，以上是需求用途清單，不是聲稱壓縮檔中確有這些檔名。

## 本次已完成驗證

- `npm run check`：通過。
- `npm test`：179 通過，0 失敗／略過。
- `node --test test/browser/arcade-phase1.test.cjs`：6 通過，0 失敗／略過；實際 Chromium 驗證六入口、導航／返回、連線保護、舊存檔、桌面與手機布局。
- 檢查主引擎、隊伍核心、Rollback、presentation、engine 子模組及圖集的 SHA256，共 15 個保護檔案；保持未改動。
- 沒有獨立 build 指令，專案為原生 JS 靜態服務；不可將不存在的編譯步驟列為成功。
- 新圖內容、透明背景、深淺底邊緣、最佳化輸出與新圖整合仍未驗證，因素材尚無法傳入工作區。

本次不是 Phase 1.5 完成驗收；需取得可讀素材後繼續。本階段未進行 Phase 2 或 Phase 3 功能開發，未連線 VPS。
