# US-021: Wall Game (Draw)

## Story

**As a** player in a game where the wall is exhausted with no winner
**I want** the game to end in a draw with appropriate scoring
**So that** the game can conclude gracefully when no one achieves Mahjong

## Acceptance Criteria

### AC-1: Wall Exhaustion Detection

**Given** tiles are being drawn during normal play
**When** the wall reaches 0 drawable tiles (dead wall of 14 tiles remains)
**Then** the server emits `WallExhausted { remaining_tiles: 0 }`
**And** no more tiles can be drawn
**And** the current turn is the last turn

### AC-2: Wall Game (Draw) Announcement

**Given** the wall was exhausted
**When** no player declared Mahjong
**Then** a draw overlay appears: "WALL GAME - No Winner"
**And** a neutral sound effect plays (not victory, not defeat)
**And** a message displays: "Wall exhausted with no winner. Game ends in a draw."

### AC-3: Scoring for Draw Game

**Given** the game ended in a draw
**When** the scoring screen appears
**Then** it displays:
  - **Result**: "Draw - No Winner"
  - **Reason**: "Wall exhausted"
  - **Scores**: No score changes (all players keep current scores)
  - **Final Scores**: Current score table unchanged
  - **Optional**: Show each player's closest pattern and deficiency

### AC-4: Game End After Draw

**Given** the draw scoring screen is displayed
**When** all players have viewed the scores (or 10 seconds elapsed)
**Then** the server emits `PhaseChanged { phase: GameOver }`
**And** options appear: "New Game", "Return to Lobby", "View Replay"

### AC-5: Draw During Turn

**Given** the wall is exhausted on a player's turn
**When** the player attempts to draw
**Then** the `WallExhausted` event is emitted instead of `TileDrawn`
**And** the player does not draw a tile
**And** the game immediately proceeds to draw resolution

### AC-6: All Dead Hands → Draw

**Given** all 4 players have dead hands (see US-020)
**When** the game continues
**Then** the server emits `GameAbandoned { reason: AllDeadHands }`
**And** a draw overlay appears: "GAME ABANDONED - All Players Dead Hands"
**And** the game ends with no score changes

### AC-7: Draw Statistics

**Given** the game ended in a draw
**When** the final screen shows
**Then** statistics are displayed (optional):
  - Each player's closest pattern
  - Each player's deficiency (tiles needed to win)
  - Number of turns played
  - Tiles remaining in wall (0)

### AC-8: Replay Availability for Draws

**Given** the game ended in a draw
**When** the game over screen shows
**Then** a "View Replay" button is available
**And** the replay can be reviewed like any other game
**And** the replay shows the full game including the wall exhaustion

### AC-9: Draw After Heavenly Hand Attempt

**Given** East had a potential Heavenly Hand but didn't declare
**When** Charleston completes and play proceeds
**And** the wall is later exhausted with no winner
**Then** the game ends in a normal draw (no special penalty)

### AC-10: Bot Behavior in Draw

**Given** the wall is exhausted
**When** bots are in the game
**Then** bots do not attempt any actions
**And** the draw resolution proceeds automatically
**And** all players (including bots) see the draw screen

## Technical Details

### Commands (Frontend → Backend)

No new commands - draw is detected by server automatically.

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    WallExhausted: {
      remaining_tiles: 0
    }
  }
}

{
  kind: 'Public',
  event: {
    GameResult: {
      winner: null,  // No winner
      pattern: null,
      base_score: 0,
      payments: {},  // No payments
      draw: true,
      reason: "Wall exhausted"
    }
  }
}

// Alternative: All dead hands
{
  kind: 'Public',
  event: {
    GameAbandoned: {
      reason: "AllDeadHands",
      initiator: null
    }
  }
}

{
  kind: 'Public',
  event: {
    PhaseChanged: {
      phase: "GameOver"
    }
  }
}
```

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/deck.rs` - Wall tile management
  - `crates/mahjong_core/src/flow/outcomes.rs` - Draw game result
  - `crates/mahjong_core/src/event/public_events.rs` - `WallExhausted`, `GameAbandoned`
  - `crates/mahjong_core/src/scoring.rs` - Draw game scoring (no changes)
- **Game Design Doc**:
  - Section 4.9 (Wall Game - Draw Condition)
  - Section 4.10 (Draw Game Scoring)
  - Section 3.6 (Wall Closure Rule - US-017)

## Components Involved

- **`<DrawOverlay>`** - Announces draw result
- **`<DrawScoringScreen>`** - Shows draw statistics and final scores
- **`<GameOverPanel>`** - Post-game options
- **`<WallCounter>`** - Shows 0 tiles (from US-009)
- **`useSoundEffects()`** - Neutral draw sound

**Component Specs:**

- `component-specs/presentational/DrawOverlay.md` (NEW)
- `component-specs/presentational/DrawScoringScreen.md` (NEW)
- Reuse `GameOverPanel` from US-018

## Test Scenarios

- **`tests/test-scenarios/wall-game-draw.md`** - Normal wall exhaustion
- **`tests/test-scenarios/wall-game-all-dead-hands.md`** - All players dead hand
- **`tests/test-scenarios/wall-game-statistics.md`** - Draw with deficiency stats
- **`tests/test-scenarios/wall-game-replay.md`** - Replay of draw game

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/wall-exhausted.json` - State with 0 tiles remaining
- `tests/fixtures/events/wall-game-draw-sequence.json` - Draw event flow

**Sample Draw Game Event Sequence:**

```json
{
  "scenario": "Wall Game (Draw)",
  "events": [
    {
      "kind": "Public",
      "event": { "TileDrawnPublic": { "remaining_tiles": 1 } }
    },
    {
      "kind": "Public",
      "event": { "TileDiscarded": { "player": "North", "tile": "Bam7" } }
    },
    {
      "kind": "Public",
      "event": { "CallWindowClosed": {} }
    },
    {
      "kind": "Public",
      "event": { "TurnChanged": { "player": "East", "stage": { "Playing": "Drawing" } } }
    },
    {
      "kind": "Public",
      "event": { "WallExhausted": { "remaining_tiles": 0 } }
    },
    {
      "kind": "Public",
      "event": {
        "GameResult": {
          "winner": null,
          "pattern": null,
          "base_score": 0,
          "payments": {},
          "draw": true,
          "reason": "Wall exhausted"
        }
      }
    },
    {
      "kind": "Public",
      "event": { "PhaseChanged": { "phase": "GameOver" } }
    }
  ]
}
```

## Edge Cases

### EC-1: Wall Exhausted During Call Window

**Given** a tile is discarded when wall has 0 tiles
**When** the call window opens
**Then** players can still call the discard
**And** if someone calls, they expose a meld (no replacement draw since wall empty)
**And** game continues until that player must discard
**And** then wall exhaustion is detected

### EC-2: Kong/Quint Replacement Draw When Wall Empty

**Given** a player exposes a Kong when wall has 1 tile
**When** they attempt to draw a replacement
**Then** they draw the last tile normally
**And** on the next player's turn, wall exhaustion is detected

### EC-3: All Dead Hands vs Wall Exhausted

**Given** all 4 players have dead hands
**When** play continues until wall exhausted
**Then** `GameAbandoned { reason: AllDeadHands }` is emitted (before wall exhaustion)
**And** the game ends with "All players dead hands" message

**Given** 3 players have dead hands and wall exhausted
**Then** normal wall exhaustion draw occurs
**And** dead hand players score 0 or penalty

### EC-4: Draw Statistics Optional

**Given** the game ended in a draw
**Then** showing deficiency statistics is optional (house rule or UI preference)
**And** some implementations may show just "No Winner"
**And** others may show detailed stats for each player

### EC-5: Replay of Draw Game

**Given** a draw game replay is viewed
**When** the replay reaches the end
**Then** the wall exhaustion is shown
**And** the draw result is displayed
**And** the replay is complete (no winner celebration)

### EC-6: Network Error During Draw

**Given** the wall is exhausted
**When** `WallExhausted` event is sent but network fails
**Then** the event is retried
**And** if the client doesn't receive it, the UI hangs
**And** on reconnection, the client receives the draw result

## Related User Stories

- **US-017**: Wall Closure Rule - Wall management (dead wall = 14 tiles)
- **US-009**: Drawing a Tile - Wall counter shows 0
- **US-020**: Invalid Mahjong → Dead Hand - All dead hands can trigger draw
- **US-018**: Declaring Mahjong (Self-Draw) - Alternative end condition

## Accessibility Considerations

### Keyboard Navigation

- **Enter**: Acknowledge draw overlay
- **Space**: Navigate through draw statistics
- **Tab**: Navigate to game over options

### Screen Reader

- **Wall Low**: "Warning: Wall low. 5 tiles remaining."
- **Wall Exhausted**: "Wall exhausted. 0 tiles remaining. Game ends in a draw."
- **Draw Result**: "Game ended in a draw. No winner. Wall exhausted. Scores unchanged. East: 500, South: 485, West: 510, North: 505."
- **Statistics**: "Draw statistics: East was closest to winning with Odds Only, needed 3 more tiles. South needed 5 tiles..."

### Visual

- **High Contrast**: Draw overlay has clear, neutral styling (not red/green)
- **Wall Counter**: 0 tiles shown in red with "EXHAUSTED" badge
- **Draw Badge**: Neutral color badge (gray or blue) for "DRAW" result

## Priority

**HIGH** - Important end game condition, occurs frequently

## Story Points / Complexity

**3** - Medium complexity

- Wall exhaustion detection
- Draw overlay and messaging
- Scoring screen for draw (no changes)
- Statistics display (optional)
- All dead hands variant
- Replay support

## Definition of Done

- [ ] `WallExhausted` event triggers draw flow
- [ ] Draw overlay displays "WALL GAME - No Winner"
- [ ] Neutral sound effect plays
- [ ] Draw message explains: "Wall exhausted with no winner"
- [ ] Scoring screen shows "Draw - No Winner"
- [ ] Scores unchanged (no payments)
- [ ] Final scores displayed
- [ ] Optional: Draw statistics show each player's deficiency
- [ ] Game phase transitions to `GameOver`
- [ ] Game over options appear (New Game, Lobby, Replay)
- [ ] All dead hands variant triggers `GameAbandoned` event
- [ ] All dead hands overlay displays with appropriate message
- [ ] Wall counter shows 0 with "EXHAUSTED" indicator
- [ ] Replay available for draw games
- [ ] Bot behavior tested (no actions during draw)
- [ ] Component tests pass (DrawOverlay, DrawScoringScreen)
- [ ] Integration tests pass (wall exhaustion → draw flow)
- [ ] E2E test passes (full game → wall exhaustion → draw)
- [ ] Accessibility tests pass (keyboard nav, screen reader)
- [ ] Manually tested against `user-testing-plan.md` (Part 4, Draw scenarios)
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

### Wall Exhaustion Detection

The backend detects wall exhaustion when drawable tiles reach 0 (after accounting for 14-tile dead wall):

```rust
pub fn can_draw(&self) -> bool {
    self.remaining_tiles() > DEAD_WALL_SIZE
}

pub fn is_exhausted(&self) -> bool {
    self.remaining_tiles() <= DEAD_WALL_SIZE
}
```

Frontend receives `WallExhausted` event when this condition is met.

### Draw Overlay

```typescript
<DrawOverlay
  show={showDrawOverlay}
  reason="Wall exhausted"
  onAcknowledge={() => {
    setShowDrawOverlay(false);
    setShowDrawScoringScreen(true);
  }}
/>
```

Display:
```
╔══════════════════════════════════════╗
║        WALL GAME - DRAW              ║
╠══════════════════════════════════════╣
║ No Winner                            ║
║                                      ║
║ Reason: Wall exhausted               ║
║ Remaining Tiles: 0                   ║
╠══════════════════════════════════════╣
║ The game ends with no winner.        ║
║ Scores remain unchanged.             ║
╠══════════════════════════════════════╣
║         [Continue]                   ║
╚══════════════════════════════════════╝
```

### Draw Scoring Screen

```typescript
<DrawScoringScreen
  reason="Wall exhausted"
  currentScores={currentScores}
  statistics={drawStatistics}  // Optional
  onContinue={() => {
    setShowGameOverPanel(true);
  }}
/>
```

Display:
```
╔══════════════════════════════════════╗
║            GAME DRAW                 ║
╠══════════════════════════════════════╣
║ Result: No Winner                    ║
║ Reason: Wall exhausted               ║
╠══════════════════════════════════════╣
║ Final Scores (Unchanged):            ║
║   East: 500 (±0)                     ║
║   South: 485 (±0)                    ║
║   West: 510 (±0)                     ║
║   North: 505 (±0)                    ║
╠══════════════════════════════════════╣
║ Optional Statistics:                 ║
║   East: Closest pattern: Odds Only   ║
║         Deficiency: 3 tiles          ║
║   South: Closest: Consecutive Run    ║
║         Deficiency: 5 tiles          ║
║   West: Closest: 2025 Year           ║
║         Deficiency: 4 tiles          ║
║   North: Closest: Any Like Numbers   ║
║         Deficiency: 6 tiles          ║
╠══════════════════════════════════════╣
║  [New Game] [Lobby] [View Replay]    ║
╚══════════════════════════════════════╝
```

### Draw Statistics (Optional)

If showing deficiency statistics:

```typescript
interface DrawStatistics {
  players: Record<Seat, {
    closestPattern: string;
    deficiency: number;
    tilesNeeded: Tile[];
  }>;
  turnsPlayed: number;
  tilesRemaining: 0;
}
```

Backend can optionally provide this via:

```typescript
{
  kind: 'Public',
  event: {
    DrawStatistics: {
      players: {
        "East": { closestPattern: "Odds Only", deficiency: 3, tilesNeeded: ["Bam1", "Crak3", "Dot5"] },
        // ... other players
      },
      turnsPlayed: 72,
      tilesRemaining: 0
    }
  }
}
```

Or frontend can calculate locally if it has access to validation logic.

### All Dead Hands Draw

```typescript
case 'GameAbandoned':
  if (event.reason === 'AllDeadHands') {
    setShowDrawOverlay(true);
    setDrawReason('All players have dead hands');
    setGameResult({
      winner: null,
      draw: true,
      reason: 'All players dead hands',
      payments: {},
      finalScores: currentScores
    });
  }
  break;
```

Display: "GAME ABANDONED - All Players Dead Hands. No winner. Scores unchanged."

### Zustand Store Updates

```typescript
case 'WallExhausted':
  state.wallTiles = 0;
  state.wallExhausted = true;
  state.showDrawOverlay = true;
  break;

case 'GameResult':
  if (event.draw) {
    state.gameResult = {
      winner: null,
      draw: true,
      reason: event.reason,
      finalScores: state.scores  // Unchanged
    };
  }
  break;

case 'DrawStatistics':
  state.drawStatistics = event;
  break;

case 'PhaseChanged':
  if (event.phase === 'GameOver') {
    state.phase = 'GameOver';
    state.gameOver = true;
  }
  break;
```

### Sound Effects

```typescript
function playDrawSound() {
  playSoundEffect('game_draw');  // Neutral tone, not victory or defeat
}
```

Sound should be:
- Neutral tone (neither celebratory nor sad)
- Short duration (~1 second)
- Lower volume than victory sound
- Optional: bell or chime sound

### Replay Support

Draw games should be replayable:

```typescript
<ReplayControls
  gameResult={{
    winner: null,
    draw: true,
    reason: 'Wall exhausted'
  }}
/>
```

Replay displays:
- Full game flow until wall exhaustion
- Wall counter reaching 0
- Draw overlay at end
- No winner celebration

### Instant Animation Mode

When "Instant Animations" setting is enabled:
- Draw overlay appears instantly (no fade-in)
- Scoring screen displays immediately
- Sound still plays
- Statistics appear without animation
