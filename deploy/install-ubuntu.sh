#!/usr/bin/env bash
set -Eeuo pipefail
# Azhi - non-destructive initial installation for Ubuntu with an existing 6.9 service.
# Never modifies 6.9, existing 80/443 websites, SSH, or UFW.
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP=/opt/azhi71
SERVICE=azhi71
USER_NAME=azhi71
PRIVATE_PORT=31071
PUBLIC_PORT=18071
CONF=/etc/nginx/conf.d/azhi71.conf
say(){ printf '\n[Azhi] %s\n' "$*"; }
fail(){ echo "[停止] $*" >&2; exit 1; }
(( EUID == 0 )) || fail '請以 root 執行部署腳本'
[[ -f "$SRC_DIR/package-lock.json" && -f "$SRC_DIR/server.js" && -f "$SRC_DIR/server/db.js" && -f "$SRC_DIR/tools/db-migrate.cjs" && -f "$SRC_DIR/deploy/runtime-check.cjs" && -f "$SRC_DIR/package.json" && -f "$SRC_DIR/public/core.js" && -f "$SRC_DIR/public/rank-rules.js" ]] || fail '專案不完整，請解壓縮完整 ZIP。'
[[ -f /etc/os-release ]] && . /etc/os-release
[[ ${ID:-} == ubuntu ]] || fail '本腳本僅針對 Ubuntu；其他系統請手動部署。'
command -v node >/dev/null || fail '找不到 Node.js，請先安裝 v20 以上。'
command -v npm >/dev/null || fail '找不到 npm。'
node -e 'process.exit(parseInt(process.versions.node,10)>=20?0:1)' || fail 'Node.js 需要 20 以上。'
command -v systemctl >/dev/null || fail '找不到 systemd。'
command -v ss >/dev/null || fail '找不到 ss。'
[[ ! -e "$APP" ]] || fail "$APP 已存在：為避免覆蓋，停止。"
[[ ! -e /etc/systemd/system/${SERVICE}.service ]] || fail '服務名稱已存在，停止。'
[[ ! -e "$CONF" ]] || fail "Nginx 設定 $CONF 已存在，停止。"
if ss -ltn "( sport = :${PRIVATE_PORT} )" | grep -q 'LISTEN';then fail "$PRIVATE_PORT 已被佔用";fi
if ss -ltn "( sport = :${PUBLIC_PORT} )" | grep -q 'LISTEN';then fail "$PUBLIC_PORT 已被佔用";fi
say '檢查 Node / 專案語法與 Nginx 現有服務'
(cd "$SRC_DIR" && npm run check && npm test) || fail '專案檢查／測試失敗；尚未安裝服務。'
VERSION="$(node -p 'require(process.argv[1]).version' "$SRC_DIR/package.json")"
if ! command -v nginx >/dev/null;then fail '找不到 Nginx。為避免影響既有網站，不自動安裝；請先確認環境。';fi
nginx -t || fail '現有 Nginx 設定驗證失敗，請先修復。'
if ! nginx -T 2>&1 | grep -E 'include[[:space:]]+/etc/nginx/conf.d/\*\.conf;' >/dev/null;then
 fail '目前 Nginx 沒有載入 /etc/nginx/conf.d/*.conf，請先確認設定。'
fi
say '創建獨立 azhi71 系統帳號，安裝到 /opt/azhi71'
id -u "$USER_NAME" >/dev/null 2>&1 || useradd --system --user-group --home-dir "$APP" --shell /usr/sbin/nologin "$USER_NAME"
mkdir -p "$APP"
cp -a "$SRC_DIR/public" "$SRC_DIR/server" "$SRC_DIR/tools" "$SRC_DIR/deploy" "$SRC_DIR/server.js" "$SRC_DIR/package.json" "$SRC_DIR/package-lock.json" "$SRC_DIR/test" "$APP/"
# Asset validation requires the preserved source art and manifests.
[[ ! -d "$SRC_DIR/assets" ]] || cp -a "$SRC_DIR/assets" "$APP/"
chown -R "$USER_NAME:$USER_NAME" "$APP"
# Install as unprivileged dedicated account; no global npm changes
runuser -u "$USER_NAME" -- env npm_config_cache=/tmp/azhi71-npm-cache npm --prefix "$APP" ci --omit=dev --ignore-scripts --no-audit --no-fund
(cd "$APP" && runuser -u "$USER_NAME" -- node deploy/runtime-check.cjs) || fail '正式依賴／Argon2 原生執行檔無法載入，尚未建立服務。'
NODE_BIN="$(command -v node)"
cat > /etc/systemd/system/${SERVICE}.service <<SYSTEMD
[Unit]
Description=Azhi $VERSION 60Hz Fighting Game
After=network.target
[Service]
Type=simple
User=$USER_NAME
Group=$USER_NAME
WorkingDirectory=$APP
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=$PRIVATE_PORT
ExecStart=$NODE_BIN $APP/server.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
LockPersonality=true
RestrictSUIDSGID=true
CapabilityBoundingSet=
UMask=0027
[Install]
WantedBy=multi-user.target
SYSTEMD
systemctl daemon-reload
systemctl enable --now "$SERVICE"
sleep 2
systemctl is-active --quiet "$SERVICE" || fail '服務啟動失敗：journalctl -u azhi71 -n 50 --no-pager'
curl -fsS --max-time 5 "http://127.0.0.1:${PRIVATE_PORT}/healthz" || fail '服務健康檢查未通過。'
say '設定獨立 Nginx 18071 Port（不碰 80/443 既有網站）'
cat > "$CONF" <<NGINX
server {
    listen $PUBLIC_PORT;
    server_name _;
    access_log /var/log/nginx/azhi71.access.log;
    error_log /var/log/nginx/azhi71.error.log warn;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    client_max_body_size 1m;
    location / {
        proxy_pass http://127.0.0.1:$PRIVATE_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 10s;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
NGINX
if ! nginx -t;then rm -f "$CONF";fail 'Nginx 驗證失敗，已移除新版設定，既有站台未修改。';fi
systemctl reload nginx
say "完成：本機 http://127.0.0.1:$PRIVATE_PORT/　對外 http://YOUR_VPS_IP:$PUBLIC_PORT/"
echo '未修改 UFW／雲端安全群組。請依需求開放 TCP 18071。'
echo '6.9/7.0 服務仍然保持原狀。'
echo '檢查：systemctl status azhi71 --no-pager'
echo '記錄：journalctl -u azhi71 -n 50 --no-pager'
echo '此首次安裝只提供既有 HTTP 遊戲入口；會員／排位上線前請另依 docs/ONLINE_DEPLOYMENT.md 設定 PostgreSQL、遊戲網址與外置環境檔（不需要 SMTP 或網域）。'
