# VR-012 — Playing Phase Staging-First Flow

**Phase:** 3 — High Impact, Medium Effort  
**Source:** Visual-Redesign-20220222.md §A.6, §D item 12  
**Merged Scope:** US-STAGE-006

## Summary

Replace the separate drawn-tile-zone concept with a staging-first playing flow.

In playing phase, player-action tile movement routes through `StagingStrip`:

- draw -> incoming staging lane
- discard candidate -> outgoing staging lane
- called tile / exchange candidate -> staging before commit visuals

This makes playing behavior consistent with Charleston staging semantics.

## Acceptance Criteria

- **AC-1**: After draw events, draw tile appears in incoming staging lane.
- **AC-2**: Discard command is triggered from staged outgoing selection, not direct rack-only commit.
- **AC-3**: Called-tile and exchange visuals include staging step before final state commit visuals.
- **AC-4**: Staging clears/resets correctly after successful commit and on phase transitions.
- **AC-5**: Processing lock prevents duplicate commit interactions.

## Connection Points

| File                                                      | Location              | Change                                                          |
| --------------------------------------------------------- | --------------------- | --------------------------------------------------------------- |
| `apps/client/src/components/game/phases/PlayingPhase.tsx` | playing orchestration | route draw/discard/call/exchange through staging                |
| `apps/client/src/components/game/StagingStrip.tsx`        | actions               | consume commit callbacks for playing commands                   |
| `apps/client/src/components/game/PlayerRack.tsx`          | rack interaction      | selection feeds outgoing staging rather than direct action path |

## Test Requirements

### Integration Tests

**File:** `apps/client/src/features/game/Playing.integration.test.tsx`

- **T-1**: draw event shows tile in incoming staging lane.
- **T-2**: selecting discard candidate stages it to outgoing lane and enables discard commit.
- **T-3**: committing discard clears relevant staged state.
- **T-4**: call/exchange flow uses staging before final visual commit state.

### Unit/Phase Tests

- Add or update phase tests to validate processing lock and staging reset behavior.

## Out of Scope

- Reintroducing a dedicated in-rack drawn tile slot.
- Backend command protocol changes (already handled in US-STAGE-001/002/003).

## Dependencies

- Requires VR-006 staging strip and event contract from US-STAGE-003.
