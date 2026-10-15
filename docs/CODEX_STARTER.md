# First Codex task (copy into Codex)

請先完整閱讀 README.md、AGENTS.md、docs/ROADMAP.md，以及 server.js、public/core.js、public/rollback.js、public/team-core.js。

這是《阿志向錢衝》8.6 網頁格鬥遊戲：60Hz 固定模擬、WebSocket、1v1、2v2、觀戰、五位角色、玩家/房間命名。請不要推翻既有架構或刪除任何模式。

第一個工作請只做「現況稽核與測試覆蓋盤點」：
1. 實際執行 npm run check 與 npm test，列出測試結果。
2. 找出對戰協定、斷線重連、房間權限、Ready流程、手機按鍵與回滾一致性的具體風險，按 P0/P1/P2 分級並附程式位置。
3. 提供最少變更的改善計畫與可驗收標準。
4. 若有確定的低風險錯誤，可建立獨立 fix 分支及 PR；不要直接推送 main。
5. 不要部署到 VPS，不要修改現有 Nginx、Docker、SSH、防火牆，也不要引入未授權的 KOF XIII 圖片。

等第一次稽核完成並確認 CI 正常後，再開始第二項任務：設計並實作 1v1/2v2 Ready/Host Start 流程（含單元測試和觀戰回歸測試）。
