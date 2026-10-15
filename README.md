# 阿志向錢衝 — Fighting Game

> GitHub/Codex development baseline: **8.6.0**. Self-hosted Node.js + HTML Canvas 2D fighting game.

Features: 60 Hz deterministic simulation, 1v1 WebSocket rooms, 2v2 same-stage multiplayer, spectators, rollback input replay, named players/rooms, five playable characters and a single-player practice/arcade experience.

## Quick start

Requirements: Node.js >= 20 (prefer 22 or 24).

```bash
npm install
npm run check
npm test
npm start
```

Open `http://127.0.0.1:31071/` (main game) or `http://127.0.0.1:31071/team.html` (2v2 / spectator UI).

## Project layout

| File/folder | Responsibility |
| --- | --- |
| `server.js` | HTTP, WebSocket, rooms, player messages, authoritative network logic |
| `public/core.js` | Deterministic 60 Hz combat simulation |
| `public/team-core.js` | 2v2 four-fighter simulation |
| `public/rollback.js` | Prediction, input history and rollback |
| `public/engine/` | Frame-data, command parsing, collision and AI |
| `public/game.js`, `public/team.js` | Browser gameplay and interface |
| `public/art/`, `public/sprites/`, `public/vfx.js` | Character art, sprite sheets and effects |
| `test/` | Node tests for gameplay and networking |
| `deploy/` | Manual Ubuntu install, update and rollback |

## Working with Codex

See [AGENTS.md](AGENTS.md), [Codex starter task](docs/CODEX_STARTER.md), and [development roadmap](docs/ROADMAP.md). Work on separate feature branches and PRs; GitHub Actions will run syntax checks and tests.

## Safety & license

- This repository contains user-provided character/portrait assets and generated art. **Review likeness/image publication rights before publishing publicly**; ensure you have permission to distribute these assets publicly.
- `vincent-li/kof13` was examined as a reference for game-engine organization; no KOF XIII proprietary game art should be used without permission.
- Do not commit SSH credentials, secrets, `.env`, personal data or VPS runtime backups.
- GitHub source hosting does **not** automatically deploy/restart the production VPS. Production deploys require explicit approval and manual testing; see [deployment guide](docs/DEPLOYMENT.md).
- Formal third-party license and art provenance audit still required before public/commercial distribution; see `ART_AND_LICENSE.md`.

## Publishing baseline

This project is a source snapshot of 8.6.0, not a live sync with the VPS.
The VPS IP is intentionally replaced with `YOUR_VPS_IP` in the public repository.
Do not commit real credentials, production logs, or server backup directories.

Run `bash publish-to-github.sh` on your local Mac after authenticating to GitHub.
This script verifies the remote is empty and does not force-push over existing code.
