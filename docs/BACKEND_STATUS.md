# Backend Status (3-Minute Pass)

Plain-English, feature-based status for non-developers. This is a rapid scan of
existing docs and code inventory, not a full audit.

## Confidence Legend

- High: Clear evidence in code/tests or explicit working integration
- Medium: Code exists, unclear if complete or correct
- Low: Planned/claimed only, or known gaps

## Core Gameplay

| Feature | What it does | Current status | Missing / Risks | Confidence |
| --- | --- | --- | --- | --- |
| Turn flow + phases | Runs the game loop (draw, discard, calls, win) | Implemented in core engine | Unknown if matches final ruleset in edge cases | Medium |
| Charleston | Handles all 6 Charleston stages | Implemented in core engine | Frontend integration not built | Medium |
| Calls + turn priority | Handles claim priority and resolving calls | Implemented in core engine | Needs full UI integration | Medium |
| Win validation | Checks a hand against card patterns | Implemented in core engine | Depends on final scoring ruleset choice | Medium |
| Scoring ruleset | Decides how hands are scored | Not decided | Must pick target ruleset before finalization | Low |

## History / Time Travel / Replay

| Feature | What it does | Current status | Missing / Risks | Confidence |
| --- | --- | --- | --- | --- |
| Event history (core) | Records events for replay | Implemented in core + server | Unknown completeness without front-end usage | Medium |
| Deterministic replay | Reconstructs game from events | Planned/claimed in archives | Gaps reported in past reviews; likely missing wiring | Low |
| Time travel / history viewer | Jump to any past move | Backend docs claim complete | Frontend missing; core completeness uncertain | Low |

## Persistence (Database)

| Feature | What it does | Current status | Missing / Risks | Confidence |
| --- | --- | --- | --- | --- |
| Event storage | Stores all game events | Implemented with migrations | Needs validation in real game flow | Medium |
| Final state storage | Saves end-of-game snapshot | Implemented | Snapshot accuracy unknown | Medium |
| Replay queries | Returns events for players/admins | Implemented | State reconstruction not implemented | Medium |
| Player stats | Tracks user stats | Schema present | Population/aggregation not verified | Low |

## Networking / Multiplayer

| Feature | What it does | Current status | Missing / Risks | Confidence |
| --- | --- | --- | --- | --- |
| WebSocket protocol | Client/server message transport | Implemented | Needs frontend to validate coverage | Medium |
| Rooms + sessions | Players connect, join, play | Implemented | Robustness in edge cases unverified | Medium |
| Auth / reconnect | Restores sessions | Implemented | Past notes mention missing indexing; verify | Medium |
| Rate limits / heartbeat | Stability + abuse control | Implemented | Real-world tuning unknown | Medium |

## AI / Hints / Analysis

| Feature | What it does | Current status | Missing / Risks | Confidence |
| --- | --- | --- | --- | --- |
| Basic bot + MCTS | Automated play | Implemented | Quality and correctness unverified | Medium |
| Hint system | Suggests plays | Implemented + partial | Depends on analysis wiring and UI | Low |
| Pattern analysis events | Send analysis data to client | Implemented | Frontend missing | Low |

## Known “Archive Claims” (Not Verified)

These were marked as complete in archived documents, but not re-verified:

- Client state implementation (frontend foundations)
- Persistence + replay implementation
- Backend “remaining work” marked done
- Multiple archived plans marked executed

## Immediate Takeaways (Plain English)

- The backend has *a lot* of code, but several “complete” claims are unverified.
- Scoring rules are undecided, which blocks the meaning of “win” and “score.”
- History/replay/time travel sound “done” in docs but are high-risk without end-to-end use.

## What to Do Next (If You Want a Clear Backlog)

If you want, I can turn this into a prioritized, layperson-friendly backlog with:

- “Must decide” items (ruleset, replay expectations)
- “Must verify” items (history/replay correctness)
- “Missing” items (based on actual evidence)

