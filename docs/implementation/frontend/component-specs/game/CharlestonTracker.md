# CharlestonTracker

## Purpose

Compact phase indicator for the Charleston sequence (Right → Across → Left). Shows the current pass direction, sub-phase label, and progress through the Charleston flow.

## User Stories

- US-002: Charleston pass action
- US-005: Charleston voting (Stop/Continue)

## Props

```typescript
interface CharlestonTrackerProps {
  stage: CharlestonStage; // From bindings
  stepIndex: number; // 0-based index of Charleston step
  stepCount: number; // total steps for this Charleston flow
  isActive: boolean; // false when not in Charleston phase
}
```

## Behavior

- Derive pass direction and label from `CharlestonStage`:
  - FirstRight / SecondRight → Right
  - FirstAcross / SecondAcross / CourtesyAcross → Across
  - FirstLeft / SecondLeft → Left
  - VotingToContinue → Vote
  - Complete → Complete
- Shows progress as “Step x / y” based on `stepIndex` and `stepCount`.
- When `isActive` is false, render a muted state with “Charleston Complete”.

## Visual Requirements

### Layout

```text
┌──────────────────────────────────────────┐
│ Charleston: Right (Pass)    Step 2 / 6  │
└──────────────────────────────────────────┘
```

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
- Map backend `CharlestonStage` to pass direction and label in a selector.
