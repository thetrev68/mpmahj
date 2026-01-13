---
Archived-Date: 2026-01-12
Source-Path: docs/architecture/09-network-protocol.md
Note: Archived copy. See README-STEROIDS.md for context.
---

# 9. Network Protocol

This document defines the WebSocket-based protocol for real-time multiplayer communication between clients and server. The protocol enables synchronous game state, handles player actions, and ensures security and reliability.

---

## 9.1 Transport Layer

### 9.1.1 Why WebSockets?

**Design Decision**: We use WebSockets over HTTP polling or Server-Sent Events (SSE).

**Rationale**:

- **Bi-directional**: Server can push events to clients instantly (critical for real-time gameplay)
- **Low Latency**: Persistent connection eliminates handshake overhead of repeated HTTP requests
- **Efficient**: Less bandwidth than polling (no repeated headers)
- **Native Browser Support**: All modern browsers support WebSockets
- **axum Integration**: Excellent WebSocket support via `axum::extract::ws`

**Trade-offs Considered**:

| Protocol         | Pros                                   | Cons                                      | Verdict                |
| :--------------- | :------------------------------------- | :---------------------------------------- | :--------------------- |
| **HTTP Polling** | Simple, works everywhere               | High latency, wasteful bandwidth          | ❌ Too slow            |
| **SSE**          | Server push, simple                    | Unidirectional (client can't send easily) | ❌ Need bi-directional |
| **WebSockets**   | Bi-directional, low latency, efficient | Requires persistent connection            | ✅ **Chosen**          |

---

### 9.1.2 Connection Lifecycle

```rust
/// WebSocket connection states
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionState {
    /// Initial connection established, awaiting authentication
    Connected,

    /// Authentication successful, player identified
    Authenticated { player_id: String },

    /// Player joined a game room
    InGame { room_id: String, seat: Seat },

    /// Connection closing gracefully
    Disconnecting,

    /// Connection closed
    Disconnected,
}
```

**State Transitions**:

```text
Connected → Authenticated → InGame → Disconnecting → Disconnected
    ↓            ↓             ↓
  [timeout]  [timeout]    [timeout]
    ↓            ↓             ↓
Disconnected  Disconnected  Disconnected (with reconnect token)
```

**Lifecycle Flow**:

1. **Connection**: Client opens WebSocket to `wss://server.example.com/ws`
2. **Handshake**: Client sends authentication credentials
3. **Authentication**: Server validates and responds with session token
4. **Room Join**: Client requests to join/create game
5. **Active**: Client and server exchange commands/events
6. **Disconnect**: Connection closes (gracefully or abruptly)
7. **Reconnect** (optional): Client can rejoin with session token

---

### 9.1.3 Heartbeat / Keepalive

To detect broken connections and prevent timeout, both sides send periodic pings.

```rust
/// Heartbeat configuration
pub const PING_INTERVAL: Duration = Duration::from_secs(30);
pub const PONG_TIMEOUT: Duration = Duration::from_secs(60);

/// Heartbeat message payloads (sent by server, echoed by client).
///
/// Note: The implementation uses `chrono::DateTime<Utc>` which serializes as an ISO-8601 string.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingPayload {
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PongPayload {
    pub timestamp: chrono::DateTime<chrono::Utc>,
}
```

**Server Implementation**:

```rust
use tokio::time::{interval, Duration};

async fn heartbeat_task(mut tx: mpsc::Sender<axum::extract::ws::Message>) {
    let mut ping_interval = interval(PING_INTERVAL);

    loop {
        ping_interval.tick().await;

        let ping = Envelope::ping(chrono::Utc::now());
        let msg = ping.to_json().unwrap();
        if tx.send(axum::extract::ws::Message::Text(msg)).await.is_err() {
            // Connection closed
            break;
        }
    }
}
```

**Client Implementation** (TypeScript):

```typescript
let lastPongTime = Date.now();
let pingCheckInterval: NodeJS.Timeout;

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data) as Envelope;

  if (msg.kind === 'Ping') {
    // Respond with Pong
    ws.send(JSON.stringify({ kind: 'Pong', payload: msg.payload }));
    lastPongTime = Date.now();
  }
};

// Check if server is still alive
pingCheckInterval = setInterval(() => {
  const timeSinceLastPong = Date.now() - lastPongTime;

  if (timeSinceLastPong > 60000) {
    console.error('Server timeout - no ping received');
    ws.close();
    attemptReconnect();
  }
}, 5000);
```

---

## 9.2 Message Format

All messages use **JSON** for simplicity, debuggability, and automatic TypeScript type generation.

**Alternative Considered**: Binary formats (MessagePack, Protobuf) are more efficient, but JSON is:

- Human-readable (easier debugging)
- Compatible with browser DevTools
- Native TypeScript support via `ts-rs`

We may optimize to binary in the future if profiling shows JSON is a bottleneck.

---

### 9.2.1 Message Envelope

Every message has a kind discriminator:

```rust
/// Top-level message wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "payload")]
pub enum Envelope {
    // ===== CLIENT → SERVER =====
    Authenticate(AuthenticatePayload),
    Command(CommandPayload),
    CreateRoom(CreateRoomPayload),
    JoinRoom(JoinRoomPayload),
    LeaveRoom(LeaveRoomPayload),
    CloseRoom(CloseRoomPayload),
    Pong(PongPayload),

    // ===== SERVER → CLIENT =====
    AuthSuccess(AuthSuccessPayload),
    AuthFailure(AuthFailurePayload),
    Event(EventPayload),
    RoomJoined(RoomJoinedPayload),
    RoomLeft(RoomLeftPayload),
    RoomClosed(RoomClosedPayload),
    RoomMemberLeft(RoomMemberLeftPayload),
    Error(ErrorPayload),
    Ping(PingPayload),
    StateSnapshot(StateSnapshotPayload),
}
```

... (content preserved) ...

**This completes Section 9: Network Protocol.**
