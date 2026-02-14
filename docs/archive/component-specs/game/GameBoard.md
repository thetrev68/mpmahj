# GameBoard

## Purpose

Main game container that orchestrates the 4-player cross layout, central wall, and phase overlays. Renders from server-authoritative snapshots and events.

## User Stories

- All stories - main game interface
- US-001: Game setup and dice roll
- US-002-008: Charleston phase UI
- US-009-018: Playing phase UI
- US-030: Player seating arrangement

## Props

```typescript
interface GameBoardProps {
  /** Latest server snapshot (authoritative) */
  snapshot: GameStateSnapshot;

  /** Optional hint data for current player */
  hint?: HintData | null;

  /** Optional move history list (public summaries) */
  history?: MoveHistorySummary[];

  /** Callback for sending commands */
  onCommand: (command: GameCommand) => void;
}
```

## Behavior

### Player Positioning

Seat players in cross layout based on `Seat` order, with the current player (from `snapshot.your_seat`) always at bottom.

- **Bottom**: Current player (always bottom)
- **Right**: Player to the right (clockwise)
- **Top**: Player across
- **Left**: Player to the left (counter-clockwise)

### Phase-Specific Rendering

#### WaitingForPlayers

- Show "Waiting for players..." message
- Display seated players and empty seats

#### Setup

- Show dice roll animation (center)
- Indicate wall break position
- Brief "Dealing tiles..." message

#### Charleston

- Show `<TileSelectionPanel>` for current player
- Show `<CharlestonTracker>` (stage indicator)
- Show `<CharlestonTimer>` (countdown, using server `started_at_ms` and `TimerMode`)
- Show `<VotePanel>` during `CharlestonStage::VotingToContinue`

#### Playing

- Show `<ActionBar>` at bottom (Discard, Call, etc.)
- Highlight active player's rack
- Show `<CallWindowPanel>` when `TurnStage::CallWindow`
- Display wall counter in center

#### Scoring

- Show `<WinnerCelebration>` overlay
- Display `<ScoreDisplay>` breakdown

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

```text
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
function getPlayerPosition(mySeat: Seat, players: PublicPlayerInfo[]): PlayerPositions {
  const order: Seat[] = ['South', 'West', 'North', 'East'];
  const startIndex = order.indexOf(mySeat);

  const seatAt = (offset: number) => order[(startIndex + offset) % 4];

  return {
    bottom: players.find((p) => p.seat === seatAt(0)),
    right: players.find((p) => p.seat === seatAt(1)),
    top: players.find((p) => p.seat === seatAt(2)),
    left: players.find((p) => p.seat === seatAt(3)),
  };
}
```

### Phase-Based Rendering

```typescript
function renderCentralArea(phase: GamePhase, snapshot: GameStateSnapshot) {
  if (phase && typeof phase === 'object' && 'Setup' in phase) {
    return <DiceOverlay isOpen={true} rollTotal={7} />;
  }

  if (phase && typeof phase === 'object' && 'Charleston' in phase) {
    return <CharlestonTimer secondsRemaining={snapshot.charleston_state?.timer ?? 0} totalSeconds={snapshot.house_rules.ruleset.charleston_timer_seconds} isActive={true} />;
  }

  if (phase && typeof phase === 'object' && 'Playing' in phase) {
    return <WallCounter remainingTiles={snapshot.wall_tiles_remaining} totalTiles={152} />;
  }

  return null;
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

- Game state managed by `useGameSocket()` hook via server events
- Local UI state (animations, transitions) managed internally
- Action dispatch via `onCommand` callback

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

```text

```
