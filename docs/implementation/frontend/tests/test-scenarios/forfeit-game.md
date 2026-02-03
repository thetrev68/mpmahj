# Test Scenario: Forfeit Game

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-032 - Forfeit Game
**Component Specs**: GameTable.md, ForfeitDialog.md, ScoringScreen.md
**Fixtures**: `playing-mid-game.json`, `forfeit-sequence.json`
**Manual Test**: Manual Testing Checklist #32

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-mid-game.json`
- **Mock WebSocket**: Connected
- **User seated as**: South
- **Current turn**: East (not user's turn)
- **Game phase**: Playing (mid-game)
- **Player hand**: 13 tiles (standard hand, no winning patterns)
- **Discard pile**: 25 tiles
- **Exposed melds**: Each player has 1-2 exposed melds

## Steps (Act)

### Step 1: Verify game state

- UI shows Game table with:
  - All players' hands (concealed)
  - Discard pile with 25 tiles
  - Exposed melds for each player
  - Turn indicator: "East's turn"
  - "Forfeit Game" button in toolbar or menu

### Step 2: User opens forfeit dialog

- User clicks "Forfeit Game" button
- Forfeit Dialog slides in from center of screen
- UI shows Forfeit Dialog with:
  - **Header**: "Forfeit Game?"
  - **Message**: "Are you sure you want to forfeit this game?"
  - **Warning**: "⚠️ Forfeiting will count as a loss. Other players will continue playing."
  - **Reason Dropdown**: [Select reason...] (optional)
    - "No reason"
    - "Emergency"
    - "Poor connection"
    - "Personal reasons"
    - "Other"
  - **Buttons**: "Forfeit", "Cancel"

### Step 3: User selects forfeit reason

- User clicks "Reason" dropdown
- User selects "Poor connection"
- Reason updates: "Poor connection"

### Step 4: User confirms forfeit

- User clicks "Forfeit" button
- WebSocket sends `ForfeitGame` command:
  - `reason: "Poor connection"`
- Forfeit Dialog shows spinner: "Forfeiting..."

### Step 5: Server processes forfeit

- Server marks player as forfeited
- Server continues game with remaining 3 players
- WebSocket receives `PlayerForfeited` event:
  - `player: "South"`
  - `reason: "Poor connection"`
  - `remaining_players: ["East", "West", "North"]`
- Forfeit Dialog closes with success animation

### Step 6: User's hand becomes dead

- UI shows "You have forfeited" overlay:
  - **Message**: "You have forfeited the game"
  - **Reason**: "Poor connection"
  - **Status**: "Your hand is now dead. You cannot win."
  - **Buttons**: "Spectate", "Leave Game"
- User's hand is marked as dead (grayed out)
- User cannot make any moves (all buttons disabled)

### Step 7: User chooses to spectate

- User clicks "Spectate" button
- UI transitions to spectator mode:
  - User can watch the game continue
  - All players' hands still concealed
  - Turn indicator shows current player
  - "Leave Game" button available

### Step 8: Game continues with 3 players

- Simulated: East draws and discards
- Simulated: West calls Pung on discard
- Simulated: West discards
- Simulated: North draws and discards
- UI updates to show game progress (3-player game)

### Step 9: Game ends (another player wins)

- Simulated: North declares Mahjong
- WebSocket receives `MahjongDeclared` event:
  - `player: "North"`
- WebSocket receives `GameOver` event:
  - `winner: "North"`
  - `result: { ... }` (score breakdown)
- UI shows scoring summary:
  - Winner: North
  - Losers: East, West
  - Forfeited: South (user)
  - South's score: -25 (forfeit penalty)
  - Other players' scores: based on game result
- "Return to Lobby" button appears

### Step 10: User returns to lobby

- User clicks "Return to Lobby" button
- UI transitions to Lobby screen
- Game history shows forfeited game

## Expected Outcome (Assert)

- ✅ Forfeit Dialog opened and closed correctly
- ✅ User successfully forfeited the game
- ✅ User's hand was marked as dead
- ✅ Game continued with remaining 3 players
- ✅ User could spectate the game
- ✅ Game ended normally with another player winning
- ✅ Forfeit penalty was applied to user's score
- ✅ WebSocket command/event sequence correct (ForfeitGame → PlayerForfeited → MahjongDeclared → GameOver)

## Error Cases

### Forfeiting during user's turn

- **When**: User clicks "Forfeit Game" during their turn
- **Expected**: Forfeit Dialog shows warning about abandoning turn
- **Assert**:
  - Dialog message: "Are you sure you want to forfeit? You have 15 seconds remaining on your turn."
  - User can still forfeit if confirmed

### Forfeiting with winning hand

- **When**: User has a winning hand but chooses to forfeit
- **Expected**: Forfeit Dialog shows warning about potential win
- **Assert**:
  - Dialog message: "⚠️ You have a winning hand! Are you sure you want to forfeit?"
  - User can still forfeit if confirmed

### Forfeiting multiple times

- **When**: User clicks "Forfeit Game" multiple times rapidly
- **Expected**: Only first click sends command, subsequent clicks ignored
- **Assert**: WebSocket receives only one `ForfeitGame` command

### Server rejects forfeit (invalid state)

- **When**: Server receives forfeit command in invalid state (e.g., game already over)
- **Expected**: Server rejects and shows error
- **Assert**:
  - WebSocket receives `ForfeitFailed` event:
    - `reason: "Cannot forfeit in current state"`
  - Forfeit Dialog shows error: "Unable to forfeit - please try again"

### WebSocket disconnect during forfeit

- **When**: Connection lost after clicking "Forfeit" but before receiving confirmation
- **Expected**: Client shows "Reconnecting..." overlay
- **Assert**:
  - On reconnect, client checks if forfeit succeeded
  - If forfeited: shows spectator mode
  - If not forfeited: shows game screen

### Forfeiting as last remaining player

- **When**: 3 players have already forfeited, only 1 player left
- **Expected**: Server ends game as draw
- **Assert**:
  - WebSocket receives `GameOver` event:
    - `outcome: "Draw"`
    - `reason: "Insufficient players"`
  - UI shows "Game ended - Draw" overlay

## Forfeit Behavior

### Forfeit Scoring

| Scenario | Forfeiting Player's Score | Other Players' Scores |
|-----------|-------------------------|----------------------|
| Standard Forfeit | -25 (fixed penalty) | Game continues normally |
| Forfeit with Winning Hand | -25 (penalty) + lost potential win | Game continues normally |
| Multiple Forfeits | -25 each | Game continues with remaining players |
| All Players Forfeit | 0 (draw) | 0 (draw) |

### Forfeit Reasons

| Reason | Description |
|---------|-------------|
| No reason | Player chose not to specify |
| Emergency | Player has an emergency |
| Poor connection | Player experiencing network issues |
| Personal reasons | Player has personal reasons |
| Other | Player specifies other reason |

### Post-Forfeit Options

| Option | Description |
|---------|-------------|
| Spectate | Watch the game continue as a spectator |
| Leave Game | Return to lobby immediately |

## Cross-References

### Related Scenarios

- `leave-game.md` - Leave game (ends game for all players)
- `abandon-game-consensus.md` - Abandon game by consensus
- `mahjong-self-draw.md` - Winning by self-draw
- `mahjong-called.md` - Winning by calling discard

### Related Components

- [GameTable](../../component/specs/game/GameTable.md)
- [ForfeitDialog](../../component/specs/game/ForfeitDialog.md)
- [ScoringScreen](../../component/specs/game/ScoringScreen.md)
- [SpectatorMode](../../component/specs/game/SpectatorMode.md)

### Backend References

- Commands: `mahjong_core::command::ForfeitGame`
- Events: `mahjong_core::event::PlayerForfeited`, `ForfeitFailed`, `MahjongDeclared`, `GameOver`
- State: `GameState::Playing`, `GameState::Spectating`
- Logic: `mahjong_server::game::forfeit_game()`, `apply_forfeit_penalty()`

### Accessibility Notes

- "Forfeit Game" button announced: "Forfeit game"
- Forfeit Dialog announced: "Forfeit game dialog opened. Are you sure you want to forfeit this game? Warning: Forfeiting will count as a loss. Other players will continue playing."
- Reason dropdown announced: "Reason for forfeit, No reason selected. Options: No reason, Emergency, Poor connection, Personal reasons, Other"
- "Forfeit" button announced: "Forfeit game, confirm"
- "Cancel" button announced: "Cancel, return to game"
- Forfeit overlay announced: "You have forfeited the game. Reason: Poor connection. Your hand is now dead. You cannot win. Spectate or Leave Game buttons available."
- Scoring screen announced: "Game over. Winner: North. Losers: East, West. Forfeited: South. South's score: -25. Return to Lobby button available."
