# Phase 3 — 正式場景、街機與完整流程（8.12.0）

日期：2026-10-16（UTC+8）。基準：`f60960e`／8.11.3。使用者本次明確擴大 Phase 3，納入原先列在後續階段的 VS／結算；本次只交付這個範圍，不自行做排位、配對、重連或新地圖美術。

## 完成的玩家流程

- 街機：主選單 → 四角色選擇／明確確認 → 五關街機列表 → VS 預載／轉場 → 既有登場與 ROUND／FIGHT → 真實戰鬥 → KO 或 TIME OVER → 正式結果 → 下一關／重試／五關通關／返回選單。
- 練習：選角 → 三張正式場景選擇 → VS → 自由練習；確認後保存偏好場景，取消選圖不更改已保存偏好。
- 自訂：保留 1v1、2v2、觀戰、房名／暱稱、選角確認、邀請、Ready、房主開始、再戰；新增 VS 只在原伺服器登場倒數期間顯示，不暫停或拖慢網路比賽。中途觀戰不補播歷史 VS。

## 主要檔案與架構

| 檔案 | 用途 |
| --- | --- |
| `public/stage-registry.js` | 名稱、序號、主題、預覽／背景／降噪版本、BGM、單層標記與共用世界設定 |
| `public/campaign.js` | 五個穩定 mission ID、CPU、場景、難度、獎勵；進度遷移、解鎖與 encounter plan 驗證 |
| `public/arcade-flow.js/css` | 選關／選圖、鍵盤操作、載入／取消／重試、漫畫 VS、正式勝敗／通關結算 |
| `public/game.js` | 原客戶端串接真實建立／完成比賽，保存進度與一次性獎勵；CPU 強度取實際出戰 mission |
| `public/save-state.js` | 保留原 `azhi70_save`，新增可驗證的 `arcade` 與 `practiceStage` 欄位 |
| `public/character-select.js`、`game-shell.js`、`game-flow.js` | 確認角色後進入新流程；原五個主選單／分頁繼續使用，不把內部流程塞成一排導航 |
| `public/stage-art.js` | 沿用三張降噪背景及 bounded fallback，增加可重試的必要背景預載 |
| `public/audio-director.js`、`combat-hud.js` | 沿用同一 Audio Manager／HUD；掛接場景、單次 VS 與既有真實戰鬥事件 |
| `test/campaign.test.js`、`test/browser/phase3.test.cjs` | 資料／存檔／完整實際流程驗證；舊瀏覽器測試以共用 helper 走新的選擇流程 |

## 場景對應

| 序號 | 顯示名稱 | 正式模擬 ID | 實際來源 | BGM |
| --- | --- | --- | --- | --- |
| 01 | 嘴砲夜市 | `night` | `art/stages/night-market/` | `stage_night_market` |
| 02 | 金沙賭城 | `garage` | `art/stages/golden-casino/` | `stage_casino` |
| 03 | 天安門廣場 | `harbor` | `art/stages/tiananmen-square/` | `stage_square` |
| 04 | 絨毛禁區 | `fur_lab`（規劃） | 尚無正式美術，選項停用 | `stage_fur_lab` 已備妥 |

天安門仍使用原建築與坦克圖，沒有換成賭城。原始 PNG、原 WebP、預覽與 8.11.2 降噪衍生檔不覆寫。三張實裝場景都明確為 **單層完整圖片**，沒有宣稱多層視差。

所有場景保留目前公平的共同座標：960×540、地面畫布 Y=448、跳躍投影 0.82、世界邊界 48–912、本機出生點 274／686。registry 的設定會用於本機建立，與核心既有出生點相同；後續回合重設也一致。攝影機維持完整擂台、zoom=1，容器同比縮放，沒有改角色比例／戰鬥邊界或裁掉 HUD。2v2 原有四席出生點與伺服器規則保留。

背景降噪、柔和接地陰影與細微輪廓均重用 8.11.2；新 UI 不另建一套 HUD，不對角色／特效／HUD 套背景濾鏡。

## 關卡與存檔

五關依序為街頭試煉（阿志／夜市／強度 1）、蜜糖霸主（維尼／賭城／2）、白毛旋風（塞子／廣場／2）、金沙決勝（金沙賭神／夜市／3）、阿志逆轉（阿志／廣場／3）。不新增角色、Boss 專用作弊傷害或額外生命值。

舊 chapter 0–5 轉成穩定 mission ID 的連續完成前綴；格鬥幣、購買配色、勝場、連擊、聲音／特效與有效角色都保留。只有已解鎖 mission 可以建立 encounter，不能用選擇畫面跳過關卡。選擇已完成關卡可重打，勝利不倒退／跳躍最高解鎖進度；CPU 取該場 mission，不再誤用最高解鎖關卡的強度。

結果只讀真實引擎 `status=finished`／winner／scores／HP。每場有唯一 local serial 與完成 guard；重畫或重開結果不再加獎勵。勝利依既有玩法每場給予 registry 獎勵，失敗不扣幣；金幣／勝場增加上限為安全整數。末關勝利才呈現全五關通關，重闖第一關不抹除既有成就。

## VS、資源與音訊

本機在 VS 先驗證 encounter，等待必要背景與兩位戰鬥 atlas 解碼；失敗顯示重試／返回，不以空白角色假裝成功。背景可依原 fallback 回退；手動重試可恢復之前失敗的下載。5 秒有界等待避免永久卡住；取消、換畫面或新比賽會作廢舊回呼，不在稍後突然開戰。圖片使用既有最佳化 WebP，沒有載入原始高解析 PNG。

VS 用正式 UI 立繪、真實人物名稱與場景；支援減少動態效果。桌面 720／900 高度已實際檢查，修正主要按鈕與 VS 名稱擠出畫面的問題；手機可捲動內容並保留確認操作。

主選單／選角／選關／選圖分別路由 `menu`／`character_select`／`mission_select`／`stage_select`。一般戰鬥與練習使用實際場景 BGM；最終關沿用專用 `final_boss`。`training` 仍供未開戰練習待戰與設定試聽，沒有刪除曲目。VS 只播一次，ROUND／FIGHT、KO、勝敗沿用現有事件；結果音樂不因轉入結算頁而重啟。既有音量、預載、淡化、OGG／AAC、可信操作解鎖與音訊重試保留。

## 驗證

- `npm run check` 通過；`npm test` **196 通過、0 失敗／略過**。專案沒有獨立 bundler build、TypeScript 或 lint 指令。
- Phase 3 **4 項瀏覽器案例**：四角色／三場景的選擇、VS、HUD、單次 BGM、實際技能；真實 TIME OVER 敗北、重試、五關真實勝利、獎勵／解鎖／全通關與 reload 保存；素材失敗／重試／取消 VS 不延遲開戰；手機橫向鍵盤、觸控、16:9 與本機選單暫停。
- 額外 **8 項相關瀏覽器回歸**：完整 3 項自訂對戰；2 項實際連線／晚加入觀戰／四人房觀戰；未收到選角確認時的重試保護；已存第四關 CPU 對手；既有血量殘影、技能與重試。
- 完整街機測試以合法輸入呼叫真實核心／CPU，加速模擬步進；沒有直接設定 HP、time、wins、status 或 winner 來製造結果。畫面與獎勵仍由正常完成回呼處理，不增加正式環境用的作弊入口。
- 未宣稱另跑所有歷史瀏覽器案例、兩台實機、長時間 FPS／延遲壓測或正式 VPS。未改 server／core／team-core／Rollback／frame data／碰撞／atlas 等 21 份保護檔案。

截圖（本機產物，未納入 Git）：`coverage/phase3-stage-select.png`、`phase3-missions-720.png`、`phase3-versus-final.png`、`phase3-square-battle.png`、`phase3-defeat.png`、`phase3-complete.png`、`phase3-mobile-stage.png`。

## 待改善與交付

- 絨毛禁區待正式美術；真正多層視差尚未製作。
- 自訂對戰仍採伺服器既有場景設定；本次選圖開放街機／練習，沒有增加房主選圖協議。
- 既有 atlas 可再補手繪過渡幀；實體裝置效能／網路延遲壓測另行安排。完整配對、排位、帳號、重連仍未實作。

沿用 `feat/arcade-phase1`；固定里程碑 `checkpoint-phase3-8.12.0`，來源包 `dist/azhi-fighting-8.12.0.tar.gz`。部署見 [MANUAL_RELEASE.md](MANUAL_RELEASE.md)，回退固定 `checkpoint-custom-8.11.3` 或升級腳本備份。建議先按固定標籤試玩本次完整流程，再評估合併 main；本次沒有合併 main 或操作正式 VPS，完成後停止本階段。
