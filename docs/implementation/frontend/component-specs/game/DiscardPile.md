# DiscardPile

## Purpose

Displays all discarded tiles for a player in a grid layout, with the most recent discard highlighted. During call windows, allows clicking the latest discard to initiate calls.

## User Stories

- US-010: Discard tile action - view all discards
- US-011: Call window - click discard to call
- US-019: End of hand - review discard history

## Props

```typescript
interface DiscardPileProps {
  /** Array of discarded tiles in chronological order */
  discards: Tile[];

  /** Player who owns this discard pile */
  playerId: string;
  playerSeat: Seat;

  /** Call window state */
  isCallWindowOpen?: boolean;
  onDiscardClick?: (tileIndex: number) => void;

  /** Display options */
  orientation?: 'horizontal' | 'vertical'; // Default: horizontal
  compact?: boolean; // Smaller tiles for opponents
  maxColumns?: number; // Default: 7
}
```

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

### Position & Size (Central Discard Floor from UI-LAYOUT-SPEC)

- **Location**: Absolute center of table (50% × 50%, transform: translate(-50%, -50%))
- **Dimensions**: 40% of table width × 40% of table height
- **Background**: `rgba(0,0,0,0.15)` (semi-transparent dark overlay)
- **Border radius**: 8px
- **Padding**: 15px
- **Overflow**: Scrollable if too many tiles

### Layout

```text
┌─────────────────────────────────────────┐
│ [D1] [D2] [D3] [D4] [D5] [D6] [D7]     │
│ [D8] [D9] [D10*] (latest, highlighted) │
│ (wraps to multiple rows, vertical scroll)│
└─────────────────────────────────────────┘
```

### Tile Sizing

- **Size**: 32px × 46px (7:10 aspect ratio, matches SVG viewBox)
- **Gap**: 6px between tiles
- **Layout**: Flex wrap, starts at top-left (align-content: flex-start)
- **Tile rotation**: Random slight rotation (-5° to +5°) via CSS variable `--rotation` for visual variety

### Discarded Tile Appearance

- **Base style**: Light gradient background via CSS (`#f5f5f5` to `#e0e0e0`), subtle border
- **Recent tile**: Gold border (2px) + gold glow shadow
- **Callable tile**: Pulsing border, cursor: pointer
- **Hover effect**: Lift 2px + shadow increase

## Related Components

- **Uses**: `<Tile>`
- **Used by**: `<PlayerRack>`

## Implementation Notes

### Layout Implementation

```typescript
const discardFloorStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '40%',
  height: '40%',
  background: 'rgba(0,0,0,0.15)',
  borderRadius: '8px',
  padding: '15px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  alignContent: 'flex-start',
  overflowY: 'auto',
};

// Apply random rotation to each tile
const tileStyle = {
  width: '32px',
  height: '46px',
  transform: `rotate(${Math.random() * 10 - 5}deg)`,
};
```

### Latest Discard Logic

```typescript
const latestIndex = discards.length - 1;
const isCallable = isCallWindowOpen;

function getTileState(index: number): TileState {
  if (index !== latestIndex) return 'default';
  if (isCallable) return 'callable';
  return 'latest';
}
```

### Server Integration

```typescript
// Event from backend
// PublicEvent::TileDiscarded { player, tile }
```

### Click Handling

```typescript
const handleClick = (index: number) => {
  if (!isCallWindowOpen) return;
  if (index !== latestIndex) return;
  onDiscardClick?.(index);
};
```

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
```

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
