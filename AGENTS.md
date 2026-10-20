# 陪公子練武 — 開發規範

目前版本 **8.16.0 / 線上匹配與新手訓練營**；沿用現有 HTML Canvas／Node 專案，不重建引擎或另做展示對戰。

## 任務開始時

先讀 `README.md` 與 `docs/ROADMAP.md`，再按任務閱讀：

- [實際架構與模組入口](docs/PROJECT_ARCHITECTURE.md)
- [角色 ID、招式、動畫、操作與抓技規格](docs/CHARACTER_SPEC.md)
- [正式 UI 與互動規範](docs/UI_STYLE_BIBLE.md)
- [手動部署、資料庫與帳號設定](docs/ONLINE_DEPLOYMENT.md)

歷史開發決策沿用既有各版交付文件與 Git 歷史；不要另寫重複或相互矛盾的規格。

## 不可破壞的原則

1. 保留確定性 **60Hz** 模擬；繪圖、音效、動畫時鐘不得改變戰鬥結果。新增狀態必須能被 Rollback 完整複製、回放及雜湊。
2. 保留四角色 `winnie`／`sezi`／`gambler`／`azhi`、街機進度、練習、1v1、2v2、觀戰、暱稱／房名、Ready、匹配、帳號、排名與原創配樂。Sam 與已退役的經典 6.8 不得恢復；Fight Fund 不回歸。
3. 接觸傷害與抓技由 `core.js`／`engine/grapples.js` 共用於 1v1／2v2。防止重複扣血、隊傷、無限抓取、綁定殘留；解摔、第三人打斷、KO、回合結束與延遲輸入均需測試。招式方向在按鍵邊緣取樣，伺服器仍驗證角色、能量與招式。
4. 線上輸入、Ready、權限、勝負、RP/MMR 與正式結算由伺服器驗證；不接受前端 HP、勝負或積分。保留完整 30F 回滾結果確認窗口、交易與冪等結算。觀戰不得取得操作者權限。
5. UI 大立繪不得取代戰鬥 Sprite；原始影片／PNG／透明姿勢圖保留，不覆寫。MP4 沒有 Alpha 時不得宣稱已可靠去背；不把場景／外部 HUD 混入角色圖。不引入未授權 KOF／SF 素材。公開發佈前仍須確認原始素材與肖像的發佈權。
6. 四張正式地圖為嘴砲夜市、金沙賭城、天安門廣場、立法院；保留廣場與坦克。場景是單層完整圖片，不宣稱多層視差。地面 448、1v1 出生點 274／686、固定攝影機與角色比例不可默默更改；絨毛禁區為未實裝 STAGE 05。
7. 自訂頭像使用 `server/avatars.js`／`public/avatar-editor.js`；只儲存驗證過的 256×256 WebP 於 PostgreSQL，先套用 Migration 004。不可使用任意外部 URL、繞過 session／Origin／CSRF、上傳原圖或在 release swap 內存玩家檔案。帳號僅需玩家帳號／至少 8 碼密碼（無組成要求）／一次性救援碼，暱稱選填；仍以 Argon2id 雜湊。不恢復 Email、SMTP 或 Google 依賴。只存救援碼雜湊，禁止在日誌、GET／個人資料 API 或 localStorage 暴露明碼。保留 CSRF／Origin、會話撤銷、限流及舊帳號 Migration。公網 HTTP 必須明確設 `ALLOW_INSECURE_HTTP=true`，HTTPS Cookie 保留 Secure。
8. 不提交 `.env`、金鑰、帳號資料、DB 備份、正式日誌或部署憑證。測試只用隔離本機資料庫。不要將環境變數或憑證值印出。
9. 使用者已於 8.15.1 明確授權將當時帳號修改連同已完成的 Phase 4.5 推送 GitHub，提供手動部署指令；後續任務不把此項特定授權擴大為自動推送所有變更。使用者現已明確授權將 8.16.0 匹配／訓練營改動提交並推送既有功能分支。不得合併 main、連線正式 VPS、執行部署、改 Nginx／SSH／Docker／防火牆或重啟正式服務；實際部署仍由使用者操作。

## 驗證與交付

- 必跑：`npm run check`、`npm test`。需真實 DB 整合時，設定指向可拋棄 PostgreSQL 的 `AZHI_TEST_DATABASE_URL`；不可指向正式 DB。
- 匹配／訓練 UI 需跑 `test/browser/training.test.cjs`、`test/browser/ui-overhaul.test.cjs`；幀表／抓技相關瀏覽器驗證：`node --test --test-concurrency=1 test/browser/phase45.test.cjs test/browser/phase4.test.cjs`；完整套件為 `npm run test:e2e`。只回報實際執行的測試，區分失敗、跳過及未跑。
- 素材工具見架構文件。保護 Hash 使用 Phase 3 → 4 → 5 → 4.5 的授權鏈；保留原先基準，只更新使用者授權的項目，不以改 Hash 隱藏未授權修改。
- 使用現有 checkout 與功能分支；小迭代不要重複建立分支／worktree 或大量文件。一般技術選擇自行處理，避免無關重構。
- UI 修改需實際檢查比例、焦點、手機橫向及減少動態效果，修正後重驗；沒有實體裝置／跨網路測量就不可宣稱已完成或達成 60 FPS。
- 截圖放忽略的 `artifacts/`，來源包放忽略的 `dist/`。交付精簡說明動作／招式、抓技、素材限制、文件及測試；正式部署由使用者手動執行。
