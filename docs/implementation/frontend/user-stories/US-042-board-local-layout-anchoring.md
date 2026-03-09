# US-042: Board-Local Layout Anchoring and Collision Elimination

## Status

- State: Proposed
- Priority: Critical
- Batch: D

## Problem

The board was made nominally square, but core gameplay elements remain viewport-anchored (`fixed`) instead of board-anchored. This causes collisions/overlap and inconsistent geometry in Charleston and Playing phases.

## Scope

- Convert core gameplay layout from viewport-fixed anchoring to board-local anchoring.
- Ensure staging strip, player zone, and opponent racks are positioned relative to the square board scene.
- Preserve global overlays/dialogs as viewport-fixed only when they are truly global.

## Acceptance Criteria

- AC-1: `PlayerZone` and `StagingStrip` are board-local (not viewport `fixed`).
- AC-2: Opponent rack anchors in Charleston and Playing presentations are board-local and visually symmetric.
- AC-3: At 1280px and 1440px desktop widths, action controls, staging strip, and rack shells do not overlap each other.
- AC-4: Right rail remains reserved and does not intrude into board content.

## Edge Cases

- EC-1: Small viewports remain usable without clipping critical controls.
- EC-2: Existing modals/dialogs/toasts continue to work as viewport overlays.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/PlayerZone.tsx`
- `apps/client/src/components/game/StagingStrip.tsx`
- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`

## Notes for Implementer

- Introduce a board-scene container (`relative`) as the single anchoring context.
- Avoid mixed coordinate systems for core table objects (do not combine viewport-fixed and board-absolute for the same layer).
- Keep only true global elements as `fixed`: full-screen dialogs, global reconnect banners, and game-end overlays.

## Test Plan

- Update unit tests to assert removal of viewport `fixed` classes from board-local components.
- Add/extend integration tests to verify no action/staging overlap in Charleston and Playing baseline states.
- Add visual regression captures for 1280x720 and 1440x900 board snapshots.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game
npx tsc --noEmit
npm run check:all
```
