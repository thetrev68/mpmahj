# US-030: Join Room

## Story

**As a** player
**I want** to join an existing game room from the lobby
**So that** I can play American Mahjong with other players in a game that's already been configured

## Acceptance Criteria

### AC-1: Room List Display

**Given** I am on the lobby screen
**When** the lobby loads
**Then** a list of available rooms is displayed
**And** each room shows:

- **Room name** (e.g., "Friday Night Mahjong")
- **Players**: "2/4" (filled seats / total seats)
- **Card Year**: "2025" badge
- **Host**: Player name who created the room
- **Status**: "Waiting" (green) / "In Progress" (yellow) / "Full" (red)
- **House Rules Icons**: Visual indicators for active rules (blanks, joker pairs, etc.)

### AC-2: Filter and Sort Rooms

**Given** the room list is displayed
**When** I use the filter/sort controls
**Then** I can filter by:

- **Status**: Waiting only / All
- **Card Year**: 2017-2025
- **Has Open Seats**: Yes/No
  **And** I can sort by:
- **Created**: Newest first / Oldest first
- **Players**: Most full / Least full
- **Room Name**: A-Z

### AC-3: View Room Details

**Given** the room list is displayed
**When** I click on a room card
**Then** a room details panel slides in from the right showing:

- **Full room name**
- **Host name and seat**
- **Card year** selected
- **Current players**: List of seats (East/South/West/North) with player names or "Empty"
- **House rules**: Detailed list with descriptions
- **Timer settings**: Display per-phase timers
- **"Join Room" button** (enabled if seats available)

### AC-4: Seat Selection UI

**Given** the room details panel is open
**And** the room has 2 open seats (e.g., West and North empty)
**When** I click "Join Room"
**Then** a seat selection dialog appears showing:

- **Visual seat diagram** (4 seats arranged in compass positions)
- **Occupied seats**: Grayed out with player names
- **Available seats**: Highlighted and clickable
- **Auto-assign button**: "Join Any Seat"

### AC-5: Select Specific Seat

**Given** the seat selection dialog is open
**When** I click on "West" seat (available)
**Then** the West seat is highlighted with selection indicator
**And** a "Join as West" button appears
**And** I can change selection by clicking a different available seat

### AC-6: Auto-Assign Seat

**Given** the seat selection dialog is open
**When** I click "Join Any Seat"
**Then** the server automatically assigns me to the first available seat (lowest in order: East → South → West → North)
**And** a message displays: "Auto-assigned to South seat"

### AC-7: Send Join Room Command

**Given** I selected West seat and clicked "Join as West"
**When** the button is clicked
**Then** a `JoinRoom { room_id: "abc123", player_id: "user123", preferred_seat: West }` command is sent
**And** a loading overlay appears: "Joining room..."
**And** the join button is disabled

### AC-8: Join Successful

**Given** I sent the join room command
**When** the server emits `PlayerJoined { player: West, player_id: "user123", is_bot: false }`
**Then** I navigate to the game room/pre-game lobby
**And** I see my seat (West) with my name
**And** other players' seats with their names or "Waiting for player..."
**And** a message displays: "Joined room successfully. Waiting for game to start..."

### AC-9: Room Full Error

**Given** I try to join a room
**When** the room became full before my join completed
**Then** an error message appears: "Room is full. Please select another room."
**And** I return to the room list
**And** the room list updates to show the room as "Full"

### AC-10: Spectator Mode (Future)

**Given** a room is full (4/4 players)
**When** I view the room details
**Then** a "Spectate" button appears instead of "Join Room"
**And** clicking it allows me to watch the game (read-only)
**Note:** Spectator feature may be implemented in future, show disabled button with tooltip for now

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  JoinRoom: {
    room_id: string,
    player_id: string,
    preferred_seat: Seat | null  // null = auto-assign
  }
}
```text

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    PlayerJoined: {
      player: Seat,
      player_id: string,
      is_bot: false
    }
  }
}

// Room list updates (sent to lobby)
{
  kind: 'Public',
  event: {
    RoomListUpdate: {
      rooms: RoomInfo[]
    }
  }
}

interface RoomInfo {
  room_id: string;
  room_name: string;
  host_player_id: string;
  players_count: number;
  max_players: 4;
  card_year: number;
  status: "Waiting" | "InProgress" | "Full";
  house_rules_summary: string[];  // Icons/short descriptions
  created_at: number;  // Timestamp
}
```text

### Backend References

- **Rust Code**:
  - `crates/mahjong_server/src/network/room.rs` - Room management and join logic
  - `crates/mahjong_server/src/command.rs` - `JoinRoom` command handler
  - `crates/mahjong_server/src/event/public_events.rs` - `PlayerJoined`, `RoomListUpdate`
  - `crates/mahjong_core/src/player.rs` - Seat assignment
- **Game Design Doc**:
  - Section 7.1 (Lobby and Room List)
  - Section 7.2 (Joining Rooms and Seat Selection)

## Components Involved

- **`<RoomList>`** - Grid of available rooms
- **`<RoomCard>`** - Individual room display card
- **`<RoomDetailsPanel>`** - Sliding panel with full room info
- **`<RoomFilters>`** - Filter and sort controls
- **`<SeatSelectionDialog>`** - Modal for choosing seat
- **`<SeatDiagram>`** - Visual 4-seat compass layout
- **`<JoinRoomButton>`** - Join action button
- **`<LoadingOverlay>`** - "Joining room..." overlay

**Component Specs:**

- `component-specs/container/RoomList.md` (NEW)
- `component-specs/presentational/RoomCard.md` (NEW)
- `component-specs/presentational/RoomDetailsPanel.md` (NEW)
- `component-specs/presentational/SeatSelectionDialog.md` (NEW)
- `component-specs/presentational/SeatDiagram.md` (NEW)

## Test Scenarios

- **`tests/test-scenarios/join-room-basic.md`** - Join room with specific seat
- **`tests/test-scenarios/join-room-auto-assign.md`** - Auto-assign to any seat
- **`tests/test-scenarios/join-room-full.md`** - Attempt to join full room
- **`tests/test-scenarios/join-room-filters.md`** - Filter and sort room list
- **`tests/test-scenarios/join-room-network-error.md`** - Network failure during join

## Mock Data

**Fixtures:**

- `tests/fixtures/rooms/room-list.json` - Sample list of available rooms
- `tests/fixtures/rooms/room-details.json` - Full room details
- `tests/fixtures/events/join-room-sequence.json` - Join event flow

**Sample Room List:**

```json
{
  "rooms": [
    {
      "room_id": "room001",
      "room_name": "Friday Night Mahjong",
      "host_player_id": "alice123",
      "players_count": 2,
      "max_players": 4,
      "card_year": 2025,
      "status": "Waiting",
      "house_rules_summary": ["Use Blanks", "Full Charleston"],
      "created_at": 1706634000000
    },
    {
      "room_id": "room002",
      "room_name": "Quick Game",
      "host_player_id": "bob456",
      "players_count": 4,
      "max_players": 4,
      "card_year": 2020,
      "status": "InProgress",
      "house_rules_summary": ["Standard NMJL"],
      "created_at": 1706634300000
    },
    {
      "room_id": "room003",
      "room_name": "Beginner Practice",
      "host_player_id": "charlie789",
      "players_count": 1,
      "max_players": 4,
      "card_year": 2025,
      "status": "Waiting",
      "house_rules_summary": ["Unlimited Hints", "Relaxed Timers"],
      "created_at": 1706634600000
    }
  ]
}
```text

**Sample Join Room Event Sequence:**

```json
{
  "scenario": "Join Room Successfully",
  "events": [
    {
      "kind": "Public",
      "event": {
        "PlayerJoined": {
          "player": "West",
          "player_id": "user123",
          "is_bot": false
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "RoomListUpdate": {
          "rooms": [
            {
              "room_id": "room001",
              "players_count": 3
            }
          ]
        }
      }
    }
  ]
}
```text

## Edge Cases

### EC-1: Room Full Before Join Completes

**Given** I click "Join Room" for a room with 1 open seat
**When** another player joins the same seat simultaneously
**Then** the server rejects my join with "Room is full"
**And** an error message displays
**And** the room list updates to show room as Full

### EC-2: Preferred Seat Already Taken

**Given** I select South seat and click "Join as South"
**When** another player took South seat moments before
**Then** the server rejects with "Seat already occupied"
**And** a message appears: "South seat taken. Please select another seat."
**And** the seat selection dialog updates to show South as occupied

### EC-3: Network Error During Join

**Given** I send join room command but network fails
**When** no `PlayerJoined` event received within 5 seconds
**Then** an error toast: "Failed to join room. Retrying..."
**And** the command is automatically retried (max 3 attempts)
**And** if all retries fail: "Could not join room. Please try again."

### EC-4: Room Deleted While Viewing

**Given** I am viewing room details
**When** the host deletes/closes the room
**Then** the details panel closes
**And** a message: "Room no longer available"
**And** the room is removed from the room list

### EC-5: Auto-Assign Logic

**Given** a room has East and North empty (South and West occupied)
**When** I click "Join Any Seat"
**Then** I am assigned to East (first available in order)
**Note:** Order preference: East → South → West → North

### EC-6: Join as Bot-Filled Seat

**Given** a room has 2 human players and 2 bots
**When** I join and select a seat currently occupied by a bot
**Then** the bot is removed and I take that seat
**And** a message: "Replaced bot in South seat"

## Related User Stories

- **US-029**: Create Room - Rooms to join must first be created
- **US-031**: Leave Game - Can leave after joining
- **US-001**: Roll Dice & Break Wall - Game starts after all players join

## Accessibility Considerations

### Keyboard Navigation

- **Tab**: Navigate through room cards in list
- **Enter**: Open room details for focused room
- **Arrow Keys**: Navigate seats in seat selection dialog
- **Space**: Select focused seat
- **Escape**: Close room details or seat selection dialog

### Screen Reader

- **Room List**: "Room list. 3 rooms available. Friday Night Mahjong, 2 of 4 players, card year 2025, waiting."
- **Room Card**: "Friday Night Mahjong. 2 of 4 players. Host: Alice. Card year 2025. Status: Waiting for players. Click to view details."
- **Seat Selection**: "Seat selection. 4 seats total. 2 occupied, 2 available. East: Alice. South: Empty, available. West: Bob. North: Empty, available. Select a seat or click auto-assign."
- **Join Success**: "Joined room successfully as West. Waiting for game to start."

### Visual

- **High Contrast**: Room cards have clear borders and status colors (green/yellow/red)
- **Seat Diagram**: Visual compass layout with clear occupied/available states
- **Status Indicators**: Color-coded badges (Waiting: green, In Progress: yellow, Full: red)
- **Motion**: Room details panel slide animation respects `prefers-reduced-motion`

## Priority

**CRITICAL** - Required for multiplayer gameplay

## Story Points / Complexity

**3** - Medium complexity

- Room list display and updates
- Filter and sort functionality
- Room details panel
- Seat selection UI with visual diagram
- Auto-assign logic
- Join command and event handling
- Error handling for full rooms and taken seats

## Definition of Done

- [ ] Room list displayed on lobby screen
- [ ] Each room shows name, players, year, host, status, rules icons
- [ ] Filter by status, card year, open seats
- [ ] Sort by created, players, name
- [ ] Click room opens details panel
- [ ] Details panel shows full room info
- [ ] "Join Room" button available for rooms with open seats
- [ ] Click join opens seat selection dialog
- [ ] Seat diagram shows 4 seats in compass layout
- [ ] Occupied seats grayed out with player names
- [ ] Available seats highlighted and clickable
- [ ] Select seat highlights it
- [ ] "Join as [Seat]" button confirms selection
- [ ] "Join Any Seat" auto-assigns to first available
- [ ] `JoinRoom` command sent with room_id, player_id, preferred_seat
- [ ] Loading overlay shows "Joining room..."
- [ ] `PlayerJoined` event navigates to game room
- [ ] User sees their seat with name in pre-game lobby
- [ ] Room full error handled gracefully
- [ ] Seat taken error updates dialog
- [ ] Network error handling with retry logic
- [ ] Room deletion while viewing handled
- [ ] Bot replacement when joining bot-filled seat
- [ ] Room list updates in real-time
- [ ] Component tests pass (RoomList, RoomCard, SeatSelection)
- [ ] Integration tests pass (join → seat selection → confirm)
- [ ] E2E test passes (full join flow)
- [ ] Accessibility tests pass (keyboard nav, screen reader, ARIA)
- [ ] Manually tested against `user-testing-plan.md` (Part 7, Room joining)
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

### Room List Component

```typescript
<RoomList
  rooms={availableRooms}
  filters={filters}
  sortBy={sortBy}
  onRoomClick={(room) => setSelectedRoom(room)}
/>
```text

Display in a grid layout (2-3 columns depending on screen width):

```typescript
<div className="room-grid">
  {filteredAndSortedRooms.map(room => (
    <RoomCard
      key={room.room_id}
      room={room}
      onClick={() => handleRoomClick(room)}
    />
  ))}
</div>
```text

### Seat Selection Dialog

```typescript
<SeatSelectionDialog
  room={selectedRoom}
  onSeatSelect={(seat: Seat | null) => {
    if (seat === null) {
      // Auto-assign
      sendCommand({ JoinRoom: { room_id: selectedRoom.room_id, player_id: myPlayerId, preferred_seat: null } });
    } else {
      // Specific seat
      sendCommand({ JoinRoom: { room_id: selectedRoom.room_id, player_id: myPlayerId, preferred_seat: seat } });
    }
  }}
  onCancel={() => setShowSeatSelection(false)}
/>
```text

### Seat Diagram Visual

Create a compass-style layout:

```text
       North
         🪑

West 🪑   ⬛   🪑 East

         🪑
       South
```text

Each seat shows:

- Player name if occupied (grayed out)
- "Available" if empty (clickable, highlighted)
- Selection indicator if selected

### Auto-Assign Logic

```typescript
function getFirstAvailableSeat(occupiedSeats: Seat[]): Seat | null {
  const seatOrder = [Seat.East, Seat.South, Seat.West, Seat.North];
  return seatOrder.find((seat) => !occupiedSeats.includes(seat)) ?? null;
}
```text

### Room List Filtering

```typescript
function filterRooms(rooms: RoomInfo[], filters: RoomFilters): RoomInfo[] {
  return rooms.filter((room) => {
    if (filters.status === 'WaitingOnly' && room.status !== 'Waiting') {
      return false;
    }

    if (filters.cardYear && room.card_year !== filters.cardYear) {
      return false;
    }

    if (filters.hasOpenSeats && room.players_count >= room.max_players) {
      return false;
    }

    return true;
  });
}

function sortRooms(rooms: RoomInfo[], sortBy: SortOption): RoomInfo[] {
  return [...rooms].sort((a, b) => {
    switch (sortBy) {
      case 'CreatedNewest':
        return b.created_at - a.created_at;
      case 'CreatedOldest':
        return a.created_at - b.created_at;
      case 'PlayersMostFull':
        return b.players_count - a.players_count;
      case 'PlayersLeastFull':
        return a.players_count - b.players_count;
      case 'NameAZ':
        return a.room_name.localeCompare(b.room_name);
      default:
        return 0;
    }
  });
}
```text

### Real-Time Room List Updates

```typescript
useEffect(() => {
  // Subscribe to room list updates
  const unsubscribe = subscribeToLobbyEvents((event) => {
    if (event.kind === 'Public' && event.event.RoomListUpdate) {
      setRooms(event.event.RoomListUpdate.rooms);
    }
  });

  // Request initial room list
  sendCommand({ RequestRoomList: { player_id: myPlayerId } });

  return unsubscribe;
}, []);
```text

### Zustand Store Updates

```typescript
case 'PlayerJoined':
  if (event.player_id === myPlayerId) {
    // I joined successfully
    state.currentRoom = roomId;
    state.mySeat = event.player;
    state.inLobby = false;
    state.inRoom = true;
  } else {
    // Another player joined
    state.roomPlayers[event.player] = {
      player_id: event.player_id,
      is_bot: event.is_bot
    };
  }
  break;

case 'RoomListUpdate':
  state.availableRooms = event.rooms;
  break;
```text

### Error Handling

```typescript
try {
  sendCommand({ JoinRoom: { room_id, player_id, preferred_seat } });
  setJoining(true);
} catch (error) {
  showError('Failed to join room');
  setJoining(false);
}

// Timeout after 5 seconds
setTimeout(() => {
  if (joining) {
    showError('Join room timed out. Please try again.');
    setJoining(false);
  }
}, 5000);
```text

```text

```text
```
