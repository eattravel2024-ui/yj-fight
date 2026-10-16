# 8.14.0 — UI v2、玩家帳號與線上競技交付

本版在 `feat/arcade-phase1` 完成本機修改，基準為 `052ef5adc711062221e0a339b60d0ab0dadda8a4`。使用者後續已明確授權建立紀錄並推送 GitHub；正式 VPS 仍由使用者手動更新，沒有連線、部署或重啟。

## 已實作並實際驗證

- 共用深色／青色／洋紅／金色 Token、斜切構圖、動畫節奏、鍵盤焦點與減少動態效果。主選單左側模式列表、右側金沙賭神／阿志主視覺；移除常駐網站導覽及遮擋人物的標語。
- 四角色大型選角、中央 roster、真實招式資料、取消／確認與快速切換動畫清理。未修改技能、角色戰鬥數值或 Sprite Sheets。
- Battle Room 改為角色立繪、真實玩家席位與 Ready／房主開始；建立、加入和設定輸入移至對話框。保留 1v1、2v2、觀戰、房名及暱稱。
- 大型地圖預覽／縮圖、實際 BGM 資訊、VS、原有 Combat HUD、真實結果與街機重試／下一關。三張已匯入場景維持原始比例、背景降噪及既有碰撞／地面／出生點。
- PostgreSQL migration、Argon2id 密碼、會話／CSRF、限流、一次性驗證與重設密碼 Token、預設角色頭像及玩家資料。訪客可直接玩街機／練習。
- 兩個獨立瀏覽器帳號實際登入、搜尋／取消、匹配確認、素材 ACK、既有引擎對打、同步扣血、伺服器結算及戰績保存。另以兩個真實 WebSocket 執行引擎 KO、斷線暫停／重連、私房權限、重賽與過期釋放測試。
- 伺服器專用 RP／隱藏 Elo、五場定位、青銅／白銀／白金／鑽石／菁英、III→II→I、排行榜搜尋／分頁、賽季歷史及 CLI 軟重置。結算具唯一比賽預約、交易與冪等保障；前端不能提交勝負、HP、RP 或 MMR。
- 已確認註冊自訂 1v1 的正式結果保存及重賽產生新 Match ID；伺服器重啟／雙方斷線／不公平中斷作廢而不扣 RP。正式積分仍須有效登入、Email 驗證及已啟用的具日期賽季。

## 驗證結果

| 項目 | 結果 |
|---|---|
| `npm run check` | 通過；既有與新增 JS／工具語法檢查 |
| `AZHI_TEST_DATABASE_URL=… npm test` | **227 通過，0 失敗、0 跳過**；獨立本機 PostgreSQL 16 測試 schema |
| `AZHI_TEST_DATABASE_URL=… npm run test:e2e` | **60 通過，0 失敗、0 跳過**；實際 Chromium／Playwright |
| Python 地圖匯入器 | **3 通過**；臨時測試素材不會啟用正式立法院地圖 |
| 部署腳本／正式依賴 | Shell 語法、暫存安裝／失敗回復測試、原生 Argon2id 執行檢查通過 |
| 正式相依套件稽核 | `npm audit --omit=dev`：**0 已知漏洞**，不等同完整安全稽核 |
| 保護檔案 | 戰鬥／Rollback／Sprite／原始美術 hash 通過；Phase 5 只授權保護清單中的 `server.js` 變動 |
| Build／Typecheck／Lint | 專案是直接提供靜態 JS／Node 的架構，沒有獨立 bundler、TypeScript 或 Lint 任務；未虛報這些檢查 |

瀏覽器已檢查 1920×1080、1600×900、1366×768、1280×720、1024×640、844×390 與 390×844。完成「實作 → 截圖檢查 → 修正 → 重新驗證」：修正焦點造成橫向偏移、轉場期間確認按鈕超出視窗、房間選項對比、未提供地圖標籤重疊與登入後開啟驗證／重設連結的問題。沒有宣稱測得實體手機或跨網路 60 FPS；60Hz 為原有模擬頻率。

## 主要檔案與畫面

- 設計規範：[UI_STYLE_BIBLE.md](UI_STYLE_BIBLE.md)；已加入 `AGENTS.md` 後續開發指引。
- 共用場景與流程：`public/design-system.css`、`game-shell.js`、`game-flow.js`。
- 選角／房間／選場：`public/character-select.js`、`custom-room.js`、`arcade-flow.js`。
- 玩家／排位 UI：`public/player-system.js`、`player-system.css`、`rank-rules.js`。
- 真實後端：`server/{db,accounts,mailer,services,online,ranked}.js`、`server/migrations/`、`server.js`。
- 部署與管理：`deploy/`、`tools/db-migrate.cjs`、`tools/season.cjs`、`.env.example`、[ONLINE_DEPLOYMENT.md](ONLINE_DEPLOYMENT.md)。

實際截圖保留在本機 `artifacts/ui-overhaul/before/` 與 `after/`；沒有放入 VPS 原始碼包或 Git，避免打包測試玩家資料。主要 After：`main-menu-1600.png`、`character-select-1600.png`、`stage-select-1600.png`、`battle-room-ready-1600.png`、`versus-1600.png`、`online-combat.png`、`match-found.png`、`ranked-placement-result.png`。

## 已實作但需要正式環境設定／驗證

- SMTP 與可選 Google OAuth adapter 已完成；缺少正式憑證，未驗證真實收信／Google 提供者登入。測試使用隔離帳號與郵件測試 adapter，未冒充正式寄信成功。
- PostgreSQL、HTTPS／WSS、外置環境檔、備份及獨立 systemd 設定已提供；正式 VPS、跨網路延遲、實體裝置、容量與故障注入尚未驗證。
- Season 01 預設為 **draft**，不猜測上線日期。營運者需選定起訖日期後啟用；未配置資料庫時單機仍可玩，會員／競技會明確顯示未設定。

## 尚未完成與限制

- **立法院原始 `立法院議場對決舞台.png` 尚缺**，STAGE 04 保留停用與匯入入口；目前可玩地圖為嘴砲夜市、金沙賭城、天安門廣場。絨毛禁區是未來 STAGE 05。
- 尚未加入 Gamepad、任意頭像上傳、2v2 無縫重連、跨節點分散式匹配、帳號自助匯出／刪除及完整反串通管理。頭像目前可選四個正式角色。
- 本版只支援 **一個 authoritative Node process**。不要開多個 PM2／cluster worker 共用此競技資料庫。新增賽季獎勵只有後續擴充規劃。

## 發佈與合併建議

可先使用 `dist/azhi-fighting-8.14.0.tar.gz` 手動更新原有遊戲，未設定資料庫時保留訪客遊玩。完整會員／排位先依 [ONLINE_DEPLOYMENT.md](ONLINE_DEPLOYMENT.md) 在預備環境配置資料庫、SMTP、HTTPS 及賽季，再以兩個不同帳號完成外網驗收後合併。本次按使用者追加授權發佈至 `feat/arcade-phase1`；沒有建立遠端 PR、自動合併或部署正式環境。

升級腳本保留原 `/opt/azhi71.backup.TIMESTAMP` 並在健康檢查失敗時回復；資料庫須另行備份，應用程式備份不包含玩家資料。不要為 UI 回退刪除資料表；遷移、賽季啟用及正式服務操作均由營運者手動執行。
