# Roadmap — GitHub / Codex

## P0 — reliability and safety
- [x] 8.9: 1v1 and 2v2 Ready + explicit host start; membership/character changes invalidate readiness. Role/revision/start/rematch regression tests.
- Player reconnect identity token (do NOT treat player nickname as identity); 30–60 sec reserved slot, timeout semantics and spectator-safe reconnect.
- Room access controls: private room/invite code, spectator permissions, rate limiting and validation.
- Serve HTTPS/WSS for public deployment; validate WebSocket Origin; monitor CPU, memory and excessive room creation.
- Two-device/4-device end-to-end tests with latency, jitter and disconnect injection. Do not mark complete without real network evidence.

## P1 — user experience and core mechanics
- Unified lobby: select 1v1/2v2, name room, join, role selection, spectators, ready and rematch.
- Mac keyboard focus and mobile virtual controls customization; accessible touch areas.
- Practice/tutorial: input buffering, cancel windows, hitstop, combos, anti-air and team mechanics.
- 8.9: same-frame contact trades and combo damage scaling implemented in both rulesets with rollback replay tests. Next: balance the four characters with matchup simulations, real matches and aggregate telemetry (opt-in where appropriate).

## P2 — polish and growth
- 8.9: phase-based skill keyframes, state-based jump/dash/hurt and hitstop holds implemented with existing atlases. Next: hand-drawn in-between/contact frames and animation review; licensed art audit and UI performance budgets.
- 8.9.2: Azhi has 21 transparent video-referenced key poses and reproducible atlas packing. Next: add transition drawings between key poses and review animation in real matches.
- 8.9.3: Gambler also has 21 transparent video-referenced key poses; shared packing preserves both imported fighters.
- 8.9.4: user-provided arcade UI integrated with real HP, energy, damage trails and round wins; preserves viewport fit and accessible reduced motion.
- Private local stats, achievements, match replay export with privacy safeguards.
- Spectator camera/timeline and safe anonymized display names.
- Gamepad support, captions for effects, reduced motion and low-end device mode.

Each feature should include a test plan and a deployment impact section in its PR.
