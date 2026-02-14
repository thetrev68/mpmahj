# Single TODO List (Code-Verified)

Last updated: 2026-02-14
Source of truth for status: executable checks + code inspection (not legacy markdown plans).

## Current Health

- Backend: `cargo check --workspace` passes.
- Backend tests/docs: `cargo test --workspace --no-fail-fast` passes.
- Frontend build/type-check: `npm run build` passes.
- Frontend tests: `npm run test:run` passes.

## Frontend User Story Audit Matrix (Code-Verified, 2026-02-14)

Legend: `Done` = code + tests present, `Partial` = mostly implemented with a known gap, `Gap` = missing core frontend implementation, `Deferred` = intentionally unsupported, `N/A` = explicitly "do not implement".

| Story | Status | Evidence (code/tests) | Action |
| --- | --- | --- | --- |
| US-007 Courtesy Pass Negotiation | Partial | `apps/client/src/components/game/phases/charleston-courtesy-pass.integration.test.tsx`, `apps/client/src/components/game/phases/CharlestonPhase.tsx:561` | Resolve deferred animation TODO or explicitly de-scope it |
| US-016 Upgrading Meld | Gap | Backend supports `AddToExposure`/`MeldUpgraded` (`crates/mahjong_core/tests/phase2_meld_validation.rs`), no corresponding frontend flow found in `apps/client/src` | Implement frontend upgrade flow |
| US-017 Wall Closure Rule | N/A | Story explicitly marked DO NOT IMPLEMENT in `docs/implementation/frontend/user-stories/US-017-wall-closure-rule.md` | Keep out of scope unless product direction changes |
| US-018 Mahjong (Self-Draw) | Partial | `apps/client/src/features/game/MahjongSelfDraw.integration.test.tsx`, open gap at `apps/client/src/components/game/MahjongConfirmationDialog.tsx:85` | Complete AC-2 preview/score UI or remove AC expectation |
| US-029 Create Room | Partial | `apps/client/src/features/room/CreateRoom.integration.test.tsx`, pending retry behavior note at `apps/client/src/features/room/CreateRoom.integration.test.tsx:403` | Implement/retire retry TODO |
| US-033 Abandon Game (Consensus) | Deferred | `docs/implementation/frontend/user-stories/US-033-abandon-game-voting.md` explicitly deferred (unsupported backend flow) | Keep deferred or define backend+frontend scope |

## P0 - Completed (2026-02-14)

- [x] Fix frontend text-encoding corruption causing test failures.
  - Evidence: mojibake characters in UI text and symbols.
  - Resolution:
    - Repaired corrupted strings in affected frontend components.
    - Added regression guard script: `scripts/check-mojibake.js`.
    - Wired guard into `.husky/pre-commit` and `npm run check:all`.

- [x] Make frontend test suite green (`npm run test:run`) before broader user testing.

## P1 - NMJL Alignment Gaps

- [ ] Add NMJL card-year data support for 2021-2024 or explicitly constrain supported years in product UX.
  - Current code supports: 2017, 2018, 2019, 2020, 2025.
  - File: `crates/mahjong_server/src/resources.rs:73`

- [ ] Implement Mahjong confirmation AC-2 UI (show likely pattern + score pre-submit) or remove AC expectation.
  - File: `apps/client/src/components/game/MahjongConfirmationDialog.tsx:85`

- [ ] Implement US-016 frontend flow for meld upgrades (`AddToExposure` command + `MeldUpgraded` handling + UI affordance).
  - Gap identified by code audit; backend primitives exist.
  - Candidate files: `apps/client/src/components/game/phases/PlayingPhase.tsx`, `apps/client/src/components/game/ExposedMeldsArea.tsx`

- [ ] Resolve US-007 deferred animation TODO (courtesy pass exchange animation) or explicitly de-scope in acceptance criteria.
  - File: `apps/client/src/components/game/phases/CharlestonPhase.tsx:561`

## P2 - Product/Infra Debt (Not Blocking Core Playability)

- [ ] Decide and implement history cap enforcement, then un-ignore stress test.
  - File: `crates/mahjong_server/tests/history_stress_tests.rs:478`

- [ ] Complete player stats/dashboard tracking scope (currently marked TODO scaffolding).
  - File: `crates/mahjong_server/src/stats.rs:100`

- [ ] Implement/retire CreateRoom retry behavior TODO.
  - File: `apps/client/src/features/room/CreateRoom.integration.test.tsx:403`

- [ ] Integrate sound side effects or remove placeholder path.
  - File: `apps/client/src/lib/game-events/sideEffectManager.ts:90`

- [ ] Decide lifecycle for legacy frontend user stories: archive all `Done` rows from the matrix, keep only `Partial`/`Gap`/`Deferred` stories active.
  - Source path: `docs/implementation/frontend/user-stories/`

- [ ] Mockup alignment: add opponent rack UI (identity + tile count + concealed backs) for East/West/North.
  - Candidate files: `apps/client/src/components/game/phases/PlayingPhase.tsx`, `apps/client/src/components/game/ConcealedHand.tsx`

- [ ] Mockup alignment: add persistent seat-orientation HUD (wind compass / seat map) instead of only active-seat indicator.
  - Candidate files: `apps/client/src/components/game/TurnIndicator.tsx`, `apps/client/src/components/game/phases/PlayingPhase.tsx`

- [ ] Mockup alignment: refine discard floor visuals (translucent floor + less rigid placement treatment).
  - File: `apps/client/src/components/game/DiscardPool.tsx`

- [ ] Mockup alignment: support opponent-facing concealed tile orientation where relevant.
  - Candidate files: `apps/client/src/components/game/Tile.tsx`, `apps/client/src/components/game/phases/PlayingPhase.tsx`

## Operating Rule (To Avoid Plan Drift)

- Only this file tracks "what next".
- Item state changes must be justified by:
  - passing command output, or
  - code diff + test that proves completion.
- Legacy planning markdown is non-authoritative until explicitly reconciled.
