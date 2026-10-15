# 《阿志向錢衝 8.4》Ubuntu VPS 安全更新指南

## 更新前

以你目前的環境為基準：VPS `YOUR_VPS_IP`、Ubuntu、無控制面板、Nginx + systemd，遊戲服務 `azhi71`，內部 `127.0.0.1:31071`，對外 `:18071`。
**沒有訪問你的 VPS；以下操作需由你自己透過 SSH 執行。** 請確保目前遊戲已成功安裝在 `/opt/azhi71`。不要直接執行第一次的 `install-ubuntu.sh` 覆蓋既有目錄。

### Mac 上傳

```bash
scp ~/Downloads/*8.4*.zip root@YOUR_VPS_IP:/tmp/azhi84.zip
ssh root@YOUR_VPS_IP
```

### 在 VPS 驗證壓縮檔並檢查

```bash
unzip -tq /tmp/azhi84.zip
mkdir -p /tmp/azhi84-update
unzip -q /tmp/azhi84.zip -d /tmp/azhi84-update
ls -l /tmp/azhi84-update/azhi71/deploy/upgrade-ubuntu.sh
bash /tmp/azhi84-update/azhi71/deploy/upgrade-ubuntu.sh --check
```

### 確定通過後正式更新

```bash
bash /tmp/azhi84-update/azhi71/deploy/upgrade-ubuntu.sh
systemctl status azhi71 --no-pager
curl -fsS http://127.0.0.1:31071/healthz
```

健康檢查應包含 `version: 8.4.0`、`netcode: rollback-authoritative`、`serverHz: 60`、`rollbackWindow: 30`。不更改原來的 Nginx 設定、SSH、防火牆及其他既有網站。更新腳本會先完整備份舊版再替換，只會短暫停止 `azhi71` 服務。

## 验证雙人測試（使用不同瀏覽器／不同設備）

1. 開啟 `http://YOUR_VPS_IP:18071/`，確認頁面顯示 8.4。請強制重新整理避免快取。
2. 玩家 A 建立房間，玩家 B 輸入相同房號進入。
3. 兩邊觀察右方的 `ROLLBACK / RTT / 輸入延遲 / 修正 / 影格` 數值是否更新。
4. 快速 J、K 出拳和 A/D 來回移動，確認畫面不卡死、兩邊角色可同步；可測試手機觸控。
5. 模擬 Wi-Fi 連線不穩，觀察回滾次數及重同步是否增加；建議先低延遲穩定網路，再逐步測試網路限制。
6. 注意更新後原本的房間將斷線，必須重新建立；8.3 與 8.4 瀏覽器程式不可混用。

## 發生問題的排查與還原

```bash
journalctl -u azhi71 -n 100 --no-pager
curl -fsS http://127.0.0.1:31071/healthz
ls -ld /opt/azhi71.backup.*
```

如果新程式健康檢查未通過，更新腳本會嘗試自動回滾。若要手動回復最近一次備份，檢查欲回復的備份版本後執行：

```bash
bash /tmp/azhi84-update/azhi71/deploy/rollback-ubuntu.sh
```

還原腳本需要輸入 `YES`，只停止／啟動 `azhi71`。不能在中途刪除或清空 VPS 的 `/opt`、Nginx 或 Docker 設定。**如果 SSH 連線又遭拒，應先恢復 VPS 的 SSH 管理方式，不要為了部署而重灌主機。**

## 測試限制

`npm test` 涵蓋回滾算法、延遲輸入、固定亂數、伺服器協定仿真；離線測試環境無法安裝 `ws` 套件，也無法連線到你的 VPS，所以**跨網路兩人實戰、實際 WebSocket 傳輸、手機幀率與真實延遲，仍需上傳後測試**。
