# Phase 2: Game Status Display - Implementation Guide

## Implementation Status

**Status:** ✅ COMPLETE

**Implemented:** 2026-01-24

**Files Created:**

- `apps/client/src/utils/phaseFormatter.ts` - GamePhase formatting utility
- `apps/client/src/utils/turnFormatter.ts` - Turn indicator formatting utility
- `apps/client/src/utils/wallFormatter.ts` - Wall remaining formatting utility
- `apps/client/src/components/GameStatus.tsx` - Main GameStatus component
- `apps/client/src/components/GameStatus.css` - Component styling

**Files Updated:**

- `apps/client/src/App.tsx` - Integrated GameStatus component

**Verification:**

- TypeScript compilation: ✅ No errors
- Build: ✅ Success (vite build completed in 902ms)
- Integration: ✅ Component displays when `yourSeat` is set

---

## Overview

Build the **GameStatus** component to display:

- Current game phase with human-readable text
- Turn indicator with "YOUR TURN" highlight
- Wall remaining count with draw percentage
- Player status table showing all 4 seats

This component provides the core game state visibility needed for testing gameplay.

---

## Quick Reference

### Type Definitions

```typescript
// From generated bindings
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { SetupStage } from '@/types/bindings/generated/SetupStage';
import type { GameResult } from '@/types/bindings/generated/GameResult';
import type { WinContext } from '@/types/bindings/generated/WinContext';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { PublicPlayerInfo } from '@/types/bindings/generated/PublicPlayerInfo';
import type { PlayerStatus } from '@/types/bindings/generated/PlayerStatus';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { CallIntent } from '@/types/bindings/generated/CallIntent';
import type { Tile } from '@/types/bindings/generated/Tile';

// GamePhase variants
type GamePhase =
  | 'WaitingForPlayers'
  | { Setup: SetupStage }
  | { Charleston: CharlestonStage }
  | { Playing: TurnStage }
  | { Scoring: WinContext }
  | { GameOver: GameResult };

// SetupStage variants
type SetupStage = 'RollingDice' | 'BreakingWall' | 'Dealing' | 'OrganizingHands';

// CharlestonStage variants
type CharlestonStage =
  | 'FirstRight'
  | 'FirstAcross'
  | 'FirstLeft'
  | 'VotingToContinue'
  | 'SecondLeft'
  | 'SecondAcross'
  | 'SecondRight'
  | 'CourtesyAcross'
  | 'Complete';

// TurnStage variants
type TurnStage =
  | { Drawing: { player: Seat } }
  | { Discarding: { player: Seat } }
  | {
      CallWindow: {
        tile: Tile;
        discarded_by: Seat;
        can_act: Seat[];
        pending_intents: CallIntent[];
        timer: number;
      };
    }
  | { AwaitingMahjong: { caller: Seat; tile: Tile; discarded_by: Seat } };

// Seat type
type Seat = 'East' | 'South' | 'West' | 'North';

// PlayerStatus type
type PlayerStatus = 'Active' | 'Dead' | 'Waiting' | 'Disconnected';

// PublicPlayerInfo structure
interface PublicPlayerInfo {
  seat: Seat;
  player_id: string;
  is_bot: boolean;
  status: PlayerStatus;
  tile_count: number;
  exposed_melds: Meld[];
}

// Meld structure
interface Meld {
  meld_type: 'Pung' | 'Kong' | 'Quint' | 'Sextet';
  tiles: Tile[];
  called_tile: Tile | null;
  joker_assignments: Record<number, Tile>;
}
```

### Store Access

```typescript
// From gameStore
const phase = useGameStore((state) => state.phase);
const currentTurn = useGameStore((state) => state.currentTurn);
const dealer = useGameStore((state) => state.dealer);
const remainingTiles = useGameStore((state) => state.remainingTiles);
const players = useGameStore((state) => state.players); // Record<Seat, PublicPlayerInfo>
const yourSeat = useGameStore((state) => state.yourSeat);
const isMyTurn = useGameStore((state) => state.isMyTurn());
```

### Wall Calculations

```typescript
// Constants for wall calculations
const TOTAL_TILES = 152; // Full American Mahjong set
const DEAD_WALL = 14; // Reserved for replacements (Flowers, Kongs)
const DEALT_TILES = 52; // 13 per player
const DRAWABLE_TILES = TOTAL_TILES - DEAD_WALL - DEALT_TILES; // 86 tiles

// remainingTiles from store already excludes the dead wall.
// Calculate percentage drawn from the drawable wall:
const percentDrawn = Math.floor(((DRAWABLE_TILES - remainingTiles) / DRAWABLE_TILES) * 100);
```

---

## Component Specification

### File Location

`apps/client/src/components/GameStatus.tsx`

### Component Interface

```typescript
interface GameStatusProps {
  // No props needed - reads from stores directly
}

export function GameStatus(): JSX.Element;
```

### Visual Layout

```text
┌─────────────────────────────────────────────────┐
│ GAME STATUS                                     │
│                                                 │
│ Phase: Charleston: Pass Right (1st)            │
│ Turn: East (YOUR TURN)                          │
│ Wall: 72 tiles remaining (16% drawn)            │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ PLAYERS                                     │ │
│ ├─────┬───────┬───────┬──────────┬────────────┤ │
│ │ Seat│ Tiles │ Melds │ Status   │ Info       │ │
│ ├─────┼───────┼───────┼──────────┼────────────┤ │
│ │ East│  14   │   0   │ Active   │ Dealer     │ │
│ │ South│  13   │   0   │ Active   │            │ │
│ │ West│  13   │   0   │ Active   │ Bot        │ │
│ │ North│  13   │   0   │ Active   │ Bot        │ │
│ └─────┴───────┴───────┴──────────┴────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Implementation Details

### Phase Formatting

Port the formatting logic from the former terminal UI (now removed).

**File**: `apps/client/src/utils/phaseFormatter.ts`

```typescript
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { SetupStage } from '@/types/bindings/generated/SetupStage';

/**
 * Format GamePhase for human-readable display.
 *
 * Ported from former terminal UI: format_phase()
 */
export function formatPhase(phase: GamePhase): string {
  // String literal phases
  if (phase === 'WaitingForPlayers') {
    return 'Waiting for players';
  }

  // Object phases
  if (typeof phase === 'object') {
    if ('Setup' in phase) {
      return formatSetupStage(phase.Setup);
    }
    if ('Charleston' in phase) {
      return formatCharlestonStage(phase.Charleston);
    }
    if ('Playing' in phase) {
      return formatTurnStage(phase.Playing);
    }
    if ('Scoring' in phase) {
      return 'Scoring';
    }
    if ('GameOver' in phase) {
      return 'Game Over';
    }
  }

  return 'Unknown';
}

/**
 * Format Setup stage.
 */
function formatSetupStage(stage: SetupStage): string {
  return `Setup: ${stage}`;
}

/**
 * Format Charleston stage.
 *
 * Ported from former terminal UI: format_charleston_stage()
 */
function formatCharlestonStage(stage: CharlestonStage): string {
  switch (stage) {
    case 'FirstRight':
      return 'Charleston: Pass Right (1st)';
    case 'FirstAcross':
      return 'Charleston: Pass Across (1st)';
    case 'FirstLeft':
      return 'Charleston: Pass Left (1st)';
    case 'VotingToContinue':
      return 'Charleston: Voting';
    case 'SecondLeft':
      return 'Charleston: Pass Left (2nd)';
    case 'SecondAcross':
      return 'Charleston: Pass Across (2nd)';
    case 'SecondRight':
      return 'Charleston: Pass Right (2nd)';
    case 'CourtesyAcross':
      return 'Charleston: Courtesy Pass';
    case 'Complete':
      return 'Charleston: Complete';
    default:
      return `Charleston: ${stage}`;
  }
}

/**
 * Format Turn stage during main gameplay.
 *
 * Ported from former terminal UI: format_turn_stage()
 */
function formatTurnStage(stage: TurnStage): string {
  if ('Drawing' in stage) {
    return `${stage.Drawing.player} drawing`;
  }
  if ('Discarding' in stage) {
    return `${stage.Discarding.player} discarding`;
  }
  if ('CallWindow' in stage) {
    return `Call window (${stage.CallWindow.discarded_by}'s discard)`;
  }
  if ('AwaitingMahjong' in stage) {
    return `${stage.AwaitingMahjong.caller} awaiting mahjong`;
  }
  return 'Unknown turn stage';
}
```

---

### Turn Indicator

Show whose turn it is with "YOUR TURN" highlight.

**File**: `apps/client/src/utils/turnFormatter.ts`

```typescript
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

/**
 * Format turn information with "YOUR TURN" highlight.
 *
 * Ported from former terminal UI: format_turn()
 */
export function formatTurn(phase: GamePhase, yourSeat: Seat | null): string {
  // Playing phase
  if (typeof phase === 'object' && 'Playing' in phase) {
    const stage = phase.Playing;
    const activePlayer = getActivePlayer(stage);

    // Direct player action (Drawing or Discarding)
    if (activePlayer && yourSeat && activePlayer === yourSeat) {
      return `${activePlayer} (YOUR TURN)`;
    }
    if (activePlayer) {
      return activePlayer;
    }

    // Call window
    if ('CallWindow' in stage && yourSeat) {
      if (stage.CallWindow.can_act.includes(yourSeat)) {
        return 'Call window (YOU CAN ACT)';
      }
      return 'Call window (waiting)';
    }

    return 'Call window';
  }

  // Charleston phase
  if (typeof phase === 'object' && 'Charleston' in phase && yourSeat) {
    return 'Select tiles to pass';
  }

  return '-';
}

/**
 * Get the active player from TurnStage.
 */
function getActivePlayer(stage: TurnStage): Seat | null {
  if ('Drawing' in stage) {
    return stage.Drawing.player;
  }
  if ('Discarding' in stage) {
    return stage.Discarding.player;
  }
  return null;
}

/**
 * Check if it's your turn for styling purposes.
 */
export function isYourTurn(phase: GamePhase, yourSeat: Seat | null): boolean {
  if (!yourSeat || typeof phase !== 'object' || !('Playing' in phase)) {
    return false;
  }

  const stage = phase.Playing;
  const activePlayer = getActivePlayer(stage);
  return activePlayer === yourSeat;
}

/**
 * Check if you can act in a call window.
 */
export function canActInCallWindow(phase: GamePhase, yourSeat: Seat | null): boolean {
  if (!yourSeat || typeof phase !== 'object' || !('Playing' in phase)) {
    return false;
  }

  const stage = phase.Playing;
  if ('CallWindow' in stage) {
    return stage.CallWindow.can_act.includes(yourSeat);
  }

  return false;
}
```

---

### Wall Remaining Display

**File**: `apps/client/src/utils/wallFormatter.ts`

```typescript
/**
 * Format wall remaining count with draw percentage.
 *
 * Ported from former terminal UI: format_wall()
 */
export function formatWall(remainingTiles: number): string {
  const TOTAL_TILES = 152;
  const DEAD_WALL = 14;
  const DEALT_TILES = 52;
  const DRAWABLE_TILES = TOTAL_TILES - DEAD_WALL - DEALT_TILES; // 86

  // Calculate percentage drawn
  const drawn = DRAWABLE_TILES - remainingTiles;
  const percentDrawn = Math.floor((drawn / DRAWABLE_TILES) * 100);

  return `${remainingTiles} tiles remaining (${percentDrawn}% drawn)`;
}

/**
 * Get wall depletion as a fraction (0.0 to 1.0).
 */
export function getWallDepletion(remainingTiles: number): number {
  const DRAWABLE_TILES = 86;
  const drawn = DRAWABLE_TILES - remainingTiles;
  return drawn / DRAWABLE_TILES;
}
```

---

### Player Status Table

Display all 4 players with their current state.

**Component Section**:

```typescript
import type { Seat } from '@/types/bindings/generated/Seat';
import type { PublicPlayerInfo } from '@/types/bindings/generated/PublicPlayerInfo';
import { useGameStore } from '@/store/gameStore';

function PlayerTable() {
  const players = useGameStore((state) => state.players);
  const dealer = useGameStore((state) => state.dealer);
  const yourSeat = useGameStore((state) => state.yourSeat);

  const seats: Seat[] = ['East', 'South', 'West', 'North'];

  return (
    <div className="player-table">
      <h3>Players</h3>
      <table>
        <thead>
          <tr>
            <th>Seat</th>
            <th>Tiles</th>
            <th>Melds</th>
            <th>Status</th>
            <th>Info</th>
          </tr>
        </thead>
        <tbody>
          {seats.map((seat) => {
            const player = players[seat];
            if (!player) {
              return (
                <tr key={seat}>
                  <td>{seat}</td>
                  <td colSpan={4}>-</td>
                </tr>
              );
            }

            const isYou = seat === yourSeat;
            const isDealer = seat === dealer;
            const infoTags = [
              isDealer && 'Dealer',
              player.is_bot && 'Bot',
              isYou && 'You',
            ].filter(Boolean);

            return (
              <tr key={seat} className={isYou ? 'player-you' : ''}>
                <td>{seat}</td>
                <td>{player.tile_count}</td>
                <td>{player.exposed_melds.length}</td>
                <td>{player.status}</td>
                <td>{infoTags.join(', ')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Complete Component Example

**File**: `apps/client/src/components/GameStatus.tsx`

```typescript
import { useGameStore } from '@/store/gameStore';
import { formatPhase } from '@/utils/phaseFormatter';
import { formatTurn, isYourTurn, canActInCallWindow } from '@/utils/turnFormatter';
import { formatWall } from '@/utils/wallFormatter';
import type { Seat } from '@/types/bindings/generated/Seat';
import './GameStatus.css';

export function GameStatus() {
  const phase = useGameStore((state) => state.phase);
  const remainingTiles = useGameStore((state) => state.remainingTiles);
  const players = useGameStore((state) => state.players);
  const dealer = useGameStore((state) => state.dealer);
  const yourSeat = useGameStore((state) => state.yourSeat);

  const phaseText = formatPhase(phase);
  const turnText = formatTurn(phase, yourSeat);
  const wallText = formatWall(remainingTiles);
  const yourTurn = isYourTurn(phase, yourSeat);
  const canAct = canActInCallWindow(phase, yourSeat);

  const seats: Seat[] = ['East', 'South', 'West', 'North'];

  return (
    <div className="game-status">
      <h2>Game Status</h2>

      <div className="status-info">
        <div className="status-row">
          <span className="status-label">Phase:</span>
          <span className="status-value">{phaseText}</span>
        </div>

        <div className="status-row">
          <span className="status-label">Turn:</span>
          <span className={yourTurn || canAct ? 'status-value highlight-turn' : 'status-value'}>
            {turnText}
          </span>
        </div>

        <div className="status-row">
          <span className="status-label">Wall:</span>
          <span className="status-value">{wallText}</span>
        </div>
      </div>

      <div className="player-table">
        <h3>Players</h3>
        <table>
          <thead>
            <tr>
              <th>Seat</th>
              <th>Tiles</th>
              <th>Melds</th>
              <th>Status</th>
              <th>Info</th>
            </tr>
          </thead>
          <tbody>
            {seats.map((seat) => {
              const player = players[seat];

              if (!player) {
                return (
                  <tr key={seat} className="player-empty">
                    <td>{seat}</td>
                    <td colSpan={4}>-</td>
                  </tr>
                );
              }

              const isYou = seat === yourSeat;
              const isDealer = seat === dealer;
              const infoTags = [
                isDealer && 'Dealer',
                player.is_bot && 'Bot',
                isYou && 'You',
              ].filter(Boolean);

              return (
                <tr key={seat} className={isYou ? 'player-you' : ''}>
                  <td className="seat-cell">{seat}</td>
                  <td className="tiles-cell">{player.tile_count}</td>
                  <td className="melds-cell">{player.exposed_melds.length}</td>
                  <td className="status-cell">{player.status}</td>
                  <td className="info-cell">{infoTags.join(', ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## Styling Guidelines

**File**: `apps/client/src/components/GameStatus.css`

```css
.game-status {
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 1rem;
  background-color: #f9f9f9;
}

.game-status h2 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  color: #333;
}

.status-info {
  margin-bottom: 1.5rem;
}

.status-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-family: monospace;
}

.status-label {
  font-weight: bold;
  min-width: 60px;
}

.status-value {
  color: #555;
}

.highlight-turn {
  color: #28a745;
  font-weight: bold;
  background-color: #d4edda;
  padding: 2px 6px;
  border-radius: 3px;
}

/* Player Table */
.player-table {
  margin-top: 1rem;
}

.player-table h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
  color: #333;
}

.player-table table {
  width: 100%;
  border-collapse: collapse;
  font-family: monospace;
}

.player-table th {
  background-color: #007bff;
  color: white;
  padding: 0.5rem;
  text-align: left;
  font-weight: 600;
  border: 1px solid #0056b3;
}

.player-table td {
  padding: 0.5rem;
  border: 1px solid #ddd;
}

.player-table tbody tr {
  background-color: white;
}

.player-table tbody tr:hover {
  background-color: #f0f0f0;
}

.player-table tbody tr.player-you {
  background-color: #e7f3ff;
  font-weight: 600;
}

.player-table tbody tr.player-empty {
  color: #999;
  font-style: italic;
}

.seat-cell {
  font-weight: bold;
}

.tiles-cell,
.melds-cell {
  text-align: center;
}

.status-cell {
  color: #28a745;
}

.info-cell {
  font-size: 0.9em;
  color: #666;
}
```

---

## Integration with App.tsx

Update `apps/client/src/App.tsx`:

```typescript
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { GameStatus } from '@/components/GameStatus';
import { useGameStore } from '@/store/gameStore';

function App() {
  const yourSeat = useGameStore((state) => state.yourSeat);

  return (
    <div className="app-container">
      <header>
        <h1>Mahjong Client</h1>
      </header>

      <main>
        {/* Always show ConnectionPanel */}
        <ConnectionPanel />

        {/* Show GameStatus when in a room */}
        {yourSeat && <GameStatus />}

        {/* Future: HandDisplay, TurnActions, etc. */}
      </main>
    </div>
  );
}
```

---

## Testing Checklist

### Phase Display

- [ ] "Waiting for players" shows when phase is `WaitingForPlayers`
- [ ] Setup stages display correctly (RollingDice, BreakingWall, Dealing, OrganizingHands)
- [ ] Charleston stages display correctly (FirstRight, FirstAcross, FirstLeft, etc.)
- [ ] Playing stages display correctly (Drawing, Discarding, CallWindow)
- [ ] Scoring phase shows "Scoring"
- [ ] GameOver shows "Game Over"

### Turn Indicator\*

- [ ] Shows active player's seat during Drawing phase
- [ ] Shows active player's seat during Discarding phase
- [ ] Shows "YOUR TURN" highlight when it's your turn
- [ ] "YOUR TURN" has green background/bold styling
- [ ] Shows "Call window" during CallWindow phase
- [ ] Shows "YOU CAN ACT" when you can act in call window
- [ ] Shows "waiting" when in call window but cannot act
- [ ] Shows "Select tiles to pass" during Charleston

### Wall Display

- [ ] Shows correct tile count (0-86 range)
- [ ] Shows 0% drawn at game start (86 tiles remaining)
- [ ] Percentage updates correctly as tiles are drawn
- [ ] Shows 100% when wall exhausted (0 tiles remaining)
- [ ] Format: "N tiles remaining (X% drawn)"

### Player Table

- [ ] Shows all 4 seats (East, South, West, North)
- [ ] Shows "-" for empty seats
- [ ] Shows tile count for each player (0-14)
- [ ] Shows exposed meld count for each player
- [ ] Shows player status (Active, Waiting, Dead, Disconnected)
- [ ] Highlights "You" in info column for your seat
- [ ] Shows "Dealer" for dealer seat
- [ ] Shows "Bot" for bot players
- [ ] Your row has different background color
- [ ] Table headers are styled (blue background, white text)

### Dynamic Updates

- [ ] Phase updates when server sends phase change events
- [ ] Turn indicator updates when turn changes
- [ ] Wall count decreases as tiles are drawn
- [ ] Player tile counts update after draws/discards
- [ ] Exposed melds count increases after calls
- [ ] Player status updates (Active, Dead, etc.)

---

## Success Criteria

Phase 2 is complete when:

1. ✅ GameStatus component renders without errors
2. ✅ All phase variants display with correct text
3. ✅ Turn indicator shows current player
4. ✅ "YOUR TURN" highlight appears correctly
5. ✅ Wall remaining count displays accurately
6. ✅ Player table shows all 4 seats
7. ✅ Your seat is highlighted in the table
8. ✅ Dealer and Bot tags display correctly
9. ✅ TypeScript compiles without errors
10. ✅ No console errors or warnings
11. ✅ Component updates in real-time as game state changes

---

## Next Steps

After Phase 2 is complete, proceed to:

- **Phase 3: Hand Display** - Display your 14 tiles with selection and sorting
- **Phase 4: Turn Actions** - Discard, call, pass buttons based on game state

---

## Additional Notes

### Active Player vs Can Act

**Important distinction:**

- **Active Player**: The player whose turn it is to draw/discard (Drawing/Discarding phases)
- **Can Act**: Players who can make a call during CallWindow phase (multiple players may be able to act)

During CallWindow:

- No single "active player"
- Multiple players in `can_act` array can respond
- Show "YOU CAN ACT" if yourSeat is in the `can_act` array

### Player Status Values

From `PlayerStatus` type:

- **Active**: Player is in the game and can act
- **Dead**: Player's hand is dead (incorrect call, invalid mahjong, etc.)
- **Waiting**: Player is in the room but game hasn't started
- **Disconnected**: Player lost connection

### Meld Display

For Phase 2, we only show the **count** of exposed melds. In later phases, we'll add:

- Visual display of meld tiles
- Joker indicators
- Called tile highlighting

### Dealer Indicator

In American Mahjong:

- East is always the dealer for the first game
- Dealer rotates after each game (unless East wins, depending on house rules)
- The `dealer` field in gameStore tracks the current dealer seat

### Wall Depletion Warning

Consider adding visual warnings when wall is nearly exhausted:

- Yellow warning at 80% drawn (17 tiles remaining)
- Red warning at 90% drawn (9 tiles remaining)
- Game must end before wall is fully exhausted (draw condition)

### Performance Considerations

The GameStatus component reads from multiple store selectors. For optimal performance:

- Each `useGameStore` call creates a subscription
- Component re-renders when any subscribed value changes
- This is acceptable for GameStatus as it needs to be reactive
- Consider memoization if performance issues arise with many rapid updates
