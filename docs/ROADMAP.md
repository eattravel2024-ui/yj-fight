# Roadmap — GitHub / Codex

## P0 — reliability and safety
- [x] 8.9: 1v1 and 2v2 Ready + explicit host start; membership/character changes invalidate readiness. Role/revision/start/rematch regression tests.
- [x] 8.14.0 authenticated 1v1 rotating reconnect token, 30-second paused reservation and authoritative recovery; 2v2 recovery remains future work.
- Room access controls: private room/invite code, spectator permissions, rate limiting and validation.
- Serve HTTPS/WSS for public deployment; validate WebSocket Origin; monitor CPU, memory and excessive room creation.
- Two-device/4-device end-to-end tests with latency, jitter and disconnect injection. Do not mark complete without real network evidence.

## P1 — user experience and core mechanics
- [x] 8.11.3: unobstructed home artwork, five main entries and unified Custom Match with explicit create/join, real seat/Ready data and strict missing-room errors. All modern modes retained.
- [x] 8.14.0 player IDs/accounts, real quick/ranked queues and persistent server-only settlement. Follow-up: operational monitoring, moderation, regional/load tests.
- [x] 8.9.5: shared full-window shell and in-game lobby/selection/rooms/settings/guide in both 1v1 and 2v2/spectator clients; preserves named rooms, invitations, Ready and rematch. Follow-up: public room discovery, reconnect and private-room permissions.
- Mac keyboard focus and mobile virtual controls customization; accessible touch areas.
- [x] 8.9.7: live cancel/energy hints and actual skill hit receipts; supers verified in both rulesets. Continue tutorials for anti-air and team mechanics.
- 8.9: same-frame contact trades and combo damage scaling implemented in both rulesets with rollback replay tests. Next: balance the four characters with matchup simulations, real matches and aggregate telemetry (opt-in where appropriate).

## Arcade 2.0 — staged upgrade
- Phase 0 inventory: completed against 8.9.9; see local audit report.
- [x] Phase 1 (8.10.0): manga main menu, shared visual tokens, formal client adapters, UI navigation and strict save validation. Preserve all existing modes and Fight Fund removal.
- [x] Phase 1.5 character UI art (8.10.1): 12 supplied originals preserved, optimized role assets, central UI registry and safe fallback; no battle sprite substitution.
- [x] Phase 1.5 scene art (8.10.2): three originals, optimized backgrounds/previews and metadata prepared; battle stages unchanged. Night-market source alpha preserved for Phase 3 review.
- [x] 8.10.3 user-requested follow-up: 陪公子練武 branding, fixed Gambler/Azhi home art, and three supplied live backgrounds using existing simulation IDs; no stage selector or geometry changes.
- [x] Phase 2 (8.11.0): independent player/roster/rival Character Select with real skills/stats, consistent art, cancelable drafts, explicit confirmation, server acknowledgement and keyboard/touch support.
- [x] 8.11.1 user-requested audio: 21 original OST tracks, shared manager, independent levels, gesture unlock, real battle events and future scene hooks. Fourth stage music is ready; fourth map is not implemented.
- [x] 8.11.2 separately requested combat readability/HUD: background-only variants, in-scene HP/timer/energy, real announcer events and classic 6.8 retirement. No stage selector or combat-rule change.
- [x] Phase 3 (8.12.0, expanded user scope): central stage/mission data, progress migration, arcade missions/practice stage selection, resource-ready VS, real results/retry/next/full clear. Online stages remain server-assigned; host-selectable stage settings remain future work.
- [x] Phase 4 combat scope (8.13.0, user-authorized Git checkpoint): shared 10F input buffer and move-specific impact timing, four role profiles, Sezi just guard/riposte, Gambler punishes, HUD/SFX feedback and deterministic 1v1/2v2 tests. VS/results/next/retry reuse Phase 3.
- [ ] STAGE 04 Legislature: registry/import/selection/finale/VS/server wiring prepared, but original PNG is missing from workspace. Disabled until supplied art is imported and actual four-map visuals are checked; no substitute. See PHASE4_COMBAT_8.13.0.md.
- [x] Phase 5 implementation (8.14.0): PostgreSQL migrations, email accounts/sessions, optional Google adapter, profiles/history, real quick match, private-room access controls, authoritative 1v1 networking/reconnect and durable results. Production SMTP/Google/HTTPS configuration and off-host network testing remain operator steps.
- [x] Phase 6 implementation (8.14.0): server-only RP/Elo updates, five placements, Bronze/Silver/Platinum/Diamond/Elite with no Gold, idempotent transactions, paginated leaderboard, season history and soft-reset CLI. Season 01 stays draft until explicit dates are configured.
- [x] UI v2 implementation (8.14.0): central tokens/style bible, scene navigation, focused main menu, fullbody character/Match Found views, modal custom-room forms, stage thumbnails and unified presentation. See UI_STYLE_BIBLE.md.
- [ ] Follow-up: gamepad navigation, cross-region latency/load measurements, 2v2 reconnect, production SMTP/OAuth smoke checks and moderation/account self-service export/deletion.
- Stop after each phase for user review; do not silently start the next phase.

## P2 — polish and growth
- 8.9: phase-based skill keyframes, state-based jump/dash/hurt and hitstop holds implemented with existing atlases. Next: hand-drawn in-between/contact frames and animation review; licensed art audit and UI performance budgets.
- 8.9.2: Azhi has 21 transparent video-referenced key poses and reproducible atlas packing. Next: add transition drawings between key poses and review animation in real matches.
- 8.9.3: Gambler also has 21 transparent video-referenced key poses; shared packing preserves both imported fighters.
- 8.9.4: user-provided arcade UI integrated with real HP, energy, damage trails and round wins; preserves viewport fit and accessible reduced motion.
- 8.9.5: animated in-game panels, fixed selection confirmation, keyboard focus/Escape, local menu pause, neutral online menu input and automatic room navigation after disconnect. Native fullscreen is optional; responsive viewport fit works without it.
- 8.9.6: mode/fighter selection combined in the lobby, uniform photo crops and card states, one fixed primary action and no Fight Fund panel.
- 8.9.7: compact live combat coach, authoritative online damage receipts and reduced 320ms super cut-ins; fixes low-damage super roulette and continuous multi-hit guard.
- 8.9.8: Winnie uses 21 image-referenced transparent key poses and a reproducible 17×10 atlas, with charge/raised-hand release and shared 384×300 frame support. Next: more transition/contact drawings.
- 8.9.9: Sezi uses 21 wool-ball poses with a photographic head reference, held crouch and blue vortex ribbons. All four fighters now use 384×300 cells; combat rules remain unchanged. Next: more transition/contact drawings.
- Private local stats, achievements, match replay export with privacy safeguards.
- Spectator camera/timeline and safe anonymized display names.
- Gamepad support, captions for effects, reduced motion and low-end device mode.

Each feature should include a test plan and a deployment impact section in its PR.
