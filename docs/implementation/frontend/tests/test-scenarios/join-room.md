# Test Scenario: Join Room

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-030 - Join Room
**Component Specs**: LobbyScreen.md, JoinRoomDialog.md, RoomList.md
**Fixtures**: `lobby-with-rooms.json`, `join-room-sequence.json`
**Manual Test**: Manual Testing Checklist #30

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/lobby-with-rooms.json`
- **Mock WebSocket**: Connected
- **User**: Logged in as "Player2"
- **Current screen**: Lobby (main menu)
- **Rooms**: 3 rooms available
  - Room 1: "Friday Night Mahjong" (room_abc123) - 3/4 players, no password
  - Room 2: "Tournament Room" (room_def456) - 2/4 players, password protected
  - Room 3: "Practice Session" (room_ghi789) - 1/4 players, no password

## Steps (Act)

### Step 1: Verify lobby state

- UI shows lobby screen with:
  - Header: "Mahjong Lobby"
  - "Create Room" button (enabled)
  - "Join Room" button (enabled)
  - "Quick Match" button (enabled)
  - Room list:
    - "Friday Night Mahjong" - 3/4 players - Standard - [Join]
    - "Tournament Room" 🔒 - 2/4 players - Tournament - [Join]
    - "Practice Session" - 1/4 players - Practice - [Join]
  - Player info: "Player2 (Online)"

### Step 2: User opens Join Room dialog

- User clicks "Join Room" button
- Join Room dialog slides in from center of screen
- UI shows Join Room dialog with:
  - **Header**: "Join Room"
  - **Room ID**: [__________] (text input)
  - **Password**: [Optional] (text input, optional)
  - **Buttons**: "Join", "Cancel"

### Step 3: User enters room ID

- User clicks "Room ID" input
- User types "room_abc123"
- Room ID updates: "room_abc123"

### Step 4: User joins room (no password)

- User clicks "Join" button
- WebSocket sends `JoinRoom` command:
  - `room_id: "room_abc123"`
  - `password: null`
- Join Room dialog shows spinner: "Joining room..."

### Step 5: Server validates and accepts join

- Server validates:
  - ✅ Room exists
  - ✅ Room is not full (3/4 players)
  - ✅ No password required
- WebSocket receives `RoomJoined` event:
  - `room_id: "room_abc123"`
  - `room_name: "Friday Night Mahjong"`
  - `host: "Player1"`
  - `players: ["Player1", "Player2"]`
  - `max_players: 4`
  - `game_mode: "Standard"`
  - `status: "Waiting"`
  - `seat: "South"` (assigned by server)
- Join Room dialog closes with success animation

### Step 6: User joins room

- UI transitions to Room screen:
  - **Header**: "Friday Night Mahjong"
  - **Room ID**: "room_abc123" (copyable)
  - **Players**: "2/4 players"
  - **Player List**:
    - "Player1 (Host) - East"
    - "Player2 - South"
  - **Status**: "Waiting for players..."
  - **Buttons**: "Start Game" (disabled - host only), "Leave Room"

### Step 7: User leaves room (to test password-protected room)

- User clicks "Leave Room" button
- WebSocket sends `LeaveRoom` command
- UI transitions back to Lobby screen

### Step 8: User joins password-protected room

- User clicks "Join Room" button
- Join Room dialog slides in
- User types "room_def456" in "Room ID" input
- User types "secret123" in "Password" input
- User clicks "Join" button
- WebSocket sends `JoinRoom` command:
  - `room_id: "room_def456"`
  - `password: "secret123"`
- Join Room dialog shows spinner: "Joining room..."

### Step 9: Server validates password

- Server validates:
  - ✅ Room exists
  - ✅ Room is not full (2/4 players)
  - ✅ Password matches
- WebSocket receives `RoomJoined` event:
  - `room_id: "room_def456"`
  - `room_name: "Tournament Room"`
  - `host: "Player3"`
  - `players: ["Player3", "Player2"]`
  - `max_players: 4`
  - `game_mode: "Tournament"`
  - `status: "Waiting"`
  - `seat: "South"` (assigned by server)
- Join Room dialog closes with success animation

### Step 10: User joins password-protected room

- UI transitions to Room screen:
  - **Header**: "Tournament Room"
  - **Room ID**: "room_def456" (copyable)
  - **Players**: "2/4 players"
  - **Player List**:
    - "Player3 (Host) - East"
    - "Player2 - South"
  - **Status**: "Waiting for players..."
  - **Buttons**: "Start Game" (disabled - host only), "Leave Room"

### Step 11: User leaves room again

- User clicks "Leave Room" button
- WebSocket sends `LeaveRoom` command
- UI transitions back to Lobby screen

### Step 12: User joins room from room list

- User clicks "Join" button next to "Practice Session" in room list
- Join Room dialog slides in with pre-filled room ID: "room_ghi789"
- User clicks "Join" button
- WebSocket sends `JoinRoom` command:
  - `room_id: "room_ghi789"`
  - `password: null`
- Join Room dialog shows spinner: "Joining room..."

### Step 13: Server accepts join

- WebSocket receives `RoomJoined` event:
  - `room_id: "room_ghi789"`
  - `room_name: "Practice Session"`
  - `host: "Player4"`
  - `players: ["Player4", "Player2"]`
  - `max_players: 4`
  - `game_mode: "Practice"`
  - `status: "Waiting"`
  - `seat: "South"` (assigned by server)
- Join Room dialog closes with success animation

### Step 14: User joins practice room

- UI transitions to Room screen:
  - **Header**: "Practice Session"
  - **Room ID**: "room_ghi789" (copyable)
  - **Players**: "2/4 players"
  - **Player List**:
    - "Player4 (Host) - East"
    - "Player2 - South"
  - **Status**: "Waiting for players..."
  - **Buttons**: "Start Game" (disabled - host only), "Leave Room"

## Expected Outcome (Assert)

- ✅ Join Room dialog opened and closed correctly
- ✅ User successfully joined room by ID (no password)
- ✅ User successfully joined password-protected room (with correct password)
- ✅ User successfully joined room from room list
- ✅ User was assigned correct seat (South) in each room
- ✅ Room screen displayed correct information (room name, players, status)
- ✅ WebSocket command/event sequence correct (JoinRoom → RoomJoined)

## Error Cases

### Joining non-existent room

- **When**: User enters invalid room ID
- **Expected**: Server rejects join
- **Assert**:
  - WebSocket receives `RoomJoinFailed` event:
    - `reason: "Room not found"`
  - Join Room dialog shows error: "Room not found"
  - User remains in lobby

### Joining full room

- **When**: User tries to join room with 4/4 players
- **Expected**: Server rejects join
- **Assert**:
  - WebSocket receives `RoomJoinFailed` event:
    - `reason: "Room is full"`
  - Join Room dialog shows error: "Room is full"
  - User remains in lobby

### Joining with wrong password

- **When**: User enters incorrect password for password-protected room
- **Expected**: Server rejects join
- **Assert**:
  - WebSocket receives `RoomJoinFailed` event:
    - `reason: "Invalid password"`
  - Join Room dialog shows error: "Invalid password"
  - User remains in lobby

### Joining without password for password-protected room

- **When**: User leaves password field empty for password-protected room
- **Expected**: Server rejects join
- **Assert**:
  - WebSocket receives `RoomJoinFailed` event:
    - `reason: "Password required"`
  - Join Room dialog shows error: "Password required"
  - User remains in lobby

### Joining room already in progress

- **When**: User tries to join room where game has started
- **Expected**: Server rejects join
- **Assert**:
  - WebSocket receives `RoomJoinFailed` event:
    - `reason: "Game in progress"`
  - Join Room dialog shows error: "Game in progress - cannot join"
  - User remains in lobby

### WebSocket disconnect during join

- **When**: Connection lost after clicking "Join" but before receiving `RoomJoined`
- **Expected**: Client shows "Reconnecting..." overlay
- **Assert**:
  - On reconnect, client checks if join succeeded
  - If joined: shows room screen
  - If not joined: shows error "Join failed - please try again"

### Joining room with invalid room ID format

- **When**: User enters invalid room ID format (special characters, too long)
- **Expected**: Client validates and shows error
- **Assert**:
  - "Join" button disabled until valid room ID entered
  - Error message: "Invalid room ID format"

## Room List Features

### Room Information Display

| Field | Description |
|-------|-------------|
| Room Name | Display name of the room |
| Players | Current/maximum players (e.g., "3/4") |
| Game Mode | Standard, Practice, or Tournament |
| Password | Lock icon (🔒) if password protected |
| Join Button | Click to join the room |

### Room Status

| Status | Description | Joinable |
|--------|-------------|-----------|
| Waiting | Room waiting for players | Yes |
| In Progress | Game has started | No |
| Full | Room has max players | No |
| Closed | Room closed by host | No |

## Cross-References

### Related Scenarios

- `create-room.md` - Create a new room
- `leave-game.md` - Leave a room/game
- `configure-house-rules.md` - Configure house rules

### Related Components

- [LobbyScreen](../../component-specs/lobby/LobbyScreen.md)
- [JoinRoomDialog](../../component/specs/lobby/JoinRoomDialog.md)
- [RoomList](../../component/specs/lobby/RoomList.md)
- [RoomScreen](../../component/specs/lobby/RoomScreen.md)

### Backend References

- Commands: `mahjong_core::command::JoinRoom`, `LeaveRoom`
- Events: `mahjong_core::event::RoomJoined`, `RoomJoinFailed`, `PlayerJoined`, `PlayerLeft`
- State: `GameState::Lobby`, `GameState::Room`
- Logic: `mahjong_server::room::join_room()`, `validate_join()`

### Accessibility Notes

- "Join Room" button announced: "Join existing room"
- Join Room dialog announced: "Join room dialog opened"
- Room ID input announced: "Room ID, text input"
- Password input announced: "Password, text input, optional"
- "Join" button announced: "Join room, room_abc123"
- Room list announced: "3 rooms available. Friday Night Mahjong, 3 of 4 players, Standard mode, Join. Tournament Room, password protected, 2 of 4 players, Tournament mode, Join. Practice Session, 1 of 4 players, Practice mode, Join."
- Room screen announced: "Room: Friday Night Mahjong, room ID: room_abc123, 2 of 4 players. Player1 (Host) - East. Player2 - South. Waiting for players..."
- "Leave Room" button announced: "Leave room"
