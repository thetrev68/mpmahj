# Single TODO List (Code-Verified)

Last updated: 2026-02-21
Source of truth for status: executable checks + code inspection (not legacy markdown plans).

## Current Health

- Backend: `cargo check --workspace` passes.
- Backend tests/docs: `cargo test --workspace --no-fail-fast` passes.
- Frontend build/type-check: `npm run build` passes.
- Frontend tests: `npm run test:run` passes.

## P1 - NMJL Alignment Gaps

- [ ] Add NMJL card-year data support for 2021-2024 or explicitly constrain supported years in product UX.
  - Current code supports: 2017, 2018, 2019, 2020, 2025.
  - File: `crates/mahjong_server/src/resources.rs:73`
  - **deferred** until data available or trevor feels like gathering it.

## P2 - Product/Infra Debt (Not Blocking Core Playability)

- [ ] Integrate sound side effects or remove placeholder path.
  - File: `apps/client/src/lib/game-events/sideEffectManager.ts:90`

## P2 - Refactor Candidates (Context Reduction + Maintainability)

- [ ] Split `PlayingPhase` into smaller feature-focused units.
  - File: `apps/client/src/components/game/phases/PlayingPhase.tsx:142`
  - Why: single large orchestrator with mixed concerns (event bus, local phase state, command wiring, rendering).
  - Suggested slices: `playing-phase/eventHandlers`, `playing-phase/actions`, `playing-phase/overlays`, `playing-phase/presentation`.

- [ ] Continue reducing orchestration load in `GameBoard`.
  - File: `apps/client/src/components/game/GameBoard.tsx:166`
  - Why: `useGameBoardOverlays` + `useGameBoardBridge` are extracted, but `GameBoard` still carries many UI states and render branching.
  - Suggested next slice: `GameBoardLayout` (presentation split), then move remaining phase-specific view decisions behind smaller adapters.

- [ ] Continue decomposing `useGameSocket` into transport + protocol modules.
  - File: `apps/client/src/hooks/useGameSocket.ts:155`
  - Why: `gameSocketSession`, `gameSocketRecovery`, and `gameSocketEnvelopes` exist, but the main hook still owns lifecycle, heartbeat, retry/backoff, queueing, and dispatch orchestration.
  - Suggested slices: `gameSocketTransport` + `gameSocketProtocol` while keeping the hook as the React-facing facade.

- [ ] Extract complex `pass_tiles` subflows in Charleston handler.
  - File: `crates/mahjong_core/src/table/handlers/charleston.rs:260`
  - Why: concentrated coordination logic (blind pass, IOU, stage advancement) is harder to reason about and test.
  - Suggested slices: helper functions for blind-pass resolution, IOU detection/resolution, and stage transition checks.

- [ ] Optional: split protocol message definitions only if navigation pain remains after higher-priority refactors.
  - File: `crates/mahjong_server/src/network/messages.rs:36`
  - Why: large file but relatively cohesive; mostly schema and constructors.

- [ ] Optional: move scoring tests out of the implementation file.
  - File: `crates/mahjong_core/src/scoring.rs:440`
  - Why: production logic is cohesive; file length is inflated by inline tests.

- [ ] Optional: split replay reconstruction integration test into scenario files.
  - File: `crates/mahjong_server/tests/replay_reconstruction.rs:78`
  - Why: test readability/runtime management, lower ROI than production-module refactors.

## Operating Rule (To Avoid Plan Drift)

- Only this file tracks "what next".
- Item state changes must be justified by:
  - passing command output, or
  - code diff + test that proves completion.
- Legacy planning markdown is non-authoritative until explicitly reconciled.

---

## Claude Plugins

**code-simplifier** -- Identifies overly complex code and suggests simplifications. Measures cyclomatic complexity and flags functions that are doing too much.

**typescript-lsp** -- Adds TypeScript language server integration. Claude gets real type checking, go-to-definition, and error diagnostics instead of guessing. If you write TypeScript this is probably the single most impactful plugin.

---

## Frontend Simplification Report

### Minor Items

- `SoundEffect` union type in `useSoundEffects.ts:29` is narrower than actual usage — several sound strings passed from PlayingPhase silently don't match
