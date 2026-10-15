# 《阿志向錢衝》8.1 — Ubuntu VPS 安全覆蓋更新

適用：已成功運行 `/opt/azhi71`、`azhi71.service`、Nginx :18071 的 7.2 / 8.0 主機；不需要更改現有 Nginx、Docker、SSH、防火牆或 6.9 服務。

## 重要授權說明

此版本**沒有打包 KOF13 原作 Sprite Sheet／背景／音效**。保留原有五位人物，按 KOF13 類型的逐格動畫組織方式重繪美術和技能；若要匯入 GitHub 倉庫的實際原作圖片，請先取得相應使用與散布授權，參閱 `ART_AND_LICENSE.md`。

## 安全部署

Mac 終端機（請確認 ZIP 位於 Downloads）：

```bash
scp ~/Downloads/*8.1*.zip root@YOUR_VPS_IP:/tmp/azhi81.zip
ssh root@YOUR_VPS_IP
```

VPS Ubuntu root：

```bash
mkdir -p /tmp/azhi81-unpack
unzip -tq /tmp/azhi81.zip
unzip -q /tmp/azhi81.zip -d /tmp/azhi81-unpack
bash /tmp/azhi81-unpack/azhi71/deploy/upgrade-ubuntu.sh --check
```

確認 `--check` 測試通過，安排短暫中斷後：

```bash
bash /tmp/azhi81-unpack/azhi71/deploy/upgrade-ubuntu.sh
systemctl status azhi71 --no-pager
curl -fsS http://127.0.0.1:31071/healthz
curl -I http://127.0.0.1:18071/
```

健康檢查應回傳 `"version":"8.1.0","serverHz":60,"snapshotHz":30`。遊戲維持 `http://YOUR_VPS_IP:18071/`（外網連線需既有防火牆允許）。首次打開建議 Mac Chrome 使用 Cmd+Shift+R。

更新期間正在進行的多人對局會斷線；更新腳本會備份 `/opt/azhi71`，並在啟動／健康檢查失敗時嘗試自動還原。要手動還原：

```bash
bash /tmp/azhi81-unpack/azhi71/deploy/rollback-ubuntu.sh
```

手動還原前會要求輸入 YES。**未實際連上你的 VPS**，跨網路雙人連線須在安裝後實測。

## 五人素材替換

`tools/import_legacy_atlas.py` 是一個可選的離線切圖工具。**只有取得合法使用權時**才能匯入外部圖片。其作用是依照 KOF13 式格子資料對齊到 17 動作 × 10 格的內部格式；素材本身必須由使用者合法提供，ZIP 不包含任何 KOF13 原作人物素材。建議先在 Mac 進行轉換並目測，再安排更新而非直接改動正在運作的 VPS。
