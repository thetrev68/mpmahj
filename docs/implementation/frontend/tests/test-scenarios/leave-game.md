# Test Scenario: Leave Game

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-031 - Leave Game
**Component Specs**: RoomScreen.md, LeaveGameDialog.md, GameTable.md
**Fixtures**: `room-waiting.json`, `room-playing.json`, `leave-game-sequence.json`
**Manual Test**: Manual Testing Checklist #31

## Part 1: Leave Room (Waiting Phase)

### Setup (Arrange)

- **Game state**: Load `fixtures/game-states/room-waiting.json`
- **Mock WebSocket**: Connected
- **User**: Logged in as "Player2"
- **Current screen**: Room screen
- **Room**: "Friday Night Mahjong" (room_abc123)
- **Players**: 3/4 players (Player1, Player2, Player3)
- **Game phase**: Waiting (game not started)

### Steps (Act)

#### Step 1: Verify room state

- UI shows Room screen with:
  - **Header**: "Friday Night Mahjong"
  - **Room ID**: "room_abc123"
  - **Players**: "3/4 players"
  - **Player List**:
    - "Player1 (Host) - East"
    - "Player2 - South"
    - "Player3 - West"
  - **Status**: "Waiting for players..."
  - **Buttons**: "Start Game" (disabled - host only), "Leave Room"

#### Step 2: User clicks "Leave Room" button

- User clicks "Leave Room" button
- Leave Game dialog slides in from center of screen
- UI shows Leave Game dialog with:
  - **Header**: "Leave Room?"
  - **Message**: "Are you sure you want to leave this room?"
  - **Buttons**: "Leave", "Cancel"

#### Step 3: User confirms leave

- User clicks "Leave" button
- WebSocket sends `LeaveRoom` command
- Leave Game dialog shows spinner: "Leaving room..."

#### Step 4: Server processes leave

- Server removes player from room
- WebSocket receives `RoomLeft` event:
  - `room_id: "room_abc123"`
  - `player: "Player2"`
- Leave Game dialog closes with success animation

#### Step 5: User returns to lobby

- UI transitions to Lobby screen
- Room list updates: "Friday Night Mahjong" now shows "2/4 players"
- Player info: "Player2 (Online)"

#### Step 6: Other players notified

- Simulated: Player1 and Player3 receive `PlayerLeft` event
- Their UI updates:
  - Players: "2/4 players"
  - Player List:
    - "Player1 (Host) - East"
    - "Player3 - West"

## Part 2: Leave Game (Playing Phase - Non-Host)

### Setup (Arrange)

- **Game state**: Load `fixtures/game-states/room-playing.json`
- **Mock WebSocket**: Connected
- **User**: Logged in as "Player2"
- **Current screen**: Game table
- **Room**: "Friday Night Mahjong" (room_abc123)
- **Players**: 4/4 players (Player1, Player2, Player3, Player4)
- **Game phase**: Playing (mid-game)
- **Current turn**: South (Player2's turn)

### Steps (Act)

#### Step 1: Verify game state

- UI shows Game table with:
  - All players' hands (concealed)
  - Discard pile with 20 tiles
  - Exposed melds for each player
  - Turn indicator: "South's turn"
  - "Leave Game" button in toolbar

#### Step 2: User clicks "Leave Game" button

- User clicks "Leave Game" button
- Leave Game dialog slides in from center of screen
- UI shows Leave Game dialog with:
  - **Header**: "Leave Game?"
  - **Message**: "Are you sure you want to leave this game? This will end the game for all players."
  - **Warning**: "⚠️ Leaving during a game will end the game for everyone."
  - **Buttons**: "Leave Game", "Cancel"

#### Step 3: User confirms leave

- User clicks "Leave Game" button
- WebSocket sends `LeaveGame` command
- Leave Game dialog shows spinner: "Leaving game..."

#### Step 4: Server processes leave

- Server ends game for all players
- Server records game as abandoned
- WebSocket receives `GameAbandoned` event:
  - `room_id: "room_abc123"`
  - `abandoned_by: "Player2"`
  - `reason: "Player left during game"`
- Leave Game dialog closes

#### Step 5: Game ends for all players

- UI shows "Game Abandoned" overlay:
  - **Message**: "Game abandoned by Player2"
  - **Reason**: "Player left during game"
  - **Buttons**: "Return to Lobby"
- All players receive `GameAbandoned` event
- Their UI shows same overlay

#### Step 6: User returns to lobby

- User clicks "Return to Lobby" button
- UI transitions to Lobby screen
- Room list: "Friday Night Mahjong" removed (game ended)

## Part 3: Leave Game (Playing Phase - Host)

### Setup (Arrange)

- **Game state**: Load `fixtures/game-states/room-playing.json`
- **Mock WebSocket**: Connected
- **User**: Logged in as "Player1" (host)
- **Current screen**: Game table
- **Room**: "Friday Night Mahjong" (room_abc123)
- **Players**: 4/4 players (Player1, Player2, Player3, Player4)
- **Game phase**: Playing (mid-game)
- **Current turn**: East (Player1's turn)

### Steps (Act)

#### Step 1: Verify game state

- UI shows Game table with:
  - All players' hands (concealed)
  - Discard pile with 20 tiles
  - Exposed melds for each player
  - Turn indicator: "East's turn"
  - "Leave Game" button in toolbar

#### Step 2: Host clicks "Leave Game" button

- User (host) clicks "Leave Game" button
- Leave Game dialog slides in from center of screen
- UI shows Leave Game dialog with:
  - **Header**: "Leave Game?"
  - **Message**: "Are you sure you want to leave this game? This will end the game for all players."
  - **Warning**: "⚠️ You are the host. Leaving will end the game for everyone."
  - **Buttons**: "Leave Game", "Cancel"

#### Step 3: Host confirms leave

- User clicks "Leave Game" button
- WebSocket sends `LeaveGame` command
- Leave Game dialog shows spinner: "Leaving game..."

#### Step 4: Server processes leave

- Server ends game for all players
- Server records game as abandoned
- WebSocket receives `GameAbandoned` event:
  - `room_id: "room_abc123"`
  - `abandoned_by: "Player1"`
  - `reason: "Host left during game"`
- Leave Game dialog closes

#### Step 5: Game ends for all players

- UI shows "Game Abandoned" overlay:
  - **Message**: "Game abandoned by Player1 (Host)"
  - **Reason**: "Host left during game"
  - **Buttons**: "Return to Lobby"
- All players receive `GameAbandoned` event
- Their UI shows same overlay

#### Step 6: Host returns to lobby

- User clicks "Return to Lobby" button
- UI transitions to Lobby screen
- Room list: "Friday Night Mahjong" removed (game ended)

## Expected Outcome (Assert)

- ✅ Leave Game dialog opened and closed correctly
- ✅ User successfully left room (waiting phase)
- ✅ User successfully left game (playing phase)
- ✅ Other players were notified of player leaving
- ✅ Game ended for all players when player left during game
- ✅ UI transitioned correctly (Room → Lobby, Game → Lobby)
- ✅ WebSocket command/event sequence correct (LeaveRoom/LeaveGame → RoomLeft/GameAbandoned)

## Error Cases

### Leaving room during user's turn

- **When**: User clicks "Leave Game" during their turn
- **Expected**: Leave Game dialog shows warning about abandoning game
- **Assert**:
  - Dialog message: "Are you sure you want to leave? You have 15 seconds remaining on your turn."
  - User can still leave if confirmed

### WebSocket disconnect during leave

- **When**: Connection lost after clicking "Leave" but before receiving confirmation
- **Expected**: Client shows "Reconnecting..." overlay
- **Assert**:
  - On reconnect, client checks if leave succeeded
  - If left: shows lobby
  - If not left: shows room/game screen

### Leaving room with pending actions

- **When**: User has pending actions (e.g., selected tile, open dialog)
- **Expected**: Leave Game dialog shows warning about unsaved state
- **Assert**:
  - Dialog message: "You have unsaved changes. Are you sure you want to leave?"
  - User can still leave if confirmed

### Server rejects leave (invalid state)

- **When**: Server receives leave command in invalid state (shouldn't happen)
- **Expected**: Server rejects and shows error
- **Assert**:
  - WebSocket receives `LeaveFailed` event:
    - `reason: "Cannot leave in current state"`
  - Leave Game dialog shows error: "Unable to leave - please try again"

### Multiple leave attempts

- **When**: User clicks "Leave Game" multiple times rapidly
- **Expected**: Only first click sends command, subsequent clicks ignored
- **Assert**: WebSocket receives only one `LeaveRoom` or `LeaveGame` command

## Leave Behavior Summary

| Phase | Leave Action | Effect on Game | Effect on Other Players |
|--------|--------------|----------------|----------------------|
| Waiting | Leave Room | Room continues with remaining players | Player removed from room |
| Playing (Non-Host) | Leave Game | Game ends for all players | Game abandoned notification |
| Playing (Host) | Leave Game | Game ends for all players | Game abandoned notification |
| Game Over | Leave Room | Room returns to lobby | Player removed from room |

## Cross-References

### Related Scenarios

- `create-room.md` - Create a new room
- `join-room.md` - Join an existing room
- `abandon-game-consensus.md` - Abandon game by consensus

### Related Components

- [RoomScreen](../../component/specs/lobby/RoomScreen.md)
- [LeaveGameDialog](../../component/specs/game/LeaveGameDialog.md)
- [GameTable](../../component/specs/game/GameTable.md)
- [LobbyScreen](../../component/specs/lobby/LobbyScreen.md)

### Backend References

- Commands: `mahjong_core::command::LeaveRoom`, `LeaveGame`
- Events: `mahjong_core::event::RoomLeft`, `GameAbandoned`, `PlayerLeft`, `LeaveFailed`
- State: `GameState::Room`, `GameState::Playing`
- Logic: `mahjong_server::room::leave_room()`, `leave_game()`

### Accessibility Notes

- "Leave Room" button announced: "Leave room"
- "Leave Game" button announced: "Leave game"
- Leave Game dialog announced: "Leave game dialog opened. Are you sure you want to leave this room?"
- Warning announced: "Warning: Leaving during a game will end the game for everyone."
- "Leave" button announced: "Leave game, confirm"
- "Cancel" button announced: "Cancel, return to game"
- Game abandoned overlay announced: "Game abandoned by Player2. Reason: Player left during game. Return to Lobby button available."
