# 8.15.1 — 帳號密碼註冊與 IP／HTTP 部署（免 Email、SMTP、網域）

此版已獲使用者授權推送 GitHub，分支為 `feat/phase4-5-grapples`，包含 Phase 4.5 與立法院。註冊只需帳號、至少 8 碼密碼，暱稱選填；不限制必須混合大小寫、數字或符號。保留救援碼與 PostgreSQL。以下命令僅由主機管理者手動執行；Codex 不會連線或部署正式 VPS。健康版本應為 **8.15.1**。

## Existing game only

After you publish this reviewed branch to GitHub, run in the **existing source checkout** on the VPS:

```bash
cd ~/azhi-update.lvccoe
git fetch origin feat/phase4-5-grapples:refs/remotes/origin/feat/phase4-5-grapples
git switch feat/phase4-5-grapples
git pull --ff-only origin feat/phase4-5-grapples
npm ci --ignore-scripts --no-fund
npm run check
npm test
sudo bash deploy/upgrade-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
```

If Git reports a missing branch, stop and verify that the reviewed commit has actually been pushed. The update script installs reviewed dependencies in a separate staging directory and tests Argon2id before stopping **only** `azhi71.service`. It retains the old `/opt/azhi71.backup.TIMESTAMP` directory and restores it on startup/health failure. It does not modify Nginx, SSH, other Docker services, `.env`, the database or other game versions. Guest gameplay works without database configuration; account/competition functions report unavailable explicitly.

## First-time IP/HTTP accounts

**僅適用尚未建立本遊戲資料庫／環境檔的主機**。先依上方 Git 指令取得本版並完成 `npm ci`，不必先執行 upgrade。需要 Node.js 20+、已安裝 Docker Compose，以及原有 `/opt/azhi71`／`azhi71` 服務。已有 `/etc/azhi71.env`、資料庫或資料卷時，此流程會停止，請改沿用下方既有資料庫設定，勿刪除環境檔或資料卷重做。

將第一行換成瀏覽器實際使用的 IP／Port，然後在 VPS 的遊戲原始碼目錄執行。腳本只建立專用資料庫、私密環境檔與本遊戲 systemd drop-in，不改 Nginx／SSH 或其他容器。使用 HTTP 未加密，請使用獨立遊戲密碼；HTTPS 可選，無需購買網域。

```bash
AZHI_GAME_ORIGIN='http://YOUR_VPS_IP:18071'
sudo bash -s -- "$AZHI_GAME_ORIGIN" "$PWD" <<'BASH'
set -euo pipefail
export AZHI_GAME_ORIGIN="$1"
cd "$2"
id azhi71 >/dev/null
docker info >/dev/null
docker compose version >/dev/null
command -v ss >/dev/null
if [[ -n "$(ss -H -ltn 'sport = :15432')" ]]; then
  echo '15432 已被使用；請依既有資料庫章節選其他 loopback Port。' >&2; exit 1
fi
if docker container inspect azhi-db >/dev/null 2>&1 || docker volume inspect azhi-db-data >/dev/null 2>&1; then
  echo 'azhi-db 或資料卷已存在；請沿用原資料庫，不要重新初始化。' >&2; exit 1
fi
umask 077
node <<'NODE'
const fs=require('node:fs'),crypto=require('node:crypto');
const files=['/etc/azhi71-db.env','/etc/azhi71.env'];
for(const file of files)if(fs.existsSync(file))throw new Error(file+' 已存在；請沿用設定，未覆寫。');
const origin=process.env.AZHI_GAME_ORIGIN,u=new URL(origin);
if(!['http:','https:'].includes(u.protocol)||u.origin!==origin||/YOUR_VPS_IP/i.test(origin)||u.username||u.password)throw new Error('請填入正確的遊戲 Origin，例如 http://實際IP:18071，不含路徑。');
const admin=crypto.randomBytes(32).toString('hex'),app=crypto.randomBytes(32).toString('hex');
fs.writeFileSync(files[0],`POSTGRES_PASSWORD=${admin}
AZHI_DB_PASSWORD=${app}
AZHI_DB_BIND_PORT=15432
`,{flag:'wx',mode:0o600});
fs.writeFileSync(files[1],`NODE_ENV=production
HOST=127.0.0.1
PORT=31071
APP_ORIGIN=${origin}
ALLOW_INSECURE_HTTP=${u.protocol==='http:'}
DATABASE_URL=postgresql://azhi_app:${app}@127.0.0.1:15432/azhi
AZHI_REGION=asia
`,{flag:'wx',mode:0o600});
NODE
chown root:azhi71 /etc/azhi71.env
chmod 0640 /etc/azhi71.env
docker compose --env-file /etc/azhi71-db.env -f deploy/postgres.compose.yml config --quiet
docker compose --env-file /etc/azhi71-db.env -f deploy/postgres.compose.yml up -d postgres
ready=0
for attempt in $(seq 1 30); do
  if docker exec azhi-db psql -U azhi_admin -d azhi -tAc 'SELECT 1' >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
[[ "$ready" == 1 ]] || { echo '專用 PostgreSQL 未就緒，已停止；保留資料與設定。' >&2; exit 1; }
install -d -m 0700 /var/backups/azhi71
bash deploy/backup-postgres.sh /var/backups/azhi71
systemd-run --wait --pipe --collect -p EnvironmentFile=/etc/azhi71.env -p WorkingDirectory="$PWD" /usr/bin/node tools/db-migrate.cjs
install -d /etc/systemd/system/azhi71.service.d
install -m 0644 deploy/azhi71-env.conf.example /etc/systemd/system/azhi71.service.d/online.conf
systemctl daemon-reload
bash deploy/upgrade-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
curl -fsS --max-time 5 http://127.0.0.1:31071/api/auth/capabilities
BASH
```

確認 `version` 為 `8.15.1`、`accounts:true`、`authMethod:"username"`、`emailRequired:false` 與 `password.minLength:8`，再強制重新整理瀏覽器。密碼自動隨機產生並只寫入私密設定檔，命令不會列印憑證。這是首次設定，不是重試／密碼輪換工具；中途中斷請保留檔案與資料，依下方步驟續作。後續普通更新只需上方 Git／upgrade，不重建資料庫。排位另需設定實際賽季日期，註冊／登入／快速匹配不需要先啟用賽季。

## Enable persistent accounts and competitive matches

Node.js 20+ and PostgreSQL 16+ are required. Prefer an existing compatible database with a **dedicated non-superuser database and role**. Never reuse another project's database or credentials. Production migrations are explicit and not run on every app startup.

If you want a separate database container, review `deploy/postgres.compose.yml`. Choose an unused **loopback** port first; its default is `15432`. Keep two different strong passwords in a root-only `/etc/azhi71-db.env` file (`POSTGRES_PASSWORD`, `AZHI_DB_PASSWORD`, optional `AZHI_DB_BIND_PORT`). Never put secrets in the checkout or shell command history. Then run:

```bash
sudo docker compose --env-file /etc/azhi71-db.env -f deploy/postgres.compose.yml config --quiet
sudo docker compose --env-file /etc/azhi71-db.env -f deploy/postgres.compose.yml up -d postgres
sudo docker exec azhi-db pg_isready -U azhi_admin -d azhi
```

This opt-in container uses its own `azhi-db-data` volume; **do not run `down -v`**. Existing initialized databases are not reconfigured by the init script. Changing an environment password later does not rotate the PostgreSQL role's actual password.

Copy `.env.example` to `/etc/azhi71.env` with permissions `root:azhi71 0640`, and edit it locally on the VPS. Required values:

- `DATABASE_URL`: URL for the dedicated `azhi_app` role; percent-encode special password characters.
- `APP_ORIGIN`: the exact browser-facing game origin, including the port: `http://YOUR_VPS_IP:18071` for the existing IP-only installation. Replace the placeholder with your own public IP. No path or trailing slash.
- `ALLOW_INSECURE_HTTP=true` explicitly permits this public HTTP origin. HTTP does **not** encrypt passwords, session cookies or recovery codes; use unique game passwords and save recovery codes privately. HTTPS with an IP certificate remains optional; no domain is required by the account model.
- `NODE_ENV=production`, existing `HOST=127.0.0.1` and `PORT=31071`.
No SMTP, Email verification, Google OAuth or third-party account credentials are needed. Registration only requires a unique case-insensitive username and an 8–128 character password; nickname is optional (generated from the username when omitted) and remains editable. No password composition rules are enforced; existing passwords still work. The UI presents a one-use recovery code once; PostgreSQL stores only its hash. Password recovery revokes all prior sessions, consumes the previous code and presents a replacement once. Logged-in players can rotate the code with their current password and CSRF verification. If both password and recovery code are lost, there is no automatic recovery.

Install the **new game's modules only**, load the protected environment via systemd, back up the DB, then migrate the reviewed schema. If an account service is already active, schedule maintenance and stop **only azhi71** for this identity migration; do not allow the old registration API to write during conversion. Install/start the new release after migration:

```bash
sudo install -d -m 0700 /var/backups/azhi71
sudo bash deploy/backup-postgres.sh /var/backups/azhi71
sudo systemd-run --wait --pipe --collect -p EnvironmentFile=/etc/azhi71.env -p WorkingDirectory="$PWD" /usr/bin/node tools/db-migrate.cjs
```

This reviewed migration command runs as root when the source checkout is under `/root`, so it does not require weakening `/root` permissions; PostgreSQL access still uses the restricted `azhi_app` role from the environment file. From an already installed readable `/opt/azhi71`, add `-p User=azhi71` instead. Do not enable the service environment drop-in until the migrations succeed; otherwise the upgrade health check correctly rejects an unmigrated database. For an existing non-container PostgreSQL service use its corresponding `pg_dump --format=custom` backup instead. Verify a restore on an isolated database before trusting backups. Keep backups off-host with the same privacy protection as player records.

To load the external environment, manually install the reviewed `deploy/azhi71-env.conf.example` as `/etc/systemd/system/azhi71.service.d/online.conf`. This drop-in only adds `EnvironmentFile=-/etc/azhi71.env`. Use the commands below to reload systemd and start the **updated** game through its upgrade script; do not restart an old Email-only service midway through migration. A process restart voids incomplete official matches and releases their reservations without RP changes. Inform active players before maintenance.

## Existing IP / HTTP deployment and optional HTTPS

Keep Node on `127.0.0.1:31071` and PostgreSQL on loopback. The existing Nginx `18071` game site can serve `/api/` through its existing `location /` proxy, and `/ws` must retain Upgrade/Connection forwarding. **Do not replace existing Nginx files.** With `APP_ORIGIN=http://YOUR_VPS_IP:18071` and `ALLOW_INSECURE_HTTP=true`, accounts use HttpOnly, SameSite=Lax cookies without Secure because the connection is HTTP. CSRF and strict Origin checks remain enabled, including the production WebSocket Origin check.

After migrations succeed, install only the environment drop-in and then run the reviewed game upgrade:

```bash
sudo install -d /etc/systemd/system/azhi71.service.d
sudo install -m 0644 deploy/azhi71-env.conf.example /etc/systemd/system/azhi71.service.d/online.conf
sudo systemctl daemon-reload
sudo bash deploy/upgrade-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
```

An HTTP-to-HTTPS change later requires changing APP_ORIGIN to the exact HTTPS origin and setting ALLOW_INSECURE_HTTP=false; cookies automatically gain Secure. The optional `deploy/nginx-https-location.conf.example` is an incremental HTTPS example, not a required domain setup. Validate any manually edited Nginx configuration with `sudo nginx -t` before reloading it. Never alter another project's site. For per-user IP rate limits behind a loopback proxy, have Nginx overwrite `X-Real-IP` with `$remote_addr` before enabling `TRUST_PROXY_LOOPBACK=true`. Otherwise the application rate limits the TCP peer and does not trust client-supplied forwarded headers.

Migration `003_username_recovery.sql` retains old UUIDs, passwords, sessions, histories and ratings, assigning old accounts a stable 32-character username derived from their UUID. Existing password users may still enter their old login identifier into the username field, then read their generated username and create a rescue code in their profile. Old Email reset/verification and Google endpoints now return 404. No new Email addresses are collected. Retired provider tables and existing Email columns remain solely for historical compatibility; old unconsumed email tokens are invalidated. Google-only accounts without a password need a separate operator-assisted identity review; they cannot create a rescue code without a current password. Do not downgrade to 8.14.0's email-only login after users create new username accounts; back up the DB and retain a compatible account service.

## Activate a season explicitly

Migration creates **Season 01 as draft**, with no guessed launch dates. Without an active dated season, quick/custom matches work but ranked search is unavailable. After both-player integration tests pass in staging, use your actual chosen ISO dates:

```bash
sudo systemd-run --wait --pipe --collect -p User=azhi71 -p EnvironmentFile=/etc/azhi71.env -p WorkingDirectory=/opt/azhi71 /usr/bin/node tools/season.cjs list
# Replace START_ISO and END_ISO before executing; for example an explicitly chosen UTC date.
sudo systemd-run --wait --pipe --collect -p User=azhi71 -p EnvironmentFile=/etc/azhi71.env -p WorkingDirectory=/opt/azhi71 /usr/bin/node tools/season.cjs activate season-01 --start START_ISO --end END_ISO
```

`end ID` refuses to close while matches are unfinished. `next NEW_ID --name "Season 02"` creates a draft season, retains historical accounts/matches/rankings and soft-resets MMR halfway toward 1000; players repeat five placement matches. It never overwrites an ended season's record. Activate the new draft with explicit dates. The CLI exposes no arbitrary RP-edit command or public administrator API.

## Verification, logs and rollback

Check `/healthz`, `/api/auth/capabilities`, username registration/recovery and `/api/competition/status`, then use two different browser accounts to verify queue → acceptance → asset loading → server-authoritative battle → result → profile. Quick and ranked require a logged-in active account; ranked also requires an active dated season. No Email verification is checked. Legacy guest custom, 2v2 and spectators remain available. Official queue matches block unsolicited room joins and spectating.

Unexpected authenticated 1v1 disconnects pause both sides for a 30-second rotating-token reconnect window. Explicit leave forfeits once; both-player disconnect or server restart voids the match. Registered custom 1v1 matches are persisted; guest and 2v2 results are not ranked. There is no claim of seamless 2v2 reconnect. No frontend result/RP submission API exists.

Use `journalctl -u azhi71 -n 100 --no-pager` for startup errors. Logs intentionally omit passwords, session cookies and recovery codes. Configure log retention with the VPS's existing logging policy. Monitor CPU, event-loop delays, memory, DB connections and storage before increasing the existing 200-room/500-client caps; those caps are limits, not a measured capacity promise.

The upgrade script's application backup does not include PostgreSQL. Restore application files and DB backups separately, with the game service stopped. The first migration is additive; do not drop tables to roll back a UI release. Keep secrets in `/etc/azhi71.env`, outside release swaps. Back up before each reviewed future migration.

## Fairness and operating limits

Ranked disconnects within the first 600 authoritative frames are void, without RP. Later explicit departures forfeit; a second forfeit between the same pair within an hour is void, preventing rapid alternate-account point farming. Five unfinished ranked preparations/early departures/forfeits in ten minutes temporarily block requeue. These rules reduce common abuse; they are not a complete anti-collusion/moderation service. Private room creation generates a 128-bit invitation code and requires login; changing a short-code public room into private requires creating a new private room.

Run exactly one authoritative Node process for this release. The database is persistent, while active input/room state belongs to that process; do not run multiple PM2/cluster workers against the same match tables. Distributed queues, regional relays, seamless process migration, 2v2 recovery, account self-service export/deletion and advanced moderation are follow-up work. Mail and Google dependencies have been removed; all account and competition data remain in the dedicated PostgreSQL database.

Equal-HP time-over rounds follow the original engine's replay rule; a duel does not fabricate a winner on a tied round. An official match that remains unresolved for 30 minutes is void. Confirmed result persistence failures hold the canonical result and retry idempotently; an active-game database authentication failure pauses the match and voids it when the database returns, without RP penalties. Full production failure-injection/load testing remains a staging acceptance step.
