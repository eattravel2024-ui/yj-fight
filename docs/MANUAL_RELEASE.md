# 8.10.0 手動發佈與回滾

本次開發沒有連線或部署正式 VPS。以下指令由你確認更新內容後手動執行；快速迭代不要求每次先建立或合併 PR；目前本機開發分支為 `feat/arcade-phase1`。正式發佈請使用已審閱的完整 commit SHA，確保部署內容與測試內容一致。不要在正在執行遊戲的 `/opt/azhi71` 內做 `git pull` 或安裝依賴。

## 本階段來源狀態

本次 Phase 1 位於本機分支 `feat/arcade-phase1`，尚未推送 GitHub；原更新資料夾執行 `git pull` 不會取得這版。請先審閱主選單及測試報告；若要自行部署本階段，使用下方完整來源包流程。Git 取用流程須等授權推送／合併後才適用。

8.10.0 更新漫畫街機主選單、共用導航及存檔入口驗證，保留原有戰鬥與所有模式。這是 Phase 1，不包含新任務選單／選圖／新版結算。健康版本應顯示 8.10.0，更新後強制重新整理。

## 快速更新（目前 8.10.0）

小幅修改沿用同一開發分支，不必先管理多個分支或 PR。下載本次提供的 azhi-fighting-8.10.0.tar.gz，在電腦上傳：

```bash
scp ~/Downloads/azhi-fighting-8.10.0.tar.gz YOUR_USER@YOUR_VPS_IP:/tmp/
```

自行登入 VPS 後執行（適用既有 /opt/azhi71 與 azhi71.service，需 Node 20+）：

```bash
set -euo pipefail
RELEASE_DIR="$(mktemp -d "$HOME/azhi-update-8.10.0.XXXXXX")"
tar -xzf /tmp/azhi-fighting-8.10.0.tar.gz -C "$RELEASE_DIR" --strip-components=1
cd "$RELEASE_DIR"
npm ci --ignore-scripts --no-fund
sudo bash deploy/upgrade-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
```

更新腳本自行執行語法及 Node 檢查、安裝鎖定依賴、備份、更新與版本健康檢查，不需另外安裝瀏覽器或手跑長套測試。會短暫中斷對局；完成後瀏覽器強制重新整理，健康版本應為 8.10.0。若沒有現有 azhi71，使用本文件末尾「首次安裝」流程。

以下保留完整 Git／回滾流程供需要時查閱，不是每次快速更新的必做清單。

## 發佈前驗收

- 開發機／CI：`npm ci --ignore-scripts`、`npm run check`、`npm test`；瀏覽器驗收另執行 `npm run test:e2e`（先安裝對應的 Playwright Chromium）。
- 確認練習、街機、1v1、2v2、觀戰、暱稱、房名與再戰正常；Sam 已移除，舊客戶端傳送 `sam` 角色代號會安全改選阿志。
- 戰鬥／網路協定更新需所有玩家重新載入頁面，避免新舊客戶端混用。這次沒有加入斷線恢復；更新會中斷現有對局，請選無人比賽的時段。
- 瀏覽器自動測試及本機模擬不能取代實際兩台／四台裝置的延遲、抖動、斷線與觸控手感驗收。

## 已有 `/opt/azhi71` 的 Ubuntu VPS：取用已審閱版本

在你自行登入 VPS 的一般管理員 shell 執行。前提為 Node.js 20+（建議 22／24）、npm、Git，以及既有 `azhi71.service`。GitHub 私有儲存庫請使用 VPS 上已設定的讀取授權；不要把 token 寫進指令、Git URL 或專案檔案。

先將下面的 `RELEASE_COMMIT` 換成 PR 合併後要發佈的完整 40 碼 SHA，再整段執行。每次建立獨立來源目錄，保留上次來源與線上服務。

```bash
set -euo pipefail
RELEASE_COMMIT='REPLACE_WITH_REVIEWED_40_CHARACTER_COMMIT_SHA'
[[ "$RELEASE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo '請先填入已審閱的完整 commit SHA'; exit 1; }
RELEASE_DIR="$HOME/releases/azhi-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$(dirname "$RELEASE_DIR")"
git clone --no-checkout https://github.com/eattravel2024-ui/yj-fight.git "$RELEASE_DIR"
git -C "$RELEASE_DIR" checkout --detach "$RELEASE_COMMIT"
cd "$RELEASE_DIR"
git rev-parse HEAD
node --version
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
bash -n deploy/install-ubuntu.sh deploy/upgrade-ubuntu.sh deploy/rollback-ubuntu.sh
bash deploy/upgrade-ubuntu.sh --check
```

`--check` 只驗證來源、既有服務檔與測試：不安裝套件、不寫 `/var/log` 或鎖定檔、不停止服務。以上 `npm ci` 只安裝至新建的來源目錄，包含開發測試依賴。來源測試通過後，確認目前線上版本與服務狀態：

```bash
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
sudo systemctl status azhi71 --no-pager
```

## 執行更新

仍在剛剛的 `RELEASE_DIR` 內，確認可中斷現有對局後才手動執行：

```bash
sudo bash deploy/upgrade-ubuntu.sh
EXPECTED_VERSION="$(node -p 'require("./package.json").version')"
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz |
  node -e 'const h=JSON.parse(require("node:fs").readFileSync(0,"utf8")); if(h.ok!==true || h.version!==process.argv[1])process.exit(1); console.log(h)' "$EXPECTED_VERSION"
sudo systemctl status azhi71 --no-pager
sudo journalctl -u azhi71 -n 60 --no-pager
```

更新腳本先複製完整 `public/`（包含新的 UI、特效、動畫與舊模式外部腳本）、`server.js`、`package.json`、`package-lock.json` 及測試，然後以 `azhi71` 非 root 帳號在暫存目錄執行 `npm ci --omit=dev --ignore-scripts`。不沿用舊的 `node_modules`。依賴安裝成功才短暫停止 `azhi71`，將舊目錄完整保留為 `/opt/azhi71.backup.<時間>`；新版啟動或版本健康檢查失敗時會嘗試自動還原。

更新不修改 Nginx、SSH、Docker、UFW 或其他遊戲服務。沿用原本的網域／反向代理入口；瀏覽器強制重新整理後驗收主遊戲 `/`、`/team.html` 及 `/adventure-legacy-6.8.html`。若既有站點使用 HTTPS，遊戲會使用同來源 WSS，代理需保留 WebSocket Upgrade 與原始 Host。正式入口的 TLS 憑證及防火牆設定由你依既有 VPS 架構管理。

## 手動回滾

在保留的來源目錄內執行以下腳本；它會顯示選中的最近一次備份，要求你輸入 `YES` 後，才短暫停止並還原 **azhi71**：

```bash
sudo bash deploy/rollback-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
sudo systemctl status azhi71 --no-pager
sudo journalctl -u azhi71 -n 60 --no-pager
```

回滾會把被取代的新版本保留為 `/opt/azhi71.rollback.terminal.<時間>`；不要刪除備份，直到舊版與所有遊戲模式都確認正常。回滾後的版本號應為備份中的舊版本，而不是 8.8.0。

## 首次安裝（沒有 azhi71 的 Ubuntu）

先依「取用已審閱版本」取得來源並完成 `npm ci`、語法與單元測試，**略過**需要既有服務的 `upgrade-ubuntu.sh --check`。確認已安裝並正常運作的 Nginx 會載入 `/etc/nginx/conf.d/*.conf`，且 TCP `31071`、`18071` 未被其他服務占用，然後才手動執行：

```bash
sudo nginx -t
sudo bash deploy/install-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
sudo systemctl status azhi71 --no-pager
```

首次安裝會建立 `/opt/azhi71`、專用系統帳號與 systemd 服務，新增 `/etc/nginx/conf.d/azhi71.conf` 並在 `nginx -t` 通過後 reload Nginx，提供 `18071` 入口；不更動現有 80／443 站台。它不開放防火牆或設定 TLS。已有 `/opt/azhi71`、同名服務或設定檔時會停止，避免覆蓋；此時使用更新流程。

## 本次可驗證範圍

開發環境可檢查 shell 語法、Node 語法、確定性模擬、真實本機 WebSocket 及瀏覽器流程；部署控制流程另以暫存路徑與模擬 systemd／套件指令驗證成功更新、啟動失敗、版本不符、換版檔案移動失敗的還原，以及共用鎖和手動回滾。這些部署腳本未在正式 VPS 執行，未宣稱驗證過該 VPS 的 systemd、Nginx、檔案權限或公網連線。部署前請保留主機既有備份與上述應用程式回滾目錄。
