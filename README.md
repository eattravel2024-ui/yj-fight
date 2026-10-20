# 陪公子練武 — Spar With the Young Master

> Current release: **8.16.0 / online matchmaking & training camp**. Self-hosted Node.js + HTML Canvas 2D fighting game.

Features: 60 Hz deterministic simulation, 1v1 WebSocket rooms, 2v2 same-stage multiplayer, spectators, rollback input replay, named players/rooms, four playable characters and a single-player practice/arcade experience.

Homepage starts with **Online Match**: Quick Match keeps separate casual ratings without RP, while Ranked uses the existing season/RP rules. Quick expands its skill range faster; both keep measured latency limits and match only real players. Queue status reports same-mode search population and connection checks.

**Training Camp** combines six engine-verified lessons (movement, light hit, guard, combo, signature, throw), the existing move handbook, and Free Practice. Practice adds dummy controls, reset, hitboxes and live frame phases. Local lesson checkmarks are saved in this browser; they never affect accounts or ranked results.

## Quick start

Requirements: Node.js >= 20 (prefer 22 or 24).

```bash
npm ci --ignore-scripts
npm run check
npm test
npm start
```

Open `http://127.0.0.1:31071/` (main game) or `http://127.0.0.1:31071/team.html` (2v2 / spectator UI).

## 8.15.2 — Upload, crop and preview your own avatar

Logged-in players can choose a JPG/PNG/WebP (up to 12 MiB), drag/zoom or use arrow keys to crop, and see square/circular previews before saving. The browser makes a 256×256 WebP of at most 96 KiB; only this cropped result is uploaded. Unsupported images produce a clear error; canceling leaves the saved avatar alone. Character presets remain available.

The backend verifies the session, Origin, CSRF, request size, actual codec, dimensions and animation; it re-encodes to remove metadata and stores one normalized image per account in PostgreSQL. Public versioned same-origin URLs work in profiles and leaderboards, with a bounded fallback. Replacing an image or choosing a preset removes obsolete stored bytes. Game release swaps do not delete avatars, and the existing PostgreSQL backup includes them.

**Apply additive Migration 004 before upgrading an account-enabled VPS.** The dependency preflight now checks the native Sharp/WebP codec before stopping the old service. See [manual update and migration](docs/MANUAL_RELEASE.md) and [account deployment](docs/ONLINE_DEPLOYMENT.md). Existing passwords, accounts, records, combat art and rules are preserved.

## 8.15.1 — Register with just username and an 8-character password

No Email, SMTP, verification mail or Google account is required. Register with only a username and password; nickname is optional and can be changed later. New/reset passwords accept 8–128 characters without required mixed case, digits or symbols: eight letters, eight digits or a mixture all work. Existing passwords remain valid. Preserve Argon2id, sessions, rate limits, CSRF and one-use recovery codes.

PostgreSQL remains required to store accounts and results. A public IP/HTTP site can enable accounts with exact `APP_ORIGIN` and `ALLOW_INSECURE_HTTP=true`; HTTPS and a domain are optional. Missing setup messages now identify database versus origin instead of suggesting Email/SMTP or mandatory HTTPS. [First-time account setup and routine updates](docs/ONLINE_DEPLOYMENT.md) use the published `feat/phase4-5-grapples` branch, including all completed Phase 4.5 combat and Legislature assets. Health version must be **8.15.1**. Production deployment stays manual.

## 8.15.0 — Phase 4.5 throws, fighter additions and Legislature

All four fighters share real grounded throws and 10F H throw-tech, one-time impact damage, whiff recovery and wake-up protection in 1v1/2v2. Azhi adds forward+K rush, rising I anti-air and forward+O three-hit finisher; Gambler adds down+K feint and forward+U chip projectile while retaining his O ALL IN. Easy direction modifiers are captured at key-down, with character/energy validation in the shared authoritative core. Cancel paths cannot loop back into jabs.

The supplied Legislature original is now preserved and imported into STAGE 04 selection, previews, VS, battle, online stage rotation and the arcade finale. Four maps are playable; fur_lab is a separate planned STAGE 05. Geometry/camera remain unchanged; Legislature temporarily reuses the existing original stage_fur_lab music.

Both supplied 10-second MP4s contain scene/HUD pixels and no Alpha. They are motion references, not clean sprite exports: existing transparent key poses have been re-timed and composed for attacks, skills, hurt, victory and paired throws. Clean intermediate drawings and dedicated grab/victim angles remain needed. Source videos, hashes and the reproducible motion map are preserved.

See [actual architecture](docs/PROJECT_ARCHITECTURE.md), [character/controls and throw rules](docs/CHARACTER_SPEC.md), [UI rules](docs/UI_STYLE_BIBLE.md) and [Phase 4.5 delivery](docs/PHASE4_5_8.15.0.md). The 8.15.1 follow-up authorizes GitHub publication of this completed work; production VPS deployment stays manual.

## 8.14.1 — Player username and recovery code, without Email / domain services

Register and log in using a case-insensitive player username and password. Keep nickname/avatar, real quick/ranked matches and persistent records. Email, verification mail, password-reset mail and Google login are removed. A 192-bit one-use recovery code is shown once at registration; only its hash is stored. Recovery consumes the old code, revokes all existing sessions and shows a replacement once. Profile code rotation requires the current password and CSRF. Save the code privately: losing both it and the password prevents self-service recovery.

PostgreSQL and explicit season dates remain required. Run additive migration `003_username_recovery.sql` before enabling accounts; it preserves identities, sessions and match/rank records. Existing password accounts retain their old sign-in alias, receive a stable generated username visible in profile and can generate a recovery code after login. Legacy Google-only accounts without passwords require operator-assisted identity review.

No domain or SMTP is required. For the existing public IP/HTTP site, set the exact `APP_ORIGIN=http://YOUR_VPS_IP:18071` and explicitly opt in with `ALLOW_INSECURE_HTTP=true`. HTTP does not encrypt passwords/cookies/recovery codes; use a unique game password. HTTPS remains supported, including IP-based certificates, and automatically uses Secure cookies. See [current deployment steps](docs/ONLINE_DEPLOYMENT.md) and [8.14.1 delivery](docs/ACCOUNTS_8.14.1.md). The user authorized publishing this follow-up on `feat/arcade-phase1`; VPS deployment remains manual.

The sections below describe historical releases; their SMTP/Email requirements no longer apply. The old Phase 4 missing-Legislature-art note was resolved in 8.15.0.

## 8.14.0 — Official Arcade UI v2 and online players

Scene-based navigation, focused mode list, large opposing fighter art, modal room entry, real Ready seats, stage thumbnails and Match Found share [the official UI Style Bible](docs/UI_STYLE_BIBLE.md). All four fighters, existing moves/sprites, arcade/practice, 1v1, 2v2, spectators, HUD and original audio are retained. The Legislature original is still missing; only three maps are enabled.

Optional PostgreSQL persistence now supports Argon2id email accounts, one-use verification/reset, cookie sessions/CSRF, profiles/private history, real quick/ranked queues, authenticated 1v1 reconnect, server-validated results, five placements, five tiers (no Gold), RP/hidden Elo, paginated leaderboards and preserved seasons. Guests can still play without login. Missing database/SMTP/Google credentials are reported explicitly. Season 01 is a draft until an operator activates actual dates. There is no public result/rating edit API.

Run `npm run db:migrate` with an **isolated development** `DATABASE_URL`; production migrations, SMTP, HTTPS/WSS, backups and season activation are manual steps in [ONLINE_DEPLOYMENT.md](docs/ONLINE_DEPLOYMENT.md). Set `AZHI_TEST_DATABASE_URL` to a disposable PostgreSQL database to run real DB/network/browser integration tests; tests create separate random schemas and remove only their fixtures. Never point tests at production.

See [8.14.0 delivery, actual verification and remaining limits](docs/DELIVERY_8.14.0.md) and [manual source-package update](docs/MANUAL_RELEASE.md). Use `feat/arcade-phase1` for this release; older fixed checkpoints do not include 8.14.0. Production updates remain manual.

## 8.13.0 — Phase 4 combat tuning

Four real combat roles, a 10F input buffer, move-specific hit/block timing, Sezi just guard/riposte and Gambler recovery punishes now share contact handling in 1v1/2v2. Existing skills, sprites, HUD, audio, arcade progress and networking remain. STAGE 04 `legislature` is wired but **disabled until the supplied `立法院議場對決舞台.png` is available as a file**; only three maps are currently playable. Import it with `python3 tools/import_legislature_stage.py`, then run the documented checks. No unrelated image substitutes or automatic VPS deployment. User-authorized Git checkpoint: `checkpoint-phase4-8.13.0` on `feat/arcade-phase1`. See [Phase 4 delivery and remaining art requirement](docs/PHASE4_COMBAT_8.13.0.md).

## 8.12.0 — Phase 3 complete arcade flow

Choose a fighter, select an unlocked arcade mission or practice stage, watch VS, fight using the existing engine, then retry, continue or finish the five-mission campaign. `stage-registry.js` owns the three playable stage mappings, previews, BGM and shared geometry; the fourth fur-lab stage remains planned without borrowed art. `campaign.js` owns missions, CPU difficulty, rewards and stable progress IDs. Existing chapter saves migrate without losing currency/purchases. Results use real engine outcomes, award once per match and preserve highest progress when replaying older missions. VS preloads required battle assets, supports cancellation/retry, and reuses the Audio Manager; online VS is presentation during the existing authoritative countdown. HUD, background readability, sprites, combat and Rollback remain intact. See [Phase 3 delivery](docs/ARCADE_2_PHASE3.md) and [Git deployment](docs/MANUAL_RELEASE.md).

## 8.11.3 — Custom Match and unobstructed home artwork

The invitation subtitle sits below the mode heading, leaving Gambler and Azhi unobstructed. Five main entries lead to arcade, practice, Custom Match, settings and controls. Custom Match consolidates 1v1, 2v2 and spectating, with explicit create/join actions, real seat portraits, confirmed character changes, invitations and server-owned Ready/host start. Missing-room joins report an error without creating a room; old clients remain compatible. Combat rules are unchanged. Matchmaking and ranked play remain planned. Fixed tag: `checkpoint-custom-8.11.3`; see [delivery and next steps](docs/CUSTOM_MATCH_8.11.3.md).

## 8.11.2 — in-scene arcade combat HUD

Health/portraits/timer now overlay the fitted 16:9 stage; power meters and compact U/O hints sit along its lower edge. Real round/KO/timeout/winner announcements reuse the existing audio system and confirmed online events. Background-only WebP variants lower visual noise while preserving source art, fighter atlases, proportions and simulation. Team health nodes are reused so damage trails animate correctly. The standalone classic adventure 6.8 and its links are retired at the user's request; modern arcade, practice, multiplayer, spectating and saves remain. The user authorized GitHub publication; deploy fixed tag `checkpoint-combat-hud-8.11.2` or the source archive using [manual release instructions](docs/MANUAL_RELEASE.md). See [delivery and screenshots](docs/COMBAT_HUD_8.11.2.md).

## 8.11.1 — original OST and shared Audio Manager

All 21 supplied tracks and MIDI originals are preserved. Main menu, character selection, arcade mission waiting, practice, stage battles, final boss and results have music routing; VS, round start, KO, outcome and character entrances use deduplicated events. The settings screen has independent persistent BGM/SFX levels, master mute, retry and all-track audition. Audio uses one gesture-unlocked Web Audio graph, 300ms crossfades, bounded PCM caching and OGG/AAC fallback. The three current maps have their own music; the fourth fur-lab track and future stage-select/credits scenes are registered without inventing those maps/pages. See [OST mapping and verification](docs/AUDIO_8.11.1.md).

## 8.11.0 — Phase 2 Character Select

A dedicated manga selection screen shows your fullbody art, four portrait cards, real skills/stats and the actual CPU/online rival. Cards preview a draft; backing out leaves the confirmed selection unchanged. Explicit confirmation saves the local fighter and starts the existing mode, or waits for the server roster before returning to the online room. Ready/host-start remain separate. Keyboard, touch, reduced motion, spectator and match locks are preserved. Stats use real power, speed and air coefficients; no fictional defence or critical stats are presented as gameplay. See [Phase 2 delivery](docs/ARCADE_2_PHASE2.md).

## 8.10.3 — title, fixed home artwork and live supplied backgrounds

The game is now 陪公子練武. The main menu always features 金沙賭神 and 阿志, independently of the saved or selected fighter. `stage-art.js` maps the unchanged simulation IDs `night`, `garage`, `harbor` to 嘴砲夜市, 金沙賭城, 天安門廣場 for both game clients, including online play and spectating. Backgrounds use proportional contain, an opaque underlay for source alpha, and a bounded old-SVG fallback. Old procedural floor light bars are removed so they do not obscure the new art. Combat geometry, stage IDs, camera and save progression remain unchanged; no new stage selector is added. See [8.10.3 delivery](docs/UPGRADE_8.10.3.md).

## 8.10.1 Phase 1.5 — supplied character UI art

The user's twelve PNGs are preserved byte-for-byte under `assets/source-art/phase1_5/characters/`, with hashes/dimensions in the adjacent manifest. Optimized transparent WebP roles are fullbody 768×1024, portrait 512×512 and HUD 256×256. `character-art.js` is the single UI path registry, with same-character legacy fallback and a bounded terminal text state.

The existing main menu, character cards and health-bar portraits use these assets; selection layout, fight sprites, collision, moves, skills and stage loading are unchanged. Sezi's new humanoid UI illustration deliberately coexists with the existing wool-ball battle animation. Three supplied scenes are preserved and optimized under `public/art/stages/` with `stages-manifest.json`; they were prepared in 8.10.2 and activated in 8.10.3. Night-market source alpha is preserved and composited over an opaque underlay. Phase 2 was subsequently implemented in 8.11.0; full Phase 3 selection is not started. Rebuild derivatives with `python tools/build_character_ui_art.py` (Pillow for authoring only). See [Phase 1.5 art inventory and validation](docs/ARCADE_2_PHASE1_5.md).

## 8.10.0 Arcade 2.0 — Phase 1

The full-window main menu now uses a manga arcade identity: dedicated original character key art, slanted numbered panels, halftone/speed-line backgrounds, local licensed display typography and a clear selected state. Six entries lead to existing arcade/practice character controls, online/team rooms, settings and move guides. Enter/Space confirms; arrows/WASD select; Escape returns through the menu. Menu selection never starts combat or disconnects an occupied room.

A small `game-flow.js` coordinates UI navigation, while formal `AzhiGame` adapters keep combat and room authority in the existing clients. `save-state.js` validates the existing save before chapter/character lookup without removing valid progress, currency or purchases. Fight Fund remains absent from the main menu. This historical Phase 1 release does not include Phase 2–5 features. See [Phase 1 delivery and verification](docs/ARCADE_2_PHASE1.md).

## 8.9.9 Sezi reference-based animation

Sezi now uses 21 transparent wool-ball poses based on the user’s action sheet and photographic head reference. Realistic head expressions, headbutts, rolling attacks, crouching, guarding, a wool vortex and victory replace the old humanoid animation. Blue wind ribbons accompany “高雄發大財”, alongside its existing coins. The 17×10 atlas uses 384×300 cells, the same 292px ground anchor and unchanged render scale/combat rules. Rebuild with `python tools/build_azhi_video_atlas.py --fighter sezi`. See [Sezi animation notes](docs/SEZI_8.9.9.md).

## 8.9.8 Winnie reference-based animation

Winnie now uses 21 transparent key poses based on the user's eight-panel image: two idle poses, stepping, guarding, punches, kicking, charge and victory, with supplementary jump/dash/hurt/KO poses. The “不同意的請舉手” animation transitions from charge to a raised-hand palm release. The 17×10 atlas uses 384×300 cells and preserves fighter height, the 292px ground anchor, fixed camera and combat rules. Rebuild with `python tools/build_azhi_video_atlas.py --fighter winnie` (Pillow for authoring only). See [Winnie animation notes](docs/WINNIE_8.9.8.md).

## 8.9.7 live combo hints and visible super results

Combat now shows follow-up keys from the actual cancel tree, energy requirements, and receipts for real skill damage, blocks and misses. Online receipts use server-confirmed events. All four supers are damage-tested in 1v1 and 2v2; Azhi's super keeps jackpot chances but no longer draws a low-damage blank. Multi-hit guarding now persists through blockstun while the guard button is held. See [combat feedback notes](docs/COMBAT_FEEDBACK_8.9.7.md).

## 8.9.6 focused lobby

The lobby now puts mode selection on the left, four consistent fighter cards on the right, and one primary action in a fixed footer with the selected mode/fighter. The headline is reduced to “選擇戰鬥模式”; Fight Fund and its duplicated balance display are removed. Mode selection stays on the same screen until confirmation, and cross-page mode navigation carries the selected fighter. Mobile uses compact cards while retaining the fixed action. See [lobby refinement notes](docs/LOBBY_8.9.6.md).

## 8.9.5 full-window game and in-game menus

The arena now fills the browser viewport, with health bars, the full 16:9 stage and controls visible together. An in-game menu contains the lobby, character selection, room creation/joining, Ready, invitations, settings and move guide. Selection has a fixed confirmation button; Escape returns to the arena. Menus pause local play and release held inputs; online matches keep synchronizing with neutral input. Modal transitions respect reduced-motion preferences. All modes and existing combat/rollback rules remain available. See [full-window game notes](docs/FULL_WINDOW_8.9.5.md) and [manual VPS update](docs/MANUAL_RELEASE.md).

## 8.9.4 arcade UI integration

The user's UI reference is integrated as a local cyan/magenta arcade theme with angled dual-layer health bars, damage trails, low-health colors, round-win diamonds and energy thresholds. The HUD displays the real engine's 100 HP / 100 energy values (U 25 / O 60); all existing modes, Ready, spectator permissions and video-based character animation remain intact. No Tailwind CDN or prototype simulation is required. See [UI integration notes](docs/UI_INTEGRATION_8.9.4.md).

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

Ready and explicit host start remain available in custom 1v1/2v2. Authenticated 1v1 has rotating-token reconnect; private rooms require login and support host-owned spectator permissions. Guest/2v2 results are not ranked; seamless 2v2 reconnect remains future work.

## Project layout

| File/folder | Responsibility |
| --- | --- |
| `server.js`, `server/` | HTTP/WS, accounts, PostgreSQL, matchmaking, reconnect and authoritative settlement |
| `public/core.js` | Deterministic 60 Hz combat simulation |
| `public/team-core.js` | 2v2 four-fighter simulation |
| `public/rollback.js` | Prediction, input history and rollback |
| `public/engine/` | Frame-data, command parsing, collision and AI |
| `public/game.js`, `public/team.js` | Browser gameplay and interface |
| `public/game-shell.js`, `public/game-shell.css`, `public/arcade-menu.css` | Full-window arena, arcade main menu, shared UI tokens, focus and responsive layout |
| `public/game-flow.js`, `public/save-state.js` | UI-only navigation and strict existing-save normalization |
| `public/art/`, `public/sprites/`, `public/vfx.js` | Character art, sprite sheets and effects |
| `test/` | Node tests for gameplay and networking |
| `deploy/` | Manual Ubuntu install, update and rollback |

## Working with Codex

See [AGENTS.md](AGENTS.md), [Codex starter task](docs/CODEX_STARTER.md), and [development roadmap](docs/ROADMAP.md). Small iterations reuse the current feature branch; consolidate review and PRs at milestones. GitHub Actions runs syntax checks and tests.

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
