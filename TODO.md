# Single TODO List (Code-Verified)

Last updated: 2026-03-06
Source of truth for status: executable checks + code inspection (not legacy markdown plans).

## Current Health

- Backend: `cargo check --workspace` passes.
- Backend tests/docs: `cargo test --workspace --no-fail-fast` passes.
- Frontend type-check: `tsc --noEmit` passes.
- Frontend build: `npm run build` passes.
- Frontend tests: `npm run test:run` passes (123 files, 1434 tests).

Note: `npm run check:all` does not run the production build (`vite build`). Run
`npm run build --workspace=client` separately to verify the production bundle.

## P2 - Product/Infra Debt (Not Blocking Core Playability)

- [ ] Implement courtesy pass tile exchange animations (`US-007`) with server-timed sequencing.
  - File: `apps/client/src/components/game/phases/CharlestonPhase.tsx` (pass animation layer)
  - Context: intentionally deferred; moved from inline code TODO to centralized backlog tracking.

- [ ] Wire staged-strip call commit integration (`VR-010`) after call flow migration.
  - File: `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` (`onCommitCall`)
  - Context: intentionally deferred; moved from inline code TODO to centralized backlog tracking.

- [ ] Implement full IOU chain resolution for all-blind-pass deadlock.
  - File: `crates/mahjong_core/src/table/handlers/charleston.rs` (`resolve_iou_and_complete_charleston`)
  - File: `crates/mahjong_core/src/flow/charleston/state.rs` (`player_with_max_iou_debt`, `has_iou_debts`)
  - Current behavior: server collapses both IOU cases (players have tiles / no tiles) into immediate
    `CharlestonComplete`. Scaffolding for debt tracking exists but is never used.
  - Rules require: player with most tiles passes 1–2 first, declares "I.O.U.", chain proceeds, first
    passer settles debts at end. Only cease immediately if _no one_ has any tiles to pass.
  - Edge case: requires all 4 players to want a full blind pass simultaneously.

- [ ] Replace beep-tone sound placeholders with real audio files.
  - File: `apps/client/src/hooks/useSoundEffects.ts` (line 128 — "For now, use a simple beep tone")
  - `SoundEffect` type (line 29) defines 7 variants but event handlers dispatch at least 5 others:
    `'game-draw'`, `'mahjong-win'`, `'dead-hand-penalty'`, `'tile-place'`, `'undo-whoosh'`.
    These fall through silently because `playSound` receives `sound: string` at the call site.
  - Fix requires: add real audio files to `/public/sounds/`, expand `SoundEffect` type, update
    the frequency map (or switch to `<audio>` element loading).

- [ ] Wire up sort toggle for player hand.
  - File: `apps/client/src/components/game/ActionBar.tsx` (line 70 — `onSort?: () => void` prop exists)
  - File: `apps/client/src/components/game/phases/PlayingPhase.tsx` (`onSort` never passed to ActionBar)
  - The UI button renders when `onSort` is provided; it is never provided. Needs a sort handler
    in PlayingPhase that reorders `concealed` tiles by tile index.

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
