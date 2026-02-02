# PassAnimationLayer

## Purpose

Visual layer that animates Charleston tile passing between players. Renders transient tile motion overlays without affecting game state.

## User Stories

- US-002: Charleston pass action

## Props

```typescript
interface PassAnimationLayerProps {
  isActive: boolean;
  passDirection: PassDirection;
  tiles: Tile[]; // tiles being passed (for local player or revealed pass)
  fromSeat: Seat;
  toSeat: Seat;
  durationMs?: number; // animation duration
  onComplete?: () => void;
}
```text

## Behavior

- When `isActive` becomes true, animate a tile group moving from `fromSeat` to `toSeat`.
- If `tiles` is empty, render placeholder backs (unknown tiles).
- On animation end, triggers `onComplete` if provided.
- Does not block input; purely visual overlay.

## Visual Requirements

### Layout

- Absolute overlay on top of game board.
- Tiles animate along a curved or straight path between seat anchors.

### Tile Rendering

- Use tile backs for hidden passes.
- Use tile faces for local player or revealed animations.

### Effects

- Motion blur or slight scaling for movement feel.
- Fade out at destination to hand-off to state update.

## Related Components

- **Used by**: `<GameBoard>`
- **Uses**: `<Tile>` or `<TileImage>` for rendering
- **Uses**: shadcn/ui `<Card>` only if a background plate is needed (optional)

## Implementation Notes

- Seat anchors should be derived from `GameBoard` layout refs.
- This component should be memoized; re-render only on animation triggers.
```
