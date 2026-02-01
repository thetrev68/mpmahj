# DiscardPile

## Purpose

Displays all discarded tiles for a player in a grid layout, with the most recent discard highlighted. During call windows, allows clicking the latest discard to initiate calls.

## User Stories

- US-010: Discard tile action - view all discards
- US-011: Call window - click discard to call
- US-019: End of hand - review discard history

## Props

````typescript
interface DiscardPileProps {
  /** Array of discarded tiles in chronological order */
  discards: TileData[];

  /** Player who owns this discard pile */
  playerId: string;
  playerSeat: PlayerSeat;

  /** Call window state */
  isCallWindowOpen?: boolean;
  onDiscardClick?: (tileIndex: number) => void;

  /** Display options */
  orientation?: 'horizontal' | 'vertical'; // Default: horizontal
  compact?: boolean; // Smaller tiles for opponents
  maxColumns?: number; // Default: 7
}
```text

## Behavior

### Discard Display

- Tiles in grid: left-to-right, top-to-bottom
- Latest discard highlighted with glow
- Default: 7 columns (traditional Mahjong layout)

### Call Window Interaction

When `isCallWindowOpen === true`:

- Latest discard becomes clickable
- Hover shows preview
- Click triggers `onDiscardClick`

### Empty State

- Show "No discards yet" placeholder

## Visual Requirements

### Layout

```text
┌─────────────────────────────────────────┐
│ [D1] [D2] [D3] [D4] [D5] [D6] [D7]     │
│ [D8] [D9] [D10*] (latest, highlighted) │
└─────────────────────────────────────────┘
```text

### Tile Sizing

- **Standard**: 40×53px
- **Compact**: 28×37px
- Gap: 4px between tiles

### Latest Discard States

- **Normal**: Yellow glow border
- **Callable**: Pulsing border, cursor: pointer
- **Hover**: Scale 105%, brighter glow

## Related Components

- **Uses**: `<Tile>`
- **Used by**: `<PlayerRack>`

## Implementation Notes

### Grid Layout

```typescript
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: `repeat(${maxColumns}, auto)`,
  gap: '4px',
};
```text

### Latest Discard Logic

```typescript
const latestIndex = discards.length - 1;
const isCallable = isCallWindowOpen;

function getTileState(index: number): TileState {
  if (index !== latestIndex) return 'default';
  if (isCallable) return 'callable';
  return 'latest';
}
```text

### Server Integration

```typescript
// Event from backend
interface TileDiscardedEvent {
  player: PlayerId;
  tile: TileData;
  index: number;
}

const handleTileDiscarded = (event: TileDiscardedEvent) => {
  setDiscards((prev) => [...prev, event.tile]);
};
```text

### Click Handling

```typescript
const handleClick = (index: number) => {
  if (!isCallWindowOpen) return;
  if (index !== latestIndex) return;
  onDiscardClick?.(index);
};
```text

## Accessibility

**ARIA**:

- Container: `role="list"` `aria-label="Discarded tiles for {seat}"`
- Each tile: `role="listitem"`
- Latest: `aria-label="{tile}, latest discard, click to call"`

**Keyboard**:

- Tab to focus latest (if callable)
- Enter/Space: Trigger call

## Example Usage

```tsx
// Current player's discards
<DiscardPile
  discards={myDiscards}
  playerId="player1"
  playerSeat="South"
  isCallWindowOpen={false}
  maxColumns={7}
/>

// Opponent's discards (call window open)
<DiscardPile
  discards={opponentDiscards}
  playerId="player3"
  playerSeat="North"
  isCallWindowOpen={true}
  onDiscardClick={handleCall}
  compact={true}
/>
```text

## Edge Cases

1. **Empty pile**: Show placeholder
2. **Many discards (>50)**: Consider virtualization
3. **Rapid discards**: Animations don't overlap
4. **Call window closes mid-hover**: Remove hover state gracefully

## Testing Considerations

- Empty pile renders placeholder
- Latest discard highlighted
- Call window enables click
- Non-latest tiles not clickable
- Grid layout wraps correctly

---

**Estimated Complexity**: Medium (~100 lines)
**Dependencies**: `<Tile>`, `useGameSocket`
**Phase**: Phase 1 - MVP Core (Critical)
````
