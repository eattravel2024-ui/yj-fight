# 8.13.0 — Phase 4 GitHub 更新

使用者已授權推送此版本。包含戰鬥手感與四角色定位調整；**立法院尚未取得可讀取原始 PNG，維持停用**。既有三張場景、街機／練習／自訂對戰與觀戰保留。

自行登入原 VPS 後執行（Node.js 20+、既有 azhi71 安裝）：

```bash
set -euo pipefail
cd ~/azhi-update.lvccoe
git fetch origin tag checkpoint-phase4-8.13.0
git switch --detach checkpoint-phase4-8.13.0
npm ci --ignore-scripts --no-fund
sudo bash deploy/upgrade-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
```

健康版本應為 **8.13.0**。腳本先測試並保留舊版完整備份，會短暫重啟 azhi71；不改既有 Nginx、SSH、Docker。更新後強制重新整理瀏覽器。若有本機修改導致切換失敗，先保存，不強制覆蓋。回退固定版為 `checkpoint-phase3-8.12.0` 或使用腳本備份。正式 VPS 由使用者操作，沒有自動部署。

以下保留前版流程作參考。

# 手動發佈與回滾

目前版本 **8.12.0／Phase 3**：選角 → 選關／選圖 → VS → 真實戰鬥 → 結算 → 重試／下一關／全通關。保留 HUD、OST、自訂對戰與舊存檔；絨毛禁區仍待正式美術。本次未連線或部署正式 VPS。

## 8.12.0：Phase 3 Git 固定檢查點

自行登入原 VPS 後執行（需 Node.js 20+、既有 azhi71 安裝）：

```bash
set -euo pipefail
cd ~/azhi-update.lvccoe
git fetch origin tag checkpoint-phase3-8.12.0
git switch --detach checkpoint-phase3-8.12.0
npm ci --ignore-scripts --no-fund
sudo bash deploy/upgrade-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
```

健康版本應為 **8.12.0**。完成後強制重新整理。沒有新增執行期套件或資料庫；VPS 不需圖片／音訊轉檔工具。更新腳本會短暫中斷對局並保留完整備份，沿用 Nginx、SSH、Docker 與既有網址；回退可使用輸出的備份，或前版 `checkpoint-custom-8.11.3`。正式主機由使用者手動更新。

亦提供 `dist/azhi-fighting-8.12.0.tar.gz` 來源包；下方歷史來源包流程可換用本版檔名與版本。

以下為前版歷史流程。

## 8.11.3：自訂對戰與首頁修正

「有請公子，上擂台」移至模式標題下方；1v1／2v2／觀戰合併至自訂對戰，新增清楚的建立／加入、選手席位與 Ready 流程。沒有實裝匹配或排位。登入 VPS 執行：

```bash
set -euo pipefail
cd ~/azhi-update.lvccoe
git fetch origin tag checkpoint-custom-8.11.3
git switch --detach checkpoint-custom-8.11.3
npm ci --ignore-scripts --no-fund
sudo bash deploy/upgrade-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
```

健康版本應為 **8.11.3**。更新後強制重新整理瀏覽器。原有備份／回滾方式不變，沒有自動部署。

以下為前版更新方式。

## 8.11.2：從 GitHub 固定檢查點更新

使用者已授權發布 8.11.2。功能提交 `1fd8aeb`，固定標籤 `checkpoint-combat-hud-8.11.2`，開發分支 `feat/arcade-phase1`；未合併 main，也不自動部署。

自行登入原 VPS，在既有來源資料夾執行（需 Node.js 20+ 與既有 azhi71 安裝）：

```bash
set -euo pipefail
cd ~/azhi-update.lvccoe
git fetch origin tag checkpoint-combat-hud-8.11.2
git switch --detach checkpoint-combat-hud-8.11.2
npm ci --ignore-scripts --no-fund
sudo bash deploy/upgrade-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
```

明確抓取標籤可避開舊資料夾只追蹤單一分支的限制；detached HEAD 是固定版本的正常狀態。若有本機修改造成切換失敗，先保存修改，不使用強制覆蓋或 reset --hard。健康版本應為 **8.11.2**，完成後強制重新整理。

## 來源包替代流程

如不使用 Git，可先下載 `azhi-fighting-8.11.2.tar.gz`，在自己的電腦上傳：

```bash
scp ~/Downloads/azhi-fighting-8.11.2.tar.gz YOUR_USER@YOUR_VPS_IP:/tmp/
```

自行登入原 VPS 後執行（需既有 `/opt/azhi71`、`azhi71.service` 及 Node.js 20+）：

```bash
set -euo pipefail
RELEASE_DIR="$(mktemp -d "$HOME/azhi-8.11.2.XXXXXX")"
tar -xzf /tmp/azhi-fighting-8.11.2.tar.gz -C "$RELEASE_DIR" --strip-components=1
cd "$RELEASE_DIR"
npm ci --ignore-scripts --no-fund
sudo bash deploy/upgrade-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
```

健康版本應為 **8.11.2**。更新保留完整舊版備份，不更動 Nginx、SSH、Docker 或其他遊戲；會短暫中斷比賽。完成後強制重新整理。VPS 不需 Pillow、Python 或 FFmpeg，戰鬥用背景與音檔已包含。

需要回退時，使用更新腳本輸出的備份路徑及本文件下方回滾流程；GitHub 前版固定標籤為 `checkpoint-audio-8.11.1`。本次建議先以來源包試玩，再決定是否發布／合併；沒有合併 main。

以下為前版歷史流程，不包含 8.11.2 新 HUD。

## Phase 1 GitHub 檢查點

Phase 1 功能提交為 `4fc8806`，已完成 179 項 Node 與 25 項瀏覽器測試。後續發布文件提交不改遊戲程式。依使用者授權，發布分支為 `feat/arcade-phase1`，固定檢查點標籤為 `checkpoint-phase1-8.10.0`；沒有合併 main 或操作正式 VPS。

### 沿用主機上的來源資料夾

自行登入原 VPS，在既有來源資料夾執行以下指令。`git switch` 不使用強制覆蓋；若有本機修改或衝突，請先保留並處理，不要使用 reset --hard。

```bash
set -e
cd ~/azhi-update.lvccoe
git fetch origin tag checkpoint-phase1-8.10.0
git switch --detach checkpoint-phase1-8.10.0
npm ci --ignore-scripts --no-fund
sudo bash deploy/upgrade-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
```

若原資料夾只追蹤 `feat/signature-entrances`，普通 `git fetch origin` 可能不會抓到新分支，造成 `invalid reference`。上方改為明確抓取固定標籤，避開單分支 fetch 限制；detached HEAD 是刻意固定 Phase 1 檢查點，之後更新也應明確 fetch／切換新版本，而不是直接 git pull。

健康版本應顯示 `8.10.0`。更新腳本會保留完整舊版備份，並沿用原遊戲網址；不需要修改 Nginx。更新後強制重新整理瀏覽器。

如要固定取用此階段，另建來源資料夾、只取檢查點即可（不必切換舊資料夾的分支）：

```bash
set -e
RELEASE_DIR="$(mktemp -d "$HOME/azhi-phase1.XXXXXX")"
git clone --branch checkpoint-phase1-8.10.0 --depth 1 https://github.com/eattravel2024-ui/yj-fight.git "$RELEASE_DIR"
cd "$RELEASE_DIR"
npm ci --ignore-scripts --no-fund
sudo bash deploy/upgrade-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
```

8.10.0 更新漫畫街機主選單、共用導航及存檔入口驗證，保留原有戰鬥與所有模式。這是 Phase 1，不包含新任務選單／選圖／新版結算。Phase 2 尚未開始。

## 來源包更新（8.11.1）

小幅修改沿用同一開發分支，不必先管理多個分支或 PR。下載本次提供的 azhi-fighting-8.11.1.tar.gz，在電腦上傳：

```bash
scp ~/Downloads/azhi-fighting-8.11.1.tar.gz YOUR_USER@YOUR_VPS_IP:/tmp/
```

自行登入 VPS 後執行（適用既有 /opt/azhi71 與 azhi71.service，需 Node 20+）：

```bash
set -euo pipefail
RELEASE_DIR="$(mktemp -d "$HOME/azhi-update-8.11.1.XXXXXX")"
tar -xzf /tmp/azhi-fighting-8.11.1.tar.gz -C "$RELEASE_DIR" --strip-components=1
cd "$RELEASE_DIR"
npm ci --ignore-scripts --no-fund
sudo bash deploy/upgrade-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
```

更新腳本自行執行語法及 Node 檢查、安裝鎖定依賴、備份、更新與版本健康檢查，不需另外安裝瀏覽器或手跑長套測試。會短暫中斷對局；完成後瀏覽器強制重新整理，健康版本應為 8.11.1。若沒有現有 azhi71，使用本文件末尾「首次安裝」流程。

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
