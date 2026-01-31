# GameBoard

## Purpose

Main game container that orchestrates the 4-player cross layout, central wall, and game phase overlays. Handles responsive layout, player positioning, and phase-specific UI (Charleston, playing, scoring).

## User Stories

- All stories - main game interface
- US-001: Game setup and dice roll
- US-002-008: Charleston phase UI
- US-009-018: Playing phase UI
- US-030: Player seating arrangement

## Props

```typescript
interface GameBoardProps {
  // Game state
  gameState: GameState; // From backend: 'WaitingForPlayers' | 'Setup' | 'Charleston' | 'Playing' | 'Scoring' | 'GameOver'
  currentPlayerId: string;

  // Player data (all 4 players)
  players: PlayerData[];

  // Wall/tile data
  wallTilesRemaining: number;
  breakPosition?: number; // Where the wall was broken

  // Phase-specific data
  charlestonState?: CharlestonState;
  activePlayerId?: string; // Whose turn it is
  winnerData?: WinnerData;

  // Callbacks
  onAction: (action: GameAction) => void;
}

interface PlayerData {
  id: string;
  name: string;
  wind: WindDirection;
  isDealer: boolean;
  concealedTiles?: TileData[]; // Only for current player
  tileCount?: number; // For opponents
  exposedMelds: Meld[];
  discards: TileData[];
  score: number;
}

interface CharlestonState {
  stage:
    | 'FirstRight'
    | 'FirstAcross'
    | 'FirstLeft'
    | 'Voting'
    | 'SecondLeft'
    | 'SecondAcross'
    | 'SecondRight'
    | 'Courtesy';
  selectedTiles: number[];
  timeRemaining: number;
}

interface WinnerData {
  playerId: string;
  pattern: PatternData;
  score: number;
  hand: TileData[];
}
```

## Behavior

### Player Positioning

Seat players in cross layout based on wind direction:

- **Bottom**: Current player (always bottom)
- **Right**: Player to the right (clockwise)
- **Top**: Player across
- **Left**: Player to the left (counter-clockwise)

### Phase-Specific Rendering

#### WaitingForPlayers

- Show "Waiting for players..." message
- Display seated players and empty seats
- Show "Ready" status for each player

#### Setup

- Show dice roll animation (center)
- Indicate wall break position
- Brief "Dealing tiles..." message

#### Charleston

- Show `<TileSelectionPanel>` for current player
- Show `<CharlestonTracker>` (stage indicator)
- Show `<CharlestonTimer>` (countdown)
- Show `<VotePanel>` during voting stage

#### Playing

- Show `<ActionBar>` at bottom (Discard, Call, etc.)
- Highlight active player's rack
- Show `<CallWindowPanel>` when calls are available
- Display wall counter in center

#### Scoring

- Show `<WinnerCelebration>` overlay
- Display `<ScoreDisplay>` breakdown
- Show winner's hand with pattern

#### GameOver

- Show final scores for all players
- "New Game" button

### Central Area

Display phase-appropriate content in the center of the board:

- **Wall counter**: Tiles remaining (Playing phase)
- **Dice**: Dice roll animation (Setup phase)
- **Timer**: Charleston countdown (Charleston phase)
- **Empty**: (most phases)

### Responsive Layout

- **Desktop**: 1200×900px board, large tiles
- **Tablet**: 900×700px board, medium tiles
- **Mobile**: Stack player racks vertically (?)

## Visual Requirements

### Layout Structure

```
┌─────────────────────────────────────┐
│         [Top Opponent Rack]         │
│                                     │
│  [Left     [Central Area]    [Right│
│  Opponent   Wall/Timer      Opponent│
│   Rack]                       Rack] │
│                                     │
│      [Bottom - Current Player]      │
│         [Action Bar]                │
└─────────────────────────────────────┘
```

### Spacing & Sizing

- Center area: 400×400px (square)
- Player racks: 200px height each
- Gaps: 16px between racks and center
- Border: 8px padding around entire board

### Background

- Green felt texture (classic Mahjong table)
- Subtle gradient or pattern
- Non-distracting (tiles are focus)

### Animations

- Phase transitions: Fade in/out (300ms)
- Player turn change: Highlight sweep (500ms)
- Dice roll: 3D dice animation (1s)

## Related Components

- **Uses**: `<PlayerRack>` (×4, one per player)
- **Uses**: `<ActionBar>` (bottom action buttons)
- **Uses**: `<WallCounter>` (center area)
- **Uses**: `<DiceOverlay>` (setup phase)
- **Uses**: `<CharlestonTracker>` (charleston phase)
- **Uses**: `<CharlestonTimer>` (charleston phase)
- **Uses**: `<TileSelectionPanel>` (charleston phase)
- **Uses**: `<VotePanel>` (charleston voting)
- **Uses**: `<WinnerCelebration>` (scoring phase)
- **Uses**: `<CallWindowPanel>` (playing phase)
- **Used by**: Main game screen/page

## Implementation Notes

### Player Positioning Logic

```typescript
function getPlayerPosition(currentPlayerId: string, players: PlayerData[]): PlayerPositions {
  const currentIndex = players.findIndex((p) => p.id === currentPlayerId);

  return {
    bottom: players[currentIndex],
    right: players[(currentIndex + 1) % 4],
    top: players[(currentIndex + 2) % 4],
    left: players[(currentIndex + 3) % 4],
  };
}
```

### Phase-Based Rendering

```typescript
function renderCentralArea(gameState: string, props: GameBoardProps) {
  switch (gameState) {
    case 'Setup':
      return <DiceOverlay roll={props.diceRoll} />;
    case 'Charleston':
      return <CharlestonTimer timeRemaining={props.charlestonState.timeRemaining} />;
    case 'Playing':
      return <WallCounter remaining={props.wallTilesRemaining} />;
    case 'Scoring':
      return null;  // Winner celebration is full-screen overlay
    default:
      return null;
  }
}
```

### Responsive Breakpoints

```typescript
// Tailwind config
screens: {
  'sm': '640px',   // Mobile
  'md': '768px',   // Tablet
  'lg': '1024px',  // Small desktop
  'xl': '1280px',  // Large desktop
  '2xl': '1536px'  // Extra large
}
```

### State Management

- Game state managed by `useGameSocket()` hook
- Local UI state (animations, transitions) managed internally
- Action dispatch via `onAction` callback

### Performance

- Memoize player racks if player data unchanged
- Use CSS Grid for layout (not flexbox)
- Lazy load phase-specific components (code splitting)

### Accessibility

- ARIA label: "Mahjong game board, {gameState} phase"
- ARIA live region for turn announcements
- Keyboard navigation between player racks
- Focus trap during modals (Charleston voting, etc.)

## Testing Considerations

- Verify player positioning for all 4 seats
- Test phase transitions (Charleston → Playing, etc.)
- Validate responsive layout at different screen sizes
- Test with 1-4 players (waiting state)
- Edge case: Reconnection mid-game
- Edge case: Player disconnection (bot takeover)

## Example Usage

```tsx
<GameBoard
  gameState="Playing"
  currentPlayerId="player1"
  players={allPlayers}
  wallTilesRemaining={72}
  breakPosition={42}
  activePlayerId="player2"
  onAction={handleGameAction}
/>

// Charleston phase
<GameBoard
  gameState="Charleston"
  currentPlayerId="player1"
  players={allPlayers}
  charlestonState={{
    stage: 'FirstRight',
    selectedTiles: [2, 5, 8],
    timeRemaining: 45
  }}
  onAction={handleCharlestonAction}
/>
```

## Edge Cases

1. **3 players**: Show empty seat placeholder, disable game start
2. **Player reconnection**: Smoothly restore their rack without flicker
3. **Bot players**: Visual indicator (icon, badge) for bots
4. **Spectator mode**: View-only, no action bar
5. **Replay mode**: Show historical state with scrubber controls

---

**Estimated Complexity**: High (~120-150 lines implementation)
**Dependencies**: `<PlayerRack>`, `<ActionBar>`, `<WallCounter>`, phase-specific components
**Phase**: Phase 1 - MVP Core
