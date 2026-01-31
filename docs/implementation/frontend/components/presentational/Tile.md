# Tile Component Specification

## 1. Overview

The `<Tile>` component is the fundamental building block of the American Mahjong game, representing a single tile with various display states and interactions. This component handles tile face/back display, suit/rank rendering, rotation, selection states, and interactive behaviors like dragging and clicking.

**Component Type**: Presentational  
**Complexity**: Medium  
**Related Components**: `<TileGroup>`, `<HandDisplay>`, `<DiscardPile>`, `<MeldDisplay>`

## 2. TypeScript Interface

```typescript
import { Tile as TileData } from '@/types/bindings/generated/Tile';

export interface TileProps {
  /** Tile data from backend (index, suit, rank, isJoker, isBlank) */
  tile: TileData;

  /** Display orientation (0, 90, 180, 270 degrees) */
  rotation?: 0 | 90 | 180 | 270;

  /** Whether tile shows face or back */
  faceUp?: boolean;

  /** Whether tile is selected (highlighted border) */
  selected?: boolean;

  /** Whether tile is disabled (grayed out, no interaction) */
  disabled?: boolean;

  /** Whether tile is being dragged */
  dragging?: boolean;

  /** Whether tile can be selected (shows hover state) */
  selectable?: boolean;

  /** Whether tile can be dragged */
  draggable?: boolean;

  /** Visual size variant */
  size?: 'small' | 'medium' | 'large';

  /** Highlight variant for special states */
  highlight?: 'exchangeable' | 'winning' | 'error' | 'called' | 'none';

  /** Visual emphasis for called tile in meld (rotated 90°, colored border) */
  calledTile?: boolean;

  /** Click handler for tile selection */
  onClick?: (tile: TileData) => void;

  /** Drag start handler */
  onDragStart?: (tile: TileData, event: React.DragEvent<HTMLDivElement>) => void;

  /** Drag end handler */
  onDragEnd?: (tile: TileData, event: React.DragEvent<HTMLDivElement>) => void;

  /** Hover enter handler */
  onMouseEnter?: (tile: TileData) => void;

  /** Hover leave handler */
  onMouseLeave?: (tile: TileData) => void;

  /** ARIA label override (auto-generated if not provided) */
  ariaLabel?: string;

  /** Additional CSS classes */
  className?: string;

  /** Test ID for component testing */
  testId?: string;
}

/** Tile data structure from backend */
export interface Tile {
  /** Tile index (0-41) */
  index: number;

  /** Suit name (Bam, Crak, Dot, Wind, Dragon, Flower, Joker) */
  suit: string;

  /** Rank within suit (1-9 for suited, N/E/S/W for winds, etc.) */
  rank: string;

  /** Whether this is a Joker tile */
  isJoker: boolean;

  /** Whether this is a blank tile (for blank exchange) */
  isBlank: boolean;
}
```

## 3. Component Behavior

### 3.1 Display States

#### Face-Up Display

- Shows tile face with suit symbol and rank number/character
- Bams: Bamboo stick pattern (1-9)
- Craks: Chinese character pattern (1-9)
- Dots: Circular dot pattern (1-9)
- Winds: N/E/S/W character
- Dragons: Red/Green/White symbol
- Flowers: Flower symbol (1-8)
- Jokers: "JOKER" text or joker symbol
- Background color by suit: Bams (green tint), Craks (red tint), Dots (blue tint)
- Honors (Winds/Dragons): White background with colored symbol
- Flowers: Decorative background with flower icon
- Jokers: Gold/yellow background with "★" or "JKR" text

#### Face-Down Display

- Shows generic tile back with pattern
- Uniform green/blue pattern (traditional Mahjong back)
- No interactive states when face-down (except for dragging in Charleston blind pass)

### 3.2 Size Variants

| Size     | Dimensions (W × H) | Font Size | Use Case                          |
| -------- | ------------------ | --------- | --------------------------------- |
| `small`  | 32px × 44px        | 10px      | Discard pile, other players       |
| `medium` | 48px × 64px        | 14px      | Current player hand, melds        |
| `large`  | 64px × 88px        | 18px      | Tile selection dialogs, tutorials |

All sizes maintain 2:3 aspect ratio (width:height).

### 3.3 Rotation

Tile can be rotated in 90° increments:

- `0°`: Default upright (portrait orientation)
- `90°`: Rotated clockwise (landscape right)
- `180°`: Upside down (portrait inverted)
- `270°`: Rotated counter-clockwise (landscape left)

Rotation uses CSS `transform: rotate()` with transform-origin at center.

Called tiles in melds are displayed at 90° rotation with visual emphasis.

### 3.4 Highlight States

| Highlight      | Visual Effect                    | Use Case                            |
| -------------- | -------------------------------- | ----------------------------------- |
| `none`         | No highlight                     | Default state                       |
| `exchangeable` | Pulsing amber border             | Joker can be exchanged              |
| `winning`      | Green glow border                | Part of winning hand                |
| `error`        | Red border                       | Invalid selection or dead hand tile |
| `called`       | Blue thick border + 90° rotation | Called tile in exposed meld         |

Highlights stack with selection and hover states.

### 3.5 Interactive States

#### Selectable Tiles

- Cursor: `pointer`
- Hover: Lift effect (translateY -4px, shadow increase)
- Active/Click: Brief scale down (0.95) then return
- Keyboard: Tab to focus, Space/Enter to select

#### Selected Tiles

- Blue border (3px solid)
- Slightly elevated (translateY -8px)
- Increased shadow (--shadow-md)
- Checkmark icon in top-right corner (optional, for clarity)

#### Disabled Tiles

- Opacity: 0.5
- Grayscale filter
- Cursor: `not-allowed`
- No hover or click effects

#### Draggable Tiles

- Cursor: `grab` (normal), `grabbing` (dragging)
- On drag start: Ghost image shows tile
- On drag: Original tile opacity 0.4
- On drag end: Restore opacity, trigger callback

### 3.6 Animation & Transitions

All state transitions are smooth:

- Transform (rotation, scale, position): 200ms ease-out
- Border color: 150ms ease-in-out
- Shadow: 150ms ease-out
- Opacity: 200ms ease-in-out

Respect `prefers-reduced-motion` media query.

## 4. Accessibility

### ARIA Attributes

```html
<div
  role="button"
  aria-label="One of Bams"
  aria-pressed="{selected}"
  aria-disabled="{disabled}"
  tabindex="{disabled"
  ?
  -1
  :
  0}
  data-tile-index="{tile.index}"
>
  <!-- Tile content -->
</div>
```

### Keyboard Navigation

- **Tab/Shift+Tab**: Navigate between tiles
- **Space/Enter**: Select/deselect tile
- **Arrow keys**: Navigate within tile groups (requires container coordination)
- **Escape**: Clear selection (requires container handling)

### Screen Reader Support

Auto-generate descriptive labels:

- "One of Bams" (1B)
- "Red Dragon" (RD)
- "North Wind" (NW)
- "Joker"
- "Flower 1"

Include state in label when relevant:

- "One of Bams, selected"
- "Five of Dots, disabled"
- "Joker, can be exchanged"

### Focus Management

- Visible focus ring: 2px solid blue outline, 2px offset
- Focus-visible only (no focus on click, only keyboard)
- Focus state maintains lift effect like hover

## 5. Usage Examples

### Example 1: Basic Tile Display

```tsx
import { Tile } from '@/components/presentational/Tile';

function HandDisplay() {
  const tiles = [
    { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false },
    { index: 9, suit: 'Crak', rank: '1', isJoker: false, isBlank: false },
    { index: 18, suit: 'Dot', rank: '1', isJoker: false, isBlank: false },
  ];

  return (
    <div className="hand-display">
      {tiles.map((tile, idx) => (
        <Tile key={idx} tile={tile} size="medium" faceUp={true} />
      ))}
    </div>
  );
}
```

### Example 2: Selectable Tiles with Click Handler

```tsx
import { Tile } from '@/components/presentational/Tile';
import { useState } from 'react';

function TileSelector() {
  const [selectedTiles, setSelectedTiles] = useState<number[]>([]);

  const tiles = [
    { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false },
    { index: 1, suit: 'Bam', rank: '2', isJoker: false, isBlank: false },
    { index: 2, suit: 'Bam', rank: '3', isJoker: false, isBlank: false },
  ];

  const handleTileClick = (tile: Tile) => {
    setSelectedTiles((prev) =>
      prev.includes(tile.index) ? prev.filter((idx) => idx !== tile.index) : [...prev, tile.index]
    );
  };

  return (
    <div className="tile-selector">
      {tiles.map((tile) => (
        <Tile
          key={tile.index}
          tile={tile}
          size="medium"
          faceUp={true}
          selectable={true}
          selected={selectedTiles.includes(tile.index)}
          onClick={handleTileClick}
        />
      ))}
      <p>{selectedTiles.length} / 3 selected</p>
    </div>
  );
}
```

### Example 3: Joker Exchange Highlight

```tsx
import { Tile } from '@/components/presentational/Tile';

function ExposedMeld() {
  const meldTiles = [
    { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false },
    { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false },
    { index: 41, suit: 'Joker', rank: 'J', isJoker: true, isBlank: false },
  ];

  const jokerExchangeable = true;

  return (
    <div className="exposed-meld">
      {meldTiles.map((tile, idx) => (
        <Tile
          key={idx}
          tile={tile}
          size="medium"
          faceUp={true}
          highlight={tile.isJoker && jokerExchangeable ? 'exchangeable' : 'none'}
          selectable={tile.isJoker && jokerExchangeable}
        />
      ))}
    </div>
  );
}
```

### Example 4: Called Tile in Meld (Rotated)

```tsx
import { Tile } from '@/components/presentational/Tile';

function PungDisplay() {
  const meldTiles = [
    { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false },
    { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false },
    { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false }, // Called
  ];

  return (
    <div className="pung-display">
      <Tile tile={meldTiles[0]} size="medium" faceUp={true} />
      <Tile tile={meldTiles[1]} size="medium" faceUp={true} />
      <Tile
        tile={meldTiles[2]}
        size="medium"
        faceUp={true}
        calledTile={true}
        rotation={90}
        highlight="called"
      />
    </div>
  );
}
```

### Example 5: Draggable Tiles (Charleston)

```tsx
import { Tile } from '@/components/presentational/Tile';

function CharlestonPass() {
  const handleDragStart = (tile: Tile, event: React.DragEvent) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('tile-index', tile.index.toString());
  };

  const handleDragEnd = (tile: Tile) => {
    console.log('Drag ended for tile:', tile.rank, 'of', tile.suit);
  };

  const tiles = [
    { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false },
    { index: 1, suit: 'Bam', rank: '2', isJoker: false, isBlank: false },
  ];

  return (
    <div className="charleston-pass">
      {tiles.map((tile) => (
        <Tile
          key={tile.index}
          tile={tile}
          size="medium"
          faceUp={true}
          draggable={true}
          onDragStart={(t, e) => handleDragStart(t, e)}
          onDragEnd={handleDragEnd}
        />
      ))}
    </div>
  );
}
```

### Example 6: Disabled Tiles (Dead Hand)

```tsx
import { Tile } from '@/components/presentational/Tile';

function DeadHandDisplay() {
  const tiles = [
    { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false },
    { index: 1, suit: 'Bam', rank: '2', isJoker: false, isBlank: false },
  ];

  const isDeadHand = true;

  return (
    <div className="dead-hand">
      {tiles.map((tile) => (
        <Tile
          key={tile.index}
          tile={tile}
          size="medium"
          faceUp={true}
          disabled={isDeadHand}
          highlight="error"
        />
      ))}
      <p className="error">DEAD HAND</p>
    </div>
  );
}
```

## 6. Visual Design

### Color Scheme

```css
/* Tile backgrounds (face-up) */
--tile-bam-bg: hsl(140, 30%, 95%); /* Light green tint */
--tile-crak-bg: hsl(0, 30%, 95%); /* Light red tint */
--tile-dot-bg: hsl(210, 30%, 95%); /* Light blue tint */
--tile-wind-bg: hsl(0, 0%, 98%); /* Almost white */
--tile-dragon-bg: hsl(0, 0%, 98%);
--tile-flower-bg: hsl(50, 60%, 95%); /* Light yellow tint */
--tile-joker-bg: hsl(45, 90%, 80%); /* Gold */

/* Tile back */
--tile-back-bg: hsl(140, 40%, 45%); /* Traditional green */
--tile-back-pattern: url('/assets/tile-back-pattern.svg');

/* Borders */
--tile-border: hsl(0, 0%, 80%);
--tile-border-selected: var(--color-primary);
--tile-border-called: hsl(210, 100%, 50%);
--tile-border-error: var(--color-error);
--tile-border-exchangeable: hsl(40, 100%, 50%);

/* Shadows */
--tile-shadow-default: 0 2px 4px rgba(0, 0, 0, 0.15);
--tile-shadow-hover: 0 4px 8px rgba(0, 0, 0, 0.25);
--tile-shadow-selected: 0 6px 12px rgba(0, 0, 0, 0.3);
```

### Typography

```css
/* Rank text (1-9, N/E/S/W, etc.) */
--tile-font-family: 'Roboto', 'Noto Sans', sans-serif;
--tile-font-weight: 700; /* Bold */
--tile-font-size-small: 10px;
--tile-font-size-medium: 14px;
--tile-font-size-large: 18px;

/* Suit symbols use icon font or SVG */
```

### Layout

```text
┌─────────────────┐
│  ┌─────────┐    │ ← Checkmark (if selected)
│  │  Suit   │    │
│  │ Symbol  │    │ ← Suit icon (bamboo, character, dot, wind, dragon, flower)
│  └─────────┘    │
│                 │
│      Rank       │ ← "1", "2", ..., "9", "N", "E", "S", "W", "R", "G", "W"
│                 │
│   (Joker Icon)  │ ← Joker: "★" or "JKR" centered
└─────────────────┘
```

Suit symbol occupies top 60% of tile, rank text bottom 40%.

## 7. Responsive Design

### Breakpoints

| Breakpoint | Behavior                                   |
| ---------- | ------------------------------------------ |
| Desktop    | All sizes supported, hover effects enabled |
| Tablet     | Medium and small sizes, touch-optimized    |
| Mobile     | Small and medium sizes, larger tap targets |

### Mobile Adjustments

- Increase tap target size to minimum 44×44px (iOS guideline)
- Disable hover effects (use touch events)
- Increase selection border thickness (4px instead of 3px)
- Simplify animations (reduce or disable complex transforms)

### Orientation

- Portrait: Tiles displayed vertically (0° rotation default)
- Landscape: Tiles may use horizontal layout for hand display

## 8. Performance Considerations

### Rendering Optimization

- Use `React.memo` to prevent re-renders when props unchanged
- Tile images/SVGs should be preloaded and cached
- Use CSS transforms (GPU-accelerated) for rotation and movement
- Lazy load tile faces for non-visible tiles (offscreen)

### Asset Loading

Tile faces can be rendered via:

1. **SVG sprites**: Best for scalability and performance
2. **Icon fonts**: Good for simple symbols, limited flexibility
3. **Image sprites**: Traditional approach, requires multiple resolutions
4. **Dynamic SVG**: Generated on-the-fly based on tile data (most flexible)

Recommended: **Dynamic SVG** with caching for tile faces.

### Drag-and-Drop Performance

- Use `requestAnimationFrame` for smooth drag updates
- Throttle drag position updates (16ms minimum, ~60fps)
- Use CSS `will-change: transform` for dragged tiles

## 9. Testing Requirements

### Unit Tests

```typescript
describe('Tile Component', () => {
  test('renders tile with correct suit and rank', () => {
    const tile = { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false };
    render(<Tile tile={tile} faceUp={true} />);
    expect(screen.getByLabelText('One of Bams')).toBeInTheDocument();
  });

  test('applies selected state when selected prop is true', () => {
    const tile = { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false };
    render(<Tile tile={tile} selected={true} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  test('applies disabled state when disabled prop is true', () => {
    const tile = { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false };
    render(<Tile tile={tile} disabled={true} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });

  test('calls onClick handler when tile is clicked', () => {
    const tile = { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false };
    const handleClick = jest.fn();
    render(<Tile tile={tile} onClick={handleClick} selectable={true} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith(tile);
  });

  test('does not call onClick when tile is disabled', () => {
    const tile = { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false };
    const handleClick = jest.fn();
    render(<Tile tile={tile} onClick={handleClick} disabled={true} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('renders tile back when faceUp is false', () => {
    const tile = { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false };
    const { container } = render(<Tile tile={tile} faceUp={false} />);
    expect(container.querySelector('.tile-back')).toBeInTheDocument();
  });

  test('applies correct rotation transform', () => {
    const tile = { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false };
    const { container } = render(<Tile tile={tile} rotation={90} />);
    const tileElement = container.querySelector('.tile');
    expect(tileElement).toHaveStyle({ transform: 'rotate(90deg)' });
  });

  test('applies highlight class for exchangeable state', () => {
    const tile = { index: 41, suit: 'Joker', rank: 'J', isJoker: true, isBlank: false };
    const { container } = render(<Tile tile={tile} highlight="exchangeable" />);
    expect(container.querySelector('.tile-highlight-exchangeable')).toBeInTheDocument();
  });

  test('handles keyboard selection with Space key', () => {
    const tile = { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false };
    const handleClick = jest.fn();
    render(<Tile tile={tile} onClick={handleClick} selectable={true} />);
    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: ' ' });
    expect(handleClick).toHaveBeenCalledWith(tile);
  });

  test('handles keyboard selection with Enter key', () => {
    const tile = { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false };
    const handleClick = jest.fn();
    render(<Tile tile={tile} onClick={handleClick} selectable={true} />);
    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledWith(tile);
  });

  test('renders Joker tile with correct label', () => {
    const tile = { index: 41, suit: 'Joker', rank: 'J', isJoker: true, isBlank: false };
    render(<Tile tile={tile} faceUp={true} />);
    expect(screen.getByLabelText('Joker')).toBeInTheDocument();
  });

  test('renders Wind tile with correct label', () => {
    const tile = { index: 27, suit: 'Wind', rank: 'N', isJoker: false, isBlank: false };
    render(<Tile tile={tile} faceUp={true} />);
    expect(screen.getByLabelText('North Wind')).toBeInTheDocument();
  });

  test('renders Dragon tile with correct label', () => {
    const tile = { index: 31, suit: 'Dragon', rank: 'R', isJoker: false, isBlank: false };
    render(<Tile tile={tile} faceUp={true} />);
    expect(screen.getByLabelText('Red Dragon')).toBeInTheDocument();
  });

  test('applies called tile styling and rotation', () => {
    const tile = { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false };
    const { container } = render(
      <Tile tile={tile} calledTile={true} rotation={90} highlight="called" />
    );
    expect(container.querySelector('.tile-called')).toBeInTheDocument();
    expect(container.querySelector('.tile')).toHaveStyle({ transform: 'rotate(90deg)' });
  });

  test('respects prefers-reduced-motion for animations', () => {
    // Mock media query
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    const tile = { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false };
    const { container } = render(<Tile tile={tile} />);
    expect(container.querySelector('.tile')).toHaveClass('reduced-motion');
  });
});
```

### Integration Tests

```typescript
describe('Tile Integration', () => {
  test('works with HandDisplay container for selection', () => {
    const tiles = [
      { index: 0, suit: 'Bam', rank: '1', isJoker: false, isBlank: false },
      { index: 1, suit: 'Bam', rank: '2', isJoker: false, isBlank: false },
    ];
    render(<HandDisplay tiles={tiles} selectable={true} maxSelection={1} />);
    fireEvent.click(screen.getByLabelText('One of Bams'));
    expect(screen.getByLabelText('One of Bams, selected')).toBeInTheDocument();
  });

  test('drag-and-drop works between tile groups', () => {
    // Test drag from hand to charleston pass area
    const { container } = render(
      <CharlestonPassFlow>
        <ConcealedHand draggable={true} />
        <PassArea />
      </CharlestonPassFlow>
    );
    const tile = screen.getByLabelText('One of Bams');
    const passArea = container.querySelector('.pass-area');

    fireEvent.dragStart(tile);
    fireEvent.drop(passArea);

    expect(passArea.querySelector('[data-tile-index="0"]')).toBeInTheDocument();
  });
});
```

### Visual Regression Tests

Use Storybook + Chromatic or Percy for visual testing:

```typescript
export default {
  title: 'Components/Tile',
  component: Tile,
};

export const AllStates = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 80px)', gap: '16px' }}>
    {/* Default */}
    <Tile tile={bamOne} faceUp={true} />
    {/* Selected */}
    <Tile tile={bamOne} faceUp={true} selected={true} />
    {/* Disabled */}
    <Tile tile={bamOne} faceUp={true} disabled={true} />
    {/* Exchangeable */}
    <Tile tile={joker} faceUp={true} highlight="exchangeable" />
    {/* Called */}
    <Tile tile={bamOne} faceUp={true} calledTile={true} rotation={90} highlight="called" />
    {/* Face down */}
    <Tile tile={bamOne} faceUp={false} />
  </div>
);

export const AllSuits = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 64px)', gap: '8px' }}>
    {allTiles.map((tile) => (
      <Tile key={tile.index} tile={tile} faceUp={true} size="medium" />
    ))}
  </div>
);
```

## 10. Implementation Notes

### Component Structure

```tsx
import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames';
import { Tile as TileData } from '@/types/bindings/generated/Tile';
import styles from './Tile.module.css';

export function Tile({
  tile,
  rotation = 0,
  faceUp = true,
  selected = false,
  disabled = false,
  dragging = false,
  selectable = false,
  draggable = false,
  size = 'medium',
  highlight = 'none',
  calledTile = false,
  onClick,
  onDragStart,
  onDragEnd,
  onMouseEnter,
  onMouseLeave,
  ariaLabel,
  className,
  testId,
}: TileProps) {
  // Generate ARIA label from tile data
  const autoAriaLabel = useMemo(() => {
    if (ariaLabel) return ariaLabel;

    let label = '';
    if (tile.isJoker) {
      label = 'Joker';
    } else if (tile.suit === 'Wind') {
      const windNames = { N: 'North', E: 'East', S: 'South', W: 'West' };
      label = `${windNames[tile.rank]} Wind`;
    } else if (tile.suit === 'Dragon') {
      const dragonNames = { R: 'Red', G: 'Green', W: 'White' };
      label = `${dragonNames[tile.rank]} Dragon`;
    } else if (tile.suit === 'Flower') {
      label = `Flower ${tile.rank}`;
    } else {
      label = `${tile.rank} of ${tile.suit}s`;
    }

    if (selected) label += ', selected';
    if (disabled) label += ', disabled';
    if (highlight === 'exchangeable') label += ', can be exchanged';

    return label;
  }, [tile, selected, disabled, highlight, ariaLabel]);

  // Click handler
  const handleClick = useCallback(() => {
    if (disabled || !selectable || !onClick) return;
    onClick(tile);
  }, [tile, disabled, selectable, onClick]);

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled || !selectable) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleClick();
      }
    },
    [disabled, selectable, handleClick]
  );

  // Drag handlers
  const handleDragStartEvent = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!draggable || !onDragStart) return;
      onDragStart(tile, e);
    },
    [tile, draggable, onDragStart]
  );

  const handleDragEndEvent = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!draggable || !onDragEnd) return;
      onDragEnd(tile, e);
    },
    [tile, draggable, onDragEnd]
  );

  // Mouse handlers
  const handleMouseEnterEvent = useCallback(() => {
    if (disabled || !onMouseEnter) return;
    onMouseEnter(tile);
  }, [tile, disabled, onMouseEnter]);

  const handleMouseLeaveEvent = useCallback(() => {
    if (disabled || !onMouseLeave) return;
    onMouseLeave(tile);
  }, [tile, disabled, onMouseLeave]);

  // Class names
  const tileClasses = classNames(
    styles.tile,
    styles[`tile-${size}`],
    {
      [styles['tile-selected']]: selected,
      [styles['tile-disabled']]: disabled,
      [styles['tile-dragging']]: dragging,
      [styles['tile-selectable']]: selectable && !disabled,
      [styles['tile-called']]: calledTile,
      [styles[`tile-highlight-${highlight}`]]: highlight !== 'none',
      [styles['tile-face-down']]: !faceUp,
    },
    className
  );

  return (
    <div
      role="button"
      aria-label={autoAriaLabel}
      aria-pressed={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      data-tile-index={tile.index}
      data-testid={testId}
      className={tileClasses}
      style={{
        transform: `rotate(${rotation}deg)`,
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragStart={handleDragStartEvent}
      onDragEnd={handleDragEndEvent}
      onMouseEnter={handleMouseEnterEvent}
      onMouseLeave={handleMouseLeaveEvent}
      draggable={draggable}
    >
      {faceUp ? <TileFace tile={tile} size={size} /> : <TileBack size={size} />}
      {selected && <div className={styles['tile-checkmark']}>✓</div>}
    </div>
  );
}
```

### Performance Optimization

```tsx
// Memoize tile component to prevent unnecessary re-renders
export const Tile = React.memo(TileComponent);

// Custom comparison function for memo
export const Tile = React.memo(TileComponent, (prevProps, nextProps) => {
  return (
    prevProps.tile.index === nextProps.tile.index &&
    prevProps.selected === nextProps.selected &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.highlight === nextProps.highlight &&
    prevProps.rotation === nextProps.rotation &&
    prevProps.faceUp === nextProps.faceUp
  );
});
```

## 11. CSS Module (Tile.module.css)

```css
/* Base tile styles */
.tile {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--tile-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-white);
  box-shadow: var(--tile-shadow-default);
  cursor: default;
  transition:
    transform 200ms ease-out,
    box-shadow 150ms ease-out,
    border-color 150ms ease-in-out,
    opacity 200ms ease-in-out;
  user-select: none;
  -webkit-user-select: none;
}

/* Size variants */
.tile-small {
  width: 32px;
  height: 44px;
  font-size: 10px;
}

.tile-medium {
  width: 48px;
  height: 64px;
  font-size: 14px;
}

.tile-large {
  width: 64px;
  height: 88px;
  font-size: 18px;
}

/* Interactive states */
.tile-selectable {
  cursor: pointer;
}

.tile-selectable:hover:not(.tile-disabled) {
  transform: translateY(-4px);
  box-shadow: var(--tile-shadow-hover);
}

.tile-selectable:active:not(.tile-disabled) {
  transform: translateY(-4px) scale(0.95);
}

.tile-selectable:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Selected state */
.tile-selected {
  border-color: var(--tile-border-selected);
  border-width: 3px;
  transform: translateY(-8px);
  box-shadow: var(--tile-shadow-selected);
}

/* Disabled state */
.tile-disabled {
  opacity: 0.5;
  filter: grayscale(100%);
  cursor: not-allowed;
}

/* Dragging state */
.tile-dragging {
  opacity: 0.4;
}

.tile[draggable='true']:not(.tile-disabled) {
  cursor: grab;
}

.tile[draggable='true']:not(.tile-disabled):active {
  cursor: grabbing;
}

/* Called tile */
.tile-called {
  border-color: var(--tile-border-called);
  border-width: 3px;
}

/* Highlight variants */
.tile-highlight-exchangeable {
  border-color: var(--tile-border-exchangeable);
  animation: pulse-border 2s ease-in-out infinite;
}

.tile-highlight-winning {
  border-color: var(--color-success);
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.5);
}

.tile-highlight-error {
  border-color: var(--tile-border-error);
}

.tile-highlight-called {
  border-color: var(--tile-border-called);
}

/* Face down */
.tile-face-down {
  background-color: var(--tile-back-bg);
  background-image: var(--tile-back-pattern);
  background-size: cover;
}

/* Checkmark for selected state */
.tile-checkmark {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--color-primary);
  color: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
}

/* Animations */
@keyframes pulse-border {
  0%,
  100% {
    border-color: var(--tile-border-exchangeable);
    box-shadow: 0 0 0 rgba(245, 158, 11, 0);
  }
  50% {
    border-color: hsl(40, 100%, 60%);
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .tile,
  .tile-highlight-exchangeable {
    animation: none;
    transition: none;
  }
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .tile-selectable {
    /* Larger tap targets on mobile */
    min-width: 44px;
    min-height: 44px;
  }

  .tile-selected {
    border-width: 4px; /* Thicker border for clarity */
  }
}
```

## 12. Dependencies

### Required Packages

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "classnames": "^2.3.2"
  },
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0"
  }
}
```

### Type Imports

```typescript
import { Tile as TileData } from '@/types/bindings/generated/Tile';
```

Assumes TypeScript bindings are generated from Rust backend via `ts-rs`.

---

**Status**: Draft  
**Last Updated**: 2026-01-31  
**Related Specs**: `TileGroup.md`, `HandDisplay.md`, `DiscardPile.md`, `MeldDisplay.md`
