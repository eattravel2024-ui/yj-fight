# 阿志向錢衝 8.3：電影級命中特效 / Hit Impact Edition

8.3 從 8.2 的程式分支製作；保留 Sam、維尼、塞子、金沙賭神、阿志五個角色、60Hz 伺服器判定、連段取消及雙人 WebSocket 房間。

## 為什麼仍然使用透明特效？

Alpha 透明是正規遊戲美術做法：讓光效、火花、碎片疊在角色與場景上。8.2 的問題不是「透明」而是缺乏完整時間演出及各類攻擊區隔。8.3 新增 `public/vfx.js`，由**實際命中事件**觸發光效，不依靠角色空揮就生成碰撞爆炸。

## 主要變化

- 依攻擊類型區分 light / heavy / upper / special / super / counter / block / KO 呈現。
- 原創透明 4 合 1 RGBA `public/art/vfx/impact_energy.png`，可在任何舞台背景上混合。
- 動態多層衝擊：白色碰撞核心、暖色碎光、方向性碎片、圓形衝擊波、地面揚塵、防禦盾型火花。
- 可視化鏡頭回彈：重擊比輕拳強烈；低特效模式停用震動，尊重 reduced-motion 偏好。
- 命中音效改為 Web Audio 合成的低頻打擊 + 高頻破裂聲，按攻擊類型變化，音量保守。
- 新增「特效：電影級／標準／省電」按鈕，偏好存在使用者原本的 localStorage 遊戲紀錄內。
- **不修改** `core.js` 及 WebSocket 裁判判定，VFX 只在前端畫圖。

## 驗證

`npm run check` 及 `npm test`：共 53 項自動測試通過（含新 VFX 模組及 Canvas mock 畫圖）。

由於執行環境限制，無法開啟本機遊戲 URL 進行完整瀏覽器端對局；已另外以 Chromium `set_content` 執行實際 VFX 引擎渲染，生成 GIF／PNG 特效展示，其為**特效引擎預覽**，不是完整遊戲截圖。正式 VPS 雙人 WebSocket／Mac 操作仍需實機確認。

## Ubuntu VPS 舊版覆蓋

1. Mac：`scp ~/Downloads/*8.3*.zip root@YOUR_VPS_IP:/tmp/azhi83.zip`
2. VPS：`mkdir -p /tmp/azhi83-update && unzip -tq /tmp/azhi83.zip && unzip -q /tmp/azhi83.zip -d /tmp/azhi83-update`
3. 預檢：`bash /tmp/azhi83-update/azhi71/deploy/upgrade-ubuntu.sh --check`
4. 通過才更新：`bash /tmp/azhi83-update/azhi71/deploy/upgrade-ubuntu.sh`
5. 核對：`curl -fsS http://127.0.0.1:31071/healthz`，應包含 `"version":"8.3.0"`。

與先前版本相同，只有 `azhi71` 服務被短暫重啟，其他 Nginx／Docker／遊戲服務不變；更新腳本會先備份舊版並在健康檢查失敗時嘗試回滾。**如果前置檢查沒通過，不要手動強制覆蓋。**
