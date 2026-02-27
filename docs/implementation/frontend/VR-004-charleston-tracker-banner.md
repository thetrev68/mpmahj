# VR-004 — CharlestonTracker Full-Width Banner

**Phase:** 1 — High Impact, Low Effort
**Status:** Implemented (Codex) Validated (Sonnet)
**Source:** Visual-Redesign-20220222.md §C.2, §D item 4

## Summary

Convert the `CharlestonTracker` from a floating centered pill (`left-1/2 -translate-x-1/2`) to a full-width HUD banner anchored to `top-0` with a green gradient background.

## Acceptance Criteria

- **AC-1**: The outer `<div>` positioning changes from `fixed top-2 left-1/2 -translate-x-1/2` to `fixed top-0 left-0 right-0 z-20`.
- **AC-2**: The `bg-black/85 rounded-lg` classes are removed from the outer `<div>`.
- **AC-3**: An inline `style` is added to the outer `<div>`:
  - `background: 'linear-gradient(to right, rgba(12,35,18,0.97), rgba(18,52,28,0.97))'`
  - `borderBottom: '1px solid rgba(80,160,100,0.3)'`
- **AC-4**: `data-testid="charleston-tracker"` is preserved on the same element.
- **AC-5**: `role="status"` and `aria-label` are preserved.
- **AC-6**: The outer `<div>` retains the layout classes `flex items-center gap-4 px-6 py-3` so the arrangement of inner content is unchanged.
- **AC-7**: All inner `data-testid` attributes are unchanged:
  - `charleston-direction`, `charleston-arrow`, `charleston-progress`, `ready-count`, `ready-indicators`, `ready-indicator-{seat}`, `charleston-status-message`.
- **AC-8**: No prop changes to `CharlestonTrackerProps`.

## Connection Points

| File                                                    | Location                                                | Change                                                     |
| ------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| `apps/client/src/components/game/CharlestonTracker.tsx` | Lines 89–99 — outer `<div>` `className` and `cn()` call | Replace positioning/background classes; add inline `style` |

> **Rendering context:** `CharlestonTracker` is mounted unconditionally inside `CharlestonPhase.tsx` (not `GameBoard` directly). The banner exists only while the Charleston phase is active; when the phase ends, `CharlestonPhase` unmounts and the banner disappears entirely. It is not reused for non-Charleston messaging.

```tsx
// CharlestonTracker.tsx before (lines 89–99)
<div
  className={cn(
    'fixed top-2 left-1/2 -translate-x-1/2',
    'bg-black/85 text-white rounded-lg',
    'px-6 py-3',
    'flex items-center gap-4'
  )}
  data-testid="charleston-tracker"
  ...
>

// after
<div
  className="fixed top-0 left-0 right-0 z-20 text-white px-6 py-3 flex items-center gap-4"
  style={{
    background: 'linear-gradient(to right, rgba(12,35,18,0.97), rgba(18,52,28,0.97))',
    borderBottom: '1px solid rgba(80,160,100,0.3)',
  }}
  data-testid="charleston-tracker"
  ...
>
```

## Test Requirements

### Unit / Component Tests

**File:** `apps/client/src/components/game/CharlestonTracker.test.tsx` (existing — add/update assertions)

- **T-1**: Render `<CharlestonTracker stage="FirstRight" readyPlayers={[]} />`. Assert `getByTestId('charleston-tracker')` is in the DOM (regression).
- **T-2**: Assert the tracker element does **not** have class `rounded-lg` or `left-1/2` (regression guard against old pill style).
- **T-3**: Assert the tracker element has inline `style.background` containing `rgba(12,35,18` (new gradient applied).
- **T-4**: Assert `getByTestId('charleston-direction')`, `getByTestId('charleston-arrow')`, and `getByTestId('ready-count')` are still present (inner content regression).
- **T-5**: Assert `getByTestId('ready-indicator-east')` is still present for all four seats when rendered.

### Integration

No integration test changes required — the tracker's functional behavior is unchanged.

## Out of Scope

- Timer display changes.
- Arrow/label content.
- Any Charleston phase logic.
- Hide or fade behaviour for the `Complete` stage. When `stage="Complete"`, the full-width banner briefly shows "Complete ✓" before `CharlestonPhase` unmounts. This transient display is acceptable; suppressing it is a separate concern.

## Dependencies

None. Fully independent.
