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
