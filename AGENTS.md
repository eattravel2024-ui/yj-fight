# Codex development instructions — 阿志向錢衝 / Azhi Fighting

## Goal
Maintain and improve the existing browser-based 60 Hz fighting game, without removing existing modes.
Current baseline: 8.10.2. Preserve the four playable characters (維尼, 塞子, 金沙賭神, 阿志), 1v1, 2v2, spectators, player/room names, arcade mode, and WebSocket networking. Sam was removed at the user’s request; do not restore that character or its assets.

## Source map
- `server.js`: HTTP + authoritative WebSocket rooms, 1v1 and 2v2, validation and identities.
- `public/core.js`: deterministic fighting simulation. Do not couple to canvas frame rate.
- `public/team-core.js`: four-fighter simulation, no friendly fire, team rules.
- `public/rollback.js`: input histories, prediction, deterministic rollback and resync.
- `public/game.js`, `public/team.js`: UI, visuals and client networking.
- `public/combat-coach.js`: read-only cancel hints and hit receipts. Online receipts must use confirmed server events and deduplicate their IDs.
- `public/character-art.js`, `public/character-art.css`: UI-only art registry, bounded same-character fallback and image fit; never substitute UI fullbodies for battle atlases. Original uploaded PNGs and their manifest live in `assets/source-art/phase1_5/`; rebuild with `tools/build_character_ui_art.py`.
- `public/game-flow.js`: UI-only navigation and draft mode; never duplicate combat/Ready authority. Formal `window.AzhiGame` adapters expose existing client state/actions; preserve Debug APIs for existing tests.
- `public/save-state.js`: validates the existing `azhi70_save` before lookup; preserve valid economy/progress/settings.
- `public/game-shell.js`, `public/game-shell.css`, `public/arcade-menu.css`: shared full-window layout and in-game menu; preserve original control IDs and native gameplay handlers. Local menus pause simulation; online menus must keep synchronization running with neutral input.
- `public/vfx.js`, `public/sprites/`, `public/art/`: animation and visuals.
- `public/engine/`: frame-data, commands, hitboxes and AI.
- `test/`: regression tests. Add tests for any rule or protocol change.
- `deploy/`: existing Ubuntu VPS scripts. Never run these as a consequence of development tasks.

## Non-negotiable constraints
1. Keep deterministic 60 Hz simulation; drawing and input scheduling must not alter simulation outcomes.
2. Keep backwards compatibility with existing 1v1 and 2v2 flow unless the change is explicitly requested.
3. Never blindly upgrade, restart, or reconfigure the production VPS. Never modify its Nginx, SSH, Docker or firewall configuration without separate explicit approval.
4. Online changes need input validation and tests covering messages, disconnects, spectators, role permissions, and player count limits.
5. Do not add KOF XIII proprietary art, voice lines, sprites or third-party images without verified permission. Character portraits may depict real people; confirm publication rights before making the repository public.
6. Never commit any `.env`, credential, key, private address, production database, chat/user data, or deployment token.
7. Avoid unrelated refactors. Open small focused PRs. Document risks and a rollback path.
8. Run `npm run check` and `npm test`; if you cannot run them, say so in the PR summary.

## Suggested workflow
- Read README.md and docs/ROADMAP.md first.
- Write/adjust tests before deep combat or network changes.
- Use a feature branch: `feat/<topic>` / `fix/<topic>`.
- Summarize affected files, tests, visual changes, regressions and deployment impact.
- Do not claim two real devices have been tested unless they actually have.

## Initial priorities
1. Ready/start confirmation is implemented; preserve server-owned readiness, roster revisions and host-only start. Continue full lobby improvements.
2. Reconnect tokens, reconnect grace period and recovery of authoritative state.
3. Privacy and auth boundaries: room password/invite, spectator permissions, abuse/rate limits.
4. Gameplay tuning, training/tutorial flow, touch ergonomics.
5. 2v2 load, latency and rollback testing; state checksum/desync diagnostics.

## Arcade 2.0 phased delivery
Phase 1.5 supplied character UI art is integrated (8.10.1); three scene sources/optimized assets/metadata are prepared (8.10.2), without changing live stages. Character selection layout and all combat/stage data are unchanged. Phase 1 main menu/common navigation is implemented on `feat/arcade-phase1`. Stop after each approved phase; do not implement Phase 2–5 or push GitHub without user authorization. Home has six entries; confirming local modes opens the existing fighter panel, not a new Character Select. Escape returns subpanel → home → arena. Preserve busy-room guards on all cross-mode routes.

## User preference: fast iteration
Reuse the current development branch for small follow-up changes; do not create a new branch or require a new PR for every iteration. Run the relevant lightweight checks automatically. Use browser or extended suites only when justified by the change. Package one current source archive and give short manual VPS update instructions; never connect to production. Consolidate review/PRs at milestones rather than making the user manage branch stacks.
