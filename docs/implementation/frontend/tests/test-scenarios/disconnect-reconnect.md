# Test Scenario: Disconnect and Reconnect - Network Recovery

**User Story**: US-037 - Disconnect / Reconnect
**Fixtures**: `game-states/mid-game-charleston.json`, `event-sequences/reconnect-flow.json`

## Setup

- Game state: Charleston FirstRight phase
- User seated as: West
- Partial action: 2 of 3 tiles selected for pass
- WebSocket: Initially connected
- Auth token: Stored in localStorage

## Test Flow (Act & Assert)

1. **When**: User is playing Charleston, network drops
2. **WebSocket closes** unexpectedly (WiFi disconnect, router issue)
3. **Client detects**: `useGameSocket` hook fires `onclose` event
4. **UI updates**: ConnectionStatus → "Disconnected", loading spinner appears
5. **Local state preserved**: Selected tiles remain highlighted (temporarily)
6. **Attempt #1 (immediate)**: New WebSocket connection times out after 5s
7. **ConnectionStatus**: "Reconnecting... (1 attempt)"
8. **Attempt #2 (exponential backoff)**: Client waits 2s, reconnects
9. **WebSocket connects** successfully (network back up)
10. **Send**: `Authenticate { token: eyJhbGc... }`
11. **Receive**: `Authenticated { player_id: uuid-west }`
12. **ConnectionStatus**: "Authenticated. Rejoining room..."
13. **Send**: `RejoinRoom { room_id: room_abc, player_id: uuid-west }`
14. **Receive**: `RoomRejoinConfirmed { room_id: room_abc, game_state: [...] }`
15. **ConnectionStatus**: "Connected"
16. **Game state synced**: Charleston phase restored to correct point
17. **UI restored**: Selected tiles re-displayed, buttons re-enabled

## Success Criteria

- ✅ Network disconnection detected immediately
- ✅ ConnectionStatus changed to "Disconnected" with warning
- ✅ Local state (selected tiles) preserved during disconnect
- ✅ Exponential backoff implemented (2^1 = 2s wait)
- ✅ Reconnection succeeded on attempt #2
- ✅ Re-authentication sent with stored token
- ✅ Room rejoin processed by server
- ✅ Game state synced after reconnect
- ✅ UI restored to pre-disconnect state
- ✅ User can resume playing from same point

## Error Cases

### Network down for extended period (30+ seconds)

- **When**: Network stays down, multiple reconnect attempts fail
- **Expected**: Client shows "Still disconnecting... checking connection" message
- **Assert**: Backoff continues (2^1, 2^2, 2^3, up to max 30s)
- **Assert**: User can manually retry or refresh

### Token expires during disconnect

- **When**: Reconnected but auth token expired
- **Expected**: Server rejects via `AuthenticationFailed { reason: TokenExpired }`
- **Assert**: Client shows "Session expired, please login again"
- **Assert**: User returns to login screen

### Room closed during disconnect

- **When**: Game room closed while player was disconnected
- **Expected**: Server rejects rejoin via `RoomRejoinFailed { reason: RoomClosed }`
- **Assert**: Client shows "Room no longer available"
- **Assert**: User returns to lobby

### Another player rejoined while disconnected

- **When**: Player was replaced by AI/new player during disconnect
- **Expected**: Server rejects rejoin via `RoomRejoinFailed { reason: SeatTaken }`
- **Assert**: Client shows "Your seat was taken by another player"
- **Assert**: User can join as new player or spectate

### Partial action lost during disconnect

- **When**: User had selected 2 tiles, network dropped before sending PassTiles
- **Expected**: Selected tiles are preserved in localStorage
- **Assert**: After reconnect and state sync, tiles are cleared (server state is source of truth)
- **Assert**: User must reselect tiles and send PassTiles command
