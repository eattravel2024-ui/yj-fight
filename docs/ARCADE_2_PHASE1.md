# Arcade Fighting Game 2.0 — Phase 1 交付

版本 **8.10.0**。日期：2026-10-15（UTC+8）。起點：8.9.9／`d269022`；本機分支：`feat/arcade-phase1`。本階段沒有推送 GitHub、建立遠端 PR、連線或部署正式 VPS。

## 完成範圍

- 全視窗漫畫街機主選單：米白／黑／紅的斜切大區塊、半色調網點、速度線、粗體雙行品牌字標、阿志／維尼專用透明主視覺、六個編號面板、黃色選取回饋與短入場動畫。
- 六入口是真正可用的舊功能：街機、練習 → 原有選角頁；好友 → 1v1 房間；團隊／觀戰 → 原有四人／觀戰房間；設定、操作與招式 → 對應原有面板。選擇與確認分離，進入選單不初始化比賽、不自動連線。
- 共用 UI tokens：顏色、字體、硬陰影、斜切面板、焦點、確認／返回按鈕、表單及設定外框。戰鬥畫布、HUD、碰撞與角色戰鬥素材不變。
- 小型純 UI Flow 與正式 `AzhiGame` adapter，選單不再依賴 Debug globals。不新增第二套血量、計時器、Ready 或戰鬥規則。
- 方向鍵／WASD 選項，Enter／Space 確認，Escape 逐層返回；Tab 焦點與觸控保留。既有音效合成器提供短提示音，遵守原音效開關並節流，未開發 Phase 5 混音系統。
- 已連線或正在連線時，跨模式操作回到房間，不跳頁或中斷對戰。保留角色跨入口傳遞、本機暫停及線上中性輸入。
- Fight Fund／740 G 不在主選單顯示。合法的幣、已購配色、章節、勝場、最高連擊及設定仍保存。
- 正規化既有存檔，修復 Phase 0 已重現的小數章節啟動失敗與 `constructor` 角色顯示問題；沒有加入新任務存檔格式。

## 實際流程

1. 打開主選單，滑鼠點選或以方向鍵選擇模式。
2. 按右下確認或 Enter／Space；街機／練習只進入既有選角與開始控制，並非 Phase 2 的新版三區選角。
3. 房間模式依既有命名、選角、Ready、房主開賽與觀戰權限運作。
4. 子頁 Escape 返回主選單，再按 Escape 返回擂台；「返回擂台」按鈕可直接恢復。開選單清除按住輸入，線上不停止權威同步。
5. 主選單反白只是 UI 草稿；正在進行的戰鬥不會因移動選取焦點而變換角色／模式。

## 修改檔案

| 類別 | 檔案與用途 |
| --- | --- |
| 新共用基礎 | `public/game-flow.js`：合法面板、模式草稿、不可變 snapshot 與訂閱；`public/save-state.js`：舊存檔驗證。 |
| 新視覺系統 | `public/arcade-menu.css`：主選單、tokens、共用 UI 元件、桌面／手機／reduced-motion。 |
| 主選單與導航 | `public/game-shell.js`：六入口、正式 adapter、焦點／返回、連線保護、一次性導航、bfcache 恢復。 |
| 客戶端最小掛接 | `public/game.js`、`public/team.js`：正式狀態／操作 getter，重用現有模式與音效，不改核心。 |
| 載入與版本 | 兩個 HTML、`package.json`／lock：新模組、樣式、8.10.0 cache query；`check` 加入新 JS。依賴版本未改。 |
| 新美術／字型 | `assets/menu/arcade-heroes-source.png`、`public/art/menu/arcade-heroes.webp`；本機 Barlow Condensed 字型及完整 OFL。原素材完整保留。 |
| 測試 | 新 `test/game-flow.test.js`、`test/save-state.test.js`、`test/browser/arcade-phase1.test.cjs`；現有 `arena.test.cjs` 更新導航操作，保留戰鬥／網路斷言。 |
| 文件 | 本交付、README、AGENTS、ROADMAP、手動發佈與素材來源。Phase 0 報告保留歷史基準，不把舊缺陷描述悄悄改成未發生。 |

沒有改動 `server.js`、`core.js`、`team-core.js`、`rollback.js`、`engine/`、既有四張戰鬥圖集或部署腳本。

## 視覺檢查與修正迴圈

已在真正 HTTP 遊戲頁開 Chromium，而非只檢查獨立 HTML 展示：

1. 第一輪桌面截圖發現：舊 `.app-home` 的 `align-items:start` 令新兩區高度縮小，六選項互相重疊；主標下多餘字幕也遮到人物。修正為明確 grid row／stretch／零 gap，縮短中文字標。
2. 第二輪及最終檢查 1920×1080、1600×900、1366×768、1280×720、390×844、844×390：臉部完整、圖片使用 contain 不拉伸、標題與角色分區、六選項無重疊，底部確認可見。
3. 互動回歸發現：返回後游標未動也會觸發 pointerenter 改選項；改為點選／焦點才改草稿，hover 保留視覺回饋。
4. 反覆返回測試發現：原生 dialog 多次 Escape 可能意外關閉；改為明確 keydown 防預設行為、忽略重複鍵，保留逐層返回。跨模式次要連結也補同一連線保護。
5. 加入桌面／手機幾何、真實選項文字、觸控區、選取動畫差異與 reduced-motion 斷言，再完整重跑。沒有用移除斷言或跳過測試掩蓋失敗。

截圖為本次正式遊戲頁產物：

- `coverage/phase1-main-menu-1920.png`：16:9 桌面主選單。
- `coverage/phase1-main-menu-1366.png`、`phase1-main-menu-1600.png`、`phase1-main-menu-1280.png`：其餘桌面尺寸。
- `coverage/phase1-main-menu-selected.png`：選項切換回饋。
- `coverage/phase1-main-menu-mobile.png`、`phase1-main-menu-mobile-landscape.png`：手機直／橫向。

這些是本機忽略的驗證產物。可直接在本次工作區開啟，不是已部署網站。

## 測試結果

- `npm run check`：通過。
- `npm test`：**179 通過，0 失敗／略過**；新增 9 項純流程與存檔驗證。
- `npm run test:e2e`：**25 通過，0 失敗／略過**，完整執行約 311 秒。最後將手機橫向確認按鈕維持 44px 並加驗 1600×900 後，另重跑 6 項主選單測試全部通過。
- 核心與多人功能的既有 Node 回歸保留；新瀏覽器驗證六入口、無自動開戰／連線、重複確認、鍵盤／返回、暫停／中性輸入、已連線保護、存檔／經濟保存及視覺布局。
- 執行環境：Node 24.19.0／Chromium，全部 HTTP／WS 測試為 loopback；沒有實體多裝置／真手把／公網延遲或正式 VPS 驗收。
- 沒有獨立 lint／typecheck／build 指令；此專案原生 JS 直接服務靜態檔，不能把不存在的工具列作已通過。

## 待改善與本階段界線

- Phase 2：獨立玩家／對手大立繪選角、角色資料視覺統一；本版仍接舊選角頁，不冒充新版已完成。
- Phase 3：任務／真正選圖、房主地圖同步、存檔進度遷移；練習第二回合能量問題仍在，未越界修改戰鬥規則。
- Phase 4：素材準備閘門、VS、Pause／Result、權威完賽與下一關；回滾事件撤回等 Phase 0 網路風險仍需處理。
- Phase 5：統一音訊音量、Gamepad、戰鬥圖集記憶體與 HUD 增量更新。此階段只補主選單所需的鍵盤／短音效，不宣稱已支援手把或 BGM。
- 四張新的 A–D 視覺參考在這次文字附件中未附檔；本版依已確認的漫畫街機規格、既有角色與自行生成主視覺製作，未複製第三方原作素材。

## 驗收、合併與回復

主選單已呈現完整漫畫街機構圖，六入口有真實去向，原有四角色與全部模式保留。本次最終測試通過，建議審閱 Phase 1 畫面與差異後合併；不得藉此進入 Phase 2。

本階段保留本機 Git 檢查點，不自行推送或部署；手動更新用完整來源包，原 VPS 資料夾 `git pull` 尚不會拿到本機分支的新內容。回復可還原 Phase 1 提交；線上若由使用者手動部署，依既有完整備份腳本回滾。存檔鍵未變，合法舊資料仍相容。

**交付後停止，等待使用者確認下一階段。**
