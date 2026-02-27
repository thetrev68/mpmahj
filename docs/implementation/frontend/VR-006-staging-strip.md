# VR-006 — Universal StagingStrip (Charleston + Playing)

**Phase:** 2 — High Impact, High Effort  
**Status:** In Process
**Source:** Visual-Redesign-20220222.md §A.1–A.4, §A.7, §D item 6  
**Merged Scope:** US-STAGE-004, US-STAGE-005

## Summary

Create a new `StagingStrip` component that is always visible and acts as the single player-facing interchange for tile movement.

This replaces mixed behavior where some transitions bypass staging.

- Charleston: incoming and outgoing pass tiles are staged.
- Playing phase: draw/discard/call/exchange tiles are staged before commit.

The strip has two logical lanes:

- incoming lane (tiles arriving to the player)
- outgoing lane (tiles selected to commit an action)

## Acceptance Criteria

- **AC-1**: `apps/client/src/components/game/StagingStrip.tsx` exists with matching test file.
- **AC-2**: Component supports incoming and outgoing lanes (not a single undifferentiated tile array).
- **AC-3**: Incoming lane supports hidden/revealed states for blind contexts.
- **AC-4**: Outgoing lane supports remove-before-commit behavior.
- **AC-5**: Action buttons (`PASS`, `CALL`, `DISCARD`) are integrated in the strip and always rendered.
- **AC-6**: Action button enabled/disabled state is controlled by `canCommitPass`, `canCommitCall`, `canCommitDiscard` and `isProcessing`.
- **AC-7**: During Charleston, `CharlestonPhase.tsx` computes pass commit payload from staged state (rack-selected outgoing + remaining staged incoming).
- **AC-8**: During Charleston blind stages, no slider UI is used.
- **AC-9**: Legacy `BlindPassPanel` usage is removed from `CharlestonPhase.tsx`.
- **AC-10**: `useCharlestonState` no longer owns blind slider count state.
- **AC-11**: Staging is used for non-blind Charleston stages as well (consistent interaction model).
- **AC-12**: Styling remains aligned with existing design language (tile sizing consistent with `PlayerRack`, empty/filled slot affordances clear).

### Proposed Props Interface

```typescript
interface StagingStripProps {
  incomingTiles: StagedTile[];
  outgoingTiles: StagedTile[];
  incomingSlotCount: number;
  outgoingSlotCount: number;
  blindIncoming: boolean;
  incomingFromSeat: Seat | null;
  onFlipIncoming: (tileId: string) => void;
  onAbsorbIncoming: (tileId: string) => void;
  onRemoveOutgoing: (tileId: string) => void;
  onCommitPass: () => void;
  onCommitCall: () => void;
  onCommitDiscard: () => void;
  canCommitPass: boolean;
  canCommitCall: boolean;
  canCommitDiscard: boolean;
  isProcessing: boolean;
}
```

## Connection Points

### New Files

- `apps/client/src/components/game/StagingStrip.tsx`
- `apps/client/src/components/game/StagingStrip.test.tsx`

### Modified Files

| File                                                         | Change                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `apps/client/src/components/game/phases/CharlestonPhase.tsx` | Owns staged incoming/outgoing state and commit semantics for all Charleston stages |
| `apps/client/src/hooks/useCharlestonState.ts`                | Remove blind slider count state/actions                                            |
| `apps/client/src/components/game/BlindPassPanel.tsx`         | Delete                                                                             |
| `apps/client/src/components/game/BlindPassPanel.test.tsx`    | Delete                                                                             |
| `apps/client/src/components/game/phases/PlayingPhase.tsx`    | Consume strip as shared action surface in playing flow                             |

## Test Requirements

### Unit Tests

**File:** `apps/client/src/components/game/StagingStrip.test.tsx`

- **T-1**: Renders incoming/outgoing lane slots with correct counts.
- **T-2**: Incoming hidden tile renders face-down when `blindIncoming=true`.
- **T-3**: `onFlipIncoming` fires from hidden incoming tile interaction.
- **T-4**: `onAbsorbIncoming` fires from revealed incoming tile interaction.
- **T-5**: `onRemoveOutgoing` fires from outgoing tile interaction.
- **T-6**: Commit button disabled state follows `canCommit*` + `isProcessing`.

### Phase/Integration Tests

- Charleston integration tests verify stage behavior with staging in blind and non-blind passes.
- Playing integration tests verify strip availability and command commit semantics in playing phase.

## Out of Scope

- Server protocol definition (covered by US-STAGE-001/002/003).
- Animation-specific details covered in VR-011.
- Blind-face badge and blind interaction semantics covered in VR-010.

## Dependencies

- Requires frontend event contract from US-STAGE-003 to be present.
- Coordinates with VR-010/011/012/013 for specialized behavior.
