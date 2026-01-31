# GameBoard Component Specification

## Component Type

Presentational Component (Composition Container)

## Purpose

Central game table layout component that arranges all gameplay elements (player hands, discard pile, wall, wind indicator, scores) in a traditional Mahjong table layout. Handles responsive sizing, player positioning, and visual representation of the game state.

## Related User Stories

- US-001: Create Game Room (visual representation of game table)
- US-004: Wall and Deal (display initial wall and distribution)
- US-006: Discard Tile (central discard pile display)
- US-007: Call Mahjong (game board shows winning state)
- US-024: Mobile Responsive (adaptive layout for all screen sizes)
- US-032: Visual Themes (themed game board backgrounds)

## TypeScript Interface

```typescript
export interface GameBoardProps {
  /** Current game state */
  gameState: GameState;

  /** Current player's seat (for perspective) */
  playerSeat: Wind;

  /** Table layout style */
  layout?: 'traditional' | 'modern' | 'compact';

  /** Show visual effects */
  showEffects?: boolean;

  /** Tile size multiplier (0.5-2.0) */
  tileScale?: number;

  /** Callback when player selects tile */
  onTileSelect?: (tile: number) => void;

  /** Callback when player action taken */
  onAction?: (action: GameAction) => void;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export interface GameState {
  /** Current game phase */
  phase: GamePhase;

  /** Players in game */
  players: PlayerState[];

  /** Discard pile */
  discards: DiscardTile[];

  /** Wall tiles remaining */
  wallRemaining: number;

  /** Current turn */
  currentTurn: Wind;

  /** Prevailing wind */
  prevailingWind: Wind;

  /** Round number */
  round: number;
}

export interface PlayerState {
  seat: Wind;
  name: string;
  hand: number[];
  exposed: Meld[];
  flowers: number[];
  score: number;
  isDealer: boolean;
  isActive: boolean;
}

export interface DiscardTile {
  tile: number;
  player: Wind;
  timestamp: number;
  isCallable: boolean;
}

export type Wind = 'East' | 'South' | 'West' | 'North';

export enum GamePhase {
  Charleston = 'Charleston',
  Playing = 'Playing',
  Ended = 'Ended',
}
```text

## Internal State

```typescript
interface GameBoardState {
  /** Selected tiles in hand */
  selectedTiles: number[];

  /** Hovered tile */
  hoveredTile: number | null;

  /** Animation state */
  activeAnimations: Set<string>;
}
```text

## State Management

**Internal useState** for tile selection and hover. Game state from parent component.

## Visual Design

### Traditional Layout

```text
+-----------------------------------------------------+
|                    NORTH PLAYER                     |
|     [Wind=N] Score: 0                              |
|     [🀇🀈🀉🀊🀋🀌🀍🀎🀏🀐🀑🀒🀓]                     |
|                 [Exposed Meld]                      |
+-----------------------------------------------------+
|                                                     |
|  WEST      +-------------------------+       EAST  |
|  [W]       |                         |       [E]   |
|  Score:0   |      DISCARD PILE       |    Score:0  |
|            |                         |             |
| [🀐🀑🀒🀓]  |   [🀀🀁🀂🀃🀄🀅🀆🀇]      | [🀈🀉🀊🀋]   |
| [Exposed]  |   [🀌🀍🀎🀏🀐🀑🀒🀓]      | [Exposed]   |
|            |                         |             |
|            |   Wall: 88 tiles        |             |
|            |   Round: East 1         |             |
|            +-------------------------+             |
|                                                     |
+-----------------------------------------------------+
|                 [Exposed Meld]                      |
|     [🀇🀈🀉🀊🀋🀌🀍🀎🀏🀐🀑🀒🀓🀔]                   |
|     [Wind=E] ⭐ DEALER • YOU                        |
|                    SOUTH PLAYER                     |
|                   [Action Buttons]                  |
+-----------------------------------------------------+
```text

### Component Placement

#### Table Center (Discard Pile Area)

- **Discard pile**: Grid of discarded tiles, newest at bottom-right
- **Wall indicator**: "88 tiles remaining"
- **Round indicator**: "East 1" with wind icon
- **Turn indicator**: Highlight active player

#### Player Areas (Four Sides)

#### South (Current Player - Bottom)

- Player name + "YOU" badge
- Dealer indicator (⭐) if applicable
- Hand tiles (face-up, interactive)
- Exposed melds (face-up, grouped)
- Flowers/seasons (face-up, separate)
- Action buttons (Discard, Mahjong, etc.)
- Larger size (primary player)

#### East/West (Side Players - Left/Right)

- Player name + seat wind
- Score display
- Hand tiles (face-down, count only)
- Exposed melds (face-up)
- Flowers (face-up)
- Vertical orientation for hands
- Medium size

#### North (Opposite Player - Top)

- Player name + seat wind
- Score display
- Hand tiles (face-down, count only)
- Exposed melds (face-up)
- Flowers (face-up)
- Horizontal orientation for hands
- Medium size

### Responsive Layouts

#### Desktop (≥1200px) - Traditional

- Square table layout
- All four players visible
- Large tile size (64px)
- Full action buttons with text

#### Tablet (768-1199px) - Modern

- Landscape rectangle layout
- Side players compressed
- Medium tile size (48px)
- Compact action buttons

#### Mobile (≤767px) - Compact

- Vertical stack layout
- Current player + one opponent
- Small tile size (32px)
- Minimal action buttons
- Swipe to see other players

### Visual Effects

#### Turn Indicator

- Glowing border around active player's area
- Pulsing wind indicator
- Color: `var(--color-primary)` with 50% opacity

#### Discard Animation

- Tile flies from hand to discard pile
- Duration: 400ms
- Easing: ease-out

#### Deal Animation

- Tiles appear from wall to hands
- Stagger: 50ms per tile
- Fade + slide effect

#### Mahjong Celebration

- Winning hand pulses
- Confetti animation
- Green glow around winning tiles

### Color Coding

#### Player Areas

- Current player: `var(--color-primary-light)` background
- Active turn: `var(--color-primary)` border (3px)
- Dealer: Gold star badge
- Inactive: `var(--color-background-secondary)`

#### Discard Pile

- Recent discard: `var(--color-warning)` glow
- Callable tile: `var(--color-primary)` border
- Old discards: Normal appearance

#### Wall

- Remaining count color-coded:
  - 60+: Green (plenty)
  - 30-59: Yellow (moderate)
  - <30: Red (running low)

## Accessibility

### ARIA Attributes

- `role="region"` for game board
- `aria-label="Mahjong game table"` for container
- `aria-label="Player hand - {name}"` for each player area
- `aria-label="Discard pile - {count} tiles"` for discard area
- `aria-live="polite"` for turn changes
- `aria-current="true"` for active player

### Keyboard Support

- **Tab**: Navigate between interactive areas (hand, actions, opponents)
- **Arrow Keys**: Navigate tiles within hand
- **Enter/Space**: Select focused tile
- **M**: Call Mahjong (if available)
- **D**: Discard selected tile
- **Escape**: Cancel selection

### Screen Reader Support

- Announce turn changes: "North player's turn"
- Announce discards: "West discarded 5 Bam"
- Announce calls: "South called Pung with 3 Crak"
- Announce Mahjong: "East player wins with 45 points"
- Provide hand summary: "Your hand: 13 tiles, 2 exposed melds"

### Visual Accessibility

- High contrast player areas
- Clear turn indicator (not color-only)
- Large touch targets (48px minimum)
- Text labels for all icons
- Support for reduced motion

## Dependencies

### External

- React (hooks: `useState`, `useEffect`, `useMemo`, `useCallback`)
- `clsx` for conditional class names

### Internal

- `@/components/game/PlayerHand` - Player hand display
- `@/components/game/DiscardPile` - Discard pile display
- `@/components/game/ExposedMelds` - Exposed melds display
- `@/components/game/WindIndicator` - Wind/round display
- `@/components/game/ActionButtons` - Player action buttons
- `@/components/ui/Badge` - Dealer/YOU badges
- `@/utils/layoutUtils` - Player positioning
- `@/utils/animationUtils` - Tile animations
- `@/styles/gameBoard.module.css` - Component styles

### Generated Types

- `@/types/bindings/generated/GamePhase.ts`
- `@/types/bindings/generated/Wind.ts`
- `@/types/bindings/generated/GameEvent.ts`

## Implementation Notes

### Player Positioning

```typescript
const getPlayerPosition = (
  seat: Wind,
  currentPlayerSeat: Wind
): 'bottom' | 'left' | 'top' | 'right' => {
  const seatOrder: Wind[] = ['East', 'South', 'West', 'North'];
  const currentIndex = seatOrder.indexOf(currentPlayerSeat);
  const targetIndex = seatOrder.indexOf(seat);

  // Rotate seats so current player is always at bottom
  const relativePosition = (targetIndex - currentIndex + 4) % 4;

  const positions = ['bottom', 'left', 'top', 'right'];
  return positions[relativePosition] as 'bottom' | 'left' | 'top' | 'right';
};
```text

### Discard Pile Layout

```typescript
const layoutDiscards = (discards: DiscardTile[]): DiscardTile[][] => {
  const rows: DiscardTile[][] = [];
  const tilesPerRow = 8;

  for (let i = 0; i < discards.length; i += tilesPerRow) {
    rows.push(discards.slice(i, i + tilesPerRow));
  }

  return rows;
};
```text

### Tile Animation

```typescript
const animateTileDiscard = (
  tileElement: HTMLElement,
  fromPosition: { x: number; y: number },
  toPosition: { x: number; y: number }
) => {
  const deltaX = toPosition.x - fromPosition.x;
  const deltaY = toPosition.y - fromPosition.y;

  tileElement.animate(
    [{ transform: 'translate(0, 0)' }, { transform: `translate(${deltaX}px, ${deltaY}px)` }],
    {
      duration: 400,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards',
    }
  );
};
```text

### Responsive Scaling

```typescript
const calculateTileScale = (containerWidth: number, layout: Layout): number => {
  // Base tile width: 64px
  const baseTileWidth = 64;
  const handTileCount = 14;
  const minSpacing = 8;

  const availableWidth = containerWidth * 0.8; // 80% of container
  const requiredWidth = baseTileWidth * handTileCount + minSpacing * (handTileCount - 1);

  const scale = Math.min(1.5, Math.max(0.5, availableWidth / requiredWidth));

  return scale;
};
```text

## Test Scenarios

### Unit Tests

```typescript
describe('GameBoard', () => {
  it('renders all player areas', () => {
    // Should display 4 player areas for 4 players
  });

  it('positions current player at bottom', () => {
    // Player with playerSeat should always be at bottom
  });

  it('rotates player positions correctly', () => {
    // Other players positioned relative to current player
  });

  it('displays dealer indicator', () => {
    // Dealer badge shown for player with isDealer=true
  });

  it('highlights active turn', () => {
    // Player with currentTurn should have highlighted border
  });

  it('shows discard pile', () => {
    // Discards array should be displayed in center
  });

  it('displays wall count', () => {
    // wallRemaining should be shown
  });

  it('shows round indicator', () => {
    // Round and prevailing wind should be displayed
  });

  it('handles tile selection', () => {
    // Clicking tile should call onTileSelect
  });

  it('handles player actions', () => {
    // Action buttons should call onAction
  });

  it('scales tiles responsively', () => {
    // tileScale should adjust tile sizes
  });
});
```text

### Integration Tests

```typescript
describe('GameBoard Integration', () => {
  it('updates on game state change', () => {
    // Component should re-render with new gameState
  });

  it('animates tile discard', () => {
    // Discard action should trigger animation
  });

  it('shows Mahjong celebration', () => {
    // Winning state should show celebration effects
  });

  it('handles Charleston phase', () => {
    // Charleston phase should show passing UI
  });
});
```text

### Visual Regression Tests

- All layouts (traditional, modern, compact)
- All screen sizes (desktop, tablet, mobile)
- All game phases (Charleston, Playing, Ended)
- Turn indicators and highlights
- Dealer indicators
- Discard pile layouts (empty, partial, full)
- Animation states

## Usage Examples

### Basic Game Board

```tsx
import { GameBoard } from '@/components/game/GameBoard';

function GameView({ game }) {
  const handleTileSelect = (tile: number) => {
    setSelectedTiles((prev) =>
      prev.includes(tile) ? prev.filter((t) => t !== tile) : [...prev, tile]
    );
  };

  const handleAction = (action: GameAction) => {
    sendGameCommand(action);
  };

  return (
    <GameBoard
      gameState={game}
      playerSeat={game.currentPlayerSeat}
      layout="traditional"
      showEffects
      onTileSelect={handleTileSelect}
      onAction={handleAction}
    />
  );
}
```text

### Responsive Mobile Board

```tsx
function MobileGame({ game }) {
  return (
    <GameBoard
      gameState={game}
      playerSeat={game.currentPlayerSeat}
      layout="compact"
      tileScale={0.8}
      showEffects={false} // Disable for performance
    />
  );
}
```text

### Spectator View

```tsx
function SpectatorBoard({ game, viewingSeat }) {
  return (
    <GameBoard
      gameState={game}
      playerSeat={viewingSeat}
      layout="modern"
      showEffects
      // No onTileSelect or onAction (read-only)
    />
  );
}
```text

### Replay Viewer

```tsx
function ReplayViewer({ gameHistory, currentTurn }) {
  const gameState = gameHistory[currentTurn];

  return (
    <GameBoard gameState={gameState} playerSeat="East" layout="traditional" showEffects={false} />
  );
}
```text

## Style Guidelines

### CSS Module Structure

```css
.game-board {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1; /* Square board */
  background: var(--color-background-board);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.game-board--traditional {
  display: grid;
  grid-template-areas:
    'north-left north-center north-right'
    'west-center center east-center'
    'south-left south-center south-right';
  grid-template-columns: 1fr 2fr 1fr;
  grid-template-rows: 1fr 2fr 1fr;
  gap: var(--space-4);
  padding: var(--space-4);
}

.game-board--modern {
  display: grid;
  grid-template-areas:
    'north'
    'center'
    'south';
  grid-template-rows: auto 1fr auto;
  gap: var(--space-3);
  padding: var(--space-3);
}

.game-board--compact {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2);
}

/* Center area */
.game-board__center {
  grid-area: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--space-4);
  background: var(--color-background-table);
  border-radius: var(--radius-md);
  border: 2px solid var(--color-border);
  padding: var(--space-6);
}

/* Discard pile */
.game-board__discards {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-width: 100%;
}

.game-board__discard-row {
  display: flex;
  gap: var(--space-1);
  justify-content: center;
}

/* Wall indicator */
.game-board__wall-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-background);
  border-radius: var(--radius-md);
}

.game-board__wall-count {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
}

.game-board__wall-count--plenty {
  color: var(--color-success);
}

.game-board__wall-count--moderate {
  color: var(--color-warning);
}

.game-board__wall-count--low {
  color: var(--color-error);
}

.game-board__round {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

/* Player areas */
.player-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-background);
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.player-area--bottom {
  grid-area: south-center;
  background: var(--color-primary-light);
}

.player-area--left {
  grid-area: west-center;
  writing-mode: vertical-rl;
}

.player-area--top {
  grid-area: north-center;
}

.player-area--right {
  grid-area: east-center;
  writing-mode: vertical-rl;
}

.player-area--active {
  border-color: var(--color-primary);
  box-shadow: 0 0 20px var(--color-primary-shadow);
  animation: pulse-border 2s ease-in-out infinite;
}

@keyframes pulse-border {
  0%,
  100% {
    box-shadow: 0 0 20px var(--color-primary-shadow);
  }
  50% {
    box-shadow: 0 0 30px var(--color-primary-shadow);
  }
}

/* Player header */
.player-area__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.player-area__info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.player-area__name {
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.player-area__wind {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-sm);
  font-weight: var(--font-bold);
}

.player-area__dealer {
  color: var(--color-warning);
  font-size: var(--text-lg);
}

.player-area__score {
  font-weight: var(--font-bold);
  color: var(--color-text-secondary);
}

/* Player content */
.player-area__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.player-area__hand {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.player-area__exposed {
  display: flex;
  gap: var(--space-3);
}

.player-area__flowers {
  display: flex;
  gap: var(--space-1);
}

/* Actions */
.player-area__actions {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

/* Tile scale */
.game-board[data-tile-scale='0.5'] {
  --tile-width: 32px;
  --tile-height: 43px;
}

.game-board[data-tile-scale='0.75'] {
  --tile-width: 48px;
  --tile-height: 64px;
}

.game-board[data-tile-scale='1'] {
  --tile-width: 64px;
  --tile-height: 86px;
}

.game-board[data-tile-scale='1.5'] {
  --tile-width: 96px;
  --tile-height: 128px;
}

/* Animations */
@keyframes tile-discard {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(var(--target-x), var(--target-y)) scale(0.8);
    opacity: 1;
  }
}

@keyframes tile-deal {
  0% {
    transform: translateY(-100px) scale(0);
    opacity: 0;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

@keyframes mahjong-celebration {
  0%,
  100% {
    box-shadow: 0 0 20px var(--color-success);
  }
  50% {
    box-shadow: 0 0 40px var(--color-success);
  }
}

/* Responsive */
@media (max-width: 1199px) {
  .game-board--traditional {
    grid-template-columns: 1fr 3fr 1fr;
  }
}

@media (max-width: 767px) {
  .game-board {
    aspect-ratio: auto;
    min-height: 100vh;
  }

  .game-board--traditional,
  .game-board--modern {
    display: flex;
    flex-direction: column;
  }

  .player-area--left,
  .player-area--right {
    writing-mode: horizontal-tb;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .player-area--active {
    animation: none;
  }

  .game-board__center {
    transition: none;
  }
}
```text

## Future Enhancements

- [ ] 3D table perspective mode
- [ ] Customizable table backgrounds (wood, felt, marble)
- [ ] Sound effects for tile actions
- [ ] Replay controls (pause, step, speed)
- [ ] Player avatars and customization
- [ ] Chat bubbles for player communication
- [ ] Game statistics overlay
- [ ] Tutorial overlay mode
- [ ] Picture-in-picture for mobile multitasking
- [ ] VR/AR table view
- [ ] Table rotation animation (between rounds)
- [ ] Tile shuffle animation (start of game)
- [ ] Wind direction indicator animation
- [ ] Score calculation animation
- [ ] Multi-table tournament view
- [ ] Spectator mode with player card highlights

## Notes

- Game board is the primary container for all gameplay UI
- Always position current player at bottom for consistent perspective
- Side players (East/West) use vertical text orientation on desktop
- Mobile layout stacks players vertically
- Turn indicator must be clearly visible (not color-only)
- Discard pile grows from top-left to bottom-right (reading order)
- Wall count color-coded to warn players of endgame
- Dealer star badge always visible
- Tile animations enhance UX but must respect prefers-reduced-motion
- Component composes many sub-components (hands, melds, actions)
- Responsive scaling critical for usability across devices
- Touch targets must be at least 48px on mobile
- Keyboard navigation essential for accessibility
- Screen reader must announce all game events
- Layout must work in both landscape and portrait
- Consider cultural table preferences (Chinese vs. American style)
- Support for custom table felt colors/patterns
- High-DPI tile rendering for 4K displays
- Smooth 60fps animations on modern devices
- Fallback to static layout for low-end devices
