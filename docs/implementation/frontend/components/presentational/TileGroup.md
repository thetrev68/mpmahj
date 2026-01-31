# TileGroup Component Specification

## Component Type

Presentational Component

## Purpose

Displays a horizontal row of tiles with consistent spacing and layout. Used for hands, melds, discards, and tile collections throughout the game.

## Related User Stories

- US-003: View Own Hand (player's concealed tiles)
- US-005: View Exposed Melds (pung, kong, quint displays)
- US-006: View Discard Pile (discarded tiles)
- US-015: Charleston Tile Passing (selected tiles for passing)
- US-024: Observe Opponents (opponent hands and melds)

## TypeScript Interface

```typescript
export interface TileGroupProps {
  /** Array of tile indices (0-41) or null for empty slots */
  tiles: (number | null)[];

  /** Display orientation */
  orientation?: 'horizontal' | 'vertical' | 'stacked';

  /** Tile size variant */
  size?: 'small' | 'medium' | 'large';

  /** Tile display state */
  state?: 'concealed' | 'exposed' | 'facedown' | 'discarded';

  /** Selected tile indices for highlighting */
  selectedIndices?: number[];

  /** Whether tiles are interactive (clickable) */
  interactive?: boolean;

  /** Click handler for individual tiles */
  onTileClick?: (tileIndex: number, tile: number | null) => void;

  /** Hover handler for tile previews */
  onTileHover?: (tileIndex: number | null) => void;

  /** Gap between tiles */
  gap?: 'none' | 'small' | 'medium' | 'large';

  /** Maximum tiles per row (wraps to next row) */
  maxPerRow?: number;

  /** Sort tiles by suit or rank */
  sortBy?: 'suit' | 'rank' | 'none';

  /** Show tile numbers for learning mode */
  showNumbers?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** ARIA label for the group */
  ariaLabel?: string;
}
```

## State Management

**Stateless** - All state managed by parent components. Delegates tile interactions to TileImage components.

## Visual Design

### Orientation Variants

- **horizontal**: Standard left-to-right row (default)
- **vertical**: Top-to-bottom column (opponent displays)
- **stacked**: Overlapping tiles (kong display, space-saving)

### Size Variants

Inherits from TileImage component:

- **small**: 32×44px per tile (opponent hands, history)
- **medium**: 48×66px per tile (default, player hand)
- **large**: 64×88px per tile (selected tile preview)

### Gap Variants

- **none**: 0px - Tiles touch (stacked melds)
- **small**: 4px (`var(--space-1)`) - Tight grouping
- **medium**: 8px (`var(--space-2)`) - Default spacing
- **large**: 16px (`var(--space-4)`) - Loose grouping

### Display States

Passes state to child TileImage components:

- **concealed**: Face-up tiles in hand
- **exposed**: Horizontally oriented melds
- **facedown**: Opponent concealed tiles
- **discarded**: Slightly smaller, greyed out

### Layout Patterns

#### Standard Hand (14 tiles)

```text
[1B][2B][3B][4B][5B][6B][7B][8B][9B][1C][2C][3C][4C][5C]
```

#### Exposed Meld (Pung)

```text
[5D][5D][5D] (horizontal, slightly rotated)
```

#### Stacked Kong

```text
[7C][7C]  (front two tiles)
   [7C][7C]  (back two tiles stacked)
```

#### Wrapped Display (maxPerRow)

```text
Row 1: [1B][2B][3B][4B][5B][6B][7B]
Row 2: [8B][9B][1C][2C][3C][4C][5C]
```

### Visual Effects

- Hover (if interactive): Tiles elevate individually (handled by TileImage)
- Selection: Highlighted tiles have border/shadow
- Sorting: 300ms ease-in-out transition when tiles reorder
- Wrapping: Smooth reflow on container resize

## Accessibility

### ARIA Attributes

- `role="group"` for tile container
- `aria-label`: Descriptive label (e.g., "Player hand", "Exposed pung")
- `aria-roledescription="tile group"` for context
- Individual tiles handle their own ARIA (via TileImage)

### Keyboard Support

- `Tab`: Navigate into group (focus first tile)
- `Arrow Left/Right`: Navigate between tiles (horizontal)
- `Arrow Up/Down`: Navigate between tiles (vertical)
- `Home`: Focus first tile
- `End`: Focus last tile
- `Enter/Space`: Select focused tile (if interactive)

### Screen Reader Announcements

- On focus: "{aria-label}, {count} tiles"
- On navigation: "Tile {index} of {count}, {tile name}"
- On selection: "Selected {tile name}"

### Focus Management

- Roving tabindex: Only one tile focusable at a time
- Arrow key navigation within group
- Focus visible indicator on current tile

## Dependencies

### External

- React (hooks: `useMemo`, `useCallback`, `useState` for focus management)
- `clsx` for conditional class names

### Internal

- `@/components/tiles/TileImage` - Individual tile rendering
- `@/utils/tileFormatter` - `sortBySuit()`, `sortByRank()` functions
- `@/styles/tileGroup.module.css` - Component styles

### Generated Types

None - uses primitive types and TileImage component

## Implementation Notes

### Performance Optimizations

1. **Memoization**: Memoize sorted tile array to avoid re-sorting on every render
2. **Virtual scrolling**: For large groups (>50 tiles), use virtual scrolling
3. **Lazy rendering**: Only render visible tiles in wrapped/scrolled layouts
4. **Event delegation**: Single click handler on container, not per tile

### Sorting Logic

```typescript
const sortedTiles = useMemo(() => {
  if (sortBy === 'none') return tiles;

  const tilesWithIndices = tiles.map((tile, index) => ({ tile, index }));

  if (sortBy === 'suit') {
    return tilesWithIndices.sort((a, b) => compareBySuit(a.tile, b.tile)).map((item) => item.tile);
  }

  if (sortBy === 'rank') {
    return tilesWithIndices.sort((a, b) => compareByRank(a.tile, b.tile)).map((item) => item.tile);
  }

  return tiles;
}, [tiles, sortBy]);
```

### Error Handling

- Empty tiles array: Render empty container with placeholder message
- Invalid tile indices: Filter out, log warning in dev mode
- Negative maxPerRow: Ignore, render single row
- Null tiles: Render as empty slots maintaining layout

### Responsive Behavior

- Mobile: Reduce gap to 'small', size to 'small'
- Tablet: Default gap and size
- Desktop: Increase to 'large' size if space permits
- Wrapping: Auto-wrap on narrow containers when maxPerRow not set

## Test Scenarios

### Unit Tests

```typescript
describe('TileGroup', () => {
  it('renders correct number of tiles', () => {
    // tiles=[0,1,2] should render 3 TileImage components
  });

  it('applies orientation class', () => {
    // orientation='vertical' should apply vertical layout
  });

  it('applies size to child tiles', () => {
    // size='large' should pass to all TileImage components
  });

  it('applies state to child tiles', () => {
    // state='exposed' should pass to all tiles
  });

  it('highlights selected tiles', () => {
    // selectedIndices=[0,2] should highlight first and third tiles
  });

  it('calls onTileClick with correct indices', () => {
    // Clicking third tile should call with index=2
  });

  it('sorts tiles by suit', () => {
    // sortBy='suit' should group Bams, Craks, Dots
  });

  it('sorts tiles by rank', () => {
    // sortBy='rank' should group all 1s, 2s, etc.
  });

  it('applies gap spacing', () => {
    // gap='large' should apply 16px spacing
  });

  it('wraps tiles at maxPerRow', () => {
    // maxPerRow=7 should create rows of 7 tiles
  });

  it('handles null tiles gracefully', () => {
    // tiles=[0,null,2] should render with empty slot
  });

  it('does not call onClick when not interactive', () => {
    // interactive=false should not trigger handlers
  });
});
```

### Integration Tests

```typescript
describe('TileGroup Integration', () => {
  it('supports keyboard navigation', () => {
    // Arrow keys should move focus between tiles
  });

  it('maintains focus on tile reorder', () => {
    // Sorting should not lose focus
  });

  it('works with TileImage hover states', () => {
    // Hovering should trigger tile elevation
  });

  it('updates selection on click', () => {
    // Clicking should update parent state
  });
});
```

### Visual Regression Tests

- Horizontal, vertical, stacked orientations
- All size variants with different tile counts
- Selection highlights on multiple tiles
- Wrapped layout at different maxPerRow values
- Empty state with no tiles

## Usage Examples

### Player Hand Display

```tsx
import { TileGroup } from '@/components/game/TileGroup';

function PlayerHand({ hand, selectedIndices, onTileSelect }) {
  return (
    <TileGroup
      tiles={hand}
      orientation="horizontal"
      size="medium"
      state="concealed"
      selectedIndices={selectedIndices}
      interactive
      onTileClick={onTileSelect}
      sortBy="suit"
      gap="medium"
      ariaLabel="Your hand"
    />
  );
}
```

### Exposed Meld Display

```tsx
function ExposedMeld({ meld }) {
  return (
    <TileGroup
      tiles={meld.tiles}
      orientation={meld.type === 'kong' ? 'stacked' : 'horizontal'}
      size="medium"
      state="exposed"
      gap={meld.type === 'kong' ? 'none' : 'small'}
      ariaLabel={`Exposed ${meld.type}`}
    />
  );
}
```

### Opponent Hand (Concealed)

```tsx
function OpponentHand({ tileCount, seat }) {
  const facedDownTiles = Array(tileCount).fill(null);

  return (
    <TileGroup
      tiles={facedDownTiles}
      orientation="vertical"
      size="small"
      state="facedown"
      gap="small"
      ariaLabel={`${seat}'s concealed hand`}
    />
  );
}
```

### Discard Pile

```tsx
function DiscardPile({ discards }) {
  return (
    <TileGroup
      tiles={discards}
      orientation="horizontal"
      size="small"
      state="discarded"
      maxPerRow={10}
      gap="small"
      ariaLabel="Discard pile"
    />
  );
}
```

### Charleston Tile Selection

```tsx
function CharlestonSelector({ hand, selectedIndices, onSelect }) {
  return (
    <div className="charleston-selector">
      <p>Select 3 tiles to pass</p>
      <TileGroup
        tiles={hand}
        selectedIndices={selectedIndices}
        interactive
        onTileClick={onSelect}
        size="medium"
        gap="medium"
        ariaLabel="Select tiles for Charleston"
      />
    </div>
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.tile-group {
  display: flex;
  align-items: center;
  position: relative;
}

/* Orientation */
.tile-group--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
}

.tile-group--vertical {
  flex-direction: column;
}

.tile-group--stacked {
  flex-direction: row;
  position: relative;
}

.tile-group--stacked > * {
  margin-left: -1rem; /* Overlap tiles */
}

.tile-group--stacked > *:first-child {
  margin-left: 0;
}

/* Gap variants */
.tile-group--gap-none {
  gap: 0;
}

.tile-group--gap-small {
  gap: var(--space-1);
}

.tile-group--gap-medium {
  gap: var(--space-2);
}

.tile-group--gap-large {
  gap: var(--space-4);
}

/* Wrapping */
.tile-group--wrapped {
  flex-wrap: wrap;
  max-width: 100%;
}

/* Responsive */
@media (max-width: 768px) {
  .tile-group--horizontal {
    gap: var(--space-1);
  }
}
```

## Future Enhancements

- [ ] Drag-and-drop tile reordering
- [ ] Tile flip animation for reveal effects
- [ ] Grouping indicators (brackets around melds)
- [ ] Tile count badge for large groups
- [ ] Auto-collapse on narrow screens
- [ ] Smooth animation when tiles added/removed
- [ ] Virtual scrolling for 100+ tile displays
- [ ] Joker replacement preview overlay

## Notes

- Delegates all tile-specific rendering to TileImage component
- Maintains tile order unless sortBy specified
- Selection state managed by parent, displayed by this component
- Stacked orientation reduces visual clutter for kongs/quints
- Keyboard navigation follows visual order (left-to-right or top-to-bottom)
- Empty slots (null tiles) maintain spacing for consistent layout

```text

```
