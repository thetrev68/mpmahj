# WallCounter

## Purpose

Displays remaining tiles in the wall and indicates end-of-wall thresholds.

## User Stories

- US-001: Wall setup and break
- US-009: Turn flow visibility

## Props

```typescript
interface WallCounterProps {
  remainingTiles: number;
  totalTiles: number;
  isDeadWall?: boolean; // true when drawing from dead wall
}
```

## Behavior

- Shows “Remaining: X / Y”.
- If `remainingTiles` is low (e.g., <= 16), show warning state.
- If `isDeadWall` is true, show a “Dead Wall” badge.

## Visual Requirements (from UI-LAYOUT-SPEC)

### Position & Size

- **Position**: Top 60px, left 15px (below Game Menu)
- **Background**: `rgba(0,0,0,0.85)`
- **Padding**: 10px 20px
- **Font**: 14px bold
- **Text**: "Tiles Remaining: [count]"

### Layout

```text
┌─────────────────────────┐
│ Tiles Remaining: 64     │
│ Dead Wall (badge)       │
└─────────────────────────┘
```

### Color States

- **Safe (>40 tiles)**: `#4CAF50` (green)
- **Warning (20-40 tiles)**: `#ff9800` (orange)
- **Critical (<20 tiles)**: `#f44336` (red)

## Related Components

- **Used by**: `<GameBoard>`, `<Wall>`
- **Uses**: shadcn/ui `<Badge>`, `<Card>`

## Implementation Notes

- Threshold values should be configurable via constants.

```text

```
