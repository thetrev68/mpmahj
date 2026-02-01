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
```text

**State Transitions**:

```text
Connected → Authenticated → InGame → Disconnecting → Disconnected
    ↓            ↓             ↓
  [timeout]  [timeout]    [timeout]
    ↓            ↓             ↓
Disconnected  Disconnected  Disconnected (with reconnect token)
```text

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
```text

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
```text

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
```text

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
```text

**Serialization Example**:

Rust:

```rust
let cmd = GameCommand::DiscardTile {
    player: Seat::East,
    tile: Tile::new_number(Suit::Dots, 5).unwrap(),
};

let msg = Envelope::Command(CommandPayload { command: cmd });
let json = serde_json::to_string(&msg).unwrap();

// json = {"kind":"Command","payload":{"command":{"DiscardTile":{"player":"East","tile":{"suit":"Dots","rank":{"Number":5}}}}}}
```text

TypeScript (auto-generated types):

```typescript
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

const cmd: GameCommand = {
  DiscardTile: {
    player: 'East',
    tile: { suit: 'Dots', rank: { Number: 5 } },
  },
};

const msg = { kind: 'Command', payload: { command: cmd } };
ws.send(JSON.stringify(msg));
```text

---

### 9.2.2 Error Handling

```rust
/// Error payload from server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPayload {
    /// Machine-readable error code
    pub code: ErrorCode,
    /// Human-readable error message
    pub message: String,
    /// Optional additional context (e.g. validation details)
    pub context: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum ErrorCode {
    InvalidCredentials,
    RoomNotFound,
    RoomFull,
    InvalidCommand,
    NotYourTurn,
    InvalidTile,
    RateLimitExceeded,
    Unauthenticated,
    InternalError,
}
```text

**Client Handling**:

```typescript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data) as { kind: string; payload: any };

  switch (msg.kind) {
    case 'Error':
      handleError(msg.payload);
      break;
    // ...
  }
};

function handleError(error: { code: string; message: string; context?: unknown }) {
  console.error(`[${error.code}] ${error.message}`);

  switch (error.code) {
    case 'NOT_YOUR_TURN':
      // Show toast notification
      showToast('Wait for your turn!');
      break;
    default:
      showToast(`Error: ${error.message}`);
  }
}
```text

---

## 9.3 Connection Management

### 9.3.1 Initial Handshake

**Client → Server** (first message after connection):

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthenticatePayload {
    /// Authentication method
    pub method: AuthMethod,
    /// Optional credentials (required for token/jwt auth)
    pub credentials: Option<Credentials>,
    /// Client protocol version (for compatibility checks)
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AuthMethod {
    Guest,
    Token,
    Jwt,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credentials {
    pub token: String,
}
```text

**Server → Client** (success):

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSuccessPayload {
    pub player_id: String,
    pub display_name: String,
    pub session_token: String,
    pub room_id: Option<String>,
    pub seat: Option<Seat>,
}
```text

**Server → Client** (failure):

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct AuthFailure {
    pub reason: String,
}
```text

**Example Flow**:

```text
Client                                  Server
  |                                       |
  |--- WebSocket connection opened ------>|
  |                                       |
  |--- Authenticate(Guest) -------------->|
  |                                       |
  |                                       | [Validates request]
  |                                       | [Generates session token]
  |                                       |
  |<-- AuthSuccess(player_id, token) -----|
  |                                       |
  | [Stores token in localStorage]        |
  |                                       |
```text

**Client TypeScript**:

```typescript
const ws = new WebSocket('wss://server.example.com/ws');

ws.onopen = () => {
  ws.send(
    JSON.stringify({
      kind: 'Authenticate',
      payload: {
        method: 'guest',
        version: '0.1.0',
      },
    })
  );
};

ws.onmessage = (event) => {
  const envelope = JSON.parse(event.data) as { kind: string; payload: any };

  if (envelope.kind === 'AuthSuccess') {
    localStorage.setItem('session_token', envelope.payload.session_token);
    console.log(`Authenticated as ${envelope.payload.display_name}`);
  }
};
```text

---

### 9.3.2 Room Joining / Creation

**After authentication**, clients can join or create rooms:

```rust
/// Command to join/create a room
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum RoomCommand {
    /// Create a new game room
    CreateRoom {
        room_name: String,
        is_private: bool, // If true, requires room_id to join
    },

    /// Join an existing room
    JoinRoom {
        room_id: String,
    },

    /// Join matchmaking queue (server assigns you to a room)
    JoinQueue,

    /// Leave current room
    LeaveRoom,
}
```text

**Server Response**:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct RoomJoined {
    pub room_id: String,
    pub seat: Seat,
    pub players: HashMap<Seat, PlayerInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct PlayerInfo {
    pub player_id: String,
    pub display_name: String,
    pub is_bot: bool,
}
```text

**Example**:

```text
Client                                  Server
  |                                       |
  |--- CreateRoom("Game 1") ------------->|
  |                                       |
  |                                       | [Creates room "abc123"]
  |                                       | [Assigns client to Seat::East]
  |                                       |
  |<-- RoomJoined(room_id, seat, players)-|
  |                                       |
  |<-- GameEvent::GameCreated ------------|
  |                                       |
```text

---

### 9.3.3 Reconnection Strategy

**Problem**: Network drops are common on mobile. Players should be able to rejoin mid-game.

**Solution**: Session tokens + server-side state persistence.

**Client Reconnection Flow**:

```typescript
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('Max reconnect attempts reached');
    showError('Connection lost. Please refresh.');
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000); // Exponential backoff

  console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

  setTimeout(() => {
    const ws = new WebSocket('wss://server.example.com/ws');

    ws.onopen = () => {
      // Use stored session token
      const token = localStorage.getItem('session_token');

      ws.send(
        JSON.stringify({
          kind: 'Authenticate',
          payload: {
            method: 'token',
            credentials: token ? { token } : undefined,
            version: '0.1.0',
          },
        })
      );
    };

    ws.onmessage = (event) => {
      const envelope = JSON.parse(event.data) as { kind: string; payload: any };

      if (envelope.kind === 'AuthSuccess') {
        reconnectAttempts = 0; // Reset counter on success
        console.log('Reconnected successfully');

        // Request current game state
        ws.send(
          JSON.stringify({
            kind: 'Command',
            payload: {
              command: {
                RequestState: {
                  player: mySeat,
                },
              },
            },
          })
        );
      }
    };

    ws.onerror = () => {
      attemptReconnect(); // Retry
    };
  }, delay);
}
```text

**Server Reconnection Handling**:

```rust
impl Room {
    /// Handle a player reconnecting
    pub fn handle_reconnect(&mut self, player_id: &str) -> Result<GameEvent, RoomError> {
        // Find the player's seat
        let seat = self.players.iter()
            .find(|(_, p)| p.player_id == player_id)
            .map(|(seat, _)| *seat)
            .ok_or(RoomError::PlayerNotInRoom)?;

        // Send full game state to reconnecting player
        let state_snapshot = GameEvent::StateSnapshot {
            phase: self.table.phase.clone(),
            players: self.table.players.clone(),
            discard_pile: self.table.discard_pile.clone(),
            wall_remaining: self.table.wall.remaining(),
            your_hand: self.table.players.get(&seat).unwrap().hand.clone(),
        };

        Ok(state_snapshot)
    }
}
```text

**Session Timeout**:

- Sessions expire after 24 hours of inactivity
- Mid-game disconnects are held for 5 minutes (AI takes over if not reconnected)
- Longer disconnects forfeit the game

---

### 9.3.4 Session Persistence

```rust
/// Session data stored server-side
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub player_id: String,
    pub session_token: String,
    pub created_at: u64,
    pub last_active: u64,
    pub current_room: Option<String>,
}

use std::collections::HashMap;
use tokio::sync::RwLock;

/// In-memory session store (could be Redis for production)
pub struct SessionStore {
    sessions: Arc<RwLock<HashMap<String, Session>>>,
}

impl SessionStore {
    pub async fn create_session(&self, player_id: String) -> Session {
        let session_token = generate_secure_token(); // UUID or JWT
        let now = current_timestamp();

        let session = Session {
            player_id: player_id.clone(),
            session_token: session_token.clone(),
            created_at: now,
            last_active: now,
            current_room: None,
        };

        let mut sessions = self.sessions.write().await;
        sessions.insert(session_token.clone(), session.clone());

        session
    }

    pub async fn validate_token(&self, token: &str) -> Option<Session> {
        let mut sessions = self.sessions.write().await;

        if let Some(session) = sessions.get_mut(token) {
            // Check expiration (24 hours)
            let now = current_timestamp();
            if now - session.last_active > 86400 {
                return None; // Expired
            }

            // Update last active
            session.last_active = now;
            Some(session.clone())
        } else {
            None
        }
    }
}
```text

---

## 9.4 Event Distribution

### 9.4.1 Public vs. Private Events

Some events are broadcast to all players, others are sent only to specific players.

**From Section 6**:

```rust
impl GameEvent {
    /// Determine who should receive this event
    pub fn visibility(&self) -> EventVisibility {
        match self {
            // Public events (broadcast to all players in room)
            GameEvent::TileDiscarded { .. } |
            GameEvent::CallWindowOpened { .. } |
            GameEvent::TurnChanged { .. } |
            GameEvent::MahjongDeclared { .. } |
            GameEvent::GameWon { .. } => EventVisibility::Public,

            // Private events (only specific player)
            GameEvent::TileDrawn { tile: Some(_), .. } => EventVisibility::Private,
            GameEvent::TilesReceived { .. } => EventVisibility::Private,
            GameEvent::TilesDealt { .. } => EventVisibility::Private,

            // Partially public (everyone sees it happened, only actor sees details)
            GameEvent::BlankExchanged { taken_tile: Some(_), .. } => EventVisibility::Private,
            GameEvent::BlankExchanged { taken_tile: None, .. } => EventVisibility::Public,

            _ => EventVisibility::Public,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EventVisibility {
    Public,          // Broadcast to all players
    Private,         // Sent to specific player only
}
```text

---

### 9.4.2 Broadcast Patterns

**Server Room Implementation**:

```rust
impl Room {
    /// Broadcast an event to all players in the room
    pub async fn broadcast(&self, event: GameEvent) {
        for (seat, conn) in &self.players {
            let envelope = Envelope::Event(EventPayload {
                event: event.clone(),
            });
            let json = serde_json::to_string(&envelope).unwrap();

            if conn.tx.send(json).await.is_err() {
                eprintln!("Failed to send to player {:?}", seat);
            }
        }
    }

    /// Send an event to a specific player
    pub async fn send_to_player(&self, seat: Seat, event: GameEvent) {
        if let Some(conn) = self.players.get(&seat) {
            let envelope = Envelope::Event(EventPayload { event });
            let json = serde_json::to_string(&envelope).unwrap();

            if conn.tx.send(json).await.is_err() {
                eprintln!("Failed to send to player {:?}", seat);
            }
        }
    }

    /// Send different events to different players (e.g., tile draw)
    pub async fn send_personalized(&self, events: HashMap<Seat, GameEvent>) {
        for (seat, event) in events {
            self.send_to_player(seat, event).await;
        }
    }
}
```text

**Example: Tile Draw (Private + Public)**:

```rust
// Player East draws a tile
let drawn_tile = self.table.wall.draw().unwrap();
let drawer = Seat::East;

// Private event: Only East knows what they drew
let private_event = GameEvent::TileDrawn {
    tile: Some(drawn_tile),
    remaining_tiles: self.table.wall.remaining(),
};
self.send_to_player(drawer, private_event).await;

// Public event: Others just know a tile was drawn
let public_event = GameEvent::TileDrawn {
    tile: None,
    remaining_tiles: self.table.wall.remaining(),
};
for seat in [Seat::South, Seat::West, Seat::North] {
    self.send_to_player(seat, public_event.clone()).await;
}
```text

---

### 9.4.3 Event Ordering Guarantees

**Key Requirement**: Events must arrive in the correct order to prevent race conditions.

**Solution**: WebSocket provides in-order delivery by default (TCP guarantees).

**Edge Case**: If server generates multiple events from a single command, they are sent sequentially:

```rust
impl Room {
    pub async fn process_command(&mut self, cmd: Command) -> CommandResult {
        let events = self.table.process_command(cmd)?;

        // Send events in order
        for event in events {
            // Delivery (public vs targeted/private) is computed at the server boundary.
            let delivery = self.determine_event_delivery(&event);
            self.broadcast_event(event, delivery).await;
        }

        Ok(())
    }
}
```text

**Client receives events in order**:

```typescript
ws.onmessage = (event) => {
  const envelope = JSON.parse(event.data) as { kind: string; payload: any };

  if (envelope.kind === 'Event') {
    gameStore.getState().handleEvent(envelope.payload.event);
  }
};
```text

---

### 9.4.4 Handling Slow Clients

**Problem**: If one client is slow (poor connection), should we wait for them or drop events?

**Solution**: Use a **bounded channel** with backpressure:

```rust
use tokio::sync::mpsc;

pub struct PlayerConnection {
    pub player_id: String,
    pub tx: mpsc::Sender<String>, // Bounded channel (capacity 100)
}

impl Room {
    pub async fn add_player(&mut self, player_id: String) -> Seat {
        let (tx, rx) = mpsc::channel(100); // Max 100 queued messages

        let seat = self.assign_seat();
        self.players.insert(seat, PlayerConnection { player_id, tx });

        // Spawn task to send messages to WebSocket
        tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                // Send to WebSocket (handle errors here)
            }
        });

        seat
    }
}
```text

**Backpressure Behavior**:

- If client is slow, `tx.send()` will block
- If channel is full (100 messages), oldest message is dropped (or connection is closed)

**Alternative**: Disconnect slow clients after a timeout:

```rust
pub async fn send_with_timeout(&self, seat: Seat, event: GameEvent, timeout: Duration) {
    if let Some(conn) = self.players.get(&seat) {
        let msg = serde_json::to_string(&Envelope::Event(EventPayload { event })).unwrap();

        // Try to send with timeout
        match tokio::time::timeout(timeout, conn.tx.send(msg)).await {
            Ok(Ok(())) => { /* Sent successfully */ }
            Ok(Err(_)) => {
                eprintln!("Player {:?} channel closed", seat);
                self.disconnect_player(seat).await;
            }
            Err(_) => {
                eprintln!("Player {:?} send timeout", seat);
                self.disconnect_player(seat).await;
            }
        }
    }
}
```text

---

## 9.5 Security

### 9.5.1 Authentication

**Current (MVP)**: Guest authentication (no password)

```rust
fn handle_auth_guest() -> AuthSuccess {
    let player_id = Uuid::new_v4().to_string();
    let session_token = Uuid::new_v4().to_string();
    let display_name = format!("Guest{}", rand::random::<u16>());

    AuthSuccess {
        player_id,
        session_token,
        expires_at: current_timestamp() + 86400,
        display_name,
    }
}
```text

**Future**: JWT-based authentication

```rust
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String, // player_id
    exp: u64,    // expiration
}

fn create_jwt(player_id: &str) -> String {
    let claims = Claims {
        sub: player_id.to_string(),
        exp: current_timestamp() + 86400,
    };

    let secret = std::env::var("JWT_SECRET").unwrap();
    let key = EncodingKey::from_secret(secret.as_bytes());

    encode(&Header::default(), &claims, &key).unwrap()
}

fn validate_jwt(token: &str) -> Result<Claims, AuthError> {
    let secret = std::env::var("JWT_SECRET").unwrap();
    let key = DecodingKey::from_secret(secret.as_bytes());

    let token_data = decode::<Claims>(token, &key, &Validation::default())
        .map_err(|_| AuthError::InvalidToken)?;

    Ok(token_data.claims)
}
```text

---

### 9.5.2 Authorization

**Principle**: Players can only act for themselves.

**Server Validation**:

```rust
impl Room {
    pub async fn process_command(&mut self, cmd: Command, sender_player_id: &str) -> CommandResult {
        // Extract the player seat from the command
        let claimed_seat = match &cmd {
            Command::DiscardTile { player, .. } => *player,
            Command::CallTile { player, .. } => *player,
            Command::DeclareMahjong { player, .. } => *player,
            // ... other commands
            _ => return Err(CommandError::InternalError {
                message: "Unable to extract player from command".to_string(),
            }),
        };

        // Verify the sender is authorized to act for this seat
        if let Some(conn) = self.players.get(&claimed_seat) {
            if conn.player_id != sender_player_id {
                return Err(CommandError::NotInGame);
            }
        } else {
            return Err(CommandError::NotInGame);
        }

        // Command is authorized, process it
        self.table.process_command(cmd)
    }
}
```text

**Example Attack Prevented**:

```text
Attacker tries:
  Command::DiscardTile { player: Seat::East, tile: 5D }

But attacker's player_id is mapped to Seat::South

Server rejects: "NotInGame" error
```text

---

### 9.5.3 Input Validation

**Never trust client input.** All commands are validated before processing.

**Example: Discard Validation**:

```rust
fn validate_discard_command(
    table: &Table,
    player: Seat,
    tile: Tile,
) -> Result<(), CommandError> {
    // Check it's the player's turn
    if !matches!(table.phase, GamePhase::Playing(TurnStage::Discarding { player: p }) if p == player) {
        return Err(CommandError::NotYourTurn {
            current_player: table.current_turn,
        });
    }

    // Check the player has the tile
    let player_obj = table.players.get(&player).ok_or(CommandError::NotInGame)?;
    if !player_obj.hand.concealed.contains(&tile) {
        return Err(CommandError::TileNotInHand { tile });
    }

    // Check tile is valid (not out of range, etc.)
    if tile.suit == Suit::Jokers {
        // Jokers can be discarded (allowed in American Mahjong)
    }

    Ok(())
}
```text

**Sanitization**:

```rust
// Reject excessively long strings (DoS prevention)
if room_name.len() > 100 {
    return Err(RoomError::InvalidRoomName);
}

// Reject special characters in display names
if !display_name.chars().all(|c| c.is_alphanumeric() || c == ' ') {
    return Err(AuthError::InvalidDisplayName);
}
```text

---

### 9.5.4 Rate Limiting

**Prevent spam and DoS attacks** by limiting command frequency.

```rust
use std::collections::HashMap;
use std::time::{Instant, Duration};

pub struct RateLimiter {
    /// Last command time per player
    last_command: HashMap<String, Instant>,
    /// Minimum delay between commands
    min_delay: Duration,
}

impl RateLimiter {
    pub fn new(min_delay: Duration) -> Self {
        RateLimiter {
            last_command: HashMap::new(),
            min_delay,
        }
    }

    pub fn check(&mut self, player_id: &str) -> Result<(), RateLimitError> {
        let now = Instant::now();

        if let Some(last) = self.last_command.get(player_id) {
            let elapsed = now.duration_since(*last);

            if elapsed < self.min_delay {
                return Err(RateLimitError::TooFast {
                    retry_after: (self.min_delay - elapsed).as_millis() as u64,
                });
            }
        }

        self.last_command.insert(player_id.to_string(), now);
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RateLimitError {
    TooFast { retry_after: u64 }, // milliseconds
}
```text

**Usage**:

```rust
impl Server {
    pub async fn handle_command(&mut self, player_id: &str, cmd: Command) -> CommandResult {
        // Check rate limit
        self.rate_limiter.check(player_id)?;

        // Process command
        // ...
    }
}
```text

**Limits**:

- **General commands**: 10 per second per player
- **Charleston passes**: 1 per second (to prevent spamming)
- **Reconnections**: 5 per minute (prevent reconnect spam)

---

## 9.6 Scalability Considerations

### 9.6.1 Single Server Architecture (MVP)

For MVP, a single server handles all games:

```text
┌─────────────┐
│   Client 1  │───┐
└─────────────┘   │
                  │   WebSocket
┌─────────────┐   │
│   Client 2  │───┼───► ┌──────────────┐
└─────────────┘   │      │              │
                  │      │  axum Server │
┌─────────────┐   │      │  (All Rooms) │
│   Client 3  │───┘      │              │
└─────────────┘          └──────────────┘
```text

**Limits**:

- ~10,000 concurrent connections (depending on hardware)
- ~1,000 active games (4 players each)

**When to Scale**: If concurrent users exceed 5,000, consider multi-server.

---

### 9.6.2 Room-Based Isolation

Each game is completely independent:

```rust
pub struct AppState {
    pub rooms: Arc<RwLock<HashMap<String, Room>>>,
}

impl AppState {
    pub async fn process_command(&self, room_id: &str, cmd: Command) -> CommandResult {
        let mut rooms = self.rooms.write().await;

        if let Some(room) = rooms.get_mut(room_id) {
            room.process_command(cmd).await
        } else {
            Err(CommandError::InternalError {
                message: "Room not found".to_string(),
            })
        }
    }
}
```text

**Benefits**:

- No cross-room interference
- Easy to distribute rooms across multiple servers (future)
- Crashed game doesn't affect others

---

### 9.6.3 Connection Pooling

Each WebSocket connection has its own task:

```rust
pub async fn handle_websocket(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut tx, mut rx) = socket.split();

    // Spawn a task to handle incoming messages
    let player_id = authenticate_connection(&mut rx).await.unwrap();

    while let Some(msg) = rx.next().await {
        match msg {
            Ok(axum::extract::ws::Message::Text(text)) => {
                let envelope: Envelope = serde_json::from_str(&text).unwrap();
                let result = match envelope {
                    Envelope::Command(payload) => {
                        state.process_command(&player_id, payload.command).await
                    }
                    _ => Ok(()),
                };

                if let Err(e) = result {
                    let error_envelope = Envelope::Error(ErrorPayload {
                        code: ErrorCode::InternalError,
                        message: format!("Command failed: {}", e),
                        context: None,
                    });
                    tx.send(axum::extract::ws::Message::Text(
                        serde_json::to_string(&error_envelope).unwrap(),
                    ))
                    .await
                    .ok();
                }
            }
            _ => break,
        }
    }

    // Cleanup on disconnect
    state.remove_player(&player_id).await;
}
```text

**Task Pool Size**: Tokio dynamically manages task pool (default: 1 task per CPU core).

---

### 9.6.4 Load Balancing (Future)

For multi-server deployments:

```text
┌─────────────┐
│   Client 1  │───┐
└─────────────┘   │
                  │
┌─────────────┐   │   ┌──────────────┐      ┌──────────────┐
│   Client 2  │───┼───┤ Load Balancer├──────┤  Server 1    │
└─────────────┘   │   └──────────────┘      └──────────────┘
                  │          │
┌─────────────┐   │          │              ┌──────────────┐
│   Client 3  │───┘          └──────────────┤  Server 2    │
└─────────────┘                             └──────────────┘
```text

**Strategy**: Sticky sessions (route all players in a room to the same server)

**Implementation**: Use a Redis-backed session store for cross-server state.

---

## 9.7 Error Scenarios

### 9.7.1 Network Timeout

**Client timeout** (server not responding):

```typescript
const COMMAND_TIMEOUT = 5000; // 5 seconds

function sendCommandWithTimeout(cmd: Command): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Command timeout'));
    }, COMMAND_TIMEOUT);

    ws.send(JSON.stringify({ kind: 'Command', payload: { command: cmd } }));

    // Resolve when server acknowledges (via event)
    const listener = (event: MessageEvent) => {
      const envelope = JSON.parse(event.data) as { kind: string; payload: any };

      if (envelope.kind === 'Event' && isRelatedToCommand(envelope.payload.event, cmd)) {
        clearTimeout(timer);
        ws.removeEventListener('message', listener);
        resolve();
      }
    };

    ws.addEventListener('message', listener);
  });
}
```text

**Server timeout** (client not responding to ping):

See Section 9.1.3 (Heartbeat).

---

### 9.7.2 Malformed Messages

**Client sends invalid JSON**:

```rust
async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut tx, mut rx) = socket.split();

    while let Some(msg) = rx.next().await {
        match msg {
            Ok(axum::extract::ws::Message::Text(text)) => {
                // Try to parse JSON
                let parsed: Result<Envelope, _> = serde_json::from_str(&text);

                match parsed {
                    Ok(msg) => {
                        // Process message
                    }
                    Err(e) => {
                        // Send error back to client
                        let error = Envelope::Error(ErrorPayload {
                            code: ErrorCode::InvalidCommand,
                            message: format!("Malformed message: {}", e),
                            context: Some(serde_json::json!({ "raw": text })),
                        });

                        tx.send(axum::extract::ws::Message::Text(
                            serde_json::to_string(&error).unwrap(),
                        ))
                        .await
                        .ok();
                    }
                }
            }
            _ => break,
        }
    }
}
```text

---

### 9.7.3 Player Disconnection During Critical Phases

**Charleston mid-pass**:

```rust
impl Room {
    pub async fn handle_player_disconnect(&mut self, player_id: &str) {
        let seat = self.find_seat(player_id);

        match &self.table.phase {
            GamePhase::Charleston(stage) => {
                // Auto-select random tiles for disconnected player
                let tiles = self.select_random_charleston_tiles(seat, 3);
                let cmd = Command::PassTiles { player: seat, tiles };
                self.process_command(cmd).await.ok();
            }

            GamePhase::Playing(TurnStage::Discarding { player }) if *player == seat => {
                // Auto-discard a random tile
                let tile = self.select_random_discard(seat);
                let cmd = Command::DiscardTile { player: seat, tile };
                self.process_command(cmd).await.ok();
            }

            _ => {
                // Wait for reconnection (5 minute grace period)
                self.start_reconnect_timer(seat, Duration::from_secs(300)).await;
            }
        }
    }
}
```text

---

### 9.7.4 Server Crash Recovery

**Problem**: Server crashes mid-game. How do players recover?

**MVP Solution**: Game is lost (no persistence).

**Future Solution**: Periodic state snapshots to Redis/PostgreSQL:

```rust
impl Room {
    /// Save game state to persistent storage
    pub async fn save_snapshot(&self) -> Result<(), PersistenceError> {
        let snapshot = GameSnapshot {
            room_id: self.id.clone(),
            table: self.table.clone(),
            timestamp: current_timestamp(),
        };

        let json = serde_json::to_string(&snapshot)?;
        redis_client.set(&format!("room:{}", self.id), json).await?;

        Ok(())
    }

    /// Load game state from persistent storage
    pub async fn load_snapshot(room_id: &str) -> Result<Self, PersistenceError> {
        let json: String = redis_client.get(&format!("room:{}", room_id)).await?;
        let snapshot: GameSnapshot = serde_json::from_str(&json)?;

        Ok(Room {
            id: snapshot.room_id,
            table: snapshot.table,
            players: HashMap::new(), // Players will reconnect
        })
    }
}
```text

**Snapshot Frequency**: After every phase transition (setup → Charleston → Playing → Scoring).

---

## 9.8 Protocol Examples

### 9.8.1 Complete Handshake Sequence

```text
Client                                  Server
  |                                       |
  |--- [TCP Handshake] ------------------->|
  |<-- [WebSocket Upgrade] ----------------|
  |                                       |
  |--- Authenticate(Guest) -------------->|
  |                                       | [Generate player_id, session_token]
  |<-- AuthSuccess(player_id, token) -----|
  |                                       |
  |--- CreateRoom("My Game") ------------>|
  |                                       | [Create room "abc123"]
  |<-- RoomJoined(room_id, Seat::East) ---|
  |<-- GameEvent::GameCreated ------------|
  |                                       |
  | [Wait for 3 more players]             |
  |                                       |
  |<-- GameEvent::PlayerJoined(South) ----|
  |<-- GameEvent::PlayerJoined(West) -----|
  |<-- GameEvent::PlayerJoined(North) ----|
  |                                       |
  |<-- GameEvent::GameStarting ------------|
  |<-- GameEvent::DiceRolled(roll: 7) ----|
  |<-- GameEvent::TilesDealt(your_tiles)--|
  |                                       |
  | [Game begins]                         |
```text

---

### 9.8.2 Charleston Tile Passing (Synchronization Example)

This demonstrates how the server coordinates simultaneous tile selection by all 4 players.

```text
Client East                Server                Client South
     |                       |                         |
     | PassTiles([1D,2D,3D]) |                         |
     |---------------------->|                         |
     |                       | [Store: East ready]     |
     |                       |                         |
     |                       |<-- PassTiles([4B,5B,6B])|
     |                       | [Store: South ready]    |
     |                       |                         |
     |                       | [Wait for West, North]  |
     |                       |    ...                  |
     |                       |                         |
     |                       | [All 4 players ready]   |
     |                       | [Execute swap]          |
     |                       |                         |
     |<-- TilesPassing(Right)|------------------------>|
     |<-- TilesReceived([...])|----------------------->|
     |                       |                         |
     |<-- CharlestonPhaseChanged(FirstAcross) -------->|
     |                       |                         |
```text

**Key Points**:

- Server waits for ALL players to submit
- Once all ready, server executes the swap atomically
- All clients receive `TilesReceived` simultaneously

---

### 9.8.3 Discard → Call → Turn Change Flow

```text
Client East               Server                Client West
     |                      |                        |
     | DiscardTile(5D)      |                        |
     |-------------------->|                        |
     |                      | [Validate: East's turn]|
     |                      | [Remove 5D from East]  |
     |                      | [Add to discard pile]  |
     |                      |                        |
     |<-- TileDiscarded(East, 5D) ------------------>|
     |<-- CallWindowOpened(5D, timer: 10) ---------->|
     |                      |                        |
     |                      |   CallTile(Pung, [5D,5D])
     |                      |<-----------------------|
     |                      | [Validate: West has tiles]
     |                      | [Create meld]          |
     |                      | [Turn → West]          |
     |                      |                        |
     |<-- TileCalled(West, Pung(5D×3)) ------------->|
     |<-- TurnChanged(West, Discarding) ------------>|
     |                      |                        |
```text

---

### 9.8.4 Win Declaration and Validation

```text
Client North              Server
     |                      |
     | DeclareMahjong       |
     |-------------------->|
     |                      | [Freeze game]
     |                      | [Validate hand against Card]
     |                      | [Check tile count: 14]
     |                      | [Try Joker permutations]
     |                      | [Pattern matched!]
     |                      |
     |<-- MahjongDeclared(North)
     |<-- ValidatingHand(North)
     |<-- GameWon(result)
     |                      |
     | [Show win screen]    |
```text

---

## 9.9 API Reference

### 9.9.1 WebSocket Endpoint

**URL**: `wss://server.example.com/ws`

**Protocol**: WebSocket (RFC 6455)

**Subprotocol**: None (uses JSON message framing)

---

### 9.9.2 Message Types Summary

| Type           | Direction | Purpose                  | Example                                                                               |
| -------------- | --------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `Authenticate` | C→S       | Initial authentication   | `{ kind: "Authenticate", payload: { method: "guest", version: "0.1.0" } }`            |
| `AuthSuccess`  | S→C       | Authentication succeeded | `{ kind: "AuthSuccess", payload: { player_id: "...", ... } }`                         |
| `AuthFailure`  | S→C       | Authentication failed    | `{ kind: "AuthFailure", payload: { reason: "..." } }`                                 |
| `Command`      | C→S       | Player action            | `{ kind: "Command", payload: { command: { DiscardTile: { player: "East", ... } } } }` |
| `Event`        | S→C       | Game state change        | `{ kind: "Event", payload: { event: { TileDiscarded: { player: "East", ... } } } }`   |
| `Error`        | S→C       | Error response           | `{ kind: "Error", payload: { code: "NOT_YOUR_TURN", message: "..." } }`               |
| `Ping`         | S→C       | Heartbeat                | `{ kind: "Ping", payload: { timestamp: "2026-01-07T12:34:56Z" } }`                    |
| `Pong`         | C→S       | Heartbeat response       | `{ kind: "Pong", payload: { timestamp: "2026-01-07T12:34:56Z" } }`                    |

---

### 9.9.3 Status Codes / Error Codes

See Section 9.2.2 for full `ErrorCode` enum.

**Common Errors**:

| Code                  | HTTP Analogy | Meaning                 | Action          |
| --------------------- | ------------ | ----------------------- | --------------- |
| `INVALID_CREDENTIALS` | 401          | Bad/expired credentials | Re-authenticate |
| `UNAUTHENTICATED`     | 401          | Not authenticated       | Authenticate    |
| `ROOM_NOT_FOUND`      | 404          | Room doesn't exist      | Show error      |
| `ROOM_FULL`           | 409          | Room has 4 players      | Show error      |
| `NOT_YOUR_TURN`       | 403          | Can't act now           | Ignore/toast    |
| `INVALID_COMMAND`     | 400          | Invalid for phase/state | Log error       |
| `INVALID_TILE`        | 400          | Invalid tile            | Ignore/toast    |
| `RATE_LIMIT_EXCEEDED` | 429          | Too many requests       | Back off/retry  |
| `INTERNAL_ERROR`      | 500          | Server error            | Retry           |

---

## 9.10 Testing Strategy

### 9.10.1 Integration Tests

**Test the full WebSocket flow**:

```rust
#[tokio::test]
async fn test_full_handshake() {
    let server = spawn_test_server().await;

    // Connect client
    let (mut ws, _) = tokio_tungstenite::connect_async("ws://localhost:3000/ws")
        .await
        .unwrap();

    // Send auth
    let auth = tokio_tungstenite::tungstenite::Message::Text(
        serde_json::to_string(&Envelope::Authenticate(AuthenticatePayload {
            method: AuthMethod::Guest,
            credentials: None,
            version: "0.1.0".to_string(),
        }))
        .unwrap(),
    );

    ws.send(auth).await.unwrap();

    // Receive auth success
    let response = ws.next().await.unwrap().unwrap();
    let msg: Envelope = serde_json::from_str(response.to_text().unwrap()).unwrap();

    assert!(matches!(msg, Envelope::AuthSuccess(_)));
}
```text

---

### 9.10.2 Simulating Latency

**Use `tokio::time::sleep` to simulate network delays**:

```rust
#[tokio::test]
async fn test_charleston_with_latency() {
    let mut clients = spawn_4_clients().await;

    // Client 1 passes tiles immediately
    clients[0].send_pass_tiles(vec![tile1, tile2, tile3]).await;

    // Client 2 passes after 2 seconds (simulates slow connection)
    tokio::time::sleep(Duration::from_secs(2)).await;
    clients[1].send_pass_tiles(vec![tile4, tile5, tile6]).await;

    // Clients 3 and 4 pass immediately
    clients[2].send_pass_tiles(vec![tile7, tile8, tile9]).await;
    clients[3].send_pass_tiles(vec![tile10, tile11, tile12]).await;

    // All clients should receive TilesReceived event
    for client in &mut clients {
        let event = client.wait_for_event("TilesReceived").await;
        assert!(event.is_some());
    }
}
```text

---

### 9.10.3 Stress Testing (Many Concurrent Games)

**Spawn 1000 concurrent games**:

```rust
#[tokio::test]
async fn test_1000_concurrent_games() {
    let server = spawn_test_server().await;

    let mut handles = vec![];

    for i in 0..1000 {
        let handle = tokio::spawn(async move {
            let clients = spawn_4_clients().await;

            // Simulate full game
            play_full_game(clients).await.unwrap();
        });

        handles.push(handle);
    }

    // Wait for all games to complete
    for handle in handles {
        handle.await.unwrap();
    }

    // Verify server is still responsive
    let client = connect_client().await;
    assert!(client.is_connected());
}
```text

**Metrics to Measure**:

- Memory usage (should be stable)
- CPU usage (should not max out)
- Latency (p50, p95, p99)
- Error rate (should be 0%)

---

## 9.11 Design Principles

1. **Server Authority**: Server is the source of truth, client never trusted
2. **Event Sourcing**: All state changes are events (enables replay/debugging)
3. **Type Safety**: Rust types auto-generate TypeScript types (no drift)
4. **Graceful Degradation**: Handle disconnects, slow clients, malformed messages
5. **Security First**: Validate all input, rate limit, authenticate/authorize
6. **Room Isolation**: Games are independent (scalability + fault tolerance)
7. **Debuggability**: JSON messages are human-readable, logs are detailed

---

## 9.12 Future Enhancements

1. **Binary Protocol**: Switch to MessagePack or Protobuf for efficiency
2. **Compression**: Enable WebSocket per-message compression (permessage-deflate)
3. **Multi-Server**: Redis-backed state for horizontal scaling
4. **Replay System**: Save all events for game replay
5. **Spectator Mode**: Read-only connections to watch games
6. **Voice/Video**: Integrate WebRTC for voice chat
7. **Metrics**: Prometheus/Grafana for monitoring

---

**This completes Section 9: Network Protocol.**
