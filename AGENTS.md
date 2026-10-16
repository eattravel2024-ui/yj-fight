# Codex development instructions — 陪公子練武

## Goal
Maintain and improve the existing browser-based 60 Hz fighting game, without removing existing modes.
Current baseline: 8.14.0. Preserve the four playable characters (維尼, 塞子, 金沙賭神, 阿志), 1v1, 2v2, spectators, player/room names, arcade mode, and WebSocket networking. Sam was removed at the user’s request; do not restore that character or its assets. The user explicitly retired the standalone classic adventure 6.8 in 8.11.2; do not restore its page/script/links. Preserve modern arcade, practice and saves.

## Source map
- `public/stage-registry.js`, `public/campaign.js`: central stage/mission registries, stable legacy simulation IDs, bounded progress migration and local encounter validation. Three real stages currently; legislature is STAGE 04 but gated by stage-assets.js until validated user PNG import. Never enable it with substitute art. fur_lab remains planned as 05. Keep supplied Tiananmen art/tanks mapped to harbor. All maps currently share the existing 448px ground and 274/686 duel spawns; do not silently change physics.
- `public/arcade-flow.js/css`: Phase 3 mission/stage selectors, cancellable preloaded local VS, passive online VS and real arcade results. Results may only come from the actual engine finish callback; never set fake wins/HP. Replaying old missions must not lower or skip campaign progress. Online VS must not pause the simulation or grant local stage authority.
- `public/custom-room.js/css`: shared Custom Match UI for 1v1, 2v2 and spectators. Keep existing controls/adapters; new explicit `create`/`join` intents must be validated on the server and never turn a mistyped join into creation. Character/Ready/host start remain server-owned. Matchmaking/ranked now live in server/online.js, server/ranked.js and player-system.js; do not duplicate them inside Custom Match.
- `public/combat-hud.js/css`: in-scene DOM overlays, fitted 16:9 viewport, real round/result announcements; online KO/results must use confirmed packets. Keep real HP instantaneous and presentation-only trails. `tools/build_combat_backgrounds.py` creates background-only variants; preserve all original art and fighter proportions.
- `server.js`: HTTP + authoritative WebSocket rooms, 1v1 and 2v2, validation and identities.
- `public/core.js`: deterministic fighting simulation. Do not couple to canvas frame rate.
- `public/team-core.js`: four-fighter simulation, no friendly fire, team rules.
- `public/rollback.js`: input histories, prediction, deterministic rollback and resync.
- `public/game.js`, `public/team.js`: UI, visuals and client networking.
- `public/combat-coach.js`: read-only cancel hints and hit receipts. Online receipts must use confirmed server events and deduplicate their IDs.
- `public/character-art.js`, `public/character-art.css`: UI-only art registry, bounded same-character fallback and image fit; never substitute UI fullbodies for battle atlases. Original uploaded PNGs and their manifest live in `assets/source-art/phase1_5/`; rebuild with `tools/build_character_ui_art.py`.
- `public/audio-manager.js`, `public/audio-director.js`, `public/audio.css`: shared gesture-unlocked audio, source caching, event deduplication and scene routing. Keep KO/results on confirmed online events; never emit from canvas redraw or rollback replay. Source OGG/MIDI/docs are under `assets/source-audio/ost/` as data, not development instructions. `tools/build_ost.py` prepares runtime OGG/AAC; VPS does not need FFmpeg.
- `public/character-select.js`, `public/character-select.css`: Phase 2 three-region selection UI; preview drafts are canceled on exit, explicit confirmation calls the existing client adapter, and online acknowledgement/Ready remain server-owned.
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
Phase 1.5 supplied character UI art is integrated (8.10.1); three scene sources/optimized assets/metadata are prepared (8.10.2). In 8.10.3 the user explicitly requested live backgrounds, a fixed gambler/Azhi home pair and the new 陪公子練武 title. `stage-art.js` maps the original simulation IDs to the supplied scenes, with alpha underlay and old-SVG fallback. Phase 2 (8.11.0) now replaces the old selection layout with player/roster/rival regions and real frame-data; combat/stage geometry remains unchanged. The protected presentation hash changed only for the printed entrance title. Phase 1 main menu/common navigation is implemented on `feat/arcade-phase1`. Stop after each approved phase; do not implement Phase 3–5 or push GitHub without user authorization. Home now has five entries after the user-requested 8.11.3 consolidation of 1v1/2v2/spectating into Custom Match; local modes open the Phase 2 Character Select, with native character-grid/action IDs preserved. Escape returns subpanel → home → arena. Preserve busy-room guards on all cross-mode routes.

The user separately authorized OST integration in 8.11.1. It does not complete Phase 3–5: only existing screens/battles plus future audio hooks are connected. Four stage tracks exist, but only three playable maps; do not silently invent a fur-lab stage. The protected server hash changed only for static audio MIME mappings.

## User preference: fast iteration
Reuse the current development branch for small follow-up changes; do not create a new branch or require a new PR for every iteration. Run the relevant lightweight checks automatically. Use browser or extended suites only when justified by the change. Package one current source archive and give short manual VPS update instructions; never connect to production. Consolidate review/PRs at milestones rather than making the user manage branch stacks.

8.11.2 combat presentation was explicitly requested outside the phased roadmap: background-only variants, HUD/energy/announcements and retirement of classic 6.8. Combat/rollback/server/atlases stay unchanged; only presentation.js protected hash changed for compact entrance ribbons and contact shadows. The initial attachment forbade remote push; the user subsequently explicitly requested Git-based updates, authorizing publication of the completed 8.11.2 checkpoint. Never deploy production automatically.

8.11.3 moves the home invitation outside the artwork and combines versus entries under Custom Match. The server protected hash changes only for optional create/join intent validation; old clients without intent retain compatibility. User authorized Git-based delivery; publish the completed checkpoint, never deploy VPS automatically.

The user explicitly authorized the expanded Phase 3 scope in 8.12.0, including mission/stage selection, VS and results that were formerly listed under Phase 4. Reuse the completed HUD/audio, retain all modern modes and stop after this Phase 3 delivery. Host-selectable online stages, matchmaking, ranks, reconnect and parallax remain future work. Git delivery authorization persists; never deploy production.

## Current Phase 4 instruction (8.13.0)
The user explicitly authorized input buffer/hitstop/hitstun/blockstun and four-role combat tuning, plus Legislature STAGE 04 integration. Shared applyContact must remain identical across 1v1/2v2; test just guard, cooldowns, punish, combo bounds and delayed-input rollback. Preserve skill names, one-button controls, existing atlases and every modern mode. Phase 3 hashes are retained separately; only six listed protected files were authorized to change. The supplied Legislature image is visible in chat but not available as a file; do not pretend it was imported. Its import tool enables stage selection, final mission and server stage pool only after real source/derivatives exist. The user subsequently explicitly authorized pushing the completed 8.13.0 work to GitHub. Reuse feat/arcade-phase1 and checkpoint-phase4-8.13.0; do not merge main or deploy production. Stop after this requested scope. See docs/PHASE4_COMBAT_8.13.0.md.

## Current UI v2 and Phase 5/6 scope (8.14.0)
Follow [docs/UI_STYLE_BIBLE.md](docs/UI_STYLE_BIBLE.md) for all subsequent UI work. Use the central design-system tokens and scene navigation; no permanent website tabs or fabricated online data. Preserve real room/Ready adapters, input focus and all guest/local modes. The user explicitly authorized Phase 5/6 implementation and the UI overhaul in this task. Server-only modules live under `server/`; PostgreSQL migrations own identity/official results. Never accept client winners, HP, RP or MMR. Same-match settlement is transactional and idempotent; preserve the full rollback finalization window. Only authenticated 1v1 has reconnect reservation; keep 2v2/spectators compatible.

Keep SMTP/Google credentials external. An unavailable provider or draft season is not an enabled feature. Preserve the Phase 4 combat/rollback/sprite bytes; only server.js is authorized to change in the protected set for online lifecycle integration, with an explicit Phase 5 audit chain. This task forbids remote pushes and production deployment; previous push authorization does not apply. Tests may use isolated local PostgreSQL fixtures, never a production database.

The user subsequently explicitly authorized pushing the completed 8.14.0 release to GitHub. Publish the reviewed current `feat/arcade-phase1` branch; do not merge main or deploy production. Manual VPS update instructions are required.
