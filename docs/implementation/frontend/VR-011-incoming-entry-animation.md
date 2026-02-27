# VR-011 — Incoming Entry Animation for Universal Staging

**Phase:** 3 — Medium Impact, Low Effort  
**Source:** Visual-Redesign-20220222.md §A.4, §D item 11  
**Merged Scope:** US-STAGE-007

## Summary

When tiles arrive in the incoming staging lane, animate entry using existing `tile-enter-from-{seat}` classes.

This applies across Charleston and playing contexts where incoming staged tiles are shown.

## Acceptance Criteria

- **AC-1**: Incoming staged tile wrapper applies `tile-enter-from-{seat}` when `incomingFromSeat` is present.
- **AC-2**: Class mapping matches existing seat animation naming (`east/south/west/north`).
- **AC-3**: Animation class is applied only on initial slot fill transition.
- **AC-4**: If `incomingFromSeat` is `null`, no entry class is applied.
- **AC-5**: During blind stages, class applies to wrapper independent of face-up/face-down rendering.

## Connection Points

| File                                               | Location              | Change                                         |
| -------------------------------------------------- | --------------------- | ---------------------------------------------- |
| `apps/client/src/components/game/StagingStrip.tsx` | incoming lane wrapper | apply seat entry class                         |
| `apps/client/src/index.css` (or existing CSS host) | class definitions     | reuse existing `tile-enter-from-*` definitions |

## Test Requirements

**File:** `apps/client/src/components/game/StagingStrip.test.tsx`

- **T-1**: incoming tile + `incomingFromSeat='East'` gets `tile-enter-from-east`.
- **T-2**: incoming tile + `incomingFromSeat=null` gets no seat class.
- **T-3**: blind incoming tile still receives wrapper class when seat is provided.

## Out of Scope

- New keyframe definitions.
- Direction/pass banner behavior.

## Dependencies

- Requires VR-006 incoming lane implementation.
