# VR-008 — Unified Player Zone Wrapper

**Phase:** 2 — High Impact, Medium Effort
**Source:** Visual-Redesign-20220222.md §C.1, §D item 8

## Summary

Create a new `PlayerZone` layout wrapper that anchors the player's entire bottom area (`fixed bottom-0 left-0 right-0`) and hosts the `StagingStrip`, `PlayerRack`, and `ActionBar` as a two-column layout. `ActionBar` becomes `position: relative` inside this zone.

## Acceptance Criteria

- **AC-1**: A new file `apps/client/src/components/game/PlayerZone.tsx` is created.
- **AC-2**: A new file `apps/client/src/components/game/PlayerZone.test.tsx` is created.
- **AC-3**: `PlayerZone` outer container: `fixed bottom-0 left-0 right-0` with fade-up gradient background:
  - `background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 80%, transparent 100%)'`
- **AC-4**: Layout is two columns:
  - Left/center column (flex-grow): renders `children` (the rack + staging strip).
  - Right column (fixed width ~180px): renders an optional `actions` slot.
- **AC-5**: `ActionBar`'s root `<div>` fixed positioning (`fixed right-[16%] top-1/2 -translate-y-1/2`) is removed; `ActionBar` is made `relative` inside the zone's right column. **This is the only change to `ActionBar.tsx` in this story.**
- **AC-6**: `PlayerRack`'s `fixed bottom-4 left-1/2 -translate-x-1/2` positioning is removed; it renders inside the left column of the zone. **This is the only change to `PlayerRack.tsx` in this story.**
- **AC-7**: `data-testid="action-bar"` on `ActionBar` is preserved.
- **AC-8**: `data-testid="player-rack"` on `PlayerRack` is preserved.
- **AC-9**: `PlayerZone` accepts a `data-testid` prop (default: `"player-zone"`) for test targeting.
- **AC-10**: All existing Charleston and Playing phase integration tests still pass after positioning changes.

### Props Interface

```typescript
interface PlayerZoneProps {
  /** Main center content (rack + staging strip) */
  children: React.ReactNode;
  /** Right-column content (ActionBar) */
  actions?: React.ReactNode;
  'data-testid'?: string;
}
```

## Step 0: Rename ConcealedHand → PlayerRack ✅ DONE (pre-VR-008)

Files, exports, and all import sites have been renamed. Two items remain and must be done as part
of implementing this story (before running regression tests):

```tsx
// PlayerRack.tsx — still uses old values; update during VR-008 implementation
data-testid="concealed-hand"  →  data-testid="player-rack"
aria-label={`Your hand: ${tiles.length} tiles`}  →  aria-label={`Your rack: ${tiles.length} tiles`}
```

Once those two lines are changed, also update every test that queries `getByTestId('concealed-hand')`
to use `'player-rack'` (10+ occurrences across integration tests — grep for `concealed-hand`).

---

## Connection Points

| File                                                                                | Location                      | Change                                                                                              |
| ----------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/client/src/components/game/PlayerZone.tsx`                                    | New file                      | Create two-column layout wrapper                                                                    |
| `apps/client/src/components/game/PlayerZone.test.tsx`                               | New file                      | Tests (see below)                                                                                   |
| `apps/client/src/components/game/PlayerRack.tsx`                                    | Line 92 — outer `<div>`       | Remove `fixed bottom-4 left-1/2 -translate-x-1/2`; keep other classes                               |
| `apps/client/src/components/game/ActionBar.tsx`                                     | Lines 481–486 — outer `<div>` | Remove `fixed right-[16%] top-1/2 -translate-y-1/2`; change to `relative w-full`                    |
| `apps/client/src/components/game/phases/CharlestonPhase.tsx`                        | Render site                   | Wrap `<PlayerRack>` + `<StagingStrip>` + `<ActionBar>` in `<PlayerZone actions={<ActionBar .../>}>` |
| `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` | Render site                   | Same wrapping for playing phase                                                                     |

### PlayerRack change detail

```tsx
// PlayerRack.tsx line 92 — before
className={cn('flex flex-col items-center gap-2', 'fixed bottom-4 left-1/2 -translate-x-1/2')}

// after
className="flex flex-col items-center gap-2"
```

### ActionBar change detail

```tsx
// ActionBar.tsx lines 481–486 — before
className={cn(
  'fixed right-[16%] top-1/2 -translate-y-1/2',
  'bg-black/85 rounded-lg shadow-lg',
  'px-4 py-3',
  'min-w-[180px]'
)}

// after
className={cn(
  'relative',
  'bg-black/85 rounded-lg shadow-lg',
  'px-4 py-3',
  'min-w-[180px]'
)}
```

## Test Requirements

### Unit Tests

**File:** `apps/client/src/components/game/PlayerZone.test.tsx` (new)

- **T-1**: Render `<PlayerZone>` with child content. Assert `data-testid="player-zone"` is present.
- **T-2**: Assert child content is rendered inside the zone.
- **T-3**: Render with `actions={<div data-testid="actions-slot" />}`. Assert actions slot is rendered.
- **T-4**: Assert the root element does not use `fixed` positioning on `PlayerRack` or `ActionBar` when rendered through `PlayerZone` (snapshot or class absence test).

### Regression Tests (existing test files to check pass)

- `apps/client/src/components/game/ActionBar.test.tsx` — `data-testid="action-bar"` still present
- `apps/client/src/components/game/PlayerRack.test.tsx` — `data-testid="player-rack"` still present
- `apps/client/src/features/game/Charleston.integration.test.tsx` — all pass
- `apps/client/src/features/game/Playing.integration.test.tsx` — all pass

## Out of Scope

- ActionBar content changes (VR-014 handles ActionBar restructuring).
- Staging strip integration (VR-006 handles that).

## Dependencies

- **VR-006** (StagingStrip) must exist before wiring into the zone's center column for charleston.
- **VR-003** (wooden enclosure) and **VR-005** (label bar) should be done but are not hard blockers.
