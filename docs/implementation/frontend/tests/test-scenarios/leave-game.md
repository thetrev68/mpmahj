# Test Scenario: Leave Game

**User Story**: US-031 - Leave Game
**Fixtures**: `room-waiting.json`, `room-playing.json`

## Setup (Part 1: Waiting Phase)

- Game state: Room screen, waiting phase
- Players: 3/4 (Player1 Host, Player2, Player3)
- User: Logged in as Player2

## Setup (Part 2: Playing Phase Non-Host)

- Game state: Game table, mid-game
- Players: 4/4 (Player1, Player2, Player3, Player4)
- Current turn: South (Player2)

## Setup (Part 3: Playing Phase Host)

- Game state: Game table, mid-game
- Players: 4/4 (Player1 Host, Player2, Player3, Player4)
- Current turn: East (Player1 Host)

## Test Flow (Act & Assert)

### Waiting Phase Leave

1. **When**: Game is Waiting phase, 3/4 players joined, user is Player2
2. **User action**: Clicks "Leave Room" button
3. **Dialog**: Confirms "Are you sure you want to leave?"
4. **Send**: `LeaveRoom` command
5. **Receive**: `RoomLeft { room_id: room_abc123, player: Player2 }`
6. **Assert**: UI transitions to Lobby, room shows 2/4 players
7. **Other players**: Receive `PlayerLeft` event

### Playing Phase Leave (Non-Host)

1. **When**: Game is Playing, user is Player2 (not host)
2. **User action**: Clicks "Leave Game" button
3. **Dialog**: Warns "Leaving will end game for all players"
4. **Send**: `LeaveGame` command
5. **Receive**: `GameAbandoned { abandoned_by: Player2, reason: PlayerLeftDuringGame }`
6. **Assert**: UI transitions to Lobby, game ended
7. **All players**: Receive GameAbandoned notification

### Playing Phase Leave (Host)

1. **When**: Game is Playing, user is Player1 (host)
2. **User action**: Clicks "Leave Game" button
3. **Dialog**: Warns "You are the host. Leaving will end game for everyone"
4. **Send**: `LeaveGame` command
5. **Receive**: `GameAbandoned { abandoned_by: Player1, reason: HostLeftDuringGame }`
6. **Assert**: UI transitions to Lobby, game ended
7. **All players**: Receive GameAbandoned notification

## Success Criteria

- ✅ Leave dialog opened and closed correctly
- ✅ User left room (waiting phase)
- ✅ User left game (playing phase)
- ✅ Other players notified of player leaving
- ✅ Game ended for all when player left during game
- ✅ UI transitioned correctly (Room/Game → Lobby)
- ✅ Event sequence: LeaveRoom/LeaveGame → RoomLeft/GameAbandoned

## Error Cases

### WebSocket disconnect during leave

- **When**: Connection lost after clicking "Leave"
- **Expected**: Client shows "Reconnecting..."
- **Assert**: On reconnect, checks if leave succeeded; shows Lobby or Game accordingly

### Server rejects leave (invalid state)

- **When**: Server receives leave command in invalid state
- **Expected**: Server rejects via `CommandRejected`
- **Assert**: Leave fails, dialog shows error, user remains in game

### Multiple leave attempts

- **When**: User clicks "Leave Game" multiple times rapidly
- **Expected**: Only first click sends command
- **Assert**: WebSocket receives only one LeaveGame command
