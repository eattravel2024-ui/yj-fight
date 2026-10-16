# Player accounts and online competition — manual VPS update

No script in this change connects to a VPS, pushes Git or alters another project. Review the changes locally before publishing the branch. The current production version remains unchanged until the operator runs an update.

## Existing game only

After you publish this reviewed branch to GitHub, run in the **existing source checkout** on the VPS:

```bash
cd ~/azhi-update.lvccoe
git fetch origin
git switch feat/arcade-phase1
git pull --ff-only
npm ci --ignore-scripts --no-fund
npm run check
npm test
sudo bash deploy/upgrade-ubuntu.sh
curl -fsS --max-time 5 http://127.0.0.1:31071/healthz
```

If Git reports a missing branch, stop and verify that the reviewed commit has actually been pushed. The update script installs reviewed dependencies in a separate staging directory and tests Argon2id before stopping **only** `azhi71.service`. It retains the old `/opt/azhi71.backup.TIMESTAMP` directory and restores it on startup/health failure. It does not modify Nginx, SSH, other Docker services, `.env`, the database or other game versions. Guest gameplay works without database configuration; account/competition functions report unavailable explicitly.

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
- `APP_ORIGIN`: the game's canonical **HTTPS** origin, e.g. `https://game.example.com`.
- `NODE_ENV=production`, existing `HOST=127.0.0.1` and `PORT=31071`.
- `SMTP_HOST`, `SMTP_FROM`, SMTP credentials and TLS settings. Without SMTP, existing accounts can log in, but registration/verification/reset are unavailable. No verification links are returned by an API or printed to logs.
- Optional Google client ID/secret. Register the exact redirect URI `https://game.example.com/api/auth/google/callback`. This requires configuring Google's consent screen and testing with real Google credentials.

Install the **new game's modules only**, load the protected environment via systemd, back up the DB, then migrate the reviewed schema:

```bash
sudo install -d -m 0700 /var/backups/azhi71
sudo bash deploy/backup-postgres.sh /var/backups/azhi71
sudo systemd-run --wait --pipe --collect -p EnvironmentFile=/etc/azhi71.env -p WorkingDirectory="$PWD" /usr/bin/node tools/db-migrate.cjs
```

This reviewed migration command runs as root when the source checkout is under `/root`, so it does not require weakening `/root` permissions; PostgreSQL access still uses the restricted `azhi_app` role from the environment file. From an already installed readable `/opt/azhi71`, add `-p User=azhi71` instead. Do not enable the service environment drop-in until the migrations succeed; otherwise the upgrade health check correctly rejects an unmigrated database. For an existing non-container PostgreSQL service use its corresponding `pg_dump --format=custom` backup instead. Verify a restore on an isolated database before trusting backups. Keep backups off-host with the same privacy protection as player records.

To load the external environment, manually install the reviewed `deploy/azhi71-env.conf.example` as `/etc/systemd/system/azhi71.service.d/online.conf`. This drop-in only adds `EnvironmentFile=-/etc/azhi71.env`. Run `systemctl daemon-reload` and restart **only azhi71** when ready. A process restart voids incomplete official matches and releases their reservations without RP changes. Inform active players before maintenance.

## HTTPS and WSS

Keep Node on `127.0.0.1:31071`. Add the locations in `deploy/nginx-https-location.conf.example` **inside this game's existing HTTPS server block only**. Configure a valid certificate for the chosen domain; do not replace the VPS's global Nginx configuration or another site's server block. Preserve `/ws` Upgrade/Connection forwarding, host and origin headers. Validate with `sudo nginx -t` before reloading Nginx yourself. For per-user IP rate limits behind a loopback proxy, ensure Nginx overwrites `X-Real-IP` with `$remote_addr`, then enable `TRUST_PROXY_LOOPBACK=true`. Otherwise the application deliberately rate limits the TCP peer and does not trust client-supplied forwarded headers.

Production cookies use HttpOnly, SameSite=Lax and Secure for the HTTPS origin; account mutations require CSRF validation. Public HTTP IP-only access is suitable for guest gameplay, not production accounts. Never open the Node or database port to the public internet.

## Activate a season explicitly

Migration creates **Season 01 as draft**, with no guessed launch dates. Without an active dated season, quick/custom matches work but ranked search is unavailable. After both-player integration tests pass in staging, use your actual chosen ISO dates:

```bash
sudo systemd-run --wait --pipe --collect -p User=azhi71 -p EnvironmentFile=/etc/azhi71.env -p WorkingDirectory=/opt/azhi71 /usr/bin/node tools/season.cjs list
# Replace START_ISO and END_ISO before executing; for example an explicitly chosen UTC date.
sudo systemd-run --wait --pipe --collect -p User=azhi71 -p EnvironmentFile=/etc/azhi71.env -p WorkingDirectory=/opt/azhi71 /usr/bin/node tools/season.cjs activate season-01 --start START_ISO --end END_ISO
```

`end ID` refuses to close while matches are unfinished. `next NEW_ID --name "Season 02"` creates a draft season, retains historical accounts/matches/rankings and soft-resets MMR halfway toward 1000; players repeat five placement matches. It never overwrites an ended season's record. Activate the new draft with explicit dates. The CLI exposes no arbitrary RP-edit command or public administrator API.

## Verification, logs and rollback

Check `/healthz`, `/api/auth/capabilities`, account email delivery and `/api/competition/status`, then use two different browser accounts to verify queue → acceptance → asset loading → server-authoritative battle → result → profile. Ranked requires verified email; quick requires login. Legacy guest custom, 2v2 and spectators remain available. Official queue matches block unsolicited room joins and spectating.

Unexpected authenticated 1v1 disconnects pause both sides for a 30-second rotating-token reconnect window. Explicit leave forfeits once; both-player disconnect or server restart voids the match. Registered custom 1v1 matches are persisted; guest and 2v2 results are not ranked. There is no claim of seamless 2v2 reconnect. No frontend result/RP submission API exists.

Use `journalctl -u azhi71 -n 100 --no-pager` for startup errors. Logs intentionally omit passwords, session cookies, recipients and email links. Configure log retention with the VPS's existing logging policy. Monitor CPU, event-loop delays, memory, DB connections and storage before increasing the existing 200-room/500-client caps; those caps are limits, not a measured capacity promise.

The upgrade script's application backup does not include PostgreSQL. Restore application files and DB backups separately, with the game service stopped. The first migration is additive; do not drop tables to roll back a UI release. Keep secrets in `/etc/azhi71.env`, outside release swaps. Back up before each reviewed future migration.

## Fairness and operating limits

Ranked disconnects within the first 600 authoritative frames are void, without RP. Later explicit departures forfeit; a second forfeit between the same pair within an hour is void, preventing rapid alternate-account point farming. Five unfinished ranked preparations/early departures/forfeits in ten minutes temporarily block requeue. These rules reduce common abuse; they are not a complete anti-collusion/moderation service. Private room creation generates a 128-bit invitation code and requires login; changing a short-code public room into private requires creating a new private room.

Run exactly one authoritative Node process for this release. The database is persistent, while active input/room state belongs to that process; do not run multiple PM2/cluster workers against the same match tables. Distributed queues, regional relays, seamless process migration, 2v2 recovery, account self-service export/deletion and advanced moderation are follow-up work. Google and SMTP adapters are implemented, but real provider delivery/login requires your credentials and a staging smoke test. A configured SMTP delivery failure uses the same generic registration/reset response to avoid email enumeration; its token is invalidated, and a nonidentifying mail error is logged.

Equal-HP time-over rounds follow the original engine's replay rule; a duel does not fabricate a winner on a tied round. An official match that remains unresolved for 30 minutes is void. Confirmed result persistence failures hold the canonical result and retry idempotently; an active-game database authentication failure pauses the match and voids it when the database returns, without RP penalties. Full production failure-injection/load testing remains a staging acceptance step.
