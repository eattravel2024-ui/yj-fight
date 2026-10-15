# 阿志向錢衝 8.0｜60Hz 格鬥核心重構

> 基於已部署的 7.2「五將爭霸」重新組織格鬥資料與遊戲核心；參考 [vincent-li/kof13](https://github.com/vincent-li/kof13) 的角色招式幀表、Sprite Sheet 動作與格鬥場景分層**設計概念**。未複製原專案的 KOF 人物圖、聲音或原始程式碼。

## 這版實際改了什麼

- 固定 60Hz 模擬（每幀約 16.667ms），遊戲本機每次繪圖使用 requestAnimationFrame；VPS 使用單調時鐘（`process.hrtime.bigint`）與固定步進累加器，負載過高時最多補 6 幀避免失控。
- 伺服器仍是**權威制**，每秒 60 次模擬，**每秒 30 份狀態快照**給兩位玩家。這不是 60Hz 網路廣播，符合既有 VPS 頻寬及成本考量；可以在 systemd 設定 `AZHI_SNAPSHOT_HZ=60` 改為每秒 60 份快照（增加 VPS 頻寬與 CPU 負擔）。
- 公用核心新增 `public/engine/frame-data.js`、`commands.js`、`boxes.js`、`animation.js`、`ai.js` 五個獨立模組。Node 與瀏覽器使用相同的資料及判定。
- 格鬥按鍵容錯：Mac 鍵盤以 `KeyboardEvent.code` 辨識，按鍵短按有 queue；提供 ↓↘→+J（波動必殺）與 →↓↘+K（升龍），原本的 U／I 單鍵仍可使用。角色朝向反轉時，指令方向會跟著翻轉。
- Hitbox（攻擊）、Hurtbox（受擊）、Pushbox（角色占位）使用獨立模組，練習模式可顯示與實際計算一致的判定框。攻擊有前搖、有效與收招，UI 可查看數據。
- 角色技：Sam 突進重擊、維尼低段震波、塞子旋轉多段、金沙賭神真正獨立飛行的飛牌、阿志反擊加成；五人共用合理的 60Hz 攻防時序但招式機制不同。
- 五位角色、原有美術素材、五關街機、練習、配色、WebSocket 房間與過往本機進度保留；未引用 KOF13 的第三方角色圖片。

## 專案結構

```
azhi71/
  server.js                    WebSocket + 靜態檔 + 60Hz 權威戰鬥伺服器
  public/index.html            選角／街機／練習／連線入口
  public/game.js               DOM、Mac/手機輸入、動畫繪製、畫面插值
  public/core.js               共用格鬥狀態機（60Hz）
  public/engine/frame-data.js  每位角色與逐招式幀資料
  public/engine/commands.js    朝向相對的方向指令輸入緩衝
  public/engine/boxes.js       獨立判定框
  public/engine/animation.js   Sprite Sheet 幀映射
  public/engine/ai.js          各角色不同的 CPU 策略
  public/sprites/              原創五人動畫圖集
  public/art/                  角色肖像與原創舞台背景
  test/                        戰鬥規則／決定性／方向指令測試
  deploy/upgrade-ubuntu.sh     VPS 覆蓋更新 + 備份 + 回滾
  deploy/rollback-ubuntu.sh    手動選擇最近一次備份還原
```

## 本機／VPS 測試

```bash
node --version        # Node.js >=20
npm ci                # 若沒有 lockfile 則改用 npm install
npm run check
npm test
npm start
```

伺服器預設綁定 `127.0.0.1:31071`，瀏覽器用 `http://127.0.0.1:31071/`；對外請由現有的 Nginx `18071` 反向代理，並支援 `/ws` WebSocket Upgrade。

## 已安裝 7.2：安全覆蓋（不影響 Nginx／其他服務）

Mac 端：

```bash
scp ~/Downloads/*8.0*.zip root@YOUR_VPS_IP:/tmp/azhi80.zip
```

VPS 端：

```bash
mkdir -p /tmp/azhi80-install
unzip -q /tmp/azhi80.zip -d /tmp/azhi80-install
bash /tmp/azhi80-install/azhi71/deploy/upgrade-ubuntu.sh --check
bash /tmp/azhi80-install/azhi71/deploy/upgrade-ubuntu.sh
```

`--check` 先執行語法及單元測試，不改動服務；正式更新會單獨停用 `azhi71`、備份 `/opt/azhi71` 到 `/opt/azhi71.backup.時間`、換上新版本，再健康檢查 8.0.0；失敗會嘗試自動還原。**正在進行的雙人對戰會中斷，請事先通知玩家。**

確認：

```bash
systemctl status azhi71 --no-pager
curl -fsS http://127.0.0.1:31071/healthz
curl -I http://127.0.0.1:18071/
```

健康檢查應包含 `"version":"8.0.0","serverHz":60,"snapshotHz":30`。

如果發生問題：

```bash
bash /tmp/azhi80-install/azhi71/deploy/rollback-ubuntu.sh
```

## 操作

| 動作 | Mac／PC |
| --- | --- |
| 移動 | A/D 或 ←/→ |
| 跳／蹲 | W/S 或 ↑/↓ |
| 輕拳／重拳 | J/K |
| 踢／掃腿 | Q/E |
| 摔技 | H |
| 升龍 | I，或 →↓↘+K |
| 必殺 | U，或 ↓↘→+J（需要 40 能量） |
| 防禦 | L（按住） |
| 衝刺 | Shift＋方向 |

## 技術與法律說明

參考的 `vincent-li/kof13` 是使用早期 Cocos2d HTML5、Koa／koa.io、MongoDB 的舊專案，含有《格鬥天王》的角色資產及歷史程式設定。本重構未引入其舊依賴、不讀取原專案憑證，也未將其角色圖與音樂併入；程式碼為獨立實作。角色肖像與既有 Sprite Sheet 沿用本專案 7.2 素材；如計畫公開營利，仍須自行確認肖像、第三方梗圖及角色肖像的使用授權。

## 驗證範圍

已進行語法、戰鬥核心自動測試，瀏覽器內進行離線街機及練習操作檢查；若部署環境無法安裝 `ws`，WebSocket 實際雙人對局需在 VPS 上額外做兩端驗收。瀏覽器實際刷新頻率取決於裝置硬體，60Hz 指的是遊戲模擬頻率，並不保證每台電腦都是 60 FPS 畫面。
