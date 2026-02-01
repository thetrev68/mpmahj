# WallCounter

## Purpose

Displays remaining tiles in the wall and indicates end-of-wall thresholds.

## User Stories

- US-001: Wall setup and break
- US-009: Turn flow visibility

## Props

````typescript
interface WallCounterProps {
  remainingTiles: number;
  totalTiles: number;
  isDeadWall?: boolean; // true when drawing from dead wall
}
```text

## Behavior

- Shows “Remaining: X / Y”.
- If `remainingTiles` is low (e.g., <= 16), show warning state.
- If `isDeadWall` is true, show a “Dead Wall” badge.

## Visual Requirements

### Layout

```text
┌──────────────────────┐
│ Remaining: 64 / 152  │
│ Dead Wall (badge)    │
└──────────────────────┘
```text

### States

- **Normal**: Neutral text
- **Warning**: Yellow/orange when low
- **Critical**: Red when <= 8

## Related Components

- **Used by**: `<GameBoard>`, `<Wall>`
- **Uses**: shadcn/ui `<Badge>`, `<Card>`

## Implementation Notes

- Threshold values should be configurable via constants.
````
