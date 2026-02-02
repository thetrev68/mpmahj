# Test Scenario: Wall Game - Draw from Exhausted Wall

**User Story**: US-031 (Draw/Wall Exhaustion)
**Component Specs**: GameBoard.md, GameOverDialog.md, WallDisplay.md
**Fixtures**: `game-states/wall-near-empty.json`, `event-sequences/wall-exhausted.json`

## Setup (Arrange)

- Game state: Playing phase, main gameplay
- Mock WebSocket: connected
- User seated as: South (seat 1)
- Wall has exactly 1 tile remaining
- No player has declared Mahjong
- Current turn: East player

## Steps (Act)

### Step 1: Wall count low warning (10 tiles remaining)

- WallDisplay component shows: "10 tiles remaining"
- UI displays subtle warning indicator:
  - Wall count text turns yellow/amber
  - Optional icon: ⚠️ next to count
  - Toast notification (dismissible): "Wall is running low - 10 tiles left"
- Players continue normal turns
- User (South) observes, waiting for their turn

### Step 2: Wall count critical (5 tiles remaining)

- WallDisplay updates: "5 tiles remaining"
- UI escalates warning:
  - Wall count text turns orange/red
  - Background of wall display pulses gently
  - Optional: visual "low wall" indicator on game board
- No gameplay changes, just visual feedback
- Tension builds as players race to declare Mahjong

### Step 3: East draws second-to-last tile (1 tile remaining)

- East player's turn (before user)
- WebSocket receives `TileDrawnPublic` event:
  - `player: "East"`
  - `wall_count: 1` (after draw)
- WallDisplay updates: "1 tile remaining - Last tile!"
- UI shows prominent visual indicator:
  - Wall count flashes or pulses
  - Special styling: "LAST TILE" badge
  - Optional: brief animation showing wall nearly empty
- User observes, knows game is about to end

### Step 4: East discards (no one calls)

- East player discards a tile (e.g., 7 Dot (24))
- WebSocket receives `TileDiscarded` event:
  - `player: "East"`
  - `tile: 24 (7 Dot)`
- Call window opens (10 seconds)
- User (South) can see discard but decides not to call
- No other players call either
- Call window expires
- Turn should advance to South (user)

### Step 5: Server attempts to advance turn but wall is empty

- Server logic detects: next turn requires drawing from wall
- Server checks: `wall.tiles_remaining() == 0`
- Server cannot draw tile for South (wall exhausted)
- Server does NOT emit `TurnChanged` event (can't start turn without draw)

### Step 6: Server declares Wall Game

- WebSocket receives `WallExhausted` event (new event type)
  - `final_wall_count: 0`
  - `turns_played: 87` (example count)
- WebSocket receives `GameOver` event:
  - `outcome: "WallGame"` or `outcome: "Draw"`
  - `winner: null`
  - `scores: { East: 0, South: 0, West: 0, North: 0 }`
  - `reason: "Wall exhausted with no winner"`

### Step 7: UI displays Wall Game result

- WallDisplay component shows: "0 tiles - WALL EXHAUSTED"
- Game board overlay appears with dramatic transition:
  - Fade to semi-transparent overlay
  - Large notification: "🏁 Wall Game - Draw"
  - Subtitle: "The wall has been exhausted. No winner."
- Toast notification (persistent): "Game Over: Wall Game (Draw)"
- All action buttons are disabled
- Player turn indicators all turn off

### Step 8: GameOverDialog appears

- Modal dialog opens with:
  - **Title**: "Game Over - Draw"
  - **Icon**: 🏁 or neutral game-end icon
  - **Message**: "The wall has been exhausted. No player declared Mahjong."
  - **Final Scores**:

    ```text
    East:  0 points
    South: 0 points
    West:  0 points
    North: 0 points
    ```

  - **Statistics** (optional):
    - Turns played: 87
    - Tiles remaining in wall: 0
    - Outcome: Draw (Wall Game)
  - **Action Buttons**:
    - "View Replay" (navigates to replay viewer)
    - "New Game" (creates/joins new room)
    - "Return to Lobby" (leaves room, goes to main menu)

### Step 9: User reviews or starts new game

- User can click "View Replay" to review the game
- OR click "New Game" to start fresh
- OR click "Return to Lobby" to exit
- Game state is now frozen (no further actions possible)
- WebSocket connection may close or remain for lobby navigation

## Expected Outcome (Assert)

- WallDisplay component shows "0 tiles" or empty state indicator
- No winner is declared
- All players' scores remain at 0
- GameOverDialog displays:
  - Title: "Game Over - Draw"
  - Message: "The wall has been exhausted. No winner."
  - Button options: "New Game" / "Return to Lobby"
- Action buttons (Draw Tile, Declare Mahjong) are disabled
- Game state transitions to `GameOver`
- Replay is available for review

## Error Cases

### Last tile drawn results in Mahjong (self-draw win)

- **When**: East draws last tile from wall, it completes their hand
- **Expected**:
  - East declares Mahjong with self-drawn tile
  - `MahjongDeclared` event emitted before `WallExhausted`
  - Game ends with East as winner (not a draw)
  - GameOverDialog shows winner, not wall game
- **Assert**: Mahjong always takes precedence over wall exhaustion

### Last tile discarded and called for Mahjong

- **When**: East draws last tile, discards it, South calls for Mahjong
- **Expected**:
  - South declares Mahjong on discard
  - Game ends with South as winner
  - Wall state is irrelevant (game already over)
- **Assert**: Called Mahjong ends game before wall matters

### Last tile called for Pung/Kong (non-winning)

- **When**: East discards last tile, South calls for Pung
- **Expected**:
  - South makes Pung, consumes discard (no draw from wall)
  - South must discard from their 14 tiles
  - After discard, next turn requires draw
  - Wall is empty → `WallExhausted` event
  - Game ends in draw
- **Assert**: Calling delays but doesn't prevent wall game

### Wall count display desync

- **When**: Network lag causes client wall count to be stale
- **Expected**:
  - Client shows "3 tiles" but server is at "0 tiles"
  - `WallExhausted` event arrives unexpectedly to client
  - Client immediately updates wall display to "0 tiles"
  - Game over dialog appears
- **Assert**: Server wall count is authoritative, events override client state

### Multiple players attempt to draw simultaneously (shouldn't happen)

- **When**: Edge case bug where two players think it's their turn
- **Expected**:
  - Server enforces strict turn order
  - Only current player's draw command is valid
  - Other player's command is rejected
  - Wall count decrements only once per valid draw
- **Assert**: Server validates turn ownership before processing draw

### Charleston uses tiles but doesn't affect wall game math

- **When**: Charleston phase uses 36+ tiles for exchanges
- **Expected**:
  - Charleston redistributes tiles among players (zero-sum)
  - Wall count remains same after Charleston (99 tiles)
  - Wall game calculation doesn't account for Charleston
  - Wall exhaustion can only happen in Playing phase
- **Assert**: Charleston doesn't consume wall tiles, only redistributes

### Disconnect during final tile draw

- **When**: User disconnects as last tile is drawn
- **Expected**:
  - Server continues game logic
  - Wall exhausted, game ends in draw
  - User reconnects, receives `GameStateSnapshot` with `GameOver` state
  - UI immediately shows GameOverDialog with wall game result
- **Assert**: Game end logic completes server-side, client syncs on reconnect

## Technical Notes

### Wall Tile Math

- Total tiles: 152
- Initial deal: 13 × 4 players = 52 tiles
- East gets extra: +1 = 53 tiles dealt
- Charleston exchanges: 0 net change (tiles redistributed)
- Remaining wall: 152 - 53 = 99 tiles at game start
- Wall exhaustion: occurs after ~99 draw actions (accounting for calls that skip draws)

### Server Behavior

From backend (mahjong_core):

- Wall::draw() returns `Option<Tile>` → `None` when empty
- Game::advance_turn() checks wall before drawing
- If wall is empty and no Mahjong → emit `GameOver { outcome: WallExhausted }`

### UI Requirements

- WallDisplay should show countdown: "52 tiles remaining" → "1 tile" → "0 tiles - Last Draw!"
- Visual warning when wall count < 10 tiles
- Final tile draw should be visually highlighted

## Accessibility Notes

### Screen Reader Announcements

- **Low wall**: "Warning: 10 tiles remaining in wall"
- **Critical wall**: "Urgent: 5 tiles remaining. Wall nearly exhausted"
- **Last tile**: "Last tile in wall. Game will end in draw if no one wins"
- **Wall exhausted**: "Wall exhausted. Game ended in a draw. No winner"
- **Dialog open**: "Game over dialog. Wall game - draw. No player declared Mahjong"

### Visual Indicators

- Wall count uses color + icon, not color alone
  - Normal: 🀫 gray/white (>10 tiles)
  - Warning: ⚠️ yellow (10-5 tiles)
  - Critical: 🚨 red (5-1 tiles)
  - Empty: ❌ red/gray (0 tiles)
- Minimum 4.5:1 contrast ratio for all text
- Animations respect `prefers-reduced-motion`

### Keyboard Navigation

- GameOverDialog opens with focus on first button ("View Replay")
- Tab order: View Replay → New Game → Return to Lobby
- Escape key closes dialog (same as Return to Lobby)
- Enter key activates focused button

### Focus Management

- When dialog opens, focus moves to dialog
- When dialog closes, focus returns to main game board (or lobby navigation)
- Focus is never lost or stuck

⚠️ **NEEDS BACKEND VERIFICATION**: Event names (`WallExhausted`, `GameOver`), outcome enum values, and wall depletion logic should be verified against `mahjong_core` implementation.

## Cross-References

### Related Scenarios

- [mahjong-self-draw.md](mahjong-self-draw.md) - Win on last tile from wall
- [mahjong-called.md](mahjong-called.md) - Win on last discarded tile
- [drawing-discarding.md](drawing-discarding.md) - Normal turn flow

### Related Components

- [WallDisplay](../../component-specs/game/WallDisplay.md) - Wall count indicator
- [GameOverDialog](../../component-specs/game/GameOverDialog.md) - End game modal
- [GameBoard](../../component-specs/game/GameBoard.md) - Main game container

### Backend References

- Event: `mahjong_core::event::WallExhausted`, `GameOver`
- State: `GameState::GameOver { outcome: WallGame }`
- Logic: `mahjong_core::wall::Wall::draw()` returns `Option<Tile>`

### Manual Testing

- User Testing Plan - End Game Conditions section
- Test with accelerated game (reduced wall size for faster testing)
