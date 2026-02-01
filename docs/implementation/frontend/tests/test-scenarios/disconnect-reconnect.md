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

### Disconnect Phase

1. Simulate network interruption: WebSocket closes unexpectedly
2. `useGameSocket` hook detects connection loss (onClose handler)
3. ConnectionStatus component shows "Disconnected - Reconnecting..."
4. Heartbeat timeout triggers reconnection attempt
5. Selected tiles remain in UI state (not sent yet)

### Reconnection Attempt

1. Client initiates WebSocket reconnection to `ws://localhost:3000/ws`
2. Client sends `Authenticate` command with stored token
3. Server validates token → responds with `Authenticated` event
4. Client sends `RejoinRoom` command with room ID
5. Server responds with `GameStateSnapshot` event containing:
    - Full current game state
    - All players' visible info
    - Current phase: Charleston FirstRight
    - User's hand (server-authoritative)

### State Reconciliation

1. Client receives server state, compares with local state
2. Server shows user has 0 tiles selected (action not received before disconnect)
3. Client clears local selection state (server is authoritative)
4. UI updates to show current server state
5. ConnectionStatus shows "Connected"
6. User must re-select tiles (previous selection was lost)

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

- **Token expired during disconnect**: Should redirect to authentication flow
- **Room closed during disconnect**: Should show error and return to lobby
- **Bot replaced player during disconnect**: Should allow spectating or error message
- **Multiple reconnection attempts**: Should use exponential backoff (1s, 2s, 4s, max 30s)
- **Permanent disconnect**: After 5 minutes, server may replace with bot
- **Partial command sent**: Server ignores incomplete commands, client resets
- **State desync**: Server state is always authoritative, client reconciles

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

## Cross-References

- **Related Scenarios**: `timer-expiry.md` (disconnect during timed action)
- **Component Tests**: ConnectionStatus, useGameSocket hook
- **Integration Tests**: Full disconnect/reconnect cycle with state reconciliation
- **Manual Testing**: User Testing Plan - Network Reliability section

## Test Variations

### Variant A: Disconnect During Tile Selection (Charleston)

- User has selected 2/3 tiles → disconnect → reconnect → selection lost

### Variant B: Disconnect During Turn (Playing Phase)

- User's turn to discard → disconnect → reconnect → still user's turn, timer reset?

### Variant C: Disconnect During Call Window

- User can call discard → disconnect → reconnect → call window expired

### Variant D: Reconnect After Bot Takeover

- Disconnect 5+ minutes → bot takes seat → user rejoins → spectator mode
