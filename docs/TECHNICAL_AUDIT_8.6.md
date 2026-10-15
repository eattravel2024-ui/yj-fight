# 8.6 技術健檢與分批合併計畫

日期：2026-10-15。基準提交：`00b6b96d323dde69d2cca7cd540f43b6f0484954`。
已完整閱讀 README.md、AGENTS.md、docs/ROADMAP.md；另審閱現有歷史健檢、核心、協定、前端、引擎與測試。
本次為健檢與規劃，不改動遊戲邏輯、角色、模式、依賴宣告或部署設定。使用者要求移除 Sam，優先於 AGENTS.md 的五角色保留條款；後續應單獨 PR 處理，所有遊戲模式仍保留。

## 結論與架構

目前適合本機開發，不建議把現況視為正式上線驗收完成。既有測試全部通過，但已確認未驗證角色欄位可使整個伺服器程序退出，須先修復。

HTTP 靜態資源及 WebSocket 房間集中在 server.js，記憶體 Map 儲存房間與連線身分；沒有資料庫或程序重啟恢復。服務端以 monotonic accumulator 驅動 60Hz 模擬，通常發送 30Hz 玩家同步與 15Hz 觀戰快照。延遲過大會限制補幀並捨棄累積時間，因此 FPS 常數不等於負載下可維持實際 60Hz。

core.js 和 team-core.js 分別實作 1v1／2v2，rollback.js 共用輸入歷史、預測、回放與完整 checkpoint。30 幀回滾窗約 500ms，預設輸入延遲 3 幀約 50ms；客戶端依 RTT 調至最多 8 幀。frame-data／commands／boxes／animation／ai 已拆分；名稱不寫入確定性狀態，這是良好邊界。

主要可維護性風險：大量多敘述單行程式碼、server.js 同時管理傳輸／授權／生命週期／排程、兩個 UI 複製連線邏輯、兩個戰鬥核心複製規則而已有差異。宜隨小型功能 PR 增加邊界與測試，避免先做全專案重構。缺少 lockfile，CI 的 npm install 每次可能解析不同版本；目前實裝 ws 8.22.0，宣告為 ^8.18.0。

## 功能盤點

| 能力 | 現況與驗證界線 |
| --- | --- |
| 街機／劇情、練習 | game.js 有章節、CPU、存檔及練習流程；核心測試通過，未完成瀏覽器通關驗收 |
| 1v1 | 真實本機 WebSocket 已驗證加入、自動開賽、frames、斷線通知；尚無兩台實機驗收 |
| 2v2 | 真實本機四連線已驗證四席開賽；單元測試涵蓋隊伍、無友傷、兩敵 KO、再戰 |
| 觀戰 | 真實連線已驗證 watch_start／watch_frame，未收到玩家 frames；無私密權限 |
| 命名／房主 | 有 NFKC、長度／字元白名單、重名與房主改房名檢查；不構成持久身分認證 |
| Ready／完整大廳 | 未實作；server.js:122 滿員即 begin，不能全員確認後由房主開賽 |
| 重連／恢復 | 未實作；server.js:49–65 leave 清空 session，斷線取消比賽 |
| 私密房／邀請授權 | 房號與 URL 分享存在，沒有區分玩家／觀戰授權的 token 或密碼 |
| 舊冒險模式 | 檔案保留，但 inline script 與現行 CSP 衝突；須修復以符合保留所有模式 |
| Sam | 仍在資料表、核心、章節、預設木樁、素材、工具與測試中；尚未移除 |

## 問題與優先級

### P0：未驗證 char 可造成程序級拒絕服務（已重現）

server.js:119 直接以外部 msg.char 索引 Combat.CHAR，未檢查字串與 own property。
隔離本機子程序透過真實 WebSocket 傳送 join，char 為不可轉為 primitive 的 JSON 物件，程序以 exit 1 結束並回報 TypeError。不需要房主或既有房間權限。另 C.create('constructor','azhi') 後 step 產生非有限座標，證明繼承屬性也能繞過角色判斷（core.js:17）。這不是 prototype pollution，而是屬性查找與型別驗證漏洞。

建議在任何 leave、房間配置前完整驗證訊息 schema；角色使用 typeof === 'string' 與 Object.hasOwn 白名單，核心入口也需防守。先加入真實子程序存活測試，再修復；覆蓋物件／陣列／null／constructor／__proto__／超長值及正常四角色／五角色過渡相容性。

### P1：2v2 預測結束可能卡在未確認狀態（程式路徑確認，待瀏覽器重現）

team.js:94–105 在 session.game.status === 'finished' 時停止 advance；syncCheckpoint（:40）對較新 checkpoint 僅存 pending，而 pending 只在 tick 前進後才套用。若預測 KO 後權威狀態取消 KO且 checkpoint 比本機新，將無法自行追上。match_complete（:63）也可能只更新顯示而未套用最終 session checkpoint。

應將預測結束與權威完成分離，允許同步繼續；超窗／終局使用可驗證的 hardSync。測試預測 KO 被晚到輸入撤銷、tab 暫停、最終 checkpoint 超前與重新開賽。

### P1：換房失敗也會取消原比賽（程式碼確認）

server.js:85、103 在驗證新 watch／join 目標前先 leave。既有玩家輸入不存在房號、重複暱稱或錯模式就可能退出並取消原賽局。改成驗證、保留／配置、提交切換的原子流程，並測試失敗時原席位與比賽保持不變。

### P1：私密與濫用邊界不足

房號隨機 4 bytes，且可自訂較短代碼；它只是定位資訊，不是身分憑證。任何知道房號者都能嘗試入場、觀戰並取得玩家／觀眾名稱。已有 maxPayload=4096、160 訊息/秒/連線、200 房、500 連線、24 觀眾、1MiB 背壓及 heartbeat；但沒有 IP／身分級配額，重新連線可重置配額，重放昂貴的回滾輸入也沒有 CPU 預算。

upgrade（server.js:79–81）有 Origin 與 Host 比對；實測未帶 Origin 仍可連線。這不等於已證明跨站攻擊，但瀏覽器公開入口應規定允許的 scheme／origin／host，非瀏覽器用途另定策略。TLS 由部署端負責，本次沒有查驗正式站設定。

### P1：舊冒險頁與 CSP 衝突（回應與內容已確認）

server.js:73 所有靜態頁共用 script-src 'self'，adventure-legacy-6.8.html:8 起使用 inline script 與 inline onclick，瀏覽器會阻擋。修復宜外移腳本與事件綁定，或設計精確 hash／nonce 相容方案；不要全站放寬 unsafe-inline。保留舊模式及存檔 key，加入瀏覽器可操作驗收。

### P2：戰鬥規則、演出與效能債

team-core.js 的傷害／霸體／飛行道具與 core.js 並不完全一致，例如 Sam 的 1v1 突進霸體未出現在 team hit 邏輯。使用者已要求移除 Sam，無需再為其補平衡，但其他角色仍需跨模式規則矩陣。不能直接把差異一律當錯誤，先確認設計。

回滾 replay 會重建 Session.events，但 server 的 playerEventBuffer／watchEventBuffer 不會撤銷先前排入的事件；狀態可收斂不代表演出事件也正確。應補 KO／命中事件撤銷與去重測試。

每幀 structuredClone 與 JSON hash／send、全房間單執行緒排程可能放大回放成本；尚未量測，不宣稱已達 200 房容量。貼圖預載與 team HUD 反覆建立 DOM 也是量測目標。美術具存在性／尺寸測試，不能替代畫面、手機操作、錨點與素材授權驗收。

## 實際檢查與覆蓋率

環境 Node 24.19.0／npm 11.9.0；所有請求只發往本機與必要的 GitHub／套件服務，未連線正式 VPS。

| 檢查 | 結果 |
| --- | --- |
| npm install --ignore-scripts --package-lock=false --no-fund --cache /tmp/yj-npm-cache | 通過；不建立 lockfile，保留依賴宣告 |
| npm run check | 通過；只是列出的 JS 語法檢查 |
| npm test | 80 通過，0 失敗／略過 |
| node --experimental-test-coverage --test test/*.test.js | 80 通過；已載入檔案行 94.85%、分支 79.71%、函式 87.72% |
| npm audit --omit=dev --package-lock=false --cache /tmp/yj-npm-cache | 當下解析到 ws 8.22.0，回報 0 已知漏洞；不代表自有程式碼安全 |
| bash -n deploy/*.sh | 通過，僅語法檢查；沒有執行部署 |
| 真實 HTTP／WS 煙霧測試 | health、主頁、team 頁、核心 JS、圖片 200；1v1、2v2 開賽，觀戰及斷線通知通過 |
| 錯誤 char 隔離攻擊測試 | 確認基準程序崩潰，屬已發現缺陷，不能列作安全通過 |

覆蓋率限制：game.js、team.js、legacy inline JS 未被執行，不在上述百分比的分母；不是全專案 94.85%。core.js 分支 87.21%、rollback.js 84.34%、team-core.js 67.33%、server.js 81.48%。多敘述單行與 stub 測試讓行覆蓋率偏樂觀；HTTP upgrade 真實處理不由 FakeSocket 測試證明。UI 部分測試只是字串／正規表示式斷言。沒有瀏覽器 E2E、兩／四台實體設備、跨網路延遲、壓測或正式安全滲透驗收。

## 小型 PR 計畫與驗收

先合併健檢文件；功能依使用者列出的 1→6 順序規劃，P0 安全修復先行。每項獨立分支／PR，先補測試再改協定；不可一次提交全部功能。

| 順序／分支 | 設計範圍 | 必須通過的驗收 |
| --- | --- | --- |
| 0 fix/ws-message-validation | 驗證 schema／角色 own property，拒絕不應改變房間狀態；鎖定依賴另開小 PR | 真實 WS 畸形輸入不崩潰、保留舊席位、正常 1v1／2v2／觀戰不退化 |
| 1 feat/lobby-ready | 共用大廳，模式／名稱／角色／席位；waiting→ready→starting→playing→finished；只有房主可 start，必須滿員全 Ready；更換角色、隊伍及成員使 Ready 失效，開賽檢查 revision 防競態 | 2／4 人全 Ready 才開賽、非房主／觀眾不可 start、重複與競態訊息冪等、房主退出／再戰流程；保留舊入口並明確版本化新協定 |
| 2 feat/reconnect-recovery | 不以暱稱認證；高熵短期 token、服務端存 hash、旋轉與撤銷；保席 45 秒。建議斷線立即暫停權威模擬，所有人同步 pause，原 matchId／frame 恢復；超時明確棄權或取消，不偷偷當重新開賽 | 正確 token 回原席、重複連線接管政策、過期／偽造 token、觀眾不能取玩家席；完整 checkpoint＋輸入尾段恢復後 hash 收斂；區分網路重連與程序重啟，後者需另加持久化 |
| 3 feat/private-room-access | 公開／私密，獨立玩家與觀戰 invitation capability、過期／撤銷、allowSpectators；服務端每次授權並限制猜碼／建房。憑證避免 URL query、日誌與公開 roster，使用安全分享交換流程 | 玩家邀請不能提升為房主；觀戰憑證不可輸入／Ready／換角；禁觀戰、滿房、撤銷、過期、重連與跨房 token 全部負測試 |
| 4 feat/combat-feel-art | 先列四位保留角色的啟動／有效／收招／取消／hitstop 矩陣；固定輸入回放比較。動畫錨點／方向／地面、效果強度、手機按鍵改善，視覺不改 60Hz 時鐘 | 確定性 hash、命中框／動作同步、不同畫面刷新率、鍵盤／觸控／低特效、跨模式角色回歸；素材來源可追溯 |
| 5 perf/rollback-latency | 先修預測終局同步；建 seeded 網路代理，RTT 0/50/100/150/250ms、jitter 0/20/50ms、暫停／斷線／網路丟包情境。WS 基於 TCP，代理應模擬延遲與 head-of-line blocking，不能把任意丟 WS 訊息當真實網路丟包 | 1v1／2v2 含觀戰整場完成；測 checkpoint hash、drop／rollback／replayed、p50/p95/p99 每幀時間、事件迴圈、RSS、每秒流量；1/10/25/50 房逐步測，不預設硬體容量 |
| 6 feat/remove-sam | 改四角色 registry／預設對手／木樁／team.create／AI／章節；更新 manifest、生成與匯入工具、UI文案、測試及 AGENTS／README。移除 Sam 專用素材；五人合圖先重製四人版本。歷史文件保留版本事實 | 四角色全部模式可玩；舊 save.character=sam 回退 azhi；章節依穩定章節 ID 遷移，既有進度／幣不重置；舊客戶端選 sam 有明確相容回應；無失效資源；不刪除街機／練習／1v1／2v2／觀戰／舊冒險 |

Ready、重連與邀請需共享 room revision／participant ID／matchId，但不要把持久身分或 UI 名稱加入確定性戰鬥 snapshot。新協定採 capability/version handshake；不接受舊客戶端繞過 Ready 或私密權限。

效能初步目標：代表硬體下每輪完整服務模擬 p99 < 16.67ms、視覺與回滾不阻塞輸入、測試網路情境無永久 hash 分歧；將硬體、房數、trace、樣本數及最大值一起報告。目標目前未量測、未達標認證。兩／四台設備驗收另列手動清單，由使用者安排非正式環境，不能以本機多 socket 取代。

## 合併建議與回滾

本 PR 只新增文件，可在審閱後合併，不改執行行為，回滾為 revert 文件提交。現況不建議正式部署；優先阻擋會讓程序退出的 P0，再修復終局同步及舊模式 CSP。

每個功能 PR 必須列受影響檔案、行為前後、通過／失敗／未跑檢查、協定相容性、保留模式矩陣及部署影響；有未解釋的必要測試失敗不得建議合併。跨協定功能使用明確版本或旗標，回滾舊版前處理新 token／舊房間，不能聲稱直接降版可恢復進行中賽局。

部署僅由使用者手動執行；合併不代表連線、升級或重啟正式 VPS。未在新任務驗證雲端快照還原，安裝／啟動設定保存與環境發布也應分別記錄。
