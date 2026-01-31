# DiscardPile Component Specification

## Component Type

Presentational Component

## Purpose

Displays the central discard pile with recent discards, call-ability indicators, and discard history. Shows tiles face-up with highlighting for callable tiles (pung, kong, mahjong) and tracks which player discarded each tile.

## Related User Stories

- US-012: Call Window (highlight callable tiles)
- US-013: Claim Priority (show who can call)
- US-014: Discard Tiles (add to pile)
- US-015: Invalid Discard Prevention (visual feedback)
- US-019: Declare Mahjong (mahjong on discard highlighting)
- US-034: Spectator Features (view discard history)

## TypeScript Interface

```typescript
import { Tile } from '@/types/bindings/generated';

export interface DiscardPileProps {
  /** All discarded tiles in order */
  discards: Discard[];

  /** Currently callable tiles (indices in discards array) */
  callableIndices?: number[];

  /** Type of call available */
  callType?: 'pung' | 'kong' | 'mahjong' | null;

  /** Whether pile is interactive (can click to call) */
  interactive?: boolean;

  /** Callback when callable tile is clicked */
  onDiscardClick?: (discardIndex: number) => void;

  /** Layout variant */
  layout?: 'grid' | 'sequential' | 'compact';

  /** Maximum visible tiles (older tiles hidden) */
  maxVisible?: number;

  /** Whether to show player indicators */
  showPlayerIndicators?: boolean;

  /** Current player index (for relative positioning) */
  currentPlayerIndex?: number;

  /** Whether to animate new discards */
  animateDiscards?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export interface Discard {
  /** Tile that was discarded */
  tile: Tile;

  /** Player index who discarded (0-3) */
  playerIndex: number;

  /** Timestamp of discard */
  timestamp: number;

  /** Whether tile was called (claimed by another player) */
  wasCalled?: boolean;

  /** Type of call that claimed this tile */
  callType?: 'pung' | 'kong' | 'mahjong';

  /** Player who called this tile */
  calledBy?: number;
}
```

## Internal State

```typescript
interface DiscardPileState {
  /** Recently added discard index (for animation) */
  recentDiscardIndex: number | null;

  /** Hovered discard index */
  hoveredIndex: number | null;
}
```

## State Management

**Internal useState** for hover and animation states. Discards managed by parent component.

## Visual Design

### Layout Variants

#### Grid (Default)

- Tiles arranged in 4-wide grid
- Rows added as pile grows
- Most recent tile bottom-right
- Use for: Desktop, ample space

#### Sequential

- Tiles in single row, left-to-right
- Wraps to new row when width exceeded
- Most recent tile at end
- Use for: Mobile, horizontal emphasis

#### Compact

- Tiles slightly overlapped (30% overlap)
- Scrollable horizontally
- Most recent tile visible on right
- Use for: Sidebar, space-constrained

### Tile Display

- **Size**: 40px × 53px (slightly smaller than hand tiles)
- **Spacing**: `var(--space-2)` (8px) gap in grid/sequential
- **Overlap**: 30% in compact mode
- **Shadow**: `var(--shadow-sm)` for depth

### Callable Tile Highlighting

- **Border**: 2px solid for call type:
  - **Pung**: `var(--color-warning)` (#f59e0b) yellow
  - **Kong**: `var(--color-warning)` (#f59e0b) yellow
  - **Mahjong**: `var(--color-success)` (#10b981) green
- **Glow**: Pulsing box-shadow matching border color
- **Cursor**: pointer when interactive

### Called Tile Indicator

- **Gray overlay**: 50% opacity when tile was called
- **Label**: Small badge showing call type ("Pung", "Kong", "Mahjong")
- **Arrow**: Points to player who called

### Player Indicators

- **Color dots**: Seat color for each discarder
  - East: Red (#ef4444)
  - South: Green (#10b981)
  - West: Blue (#3b82f6)
  - North: Yellow (#f59e0b)
- **Position**: Small dot in top-left corner of tile
- **Tooltip**: Player name on hover

### Recent Discard Animation

- **Entrance**: Slide from center, 300ms ease-out
- **Flash**: Subtle white flash on entry
- **Scale**: Start at 1.2x, scale to 1.0x

### Pile Structure Visual

#### Grid Layout (4×N)

```text
[Tile 1] [Tile 2] [Tile 3] [Tile 4]
[Tile 5] [Tile 6] [Tile 7] [Tile 8]
[Tile 9] [Tile 10] [🟡Callable] [⭐Recent]
```

#### Sequential Layout

```text
[1] [2] [3] [4] [5] [6] [7] [8] [🟡9] [⭐10]
```

#### Compact Layout (Overlapped)

```text
[1]>[2]>[3]>[4]>[5]>[6]>[7]>[🟡8]>[⭐9]
```

## Accessibility

### ARIA Attributes

- `role="list"` for pile container
- `role="listitem"` for each discard
- `aria-label="Discard pile, {count} tiles"` for container
- `aria-label="{tileName}, discarded by {playerName}"` for each tile
- `aria-label="Callable for {callType}"` for callable tiles
- `aria-live="polite"` for new discards
- `aria-describedby` linking to call type explanation

### Keyboard Support

- **Tab**: Navigate to pile
- **Arrow Keys**: Move between tiles
- **Enter/Space**: Call selected tile (if callable)
- **Escape**: Cancel call selection

### Screen Reader Support

- Announce new discards: "{playerName} discarded {tileName}"
- Announce callable tiles: "{tileName} can be called for {callType}"
- Announce called tiles: "{tileName} was called by {playerName} for {callType}"
- Provide pile count: "{count} tiles in discard pile"

### Visual Accessibility

- High contrast for callable tiles
- Not relying on color alone (border + glow + cursor)
- Focus visible on keyboard navigation
- Sufficient spacing for touch targets
- Player indicators work without color (tooltips with names)

## Dependencies

### External

- React (hooks: `useState`, `useEffect`, `useCallback`)
- `clsx` for conditional class names

### Internal

- `@/components/game/TileImage` - Individual tile rendering
- `@/components/ui/Badge` - Call type badges
- `@/components/ui/Tooltip` - Player name tooltips
- `@/utils/tileUtils` - Tile naming and formatting
- `@/utils/seatColors` - Player seat color mapping
- `@/styles/discardPile.module.css` - Component styles

### Generated Types

- `@/types/bindings/generated/Tile.ts` - Tile type
- `@/types/bindings/generated/CallType.ts` - Call type enum

## Implementation Notes

### Determining Callable Tiles

```typescript
// Server determines callable tiles, frontend just displays
const isCallable = (index: number): boolean => {
  return callableIndices?.includes(index) ?? false;
};

const getCallTypeColor = (callType: CallType): string => {
  switch (callType) {
    case 'pung':
    case 'kong':
      return 'var(--color-warning)';
    case 'mahjong':
      return 'var(--color-success)';
    default:
      return 'var(--color-border)';
  }
};
```

### Animation Timing

```typescript
const handleNewDiscard = (newDiscard: Discard) => {
  const newIndex = discards.length - 1;
  setRecentDiscardIndex(newIndex);

  // Clear animation state after animation completes
  setTimeout(() => {
    setRecentDiscardIndex(null);
  }, 300);
};
```

### Limiting Visible Tiles

```typescript
// Show most recent N tiles only
const visibleDiscards = maxVisible ? discards.slice(-maxVisible) : discards;
```

### Player Indicator Positioning

```typescript
// Calculate relative player position (East, South, West, North)
const getPlayerLabel = (playerIndex: number, currentPlayerIndex: number): string => {
  const offset = (playerIndex - currentPlayerIndex + 4) % 4;
  return ['You', 'Right', 'Across', 'Left'][offset];
};
```

### Performance Optimizations

1. **Virtualization**: Only render visible tiles (use maxVisible)
2. **Memoization**: Memoize callable indices calculation
3. **CSS animations**: Use CSS transitions, not JavaScript
4. **Debounce hover**: Throttle hover state updates

## Test Scenarios

### Unit Tests

```typescript
describe('DiscardPile', () => {
  it('renders all discards correctly', () => {
    // discards.length should render correct number of tiles
  });

  it('highlights callable tiles', () => {
    // callableIndices should apply highlight styles
  });

  it('displays player indicators', () => {
    // showPlayerIndicators should show colored dots
  });

  it('applies layout variant', () => {
    // layout='grid' should use grid layout
  });

  it('limits visible tiles', () => {
    // maxVisible=10 should only show last 10 tiles
  });

  it('handles tile clicks', () => {
    // onDiscardClick should be called with correct index
  });

  it('shows called tile indicators', () => {
    // wasCalled should show badge and overlay
  });

  it('animates new discards', () => {
    // New discard should trigger animation
  });

  it('displays call type colors', () => {
    // callType should determine border color
  });
});
```

### Integration Tests

```typescript
describe('DiscardPile Integration', () => {
  it('integrates with call declarations', () => {
    // Clicking callable tile should trigger call flow
  });

  it('updates when new tiles discarded', () => {
    // discards prop change should re-render
  });

  it('announces to screen readers', () => {
    // aria-live should announce new discards
  });

  it('keyboard navigation works', () => {
    // Arrow keys should navigate between tiles
  });
});
```

### Visual Regression Tests

- All layout variants (grid, sequential, compact)
- Callable tile highlighting (pung, kong, mahjong)
- Player indicators (all 4 players)
- Called tile overlays
- Animation frames (entrance, flash)
- Hover states

## Usage Examples

### Basic Discard Pile

```tsx
import { DiscardPile } from '@/components/game/DiscardPile';

function GameDiscardPile({ gameState }) {
  return (
    <DiscardPile
      discards={gameState.discards}
      layout="grid"
      showPlayerIndicators
      animateDiscards
      currentPlayerIndex={gameState.currentPlayerIndex}
    />
  );
}
```

### Interactive with Call Window

```tsx
function InteractiveDiscardPile({ discards, callWindow, onCall }) {
  const handleDiscardClick = (index: number) => {
    if (callWindow) {
      onCall(discards[index]);
    }
  };

  return (
    <DiscardPile
      discards={discards}
      callableIndices={callWindow?.callableIndices}
      callType={callWindow?.callType}
      interactive
      onDiscardClick={handleDiscardClick}
    />
  );
}
```

### Compact Sidebar View

```tsx
function SidebarDiscardPile({ discards }) {
  return (
    <DiscardPile
      discards={discards}
      layout="compact"
      maxVisible={20}
      showPlayerIndicators={false}
    />
  );
}
```

### History View (All Discards)

```tsx
function DiscardHistory({ discards }) {
  return (
    <div>
      <h3>Discard History</h3>
      <DiscardPile
        discards={discards}
        layout="sequential"
        showPlayerIndicators
        interactive={false}
      />
    </div>
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.discard-pile {
  padding: var(--space-4);
  background: var(--color-background-secondary);
  border-radius: var(--radius-lg);
  min-height: 200px;
}

/* Layout variants */
.discard-pile--grid {
  display: grid;
  grid-template-columns: repeat(4, auto);
  gap: var(--space-2);
  justify-content: center;
  align-content: start;
}

.discard-pile--sequential {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-start;
}

.discard-pile--compact {
  display: flex;
  gap: calc(var(--space-2) * -1.5); /* Negative gap for overlap */
  overflow-x: auto;
  padding-bottom: var(--space-2);
}

/* Discard tile wrapper */
.discard-tile {
  position: relative;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  cursor: default;
}

.discard-tile--interactive {
  cursor: pointer;
}

.discard-tile--callable {
  box-shadow: 0 0 0 2px var(--call-color);
  animation: pulse-call 2s ease-in-out infinite;
  cursor: pointer;
}

.discard-tile--callable-pung,
.discard-tile--callable-kong {
  --call-color: var(--color-warning);
}

.discard-tile--callable-mahjong {
  --call-color: var(--color-success);
}

.discard-tile:hover:not(.discard-tile--called) {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
  z-index: 10;
}

/* Called tile overlay */
.discard-tile--called {
  opacity: 0.5;
  cursor: default;
}

.discard-tile--called::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-sm);
}

.call-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 2px 6px;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  box-shadow: var(--shadow-sm);
  z-index: 20;
}

/* Player indicator */
.player-indicator {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--player-color);
  border: 1px solid white;
  box-shadow: var(--shadow-sm);
  z-index: 10;
}

/* Player colors */
.player-indicator--east {
  --player-color: var(--color-seat-east);
}

.player-indicator--south {
  --player-color: var(--color-seat-south);
}

.player-indicator--west {
  --player-color: var(--color-seat-west);
}

.player-indicator--north {
  --player-color: var(--color-seat-north);
}

/* Recent discard animation */
.discard-tile--recent {
  animation: discard-entrance 300ms ease-out;
}

@keyframes discard-entrance {
  0% {
    opacity: 0;
    transform: scale(1.2) translateY(-20px);
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Callable pulse animation */
@keyframes pulse-call {
  0%,
  100% {
    box-shadow: 0 0 0 2px var(--call-color);
  }
  50% {
    box-shadow:
      0 0 0 4px var(--call-color),
      0 0 12px var(--call-color);
  }
}

/* Empty state */
.discard-pile--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-disabled);
  font-size: var(--text-sm);
  font-style: italic;
}

/* Responsive */
@media (max-width: 768px) {
  .discard-pile--grid {
    grid-template-columns: repeat(3, auto);
  }

  .discard-pile {
    padding: var(--space-2);
    min-height: 150px;
  }
}
```

## Future Enhancements

- [ ] Discard statistics (most discarded tile, player discard patterns)
- [ ] Filtering by player (show only one player's discards)
- [ ] Timeline view (horizontal scroll with timestamps)
- [ ] Discard prediction hints (dangerous tiles highlighted)
- [ ] Undo last discard (if allowed by game rules)
- [ ] Export discard history (text/image)
- [ ] Discard sound effects (tile click)
- [ ] 3D pile visualization (stacked tiles)
- [ ] Zoom on hover (for small tiles)
- [ ] Color-blind mode (different border patterns instead of colors)

## Notes

- Discard pile is central game element - must be always visible
- Callable highlighting is critical for UX (players often miss call opportunities)
- Recent discard animation helps players track game flow
- Player indicators essential for strategy (tracking opponent discards)
- Called tiles should remain visible but clearly marked as unavailable
- maxVisible prevents pile from growing too large (performance + UX)
- Grid layout most intuitive for American Mahjong (familiar to card players)
- Interactive mode only when call window active (prevent accidental clicks)
- Pile should scroll automatically to show most recent discard
- Compact mode useful for mobile and multi-window layouts
- Discard order matters for call priority (FIFO in most cases)
- Consider localStorage for discard history across page refreshes
- Animations should be disableable for users with motion sensitivity
- Touch targets must be large enough on mobile (min 44px)

```text

```
