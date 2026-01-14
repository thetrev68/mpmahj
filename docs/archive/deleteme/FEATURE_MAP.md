# Feature Map (Verification Ledger)

This map focuses on evidence, not claims. Anything not explicitly verified is
treated as unverified or undecided.

## Status Legend

- Verified: Explicitly validated (tests run, known good)
- Unverified: Code exists and/or tests exist, but not validated
- Archive-Complete: An archive document declares it complete, not verified
- Partial: Known missing pieces or TODOs
- Decision Needed: No committed direction (e.g., scoring rules)
- Unknown: Not yet evaluated

## Sources Used (Initial Pass)

- `README.md`
- `docs/implementation/13-backend-gap-analysis.md`
- `docs/ux/BACKEND_AUDIT.md`
- `docs/archive/summaries/04-client-state-IMPLEMENTATION-SUMMARY.md`
- `docs/archive/summaries/05-persistence-IMPLEMENTATION-SUMMARY.md`
- `docs/archive/summaries/11-backend-remaining.md`
- `tree.txt` (code inventory)

## Backend Feature Map (Evidence-First)

| Feature                                       | Status           | Evidence       | Notes                                                                                                                             |
| --------------------------------------------- | ---------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Core rules engine (tiles, hands, melds, flow) | Unverified       | Code + tests   | `crates/mahjong_core/src/flow.rs`, `crates/mahjong_core/src/table/mod.rs`, `crates/mahjong_core/tests/turn_flow.rs`               |
| Card data + unified card schema               | Unverified       | Code + tests   | `crates/mahjong_core/src/rules/card.rs`, `data/cards/`, `crates/mahjong_core/tests/unified_card_integration.rs`                   |
| Win validation (pattern rules)                | Unverified       | Code + tests   | `crates/mahjong_core/src/rules/validator.rs`, `crates/mahjong_core/tests/scoring_integration.rs`                                  |
| Scoring ruleset (what rules to apply)         | Decision Needed  | None           | Decide target ruleset before finalizing scoring behavior                                                                          |
| Scoring engine (implementation)               | Unverified       | Code + tests   | `crates/mahjong_core/src/scoring.rs`, `crates/mahjong_core/tests/scoring_integration.rs`                                          |
| Charleston flow                               | Unverified       | Code + tests   | `crates/mahjong_core/src/table/handlers/charleston.rs`, `crates/mahjong_core/tests/charleston_flow.rs`                            |
| Calls and turn priority                       | Unverified       | Code + tests   | `crates/mahjong_core/src/call_resolution.rs`, `crates/mahjong_core/tests/call_priority.rs`                                        |
| History + replay (core + server)              | Unverified       | Code + tests   | `crates/mahjong_core/src/history.rs`, `crates/mahjong_core/src/table/replay.rs`, `crates/mahjong_server/src/replay.rs`            |
| AI (basic bot + MCTS)                         | Unverified       | Code + tests   | `crates/mahjong_ai/src/`, `crates/mahjong_core/src/bot/`, `crates/mahjong_core/tests/bot_basic.rs`                                |
| Hint system / pattern analysis                | Partial          | Code + tests   | `crates/mahjong_core/src/hint.rs`, `crates/mahjong_server/src/analysis/`, `crates/mahjong_server/tests/hint_composer_pipeline.rs` |
| Networking + WebSocket protocol               | Unverified       | Code + tests   | `crates/mahjong_server/src/network/`, `crates/mahjong_server/tests/networking_integration.rs`                                     |
| Rooms + sessions + auth                       | Unverified       | Code + tests   | `crates/mahjong_server/src/network/room.rs`, `crates/mahjong_server/src/network/session.rs`, `crates/mahjong_server/src/auth.rs`  |
| Persistence (Postgres + events)               | Archive-Complete | Summary + code | `docs/archive/summaries/05-persistence-IMPLEMENTATION-SUMMARY.md`, `crates/mahjong_server/src/db.rs`                              |
| Rate limiting / heartbeat                     | Unverified       | Code + tests   | `crates/mahjong_server/src/network/rate_limit.rs`, `crates/mahjong_server/tests/network_rate_limits.rs`                           |
| Terminal client (debug)                       | Unverified       | Code only      | `crates/mahjong_terminal/src/`                                                                                                    |

## Archive Implementations (Declared Complete)

| Archived Summary                                                   | Scope                                      | Evidence                                                                                                      | Status           |
| ------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------- |
| `docs/archive/summaries/04-client-state-IMPLEMENTATION-SUMMARY.md` | Frontend state, hooks, utilities, UI shell | `apps/client/src/`                                                                                            | Archive-Complete |
| `docs/archive/summaries/05-persistence-IMPLEMENTATION-SUMMARY.md`  | Persistence + replay (server)              | `crates/mahjong_server/src/db.rs`, `crates/mahjong_server/src/replay.rs`, `crates/mahjong_server/migrations/` | Archive-Complete |
| `docs/archive/summaries/11-backend-remaining.md`                   | Backend gaps reviewed and marked Done      | Code + doc references                                                                                         | Archive-Complete |

## Archive Plans (Claimed Executed)

These plans are stored under `docs/archive/plans/` and marked as executed per
archive policy. Each one should be treated as a claim until verified.

- `docs/archive/plans/04-client-state-plan.md`
- `docs/archive/plans/05-persistence-plan.md`
- `docs/archive/plans/06-testing-plan.md`
- `docs/archive/plans/09-deployment-plan.md`
- `docs/archive/plans/14-always-on-analyst-integration.md`
- `docs/archive/plans/14-always-on-analyst-phase4-implementation-plan.md`
- `docs/archive/plans/14-pattern-viability-implementation.md`
- `docs/archive/plans/15-hint-system-revised-overview.md`
- `docs/archive/plans/15a-hint-data-structures.md`
- `docs/archive/plans/15b-hint-service.md`
- `docs/archive/plans/15c-event-command-integration.md`
- `docs/archive/plans/15d-server-integration-settings.md`
- `docs/archive/plans/15e-testing-strategy.md`
- `docs/archive/plans/16-history-viewer-implementation-plan.md`
- `docs/archive/plans/2026-01-03-performance-results.md`
- `docs/archive/plans/2026-01-03-unified-card-refactor.md`
- `docs/archive/plans/ai-comparison-log-plan-CORRECTED.md`
- `docs/archive/plans/ai-comparison-refactor-impact.md`
- `docs/archive/plans/implementation-plan-best-practices.md`
- `docs/archive/plans/NEXT-SESSION-PROMPT.md`
- `docs/archive/plans/phase-0-3-ruleset-metadata-plan.md`
- `docs/archive/plans/phase-0-4-joker-restrictions-plan.md`
- `docs/archive/plans/phase-0-5-courtesy-pass-plan.md`
- `docs/archive/plans/phase-0-6-session-1-prompt.md`
- `docs/archive/plans/phase-0-6-timer-behavior-plan.md`
- `docs/archive/plans/phase-0-7-deterministic-replay-plan.md`
- `docs/archive/plans/phase-0-wbs.md`
- `docs/archive/plans/room-refactor-plan.md`
- `docs/archive/plans/room-refactor-plan2.md`
- `docs/archive/plans/table-refactor-plan.md`

## Frontend (Deferred)

Frontend is intentionally out of scope for this pass. Use the archived
frontend summary and plans as claims only, not verification.

## Gaps / To Verify Next (Backend)

- Confirm scoring ruleset decision and document it before verifying scoring.
- Validate archive-claimed completions with targeted tests or code review.
- Identify any backend features present in code but not captured in archive docs.
