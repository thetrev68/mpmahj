# VR-007 — Opponent Staging Tile Backs (Charleston)

**Phase:** 2 — High Impact, Low Effort
**Source:** Visual-Redesign-20220222.md §A.5, §D item 7

## Summary

During Charleston, show face-down tile backs above each opponent's rack to indicate how many tiles
they have committed to pass. 0/3 = nothing shown; 1–2 = that many tile backs; 3 = three tile backs
plus a checkmark badge.

## Acceptance Criteria

- **AC-1**: A new optional prop `charlestonReadyCount?: number` (0–3) is added to `OpponentRackProps`.
- **AC-2**: When `charlestonReadyCount` is 0 or undefined, no staging tile backs are rendered.
- **AC-3**: When `charlestonReadyCount` is 1–2, that many `<Tile faceUp={false} size="small" />`
  backs render in a tightly-spaced row above the wooden rack.
- **AC-4**: When `charlestonReadyCount` is 3, three tile backs render plus a checkmark badge
  (e.g., `✓` in `text-emerald-300`).
- **AC-5**: The staging tile backs row is rendered before (above) the wooden tile enclosure in the
  JSX tree.
- **AC-6**: All existing `data-testid` attributes are unchanged.
- **AC-7**: The staging tile backs row is `aria-hidden="true"` (decorative — screen reader info comes
  from `CharlestonTracker`).

### Passing `charlestonReadyCount` from parent

In `CharlestonPhase.tsx`, the `readyPlayers` array from `charleston_state` contains seats of players
who have submitted. Derive per-seat count:

```tsx
// CharlestonPhase.tsx — when rendering OpponentRack
const isReady = charlestonState.ready_players.includes(player.seat);
<OpponentRack
  ...
  charlestonReadyCount={isReady ? 3 : 0}
/>
```

> Note: The server currently only reports full ready (all 3 tiles committed) — it does not stream
> partial counts. So the count is always 0 or 3. The prop accepts 0–3 for future-proofing if the
> server adds partial counts.

## Connection Points

| File | Location | Change |
|------|----------|--------|
| `apps/client/src/components/game/OpponentRack.tsx` | `OpponentRackProps` interface | Add `charlestonReadyCount?: number` |
| `apps/client/src/components/game/OpponentRack.tsx` | JSX body | Conditionally render staging tile backs row |
| `apps/client/src/components/game/phases/CharlestonPhase.tsx` | `<OpponentRack>` usage | Pass `charlestonReadyCount` derived from `charlestonState.ready_players` |

## Test Requirements

### Unit / Component Tests

**File:** `apps/client/src/components/game/OpponentRack.test.tsx` (existing — add assertions)

- **T-1**: Render with `charlestonReadyCount={0}`. Assert no staging tile backs are rendered above
  the rack (count face-down tiles — should match concealed count only, with no extras).
- **T-2**: Render with `charlestonReadyCount={3}`. Assert exactly 3 small face-down tile backs are
  rendered in the staging row above the wooden enclosure.
- **T-3**: Render with `charlestonReadyCount={3}`. Assert a `✓` or checkmark text is visible.
- **T-4**: Render with `charlestonReadyCount={undefined}`. Assert no staging row renders (same as T-1).
- **T-5**: Assert `data-testid={opponent-rack-{seat}}` is still present (regression).

### Integration Tests

**File:** `apps/client/src/features/game/Charleston.integration.test.tsx` (existing)

- **T-6**: After a `PlayerReadyForPass` event for `North`, assert North's opponent rack shows staging
  tile backs (or checkmark badge) above the wooden enclosure.

## Out of Scope

- Partial count display (not supported by server today).
- Staging tile backs during playing phase.

## Dependencies

Depends on VR-003 (wooden enclosure) being in place so the staging row has correct visual context.
Logically additive on top of VR-003.
