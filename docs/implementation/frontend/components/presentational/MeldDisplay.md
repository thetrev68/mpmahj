# MeldDisplay Component Specification

## Component Type

**Presentational Component**

## Purpose

Displays exposed melds (Pungs, Kongs, Quints, Sextets) with proper tile arrangement, orientation, and joker visualization.

## Related User Stories

- US-005: View Exposed Melds (player's exposed combinations)
- US-024: Observe Opponents (opponent melds)
- US-008: Call for Pung (meld display after calling)
- US-009: Call for Kong (kong display with stacking)
- US-010: Joker Exchange (joker indication in melds)

## TypeScript Interface

```typescript
import type { Meld, MeldType } from '@/types/bindings/generated';

export interface MeldDisplayProps {
  /** Meld data from backend */
  meld: Meld;

  /** Size variant */
  size?: 'small' | 'medium' | 'large';

  /** Whether meld is interactive (for joker exchange) */
  interactive?: boolean;

  /** Click handler for joker exchange */
  onJokerClick?: (jokerIndex: number, tile: number) => void;

  /** Highlight exchangeable jokers */
  highlightExchangeable?: boolean;

  /** Owner's seat (for rotation/orientation) */
  ownerSeat?: 'East' | 'South' | 'West' | 'North';

  /** Whether this is the current player's meld */
  isOwnMeld?: boolean;

  /** Additional CSS classes */
  className?: string;
}
```

## State Management

**Stateless** - All state managed by parent components.

## Visual Design

### Meld Type Layouts

#### Pung (3 identical tiles)

```
Standard horizontal layout:
[5D][5D][5D]
```

#### Kong (4 identical tiles)

```
Stacked layout (2×2):
[7C][7C]
   [7C][7C]  (back two elevated/offset)

OR Horizontal (compact):
[7C][7C][7C][7C]
```

#### Quint (5 identical tiles)

```
Stacked layout:
[2B][2B][2B]
      [2B][2B]  (back two elevated)
```

#### Sextet (6 identical tiles)

```
Stacked layout (3×2):
[9D][9D][9D]
      [9D][9D][9D]  (back three elevated)
```

### Tile Orientation

- **Horizontal melds**: Tiles laid flat (standard orientation)
- **Called tile**: Rightmost tile rotated 90° to indicate called discard
- **Stacked tiles**: Back tiles elevated by 8px, offset right by 50%

### Joker Indication

- **Joker tiles**: Purple border (`var(--color-joker)`)
- **Exchangeable jokers**: Pulsing glow animation
- **Natural tiles**: Standard tile appearance
- **Joker substitution**: Small overlay showing represented tile

### Size Variants

Delegates to TileImage:

- **small**: 32×44px tiles (opponent melds)
- **medium**: 48×66px tiles (default)
- **large**: 64×88px tiles (own melds, detailed view)

### Visual Effects

- **Hover (if interactive)**: Exchangeable jokers elevate
- **Click**: Scale 0.95 → 1.0 over 100ms
- **Meld appear**: Slide in from right, 300ms ease-out
- **Stacking depth**: Box shadow creates 3D layering effect

## Accessibility

### ARIA Attributes

- `role="group"` for meld container
- `aria-label`: "{meld type} of {tile name}" (e.g., "Pung of 5 Dots")
- `aria-roledescription="exposed meld"` for context
- Individual tiles have own ARIA (via TileImage)
- `aria-describedby`: Links to joker count description if present

### Keyboard Support (when interactive)

- `Tab`: Focus first exchangeable joker
- `Arrow Right/Left`: Navigate between exchangeable jokers
- `Enter/Space`: Select joker for exchange
- `Escape`: Cancel joker selection

### Screen Reader Announcements

- On meld creation: "{meld type} of {tile name} exposed"
- On focus: "{meld type}, {joker count} jokers" (if jokers present)
- On joker exchange: "Exchangeable joker, {tile name}"

### Focus Management

- Interactive melds: Exchangeable jokers are focusable
- Static melds: Not in tab order
- Focus visible indicator on joker tiles

## Dependencies

### External

- React (hooks: `useMemo`, `useCallback`)
- `clsx` for conditional class names

### Internal

- `@/components/tiles/TileImage` - Individual tile rendering
- `@/utils/tileFormatter` - `tileToString()` for ARIA labels
- `@/styles/meldDisplay.module.css` - Component styles

### Generated Types

- `@/types/bindings/generated/Meld.ts` - Meld type
- `@/types/bindings/generated/MeldType.ts` - MeldType enum

## Implementation Notes

### Performance Optimizations

1. **Memoization**: Memoize meld layout calculation
2. **Static layout**: Pre-calculate tile positions for each meld type
3. **CSS positioning**: Use transforms for stacking, not absolute positioning
4. **Event delegation**: Single click handler on container

### Meld Layout Calculation

```typescript
const getMeldLayout = (meld: Meld): TilePosition[] => {
  const { meld_type, tiles } = meld;

  switch (meld_type) {
    case 'Pung':
      return tiles.map((tile, i) => ({
        tile,
        x: i * (tileWidth + gap),
        y: 0,
        rotated: i === tiles.length - 1 && meld.called_from != null,
      }));

    case 'Kong':
      return [
        { tile: tiles[0], x: 0, y: 0 },
        { tile: tiles[1], x: tileWidth, y: 0 },
        { tile: tiles[2], x: tileWidth * 0.5, y: -8, zIndex: 2 },
        { tile: tiles[3], x: tileWidth * 1.5, y: -8, zIndex: 2 },
      ];

    // ... other meld types
  }
};
```

### Joker Exchange Logic

```typescript
const isJokerExchangeable = (tile: number, meldIndex: number): boolean => {
  // Joker (index 41) can be exchanged if player has natural tile
  return tile === 41 && highlightExchangeable;
};
```

### Error Handling

- Invalid meld type: Render tiles horizontally with warning
- Missing tiles: Render placeholder with error state
- Mismatched tile count: Log warning, render what's available
- Invalid joker positions: Highlight all jokers as exchangeable

### Responsive Behavior

- Mobile: Default to small size, horizontal layout (no stacking)
- Tablet: Standard layouts with stacking
- Desktop: Full stacking effects with depth

## Test Scenarios

### Unit Tests

```typescript
describe('MeldDisplay', () => {
  it('renders pung correctly', () => {
    // MeldType.Pung should show 3 tiles horizontally
  });

  it('renders kong with stacked layout', () => {
    // MeldType.Kong should show 2×2 stacking
  });

  it('renders quint with stacked layout', () => {
    // MeldType.Quint should show 3+2 stacking
  });

  it('renders sextet with stacked layout', () => {
    // MeldType.Sextet should show 3×2 stacking
  });

  it('highlights jokers in meld', () => {
    // Tiles at index 41 should have purple border
  });

  it('rotates called tile', () => {
    // Last tile should be rotated if called_from exists
  });

  it('calls onJokerClick when joker clicked', () => {
    // Clicking exchangeable joker should trigger callback
  });

  it('applies size to tiles', () => {
    // size='large' should pass to TileImage components
  });

  it('sets correct aria-label', () => {
    // Should describe meld type and tile
  });

  it('highlights exchangeable jokers', () => {
    // highlightExchangeable=true should add glow to jokers
  });
});
```

### Integration Tests

```typescript
describe('MeldDisplay Integration', () => {
  it('supports keyboard navigation of jokers', () => {
    // Arrow keys should move between exchangeable jokers
  });

  it('announces joker exchange opportunity', () => {
    // Screen readers should announce exchangeable jokers
  });

  it('works with TileImage hover states', () => {
    // Individual tiles should show hover effects
  });
});
```

### Visual Regression Tests

- All meld types with natural tiles
- All meld types with jokers
- Stacked layouts from different angles
- Called tile rotation
- Exchangeable joker highlighting
- All size variants

## Usage Examples

### Player's Exposed Meld

```tsx
import { MeldDisplay } from '@/components/game/MeldDisplay';

function PlayerMelds({ melds, canExchangeJoker, onJokerExchange }) {
  return (
    <div className="melds-container">
      {melds.map((meld, index) => (
        <MeldDisplay
          key={index}
          meld={meld}
          size="medium"
          interactive={canExchangeJoker}
          onJokerClick={onJokerExchange}
          highlightExchangeable={canExchangeJoker}
          isOwnMeld
        />
      ))}
    </div>
  );
}
```

### Opponent's Melds (Read-Only)

```tsx
function OpponentMelds({ melds, seat }) {
  return (
    <div className="opponent-melds">
      {melds.map((meld, index) => (
        <MeldDisplay key={index} meld={meld} size="small" ownerSeat={seat} />
      ))}
    </div>
  );
}
```

### Joker Exchange Highlight

```tsx
function MeldWithExchange({ meld, naturalTile, onExchange }) {
  const handleJokerClick = (jokerIndex: number, jokerTile: number) => {
    // Exchange joker with natural tile
    onExchange(meld.id, jokerIndex, naturalTile);
  };

  return (
    <MeldDisplay meld={meld} interactive highlightExchangeable onJokerClick={handleJokerClick} />
  );
}
```

### History View (Static)

```tsx
function MoveHistoryMeld({ meld }) {
  return <MeldDisplay meld={meld} size="small" interactive={false} />;
}
```

## Style Guidelines

### CSS Module Structure

```css
.meld {
  display: inline-flex;
  position: relative;
  gap: var(--space-1);
  align-items: flex-end;
}

/* Pung layout (horizontal) */
.meld--pung {
  flex-direction: row;
}

/* Kong layout (stacked 2×2) */
.meld--kong {
  position: relative;
  width: calc(var(--tile-width) * 2 + var(--space-1));
}

.meld--kong .tile:nth-child(3),
.meld--kong .tile:nth-child(4) {
  position: absolute;
  top: -8px;
  z-index: 2;
}

.meld--kong .tile:nth-child(3) {
  left: 50%;
}

.meld--kong .tile:nth-child(4) {
  right: 0;
}

/* Quint layout (3+2 stacked) */
.meld--quint {
  position: relative;
}

.meld--quint .tile:nth-child(4),
.meld--quint .tile:nth-child(5) {
  position: absolute;
  top: -8px;
  z-index: 2;
}

/* Called tile rotation */
.tile--called {
  transform: rotate(90deg);
  margin-left: var(--space-2);
}

/* Joker indication */
.tile--joker {
  border: 2px solid var(--color-joker);
  box-shadow: 0 0 8px rgba(168, 85, 247, 0.4);
}

.tile--joker-exchangeable {
  cursor: pointer;
  animation: joker-pulse 2s ease-in-out infinite;
}

@keyframes joker-pulse {
  0%,
  100% {
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.4);
  }
  50% {
    box-shadow: 0 0 16px rgba(168, 85, 247, 0.8);
  }
}

/* Stacking depth effect */
.tile--stacked {
  filter: brightness(0.95);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
```

## Future Enhancements

- [ ] 3D rotation animation on meld creation
- [ ] Drag tiles to rearrange meld (for organizing display)
- [ ] Joker substitution overlay showing natural tile
- [ ] Meld value/points indicator
- [ ] Concealed vs exposed meld distinction
- [ ] Animation when joker is exchanged
- [ ] Meld breakdown tooltip (tiles + value)
- [ ] Theme-based meld highlighting

## Notes

- Meld type determines layout automatically (pung, kong, quint, sextet)
- Called tile (from discard) rotated 90° on rightmost position
- Stacking creates visual distinction for larger melds
- Jokers always highlighted to indicate they can be exchanged
- Kong stacking follows traditional mahjong display (2 face-up, 2 face-down in some variations - we show all face-up)
- Back tiles in stacked layout slightly dimmed for depth perception
- Interactive state only enabled when player can legally exchange joker
- Meld data comes directly from Rust backend Meld type
