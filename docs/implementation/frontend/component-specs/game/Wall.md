# Wall

## Purpose

Represents the Mahjong wall with a break indicator and draw position. Shows remaining stacks and current draw direction.

## User Stories

- US-001: Wall setup and break

## Props

````typescript
interface WallProps {
  totalTiles: number; // typically 152
  remainingTiles: number;
  breakIndex: number; // index where wall is broken
  drawIndex: number; // current draw position
  isVisible: boolean; // hide in compact/mobile view
}
```text

## Behavior

- Renders wall stacks with a visual break at `breakIndex`.
- Indicates current draw position with a marker.
- Updates as `remainingTiles` decreases.
- If `isVisible` is false, render a compact placeholder or nothing.

## Visual Requirements

### Layout

```text
┌───────────────────────────────────────────┐
│ [████████]  |break|  [███████████]       │
│            ^ draw                         │
└───────────────────────────────────────────┘
```text

- Wall shown as two segments separated by break marker.
- Draw marker below the active stack.

### Styles

- Wall stacks are neutral blocks (tile backs).
- Break marker is a contrasting line or gap.
- Draw marker is a small triangle or badge.

## Related Components

- **Used by**: `<GameBoard>` top area
- **Uses**: shadcn/ui `<Badge>` for draw marker

## Implementation Notes

- `breakIndex` and `drawIndex` are derived from server events; no local logic.
- Wall detail can be simplified for small screens (single bar + markers).
````
