# VR-010 — Blind Incoming Tile Behavior in StagingStrip

**Phase:** 3 — Medium Impact, Medium Effort
**Source:** Visual-Redesign-20220222.md §A.3 (Blind state), §D item 10

## Summary

During blind pass stages (`FirstLeft`, `SecondRight`), blind behavior applies to **incoming** staged tiles, not outgoing hand-selected tiles.

Each incoming tile starts hidden, can be revealed, and then can be absorbed into hand. Any remaining incoming staged tiles are forwarded on pass commit.

## Acceptance Criteria

- **AC-1**: In blind Charleston stages, incoming tiles render face-down by default.
- **AC-2**: Hidden incoming tile shows amber `BLIND` badge.
- **AC-3**: Clicking hidden incoming tile triggers reveal transition (`onFlipIncoming`).
- **AC-4**: Revealed tile renders face-up and shows `PEEK` badge.
- **AC-5**: Clicking revealed incoming tile triggers absorb action (`onAbsorbIncoming`) and removes it from incoming lane.
- **AC-6**: PASS enablement includes both outgoing selected tiles and unabsorbed incoming tiles contributing to total pass count.
- **AC-7**: During non-blind stages, incoming tiles are face-up and flip/absorb behavior is disabled.

## Connection Points

| File                                                         | Location                     | Change                                                           |
| ------------------------------------------------------------ | ---------------------------- | ---------------------------------------------------------------- |
| `apps/client/src/components/game/StagingStrip.tsx`           | incoming lane tile rendering | Hidden/revealed visuals, blind badge, reveal/absorb interactions |
| `apps/client/src/components/game/phases/CharlestonPhase.tsx` | blind stage orchestration    | Stage-specific blind mode, pass count composition logic          |

## Test Requirements

**File:** `apps/client/src/components/game/StagingStrip.test.tsx`

- **T-1**: `blindIncoming=true` + hidden tile renders face-down + `BLIND` badge.
- **T-2**: click hidden tile calls `onFlipIncoming`.
- **T-3**: revealed tile renders face-up and replaces `BLIND` badge with `PEEK` badge.
- **T-4**: click revealed tile calls `onAbsorbIncoming`.
- **T-5**: `blindIncoming=false` renders incoming tile face-up without blind controls.
- **T-6**: `canCommitPass` is true when outgoing selected count plus unabsorbed incoming count equals the required pass total.

### Integration Tests

- Charleston first/second blind stage tests verify reveal/absorb/forward mix (`0..3` incoming forwarded).

## Out of Scope

- Incoming tile entry animation details (VR-011).
- Direction banner timing/details (VR-013).

## Dependencies

- Requires VR-006 staging lanes and callbacks. The `CharlestonPhase.tsx` changes in this story assume VR-006 has already removed `BlindPassPanel` and migrated blind-count state out of `useCharlestonState`.
