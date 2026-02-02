# Test Scenario: Disconnect and Reconnect - Network Recovery

**User Story**: US-032 (Connection Management)
**Component Specs**: ConnectionStatus.md, GameBoard.md, useGameSocket.md
**Fixtures**: `game-states/mid-game-charleston.json`, `event-sequences/reconnect-flow.json`

## Setup (Arrange)

- Game state: Charleston phase (FirstRight), user has selected 2 of 3 tiles
- Mock WebSocket: initially connected
- User seated as: West (seat 3)
- Auth token: valid, stored in localStorage
- Room ID: stored in session
- Partial action in progress: 2 tiles selected for pass

## Steps (Act)

### Step 1: User is actively playing (before disconnect)

- Game state: Charleston FirstRight phase
- User (West) has selected 2 of 3 tiles for passing:
  - Tile at index 4: "6 Crak" (selected, highlighted)
  - Tile at index 9: "White Dragon" (selected, highlighted)
- UI shows: "2/3 tiles selected"
- "Pass Tiles" button is disabled (need 3 tiles)
- Charleston timer shows: "38s remaining"
- WebSocket connection is stable

### Step 2: Network interruption occurs

- **Trigger**: Network drops (WiFi disconnect, router issue, etc.)
- WebSocket connection closes unexpectedly
- Browser fires `onclose` event on WebSocket
- `useGameSocket` hook detects closure in event handler

### Step 3: Client detects disconnection

- `useGameSocket` hook state updates:
  - `connectionStatus` changes from `"connected"` to `"disconnected"`
- ConnectionStatus component immediately updates:
  - Status indicator turns red/amber
  - Text changes: "Disconnected" with warning icon ⚠️
  - Badge appears: "Attempting to reconnect..."
- Selected tiles remain visually highlighted (local state preserved temporarily)
- UI overlay appears (semi-transparent):
  - "Connection lost. Reconnecting..." message
  - Subtle loading spinner
- All action buttons become disabled during reconnection attempt

### Step 4: First reconnection attempt (immediate)

- Client attempts immediate reconnection (attempt #1)
- Creates new WebSocket connection: `new WebSocket("ws://localhost:3000/ws")`
- Connection attempt times out after 5 seconds (network still down)
- `onerror` event fires
- ConnectionStatus updates: "Reconnecting... (1 attempt)"

### Step 5: Second reconnection attempt (exponential backoff)

- Client waits 2 seconds (exponential backoff: 2^1)
- Attempts reconnection (attempt #2)
- WebSocket connection succeeds! (network back up)
- `onopen` event fires
- ConnectionStatus updates: "Reconnecting... Authenticating..."

### Step 6: Re-authentication

- Client sends `Authenticate` command with stored auth token:

  ```json
  {
    "kind": "Command",
    "payload": {
      "Authenticate": {
        "token": "eyJhbGc...stored.jwt.token"
      }
    }
  }
  ```

- Server validates token
- WebSocket receives `Authenticated` event:

  ```json
  {
    "kind": "Event",
    "payload": { "Authenticated": { "player_id": "uuid-west" } }
  }
  ```

- ConnectionStatus updates: "Authenticated. Rejoining room..."

### Step 7: Rejoin room

- Client sends `RejoinRoom` command:

  ```json
  {
    "kind": "Command",
    "payload": {
      "RejoinRoom": {
        "room_id": "room-abc123"
      }
    }
  }
  ```

- Server locates active game session for room
- Server prepares full state snapshot

### Step 8: Receive game state snapshot

- WebSocket receives `GameStateSnapshot` event with full game state:

  ```json
  {
    "kind": "Event",
    "payload": {
      "GameStateSnapshot": {
        "phase": "Charleston",
        "stage": "FirstRight",
        "players": [
          { "seat": "East", "name": "Player1", "ready": true },
          { "seat": "South", "name": "Player2", "ready": true },
          { "seat": "West", "name": "You", "ready": false },
          { "seat": "North", "name": "Player4", "ready": true }
        ],
        "user_hand": [/* 13 tiles */],
        "charleston_status": {
          "stage": "FirstRight",
          "tiles_selected": 0,
          "timer_remaining": 34
        }
      }
    }
  }
  ```

- Note: Server shows `tiles_selected: 0` (user's selection was lost)

### Step 9: State reconciliation

- Client compares local state with server snapshot:
  - **Local**: 2 tiles selected (indices 4, 9)
  - **Server**: 0 tiles selected
  - **Conflict**: Server is authoritative
- Client reconciles:
  - Clears local tile selection state
  - Unhighlights previously selected tiles
  - Updates counter: "0/3 tiles selected"
  - Resets "Pass Tiles" button to disabled
  - Updates timer: "34s remaining" (synced from server, not local countdown)

### Step 10: UI updates to reconnected state

- ConnectionStatus component updates:
  - Status indicator turns green
  - Text: "Connected" ✓
  - Reconnection overlay fades out
- Toast notification appears:
  - "Reconnected successfully. Your previous selection was not saved."
  - Auto-dismisses after 5 seconds
- Charleston UI becomes interactive again:
  - Tiles are clickable
  - Timer resumes countdown from 34s
  - User can re-select tiles

### Step 11: User resumes action

- User must re-select 3 tiles (previous selection lost):
  - Clicks tile at index 4: "6 Crak" (selected again)
  - Clicks tile at index 9: "White Dragon" (selected again)
  - Clicks tile at index 11: "Flower" (third tile)
- Counter updates: "3/3 tiles selected"
- "Pass Tiles" button becomes enabled
- User clicks "Pass Tiles" to complete action
- Game continues normally

## Expected Outcome (Assert)

- ConnectionStatus indicator transitions: Connected → Disconnected → Reconnecting → Connected
- During disconnect:
  - UI shows reconnection overlay/banner
  - User actions are blocked or queued
  - Selected tiles remain visible but in "pending" state
- After reconnection:
  - Game state matches server (local state discarded if conflict)
  - User's hand is updated from server
  - Tile selection is cleared (server didn't receive it)
  - Charleston timer continues from server time
  - User can resume selecting tiles
- Error handling:
  - If auth token expired: redirect to login
  - If room closed: show "Room no longer exists" message
  - If seat taken by bot: user spectates or receives error

## Error Cases

### Auth token expired during disconnect

- **When**: User disconnects for 10 minutes, JWT token expires (15min TTL)
- **Expected**:
  - Reconnection succeeds (WebSocket opens)
  - `Authenticate` command sent with expired token
  - Server responds with `AuthenticationFailed` event
  - Client receives error: "Session expired. Please log in again."
  - Client redirects to login/authentication flow
  - Room state is lost (must rejoin after re-auth)
- **Assert**: Expired tokens are rejected, user must re-authenticate

### Room closed while user was disconnected

- **When**: User disconnects, room host closes room, user reconnects
- **Expected**:
  - Authentication succeeds
  - `RejoinRoom` command sent
  - Server responds with `RoomNotFound` or `RoomClosed` event
  - Client receives error: "Room no longer exists. Returning to lobby."
  - Client navigates to lobby/main menu
  - Shows notification: "The game room was closed while you were disconnected"
- **Assert**: Client handles graceful failure when room is gone

### Bot replaced player during long disconnect

- **When**: User disconnects for 5+ minutes, server assigns bot to seat, user reconnects
- **Expected**:
  - Authentication succeeds
  - `RejoinRoom` succeeds BUT user's seat is now taken by bot
  - Server responds with `SpectatorMode` event or `SeatTaken` event
  - Client shows dialog:
    - "Your seat was taken by a bot due to inactivity"
    - Options: "Spectate Game" or "Leave Room"
  - If spectate: user sees game but cannot act
  - If leave: navigate to lobby
- **Assert**: User is informed of bot takeover, can choose to spectate

### Multiple reconnection failures (exhausted retries)

- **When**: Network down for extended period, all retry attempts fail
- **Expected**:
  - Retry schedule: 0s, 2s, 4s, 8s, 16s, 30s, 30s, 30s... (capped at 30s)
  - After 5 minutes of retries: show "Give Up" option
  - ConnectionStatus shows: "Reconnecting... (attempt 12)"
  - User can click "Give Up" to stop retrying and return to lobby
  - Or wait indefinitely (retries continue)
- **Assert**: Exponential backoff with cap, user can manually abort

### Command partially sent before disconnect

- **When**: User clicks "Pass Tiles", WebSocket send() called, but disconnects before server receives
- **Expected**:
  - Client thinks command was sent (optimistic UI)
  - Server never receives command
  - On reconnect, `GameStateSnapshot` shows user has NOT passed tiles
  - Client reconciles: reverts optimistic UI state
  - User sees notification: "Your action was not received. Please try again."
  - Tiles re-appear in hand, selection cleared
- **Assert**: Client handles lost-in-transit commands gracefully

### State desync: Client and server disagree on game phase

- **When**: Rare edge case - client shows Charleston, server is in Playing phase
- **Expected**:
  - `GameStateSnapshot` event is authoritative
  - Client detects phase mismatch
  - Client discards local state entirely
  - Client re-renders UI for correct phase (Playing)
  - Shows notification: "Game state updated"
- **Assert**: Server state always wins conflicts

### Disconnect during call window (timing-sensitive)

- **When**: Player South discards, user can call, WebSocket disconnects during 10s call window
- **Expected**:
  - Call window timer continues on server (doesn't pause)
  - Timer expires while user offline (user can't call)
  - User reconnects after window expired
  - `GameStateSnapshot` shows turn advanced (call was declined automatically)
  - User missed opportunity to call
  - Shows notification: "You were disconnected - call window expired"
- **Assert**: Time-sensitive windows don't wait for disconnected players

### Repeated rapid disconnects (flaky connection)

- **When**: Network flaps (connect, disconnect, connect, disconnect...)
- **Expected**:
  - Each disconnect triggers reconnection logic
  - Client shows "Connection unstable" warning after 3 disconnects in 1 minute
  - Reconnection continues but user is warned
  - Optional: suggest user check network or switch to stable connection
- **Assert**: Client detects and reports unstable connections

## Technical Notes

### Reconnection Flow (from mahjong_server)

```rust
// Server behavior on reconnection:
1. Authenticate command → validates token
2. RejoinRoom command → finds active game session
3. Emit GameStateSnapshot with:
   - Table state (phase, turn, wall count)
   - Player hands (only user's concealed tiles)
   - Visible melds, discards
   - Current action requirements
4. Resume event stream from current state
```

### Client-Side Recovery Strategy

```typescript
// useGameSocket hook responsibilities:
- Store auth token persistently
- Track room ID in session
- On disconnect:
  1. Show reconnection UI
  2. Attempt reconnect with exponential backoff
  3. Re-authenticate on connection
  4. Send RejoinRoom command
  5. Apply GameStateSnapshot to Zustand store
  6. Clear local transient state (selections, timers)
  7. Resume event handling
```

### Heartbeat System

- Client sends `Heartbeat` command every 30 seconds
- Server responds with `HeartbeatAck` event
- If no ack after 60s → assume disconnected, attempt reconnect
- Server disconnects idle clients after 5 minutes without heartbeat

### Bot Takeover Rules

From CLAUDE.md backend:

- Server has "Bot takeover for disconnected players"
- If player disconnected > 5 minutes: bot takes over
- If player reconnects: can resume OR spectate (depending on implementation)

## Accessibility Notes

### Screen Reader Announcements

- **Disconnection**: "Connection lost. Attempting to reconnect automatically."
- **Reconnecting**: "Reconnecting to game server. Attempt 1."
- **Authenticated**: "Reconnected and authenticated. Rejoining game room."
- **Reconnected**: "Successfully reconnected. Your previous selection was not saved. Please reselect tiles."
- **Failed**: "Reconnection failed. Room no longer exists. Returning to lobby."

### Visual Indicators

- ConnectionStatus uses color + icon + text:
  - Connected: ✓ green "Connected"
  - Disconnected: ⚠️ amber "Disconnected"
  - Reconnecting: 🔄 blue "Reconnecting..." (animated spinner)
  - Failed: ❌ red "Connection Failed"
- Overlay during reconnection is semi-transparent, doesn't block view completely
- Loading spinner respects `prefers-reduced-motion`

### Focus Management

- When reconnection overlay appears, focus moves to overlay
- Overlay contains: status message + optional "Give Up" button
- When reconnection succeeds, focus returns to previous active element (or first actionable element)
- No focus traps during reconnection

### Keyboard Navigation

- During reconnection overlay:
  - Tab/Shift+Tab cycles between overlay elements
  - Escape key (if "Give Up" available): aborts reconnection
  - Enter on "Give Up": confirms abort
- After reconnection:
  - Focus restored to game board
  - Normal keyboard navigation resumes

⚠️ **NEEDS BACKEND VERIFICATION**: Event names (`Authenticated`, `RejoinRoom`, `GameStateSnapshot`, `AuthenticationFailed`, `RoomNotFound`, etc.) and reconnection flow should be verified against `mahjong_server` WebSocket implementation.

## Cross-References

### Related Scenarios

- [timer-expiry.md](timer-expiry.md) - Disconnect during timed action
- [charleston-standard.md](charleston-standard.md) - Charleston phase for context

### Related Components

- [ConnectionStatus](../../component-specs/game/ConnectionStatus.md) - Connection indicator
- [useGameSocket](../../component-specs/hooks/useGameSocket.md) - WebSocket hook
- [ReconnectionOverlay](../../component-specs/game/ReconnectionOverlay.md) - Reconnection UI

### Backend References

- Command: `mahjong_core::command::Authenticate`, `RejoinRoom`
- Event: `mahjong_core::event::Authenticated`, `GameStateSnapshot`, `AuthenticationFailed`, `RoomNotFound`
- Server: `mahjong_server::session::SessionManager` - session persistence

### Manual Testing

- User Testing Plan - Network Reliability section
- Test with browser DevTools: throttle network, toggle offline mode
- Test with long disconnects (5+ minutes) to trigger bot takeover

## Test Variations

### Variant A: Disconnect During Tile Selection (Charleston)

- User has selected 2/3 tiles → disconnect → reconnect → selection lost

### Variant B: Disconnect During Turn (Playing Phase)

- User's turn to discard → disconnect → reconnect → still user's turn, timer reset?

### Variant C: Disconnect During Call Window

- User can call discard → disconnect → reconnect → call window expired

### Variant D: Reconnect After Bot Takeover

- Disconnect 5+ minutes → bot takes seat → user rejoins → spectator mode
