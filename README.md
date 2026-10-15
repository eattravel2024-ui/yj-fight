# 狠話擂台 — Big Talk / Real Fight

> GitHub/Codex development baseline: **8.9.3**. Self-hosted Node.js + HTML Canvas 2D fighting game.

Features: 60 Hz deterministic simulation, 1v1 WebSocket rooms, 2v2 same-stage multiplayer, spectators, rollback input replay, named players/rooms, four playable characters and a single-player practice/arcade experience.

## Quick start

Requirements: Node.js >= 20 (prefer 22 or 24).

```bash
npm ci --ignore-scripts
npm run check
npm test
npm start
```

Open `http://127.0.0.1:31071/` (main game) or `http://127.0.0.1:31071/team.html` (2v2 / spectator UI).

## 8.9.3 Gambler video-based animation

Gambler now uses 21 transparent key poses based on the user's second supplied video: glasses, black tactical suit and cyan piping, including punches, kicks and a charged counter strike. Missing poses are supplementary generated art. His identity, signature name, counter armor and combat frame-data remain unchanged. Both Azhi and Gambler use 384×300 cells; rebuild Gambler with `python tools/build_azhi_video_atlas.py --fighter gambler`.

## 8.9.2 Azhi video-based animation

Azhi now uses 21 transparent key poses generated from the user's supplied video references, packed into 17 actions × 10 timeline frames. His green shirt, black trousers and pink towel follow the video; missing poses are supplementary generated art. The wider 384×300 cells keep extended limbs intact while preserving height, ground anchors, move timing and collision rules. Rebuild with `python tools/build_azhi_video_atlas.py` (Pillow required for authoring only).

## 8.9.1 viewport and character selection

The stage now fits the viewport height so health bars and the full fight remain visible together. Character selection sits before the arena, with a current-fighter summary, selected-card badges and a link from the battle area. Mobile landscape keeps the full stage aspect ratio using letterboxing. Combat rules, fighter scale and fixed camera are unchanged.

## 8.9 Ready, skill status and combat fairness

1v1 and 2v2 now wait for every player to press Ready, then the host starts the match. Changing a character or room membership resets readiness; rematches also require host confirmation. Skill buttons show energy shortage, stun, startup/active/recovery, valid cancels and the final 8-frame input buffer. Character skill poses follow simulation phases, airborne poses follow movement state, and hitstop holds animation. Same-frame melee/projectile contacts use frozen geometry; combo damage scales to a 45% floor (supers 60%). See [8.9 release notes](docs/UPGRADE_8.9.md).

## 8.8 character entrances and signature moves

Four original fighters return with dedicated entrances, frame-driven skill choreography and easy one-button signatures: 維尼「不同意的請舉手」、塞子「高雄發大財」、金沙賭神「膽大撐死膽小餓死」、阿志「加油加300」. Press U (25 energy) or O (60 energy). Includes synchronized pre-fight countdown, original port arena, a wider arena with a fixed camera and double-tap dash. See [8.8 release notes](docs/UPGRADE_8.8.md) and [manual VPS commands](docs/MANUAL_RELEASE.md).

## 8.7 gameplay update

Modern fighting-game HUD, four original fighters, one-button signatures (U / 25 energy) and supers (O / 60 energy), original per-character effects, improved combat parity and preserved game modes. Sam has been removed as requested; old selections safely fall back to Azhi. See [release notes](docs/UPGRADE_8.7.md), [manual VPS commands](docs/MANUAL_RELEASE.md), and `npm run test:e2e` for browser validation.

Ready and explicit host start are available in 1v1 and 2v2. Reconnect recovery and private-room authorization remain planned; room links are not access controls.

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

This project is a source snapshot, with the reviewed 8.7 development upgrade, not a live sync with the VPS.
The VPS IP is intentionally replaced with `YOUR_VPS_IP` in the public repository.
Do not commit real credentials, production logs, or server backup directories.

Run `bash publish-to-github.sh` on your local Mac after authenticating to GitHub.
This script verifies the remote is empty and does not force-push over existing code.
