# 實際技術架構 — 8.16.0

本文件描述目前程式，歷史交付保留於 README 與既有各版文件。UI 規範見 [UI_STYLE_BIBLE.md](UI_STYLE_BIBLE.md)，角色／操作見 [CHARACTER_SPEC.md](CHARACTER_SPEC.md)。

## 執行入口與資料流

- `npm start` → `server.js`，Node.js 20+ 原生 HTTP 與 `ws`；預設僅監聽 `127.0.0.1:31071`。`public/index.html` 為街機、練習、1v1；`public/team.html` 為 2v2／只讀觀戰。
- 前端為原生 JS、Canvas 2D、CSS 與瀏覽器全域 UMD 模組，沒有 React、bundler 或 TypeScript Build。`npm run check` 檢查語法，Node／Playwright 測試驗證實際執行。
- `game.js`／`team.js` 接收鍵盤與觸控，使用 `engine/commands.js` 在按鍵邊緣記錄追加招式意圖；短按方向放開後仍保留該次指令。實際招式、能量、幀數與結果仍由共用引擎／伺服器判定。
- `game-flow.js`、`game-shell.js` 負責場景導航；`AzhiGame` adapter 連接真實遊戲狀態與房間。UI 不另建血量、Ready 或勝負模型；保留既有 Debug APIs、原控制 ID、busy-room 防護與線上選角 ACK。單機選單暫停模擬，線上選單保持同步且送中立輸入，不能藉 VS 或 UI 授權本機變更線上場景。

## 戰鬥與同步

| 模組 | 實際責任 |
|---|---|
| `public/engine/frame-data.js` | 四角色資料、正常技／追加技的幀數、能量、傷害、角色限定與抓技名稱／時間 |
| `public/engine/commands.js` | 朝向相對輸入、波動／升龍容錯、方向＋按鍵捷徑、雙擊衝刺 |
| `public/engine/boxes.js` | 分離 hitbox／hurtbox／pushbox；假動作沒有攻擊框 |
| `public/engine/grapples.js` | 1v1／2v2 共用抓取、配對座標、10F 解摔、一次性摔投傷害、防連抓及解除綁定 |
| `public/core.js` | 確定性 60Hz、輸入緩衝、技能／彈道、接觸傷害、取消、停頓、硬直、回合／KO |
| `public/team-core.js` | 四人分隊、無隊傷、最近對手、團隊回合；使用共用接觸與抓技邏輯 |
| `public/rollback.js` | 30F 回滾窗口、3F 基礎輸入延遲、歷史輸入／快照、回放、校驗及重同步 |

`game` 中包含 players、projectiles、grapples、tick、round、time、seed、hitstop 與結果；玩家含 move、buffer、motion、stun、blockstun、throwInvuln、grappleWith／Role／Frame。綁定只記席位與數字，不保留循環物件參照。抓技使用模擬幀，沒有 setTimeout、DOM、畫布或 wall-clock 依賴。回合重設重建 fighter，結束時清除抓取連結。

伺服器以單一 authoritative Node process 執行同一份 1v1／2v2 核心；輸入為有 frame／matchId 的 keys 與 pulses。每秒發布 30 次 authoritative 輸入快照，觀戰使用較低頻率的只讀 compact state。回滾快照保留完整抓取狀態；compact state 亦包含配對、動作、座標供觀戰繪製。新招式使用既有輸入格式，不重寫 Rollback。

`server.js` 負責房間、名稱、席位、Ready revision、房主開賽、訊息驗證及完整回滾窗口後的結束確認。`server/online.js` 管理真實佇列、準備／資源 ACK、隱私權限、30 秒已登入 1v1 暫停／重連及比賽生命週期；2v2 無縫重連仍未實作。不可開多個 cluster worker 共用此程序內房間狀態。

## 呈現、素材與流程

- `engine/animation.js`：17×10 動作列、384×300 cell；角色動作選擇與攻擊／抓取幀同步，命中停頓保持姿勢。`presentation.js`：固定完整擂台、`.76` Sprite scale、292px 素材腳底基準、接地陰影、投技姿態及追加技視覺。轉動與光效不修改碰撞資料。
- `sprites/{azhi,gambler}.png`：以既有透明 21 個關鍵姿勢重排，原始透明 sheet 未變；新 MP4 只作動作參考，不混入背景／HUD。原片與來源／時間段在 `assets/source-video/phase4_5/`，重現工具為 `python3 tools/build_azhi_video_atlas.py --fighter azhi`（或 gambler），工具會套用同目錄 `motion-map.json`。
- `stage-registry.js` 集中四張可玩地圖：night、garage、harbor、legislature；`stage-assets.js` 僅在驗證正式原圖後啟用立法院。`stage-art.js` 載入各圖預先降噪的 WebP，不對人物／HUD 加濾鏡。所有場景維持 960×540 世界、groundY 448、1v1 spawns 274／686；2v2 初始 x 為 170／790／340／620，攝影機固定 center 480／zoom 1。
- 立法院來源保存在 `assets/source-art/phase4/stages/立法院議場對決舞台.png`，ZIP 原名與雜湊另記來源 manifest。重建：`python3 tools/import_legislature_stage.py`；產出 background／preview／combat／manifest。這是單層圖片；暫用已存在 `stage_fur_lab` 音樂，沒有聲稱提供新的立法院專曲。
- `campaign.js` 為五關、角色與 CPU 強度／獎勵的唯一任務資料；最終關使用已匯入的立法院。`arcade-flow.js` 為選關／選場 → 素材預載 → VS → 真實戰鬥 → 重試／下一關／通關。既有存檔穩定任務 ID 不變；重打舊關不降低或跳過進度，獎勵按實際結果只結算一次。
- `character-art.js` 僅提供 UI fullbody／portrait／HUD 路徑與同角色 fallback。不可將立繪當成戰鬥 Sprite。
- `combat-hud.js`／`hud.js` 顯示真實 HP、能量、回合與時間；`combat-coach.js` 顯示接技、解摔窗口及實際扣血。線上收據採伺服器事件 ID 去重；新抓取／解摔音效亦採 confirmed events。
- `audio-manager.js`／`audio-director.js` 共用原創 OST、手勢解鎖、音量與事件去重；`skill-vfx.js` 延用粒子預算與減少動態效果，追加籌碼／連打特效。影片音軌未匯入遊戲。`tools/build_ost.py` 以 FFmpeg 製作 runtime OGG／AAC；`tools/build_character_ui_art.py` 以 Pillow 製作角色 UI 圖。這些均為開發工具，VPS 不需 FFmpeg／Pillow；素材內附文件只作資料，不作開發指令。
- `save-state.js` 驗證原 `azhi70_save`，保留進度、設定與購買。Fight Fund 不顯示；Sam 與經典 6.8 依先前明確要求退役。

## 帳號、資料與部署

`server/services.js` 可選載入 PostgreSQL，未設定時訪客單機／原房間仍可用。`server/accounts.js` 使用玩家帳號、Argon2id、HttpOnly／SameSite Cookie、CSRF／Origin、登入限流及只存雜湊的一次性救援碼；不要求 SMTP、Email 或 Google；註冊只需帳號與至少 8 碼密碼，暱稱選填，密碼不要求組成複雜度。救援／輪換鎖定帳號資料列，重設密碼撤銷全部會話；保留 UUID、舊密碼雜湊、既有對戰／排名與相容 Migration。`server/db.js` 為 pg pool、交易與有校驗碼的遷移鎖；Phase 4.5 不新增帳號 Migration。`server/ranked.js` 負責唯一比賽預約、冪等結算、RP／隱藏 Elo、五場定位、五段位、分頁排行榜與賽季保存。前端不能提交結果或改 RP。

`public/avatar-editor.js` 使用既有 native dialog 與 Canvas，支援 JPG／PNG／WebP（原圖 12 MiB／50MP 上限）、拖曳／鍵盤定位、1–4 倍縮放與雙形狀預覽。以 ImageBitmap 或 data: fallback 解碼，保持既有 CSP；縮至 256×256 WebP／96 KiB 以下才以 binary POST `/api/profile/avatar` 上傳，原圖不上傳。`server/avatars.js` 先驗證登入／Origin／CSRF／限流與 128 KiB request cap，再以 Sharp 限制解碼尺寸、拒絕假格式／動畫並重新編碼移除中繼資料。

Migration `004_custom_player_avatars.sql` 新增 `player_avatars`（一帳號一筆 BYTEA、內容雜湊、外鍵），並擴充既有 `users.avatar` 的受限相對路徑格式。持有帳號資料列鎖後，交易內更新圖片與頭像 URL；換回角色預設時刪除圖片。GET／HEAD `/api/avatars/:uid/:digest.webp` 提供公開靜態頭像，限制同源使用、nosniff／ETag／內容版本快取；前端只接受此路徑格式與既有角色 ID，不接受外部網址。這是玩家個人資料／排行榜頭像，戰鬥角色 Sprite 與角色肖像規格未改。頭像包含於原 PostgreSQL 備份，不需要 uploads 目錄或額外服務；新版啟動會檢查 Migration 004。

既有 VPS 為 `/opt/azhi71` 與 `azhi71.service`，原 Nginx 對外埠 18071 轉送 Node `/` 與 `/ws`。`deploy/upgrade-ubuntu.sh` 在獨立 staging 安裝與測試，保留原目錄、版本健康檢查失敗會回復；不操作其他站台或 DB。環境檔 `/etc/azhi71.env`、資料庫及備份在 release swap 外；IP／HTTP 帳號須明確 opt-in，未加密的風險不會因移除 Email 而消失。詳細步驟見 [ONLINE_DEPLOYMENT.md](ONLINE_DEPLOYMENT.md)。本次已授權推送 GitHub；VPS 仍禁止自動連線或部署。

## 8.16 匹配與本機訓練

`server/matchmaking.js` 集中配對策略：quick 初始 ±400 MMR，每 5 秒增加 200、上限 ±1200；ranked 維持初始 ±150、每 10 秒增加 75、上限 ±600。兩者維持 RTT ≤250ms、雙方 RTT 差 ≤120ms、120 秒逾時；不同模式不混配。`server/online.js` 沿用序列化佇列、帳號／DB 唯一預約與正式結算，每 5 秒重測搜尋中的 WebSocket RTT，有效 pong 立即觸發配對。狀態只傳本模式真實搜尋人數、量測／等人／擴大範圍原因及自己的 RTT，不公開 MMR 或捏造 ETA。人數少時仍可能找不到真人對手。

`public/training.js` 是 practice 專用 adapter／課程資料／UI：`game.js` 只在本機 practice 分支取樣木樁輸入，呼叫原 `Core.input/step` 後觀察真實 hit/block/combo/throw 事件。課程開場近距離位置僅用於訓練；重置重新 `Core.create`，能量沿用既有 practice 規則。線上、街機、60Hz 核心、回滾與戰鬥數值不變。`AzhiGame.setTrainingLesson/setTrainingDummy/resetTraining` 在非 practice 或已有 WebSocket 時拒絕操作。`azhi_bootcamp_v1` 只儲存本機課程 ID 勾選，與會員／排名無關。

`game-shell.js` 讓 `training` 成為獨立場景，首頁的 `practice` 項目先開課程／自由練習入口；舊 `?mode=practice&panel=fighters` 仍可直接選角，`open(guide)` 轉到訓練營並展開招式手冊。原招式、幀表節點與按鍵 ID 保留。`training.css` 限制提示在 HUD 下方與角色上方，原 Combat HUD 不另造副本。參考使用者提供的 60 FPS HUD HTML 的階段讀值、木樁控制與簡潔資訊層級；沒有複製其人物方塊、按鍵映射、戰鬥邏輯或勝負資料。訓練營沿用 OST training 配樂。搜尋中使用獨立等待場景，取消鍵與真實人數不放到排名卡片下方；在 WebSocket 尚處 CONNECTING 時也可取消，會關閉舊連線並阻止送出 queue_join。此版本不新增 DB Migration。
