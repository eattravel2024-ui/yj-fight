# 戰鬥可讀性與 HUD — 8.11.2

日期：2026-10-16（UTC+8）。基準 `fe94bdf`／8.11.1。依本次附件改版，並依最新指示刪除獨立「經典冒險 6.8」。街機、練習、1v1、2v2、觀戰、命名、Ready、存檔與原 OST 保留。沿用現有分支，不建立分支堆疊；附件明確禁止推送遠端，因此只做本機紀錄點及來源包，不操作正式 VPS。

## 已完成

- `combat-hud.js/css`：把既有原生 HUD、技能按鈕搬入實際場景容器；保留 control IDs、快捷鍵與真實資料來源。左右 HP、正式角色 HUD 頭像、勝回合菱形與中央金色時間；危險時間僅用柔和警示。
- 能量位於底部雙側，讀取原有 0–100 能量；U 25／O 60 的可用、硬直、接技及能量不足狀態仍由核心計算。技能區改為兩條精簡資訊，現有接技教練與命中傷害收據縮小，手機仍使用獨立觸控按鈕。
- HP 立即更新數值，fill 平滑變動、殘影停留後消退、低血量變色、頭像受傷回饋。修正結算時舊 `renderCharacters()` 將 HUD 重設成預設滿血的問題；比賽結束後持續更新視覺殘影，不改 HP。2v2 重用既有 DOM 節點，不每次重建血條／頭像。
- ROUND／FIGHT 讀取既有登場影格，沒有增加戰鬥等待時間；KO／TIME OVER 取真實回合事件，WINNER 取正式完成結果及勝方角色肖像。線上只在 confirmed events／match_complete／正式 watch packet 接入 KO／勝敗。原 Audio Manager 的短曲、ducking、去重照常使用，不新增播放器或重播音樂。
- 線上結束時保留勝利畫面；玩家自行返回房間後仍依原有 Ready／房主開始流程再戰。單機保留原有下一關／重試按鈕。場景只保留小型 ESC 選單入口，選單導航仍完整可用。
- 16:9 Canvas 依場景實際可用空間同比縮放，HUD 與畫布共享同一容器。ResizeObserver 配合觸控區尺寸，沒有裁掉舞台邊界、拉伸角色或修改鏡頭。尊重 reduced-motion。
- `stage-art.js` 使用三份戰鬥專用 WebP；原始背景及來源 PNG 完整保留。飽和度約 78–80%、亮度 90–91%、對比 92–94%，冷色混合 2.5%，輕微背景暗角。無全容器 CSS filter、無每幀背景濾鏡；角色、特效與 HUD 不受背景降噪影響。載入失敗依序回到原 WebP／既有 SVG。
- `presentation.js` 只更新緊湊登場名條與依跳躍高度變化的柔和接地陰影；戰鬥 Sprite Sheets、動作時間、角色數值與碰撞全部不變，基礎輪廓使用細微陰影。
- 刪除 `public/adventure-legacy-6.8.html`、`public/legacy.js` 與兩個客戶端的經典入口；舊網址回 404。僅移除經典冒險，不刪除「經典」角色配色或任何現代模式／存檔。

## 美術資料與保護

`tools/build_combat_backgrounds.py` 使用 Pillow，僅為作者端工具，VPS 不需安裝。`public/art/stages/combat-manifest.json` 記錄三張 1672×941 衍生背景的參數、用途、bytes 與來源／輸出 SHA256；共 1,204,118 bytes。遊戲仍按原 960×540 世界比例顯示，不改地面、出生點、舞台 ID 或相機。

保護清單只變更 `public/presentation.js` 的 hash；另外 20 份引擎／伺服器／Rollback／招式／atlas 等保護檔案完整不變。沒有更動伺服器協議或正式主機設定。

## 精簡驗證

- `npm run check` 通過；`npm test` **190 通過，0 失敗／略過**。專案沒有另外的 bundler build、TypeScript 或 lint 指令。
- 新增 **4 項瀏覽器案例**通過：真實 HP／能量與技能、1920×1080／1600×900／1366×768／1280×720 版面、KO／WINNER／重試；手機 844×390／reduced-motion／TIME OVER／下一回合；兩名真實玩家與晚加入觀戰；四個真實 WebSocket 玩家加瀏覽器觀戰的 2v2 四頭像／四血條／四能量。
- 既有 **3 項相關瀏覽器回歸**通過：桌面練習與技能、手機觸控、舊經典頁／腳本回 404。沒有額外重跑整套長時間瀏覽器套件。
- 勝敗／時間測試以最小狀態 fixture 促使真實引擎產生事件，不用假計時器模擬 KO；連線案例使用本機測試伺服器，不是正式 VPS／兩台實體裝置。
- 完成實作 → 真正截圖檢查 → 修正提示遮罩與結算 HP → 重新驗證。最後相關修正重跑通過，不重複加總測試數。

截圖（開發產物，未納入版本庫）：

- `coverage/combat-before-8111.png`：從未修改的前版 Git 快照啟動，相同練習場景。
- `coverage/combat-after-8112.png`：新版實際戰鬥及技能命中。
- `coverage/combat-winner-8112.png`：正式勝方與 0 HP 收尾。
- `coverage/combat-mobile-8112.png`：手機橫向觸控。
- `coverage/combat-spectator-8112.png`／`coverage/combat-team-8112.png`：唯讀觀戰與四人 HUD。

## 尚待改善與交付

未新增正式勝利逐幀美術，使用既有動畫及肖像；未做長時間 FPS／硬體音訊／實體手機效能驗證。16:9 與非 16:9 裝置保留必要的比例留白；觸控區獨立保留，避免遮住角色。沒有新增第四張地圖、選圖頁或更改平衡。

本機固定標籤 `checkpoint-combat-hud-8.11.2`。來源包 `dist/azhi-fighting-8.11.2.tar.gz`。部署請使用 [MANUAL_RELEASE.md](MANUAL_RELEASE.md) 最上方來源包流程；尚未推送 GitHub，不能用遠端 8.11.2 標籤部署。建議先以來源包在測試時段試玩，再決定是否推送／合併；沒有合併 main。需要回退可用升級腳本輸出的完整備份，或前版已發布的 `checkpoint-audio-8.11.1`。
