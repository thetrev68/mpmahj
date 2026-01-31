# WindIndicator Component Specification

## Component Type

Presentational Component

## Purpose

Displays current wind round and player seat positions with visual indicators. Shows prevailing wind, seat winds, and dealer position using traditional mahjong wind symbols and colors.

## Related User Stories

- US-010: Deal Tiles (show initial dealer and wind positions)
- US-020: Score Calculation (dealer affects scoring)
- US-021: End Round (dealer rotation logic)
- US-034: Spectator Features (observer orientation)
- All game flow requiring wind/seat awareness

## TypeScript Interface

```typescript
export interface WindIndicatorProps {
  /** Current prevailing wind */
  prevailingWind: Wind;

  /** Dealer seat position */
  dealerSeat: Seat;

  /** Player seat assignments */
  players: PlayerSeatInfo[];

  /** Current active player (highlighted) */
  activePlayerSeat?: Seat;

  /** Display variant */
  variant?: 'full' | 'compact' | 'minimal';

  /** Layout orientation */
  orientation?: 'horizontal' | 'circular' | 'table';

  /** Show prevailing wind */
  showPrevailingWind?: boolean;

  /** Show dealer indicator */
  showDealer?: boolean;

  /** Show player names */
  showPlayerNames?: boolean;

  /** Current viewer's seat (for relative positioning) */
  viewerSeat?: Seat;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export interface PlayerSeatInfo {
  /** Player seat */
  seat: Seat;

  /** Player name */
  playerName: string;

  /** Whether this player is dealer */
  isDealer: boolean;

  /** Whether this is current player's turn */
  isActive: boolean;

  /** Player avatar URL */
  avatar?: string;
}

export type Wind = 'east' | 'south' | 'west' | 'north';
export type Seat = 'east' | 'south' | 'west' | 'north';
```text

## Internal State

```typescript
interface WindIndicatorState {
  /** Hovered seat */
  hoveredSeat: Seat | null;
}
```text

## State Management

**Internal useState** for hover state. Wind and seat data managed by parent component.

## Visual Design

### Variant Styles

#### Full

- Large wind symbols (64px)
- Player names and avatars
- Dealer badge prominent
- Prevailing wind display
- Use for: Game table center, main display

#### Compact

- Medium wind symbols (40px)
- Player names only
- Small dealer indicator
- Use for: Sidebar, mobile view

#### Minimal

- Small wind symbols (24px)
- No player names
- Dealer dot indicator
- Use for: Score display, compact UI

### Layout Orientations

#### Horizontal

```text
East (Dealer) | South | West | North
```text

- Linear left-to-right layout
- Seat labels below symbols
- Use for: Header bar, mobile

#### Circular (Default)

```text
       North
         ↑
West ← Table → East (Dealer)
         ↓
       South
```text

- Arranged in compass positions
- Simulates table seating
- Use for: Game board center

#### Table

```text
  Player 3 (North)
       ↑
P2 ← Table → P4
  (West)   (East-Dealer)
       ↓
  Player 1 (South)
```text

- 2D table layout with player positions
- Most realistic representation
- Use for: Full game view

### Wind Symbols

Using traditional Chinese wind characters:

- **East**: 東 (red background)
- **South**: 南 (green background)
- **West**: 西 (blue background)
- **North**: 北 (yellow background)

Alternative: Unicode arrows

- **East**: → (right)
- **South**: ↓ (down)
- **West**: ← (left)
- **North**: ↑ (up)

### Seat Colors (Consistent with PlayerAvatar)

- **East**: `var(--color-seat-east)` (#ef4444) - Red
- **South**: `var(--color-seat-south)` (#10b981) - Green
- **West**: `var(--color-seat-west)` (#3b82f6) - Blue
- **North**: `var(--color-seat-north)` (#f59e0b) - Yellow

### Dealer Indicator

- **Badge**: "D" or "Dealer" in white text
- **Background**: Seat color
- **Position**: Top-right of wind symbol
- **Size**: 20px × 20px circle (compact), 32px × 32px (full)
- **Animation**: Subtle pulse on dealer change

### Active Player Indicator

- **Border**: 3px solid `var(--color-primary)` (#2563eb)
- **Glow**: Pulsing box-shadow
- **Animation**: 2s ease-in-out infinite pulse

### Prevailing Wind Display

- **Label**: "Prevailing Wind:"
- **Symbol**: Large wind character (96px) or text
- **Color**: Corresponding seat color
- **Position**: Center of circular layout, or left of horizontal
- **Background**: Subtle radial gradient

### Wind Symbol Details

- **Size full**: 64px × 64px
- **Size compact**: 40px × 40px
- **Size minimal**: 24px × 24px
- **Font**: Large, bold sans-serif or traditional characters
- **Background**: Seat color with 0.9 opacity
- **Border**: 2px solid white (for contrast)
- **Border radius**: `var(--radius-md)` (6px)
- **Shadow**: `var(--shadow-sm)`

## Accessibility

### ARIA Attributes

- `role="group"` for wind indicator container
- `aria-label="Wind positions"` for container
- `aria-label="{playerName}, {seatWind}, {isDealer ? 'Dealer' : ''}"` for each seat
- `aria-current="true"` for active player
- `aria-describedby` linking to prevailing wind description

### Keyboard Support

- **Tab**: Navigate between seats (if interactive)
- **Arrow Keys**: Navigate circular layout (Up/Down/Left/Right)

### Screen Reader Support

- Announce prevailing wind: "Prevailing wind is {wind}"
- Announce each seat: "{playerName}, {seatWind} wind, {isDealer ? 'Dealer' : ''}"
- Announce active player: "{playerName}'s turn"
- Announce dealer changes: "Dealer is now {playerName} at {seatWind}"

### Visual Accessibility

- High contrast for wind symbols and text
- Color not sole indicator (text labels + symbols)
- Dealer indicated by text badge, not just color
- Active player has border + glow (redundant coding)

## Dependencies

### External

- React (hooks: `useState`, `useCallback`)
- `clsx` for conditional class names

### Internal

- `@/components/ui/Badge` - Dealer badge
- `@/components/ui/Avatar` - Player avatars (full variant)
- `@/utils/seatColors` - Seat color mapping
- `@/utils/windUtils` - Wind rotation logic
- `@/styles/windIndicator.module.css` - Component styles

### Generated Types

- `@/types/bindings/generated/Seat.ts` - Seat enum from Rust
- `@/types/bindings/generated/Player.ts` - Player type

## Implementation Notes

### Wind Rotation Logic

```typescript
// Dealer rotates: East → South → West → North → East
const nextWind = (current: Wind): Wind => {
  const rotation: Wind[] = ['east', 'south', 'west', 'north'];
  const index = rotation.indexOf(current);
  return rotation[(index + 1) % 4];
};

// Prevailing wind changes after full rotation (4 rounds)
const nextPrevailingWind = (current: Wind, roundsCompleted: number): Wind => {
  if (roundsCompleted % 4 === 0) {
    return nextWind(current);
  }
  return current;
};
```text

### Relative Positioning (Viewer-Centric)

```typescript
// Calculate relative positions based on viewer's seat
const getRelativePosition = (targetSeat: Seat, viewerSeat: Seat): string => {
  const seats: Seat[] = ['east', 'south', 'west', 'north'];
  const viewerIndex = seats.indexOf(viewerSeat);
  const targetIndex = seats.indexOf(targetSeat);
  const offset = (targetIndex - viewerIndex + 4) % 4;

  return ['bottom', 'right', 'top', 'left'][offset]; // You, Right, Across, Left
};
```text

### Circular Layout Positioning

```typescript
// CSS positioning for circular layout
const positions = {
  east: { right: '0', top: '50%', transform: 'translateY(-50%)' },
  south: { bottom: '0', left: '50%', transform: 'translateX(-50%)' },
  west: { left: '0', top: '50%', transform: 'translateY(-50%)' },
  north: { top: '0', left: '50%', transform: 'translateX(-50%)' },
};
```text

### Performance Optimizations

1. **Memoize seat positions**: Only recalculate when players change
2. **CSS animations**: Use CSS for pulse effects, not JavaScript
3. **SVG symbols**: Use SVG for wind characters (scalable, crisp)

## Test Scenarios

### Unit Tests

```typescript
describe('WindIndicator', () => {
  it('renders all four wind positions', () => {
    // Should render East, South, West, North
  });

  it('displays prevailing wind', () => {
    // showPrevailingWind should display current prevailing wind
  });

  it('marks dealer position', () => {
    // dealerSeat should show dealer badge
  });

  it('highlights active player', () => {
    // activePlayerSeat should have active styling
  });

  it('shows player names', () => {
    // showPlayerNames should display player names
  });

  it('applies variant styles', () => {
    // variant='compact' should use compact layout
  });

  it('applies orientation layout', () => {
    // orientation='circular' should use circular positioning
  });

  it('uses seat colors correctly', () => {
    // Each seat should have corresponding color
  });
});
```text

### Integration Tests

```typescript
describe('WindIndicator Integration', () => {
  it('updates when dealer changes', () => {
    // Dealer rotation should update display
  });

  it('updates when prevailing wind changes', () => {
    // Prevailing wind should update every 4 rounds
  });

  it('integrates with player turn system', () => {
    // Active player should update on turn changes
  });
});
```text

### Visual Regression Tests

- All variants (full, compact, minimal)
- All orientations (horizontal, circular, table)
- All dealer positions (each seat)
- All prevailing winds
- Active player highlighting

## Usage Examples

### Full Game Table Display

```tsx
import { WindIndicator } from '@/components/game/WindIndicator';

function GameTable({ game }) {
  const players = game.players.map((p) => ({
    seat: p.seat,
    playerName: p.name,
    isDealer: p.seat === game.dealerSeat,
    isActive: p.seat === game.currentPlayerSeat,
    avatar: p.avatarUrl,
  }));

  return (
    <div className="game-table-center">
      <WindIndicator
        prevailingWind={game.prevailingWind}
        dealerSeat={game.dealerSeat}
        players={players}
        activePlayerSeat={game.currentPlayerSeat}
        variant="full"
        orientation="circular"
        showPrevailingWind
        showDealer
        showPlayerNames
      />
    </div>
  );
}
```text

### Compact Sidebar Display

```tsx
function GameSidebar({ game }) {
  return (
    <aside>
      <WindIndicator
        prevailingWind={game.prevailingWind}
        dealerSeat={game.dealerSeat}
        players={game.players}
        variant="compact"
        orientation="horizontal"
        showDealer
      />
    </aside>
  );
}
```text

### Minimal Score Display

```tsx
function ScoreHeader({ game }) {
  return (
    <header>
      <WindIndicator
        prevailingWind={game.prevailingWind}
        dealerSeat={game.dealerSeat}
        players={game.players}
        variant="minimal"
        orientation="horizontal"
        showDealer={false}
      />
    </header>
  );
}
```text

### Viewer-Relative Display

```tsx
function SpectatorView({ game, spectatorSeat }) {
  return (
    <div>
      <WindIndicator
        prevailingWind={game.prevailingWind}
        dealerSeat={game.dealerSeat}
        players={game.players}
        viewerSeat={spectatorSeat}
        variant="full"
        orientation="table"
        showPlayerNames
      />
    </div>
  );
}
```text

## Style Guidelines

### CSS Module Structure

```css
.wind-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
}

/* Orientations */
.wind-indicator--horizontal {
  flex-direction: row;
}

.wind-indicator--circular {
  position: relative;
  width: 300px;
  height: 300px;
}

.wind-indicator--table {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  grid-template-rows: 1fr 2fr 1fr;
  gap: var(--space-2);
  width: 400px;
  height: 400px;
}

/* Wind position */
.wind-position {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

/* Circular positioning */
.wind-indicator--circular .wind-position--east {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.wind-indicator--circular .wind-position--south {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

.wind-indicator--circular .wind-position--west {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}

.wind-indicator--circular .wind-position--north {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
}

/* Table positioning */
.wind-indicator--table .wind-position--east {
  grid-column: 3;
  grid-row: 2;
}

.wind-indicator--table .wind-position--south {
  grid-column: 2;
  grid-row: 3;
}

.wind-indicator--table .wind-position--west {
  grid-column: 1;
  grid-row: 2;
}

.wind-indicator--table .wind-position--north {
  grid-column: 2;
  grid-row: 1;
}

/* Wind symbol */
.wind-symbol {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-bold);
  color: white;
  border: 2px solid white;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;
}

.wind-symbol--full {
  width: 64px;
  height: 64px;
  font-size: var(--text-2xl);
}

.wind-symbol--compact {
  width: 40px;
  height: 40px;
  font-size: var(--text-lg);
}

.wind-symbol--minimal {
  width: 24px;
  height: 24px;
  font-size: var(--text-sm);
}

/* Seat colors */
.wind-symbol--east {
  background: var(--color-seat-east);
}

.wind-symbol--south {
  background: var(--color-seat-south);
}

.wind-symbol--west {
  background: var(--color-seat-west);
}

.wind-symbol--north {
  background: var(--color-seat-north);
}

/* Active player */
.wind-position--active .wind-symbol {
  border: 3px solid var(--color-primary);
  box-shadow:
    0 0 0 3px rgba(37, 99, 235, 0.3),
    var(--shadow-md);
  animation: pulse-active 2s ease-in-out infinite;
}

/* Dealer indicator */
.dealer-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--seat-color);
  color: white;
  border: 2px solid white;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  box-shadow: var(--shadow-sm);
}

.wind-symbol--full .dealer-badge {
  width: 32px;
  height: 32px;
  font-size: var(--text-sm);
}

/* Player info */
.player-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.player-name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  text-align: center;
}

.player-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  border: 2px solid var(--seat-color);
}

/* Prevailing wind */
.prevailing-wind {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
}

.prevailing-wind__label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
}

.prevailing-wind__symbol {
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  color: white;
  background: radial-gradient(circle, var(--seat-color) 0%, rgba(var(--seat-color-rgb), 0.7) 100%);
  border: 3px solid white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

/* Circular center (for prevailing wind) */
.wind-indicator--circular .prevailing-wind {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* Animations */
@keyframes pulse-active {
  0%,
  100% {
    box-shadow:
      0 0 0 3px rgba(37, 99, 235, 0.3),
      var(--shadow-md);
  }
  50% {
    box-shadow:
      0 0 0 6px rgba(37, 99, 235, 0.2),
      var(--shadow-lg);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .wind-indicator--circular {
    width: 250px;
    height: 250px;
  }

  .wind-indicator--table {
    width: 300px;
    height: 300px;
  }

  .wind-symbol--full {
    width: 48px;
    height: 48px;
    font-size: var(--text-xl);
  }
}
```text

## Future Enhancements

- [ ] Animated wind rotation on dealer change
- [ ] Sound effect for dealer change
- [ ] Historical wind display (previous rounds)
- [ ] Wind forecast (next dealer prediction)
- [ ] Custom wind symbols (traditional vs modern)
- [ ] Colorblind mode (different patterns instead of colors)
- [ ] Interactive seat selection (for seat assignment)
- [ ] Tooltips with wind/seat explanations
- [ ] Export wind history (statistics)

## Notes

- Wind symbols use traditional Chinese characters or Unicode arrows
- Seat colors must match PlayerAvatar component for consistency
- Dealer rotates clockwise: East → South → West → North
- Prevailing wind changes every 4 rounds (full rotation)
- Circular layout most intuitive for American Mahjong players
- Table layout best for spectators (shows physical positions)
- Horizontal layout compact for mobile/header
- Active player indicator critical for turn awareness
- Dealer badge must be prominent (affects scoring)
- Viewer-relative positioning useful for spectators
- Wind positions fixed: East (right), South (bottom), West (left), North (top)
- Pulse animation on active player helps focus attention
- Consider accessibility of Chinese characters (screen readers may need labels)
- Prevailing wind displayed in center of circular layout
- Minimal variant removes names/avatars for space-constrained UI
