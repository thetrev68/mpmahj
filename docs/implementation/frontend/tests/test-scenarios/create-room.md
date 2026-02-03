# Test Scenario: Create Room

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-029 - Create Room
**Component Specs**: LobbyScreen.md, CreateRoomDialog.md, RoomSettings.md
**Fixtures**: `lobby-empty.json`, `create-room-sequence.json`
**Manual Test**: Manual Testing Checklist #29

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/lobby-empty.json`
- **Mock WebSocket**: Connected
- **User**: Logged in as "Player1"
- **Current screen**: Lobby (main menu)
- **Rooms**: No rooms created yet
- **Create Room dialog**: Closed (hidden by default)

## Steps (Act)

### Step 1: Verify lobby state

- UI shows lobby screen with:
  - Header: "Mahjong Lobby"
  - "Create Room" button (enabled)
  - "Join Room" button (enabled)
  - "Quick Match" button (enabled)
  - Room list: "No rooms available"
  - Player info: "Player1 (Online)"

### Step 2: User opens Create Room dialog

- User clicks "Create Room" button
- Create Room dialog slides in from center of screen
- UI shows Create Room dialog with:
  - **Header**: "Create New Room"
  - **Room Name**: [My Room] (text input, default value)
  - **Room Password**: [Optional] (text input, optional)
  - **Max Players**: [4 ▼] (dropdown, options: 2, 3, 4)
  - **Game Mode**: [Standard ▼] (dropdown, options: Standard, Practice, Tournament)
  - **House Rules**: [Configure...] (button)
  - **Timer Settings**: [Configure...] (button)
  - **Buttons**: "Create Room", "Cancel"

### Step 3: User configures room settings

- User clicks "Room Name" input
- User types "Friday Night Mahjong"
- Room name updates: "Friday Night Mahjong"

- User clicks "Max Players" dropdown
- Dropdown options appear: 2, 3, 4
- User selects "4" (default)
- Max players updates: "4"

- User clicks "Game Mode" dropdown
- Dropdown options appear: Standard, Practice, Tournament
- User selects "Standard" (default)
- Game mode updates: "Standard"

- User clicks "House Rules" button
- House Rules dialog opens:
  - **Header**: "House Rules"
  - **Rules**:
    - [✓] Allow Second Charleston
    - [✓] Allow Joker Exchanges
    - [✓] Allow Smart Undo (Practice mode only)
    - [ ] Allow Custom Patterns
    - [ ] Strict Tile Counting
  - **Buttons**: "Save", "Cancel"
- User clicks "Save"
- House Rules dialog closes
- "House Rules" button shows: "Configured"

- User clicks "Timer Settings" button
- Timer Settings dialog opens:
  - **Header**: "Timer Settings"
  - **Timers**:
    - **Turn Timer**: [30 ▼] seconds (options: 15, 30, 60, 120)
    - **Call Window Timer**: [5 ▼] seconds (options: 3, 5, 10)
    - **Charleston Timer**: [45 ▼] seconds (options: 30, 45, 60)
  - **Buttons**: "Save", "Cancel"
- User clicks "Save"
- Timer Settings dialog closes
- "Timer Settings" button shows: "Configured"

### Step 4: User creates the room

- User clicks "Create Room" button
- WebSocket sends `CreateRoom` command:
  - `room_name: "Friday Night Mahjong"`
  - `password: null` (no password)
  - `max_players: 4`
  - `game_mode: "Standard"`
  - `house_rules: { allow_second_charleston: true, allow_joker_exchanges: true, allow_smart_undo: false, allow_custom_patterns: false, strict_tile_counting: false }`
  - `timer_settings: { turn_timer: 30, call_window_timer: 5, charleston_timer: 45 }`
- Create Room dialog shows spinner: "Creating room..."

### Step 5: Server creates the room

- Server validates room settings
- Server creates new room with unique ID
- WebSocket receives `RoomCreated` event:
  - `room_id: "room_abc123"`
  - `room_name: "Friday Night Mahjong"`
  - `host: "Player1"`
  - `players: ["Player1"]`
  - `max_players: 4`
  - `game_mode: "Standard"`
  - `status: "Waiting"`
- Create Room dialog closes with success animation

### Step 6: User joins the created room

- UI transitions to Room screen:
  - **Header**: "Friday Night Mahjong"
  - **Room ID**: "room_abc123" (copyable)
  - **Players**: "1/4 players"
  - **Player List**:
    - "Player1 (Host) - East"
  - **Status**: "Waiting for players..."
  - **Buttons**: "Start Game" (disabled - need 4 players), "Leave Room"

### Step 7: User shares room ID with friends

- User clicks "Copy Room ID" button
- Room ID copied to clipboard: "room_abc123"
- UI shows toast: "Room ID copied to clipboard!"
- User can share room ID with friends to invite them

### Step 8: User waits for other players to join

- Simulated: Player2 joins the room
- WebSocket receives `PlayerJoined` event:
  - `room_id: "room_abc123"`
  - `player: "Player2"`
  - `seat: "South"`
- UI updates:
  - Players: "2/4 players"
  - Player List:
    - "Player1 (Host) - East"
    - "Player2 - South"

- Simulated: Player3 joins the room
- WebSocket receives `PlayerJoined` event:
  - `room_id: "room_abc123"`
  - `player: "Player3"`
  - `seat: "West"`
- UI updates:
  - Players: "3/4 players"
  - Player List:
    - "Player1 (Host) - East"
    - "Player2 - South"
    - "Player3 - West"

- Simulated: Player4 joins the room
- WebSocket receives `PlayerJoined` event:
  - `room_id: "room_abc123"`
  - `player: "Player4"`
  - `seat: "North"`
- UI updates:
  - Players: "4/4 players"
  - Player List:
    - "Player1 (Host) - East"
    - "Player2 - South"
    - "Player3 - West"
    - "Player4 - North"
  - "Start Game" button becomes enabled

### Step 9: User starts the game

- User (host) clicks "Start Game" button
- WebSocket sends `StartGame` command
- UI shows "Starting game..." spinner
- Game transitions to pre-game phase (dice rolling)

## Expected Outcome (Assert)

- ✅ Create Room dialog opened and closed correctly
- ✅ User configured room settings (name, max players, game mode, house rules, timer settings)
- ✅ Room created successfully with unique ID
- ✅ User joined the created room as host
- ✅ Room ID was copied to clipboard
- ✅ Other players joined the room
- ✅ "Start Game" button enabled when room is full
- ✅ WebSocket command/event sequence correct (CreateRoom → RoomCreated → PlayerJoined × 3 → StartGame)

## Error Cases

### Creating room with duplicate name

- **When**: User creates room with name that already exists
- **Expected**: Server generates unique ID, allows duplicate names
- **Assert**:
  - `RoomCreated` event received with unique `room_id`
  - Room name may be same as existing room

### Creating room with invalid name

- **When**: User enters invalid room name (empty, too long, special characters)
- **Expected**: Client validates and shows error
- **Assert**:
  - "Create Room" button disabled until valid name entered
  - Error message: "Room name must be 3-50 characters, letters and numbers only"

### Creating room with password

- **When**: User enters password in "Room Password" field
- **Expected**: Room created with password protection
- **Assert**:
  - `RoomCreated` event includes `password_protected: true`
  - Room list shows lock icon for password-protected rooms
  - Joining players must enter password

### WebSocket disconnect during room creation

- **When**: Connection lost after clicking "Create Room" but before receiving `RoomCreated`
- **Expected**: Client shows "Reconnecting..." overlay
- **Assert**:
  - On reconnect, client checks if room was created
  - If created: joins room
  - If not created: shows error "Room creation failed"

### Creating room with invalid settings

- **When**: User configures invalid settings (shouldn't happen due to UI validation)
- **Expected**: Server validates and rejects
- **Assert**:
  - WebSocket receives `RoomCreationFailed` event:
    - `reason: "Invalid settings"`
  - Create Room dialog shows error: "Invalid room settings"

### Starting game with insufficient players

- **When**: Host clicks "Start Game" with < 4 players
- **Expected**: "Start Game" button disabled
- **Assert**: Button's `disabled` state reflects `players.length < 4`

## Room Settings

### Room Name

- **Length**: 3-50 characters
- **Characters**: Letters, numbers, spaces
- **Uniqueness**: Not required (server generates unique ID)

### Max Players

| Value | Description |
|-------|-------------|
| 2 | 2-player game (East, South) |
| 3 | 3-player game (East, South, West) |
| 4 | 4-player game (East, South, West, North) |

### Game Mode

| Mode | Description |
|------|-------------|
| Standard | Normal multiplayer game |
| Practice | Solo practice with AI bots |
| Tournament | Competitive tournament mode |

### House Rules

| Rule | Description |
|------|-------------|
| Allow Second Charleston | Players can vote for Second Charleston |
| Allow Joker Exchanges | Players can exchange Jokers from exposed melds |
| Allow Smart Undo | Players can undo moves (Practice mode only) |
| Allow Custom Patterns | Players can use custom winning patterns |
| Strict Tile Counting | Enforce strict tile counting rules |

### Timer Settings

| Timer | Options | Default |
|-------|---------|---------|
| Turn Timer | 15, 30, 60, 120 seconds | 30 |
| Call Window Timer | 3, 5, 10 seconds | 5 |
| Charleston Timer | 30, 45, 60 seconds | 45 |

## Cross-References

### Related Scenarios

- `join-room.md` - Join an existing room
- `leave-game.md` - Leave a room/game
- `configure-house-rules.md` - Configure house rules
- `timer-expiry.md` - Timer expiry behavior

### Related Components

- [LobbyScreen](../../component-specs/lobby/LobbyScreen.md)
- [CreateRoomDialog](../../component/specs/lobby/CreateRoomDialog.md)
- [RoomSettings](../../component/specs/lobby/RoomSettings.md)
- [RoomScreen](../../component/specs/lobby/RoomScreen.md)

### Backend References

- Commands: `mahjong_core::command::CreateRoom`, `StartGame`
- Events: `mahjong_core::event::RoomCreated`, `PlayerJoined`, `RoomCreationFailed`
- State: `GameState::Lobby`, `GameState::Room`
- Logic: `mahjong_server::room::create_room()`, `validate_room_settings()`

### Accessibility Notes

- "Create Room" button announced: "Create new room"
- Create Room dialog announced: "Create new room dialog opened"
- Room name input announced: "Room name, text input, My Room"
- Max players dropdown announced: "Maximum players, 4 selected. Options: 2, 3, 4"
- Game mode dropdown announced: "Game mode, Standard selected. Options: Standard, Practice, Tournament"
- House Rules button announced: "Configure house rules, not configured"
- Timer Settings button announced: "Configure timer settings, not configured"
- "Create Room" button announced: "Create room, Friday Night Mahjong, 4 players, Standard mode"
- Room screen announced: "Room: Friday Night Mahjong, room ID: room_abc123, 1 of 4 players"
- "Copy Room ID" button announced: "Copy room ID to clipboard"
- "Start Game" button announced: "Start game, disabled, waiting for 3 more players"
