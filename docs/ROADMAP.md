# Roadmap — GitHub / Codex

## P0 — reliability and safety
- Add 1v1 and 2v2 ready state + explicit host start. Regression tests.
- Player reconnect identity token (do NOT treat player nickname as identity); 30–60 sec reserved slot, timeout semantics and spectator-safe reconnect.
- Room access controls: private room/invite code, spectator permissions, rate limiting and validation.
- Serve HTTPS/WSS for public deployment; validate WebSocket Origin; monitor CPU, memory and excessive room creation.
- Two-device/4-device end-to-end tests with latency, jitter and disconnect injection. Do not mark complete without real network evidence.

## P1 — user experience and core mechanics
- Unified lobby: select 1v1/2v2, name room, join, role selection, spectators, ready and rematch.
- Mac keyboard focus and mobile virtual controls customization; accessible touch areas.
- Practice/tutorial: input buffering, cancel windows, hitstop, combos, anti-air and team mechanics.
- Balance the five characters with reproducible combat simulations and match telemetry (aggregate, opt-in where appropriate).

## P2 — polish and growth
- Character animation review, licensed art audit, UI performance budgets.
- Private local stats, achievements, match replay export with privacy safeguards.
- Spectator camera/timeline and safe anonymized display names.
- Gamepad support, captions for effects, reduced motion and low-end device mode.

Each feature should include a test plan and a deployment impact section in its PR.
