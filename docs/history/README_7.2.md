# 阿志向錢衝 7.2｜五將爭霸更新包

這份更新包針對**已經裝好 7.1 的 Ubuntu VPS**，覆蓋現有 `azhi71` 遊戲服務。它**不會**修改 Nginx 設定，也不會碰 `azhi69`、`azhi70`、Docker、SSH 或 UFW。

## 五位可玩角色（舊三位可玩角色已替換）

| 角色 | 定位 | 特色必殺技 | 來源 |
| --- | --- | --- | --- |
| Sam | 高傷害／反擊型 | 鐵山崩擊 | 你上傳的圖一 |
| 維尼 | 防禦型 | 蜂蜜震盪 | 你上傳的圖二 |
| 塞子 | 速度型 | 旋轉清場 | 你上傳的圖三 |
| 金沙賭神 | 遠距離型 | 金沙飛牌 | 你提供的新 Slack 圖片連結 |
| 阿志 | 均衡連段型 | 逆轉一擊 | 你新上傳的阿志圖片 |

每位角色有完整的格鬥角色檔案、17 種動作 × 10 張影格、戰鬥獨立屬性、專屬必殺技判定和 CPU 風格。五關街機模式可依序挑戰這五位格鬥家。雙人連線房間依玩家選角載入相同角色資料。

**素材風格說明：** 玩家提供照片用作選角原圖，戰鬥中的角色為以原圖臉部結合向量身體製作的原創漫畫式動態角色（並非手繪商業動畫）。五人團體展示圖為視覺設計素材。遊戲能力、招式和對白均為虛構的娛樂性設定。

## Mac 上傳並覆蓋既有 7.1

1. 下載 `阿志向錢衝_7.2_五將爭霸_覆蓋更新包.zip` 到 Mac 的下載項目。
2. Mac Terminal 執行：

```bash
scp ~/Downloads/*7.2*.zip root@YOUR_VPS_IP:/tmp/azhi72.zip
ssh root@YOUR_VPS_IP
```

3. 在 **VPS** 執行以下指令，先只做無修改的檢查：

```bash
mkdir -p /tmp/azhi72-update
unzip -q /tmp/azhi72.zip -d /tmp/azhi72-update
bash /tmp/azhi72-update/azhi71/deploy/upgrade-ubuntu.sh --check
```

4. 確認檢查通過後，執行正式覆蓋：

```bash
bash /tmp/azhi72-update/azhi71/deploy/upgrade-ubuntu.sh
```

5. 完成後檢查：

```bash
systemctl status azhi71 --no-pager
curl http://127.0.0.1:31071/healthz
```

成功時健康檢查應回傳 `"version":"7.2.0"`。如果舊版已設好 Nginx 18071，開啟：

**http://YOUR_VPS_IP:18071/**

瀏覽器可能快取舊角色圖片，可使用 Mac 的 **Command + Shift + R** 強制重新整理。

## 自動備份與回復

覆蓋過程會把舊版完整保留於 `/opt/azhi71.backup.時間戳記`，並只會短暫停掉 `azhi71.service`（原本線上對戰的玩家會斷線，需要重新進房）。若新版本的啟動或健康檢查失敗，腳本會嘗試自動還原。

日後如需手動回復舊版（會詢問 YES）：

```bash
bash /tmp/azhi72-update/azhi71/deploy/rollback-ubuntu.sh
```

## 安全限制與相容性

- 已使用 Node.js 20+ 的 Ubuntu 24.04 環境設計。
- 必須是**已部署 7.1 且 `azhi71.service` 正常建立**的 VPS。若還沒裝 7.1，需先安裝之前的完整版本。
- 7.2 繼續使用 `127.0.0.1:31071` + 原本的 Nginx 18071，不會改 Nginx 80/443。
- 原本的 `azhi70_save` 瀏覽器存檔仍保留。角色選擇獨立寫入此存檔；關卡從 3 章擴充到 5 章。
- 使用者在遊戲中見到的任何真人照片都是參照提供素材改編；人物設定純屬虛構。
- 測試：Node.js 語法檢查、格鬥核心單元測試及動畫尺寸、檔案驗證。此次環境的 Chromium 瀏覽器連線受到系統限制，未能完成實際瀏覽器操作與 VPS 跨網路 WebSocket 雙人測試。
