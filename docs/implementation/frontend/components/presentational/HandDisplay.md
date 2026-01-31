# HandDisplay Component Specification

## Component Type

Presentational Component

## Purpose

Displays a player's hand of 14 tiles in a sortable, interactive layout. Manages tile selection, sorting, grouping by suit, and visual states (concealed, exposed, dead, won). Central component for player hand interaction.

## Related User Stories

- US-010: Deal Tiles (initial hand display)
- US-011: Draw Tiles (hand updates)
- US-014: Discard Tiles (tile selection)
- US-019: Declare Mahjong (winning hand display)
- US-022: Expose Meld (expose selection)
- US-025: Sort Hand (auto-sort, manual rearrangement)
- US-040: Joker Exchange (joker highlighting)
- All hand manipulation features

## TypeScript Interface

```typescript
import { Tile, TileSortMode } from '@/types/bindings/generated';

export interface HandDisplayProps {
  /** Array of tiles in hand (0-14 tiles) */
  tiles: Tile[];

  /** Whether this is the current player's hand */
  isCurrentPlayer?: boolean;

  /** Selected tile indices */
  selectedIndices?: number[];

  /** Callback when tile is clicked */
  onTileClick?: (tileIndex: number, tile: Tile) => void;

  /** Callback when tile selection changes */
  onSelectionChange?: (indices: number[]) => void;

  /** Sort mode */
  sortMode?: TileSortMode;

  /** Callback when sort mode changes */
  onSortModeChange?: (mode: TileSortMode) => void;

  /** Whether tiles should be concealed (opponent hand) */
  concealed?: boolean;

  /** Exposed melds (shown separately) */
  exposedMelds?: ExposedMeld[];

  /** Joker indices that can be exchanged */
  exchangeableJokers?: number[];

  /** Dead tiles (can't be used) */
  deadTiles?: number[];

  /** Whether drag-and-drop sorting is enabled */
  enableDragSort?: boolean;

  /** Maximum tiles selectable */
  maxSelection?: number;

  /** Highlight specific tiles (by index) */
  highlightIndices?: number[];

  /** Layout variant */
  layout?: 'horizontal' | 'compact' | 'vertical';

  /** Whether to show tile numbers (accessibility) */
  showTileNumbers?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export interface ExposedMeld {
  /** Meld ID */
  id: string;

  /** Meld type */
  type: 'pung' | 'kong' | 'quint' | 'sextet';

  /** Tiles in meld */
  tiles: Tile[];

  /** Source player (who discarded) */
  sourcePlayer?: number;
}
```

## Internal State

```typescript
interface HandDisplayState {
  /** Current sort mode */
  currentSortMode: TileSortMode;

  /** Drag state */
  dragState: {
    isDragging: boolean;
    draggedIndex: number | null;
    dropTargetIndex: number | null;
  };

  /** Selected indices */
  selectedIndices: Set<number>;
}
```

## State Management

**Internal useState** for drag-drop state and selection. Sort mode can be controlled or uncontrolled. Tiles managed by parent component.

## Visual Design

### Layout Variants

#### Horizontal (Default)

- Tiles arranged left-to-right
- Wraps to multiple rows on small screens
- Gap: `var(--space-2)` (8px) between tiles
- Use for: Current player's hand

#### Compact

- Tiles slightly overlapped (20% overlap)
- Single row, scrollable if needed
- Use for: Mobile, space-constrained views

#### Vertical

- Tiles arranged top-to-bottom
- Use for: Side panels, opponent hands (rare)

### Tile Display

- **Current player**: Standard size (48px × 64px)
- **Opponents**: Concealed (face-down), smaller (32px × 43px)
- **Selected**: Raised 8px, blue border (2px solid `var(--color-primary)`)
- **Exchangeable jokers**: Gold outline (2px solid `var(--color-joker-gold)` #fbbf24)
- **Dead tiles**: Red X overlay, 50% opacity
- **Highlighted**: Subtle glow (box-shadow)

### Exposed Melds Section

- Displayed above/below main hand
- Separated by divider line
- Each meld grouped together with label
- Tiles slightly smaller (40px × 53px)
- Stacked layout for Kong/Quint/Sextet

### Sorting Indicators

- Sort mode dropdown (top-right corner)
- Options: "Suit then rank", "Suit groups", "Optimal", "Manual"
- Active sort mode highlighted
- Visual grouping when sorted by suit (spacing between suits)

### Drag-and-Drop Visual Feedback

- **Dragging tile**: 50% opacity, raised shadow
- **Drop target**: Blue dashed border, background highlight
- **Invalid drop**: Red dashed border, shake animation
- **Cursor**: Grabbing cursor during drag

### State Overlays

- **Won hand**: Green checkmark overlay
- **Invalid for pattern**: Subtle red tint
- **Recently drawn**: Subtle glow for 2 seconds

## Accessibility

### ARIA Attributes

- `role="group"` for hand container
- `aria-label="Your hand, {count} tiles"` for container
- `aria-selected="true"` for selected tiles
- `aria-disabled="true"` for dead tiles
- `aria-label="Exposed melds"` for melds section
- `aria-describedby` linking to sort mode description

### Keyboard Support

- **Arrow Keys**: Navigate between tiles
- **Space**: Select/deselect focused tile
- **Shift + Arrow**: Multi-select tiles
- **S**: Cycle sort modes
- **D**: Discard selected tile (if applicable)
- **E**: Expose meld with selected tiles (if applicable)

### Screen Reader Support

- Announce tile count on hand changes
- Announce "Tile {name} selected" on selection
- Announce sort mode changes
- Announce "Joker can be exchanged" for exchangeable jokers
- Announce meld exposures
- Provide tile index and position ("Tile 3 of 14")

### Visual Accessibility

- High contrast for selected state
- Selection not indicated by color alone (border + raised position)
- Focus visible on keyboard navigation
- Drag handles visible and announced
- Color-blind friendly (not relying on suit colors alone)

## Dependencies

### External

- React (hooks: `useState`, `useCallback`, `useMemo`)
- React DnD or similar for drag-and-drop
- `clsx` for conditional class names

### Internal

- `@/components/game/TileImage` - Individual tile rendering
- `@/components/game/MeldDisplay` - Exposed meld display
- `@/components/ui/Select` - Sort mode dropdown
- `@/utils/tileSorting` - Tile sorting utilities
- `@/utils/tileUtils` - Tile metadata and indexing
- `@/styles/handDisplay.module.css` - Component styles

### Generated Types

- `@/types/bindings/generated/Tile.ts` - Tile type
- `@/types/bindings/generated/TileSortMode.ts` - Sort modes
- `@/types/bindings/generated/MeldType.ts` - Meld types

## Implementation Notes

### Tile Sorting Logic

```typescript
// Suit then rank: 1B, 2B, 3B, ..., 1C, 2C, ...
const sortBySuitThenRank = (tiles: Tile[]) => {
  return tiles.sort((a, b) => {
    if (a.suit !== b.suit) return a.suit - b.suit;
    return a.rank - b.rank;
  });
};

// Suit groups: All bams, all craks, all dots, flowers, jokers
const sortBySuitGroups = (tiles: Tile[]) => {
  const groups = { bam: [], crak: [], dot: [], flower: [], joker: [] };
  tiles.forEach((tile) => groups[tile.suit].push(tile));
  return [...groups.bam, ...groups.crak, ...groups.dot, ...groups.flower, ...groups.joker];
};

// Optimal: AI-suggested grouping for pattern matching
const sortOptimal = (tiles: Tile[], targetPatterns: Pattern[]) => {
  // Complex algorithm - group tiles to visualize pattern potential
  // See crates/mahjong_ai/src/sorting.rs for Rust implementation
};
```

### Multi-Selection Logic

```typescript
const handleTileClick = (index: number) => {
  const newSelection = new Set(selectedIndices);

  if (newSelection.has(index)) {
    newSelection.delete(index);
  } else if (maxSelection && newSelection.size >= maxSelection) {
    // Replace oldest selection
    const first = Array.from(newSelection)[0];
    newSelection.delete(first);
    newSelection.add(index);
  } else {
    newSelection.add(index);
  }

  onSelectionChange(Array.from(newSelection));
};
```

### Drag-and-Drop Manual Sorting

```typescript
const handleDrop = (draggedIndex: number, dropIndex: number) => {
  if (sortMode !== 'manual') return; // Only allow in manual mode

  const newTiles = [...tiles];
  const [draggedTile] = newTiles.splice(draggedIndex, 1);
  newTiles.splice(dropIndex, 0, draggedTile);

  onTilesReorder(newTiles);
};
```

### Joker Exchange Highlighting

```typescript
// Exchangeable jokers have special styling
const isExchangeableJoker = (index: number) => {
  return exchangeableJokers?.includes(index) ?? false;
};
```

### Performance Optimizations

1. **Virtualization**: For large hands (>20 tiles), use react-window
2. **Memoization**: Memoize sorted tile arrays
3. **Throttled drag updates**: Update drop target at most every 100ms
4. **CSS transforms**: Use transform for raised/dragging states (GPU accelerated)

## Test Scenarios

### Unit Tests

```typescript
describe('HandDisplay', () => {
  it('renders all tiles correctly', () => {
    // tiles.length should render correct number of TileImage components
  });

  it('handles tile selection', () => {
    // onTileClick should update selectedIndices
  });

  it('respects maxSelection limit', () => {
    // Should not select more than maxSelection tiles
  });

  it('sorts tiles by suit then rank', () => {
    // sortMode='suit-then-rank' should order tiles correctly
  });

  it('sorts tiles by suit groups', () => {
    // sortMode='suit-groups' should group all bams, then craks, etc.
  });

  it('conceals opponent tiles', () => {
    // concealed=true should render face-down tiles
  });

  it('highlights exchangeable jokers', () => {
    // exchangeableJokers indices should have gold outline
  });

  it('displays exposed melds separately', () => {
    // exposedMelds should render MeldDisplay components
  });

  it('handles drag-and-drop reordering', () => {
    // Drag-drop should reorder tiles in manual mode
  });

  it('marks dead tiles', () => {
    // deadTiles indices should have red X overlay
  });
});
```

### Integration Tests

```typescript
describe('HandDisplay Integration', () => {
  it('integrates with discard action', () => {
    // Selected tile should be discardable
  });

  it('integrates with meld exposure', () => {
    // Selected 3 tiles should form valid pung
  });

  it('integrates with joker exchange', () => {
    // Clicking exchangeable joker should trigger exchange flow
  });

  it('updates on tile draw', () => {
    // Hand should re-render when tiles prop changes
  });

  it('keyboard navigation works', () => {
    // Arrow keys should move focus between tiles
  });
});
```

### Visual Regression Tests

- All layout variants (horizontal, compact, vertical)
- All sort modes
- Selection states (0, 1, multiple tiles selected)
- Exchangeable jokers highlighting
- Exposed melds display
- Drag-and-drop visual feedback
- Concealed vs revealed hands

## Usage Examples

### Current Player Hand

```tsx
import { HandDisplay } from '@/components/game/HandDisplay';

function PlayerHand({ hand, onDiscard }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [sortMode, setSortMode] = useState<TileSortMode>('suit-then-rank');

  const handleTileClick = (index: number) => {
    setSelected([index]); // Single selection for discard
  };

  const handleDiscard = () => {
    if (selected.length === 1) {
      onDiscard(hand.tiles[selected[0]]);
    }
  };

  return (
    <div>
      <HandDisplay
        tiles={hand.tiles}
        isCurrentPlayer
        selectedIndices={selected}
        onTileClick={handleTileClick}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        exposedMelds={hand.exposedMelds}
        exchangeableJokers={hand.exchangeableJokers}
        enableDragSort
        maxSelection={1}
      />
      <Button onClick={handleDiscard} disabled={selected.length === 0}>
        Discard
      </Button>
    </div>
  );
}
```

### Opponent Hand (Concealed)

```tsx
function OpponentHand({ hand, playerPosition }) {
  return (
    <HandDisplay
      tiles={hand.tiles}
      concealed
      layout="compact"
      showTileNumbers={false}
      testId={`opponent-hand-${playerPosition}`}
    />
  );
}
```

### Meld Exposure Selection

```tsx
function MeldExposureHand({ hand }) {
  const [selected, setSelected] = useState<number[]>([]);

  const canExpose = selected.length === 3 && isValidPung(selected);

  return (
    <div>
      <HandDisplay
        tiles={hand.tiles}
        isCurrentPlayer
        selectedIndices={selected}
        onSelectionChange={setSelected}
        maxSelection={3}
      />
      <Button onClick={() => exposeMeld(selected)} disabled={!canExpose}>
        Expose Pung
      </Button>
    </div>
  );
}
```

### Joker Exchange

```tsx
function JokerExchangeHand({ hand, onExchange }) {
  const handleTileClick = (index: number) => {
    if (hand.exchangeableJokers?.includes(index)) {
      onExchange(index);
    }
  };

  return (
    <HandDisplay
      tiles={hand.tiles}
      isCurrentPlayer
      onTileClick={handleTileClick}
      exchangeableJokers={hand.exchangeableJokers}
      highlightIndices={hand.exchangeableJokers}
    />
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.hand-display {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
}

/* Layout variants */
.hand-display--horizontal .tiles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: center;
}

.hand-display--compact .tiles {
  display: flex;
  gap: calc(var(--space-2) * -1); /* Negative gap for overlap */
  overflow-x: auto;
}

.hand-display--vertical .tiles {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Tile wrapper */
.tile-wrapper {
  position: relative;
  transition: transform 0.2s ease;
  cursor: pointer;
}

.tile-wrapper:hover {
  transform: translateY(-4px);
}

.tile-wrapper--selected {
  transform: translateY(-8px);
  box-shadow: 0 0 0 2px var(--color-primary);
  border-radius: var(--radius-sm);
}

.tile-wrapper--exchangeable-joker {
  box-shadow: 0 0 0 2px var(--color-joker-gold);
  animation: pulse-gold 2s ease-in-out infinite;
}

.tile-wrapper--dead {
  opacity: 0.5;
  cursor: not-allowed;
}

.tile-wrapper--dead::after {
  content: '✕';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--color-error);
  font-size: 2rem;
  font-weight: bold;
}

.tile-wrapper--highlighted {
  box-shadow: 0 0 8px rgba(37, 99, 235, 0.5);
}

/* Dragging */
.tile-wrapper--dragging {
  opacity: 0.5;
  transform: scale(1.05);
  box-shadow: var(--shadow-lg);
  cursor: grabbing;
}

.tile-wrapper--drop-target {
  border: 2px dashed var(--color-primary);
  background: rgba(37, 99, 235, 0.1);
}

.tile-wrapper--invalid-drop {
  border: 2px dashed var(--color-error);
  animation: shake 0.3s ease;
}

/* Exposed melds */
.exposed-melds {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-2);
  border-top: 1px solid var(--color-border);
}

/* Sort controls */
.sort-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.sort-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

/* Animations */
@keyframes pulse-gold {
  0%,
  100% {
    box-shadow: 0 0 0 2px var(--color-joker-gold);
  }
  50% {
    box-shadow:
      0 0 0 4px var(--color-joker-gold),
      0 0 8px rgba(251, 191, 36, 0.5);
  }
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .hand-display {
    padding: var(--space-2);
  }

  .hand-display--horizontal .tiles {
    gap: var(--space-1);
  }
}
```

## Future Enhancements

- [ ] Tile hints/suggestions (green outline for recommended discards)
- [ ] Pattern visualization overlay (show which tiles fit pattern)
- [ ] Undo tile selection
- [ ] Tile history (recently drawn tiles highlighted)
- [ ] Animated tile draws and discards
- [ ] Touch gestures for mobile (swipe to sort, long-press to select)
- [ ] Voice control ("Select 3 Bam")
- [ ] Colorblind mode (suit symbols instead of colors)
- [ ] Hand strength indicator (progress to winning)
- [ ] Quick actions menu (right-click tile for options)

## Notes

- Hand display is the most frequently interacted component - performance critical
- Sort mode preference should persist across sessions (localStorage)
- Concealed opponent hands should not leak tile information (no data-\* attributes with tile values)
- Drag-and-drop only enabled in manual sort mode
- Exposed melds shown separately to avoid confusion with hand tiles
- Joker exchange highlighting critical for UX (users often miss this opportunity)
- Dead tiles (after exposing meld) cannot be selected
- maxSelection enforced to prevent invalid actions (can't discard 2 tiles at once)
- Layout should adapt to screen size (horizontal on desktop, compact on mobile)
- Keyboard navigation essential for accessibility and power users
- Selection state should clear when irrelevant (after discard, after meld exposure)
- Tile numbers (accessibility feature) should be toggleable per user preference

```

```
