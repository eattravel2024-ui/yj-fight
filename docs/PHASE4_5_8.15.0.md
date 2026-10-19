# Phase 4.5 — 8.15.0

本機分支 `feat/phase4-5-grapples`，沿用 `81d06d7`（8.14.1）既有系統；未推送 GitHub、合併 main 或部署 VPS。沒有新增依賴、Migration、Port 或服務。戰鬥調整需玩家實測後再評估平衡，不宣稱正式競技平衡已完成。

## 實裝

- 阿志：12F buffer；→+K「三百起步・突進拳」、I 真實上升對空、→+O「加滿三百・收工連打」（60 能量／最多三段）；保留 U／O。H「加油站快摔」16 HP、中立傷害。
- 金沙賭神：更短的試探輕拳、↓+K「我沒梭哈・假動作」（無攻擊框／傷害／能量收益）、→+U「籌碼衝擊」（25 能量／單枚實體彈道）、O 原技能 ALL IN；H「莊家通吃・換位摔」18 HP 與實際交換位置。
- 四角色共用地面抓取／雙向綁定／抓空收招；10F H 解摔與 3F 預輸入、零傷害分離、單次落地扣血、防連抓、第三人打斷、KO／回合解除。所有階段使用模擬幀，1v1／2v2 共用，回滾與觀戰可還原。
- 新招式有集中幀表、攻擊框、取消與能量限制；新增路線不可繞回輕拳形成循環。按鍵邊緣記錄方向，避免短按方向在下一 tick 前放開而出錯招。技能說明／實際扣血、解摔提示與既有音效連動；假動作在判定框顯示模式亦可安全繪製。
- 兩角色站立、移動、攻擊、技能、受傷、勝利與投技重排既有透明關鍵姿勢，配對座標／動作列跟隨真實狀態；追加籌碼與連打效果，尊重減少動態效果設定。大招 cut-in 使用實際招式名稱並避開血條。
- `立法院.zip` 的「立法院地圖.png」原檔完整保留（1672×941），產出 background／preview／combat WebP。四張地圖、VS、街機最終關與線上選圖池接入真實原圖；地面／出生點／固定攝影機不改。單層圖片，暫用已存在的 `stage_fur_lab` 原創配樂。

## 素材邊界

兩段原 MP4 各約 10 秒、1280×720／24fps，含背景、外部 HUD、鏡頭與特效、沒有 Alpha。已檢視抽樣畫格並記錄動作時間段；沒有把不可靠去背的影片畫格放進 Sprite。原片與原始透明姿勢圖保留，motion-map 記錄 17×10 動作序列與來源雜湊，可用現有打包工具重建為一致 bytes。

仍缺乾淨透明逐幀、真正中間張、專用抓取／被摔角度及立法院專曲。目前是可用的透明關鍵姿勢重組與投技演出，不是新繪完整動畫。維尼／塞子 Sprite、原始 pose sheets、server.js 及 rollback.js bytes 保持原樣。

## 主要檔案與規範

| 檔案／目錄 | 用途 |
|---|---|
| `public/engine/grapples.js`、`core.js`、`team-core.js` | 抓技、傷害、同步與解除綁定 |
| `public/engine/{frame-data,commands,boxes,animation,ai}.js` | 幀表、方向捷徑、取消、框、動畫與 CPU |
| `public/{game,team,presentation,combat-coach,skill-vfx}.js` | 控制、演出、音效、提示與觀戰 |
| `assets/source-video/phase4_5/`、`tools/build_azhi_video_atlas.py` | 原片、來源 manifest 與透明 pose motion-map／打包 |
| `assets/source-art/phase4/stages/`、`public/art/stages/legislature/` | 原始地圖與最佳化衍生圖 |
| `assets/source-art/phase4_5/` | 保留 8.14.1 基準並記錄授權保護 Hash 變更 |
| `AGENTS.md`、`PROJECT_ARCHITECTURE.md`、`CHARACTER_SPEC.md`、`UI_STYLE_BIBLE.md` | 精簡開發規則、實際架構、角色規格、既有 UI 規範的更新；詳細文件在 docs/ |

## 驗證

- `npm run check` 通過；此為原生 JS／Canvas 專案，無 bundler 或獨立 `npm run build`，沒有虛報 Build。
- 使用隔離本機 PostgreSQL：`npm test` **254 通過、0 失敗、0 跳過**。包含實際兩 WebSocket＋觀戰、伺服器招式／能量驗證、四人隊友排除／打斷、混合動作狀態檢查、1v1／2v2 在真實摔投扣血後收到延遲解摔並回滾至相同 Hash。
- Chromium 相關瀏覽器測試 **20 通過、0 失敗、0 跳過**，涵蓋 Phase 3／4／4.5、HUD、Custom Match 與 UI：真實鍵盤、兩瀏覽器 Ready／解摔／同步 HP、立法院、招式／能量、街機 KO／Time Over／重試／下一關、2v2／觀戰與橫向布局。修正後重驗 Phase 4.5，截圖位於忽略的 `artifacts/phase45/`。
- Python 地圖匯入測試 **3 通過**；runtime native dependency、部署 shell 語法與 `git diff --check` 通過；兩角色 atlas 重建後 bytes 一致。
- 未測實體跨裝置／跨區 WAN、長時間競技平衡與低階手機 FPS；未執行完整 `npm run test:e2e`，只跑上述相關檔案。沒有正式 VPS 或正式 DB 測試。

回退可在之後另行授權發佈時使用原部署腳本的完整目錄備份；本版沒有 DB schema 變更。現階段從 GitHub 拉舊分支仍是 8.14.1，不會取得未發佈的 8.15.0。
