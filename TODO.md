# Single TODO List (Code-Verified)

Last updated: 2026-02-14
Source of truth for status: executable checks + code inspection (not legacy markdown plans).

## Current Health

- Backend: `cargo check --workspace` passes.
- Backend tests/docs: `cargo test --workspace --no-fail-fast` passes.
- Frontend build/type-check: `npm run build` passes.
- Frontend tests: `npm run test:run` fails.

## P0 - Must Fix First

- [ ] Fix frontend text-encoding corruption causing test failures.
  - Evidence: mojibake characters in UI text and symbols.
  - Files:
    - `apps/client/src/components/game/CharlestonTracker.tsx`
    - `apps/client/src/components/game/VotingPanel.tsx`
    - `apps/client/src/components/game/CallResolutionOverlay.tsx`
    - `apps/client/src/components/game/MahjongConfirmationDialog.tsx`
  - Failing tests include:
    - `apps/client/src/components/game/CharlestonTracker.test.tsx`
    - `apps/client/src/components/game/VotingPanel.test.tsx`
    - `apps/client/src/components/game/CallResolutionOverlay.test.tsx`
    - `apps/client/src/features/game/CharlestonVoting.integration.test.tsx`

- [ ] Make frontend test suite green (`npm run test:run`) before broader user testing.

## P1 - NMJL Alignment Gaps

- [ ] Add NMJL card-year data support for 2021-2024 or explicitly constrain supported years in product UX.
  - Current code supports: 2017, 2018, 2019, 2020, 2025.
  - File: `crates/mahjong_server/src/resources.rs:73`

- [ ] Implement Mahjong confirmation AC-2 UI (show likely pattern + score pre-submit) or remove AC expectation.
  - File: `apps/client/src/components/game/MahjongConfirmationDialog.tsx:85`

## P2 - Product/Infra Debt (Not Blocking Core Playability)

- [ ] Decide and implement history cap enforcement, then un-ignore stress test.
  - File: `crates/mahjong_server/tests/history_stress_tests.rs:478`

- [ ] Complete player stats/dashboard tracking scope (currently marked TODO scaffolding).
  - File: `crates/mahjong_server/src/stats.rs:100`

- [ ] Implement/retire CreateRoom retry behavior TODO.
  - File: `apps/client/src/features/room/CreateRoom.integration.test.tsx:403`

- [ ] Integrate sound side effects or remove placeholder path.
  - File: `apps/client/src/lib/game-events/sideEffectManager.ts:90`

## Operating Rule (To Avoid Plan Drift)

- Only this file tracks "what next".
- Item state changes must be justified by:
  - passing command output, or
  - code diff + test that proves completion.
- Legacy planning markdown is non-authoritative until explicitly reconciled.
