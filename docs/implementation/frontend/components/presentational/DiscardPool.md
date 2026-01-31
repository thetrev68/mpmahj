# DiscardPool Component Specification

## 1. Overview

**Purpose**: Center table area showing all discarded tiles in chronological order. Displays the last discarded tile prominently with special styling during call windows.

**Category**: Presentational Component (Core Game Elements)

**Related Stories**: US-010 (Discarding a Tile), US-011 (Call Window), US-012 (Call Priority)

**Related Components**:

- `<Tile>` - Individual tile display
- `<CallWindowPanel>` - Call intent buttons overlay
- `<TileGroup>` - Group of tiles arrangement
- `<TurnIndicator>` - Shows whose turn it is

---

## 2. Core Functionality

### 2.1 Discard States

```typescript
type DiscardState = 'normal' | 'call-window' | 'called' | 'joker-discarded';
```

- **Normal**: Standard discarded tile (gray, small)
- **Call-window**: Active call window open (highlighted, pulsing)
- **Called**: Tile was called for meld (removed or marked)
- **Joker-discarded**: Joker discarded (no call window, special marker)

### 2.2 Layout Modes

```typescript
type DiscardPoolLayout = 'grid' | 'rows' | 'circular';
```

- **Grid**: 6 columns × N rows (traditional Mahjong table layout)
- **Rows**: Simple rows of tiles (chronological left-to-right, top-to-bottom)
- **Circular**: Tiles arranged in circle around center (decorative, less functional)

### 2.3 Last Discard Highlighting

The most recently discarded tile receives special treatment:

- **Position**: Separated from pool, centered and elevated
- **Size**: Larger than other tiles (96×128px vs 48×64px)
- **Animation**: Slide-in from player who discarded
- **Call Window**: Pulsing highlight if call window is open

---

## 3. Props Interface

```typescript
interface DiscardInfo {
  tile: number; // Tile index (0-41)
  seat: Seat; // East/South/West/North
  timestamp: number; // When discarded (for chronological order)
  isCalled?: boolean; // Was this tile called for a meld?
  isJoker?: boolean; // Is this a Joker tile?
}

interface DiscardPoolProps {
  // Data
  discards: DiscardInfo[]; // All discarded tiles
  lastDiscard: DiscardInfo | null; // Most recent discard
  callWindowOpen?: boolean; // Is call window currently active? (default: false)

  // Layout
  layout?: DiscardPoolLayout; // Default: 'grid'
  maxVisible?: number; // Max tiles to show (older tiles hidden) (default: 72)

  // Highlighting
  highlightLastDiscard?: boolean; // Emphasize last discard (default: true)
  showCalledTiles?: boolean; // Show called tiles with strikethrough (default: true)

  // Interaction
  onDiscardClick?: (discard: DiscardInfo) => void; // Click discard tile (history/review)
  interactive?: boolean; // Allow clicking tiles (default: false)

  // Accessibility
  ariaLabel?: string;

  // Styling
  className?: string;
  style?: React.CSSProperties;
}
```

---

## 4. Visual Design

### 4.1 Grid Layout (Default, 6 columns)

```
┌──────────────────────────────────────────┐
│  Discard Pool (72 tiles shown)          │
│                                          │
│  [2B] [5C] [W ] [6D] [3B] [9C]  Row 1   │
│  [4D] [N ] [7B] [1C] [5D] [8B]  Row 2   │
│  [3C] [6B] [9D] [2C] [4B] [7C]  Row 3   │
│  [1D] [8C] [5B] [3D] [6C] [9B]  Row 4   │
│  ... (more rows as tiles accumulate)     │
│                                          │
│         ╔═══════════╗                    │  Last discard
│         ║   [5D]    ║  ← Larger, elevated│  (separated)
│         ║  PULSING  ║     with glow      │
│         ╚═══════════╝                    │
│                                          │
│  [Call] [Kong] [Mahjong] [Pass]          │  Call window panel
└──────────────────────────────────────────┘
```

**Characteristics**:

- Grid: 6 tiles per row (matches traditional table)
- Tiles: 48×64px (medium size)
- Gap: 8px between tiles
- Called tiles: Marked with diagonal strikethrough or removed
- Last discard: Centered below grid, 96×128px (large)
- Call window: Shows buttons if `callWindowOpen=true`

### 4.2 Rows Layout (Chronological)

```
┌──────────────────────────────────────────┐
│  [2B] [5C] [W ] [6D] [3B] [9C] [4D] [N ] │  Row 1 (oldest)
│  [7B] [1C] [5D] [8B] [3C] [6B] [9D] [2C] │  Row 2
│  [4B] [7C] [1D] [8C] [5B] [3D] [6C] [9B] │  Row 3
│                                          │
│              [5D] ← Last discard         │  Separated
└──────────────────────────────────────────┘
```

**Characteristics**:

- Continuous flow (wraps to new row when full)
- Reading order: Left-to-right, top-to-bottom
- Easier to see discard timeline

### 4.3 Last Discard States

#### Normal State (No Call Window)

```
┌─────────┐
│         │
│   5D    │  Larger tile, centered
│         │  Gray border
└─────────┘
```

#### Call Window Active (Pulsing Highlight)

```
╔═════════╗
║  ┌───┐  ║
║  │ 5D│  ║  Pulsing amber glow
║  └───┘  ║  Enlarged tile
╚═════════╝
@keyframes callWindowPulse
```

#### Called (Tile Taken for Meld)

```
┌─────────┐
│  ╱   ╲  │
│ ╱ 5D  ╲ │  Strikethrough or faded
│ ╲     ╱ │  Indicates taken
│  ╲   ╱  │
└─────────┘
```

#### Joker Discarded (No Call Window)

```
┌─────────┐
│  🃏     │
│  JOKER  │  Red border, "No Call" badge
│   ⊘     │  Shows joker rule active
└─────────┘
```

---

## 5. Behavior Specifications

### 5.1 Discard Animation

```typescript
const animateDiscard = (tile: DiscardInfo) => {
  // 1. Tile slides from player's seat to center (800ms)
  const fromPosition = getSeatPosition(tile.seat);
  const toPosition = { x: 0, y: 0 }; // Center of discard pool

  // 2. Tile scales from normal (48×64px) to large (96×128px) (300ms)
  // 3. Previous last discard shrinks and moves to pool grid (300ms, overlaps)
  // 4. Settle with slight bounce (200ms)

  const timeline = gsap.timeline();

  timeline
    .fromTo(
      '.last-discard',
      { x: fromPosition.x, y: fromPosition.y, scale: 0.5 },
      { x: toPosition.x, y: toPosition.y, scale: 1, duration: 0.8, ease: 'power2.out' }
    )
    .to('.last-discard', { scale: 1.05, duration: 0.1, yoyo: true, repeat: 1 }); // Bounce

  // Move previous last discard to pool
  if (previousLastDiscard) {
    timeline.to(
      '.previous-last-discard',
      { scale: 0.5, opacity: 0.7, duration: 0.3 },
      '<' // Start at same time as scale
    );
  }
};
```

### 5.2 Call Window Pulse

```css
@keyframes callWindowPulse {
  0%,
  100% {
    box-shadow: 0 0 12px hsla(30, 80%, 50%, 0.6);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 24px hsla(30, 80%, 50%, 1);
    transform: scale(1.03);
  }
}

.last-discard--call-window {
  animation: callWindowPulse 1.5s ease-in-out infinite;
  border: 3px solid hsl(30, 80%, 50%); /* Amber */
}
```

### 5.3 Tile Removal (Called)

```typescript
const handleTileCalled = (tile: DiscardInfo) => {
  // 1. Mark tile as called in state
  setDiscards((prev) => prev.map((d) => (d === tile ? { ...d, isCalled: true } : d)));

  // 2. Animate tile removal (fade + shrink)
  gsap.to(`.discard-tile[data-index="${tile.tile}"]`, {
    opacity: 0,
    scale: 0.5,
    duration: 0.4,
    onComplete: () => {
      // 3. Optionally remove from DOM or show strikethrough
      if (!showCalledTiles) {
        // Remove entirely
        setDiscards((prev) => prev.filter((d) => d !== tile));
      }
    },
  });

  // 4. Clear last discard highlight
  setLastDiscard(null);
};
```

---

## 6. Accessibility

### 6.1 ARIA Attributes

```tsx
<div
  role="region"
  aria-label={ariaLabel || 'Discarded tiles'}
  aria-live={callWindowOpen ? 'assertive' : 'polite'}
  className="discard-pool"
>
  {/* Discard pool content */}
</div>;

{
  lastDiscard && (
    <div
      role="status"
      aria-label={`Last discard: ${formatTileName(lastDiscard.tile)} by ${lastDiscard.seat}`}
      aria-live={callWindowOpen ? 'assertive' : 'polite'}
    >
      <Tile tile={lastDiscard.tile} size="large" highlight={callWindowOpen ? 'called' : 'none'} />
    </div>
  );
}
```

### 6.2 Screen Reader Announcements

```typescript
useEffect(() => {
  if (!lastDiscard) return;

  const tileName = formatTileName(lastDiscard.tile);
  const seatName = lastDiscard.seat;

  let announcement = `${seatName} discarded ${tileName}`;

  if (lastDiscard.isJoker) {
    announcement += '. Joker discarded, no call window.';
  } else if (callWindowOpen) {
    announcement += '. Call window open.';
  }

  announceToScreenReader(announcement);
}, [lastDiscard, callWindowOpen]);
```

### 6.3 Keyboard Navigation

```tsx
// If interactive mode enabled, allow keyboard navigation through discards
{
  interactive &&
    discards.map((discard, index) => (
      <button
        key={`${discard.tile}-${discard.timestamp}`}
        onClick={() => onDiscardClick?.(discard)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onDiscardClick?.(discard);
          }
        }}
        tabIndex={0}
        aria-label={`Discard ${index + 1}: ${formatTileName(discard.tile)} by ${discard.seat}`}
      >
        <Tile tile={discard.tile} size="small" disabled={discard.isCalled} />
      </button>
    ));
}
```

---

## 7. Integration Points

### 7.1 Discard Tile (US-010)

```tsx
import { DiscardPool } from '@/components/presentational/DiscardPool';

<DiscardPool
  discards={gameState.discardPool}
  lastDiscard={gameState.lastDiscard}
  callWindowOpen={gameState.phase === 'Playing' && gameState.turnStage === 'CallWindow'}
  layout="grid"
  highlightLastDiscard={true}
  showCalledTiles={true}
  interactive={false}
/>;
```

### 7.2 Call Window Integration (US-011)

```tsx
<div className="game-center">
  <DiscardPool
    discards={discards}
    lastDiscard={lastDiscard}
    callWindowOpen={callWindowOpen}
    highlightLastDiscard={true}
  />

  {callWindowOpen && (
    <CallWindowPanel
      lastDiscard={lastDiscard}
      playerHand={myHand}
      onCallIntent={handleCallIntent}
      onPass={handlePass}
    />
  )}
</div>
```

### 7.3 History/Review Mode

```tsx
// Interactive discard pool for history review
<DiscardPool
  discards={historicalState.discardPool}
  lastDiscard={null} // No active last discard in history mode
  callWindowOpen={false}
  interactive={true}
  onDiscardClick={(discard) => {
    showDiscardDetails(discard); // Show which player, when, context
  }}
  ariaLabel="Historical discard pool"
/>
```

---

## 8. Styling (CSS Module)

```css
/* DiscardPool.module.css */

/* Container */
.discard-pool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-3);
  background: hsl(0, 0%, 98%);
  border: 2px solid hsl(0, 0%, 85%);
  border-radius: var(--border-radius-lg);
  min-height: 400px;
  position: relative;
}

/* Pool grid */
.discard-pool__grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr); /* 6 columns */
  gap: var(--spacing-2); /* 8px */
  max-width: 600px; /* 6 tiles × 88px (tile + gap) */
}

.discard-pool__grid--rows {
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  max-width: 100%;
}

/* Individual discard tile */
.discard-tile {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.discard-tile--called {
  opacity: 0.4;
  position: relative;
}

.discard-tile--called::after {
  content: '';
  position: absolute;
  top: 50%;
  left: -10%;
  width: 120%;
  height: 2px;
  background: hsl(0, 70%, 50%); /* Red strikethrough */
  transform: rotate(-45deg);
}

.discard-tile--interactive {
  cursor: pointer;
}

.discard-tile--interactive:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.discard-tile--interactive:focus {
  outline: 3px solid hsl(210, 70%, 50%);
  outline-offset: 2px;
}

/* Last discard container */
.last-discard-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  border-top: 2px dashed hsl(0, 0%, 80%);
  width: 100%;
}

.last-discard {
  position: relative;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

/* Last discard - call window active */
.last-discard--call-window {
  animation: callWindowPulse 1.5s ease-in-out infinite;
  border: 3px solid hsl(30, 80%, 50%);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-2);
}

@keyframes callWindowPulse {
  0%,
  100% {
    box-shadow: 0 0 12px hsla(30, 80%, 50%, 0.6);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 24px hsla(30, 80%, 50%, 1);
    transform: scale(1.03);
  }
}

/* Joker discard special styling */
.last-discard--joker {
  border: 3px solid hsl(0, 70%, 50%); /* Red */
  position: relative;
}

.last-discard--joker::after {
  content: 'No Call';
  position: absolute;
  top: -12px;
  right: -12px;
  background: hsl(0, 70%, 50%);
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--border-radius-sm);
  text-transform: uppercase;
}

/* Empty state */
.discard-pool__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: hsl(0, 0%, 60%);
  font-style: italic;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .discard-pool__grid {
    grid-template-columns: repeat(4, 1fr); /* 4 columns on mobile */
    gap: var(--spacing-1);
  }

  .last-discard-container {
    padding: var(--spacing-2);
  }

  .discard-pool {
    min-height: 300px;
    padding: var(--spacing-2);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .last-discard--call-window {
    animation: none;
    box-shadow: 0 0 16px hsla(30, 80%, 50%, 0.8);
  }

  .discard-tile {
    transition: none;
  }
}
```

---

## 9. Testing Requirements

### 9.1 Unit Tests

```typescript
describe('DiscardPool', () => {
  const mockDiscards: DiscardInfo[] = [
    { tile: 0, seat: Seat.East, timestamp: 1000, isCalled: false },
    { tile: 10, seat: Seat.South, timestamp: 2000, isCalled: false },
    { tile: 20, seat: Seat.West, timestamp: 3000, isCalled: true },
  ];

  test('renders all discarded tiles', () => {
    render(<DiscardPool discards={mockDiscards} lastDiscard={null} />);

    expect(screen.getAllByRole('img')).toHaveLength(3); // Assuming Tile renders as img
  });

  test('highlights last discard when provided', () => {
    const lastDiscard = { tile: 15, seat: Seat.North, timestamp: 4000 };

    render(<DiscardPool discards={mockDiscards} lastDiscard={lastDiscard} />);

    const lastDiscardElement = screen.getByLabelText(/Last discard/);
    expect(lastDiscardElement).toBeInTheDocument();
  });

  test('applies call window styling when active', () => {
    const lastDiscard = { tile: 15, seat: Seat.North, timestamp: 4000 };

    const { container } = render(
      <DiscardPool discards={mockDiscards} lastDiscard={lastDiscard} callWindowOpen={true} />
    );

    const lastDiscardElement = container.querySelector('.last-discard--call-window');
    expect(lastDiscardElement).toBeInTheDocument();
  });

  test('marks called tiles with strikethrough', () => {
    const { container } = render(<DiscardPool discards={mockDiscards} lastDiscard={null} showCalledTiles={true} />);

    const calledTiles = container.querySelectorAll('.discard-tile--called');
    expect(calledTiles).toHaveLength(1); // Only one tile has isCalled=true
  });

  test('hides called tiles when showCalledTiles is false', () => {
    const { container } = render(<DiscardPool discards={mockDiscards} lastDiscard={null} showCalledTiles={false} />);

    // Should only show 2 tiles (third is called and hidden)
    expect(container.querySelectorAll('.discard-tile')).toHaveLength(2);
  });

  test('applies grid layout by default', () => {
    const { container } = render(<DiscardPool discards={mockDiscards} lastDiscard={null} />);

    expect(container.querySelector('.discard-pool__grid')).toBeInTheDocument();
    expect(container.querySelector('.discard-pool__grid')).not.toHaveClass('discard-pool__grid--rows');
  });

  test('applies rows layout when specified', () => {
    const { container } = render(<DiscardPool discards={mockDiscards} lastDiscard={null} layout="rows" />);

    expect(container.querySelector('.discard-pool__grid--rows')).toBeInTheDocument();
  });

  test('limits visible tiles to maxVisible', () => {
    const manyDiscards = Array.from({ length: 100 }, (_, i) => ({
      tile: i % 42,
      seat: Seat.East,
      timestamp: i * 1000,
    }));

    const { container } = render(<DiscardPool discards={manyDiscards} lastDiscard={null} maxVisible={50} />);

    // Should only show 50 tiles (most recent)
    expect(container.querySelectorAll('.discard-tile')).toHaveLength(50);
  });

  test('handles empty discard pool', () => {
    render(<DiscardPool discards={[]} lastDiscard={null} />);

    expect(screen.getByText(/no tiles/i)).toBeInTheDocument(); // Empty state message
  });

  test('calls onDiscardClick when tile clicked in interactive mode', () => {
    const handleClick = vi.fn();

    render(
      <DiscardPool
        discards={mockDiscards}
        lastDiscard={null}
        interactive={true}
        onDiscardClick={handleClick}
      />
    );

    const firstTile = screen.getAllByRole('button')[0];
    fireEvent.click(firstTile);

    expect(handleClick).toHaveBeenCalledWith(mockDiscards[0]);
  });

  test('does not allow clicking tiles when not interactive', () => {
    const handleClick = vi.fn();

    const { container } = render(
      <DiscardPool
        discards={mockDiscards}
        lastDiscard={null}
        interactive={false}
        onDiscardClick={handleClick}
      />
    );

    const tiles = container.querySelectorAll('.discard-tile');
    expect(tiles[0]).not.toHaveClass('discard-tile--interactive');
  });

  test('applies joker styling to joker last discard', () => {
    const jokerDiscard = { tile: 41, seat: Seat.East, timestamp: 5000, isJoker: true }; // Tile 41 = Joker

    const { container } = render(<DiscardPool discards={[]} lastDiscard={jokerDiscard} />);

    expect(container.querySelector('.last-discard--joker')).toBeInTheDocument();
  });
});
```

### 9.2 Integration Tests

```typescript
describe('DiscardPool Integration', () => {
  test('updates when new tile discarded', () => {
    const { rerender } = render(<DiscardPool discards={[]} lastDiscard={null} />);

    const newDiscard = { tile: 5, seat: Seat.East, timestamp: 1000 };

    rerender(<DiscardPool discards={[newDiscard]} lastDiscard={newDiscard} />);

    expect(screen.getByLabelText(/Last discard/)).toBeInTheDocument();
  });

  test('moves last discard to pool when new discard arrives', async () => {
    const firstDiscard = { tile: 5, seat: Seat.East, timestamp: 1000 };
    const { rerender } = render(<DiscardPool discards={[]} lastDiscard={firstDiscard} />);

    const secondDiscard = { tile: 10, seat: Seat.South, timestamp: 2000 };

    rerender(<DiscardPool discards={[firstDiscard]} lastDiscard={secondDiscard} />);

    // First discard should now be in pool
    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(2); // Both discards visible
    });
  });

  test('call window opens and closes correctly', () => {
    const lastDiscard = { tile: 15, seat: Seat.North, timestamp: 3000 };

    const { rerender, container } = render(
      <DiscardPool discards={[]} lastDiscard={lastDiscard} callWindowOpen={false} />
    );

    expect(container.querySelector('.last-discard--call-window')).not.toBeInTheDocument();

    rerender(<DiscardPool discards={[]} lastDiscard={lastDiscard} callWindowOpen={true} />);

    expect(container.querySelector('.last-discard--call-window')).toBeInTheDocument();
  });

  test('tile removed when called', () => {
    const discards = [
      { tile: 5, seat: Seat.East, timestamp: 1000, isCalled: false },
      { tile: 10, seat: Seat.South, timestamp: 2000, isCalled: false },
    ];

    const { rerender, container } = render(
      <DiscardPool discards={discards} lastDiscard={null} showCalledTiles={false} />
    );

    expect(container.querySelectorAll('.discard-tile')).toHaveLength(2);

    // Mark second tile as called
    const updatedDiscards = [
      { tile: 5, seat: Seat.East, timestamp: 1000, isCalled: false },
      { tile: 10, seat: Seat.South, timestamp: 2000, isCalled: true },
    ];

    rerender(<DiscardPool discards={updatedDiscards} lastDiscard={null} showCalledTiles={false} />);

    // Should only show 1 tile now
    expect(container.querySelectorAll('.discard-tile')).toHaveLength(1);
  });
});
```

### 9.3 Visual Regression Tests

```typescript
describe('DiscardPool Visual Regression', () => {
  test('empty pool matches snapshot', () => {
    const { container } = render(<DiscardPool discards={[]} lastDiscard={null} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('grid layout with multiple tiles matches snapshot', () => {
    const discards = Array.from({ length: 18 }, (_, i) => ({
      tile: i,
      seat: Seat.East,
      timestamp: i * 1000,
    }));

    const { container } = render(<DiscardPool discards={discards} lastDiscard={null} layout="grid" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('last discard with call window matches snapshot', () => {
    const lastDiscard = { tile: 15, seat: Seat.North, timestamp: 5000 };

    const { container } = render(
      <DiscardPool discards={[]} lastDiscard={lastDiscard} callWindowOpen={true} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('joker last discard matches snapshot', () => {
    const jokerDiscard = { tile: 41, seat: Seat.East, timestamp: 6000, isJoker: true };

    const { container } = render(<DiscardPool discards={[]} lastDiscard={jokerDiscard} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('called tiles with strikethrough matches snapshot', () => {
    const discards = [
      { tile: 5, seat: Seat.East, timestamp: 1000, isCalled: false },
      { tile: 10, seat: Seat.South, timestamp: 2000, isCalled: true },
      { tile: 15, seat: Seat.West, timestamp: 3000, isCalled: false },
    ];

    const { container } = render(<DiscardPool discards={discards} lastDiscard={null} showCalledTiles={true} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
```

---

## 10. Performance Considerations

### 10.1 Virtualization for Large Pools

```typescript
import { FixedSizeGrid } from 'react-window';

// Only render visible tiles for large discard pools (100+ tiles)
const VirtualizedDiscardPool = ({ discards, ...props }: DiscardPoolProps) => {
  if (discards.length < 100) {
    return <DiscardPool discards={discards} {...props} />;
  }

  const TILE_SIZE = 56; // Tile + gap
  const COLUMNS = 6;
  const rows = Math.ceil(discards.length / COLUMNS);

  return (
    <FixedSizeGrid
      columnCount={COLUMNS}
      columnWidth={TILE_SIZE}
      height={400}
      rowCount={rows}
      rowHeight={TILE_SIZE}
      width={TILE_SIZE * COLUMNS}
    >
      {({ columnIndex, rowIndex, style }) => {
        const index = rowIndex * COLUMNS + columnIndex;
        if (index >= discards.length) return null;

        return (
          <div style={style}>
            <Tile tile={discards[index].tile} size="small" />
          </div>
        );
      }}
    </FixedSizeGrid>
  );
};
```

### 10.2 Memoization

```typescript
const DiscardPool = React.memo<DiscardPoolProps>(
  ({ discards, lastDiscard, callWindowOpen /* ... */ }) => {
    // Component implementation
  },
  (prevProps, nextProps) => {
    return (
      prevProps.discards === nextProps.discards &&
      prevProps.lastDiscard === nextProps.lastDiscard &&
      prevProps.callWindowOpen === nextProps.callWindowOpen
    );
  }
);
```

### 10.3 Animation Performance

```typescript
// Use GPU-accelerated properties for discard animations
const animateDiscard = (tile: DiscardInfo) => {
  gsap.to('.discard-tile', {
    x: targetX,
    y: targetY,
    scale: targetScale,
    opacity: 1,
    duration: 0.8,
    ease: 'power2.out',
    force3D: true, // Enable GPU acceleration
  });
};
```

---

## 11. Related Documentation

- **User Stories**: [US-010](../user-stories/US-010-discarding-a-tile.md), [US-011](../user-stories/US-011-call-window-intent-buffering.md), [US-012](../user-stories/US-012-call-priority-resolution.md)
- **Design System**: [GameDesignDocument-Section-1-Visual-Layout.md](../GameDesignDocument-Section-1-Visual-Layout.md)
- **Related Components**: `<Tile>`, `<CallWindowPanel>`, `<TileGroup>`
- **Architecture**: Server maintains authoritative discard pool state

---

## 12. Notes for Implementers

1. **Server Authority**: Discard pool state is maintained by backend. Frontend renders based on received events (`TileDiscarded`, `TileCalled`, etc.).

2. **Animation Timing**: Coordinate discard animation with sound effects (`useSoundEffects()` hook) for satisfying feedback.

3. **Call Window Integration**: DiscardPool and CallWindowPanel work together. DiscardPool highlights last discard, CallWindowPanel shows action buttons.

4. **Joker Rule**: When Joker discarded, no call window opens (US-010). Show special "No Call" indicator on last discard.

5. **History Mode**: In history/replay mode, make discard pool interactive (`interactive=true`) to allow reviewing past discards.

6. **Mobile Optimization**: Reduce grid columns to 4 on mobile. Consider collapsible discard pool to save screen space.

7. **Accessibility**: Ensure last discard announcement is assertive (`aria-live="assertive"`) during call window for timely player notification.

8. **Performance**: For games with 100+ discards, use virtualization or pagination. Most games won't exceed 72 discards (half the wall).

9. **Testing**: Test call window opening/closing, tile called removal, and discard animations. Verify accessibility announcements work correctly.

10. **Future Enhancements**:
    - Discard pattern analysis (which tiles discarded most frequently)
    - Filter by seat (show only one player's discards)
    - Hover tooltip showing discard context (turn number, game phase)
    - Export discard history for post-game analysis
