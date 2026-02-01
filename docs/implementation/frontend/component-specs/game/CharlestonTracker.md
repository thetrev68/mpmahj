# CharlestonTracker

## Purpose

Compact phase indicator for the Charleston sequence (Right → Across → Left). Shows the current pass direction, sub-phase label, and progress through the Charleston flow.

## User Stories

- US-002: Charleston pass action
- US-005: Charleston voting (Stop/Continue)

## Props

````typescript
interface CharlestonTrackerProps {
  phaseLabel: string; // e.g. "First Charleston", "Second Charleston"
  passDirection: 'Right' | 'Across' | 'Left';
  stage: 'Pass' | 'Collect' | 'Blind' | 'Vote' | 'Complete';
  stepIndex: number; // 0-based index of Charleston step
  stepCount: number; // total steps for this Charleston flow
  isActive: boolean; // false when not in Charleston phase
}
```text

## Behavior

- Displays the current `passDirection` when `stage` is `Pass` or `Blind`.
- Displays "Collect" when `stage` is `Collect`.
- Displays "Vote" when `stage` is `Vote`.
- Shows progress as “Step x / y” based on `stepIndex` and `stepCount`.
- When `isActive` is false, render a muted state with “Charleston Complete”.

## Visual Requirements

### Layout

```text
┌──────────────────────────────────────────┐
│ Charleston: Right (Pass)    Step 2 / 6  │
└──────────────────────────────────────────┘
```text

- Left: Phase label (Charleston + pass direction + stage)
- Right: Step counter

### States

- **Active**: High-contrast text, direction highlighted
- **Inactive**: Muted text, no highlight

### Emphasis

- Pass direction should be visually distinct (bold or pill)
- Stage label should be visible even on small screens

## Related Components

- **Used by**: `<GameBoard>` header area
- **Uses**: shadcn/ui `<Badge>` for pass direction
- **Uses**: shadcn/ui `<Progress>` for step progress (optional)

## Implementation Notes

- If `stepCount` is 0, hide the progress display.
- Consider mapping backend `CharlestonStage` enum to `passDirection` + `stage` in a selector.
````
