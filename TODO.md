# Single TODO List (Code-Verified)

Last updated: 2026-02-21
Source of truth for status: executable checks + code inspection (not legacy markdown plans).

## Current Health

- Backend: `cargo check --workspace` passes.
- Backend tests/docs: `cargo test --workspace --no-fail-fast` passes.
- Frontend build/type-check: `npm run build` passes.
- Frontend tests: `npm run test:run` passes.

## P2 - Product/Infra Debt (Not Blocking Core Playability)

- [ ] Integrate sound side effects or remove placeholder path.
  - File: `apps/client/src/lib/game-events/sideEffectManager.ts:90`
- [ ] Add a sort toggle feature for player hand.

## P2 - Refactor Candidates (Context Reduction + Maintainability)

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
