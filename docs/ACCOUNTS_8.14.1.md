# 8.14.1 — 玩家帳號與一次性救援碼

此版為 8.14.0 的後續修改，使用者已另行授權推送 GitHub；未部署 VPS。沿用 `feat/arcade-phase1`，不修改戰鬥引擎、角色數值、Sprite、Rollback 或既有遊戲模式。

## 已完成並驗證

- 玩家帳號／密碼註冊與登入；帳號 3–32 位英數與底線、不分大小寫且唯一，暱稱 2–16 字，保留四角色頭像及偏好設定。密碼繼續使用 Argon2id。
- 不收新 Email、不要求驗證、不寄信、不提供 Google 登入；移除郵件與 OAuth 的執行模組及兩項相依套件。舊驗證／寄信／Google API 回覆 404。
- 註冊自動建立會話，先顯示一次性救援碼；提供複製、手動選取及下載，勾選已保存後進入個人資料。明碼只存在該次回應及目前畫面記憶體，不寫入 localStorage、資料庫或日誌。
- 救援碼具有 192-bit 隨機性，資料庫只存 SHA-256。重設密碼以玩家帳號＋救援碼驗證，鎖定帳號資料列後消耗舊碼、變更密碼、撤銷全部會話並提供新碼。兩個同時送出的重設請求只有一個成功。
- 玩家可在個人資料以目前密碼及 CSRF 產生新救援碼；舊碼立即失效。密碼與救援碼都遺失時無法自助找回。
- 快速／排位匹配保留真實雙人流程。後端直接檢查有效登入、active 帳號、是否已被其他比賽占用、延遲與賽季；取消 Email 條件。停權帳號不能登入、預約或完成正式積分結算。
- PostgreSQL Migration 003 保留既有 UUID、密碼雜湊、會話及對戰關聯。舊密碼帳號保留原登入識別字相容入口，產生 UUID 衍生的穩定玩家帳號並顯示於私人資料頁；登入後可建立救援碼。舊 Email 資料只保留歷史相容用途，不對外暴露；未用 Email token 失效。原 Google-only 帳號若沒有密碼，須另由營運者核實身分處理，不能憑空產生救援碼。
- 原 IP／HTTP 網址可使用，不需要網域。必須設定完整 APP_ORIGIN，並明確設定 ALLOW_INSECURE_HTTP=true；Origin、CSRF、HttpOnly、SameSite 保留。HTTPS 自動使用 Secure Cookie。

## 測試

- `npm run check`：通過。
- 隔離 PostgreSQL 16 執行 `npm test`：**228 通過、0 失敗、0 跳過**，包含資料遷移、救援碼重用／競爭、會話撤銷、CSRF、隱私、限流、帳號停權、真實 WebSocket KO／重連／排名保存。
- `test/browser/ui-overhaul.test.cjs`：**4 通過、0 失敗、0 跳過**，實際 Chromium 驗證多尺寸 UI、無 Email 註冊／保存救援碼／登出／重設／新密碼登入，以及兩個隔離瀏覽器工作階段的快速匹配、真實扣血、排位與戰績保存。
- 修正瀏覽器驗證發現的登入表單更新競爭：登入狀態變化後的週期刷新不再清掉正在輸入的帳號／密碼，並加入明確回歸斷言。
- 正式依賴 `npm audit --omit=dev`：0 已知漏洞；Argon2 原生執行檢查及部署 Shell 語法通過。
- 本次未重跑上一版耗時的全部 60 個瀏覽器案例，未宣稱其為本版新結果；本次全數 Node 測試與受影響的四個瀏覽器整合案例已執行。

## 主要修改

`server/accounts.js`、`server/migrations/003_username_recovery.sql`、`server/online.js`、`server/ranked.js`、`server/services.js`、`public/player-system.js/css`、兩個 HTML 入口、依賴鎖定檔、環境範例及部署說明。移除 `server/mailer.js`、nodemailer、jose。測試隨新契約更新；原有兩份 Migration 不變，維持校驗碼。

## 手動部署

請依 [ONLINE_DEPLOYMENT.md](ONLINE_DEPLOYMENT.md) 建立專用 PostgreSQL 並備份、執行 `npm run db:migrate`。正式環境從外置 `/etc/azhi71.env` 載入 DATABASE_URL，直接在 shell 執行 npm 不會自動讀取這份檔案；文件提供 systemd-run 指令。不需要購買網域或設定 SMTP。

使用現有 IP 網址時：

```ini
APP_ORIGIN=http://YOUR_VPS_IP:18071
ALLOW_INSECURE_HTTP=true
```

將 YOUR_VPS_IP 換成瀏覽器實際使用的 VPS IP；18071 是原 Nginx 對外埠，不是 Node 的 31071。賽季只是資料庫中的起訖設定，不需第三方服務，需選定時間後手動啟用。應用程式版本須顯示 8.14.1。

HTTP 不加密帳號密碼、Cookie 或救援碼；此模式須明確啟用，請使用獨立遊戲密碼。未宣稱 HTTP 已具有 TLS 安全性，也未在正式 VPS 或實體跨網路裝置驗證。

先在預備環境確認註冊／救援／雙人匹配後再合併。不要刪除資料表回退；新玩家帳號不能直接改回只支援 Email 的舊版登入程式，回退須保留相容帳號服務及備份。
