# Implementation Prompt: Networking Layer for American Mahjong Game Server

> **DEPRECATED**: 2026-01-09
>
> **Reason**: Duplicate/detailed implementation notes. Superseded by [docs/implementation/03-networking.md](../implementation/03-networking.md)
>
> **Status**: This document provided detailed implementation guidance that was successfully executed. The networking layer is now complete and documented in the main implementation file.

## Overview

Implement the WebSocket-based networking layer for the American Mahjong game server as specified in docs/implementation/03-networking.md. This layer will handle client connections, authentication, command/event routing, and real-time game state synchronization.

## Current State

### What Exists

**Core game logic**: crates/mahjong_core/ with complete GameCommand and GameEvent types
**Basic server**: crates/mahjong_server/src/main.rs with Axum HTTP server and Supabase JWT authentication
**Command system**: crates/mahjong_core/src/command.rs with all 15 game commands
**Event system**: crates/mahjong_core/src/event.rs with visibility helpers
**Architecture docs**: docs/architecture/06-command-event-system-api-contract.md

### What Needs Implementation

All networking components as specified in the spec document.

## Requirements (from Spec)

### 1. Transport Layer (Section 1)

WebSocket-only communication (no HTTP polling)
JSON message envelope: { "kind": string, "payload": object }
Message types:
Client → Server: Authenticate, Command, Pong
Server → Client: AuthSuccess, AuthFailure, Event, Error, Ping
Tile serialization as u8 indices (0-36) per 01-game-core.md Section 3.1

### 2. Authentication Flow (Section 3)

Guest mode: No credentials required, server generates player_id
Token mode: Reuse session_token from prior auth (stored client-side)
Flow:
Client connects WebSocket
Client sends Authenticate with { method, credentials?, version }
Server validates and replies AuthSuccess { player_id, display_name, session_token }
On failure: AuthFailure { reason }

### 3. Room Lifecycle (Section 4)

Create room (generate room_id)
Join room (assign seat: East/South/West/North)
Start game when 4 players present (fill with bots if needed)
Validations:
Reject join if room full (4 players)
Reject duplicate seat assignment
Broadcast lifecycle events to all room members

### 4. Event Visibility (Section 5)

**Critical**: Server must filter events based on visibility rules:
**Public events**: Broadcast to all players (e.g., TileDiscarded, TurnChanged)
**Private events**: Send only to target player (e.g., TileDrawn { tile: Some(\_) })
Use GameEvent::is_private() helper from event.rs

### 5. Ping/Pong Heartbeat (Section 6)

Server sends Ping { timestamp } every 30 seconds
Client must respond with Pong { timestamp } (echo same timestamp)
Server disconnects client if no Pong received within 60 seconds

### 6. Reconnection (Section 7)

Client stores session_token from initial auth
On reconnect: Client sends Authenticate { method: "token", credentials: { token } }
Server restores player identity and seat assignment
Server sends full game state snapshot via RequestState command
Grace period: 5 minutes before bot takes over disconnected seat

### 7. Error Handling (Section 8)

All command rejections return Error { code, message, context? }:
Error codes: InvalidCredentials, RoomNotFound, RoomFull, InvalidCommand, NotYourTurn, InvalidTile, RateLimitExceeded
Wrap Rust errors into structured JSON error responses

### 8. Concurrency (Section 9)

Each room operates independently (isolated state)
Commands within a room are processed serially (no race conditions)
Use async/await with Tokio for WebSocket I/O
Conflict resolution: See 06-command-event-system-api-contract.md for call priority rules

### 9. Rate Limiting (Section 10)

Per-client rate limits:
Auth: 5 requests/minute per IP + per connection
Commands: 10 commands/second per player_id (reduced from 20 to prevent spam)
Reconnect: 5 attempts/minute per session token + per IP
Charleston passes: 1 command/second per player_id
Reject with RateLimitExceeded error when exceeded

### 10. Testing Checklist (Section 11)

Must implement tests for:
✅ Connect + authenticate (guest and token modes)
✅ Auth failure with invalid token
✅ Join room + seat allocation
✅ Private/public event routing
✅ Reconnect restores seat and state
✅ Ping/Pong timeout disconnection

## Technical Specifications

### Dependencies

Add to crates/mahjong_server/Cargo.toml:

[dependencies]

## Existing

```toml
axum = { version = "0.7", features = ["ws"] }
tokio = { version = "1", features = ["full"] }
tower-http = { version = "0.5", features = ["cors"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```text

## New for networking

```toml
futures-util = "0.3"  # For WebSocket stream handling
dashmap = "6.1"       # Concurrent HashMap for room state
uuid = { version = "1.0", features = ["v4", "serde"] }  # Room/session IDs
```text

### Architecture

```rust
// crates/mahjong_server/src/network/
mod websocket;      // WebSocket upgrade handler
mod session;        // Session state (player_id, seat, room_id)
mod room;           // Room state (4 players, Table, event broadcast)
mod messages;       // JSON envelope types (kind + payload)
mod rate_limit;     // Per-client rate limiters
mod heartbeat;      // Ping/Pong background task
```text

### Key Types

```rust
// Message envelope (Section 1)
# [derive(Serialize, Deserialize)]
struct Envelope {
    kind: MessageKind,
    payload: serde_json::Value,
}

# [derive(Serialize, Deserialize)]
# [serde(tag = "type")]
enum MessageKind {
    // Client → Server
    Authenticate,
    Command,
    Pong,
    // Server → Client
    AuthSuccess,
    AuthFailure,
    Event,
    Error,
    Ping,
}

// Session (Section 3 + 7)
struct Session {
    player_id: String,
    display_name: String,
    session_token: String,
    room_id: Option<String>,
    seat: Option<Seat>,
    ws_sender: SplitSink<WebSocket, Message>,
    last_pong: Instant,
}

// Room (Section 4)
struct Room {
    room_id: String,
    sessions: HashMap<Seat, Arc<Mutex<Session>>>,  // 4 seats
    table: Table,  // From mahjong_core
    created_at: Instant,
}

impl Room {
    // Process command → events → broadcast
    async fn handle_command(&mut self, cmd: GameCommand) -> Result<(), CommandError>;

    // Send event to specific player (private) or all (public)
    async fn broadcast_event(&self, event: GameEvent);
}
```text

### Event Visibility Implementation (Section 5)

```rust
impl Room {
    async fn broadcast_event(&self, event: GameEvent) {
        if event.is_private() {
            // Send to specific player only (e.g., TileDrawn with Some(tile))
            // Determine target from context (current turn, etc.)
            if let Some(target_seat) = self.determine_target(&event) {
                self.send_to_seat(target_seat, event).await;
            }
        } else {
            // Broadcast to all 4 players
            for seat in [Seat::East, Seat::South, Seat::West, Seat::North] {
                if let Some(session) = self.sessions.get(&seat) {
                    self.send_to_session(session, event.clone()).await;
                }
            }
        }
    }
}
```text

### Rate Limiting (Section 10)

```rust
use std::time::Duration;

struct RateLimitStore {
    auth: RateLimiter,            // 5/min (keyed by IP)
    auth_connection: RateLimiter, // 5/min (keyed by connection)
    commands: RateLimiter,        // 10/sec (keyed by player_id)
    reconnect: RateLimiter,       // 5/min (keyed by token)
    reconnect_ip: RateLimiter,    // 5/min (keyed by IP)
    charleston_pass: RateLimiter, // 1/sec (keyed by player_id)
}

impl RateLimitStore {
    fn new() -> Self {
        Self {
            auth: RateLimiter::new(Duration::from_secs(60), 5),
            auth_connection: RateLimiter::new(Duration::from_secs(60), 5),
            commands: RateLimiter::new(Duration::from_secs(1), 10),
            reconnect: RateLimiter::new(Duration::from_secs(60), 5),
            reconnect_ip: RateLimiter::new(Duration::from_secs(60), 5),
            charleston_pass: RateLimiter::new(Duration::from_secs(1), 1),
        }
    }
}
```text

### WebSocket Handler (Axum)

```rust
// crates/mahjong_server/src/network/websocket.rs
use axum::{
    extract::{ws::WebSocket, WebSocketUpgrade, State},
    response::Response,
};
use std::net::SocketAddr;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<NetworkState>>,
    addr: SocketAddr,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state, addr))
}

async fn handle_socket(socket: WebSocket, state: Arc<NetworkState>, addr: SocketAddr) {
    let (mut sender, mut receiver) = socket.split();

    // 1. Wait for Authenticate message
    // 2. Create/restore Session
    // 3. Spawn heartbeat task (ping every 30s)
    // 4. Loop: receive messages, process commands, send events
    // 5. On disconnect: mark session as disconnected, start 5min grace period
}
```text

### Heartbeat Task (Section 6)

```rust
async fn heartbeat_task(session: Arc<Mutex<Session>>) {
    let mut interval = tokio::time::interval(Duration::from_secs(30));
    loop {
        interval.tick().await;

        let session = session.lock().await;
        // Send Ping
        let ping = Envelope { kind: MessageKind::Ping, payload: json!({ "timestamp": Utc::now() }) };
        session.ws_sender.send(Message::Text(serde_json::to_string(&ping).unwrap())).await;

        // Check last Pong (timeout after 60s)
        if session.last_pong.elapsed() > Duration::from_secs(60) {
            // Disconnect client
            break;
        }
    }
}
```text

## Implementation Steps

### Phase 1: Message Types & Envelope

<!-- Implemented -->

Create crates/mahjong_server/src/network/messages.rs
Define Envelope, MessageKind, and payload types
Implement serialize/deserialize for JSON envelope
Add tests for round-trip serialization

### Phase 2: Session Management

<!-- Implemented -->

Create crates/mahjong_server/src/network/session.rs
Implement Session struct with authentication state
Add guest auth (generate random player_id)
Add token auth (validate session_token)
Add session storage (in-memory DashMap<String, Session>)

### Phase 3: Room Management

<!-- Implemented -->

Create crates/mahjong_server/src/network/room.rs
Implement Room struct with 4-player seat management
Add create_room(), join_room(), start_game() logic
Implement broadcast_event() with visibility filtering
Add room storage (in-memory DashMap<String, Room>)

### Phase 4: WebSocket Handler

<!-- Implemented -->

Create crates/mahjong_server/src/network/websocket.rs
Implement Axum WebSocket upgrade handler
Add message receive loop (parse Envelope, dispatch commands)
Add error handling (send Error envelope on failures)
Integrate with Room::handle_command()

### Phase 5: Heartbeat & Reconnection

<!-- Implemented -->

Create crates/mahjong_server/src/network/heartbeat.rs
Implement Ping/Pong task (30s interval, 60s timeout)
Add reconnection logic (restore session by token)
Implement 5-minute grace period for disconnected players
Add bot takeover after grace period expires (TODO: future phase)

### Phase 6: Rate Limiting

<!-- Implemented -->

Create crates/mahjong_server/src/network/rate_limit.rs
Implement fixed-window rate limiting
Add per-client rate limiters (auth, commands, reconnect)
Return RateLimitExceeded error when limits hit
Add Charleston pass limiter (1/sec)

### Phase 7: Integration & Testing

<!-- Implemented -->

Wire up WebSocket handler to Axum router in main.rs
Implement all tests from Section 11 checklist
Add integration test: full game flow (4 players, Charleston, win)
Test reconnection with state restoration
Test rate limiting (simulate spam)

## Testing Strategy

### Unit Tests

```rust
# [cfg(test)]

mod tests {
    #[tokio::test]
    async fn test_authenticate_guest() { /*...*/ }

    #[tokio::test]
    async fn test_authenticate_token_valid() { /* ... */ }

    #[tokio::test]
    async fn test_authenticate_token_invalid() { /* ... */ }

    #[tokio::test]
    async fn test_room_join_success() { /* ... */ }

    #[tokio::test]
    async fn test_room_join_full() { /* ... */ }

    #[tokio::test]
    async fn test_event_visibility_private() { /* ... */ }

    #[tokio::test]
    async fn test_event_visibility_public() { /* ... */ }

    #[tokio::test]
    async fn test_ping_pong_timeout() { /* ... */ }

    #[tokio::test]
    async fn test_reconnect_restore_state() { /* ... */ }

    #[tokio::test]
    async fn test_rate_limit_commands() { /* ... */ }
}
```text

### Integration Tests

```rust
// crates/mahjong_server/tests/full_game_flow.rs
# [tokio::test]
async fn test_full_game_with_disconnect_reconnect() {
    // 1. Start server
    // 2. Connect 4 clients (WebSocket)
    // 3. Authenticate all
    // 4. Create room, join all
    // 5. Play through Charleston
    // 6. Disconnect one client mid-game
    // 7. Reconnect within 5min
    // 8. Verify state restored
    // 9. Complete game to win
}
```text

## Success Criteria

✅ All 10 requirements from spec implemented
✅ All tests from Section 11 checklist passing
✅ Rate limiting prevents spam (commands capped at 10/sec)
✅ Private events never leak to wrong players
✅ Reconnection restores seat and full game state
✅ Ping/Pong timeout disconnects idle clients
✅ Room lifecycle (create → join → start → play) works end-to-end
✅ Command/Event flow integrates with mahjong_core::Table
✅ Zero panics (all errors return structured Error messages)

## Edge Cases to Handle

Multiple clients claim same session_token: Last one wins (invalidate previous)
Client sends Command before Authenticate: Reject with Unauthenticated error
Wall exhausted during game: Server sends GameOver { winner: None }
Player disconnects during Charleston: Auto-pass random 3 tiles after timeout
Bot fills seat after grace period: Human can reclaim seat on reconnect if game still active
Conflicting calls (2+ players call same discard): Use priority from 06-command-event-system-api-contract.md:689-716

## Files to Create/Modify

### New Files

```text
crates/mahjong_server/src/network/mod.rs
crates/mahjong_server/src/network/websocket.rs
crates/mahjong_server/src/network/session.rs
crates/mahjong_server/src/network/room.rs
crates/mahjong_server/src/network/messages.rs
crates/mahjong_server/src/network/rate_limit.rs
crates/mahjong_server/src/network/heartbeat.rs
crates/mahjong_server/tests/networking_integration.rs
```text

### Modified Files

```text
crates/mahjong_server/src/main.rs (add WebSocket route)
crates/mahjong_server/Cargo.toml (add dependencies)
```text

## Additional Notes

**No database yet**: Use in-memory DashMap for rooms and sessions (persistence comes later)
**Tile serialization**: Use Tile::to_index() method from mahjong_core (0-36 u8)
**Message versioning**: Include version field in Authenticate for future protocol changes
**CORS**: Already configured in main.rs:42 for frontend
**Logging**: Use tracing::info!, tracing::warn!, tracing::error! (already initialized in main.rs:23)

### Reference Documents

Primary spec: docs/implementation/03-networking.md
Command/Event API: docs/architecture/06-command-event-system-api-contract.md
Game core spec: docs/implementation/01-game-core.md
Project overview: CLAUDE.md
