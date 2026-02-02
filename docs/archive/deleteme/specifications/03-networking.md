# 03. Networking + Session Implementation Spec

This document specifies the networking layer behavior for the game server and clients.

---

## 1. Transport

- WebSocket only
- JSON messages
- Envelope: `kind` + `payload`

Example:

```json
{
  "kind": "Command",
  "payload": {
    "type": "DiscardTile",
    "player": "East",
    "tile": 22
  }
}
```

**Note:** Tiles are serialized as u8 indices (0-36). See [01-game-core.md](01-game-core.md) Section 3.1 for index mapping. Optionally, tiles can be serialized with enriched data for debugging:

```json
{
  "tile": { "id": 22, "name": "5 Dot" }
}
```

---

## 2. Message Types

Client → Server:

- `Authenticate(AuthRequest)`
- `Command(Command)`
- `Pong(Pong)`

Server → Client:

- `AuthSuccess(AuthSuccess)`
- `AuthFailure(AuthFailure)`
- `Event(GameEvent)`
- `Error(ErrorMessage)`
- `Ping(Ping)`

---

## 3. Authentication

Modes:

- Guest: no credentials
- Token: session token from prior auth

Flow:

1. Client connects WS
2. Client sends `Authenticate`
3. Server replies `AuthSuccess` with `session_token`
4. Client stores token and reuses on reconnect

Auth objects:

- `AuthRequest { method, credentials, version }`
- `AuthSuccess { player_id, display_name, session_token }`
- `AuthFailure { reason }`

---

## 4. Room Lifecycle

- Create room
- Join room
- Seat assignment
- Start game when 4 players present (bots allowed)
- Room state tracked in server memory

Required server behaviors:

- Reject join if room full
- Reject duplicate seat
- Broadcast lifecycle events

---

## 5. Event Visibility

Server must apply event visibility rules:

- Public events go to all players
- Private events go only to target player

Examples:

- `TileDrawn { tile: Some(_) }` only to drawer
- `TileDrawn { tile: None }` to others

---

## 6. Ping/Pong

- Server sends `Ping` every 30s
- Client echoes `Pong` with same timestamp
- Server closes connection if no Pong for 60s

---

## 7. Reconnect

- Client stores session token
- On reconnect, client authenticates with token
- Server restores prior player identity and seat
- Server sends full game state to reconnecting player
- Grace period: 5 minutes (bots can take over after)

---

## 8. Error Handling

All rejections return `Error(ErrorMessage)`:

- `ErrorMessage { code, message, context? }`

Common codes:

- `InvalidCredentials`
- `RoomNotFound`
- `RoomFull`
- `InvalidCommand`
- `NotYourTurn`
- `InvalidTile`
- `RateLimitExceeded`

---

## 9. Concurrency

- Each room is isolated
- Command processing is serialized per room
- Out-of-order commands are rejected

---

## 10. Rate Limits

Recommended default rates:

- Auth: 5 per minute per IP + per connection
- Commands: 10 per second per player_id (reduced from 20 to prevent spam)
- Charleston passes: 1 per second per player_id
- Reconnect: 5 per minute per session token + per IP

Commands above rate limit are rejected with `RateLimitExceeded` error.

---

## 11. Testing Checklist

- Connect/auth success
- Auth failure with bad token
- Join room + seat allocation
- Private/public event routing
- Reconnect restores seat and state
- Ping/Pong timeout
