# VR-013 — Charleston Direction Banner Enhancement

**Phase:** 3 — Medium Impact, Medium Effort
**Source:** Visual-Redesign-20220222.md §C.3, §D item 13

## Summary

Enhance `PassAnimationLayer` from a small centered card to a full-width translucent banner showing the pass direction with larger text, a seat-target label, and directional arrow styling. Timing is unchanged.

## Acceptance Criteria

- **AC-1**: `PassAnimationLayer` outer container changes from `flex items-center justify-center` (centered) to a full-width horizontal banner.
- **AC-2**: The banner is `fixed inset-x-0` at vertical center (e.g., `top-1/3`) or positioned at a visually impactful location (above the rack zone, below the opponent racks).
- **AC-3**: The banner spans `left-0 right-0` with `pointer-events-none`.
- **AC-4**: The banner background is `rgba(0,0,0,0.75)` or equivalent, with a left/right fade via a linear gradient (e.g., `background: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.85) 15%, rgba(0,0,0,0.85) 85%, transparent 100%)'`).
- **AC-5**: The direction label (`Passing Right →`, `Passing Across ↔`, `Passing Left ←`) is rendered in `text-2xl font-bold text-white`.
- **AC-6**: A sub-label shows the target seat for clarity (e.g., `"3 tiles → West"`) derived from the `direction` prop and the `yourSeat` passed in.
- **AC-7**: To supply seat info, `PassAnimationLayer` gains an optional `yourSeat?: Seat` prop. When absent, the sub-label is omitted.
- **AC-8**: `data-testid="pass-animation-layer"` is preserved on the container.
- **AC-9**: `aria-live="polite"` is preserved.
- **AC-10**: CSS animation (`pass-animation-card` class from `PassAnimationLayer.css`) still applies to the inner content element so fade-in/hold/fade-out timing is unchanged.

### Sub-label seat derivation

```tsx
// Derive target seat from direction + yourSeat
import { getOpponentPosition } from './opponentRackUtils';
// Or use a simple lookup:
const TARGET_SEAT: Record<Seat, Record<PassDirection, Seat>> = {
  East: { Right: 'South', Across: 'West', Left: 'North' },
  South: { Right: 'West', Across: 'North', Left: 'East' },
  West: { Right: 'North', Across: 'East', Left: 'South' },
  North: { Right: 'East', Across: 'South', Left: 'West' },
};
const targetSeat = yourSeat ? TARGET_SEAT[yourSeat][direction] : null;
```

## Connection Points

| File                                                         | Location                     | Change                                                                                |
| ------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------- |
| `apps/client/src/components/game/PassAnimationLayer.tsx`     | `PassAnimationLayerProps`    | Add `yourSeat?: Seat`                                                                 |
| `apps/client/src/components/game/PassAnimationLayer.tsx`     | JSX structure                | Replace `Card` centered layout with full-width banner layout                          |
| `apps/client/src/components/game/PassAnimationLayer.css`     | Animation class              | Preserve `pass-animation-card` class application — attach to inner banner content div |
| `apps/client/src/components/game/phases/CharlestonPhase.tsx` | `<PassAnimationLayer>` usage | Pass `yourSeat={gameState.your_seat}`                                                 |

```tsx
// PassAnimationLayer.tsx — before
<div className="fixed inset-0 flex items-center justify-center pointer-events-none" ...>
  <Card className="px-6 py-3 bg-black/80 text-white pass-animation-card">
    <div className="text-lg font-semibold">{directionLabel[direction]}</div>
  </Card>
</div>

// after
<div
  className="fixed left-0 right-0 top-1/3 pointer-events-none"
  data-testid="pass-animation-layer"
  aria-live="polite"
>
  <div
    className="pass-animation-card px-8 py-4 text-white"
    style={{
      background: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.85) 15%, rgba(0,0,0,0.85) 85%, transparent 100%)',
    }}
  >
    <div className="text-2xl font-bold text-center">{directionLabel[direction]}</div>
    {targetSeat && (
      <div className="text-sm text-slate-300 text-center mt-1">
        3 tiles → {targetSeat}
      </div>
    )}
  </div>
</div>
```

## Test Requirements

**File:** (check for existing `PassAnimationLayer.test.tsx` — create if missing)

- **T-1**: Render `<PassAnimationLayer direction="Right" />`. Assert `getByTestId('pass-animation-layer')` is present.
- **T-2**: Assert direction text `"Passing Right"` is visible.
- **T-3**: Render with `yourSeat="East"` and `direction="Right"`. Assert sub-label contains `"South"` (target seat for East passing Right).
- **T-4**: Render without `yourSeat`. Assert no sub-label is rendered.
- **T-5**: Assert `aria-live="polite"` is on the container.

## Out of Scope

- Animation timing changes.
- Tile movement animations (handled by `DiscardAnimationLayer` pattern).

## Dependencies

Independent of other VR stories. Can optionally benefit from VR-006 (StagingStrip) to coordinate timing.
