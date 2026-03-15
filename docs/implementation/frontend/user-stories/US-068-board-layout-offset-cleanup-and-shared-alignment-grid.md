# US-068: Board Layout Offset Cleanup and Shared Alignment Grid

## Status

- State: Proposed
- Priority: High
- Batch: H
- Implementation Ready: Yes

## Problem

The board layout is still being held together with hardcoded offsets and absolute-position tuning.

Examples already visible in the current implementation:

- player-zone staging/action placement uses fixed pixel offsets
- opponent racks use hand-tuned absolute positions and percentages
- board chrome alignment depends on independent local offsets rather than a shared grid

This creates the "everything feels crooked" problem even when individual components are technically
present and functional.

## Scope

**In scope:**

- Replace fragile board-level magic offsets with a shared alignment system for the main play surface.
- Align staging, action area, rack, discard pool, and opponent rack anchors to a coherent layout.
- Reduce dependence on one-off pixel nudges that only work at a narrow set of desktop widths.
- Add tests for the repaired parent layout contract.

**Out of scope:**

- Charleston protocol or hint behavior.
- Theme-token work except where alignment wrappers need structural class changes.
- Right-rail viewport-edge occupancy and staging-slot clipping already tracked separately.

## Acceptance Criteria

- AC-1: The bottom player zone uses a deliberate shared layout contract rather than magic right/left
  offsets for staging and action placement.
- AC-2: The action area aligns predictably with the staging strip and rack across standard desktop
  widths.
- AC-3: Opponent rack anchors use a coherent board layout model rather than independent hand-tuned
  percentages that visually drift by breakpoint.
- AC-4: The discard pool, player zone, and status/control chrome visually align to the same board
  system rather than appearing independently placed.
- AC-5: The implementation removes or substantially reduces the current hardcoded pixel offsets that
  are compensating for missing layout structure.
- AC-6: Layout tests assert the repaired parent wrappers/classes so the board does not regress back
  to ad hoc offsets.

## Edge Cases

- EC-1: Standard laptop-width desktop layouts remain usable without overlap.
- EC-2: Wider desktop layouts do not expose large dead zones or detached action chrome.
- EC-3: Read-only/history mode banners still fit cleanly within the repaired layout.
- EC-4: Mobile/tablet layouts do not regress even if they use a simplified arrangement.

## Primary Files (Expected)

- `apps/client/src/components/game/PlayerZone.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`
- `apps/client/src/components/game/DiscardPool.tsx`
- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/PlayerZone.test.tsx`
- `apps/client/src/components/game/GameBoard.test.tsx`

## Notes for Implementer

### Structural rule

Do not "fix alignment" by stacking new compensating offsets on top of old ones. Replace the parent
layout assumptions first.

### Relationship to prior stories

`US-062` handles rail-edge geometry and staging-boundary clipping. This story handles the broader
board alignment system that those surfaces live inside.

## Test Plan

- Component/layout tests:
  - player-zone wrapper classes
  - action slot alignment wrappers
  - opponent anchor wrappers
- Manual verification:
  - standard laptop width
  - wide desktop
  - history/read-only state

## Verification Commands

```bash
cd apps/client
npx vitest run src/components/game/PlayerZone.test.tsx
npx vitest run src/components/game/GameBoard.test.tsx
npx tsc --noEmit
```
