# Single TODO List (Code-Verified)

Last updated: 2026-02-15
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
