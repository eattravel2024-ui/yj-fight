#!/usr/bin/env bash
# Update ONLY the existing /opt/azhi71 and azhi71.service. Preserve 6.9/7.0 and existing nginx sites.
set -Eeuo pipefail
APP=/opt/azhi71
SERVICE=azhi71
OWNER=azhi71
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP="/opt/azhi71.backup.$STAMP"
STAGING="/opt/azhi71.next.$STAMP.$$"
LOG="/var/log/azhi71-upgrade-$STAMP.log"
say(){ printf '\n[Azhi %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
fail(){ printf '\n[STOP] %s\n' "$*" >&2; exit 1; }
# --check performs no log/lock/service writes, and can run without root.
[[ $# -eq 0 || ( $# -eq 1 && $1 == '--check' ) ]] || fail '用法：upgrade-ubuntu.sh [--check]'
command -v node >/dev/null || fail '找不到 Node.js'
command -v npm >/dev/null || fail '找不到 npm'
[[ -d "$APP" && -f "$APP/server.js" && -f "$APP/package.json" ]] || fail '找不到原本的 /opt/azhi71；首次安裝需使用 install-ubuntu.sh'
[[ -f "/etc/systemd/system/$SERVICE.service" ]] || fail '找不到 azhi71 專屬 systemd 服務，為安全起見不自動覆蓋'
[[ -f "$SRC/package-lock.json" && -f "$SRC/server.js" && -f "$SRC/server/db.js" && -f "$SRC/tools/db-migrate.cjs" && -f "$SRC/deploy/runtime-check.cjs" && -f "$SRC/public/rank-rules.js" && -f "$SRC/public/index.html" && -f "$SRC/public/team.html" && -f "$SRC/public/team-core.js" && -f "$SRC/public/team.js" && -f "$SRC/public/engine/frame-data.js" && -f "$SRC/public/rollback.js" && -f "$SRC/public/engine/commands.js" && -f "$SRC/public/engine/boxes.js" && -f "$SRC/public/sprites/manifest.json" ]] || fail '更新包缺少必要檔案'
[[ $(node -p 'process.versions.node.split(".")[0]') -ge 20 ]] || fail '需要 Node.js 20+' 
command -v systemctl >/dev/null || fail '找不到 systemctl'
command -v curl >/dev/null || fail '找不到 curl'
EXPECTED_VERSION="$(node -p 'require(process.argv[1]).version' "$SRC/package.json")"
(cd "$SRC" && npm run check && npm test) || fail '專案檢查／測試未通過，已停止；舊版尚未變更'
if [[ ${1:-} == '--check' ]];then
 say "版本 $EXPECTED_VERSION 檢查通過；--check 不會寫入日誌、鎖定檔或修改服務。";exit 0
fi
[[ ${EUID:-99} -eq 0 ]] || fail '實際更新請用 root 執行'
command -v flock >/dev/null || fail '缺少 flock'
command -v runuser >/dev/null || fail '缺少 runuser'
id "$OWNER" >/dev/null 2>&1 || fail '找不到 azhi71 系統帳號'
exec 9>/run/lock/azhi71-upgrade.lock
flock -n 9 || fail '另一個更新正在執行'
exec > >(tee -a "$LOG") 2>&1
[[ ! -e "$BACKUP" && ! -e "$STAGING" ]] || fail '同名備份或暫存目錄已存在；請稍後重試，避免覆蓋。'
say '準備獨立暫存目錄，不碰 Nginx 或其他遊戲服務'
mkdir -p "$STAGING"
cp -a "$SRC/public" "$SRC/server" "$SRC/deploy" "$SRC/server.js" "$SRC/package.json" "$SRC/package-lock.json" "$SRC/test" "$SRC/README.md" "$STAGING/"
for doc in "$SRC"/README_8.6_*.md "$SRC"/AUDIT_8.6_*.md; do [[ ! -f "$doc" ]] || cp -a "$doc" "$STAGING/"; done
[[ ! -d "$SRC/docs" ]] || cp -a "$SRC/docs" "$STAGING/"
[[ ! -d "$SRC/tools" ]] || cp -a "$SRC/tools" "$STAGING/"
# Preserve art originals/manifests required by the packaged authoring tools and asset tests.
[[ ! -d "$SRC/assets" ]] || cp -a "$SRC/assets" "$STAGING/"
[[ ! -f "$SRC/ART_AND_LICENSE.md" ]] || cp -a "$SRC/ART_AND_LICENSE.md" "$STAGING/"
# Credentials and persistent data stay outside the application swap. Never copy
# source .env files or change /etc/azhi71.env, systemd, nginx or the database here.
# Migrations and DB backups are explicit operator steps; see ONLINE_DEPLOYMENT.md.
# Install exactly the reviewed lockfile before stopping the live service.
# Do not reuse old node_modules: even patch versions must match this release.
chown -R "$OWNER:$OWNER" "$STAGING"
say '在暫存目錄以專用非 root 帳號安裝鎖定的正式環境依賴'
runuser -u "$OWNER" -- env npm_config_cache=/tmp/azhi71-npm-cache npm --prefix "$STAGING" ci --omit=dev --ignore-scripts --no-audit --no-fund
[[ -d "$STAGING/node_modules/ws" ]] || fail '缺少 ws WebSocket 套件；舊版尚未變更。'
say '檢查 PostgreSQL／郵件／OAuth 套件及 Argon2 原生執行檔'
(cd "$STAGING" && runuser -u "$OWNER" -- node deploy/runtime-check.cjs) || fail '新版正式依賴無法執行；舊版尚未變更。請確認 Node.js／CPU 平台並保留 npm optional dependencies。'
active_before=0
if systemctl is-active --quiet "$SERVICE";then active_before=1;fi
# Once service replacement starts, recover the previous directory on any
# unexpected command failure too (for example, a failed rename).
restore_previous(){
 trap - ERR
 set +e
 say '嘗試還原更新前的應用程式與服務狀態'
 systemctl stop "$SERVICE"
 if [[ -d "$BACKUP" ]];then
  if [[ -e "$APP" ]];then mv "$APP" "$APP.failed.$STAMP";fi
  if [[ ! -e "$APP" ]];then mv "$BACKUP" "$APP";fi
 fi
 if [[ $active_before -eq 1 && -f "$APP/server.js" ]];then systemctl start "$SERVICE";fi
}
recover_swap_error(){
 local failure=$?
 restore_previous
 printf '\n[STOP] 更新中斷；已嘗試還原。請查看 %s 與 journalctl -u azhi71。\n' "$LOG" >&2
 exit "$failure"
}
trap recover_swap_error ERR
say "停止 $SERVICE（只有這個服務會短暫中斷，線上對局需重新進房）"
systemctl stop "$SERVICE"
say "保存原版到 $BACKUP"
mv "$APP" "$BACKUP"
mv "$STAGING" "$APP"
if ! systemctl start "$SERVICE";then
 restore_previous
 fail '新版未啟動，舊版已嘗試復原。請查看 journalctl -u azhi71。'
fi
healthy=0
for attempt in $(seq 1 12);do
 if curl -fsS --max-time 3 http://127.0.0.1:31071/healthz | node -e 'try { const h=JSON.parse(require("node:fs").readFileSync(0,"utf8")); process.exit(h.ok===true && h.version===process.argv[1] ? 0 : 1) } catch { process.exit(1) }' "$EXPECTED_VERSION";then healthy=1;break;fi
 sleep 1
done
if [[ $healthy -ne 1 ]];then
 say '新版健康檢查失敗，開始回滾'
 restore_previous
 fail '新版未通過健康檢查，已嘗試復原舊版。'
fi
trap - ERR
say '更新成功！舊版完整備份仍在，未刪除。'
echo "遊戲網址（須原本 Nginx 18071 正常）：http://YOUR_VPS_IP:18071/"
echo "備份目錄：$BACKUP"
echo '保持原有 Nginx、SSH、Docker、6.9 與 7.0 不變。'
echo '會員／排位需另依 docs/ONLINE_DEPLOYMENT.md 設定 HTTPS、資料庫、環境檔、Migration 與賽季；本腳本不修改這些設定。'
echo '若瀏覽器顯示舊圖，請按 Cmd + Shift + R 強制重新整理。'
echo "記錄檔：$LOG"
