# US-047: Selection-Driven Calling Without Modal

## Status

- State: Proposed
- Priority: High
- Batch: Proceed Flow

## Problem

The current call flow is split into a dedicated modal with a claim-type button grid (`Pung`, `Kong`, `Quint`, `Sextet`, `Pass`). That is functional, but it breaks the intended product model where the player stages tiles and presses one dominant `Proceed` button.

## Scope

- Remove the modal call window as the primary gameplay response surface.
- Represent the opponent's discarded tile in the player's staging area during the claim opportunity.
- Allow the player to stage tiles from their rack to express a desired claim.
- Make `Proceed` infer the claim from staged tiles and current discard context.
- If no valid claim is staged, `Proceed` should skip the claim opportunity.
- Keep `Mahjong` as a separate explicit action during claim opportunities.
- Show validation messaging when the staged claim combination is invalid.

## Acceptance Criteria

- AC-1: The dedicated modal `CallWindowPanel` is no longer used for standard discard-response interaction.
- AC-2: During a claim opportunity, the discarded tile is visually represented in staging.
- AC-3: The player can move tiles from rack to staging to build a claim attempt.
- AC-4: `Proceed` with no valid staged claim sends the skip path.
- AC-5: `Proceed` with a valid staged combination sends the correct claim intent automatically.
- AC-6: Invalid staged claim combinations do not silently fail; the player receives a clear validation message after pressing `Proceed`.
- AC-7: `Proceed` is never disabled during a claim window. It is always pressable — skip, valid claim, and invalid-claim-with-feedback are all reachable via `Proceed`.
- AC-8: As the player stages tiles during a claim window, the UI provides in-progress visual feedback indicating which staged tiles form a valid or invalid claim candidate (e.g. highlighting, color cue, or inline label).

## Edge Cases

- EC-1: If multiple claim shapes are theoretically possible, the staged tiles must resolve deterministically to exactly one server intent.
- EC-2: Selection and staged claim state clears on timer expiry, claim resolution, turn change, and reconnect state refresh.
- EC-3: The player who discarded the tile cannot claim it; the UI must never offer a self-claim path.
- EC-4: `Mahjong` remains available as a separate action when a called-discard win is legal.

## Primary Files (Expected)

- `apps/client/src/components/game/CallWindowPanel.tsx`
- `apps/client/src/components/game/phases/playing-phase/usePlayingPhaseActions.ts`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx`
- `apps/client/src/components/game/StagingStrip.tsx`
- `apps/client/src/components/game/PlayerRack.tsx`
- `apps/client/src/components/game/useGameBoardBridge.ts`
- `apps/client/src/components/game/phases/playing-phase/usePlayingUIAdapters.ts`
- `apps/client/src/lib/game-logic/callIntentCalculator.ts`
- related integration tests under `apps/client/src/features/game/`

## Notes for Implementer

- The staging strip is the canonical "tiles selected for action" surface. The rack is the source of tiles, not the action confirmation area.
- The claim flow should read like:
  - no staged claim -> `Proceed` skips
  - staged valid claim -> `Proceed` claims
  - staged invalid claim -> `Proceed` shows validation message
- If the old modal remains temporarily during migration, gate it behind a transition flag and remove it before the story is considered complete.
- Reuse existing backend commands. This story is a frontend interaction rewrite, not a protocol rewrite.

## Test Plan

- Add or update integration tests for:
  - skip claim with no staged tiles
  - claim Pung/Kong/Quint/Sextet by staging the correct tiles
  - called-discard Mahjong path remains separate
  - invalid staged claim shows validation feedback after pressing `Proceed`
  - `Proceed` remains enabled throughout the claim window regardless of staged tile state
  - in-progress visual feedback appears as tiles are staged (valid vs. invalid candidate cue)
  - selection clears when the claim window ends
- Update component tests so the old call-button grid is absent from the normal flow.

---

## Codex Implementation Summary

Implemented US-047 in commit `a4042c7` (`Implement selection-driven calling without modal`).

The playing flow now uses staged rack selection for claim windows instead of the old modal path. `Proceed` infers `Pass` versus meld claim from staged tiles, Mahjong stays separate, the callable discard is shown in the staging strip, claim selections can use multi-select in the rack, and invalid claim attempts keep `Proceed` enabled but surface feedback after submission. The old `CallWindowPanel` is no longer mounted from the playing overlays. Core changes are in [PlayingPhasePresentation.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx), [usePlayingPhaseActions.ts](/c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/usePlayingPhaseActions.ts), [ActionBarPhaseActions.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/ActionBarPhaseActions.tsx), [StagingStrip.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/StagingStrip.tsx), [PlayerRack.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/PlayerRack.tsx), and [callIntentCalculator.ts](/c:/Repos/mpmahj/apps/client/src/lib/game-logic/callIntentCalculator.ts).

Coverage was updated across unit, integration, and visual recovery checks, including [CallWindow.integration.test.tsx](/c:/Repos/mpmahj/apps/client/src/features/game/CallWindow.integration.test.tsx) and the Playwright board baselines. I ran the full required pipeline: `cargo fmt --all`, `cargo check --workspace`, `cargo test --workspace`, `cargo clippy --all-targets --all-features`, `npx prettier --write .`, `npx tsc --noEmit`, `npx vitest run`, and `npm run check:all`.

---

## Claude Validation

## US-047 Completion Review

**Overall**: Complete with two minor issues worth noting.

### AC Walkthrough

| #        | Criterion                                         | Status | Evidence                                                                                                           |
| -------- | ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| **AC-1** | `CallWindowPanel` no longer used                  | ✅     | No import/render in [PlayingPhaseOverlays.tsx]; grep confirms absence                                              |
| **AC-2** | Discarded tile shown in staging                   | ✅     | `incomingClaimTile` from `activeCallWindow.tile` passed to `StagingStrip` ([PlayingPhasePresentation.tsx:156-159]) |
| **AC-3** | Rack tiles movable to staging                     | ✅     | Rack set to `mode='claim'`, `maxSelection=5`, selected tiles appear as `outgoingTiles`                             |
| **AC-4** | Proceed with no staged tiles sends Pass           | ✅     | Tested in integration test (line 70–87)                                                                            |
| **AC-5** | Proceed with valid staged tiles sends meld intent | ✅     | Tested for Pung and Kong + joker                                                                                   |
| **AC-6** | Invalid staged claim shows validation message     | ✅     | `setErrorMessage` called; tested (line 152–173)                                                                    |
| **AC-7** | Proceed never disabled during claim window        | ⚠️     | See issue #1 below                                                                                                 |
| **AC-8** | In-progress visual feedback (valid/invalid label) | ✅     | `claimCandidateState/Label/Detail` props on `StagingStrip`, tested                                                 |

### EC Walkthrough

| #        | Criterion                                               | Status | Notes                                                                                                  |
| -------- | ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| **EC-1** | Multiple claim shapes resolve deterministically         | ✅     | Joker integration test confirms                                                                        |
| **EC-2** | Selection clears on timer expiry/resolution/turn change | ⚠️     | See issue #2 below                                                                                     |
| **EC-3** | Self-claim not offered                                  | ✅     | `handleCallWindowOpened` gates on `can_call.includes(yourSeat)` ([publicEventHandlers.playing.ts:136]) |
| **EC-4** | Mahjong remains separate action                         | ✅     | Tested (line 175–189)                                                                                  |

### Issue #1 — AC-7: Proceed can be disabled by isBusy / disabled

In [ActionBarPhaseActions.tsx:379]:

`const proceedDisabled = disabled || !canAct || isBusy || !canProceedCallWindow`;
`isBusy` maps to `isProcessing`. During a claim window this should be `false` in practice (discard processing resets before `CallWindowOpened` arrives), but if it ever remains `true`, Proceed becomes disabled — violating AC-7. The spec is explicit: "It is always pressable." The call window Proceed branch should force `isBusy` to `false` or ignore it. The integration test only checks the button is enabled at open time, not after `isProcessing` gets set.

### Issue #2 — EC-2: Timer expiry does not explicitly clear selection

[usePlayingPhaseActions.ts:68-73]:

`const handleCallWindowExpire = useCallback(() => {`
`const { callWindow: cw } = useGameUIStore.getState();`
`if (!cw || cw.responded) return;`
`// Timer expiry is display-only in this flow...`
`}, []);`

The handler is effectively dead — it does nothing. Clear-on-timer-expiry relies entirely on the server eventually sending `CallWindowClosed`, which triggers `isCallWindowActive → false → clearSelection()`. This is architecturally sound but the EC-2 test only covers `CallWindowClosed` explicitly. The spec listed "timer expiry" as a distinct trigger — a test for that path (or a comment acknowledging the server-authoritative design) would make the intent clearer.

### Minor Dead Code

`callEligibility` is computed in `usePlayingPhaseActions` (line 90–120) but is never destructured in [PlayingPhase.tsx:157-168] or used anywhere. It's leftover from the old modal design and can be removed.

### Summary

The core flow is complete and correct. The two issues above are edge conditions, not broken behavior. The dead `callEligibility` export is harmless but should be cleaned up. If you want me to fix any of these, let me know.

---

## Claude post validation fixes

1. **AC-7** — [ActionBarPhaseActions.tsx:379]: Removed `isBusy` from `proceedDisabled` in the `CallWindow` branch. Proceed is now always pressable during a claim window regardless of processing state.

2. **EC-2** — [usePlayingPhaseActions.ts:58-60]: `handleCallWindowExpire` now calls `clearSelection()` instead of doing nothing. Staged tiles are eagerly cleared when the local timer fires, before the server `CallWindowClosed` arrives.

3. **Dead code** — Removed `CallEligibility` interface, the `callEligibility` useMemo, the `calculateCallIntent` import, and updated the test that asserted on the removed field.
