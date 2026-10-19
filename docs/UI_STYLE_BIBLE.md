# Official Arcade UI Style Bible v2

陪公子練武 / BIG TALK, REAL FIGHT. Japanese anime fighting × modern arcade × console UI. Every screen has one dominant visual and one primary action. Characters and real gameplay take priority over decorative panels. Reference established fighting-game composition principles without copying proprietary art, brands or unique interfaces.

## Tokens and typography

`public/design-system.css` owns the shared CSS properties. UI-only tint variations are allowed; do not duplicate competing palettes in new components.

| Token | Value | Meaning |
|---|---|---|
| `--bg-primary` | `#101522` | Main scene |
| `--bg-secondary` | `#192234` | Secondary scene |
| `--surface-primary` | `#222D42` | Supporting controls |
| `--cyan-primary` | `#00D5E8` | P1 and current focus |
| `--pink-primary` | `#FF3569` | P2 and versus |
| `--gold-primary` | `#FFC247` | Confirmation, winner, special events |
| `--text-primary` | `#F5F7FA` | Main text |
| `--text-secondary` | `#AAB7CD` | Supporting text |
| `--danger` | `#FF4545` | Danger |
| `--success` | `#35D7A1` | Ready and success |

Use approximately 70% dark base, 20% official art and 10% accent. State must also have text, shape or an icon. A ready state is never just a green border.

The existing locally bundled, licensed **Barlow Condensed Black Italic** (`Arcade Display`) supplies Latin display typography; no new external font download is required. Chinese uses the existing Noto Sans TC/system fallback. `--font-display`, `--font-body` and `--font-data` centralize font choices. Large display text can use 48–112px; Chinese headings typically 24–40px, body 12–16px and supporting labels 9–12px depending on viewport. Do not shrink essential actions to fit dense desktop layouts.

Spacing uses `--space-*`; motion uses `--motion-*` and `--ease-out`; controls use `--radius-control`, `--line-subtle` and `--shadow-cut`. HUD, scene and modal layer names are defined centrally. Use a small number of purposeful angled cuts, halftone fields and speed lines. Avoid universal neon glow, glass blur, repetitive card shadows and a border around every paragraph.

## Scene navigation and input

Main Menu → Character Select → Mission/Stage/Room → VS → real battle → real result. Each mode follows its existing valid path. Quick/ranked use server matchmaking and asset-ready confirmation, rather than a local start callback.

No permanent website navbar or tab bar. The contextual scene header shows current mode/step, Back, Main Menu and a small Settings action. During combat only compact menu/fullscreen controls remain. Escape follows the existing flow back, then closes the menu; it must not silently leave a multiplayer room. Any attempt to change modes while a room/queue is occupied must respect the existing busy guard.

Arrow keys/WASD move menu choices, Enter/Space confirms, Escape returns. Text inputs and IME composition take priority over game shortcuts. Keep a visible keyboard focus ring and native dialog focus containment. Inputs appear only for actual text data. Mouse, touch and keyboard are supported; gamepad navigation is **not implemented** by this release.

## Main Menu

Mode list on the left; Gambler/Azhi official fullbody art and game title on the right. The selected main mode owns the gold focus panel; other modes are quiet. Arcade, Training, Custom, Quick and Ranked are the primary list; Team/Spectator, Profile, Settings and move guide are supporting entries. Selecting does not automatically launch combat. The confirmation button performs the action. Show capability/unavailable information when accounts or competition are not configured; never simulate login or ranked results.

The invitation stays in the navigation heading. No banner across character faces. Fight Fund and duplicated currency totals remain absent. Desktop art uses proportional contain; cropping from scene composition may not hide important facial features. Prevent horizontal auto-scroll when a focused option is resized (`overflow: clip` for the composition).

## Character Select

Large P1 and actual CPU/rival art flank the central four-character roster. Keep the stable IDs `azhi`, `sezi`, `gambler`, `winnie`. The style descriptions and stat values are read from existing frame-data. Power/speed, defensive stun coefficient and punish multiplier are actual gameplay data, not invented ratings. Lower blockstun multiplier means faster recovery; neutral multipliers are 1.00.

Cards preview a cancelable draft. Confirm commits locally or waits for the server's character acknowledgement; it does not set Ready. Rapid changes cancel previous presentation tweens. Never change moves or frame-data to match a visual bar. Preserve real skill names and U/O costs. On small screens, the rival becomes a compact lower region, while confirmation stays fixed and reachable.

Use the shared UI art registry. Fullbody is for scenes, portrait for roster, HUD for small identity. Preserve aspect ratio, alpha and same-character fallbacks. UI fullbody art must never replace battle sprite sheets.

## Battle Room

The player's fullbody anchors the left region; room/invitation details and actual opponent slots occupy the center/right. Modes are concise rule choices, not global navigation. Primary actions are Create/Join before connection, then Ready and host Start. Native room/control IDs are preserved.

Nickname, room title, join code and access settings live in an explicit focused entry dialog. Creation and joining are different operations; a mistyped explicit join never creates a room. Room code is the invitation code; show actual server roster and revision. Only the host starts when all required slots are Ready. EMPTY, CONNECTING, CONNECTED/SELECTING, READY, IN MATCH and DISCONNECTED reflect actual transport/roster state. Private rooms require accounts; spectator permission is server-owned. Unsolicited entry/spectating into auto-matched rooms is rejected.

Seat changes use brief entry feedback. Ready feedback comes only after a roster acknowledgement. No front-end-only ready state. Keep 2v2 and spectator controls and do not grant spectators player inputs, Ready or host privileges.

## Stage Select and arcade missions

The scene preview is dominant; the thumbnail strip is navigation. Stage number, title/theme and real BGM/availability accompany it. Preview switches cancel previous tweens. Practice stage choice passes through the existing encounter plan; arcade missions keep the real campaign progress and CPU definitions.

Four formal source maps now exist: `night` 嘴砲夜市, `garage` 金沙賭城, `harbor` 天安門廣場 and STAGE 04 `legislature` 立法院. Keep the square architecture/tanks and the supplied Legislature chamber. Legislature uses its own imported preview and combat derivative; its music temporarily reuses the existing original `stage_fur_lab`. `fur_lab` remains a separately planned STAGE 05, without substitute art.

Maps are single complete images. Do not claim multilayer parallax. Background-only preprocessed readability variants stay separate from character/HUD colors. Keep existing ground, spawn points and camera geometry.

## VS, Combat HUD and result

VS uses real selected fighters, actual names and the chosen stage, with cyan/pink sides, gold VS, fast speed-line composition and existing audio. Asset readiness is a real Promise/ACK, never a fake loading timer. Cancellation must not launch a hidden local match. Online VS is presentation over the authoritative intro; it cannot pause or change the online stage.

Reuse `combat-hud.js/css`: true instantaneous HP with visual damage trails, real timer/round wins, bottom energy and compact skill hints. Keep the fitted 16:9 stage and original sprite animations. Do not invent a second HP/meter model. Online KO/result/RP must wait for the authoritative rollback window and persisted server settlement. Client predictions never award points.

Combat additions use the same compact coach and receipts: →+K/→+O for Azhi, ↓+K/→+U for Gambler, H throw/tech for all. Forward is relative to the fighter. Show only legal cancel routes and actual costs/hits/HP removed; distinguish a zero-damage feint from a strike. Grabbed players see remaining simulation frames for H tech; confirmed tech uses a zero-damage receipt and existing parry sound. Hold/toss effects follow the paired roots and grappleFrame, respect reduced motion and never alter collision geometry. Re-timed key poses must not be described as newly drawn in-betweens or clean video extractions.

Results reflect actual engine outcomes. Arcade next/retry/full clear uses the existing campaign. Competition result cards use the saved settlement, including placement/RP changes and rank-up/down. No client-submitted winners, arbitrary HP or RP modification endpoints exist.

## Accounts and ranked scenes

Player identity is a competitive player card with UID, real backend statistics, official avatar presets and private history. Guest arcade/practice never requires login. Account/database configuration problems are visible, not fabricated success messages. Use username/password and one-time recovery-code screens; no Email, mail-delivery or Google widgets. Registration nickname is optional. Passwords require at least 8 characters, without forced case/digit/symbol combinations; login preserves old passwords. Read min/max rules from capabilities. Missing-service notices distinguish PostgreSQL setup from APP_ORIGIN and do not claim HTTPS is mandatory. Recovery codes are only shown in response to explicit registration/recovery/password-confirmed rotation, never exposed by profile APIs, logs or localStorage. Retain copy/manual-select/download and explicit saved-code confirmation. Public HTTP mode requires explicit operator opt-in and a visible unencrypted-connection notice.

Rank badge visuals share a shield/facet hierarchy: Bronze copper, Silver cool metal, Platinum teal, Diamond ice blue, Elite purple/gold crown. Exactly five tiers; no Gold. III → II → I for non-Elite; five placement games before an initial tier. Thresholds are centralized in `rank-rules.js`; only server transactions award RP/MMR.

Match Found is a focused fullbody-versus scene with real participants, selected fighters, ranks, deadline and accept/decline. Accepted state comes from the server. Countdown updates must not rebuild character art every tick. Leaderboards and season history come from the API, with pagination/search and explicit empty states. Do not put fake players on a leaderboard to decorate it.

## Motion and audio

Button press 100ms, focus 160ms, fighter switch 240ms, scene entry 280ms, with directional ease-out. VS uses the existing short intro and actual asset loading. No permanent floating/flashing of every element. Cancel old animations before replaying a selection tween. Clean up listeners/timers on page leave and respect `prefers-reduced-motion` throughout.

Reuse one Audio Manager, gesture unlock and saved BGM/SFX levels. Move feedback is throttled; match-found audio is keyed once per Match ID. UI rerenders never restart BGM. Room joins/Ready/confirmation reuse the same small sound family. Existing original tracks remain unchanged.

## Responsive, performance and acceptance

Inspect 1920×1080, 1600×900, 1366×768, 1280×720, smaller desktop, phone portrait and phone landscape. Recompose columns, opponent summaries and mode rows rather than scaling a screenshot. All primary touch actions retain at least 44px targets. No stretching, clipped action text, unreachable confirmation, horizontal viewport overflow or faces hidden by banners. Long supporting content may scroll within the scene; battle remains fitted 16:9.

Avoid per-frame UI tree rebuilding and full-screen blur/filter work. Reuse cached optimized role art and background derivatives. UI animations must not drive simulation. The target remains stable 60Hz logic; measured browser FPS must be reported separately and never inferred from the target rate.

Verify actual menus, four-character selection, stage plan/VS/battle/result, create/join/Ready/leave, settings/audio, keyboard/typing and reduced motion. New online features need two distinct clients plus persisted database assertions. Maintain core/rollback/sprite hashes and explicitly authorize server changes in the audit chain. Required checks: `npm run check`, `npm test`, relevant real browser tests, and a visual implement → inspect → fix → recheck cycle. Screenshots and results belong in the delivery summary; no production deployment or Git push without separate authorization.
