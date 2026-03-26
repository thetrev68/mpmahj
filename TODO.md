# Single TODO List (Code-Verified)

Last updated: 2026-03-26
Source of truth for status: executable checks + code inspection (not legacy markdown plans).

Relevance review on 2026-03-26:

- All current backlog items below are still relevant.
- No completed UI-audit remediation work remains on this list.
- Older placeholder follow-up around rack auto-sort / board sound-settings chrome is no longer a TODO item here; that work was superseded by completed stories.

## Current Health

- Backend: `cargo check --workspace` passes.
- Backend tests/docs: `cargo test --workspace --no-fail-fast` passes.
- Frontend type-check: `tsc --noEmit` passes.
- Frontend build: `npm run build` passes.
- Frontend tests: `npm run test:run` passes (123 files, 1434 tests).

Note: `npm run check:all` does not run the production build (`vite build`). Run
`npm run build --workspace=client` separately to verify the production bundle.

## P2 - Product/Infra Debt (Not Blocking Core Playability)

- [ ] Fix server to expose Charleston Mahjong availability with phase-boundary rules.
  - Context: Declaring Mahjong during Charleston is not globally available at all times. The
    important rule nuance is that the Charleston cannot be interrupted mid-pass. East may declare
    an Earthly Hand only after a Charleston phase completes and only if the hand is still winning
    at that boundary.
  - Clarification:
    - Heavenly Hand is the pre-Charleston case and is already handled before Charleston begins.
    - Earthly Hand is the Charleston case for East after receiving tiles.
    - If East receives winning tiles during an in-progress Charleston pass, East must still finish
      that pass. The Charleston cannot be stopped mid-phase to declare Mahjong.
    - Availability should therefore be tied to legal Charleston phase boundaries, not exposed as a
      blanket "true during Charleston when hand wins" flag.
  - Current gap: the server still treats `DeclareMahjong` as a Playing-only validation path, and
    the frontend Charleston Mahjong affordance derives enablement locally instead of from a
    server-authoritative Charleston capability signal.
  - Likely files:
    - `crates/mahjong_core/src/table/validation.rs`
    - any snapshot/player-view code that exposes Charleston-phase Mahjong capability to the client

- [ ] Implement courtesy pass tile exchange animations (`US-007`) with server-timed sequencing.
  - File: `apps/client/src/components/game/phases/CharlestonPhase.tsx` (pass animation layer)
  - Context: intentionally deferred; moved from inline code TODO to centralized backlog tracking.

- [ ] Wire staged-strip call commit integration (`VR-010`) after call flow migration.
  - File: `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` (`onCommitCall`)
  - Current state: `StagingStrip` still receives `onCommitCall={() => {}}` and `canCommitCall={false}`,
    so the staged-strip call-commit path remains inert.
  - Context: intentionally deferred; moved from inline code TODO to centralized backlog tracking.

- [ ] Implement full IOU chain resolution for all-blind-pass deadlock.
  - File: `crates/mahjong_core/src/table/handlers/charleston.rs` (`resolve_iou_and_complete_charleston`)
  - File: `crates/mahjong_core/src/flow/charleston/state.rs` (`player_with_max_iou_debt`, `has_iou_debts`)
  - Current behavior: server still collapses the IOU path into immediate `CharlestonComplete`.
    Scaffolding for debt tracking exists but is not used for an actual settlement chain.
  - Rules require: player with most tiles passes 1–2 first, declares "I.O.U.", chain proceeds, first
    passer settles debts at end. Only cease immediately if _no one_ has any tiles to pass.
  - Edge case: requires all 4 players to want a full blind pass simultaneously.

- [ ] Replace beep-tone sound placeholders with real audio files.
  - File: `apps/client/src/hooks/useSoundEffects.ts` (line 128 — "For now, use a simple beep tone")
  - `SoundEffect` type (line 29) defines 7 variants but event handlers dispatch at least 5 others:
    `'game-draw'`, `'mahjong-win'`, `'dead-hand-penalty'`, `'tile-place'`, `'undo-whoosh'`.
    These still flow through `eventSideEffects.ts` via `effect.sound as SoundEffect`, so unsupported
    names bypass type safety and fall back inconsistently.
  - Fix requires: add real audio files to `/public/sounds/`, expand `SoundEffect` type, update
    the frequency map (or switch to `<audio>` element loading).

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
