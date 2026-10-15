# Local development, GitHub and VPS deployment

## Local
1. Install Node.js 22 or 24 (at least 20).
2. `npm install`
3. `npm run check && npm test`
4. `npm start`
5. Visit http://127.0.0.1:31071/ and `/team.html`.

## Branch strategy
- Keep `main` always runnable, reviewed and tested by GitHub Actions.
- Ask Codex to create feature branches/PRs rather than directly editing main.
- Mark known-good releases (e.g., `v8.6.0`).

## VPS deployment (manual approval only)
GitHub is the source code/version-control repository, not the running production server.
Do not publish directly from Codex or set up auto-deploy to production initially.
For an approved release, use the project's existing `deploy/upgrade-ubuntu.sh --check`, follow its output, back up the current app, then run the upgrade script manually as root; confirm `/healthz` and review journal logs. The script targets existing `azhi71` and its port 31071. Production edge proxy and firewall must be configured separately and reviewed.
Never assume the VPS contains the same code as GitHub; check `/healthz` version first. Preserve a rollback backup.

## Publishing caution
The source snapshot includes five user-provided character portraits / likeness-based art. Keep GitHub private until publication rights are confirmed. The upstream KOF XIII repository is used for architecture inspiration only; no proprietary sprite sheets should be imported without permission.
