# VR-008 — Unified Player Zone Wrapper

**Phase:** 2 — High Impact, Medium Effort
**Status:** Ready for Development
**Source:** Visual-Redesign-20220222.md §C.1, §D item 8

## Summary

Create a new `PlayerZone` layout wrapper that anchors the player's entire bottom area
(`fixed bottom-0 left-0 right-0`) and hosts the `StagingStrip`, `PlayerRack`, and `ActionBar`
in a two-row layout:

- **Upper row**: `StagingStrip` (left column, fixed 6-tile width) beside `ActionBar` (right column),
  split approximately 70/30 across the zone width. Both are centered within their column. The split
  ratio is expressed as a single tunable value — exact proportions will be adjusted once seen at real
  size.
- **Lower row**: `PlayerRack` spanning the full zone width.

`ActionBar` becomes `position: relative` inside the zone and is **always rendered** — buttons are
disabled when they do not apply rather than the entire bar being removed from the DOM. This prevents
layout jumps when the ActionBar pops in and out.

The `StagingStrip` is present in **all** game phases (not Charleston only).

## Layout Sketch

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         [ game board / other players ]                           │
│                                                                                  │
│  ╔════════════════════════════════════════════════════════════════════════════╗  │
│  ║  PLAYER ZONE  (fixed bottom-0 left-0 right-0)                            ║  │
│  ║  gradient: transparent (top) → rgba(0,0,0,0.92) (bottom)                 ║  │
│  ║                                                                           ║  │
│  ║  ◄────────────── ~70% ─────────────────────────►◄──────── ~30% ─────────►║  │
│  ║  ┌─── staging slot ─────────────────────────────┐┌─── actions slot ─────┐║  │
│  ║  │                                              ││                      │║  │
│  ║  │      [_] [_] [_] [_] [_] [_]                ││    [ Pass   ]        │║  │
│  ║  │        (centered, 6 tile placeholders)       ││    [ Draw   ]        │║  │
│  ║  └──────────────────────────────────────────────┘│    [ Leave  ]        │║  │
│  ║                                                  │  (centered in col)   │║  │
│  ║  ┌─── rack slot (full zone width) ───────────────┴──────────────────────┐║  │
│  ║  │                                                                      │║  │
│  ║  │   [t][t][t][t][t][t][t][t][t][t][t][t][t][t][t][t][t][t][t]        │║  │
│  ║  │                      (centered in zone)                              │║  │
│  ║  └──────────────────────────────────────────────────────────────────────┘║  │
│  ╚════════════════════════════════════════════════════════════════════════════╝  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

The `actions` column height is determined by its content — it does **not** stretch beside the rack.
The rack row spans the full zone width (i.e., across both columns).
The ~70/30 split is a starting point; see AC-4 for tuning guidance.

## Acceptance Criteria

- **AC-1**: A new file `apps/client/src/components/game/PlayerZone.tsx` is created.
- **AC-2**: A new file `apps/client/src/components/game/PlayerZone.test.tsx` is created.
- **AC-3**: `PlayerZone` outer container: `fixed bottom-0 left-0 right-0` with fade-up gradient background:
  - `background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 80%, transparent 100%)'`
- **AC-4**: Layout is two rows:
  - Upper row (flex): `staging` slot (left) beside `actions` slot (right), starting at a ~70/30 percentage
    split. Both sides are centered within their column. The split is expressed as a single constant in
    `PlayerZone.tsx` (e.g., a pair of complementary Tailwind width classes) so it can be tuned in one
    place once real proportions are validated. Do not use a fixed pixel width for either column.
  - Lower row: `rack` slot spanning the full zone width (i.e., across both columns above it).
- **AC-5**: `ActionBar`'s root `<div>` fixed positioning (`fixed right-[16%] top-1/2 -translate-y-1/2`) is
  removed; `ActionBar` is made `relative w-full` inside the zone's `actions` slot. Note: `w-full` is a new
  addition — it was not present before.
- **AC-6**: `PlayerRack`'s `fixed bottom-4 left-1/2 -translate-x-1/2` positioning is removed; it renders
  inside the `rack` slot of the zone.
- **AC-7**: `data-testid="action-bar"` on `ActionBar` is preserved.
- **AC-8**: `data-testid="player-rack"` on `PlayerRack` is preserved.
- **AC-9**: `PlayerZone` accepts a `data-testid` prop (default: `"player-zone"`) for test targeting.
- **AC-10**: All existing Charleston and Playing phase integration tests still pass after positioning changes.
- **AC-11**: `ActionBar` is **always** passed to the `actions` slot in both `CharlestonPhase` and
  `PlayingPhasePresentation` — it is never replaced with `null`. The conditional rendering
  `{!isCourtesyStage || courtesyState.isSelectingTiles ? <ActionBar .../> : null}` in `CharlestonPhase`
  is removed. Instead, `ActionBar` receives a `disabled` prop (see AC-12).
- **AC-12**: `ActionBar` gains a `disabled?: boolean` prop. When `true`, all buttons render in a disabled
  state. `CharlestonPhase` passes `disabled={isCourtesyStage && !courtesyState.isSelectingTiles}`.
  **Changes to `ActionBar.tsx` in this story: positioning (AC-5) and the `disabled` prop (AC-12) only.**

### Props Interface

```typescript
interface PlayerZoneProps {
  /** Staging strip (upper row, left — beside ActionBar) */
  staging: React.ReactNode;
  /** Player's tile rack (lower row, full width) */
  rack: React.ReactNode;
  /** Right-side content beside staging strip (ActionBar) */
  actions: React.ReactNode;
  'data-testid'?: string;
}
```

All three content slots are required — both `CharlestonPhase` and `PlayingPhasePresentation` always
provide them.

## Step 0: Rename ConcealedHand → PlayerRack ✅ DONE (pre-VR-008)

Files, exports, and all import sites have been renamed. Two items remain and must be done as part
of implementing this story (before running regression tests):

```tsx
// PlayerRack.tsx — still uses old values; update during VR-008 implementation
data-testid="concealed-hand"  →  data-testid="player-rack"
aria-label={`Your hand: ${tiles.length} tiles`}  →  aria-label={`Your rack: ${tiles.length} tiles`}
```

Once those two lines are changed, also update every test that queries `getByTestId('concealed-hand')`
to use `'player-rack'`. There are **20 total occurrences** — 18 across 8 integration test files in
`src/features/game/` and 2 in `src/components/game/PlayerRack.test.tsx`. Run:

```bash
grep -r "concealed-hand" apps/client/src --include="*.tsx" --include="*.ts" -l
```

---

## Connection Points

| File                                                                                | Location                       | Change                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/client/src/components/game/PlayerZone.tsx`                                    | New file                       | Create two-row layout wrapper                                                                                                                             |
| `apps/client/src/components/game/PlayerZone.test.tsx`                               | New file                       | Tests (see below)                                                                                                                                         |
| `apps/client/src/components/game/PlayerRack.tsx`                                    | Lines 91–95 — outer `<div>`    | Remove `fixed bottom-4 left-1/2 -translate-x-1/2`; update `data-testid` and `aria-label` (Step 0)                                                        |
| `apps/client/src/components/game/ActionBar.tsx`                                     | Lines 480–486 — outer `<div>`; props | Remove `fixed right-[16%] top-1/2 -translate-y-1/2`; add `relative w-full`; add `disabled?: boolean` prop                                          |
| `apps/client/src/components/game/phases/CharlestonPhase.tsx`                        | Render site                    | Replace `<PlayerRack>` + conditional `<ActionBar>` with `<PlayerZone>` (see detail below)                                                                |
| `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` | Render site                    | Replace `<PlayerRack>` + `<div role="group">` wrapper with `<PlayerZone>` (see detail below)                                                             |

### PlayerRack change detail

```tsx
// PlayerRack.tsx lines 91–95 — before
<div
  className={cn('flex flex-col items-center gap-2', 'fixed bottom-4 left-1/2 -translate-x-1/2')}
  data-testid="concealed-hand"
  data-mode={mode}
  aria-label={`Your hand: ${tiles.length} tiles`}

// after
<div
  className="flex flex-col items-center gap-2"
  data-testid="player-rack"
  data-mode={mode}
  aria-label={`Your rack: ${tiles.length} tiles`}
```

### ActionBar change detail

```tsx
// ActionBar.tsx lines 480–486 — before
<div
  className={cn(
    'fixed right-[16%] top-1/2 -translate-y-1/2',
    'bg-black/85 rounded-lg shadow-lg',
    'px-4 py-3',
    'min-w-[180px]'
  )}

// after
<div
  className={cn(
    'relative w-full',   // 'w-full' is new; fixed positioning removed
    'bg-black/85 rounded-lg shadow-lg',
    'px-4 py-3',
    'min-w-[180px]'
  )}
```

The `disabled` prop threads down to each button inside ActionBar. When `disabled={true}`, all buttons
are `disabled` and visually indicate inactivity (existing disabled styles apply).

### CharlestonPhase change detail

```tsx
// CharlestonPhase.tsx — before
<PlayerRack ... />

{/* Action Bar — not shown during Courtesy proposal phase, shown during tile selection */}
{!isCourtesyStage || courtesyState.isSelectingTiles ? (
  <ActionBar
    phase={{ Charleston: stage }}
    ...
  />
) : null}

// after
<PlayerZone
  staging={<StagingStrip ... />}
  rack={<PlayerRack ... />}
  actions={
    <ActionBar
      phase={{ Charleston: stage }}
      disabled={isCourtesyStage && !courtesyState.isSelectingTiles}
      ...
    />
  }
/>
```

### PlayingPhasePresentation change detail

```tsx
// PlayingPhasePresentation.tsx — before
<PlayerRack ... />

<div role="group" aria-label="action bar">
  <ActionBar phase={{ Playing: turnStage }} ... />
</div>

// after — div wrapper removed; PlayerZone's actions slot takes over semantic grouping
<PlayerZone
  staging={<StagingStrip ... />}
  rack={<PlayerRack ... />}
  actions={<ActionBar phase={{ Playing: turnStage }} ... />}
/>
```

---

## Test Requirements

### Unit Tests

**File:** `apps/client/src/components/game/PlayerZone.test.tsx` (new)

- **T-1**: Render `<PlayerZone staging={...} rack={...} actions={...}>`. Assert `data-testid="player-zone"` is present.
- **T-2**: Assert `staging` content is rendered in the upper row.
- **T-3**: Assert `rack` content is rendered in the lower row.
- **T-4**: Assert `actions` content is rendered beside the staging slot.
- **T-5**: Assert the root element does not apply `fixed` positioning (snapshot or class absence test).

### Regression Tests (existing test files to verify pass)

- `apps/client/src/components/game/ActionBar.test.tsx` — `data-testid="action-bar"` still present
- `apps/client/src/components/game/PlayerRack.test.tsx` — `data-testid="player-rack"` present (updated from `concealed-hand` in Step 0)
- `apps/client/src/features/game/CharlestonFirstLeft.integration.test.tsx`
- `apps/client/src/features/game/CharlestonFirstAcross.integration.test.tsx`
- `apps/client/src/features/game/CharlestonFirstRight.integration.test.tsx`
- `apps/client/src/features/game/CharlestonSecondCharleston.integration.test.tsx`
- `apps/client/src/features/game/CharlestonVoting.integration.test.tsx`
- `apps/client/src/features/game/CharlestonCourtesyPass.integration.test.tsx`
- `apps/client/src/features/game/turn-discard.integration.test.tsx`
- `apps/client/src/features/game/calling-pung-kong-quint.integration.test.tsx`

## Out of Scope

- ActionBar button-state restructuring beyond the `disabled` prop (VR-014).
- StagingStrip implementation (VR-006, completes before this story).
- Wooden enclosure (VR-003) and label bar (VR-005) — not hard blockers.

## Dependencies

- **VR-006** (StagingStrip) must be complete before implementing this story.
- **VR-003** (wooden enclosure) and **VR-005** (label bar): should be done but are not hard blockers.
