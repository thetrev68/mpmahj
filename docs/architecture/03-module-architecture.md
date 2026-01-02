# 3. Module Architecture

This document maps the codebase structure to architectural responsibilities, showing how the monorepo is organized and how each module contributes to the system.

## 3.1 Monorepo Structure

The project uses a **dual-workspace monorepo**:

- **Rust Workspace** (managed by Cargo) - Backend crates
- **Node Workspace** (managed by npm) - Frontend applications

```text
mpmahj/
├── Cargo.toml              # Rust workspace root
├── package.json            # Node workspace root (Turborepo/npm workspaces)
│
├── crates/                 # 🦀 Rust Backend (The "Truth")
│   ├── mahjong_core/       # Pure game logic (no I/O, no dependencies)
│   └── mahjong_server/     # WebSocket server (axum + tokio)
│
├── apps/                   # 📱 Frontend Applications (The "View")
│   └── client/             # React + Vite (Web) + Tauri (Desktop/Mobile)
│       ├── src/            # React/TypeScript source
│       └── src-tauri/      # Tauri native wrapper (Rust)
│
├── data/                   # 📊 Game Data (NMJL Cards)
│   └── cards/              # JSON card definitions (2017-2025)
│
└── docs/                   # 📚 Documentation
    └── architecture/       # This document and others
```

---

## 3.2 Core Principles

### 3.2.1 Separation of Concerns

The architecture enforces strict boundaries:

| Layer | Technology | Responsibility | Constraints |
| :--- | :--- | :--- | :--- |
| **Logic** | Rust (`mahjong_core`) | Game rules, state, validation | No I/O, no async, no network |
| **Server** | Rust (`mahjong_server`) | Networking, room management, persistence | Uses `mahjong_core`, no UI |
| **Client** | TypeScript (React) | Presentation, animation, user input | Stateless (mirrors server) |
| **Native** | Rust (Tauri) | Desktop/mobile wrapper, native APIs | Wraps client app |

### 3.2.2 Dependency Flow

```text
┌─────────────────┐
│   Client (TS)   │ ← Receives events, sends commands
└────────┬────────┘
         │ WebSocket
         ↓
┌─────────────────┐
│ mahjong_server  │ ← Network layer, room management
└────────┬────────┘
         │ Function calls
         ↓
┌─────────────────┐
│  mahjong_core   │ ← Pure logic (no external dependencies)
└─────────────────┘
```

**Key Rule**: `mahjong_core` depends on **nothing** except stdlib and serialization (serde).

---

## 3.3 Crate: `mahjong_core`

**Location**: `crates/mahjong_core/`

**Purpose**: Pure game logic. Contains all rules, state machines, and validation. No I/O, no networking, no UI.

### 3.3.1 Module Breakdown

```rust
// crates/mahjong_core/src/lib.rs
pub mod tile;       // Tile, Suit, Rank definitions
pub mod deck;       // Deck, Wall, shuffling, dealing
pub mod hand;       // Hand, Meld, tile management
pub mod player;     // Player, Seat, status
pub mod table;      // Table (aggregate game state)
pub mod flow;       // State machine (GamePhase, turn logic)
pub mod command;    // Commands (player actions)
pub mod event;      // Events (game state changes)
pub mod rules;      // Validation engine (The Card, pattern matching)
```

### 3.3.2 Module Responsibilities

#### `tile.rs`

**Exports**: `Tile`, `Suit`, `Rank`, `TileError`

**Responsibilities**:

- Define the 152-tile set (Dots, Bams, Cracks, Winds, Dragons, Flowers, Jokers)
- Tile creation and validation
- Helper methods (is_honor, is_sequential, display_name)

**Key Types**:

```rust
pub struct Tile { pub suit: Suit, pub rank: Rank }
pub enum Suit { Dots, Bams, Cracks, Winds, Dragons, Flowers, Jokers }
pub enum Rank { Number(u8), North, East, West, South, Red, Green, White, Flower, Joker, Blank }
```

**Dependencies**: None (stdlib only)

---

#### `deck.rs`

**Exports**: `Deck`, `Wall`, `DeckError`

**Responsibilities**:

- Create a standard 152-tile deck
- Shuffle using CSPRNG (cryptographically secure random)
- Deal initial hands (13 tiles each, 14 for East)
- Manage the wall (drawable tiles) with dead wall

**Key Types**:

```rust
pub struct Deck { tiles: Vec<Tile> }
pub struct Wall { tiles: Vec<Tile>, dead_wall_size: usize }
```

**Dependencies**: `tile`, `rand` (for shuffling)

---

#### `hand.rs`

**Exports**: `Hand`, `Meld`, `MeldType`, `HandError`

**Responsibilities**:

- Manage a player's tiles (concealed + exposed)
- Add/remove tiles (for draws, discards, Charleston)
- Expose melds (Pungs, Kongs, Quints)
- Track Joker assignments (what each Joker represents)
- Joker exchange logic (swap Joker from meld with real tile)
- Blank exchange logic (swap blank from hand with tile from discard pile)

**Key Types**:

```rust
pub struct Hand {
    pub concealed: Vec<Tile>,
    pub exposed: Vec<Meld>,
    pub joker_assignments: Option<HashMap<usize, Tile>>,
}

pub struct Meld {
    pub meld_type: MeldType,
    pub tiles: Vec<Tile>,
    pub called_tile: Option<Tile>,
    pub joker_assignments: HashMap<usize, Tile>,
}

pub enum MeldType { Pung, Kong, Quint }
```

**Dependencies**: `tile`

---

#### `player.rs`

**Exports**: `Player`, `Seat`, `PlayerId`, `PlayerStatus`

**Responsibilities**:

- Represent a player at the table
- Track seat position (East, South, West, North)
- Store player hand
- Player status (Active, Dead, Waiting)
- Seat navigation (right(), across(), left())

**Key Types**:

```rust
pub struct Player {
    pub id: PlayerId,
    pub seat: Seat,
    pub hand: Hand,
    pub is_bot: bool,
    pub status: PlayerStatus,
}

pub enum Seat { East, South, West, North }
pub enum PlayerStatus { Active, Dead, Waiting }
```

**Dependencies**: `hand`, `tile`

---

#### `table.rs`

**Exports**: `Table`, `DiscardedTile`

**Responsibilities**:

- Aggregate game state (players, wall, discards, phase)
- Current turn tracking
- Dealer tracking (rotates after each round)
- Discard pile management

**Key Types**:

```rust
pub struct Table {
    pub players: HashMap<Seat, Player>,
    pub wall: Wall,
    pub discard_pile: Vec<DiscardedTile>,
    pub current_turn: Seat,
    pub phase: GamePhase,
    pub dealer: Seat,
    pub round_number: u32,
}

pub struct DiscardedTile {
    pub tile: Tile,
    pub discarded_by: Seat,
    pub turn_number: u32,
}
```

**Dependencies**: `player`, `deck`, `flow`

---

#### `flow.rs`

**Exports**: `GamePhase`, `SetupStage`, `CharlestonStage`, `TurnStage`, `WinContext`, `GameResult`, `StateError`

**Responsibilities**:

- Define the state machine (see Section 4)
- Phase transitions (Setup → Charleston → Playing → Scoring → GameOver)
- Charleston orchestration (6 pass stages + voting)
- Turn stage management (Drawing → Discarding → CallWindow)

**Key Types**:

```rust
pub enum GamePhase {
    WaitingForPlayers,
    Setup(SetupStage),
    Charleston(CharlestonStage),
    Playing(TurnStage),
    Scoring(WinContext),
    GameOver(GameResult),
}

pub enum CharlestonStage {
    FirstRight, FirstAcross, FirstLeft,
    VotingToContinue,
    SecondLeft, SecondAcross, SecondRight,
    CourtesyAcross,
    Complete,
}

pub enum TurnStage {
    Drawing { player: Seat },
    Discarding { player: Seat },
    CallWindow { tile: Tile, discarded_by: Seat, can_act: HashSet<Seat>, timer: u32 },
}
```

**Dependencies**: `player`, `hand`, `tile`

---

#### `command.rs`

**Exports**: `Command`, `CommandError`, `CommandResult`

**Responsibilities**:

- Define all player actions (see Section 6)
- Commands are inputs from clients (intent)
- Validation happens in `mahjong_server` or `table`

**Key Types**:

```rust
pub enum Command {
    RollDice,
    ReadyToStart { player: Seat },
    PassTiles { player: Seat, tiles: Vec<Tile> },
    VoteCharleston { player: Seat, vote: CharlestonVote },
    DrawTile { player: Seat },
    DiscardTile { player: Seat, tile: Tile },
    CallTile { player: Seat, meld_type: MeldType, tiles_from_hand: Vec<Tile> },
    DeclareMahjong { player: Seat, winning_tile: Option<Tile> },
    ExchangeJoker { player: Seat, target_player: Seat, meld_index: usize, replacement_tile: Tile },
    // ... etc
}

pub enum CommandError {
    NotInGame,
    WrongPhase { current: String, expected: String },
    NotYourTurn { current_player: Seat },
    InvalidPassCount { expected: u8, got: u8 },
    CannotPassJoker,
    // ... etc
}

pub type CommandResult = Result<Vec<GameEvent>, CommandError>;
```

**Dependencies**: `tile`, `hand`, `player`, `flow`

---

#### `event.rs`

**Exports**: `GameEvent`

**Responsibilities**:

- Define all game events (see Section 6)
- Events are outputs from the server (what happened)
- Broadcast to clients for state synchronization

**Key Types**:

```rust
pub enum GameEvent {
    GameCreated { game_id: String },
    PlayerJoined { player: Seat, player_id: String, is_bot: bool },
    DiceRolled { roll: u8 },
    TilesDealt { your_tiles: Vec<Tile> },  // Private event
    CharlestonPhaseChanged { stage: CharlestonStage },
    TilesPassing { direction: PassDirection },
    TilesReceived { tiles: Vec<Tile> },    // Private event
    TurnChanged { player: Seat, stage: TurnStage },
    TileDrawn { tile: Option<Tile>, remaining_tiles: usize },  // tile is private
    TileDiscarded { player: Seat, tile: Tile },
    CallWindowOpened { tile: Tile, discarded_by: Seat, timer: u32 },
    TileCalled { player: Seat, meld: Meld, called_tile: Tile },
    MahjongDeclared { player: Seat },
    GameWon { result: GameResult },
    InvalidMahjong { player: Seat, reason: String },
    // ... etc
}
```

**Dependencies**: `tile`, `hand`, `player`, `flow`

---

#### `rules/` (Submodule)

**Exports**: `CardDefinition`, `HandPattern`, `Component`, `ValidationResult`, `Validator`

**Responsibilities**:

- Load and parse NMJL card data (JSON)
- Validate hands against patterns (see Section 8)
- Joker permutation generation
- VSUIT resolution (variable suits)
- Pattern matching algorithm

**Files**:

- `rules/mod.rs` - Module exports
- `rules/card.rs` - Card data structures, JSON loading
- `rules/validator.rs` - Validation engine (the complex part)

**Key Types**:

```rust
// rules/card.rs
pub struct CardDefinition {
    pub year: u16,
    pub sections: Vec<Section>,
}

pub struct Section {
    pub group_description: String,
    pub hands: Vec<HandPattern>,
}

pub struct HandPattern {
    pub description: String,
    pub vsuit_count: u8,
    pub concealed: bool,
    pub components: Vec<Component>,
}

pub struct Component {
    pub suit: String,       // "VSUIT1", "VSUIT2", "VSUIT3", "F", "N", "E", etc.
    pub number: Option<u8>, // 1-9 for numbered tiles, None for honors
    pub count: u8,          // How many of this tile
    pub flexibility: u8,    // How many can be Jokers
}

// rules/validator.rs
pub enum ValidationResult {
    Valid {
        pattern: HandPattern,
        joker_assignments: HashMap<usize, Tile>,
        points: u32,
    },
    Invalid {
        reason: String,
        closest_pattern: Option<String>,
        tiles_short: Option<Vec<Tile>>,
    },
}

pub struct Validator {
    cache: LruCache<NormalizedHand, ValidationResult>,
}
```

**Dependencies**: `tile`, `hand`, `serde_json` (for card loading)

---

### 3.3.3 Cross-Cutting Concerns

#### Serialization (serde + ts-rs)

All public types in `mahjong_core` derive `Serialize` and `Deserialize` for:

1. **Network transmission** (WebSocket JSON messages)
2. **TypeScript type generation** (via `ts-rs`)
3. **Game state persistence** (save/load games)

**Example**:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct Tile {
    pub suit: Suit,
    pub rank: Rank,
}
```

**Build command**:

```bash
cargo build --features typescript
# Generates TypeScript types in bindings/
```

#### Error Handling

All fallible operations return `Result<T, E>`:

- **TileError**: Invalid tile creation
- **DeckError**: Not enough tiles
- **HandError**: Tile not found, invalid count
- **MeldError**: Invalid meld construction
- **StateError**: Invalid state transition
- **CommandError**: Command validation failures

**Philosophy**: Prefer `Result` over `panic!` for recoverable errors.

---

### 3.3.4 Testing in `mahjong_core`

Because `mahjong_core` is pure logic with no I/O, it's highly testable:

```rust
// Unit tests (in each module)
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tile_creation() {
        let tile = Tile::new_number(Suit::Dots, 5).unwrap();
        assert_eq!(tile.suit, Suit::Dots);
        assert_eq!(tile.rank, Rank::Number(5));
    }

    #[test]
    fn test_invalid_tile() {
        let result = Tile::new_number(Suit::Dots, 10);
        assert!(result.is_err());
    }
}

// Integration tests (in tests/ directory)
#[test]
fn test_full_game_simulation() {
    let mut table = Table::new(["Alice", "Bob", "Carol", "Dave"]);
    // Simulate entire game...
}
```

---

## 3.4 Crate: `mahjong_server`

**Location**: `crates/mahjong_server/`

**Purpose**: WebSocket server for multiplayer games. Manages rooms, player connections, and orchestrates `mahjong_core` logic.

### 3.4.1 Module Breakdown

```rust
// crates/mahjong_server/src/main.rs
mod ws;         // WebSocket handlers
mod room;       // Game room management
mod state;      // Shared server state
mod db;         // (Future) Persistence layer

use axum::{Router, routing::get};
use tokio;

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/ws", get(ws::websocket_handler))
        .route("/health", get(health_check));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .unwrap();

    axum::serve(listener, app).await.unwrap();
}
```

### 3.4.2 Module Responsibilities

#### `ws.rs` - WebSocket Handlers

**Responsibilities**:

- Accept WebSocket connections
- Authenticate players (future: JWT or session tokens)
- Parse incoming `Command` messages (JSON)
- Serialize and send `GameEvent` messages (JSON)
- Handle disconnections and reconnections

**Key Functions**:

```rust
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    // Loop: receive commands, process, send events
    while let Some(msg) = socket.recv().await {
        let command: Command = serde_json::from_str(&msg).unwrap();
        let events = state.process_command(command).await;
        for event in events {
            socket.send(serde_json::to_string(&event).unwrap()).await;
        }
    }
}
```

---

#### `room.rs` - Game Room Management

**Responsibilities**:

- Create/destroy game rooms
- Assign players to seats
- Maintain room state (waiting, in-progress, finished)
- Handle player join/leave
- Broadcast events to all players in a room

**Key Types**:

```rust
pub struct Room {
    pub id: String,
    pub table: Table,  // from mahjong_core
    pub players: HashMap<Seat, PlayerConnection>,
    pub state: RoomState,
}

pub enum RoomState {
    Waiting,      // < 4 players
    InProgress,   // Game running
    Finished,     // Game over
}

pub struct PlayerConnection {
    pub player_id: String,
    pub tx: mpsc::Sender<GameEvent>,  // Channel to send events
}
```

**Key Functions**:

```rust
impl Room {
    pub fn new(id: String) -> Self { ... }

    pub fn add_player(&mut self, player_id: String, tx: mpsc::Sender<GameEvent>) -> Result<Seat, RoomError> { ... }

    pub fn process_command(&mut self, cmd: Command) -> CommandResult {
        // Validate command, update table, generate events
        self.table.process_command(cmd)
    }

    pub async fn broadcast(&self, event: GameEvent) {
        for (seat, conn) in &self.players {
            conn.tx.send(event.clone()).await;
        }
    }

    pub async fn send_to_player(&self, seat: Seat, event: GameEvent) {
        if let Some(conn) = self.players.get(&seat) {
            conn.tx.send(event).await;
        }
    }
}
```

---

#### `state.rs` - Shared Server State

**Responsibilities**:

- Manage all active rooms
- Thread-safe access (Arc<RwLock<>>)
- Matchmaking (future: queue players, create rooms)

**Key Types**:

```rust
pub struct AppState {
    pub rooms: Arc<RwLock<HashMap<String, Room>>>,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            rooms: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_room(&self, room_id: String) -> Result<(), ServerError> {
        let mut rooms = self.rooms.write().await;
        rooms.insert(room_id.clone(), Room::new(room_id));
        Ok(())
    }

    pub async fn get_room(&self, room_id: &str) -> Option<Room> {
        let rooms = self.rooms.read().await;
        rooms.get(room_id).cloned()
    }
}
```

---

#### `db.rs` - Persistence (Future)

**Responsibilities** (not yet implemented):

- Save game state to PostgreSQL/SQLite
- Load saved games
- Store player stats (wins, losses, favorite patterns)
- Game history/replay

**Planned Schema**:

```sql
CREATE TABLE games (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP,
    finished_at TIMESTAMP,
    winner_seat TEXT,
    winning_pattern TEXT,
    final_state JSONB  -- Serialized Table
);

CREATE TABLE players (
    id UUID PRIMARY KEY,
    username TEXT UNIQUE,
    stats JSONB
);
```

---

### 3.4.3 Command Processing Flow

**Sequence**:

1. **Client sends command** (JSON over WebSocket)
2. **Server receives** in `ws::handle_socket()`
3. **Deserialize** JSON → `Command`
4. **Validate** command against current game state
5. **Process** command via `room.process_command()` → calls `table.process_command()` (from `mahjong_core`)
6. **Generate events** (`Vec<GameEvent>`)
7. **Broadcast** public events to all players
8. **Send private events** to specific players (e.g., drawn tile)

**Example Flow**:

```text
Client (Player East)                    Server                      mahjong_core
      |                                    |                               |
      | DiscardTile { tile: 5-Dots } (WS) |                               |
      |---------------------------------->|                               |
      |                                    | Validate: Is it East's turn?  |
      |                                    | Does East have 5-Dots?        |
      |                                    |------------------------------>|
      |                                    |                               |
      |                                    | table.process_command(cmd)    |
      |                                    |------------------------------>|
      |                                    |                               |
      |                                    |      [Updates state,          |
      |                                    |       removes tile,           |
      |                                    |       opens call window]      |
      |                                    |                               |
      |                                    | <------ Vec<GameEvent> -------|
      |                                    |                               |
      | <-- TileDiscarded event (WS) -----|                               |
      | <-- CallWindowOpened event (WS) --|                               |
      |                                    |                               |
All Players receive events                 |                               |
      |<----------------------------------|                               |
```

---

### 3.4.4 Dependencies

```toml
[dependencies]
mahjong_core = { path = "../mahjong_core" }
axum = "0.7"
tokio = { version = "1.0", features = ["full"] }
serde = "1.0"
serde_json = "1.0"
# Future: sqlx, uuid, tower, tower-http
```

---

## 3.5 App: `client` (React + Tauri)

**Location**: `apps/client/`

**Purpose**: Cross-platform UI (Web, Desktop, Mobile) for the game. Presents state from server and sends commands via WebSocket.

### 3.5.1 Directory Structure

```text
apps/client/
├── src/                      # React/TypeScript source
│   ├── main.tsx              # Entry point
│   ├── App.tsx               # Root component
│   │
│   ├── components/           # React components
│   │   ├── Table.tsx         # Game table (4 player positions)
│   │   ├── Hand.tsx          # Player's hand (13-14 tiles)
│   │   ├── Tile.tsx          # Single tile component
│   │   ├── DiscardPile.tsx   # Discard pile display
│   │   ├── Charleston/       # Charleston UI (tile selection)
│   │   ├── CallWindow.tsx    # Call/Pass buttons during call window
│   │   └── Card.tsx          # The Card viewer (patterns)
│   │
│   ├── store/                # Zustand state management
│   │   ├── gameStore.ts      # Game state (mirrors server)
│   │   ├── uiStore.ts        # UI state (selected tiles, modals)
│   │   └── wsStore.ts        # WebSocket connection state
│   │
│   ├── animations/           # Framer Motion animations
│   │   ├── variants.ts       # Animation variants (tile fly, hand sort)
│   │   └── sequences.ts      # Complex sequences (deal tiles, win effect)
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── useWebSocket.ts   # WebSocket connection management
│   │   ├── useGameEvents.ts  # Subscribe to specific event types
│   │   └── useActionQueue.ts # Queue animations (decouple state from UI)
│   │
│   ├── utils/                # Helper functions
│   │   ├── tileHelpers.ts    # Sort tiles, group by suit
│   │   └── commandBuilder.ts # Build Command objects
│   │
│   ├── types/                # TypeScript types
│   │   └── bindings/         # Auto-generated from Rust (ts-rs)
│   │       ├── Tile.ts
│   │       ├── Command.ts
│   │       ├── GameEvent.ts
│   │       └── ...
│   │
│   └── assets/               # Images, sounds, styles
│       ├── tiles/            # Tile images (SVG or PNG)
│       ├── sounds/           # SFX (discard, call, win)
│       └── styles/           # Global CSS or Tailwind config
│
├── src-tauri/                # Tauri native wrapper (Rust)
│   ├── src/
│   │   ├── lib.rs            # Tauri commands (file I/O, haptics)
│   │   └── main.rs           # Tauri entry point
│   ├── tauri.conf.json       # Tauri configuration (target platforms)
│   ├── Cargo.toml
│   └── gen/                  # Auto-generated native projects
│       ├── apple/            # Xcode project (iOS/macOS)
│       └── android/          # Android Studio project
│
├── public/                   # Static assets
├── index.html                # HTML entry point
├── vite.config.ts            # Vite build config
└── package.json              # Dependencies, scripts
```

---

### 3.5.2 Key Components

#### State Management (Zustand)

**`store/gameStore.ts`**:

```typescript
import { create } from 'zustand';
import { GamePhase, Seat, Tile, Hand } from '@/types/bindings';

interface GameState {
  // Mirror of server state
  phase: GamePhase;
  currentTurn: Seat;
  myHand: Hand;
  discardPile: Tile[];
  wallRemaining: number;

  // Actions (dispatch commands to server)
  discardTile: (tile: Tile) => void;
  callTile: (meldType: MeldType) => void;
  passTiles: (tiles: Tile[]) => void;
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'WaitingForPlayers',
  currentTurn: 'East',
  myHand: { concealed: [], exposed: [] },
  discardPile: [],
  wallRemaining: 152,

  discardTile: (tile) => {
    // Send command to server
    wsStore.getState().sendCommand({
      type: 'DiscardTile',
      player: myState.mySeat,
      tile,
    });
  },

  // ... other actions
}));
```

**`store/wsStore.ts`**:

```typescript
import { create } from 'zustand';
import { Command, GameEvent } from '@/types/bindings';

interface WSState {
  ws: WebSocket | null;
  connected: boolean;
  sendCommand: (cmd: Command) => void;
  handleEvent: (event: GameEvent) => void;
}

export const useWSStore = create<WSState>((set, get) => ({
  ws: null,
  connected: false,

  sendCommand: (cmd) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(cmd));
    }
  },

  handleEvent: (event) => {
    // Update gameStore based on event type
    switch (event.type) {
      case 'TileDiscarded':
        gameStore.getState().addToDiscardPile(event.tile);
        break;
      case 'TurnChanged':
        gameStore.getState().setCurrentTurn(event.player);
        break;
      // ... handle all event types
    }
  },
}));
```

---

#### WebSocket Hook

**`hooks/useWebSocket.ts`**:

```typescript
import { useEffect } from 'react';
import { useWSStore } from '@/store/wsStore';

export function useWebSocket(url: string) {
  const { ws, setWS, handleEvent } = useWSStore();

  useEffect(() => {
    const socket = new WebSocket(url);

    socket.onopen = () => {
      console.log('Connected to server');
      setWS(socket);
    };

    socket.onmessage = (msg) => {
      const event = JSON.parse(msg.data) as GameEvent;
      handleEvent(event);
    };

    socket.onclose = () => {
      console.log('Disconnected from server');
      // Attempt reconnection
    };

    return () => socket.close();
  }, [url]);
}
```

---

#### Animation Queue Pattern

**Problem**: Server events are instant, but UI animations take time. We need to decouple state updates from animations.

**Solution**: Action Queue (see Section 10 for details)

```typescript
// hooks/useActionQueue.ts
import { useState, useEffect } from 'react';

export function useActionQueue() {
  const [queue, setQueue] = useState<AnimationAction[]>([]);
  const [currentAction, setCurrentAction] = useState<AnimationAction | null>(null);

  useEffect(() => {
    if (!currentAction && queue.length > 0) {
      const next = queue[0];
      setCurrentAction(next);
      setQueue((q) => q.slice(1));

      // Execute animation
      setTimeout(() => {
        setCurrentAction(null); // Ready for next action
      }, next.duration);
    }
  }, [queue, currentAction]);

  const enqueue = (action: AnimationAction) => {
    setQueue((q) => [...q, action]);
  };

  return { enqueue };
}
```

---

### 3.5.3 Tauri Integration

**`src-tauri/src/lib.rs`**:

```rust
use tauri::command;

#[command]
fn save_game(game_state: String) -> Result<(), String> {
    // Save to local file system
    std::fs::write("saved_game.json", game_state)
        .map_err(|e| e.to_string())
}

#[command]
fn load_game() -> Result<String, String> {
    std::fs::read_to_string("saved_game.json")
        .map_err(|e| e.to_string())
}

#[command]
fn trigger_haptic() {
    // Mobile haptic feedback (iOS/Android)
    #[cfg(mobile)]
    {
        // Platform-specific haptic code
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_game, load_game, trigger_haptic])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Use from React**:

```typescript
import { invoke } from '@tauri-apps/api/core';

async function saveGame() {
  const state = JSON.stringify(gameStore.getState());
  await invoke('save_game', { gameState: state });
}
```

---

### 3.5.4 Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "zustand": "^5.0.2",
    "framer-motion": "^11.0.0",
    "@tauri-apps/api": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vite": "^6.0.1",
    "@vitejs/plugin-react": "^4.3.4",
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

---

## 3.6 Data: Card Definitions

**Location**: `data/cards/`

**Format**: JSON (see Section 7 for schema)

**Files**:

- `card2017.json`
- `card2018.json`
- ...
- `card2025.json`

**Loading** (in `mahjong_core/rules/card.rs`):

```rust
use serde_json;

pub fn load_card(year: u16) -> Result<CardDefinition, CardError> {
    let path = format!("data/cards/card{}.json", year);
    let json = std::fs::read_to_string(path)?;
    let card: CardDefinition = serde_json::from_str(&json)?;
    Ok(card)
}
```

---

## 3.7 Build and Run Commands

### Development

```bash
# Backend (server)
cargo run -p mahjong_server

# Frontend (web)
cd apps/client
npm run dev

# Desktop (Tauri)
cd apps/client
npm run tauri dev

# Run tests
cargo test                  # Rust tests
npm test                    # TypeScript tests
```

### Production

```bash
# Build server binary
cargo build --release -p mahjong_server

# Build web client
cd apps/client
npm run build

# Build desktop apps (Windows/macOS/Linux)
cd apps/client
npm run tauri build

# Build mobile apps (iOS/Android)
cd apps/client
npm run tauri ios build
npm run tauri android build
```

---

## 3.8 Module Dependency Graph

```text
┌─────────────────────────────────────────────────────────────┐
│                         Client (React)                      │
│  ┌─────────┐  ┌──────┐  ┌───────────┐  ┌─────────────┐    │
│  │ Components│◄─│ Store│◄─│ WS Hook   │◄─│ Tauri API   │    │
│  └─────────┘  └──────┘  └───────────┘  └─────────────┘    │
└────────────────────┬────────────────────────────────────────┘
                     │ WebSocket (JSON)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    mahjong_server (Axum)                    │
│  ┌─────────┐  ┌──────┐  ┌───────────┐                      │
│  │ WS Handler│◄─│ Room │◄─│ State     │                      │
│  └─────────┘  └──────┘  └───────────┘                      │
│                   │                                          │
│                   │ Calls                                    │
│                   ↓                                          │
└───────────────────┼──────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│                    mahjong_core (Pure Logic)                │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌───────┐  ┌─────────────┐ │
│  │ Tile │  │ Deck │  │ Hand │  │ Player│  │ Table       │ │
│  └──┬───┘  └───┬──┘  └───┬──┘  └───┬───┘  └──────┬──────┘ │
│     │          │          │         │             │         │
│     └──────────┴──────────┴─────────┴─────────────┘         │
│                            ↓                                 │
│  ┌──────────┐  ┌───────────────┐  ┌─────────────────────┐  │
│  │ Command  │  │ Event         │  │ Flow (State Machine)│  │
│  └──────────┘  └───────────────┘  └─────────────────────┘  │
│                            ↓                                 │
│              ┌─────────────────────────┐                     │
│              │ Rules (Validation)      │                     │
│              │  - card.rs              │                     │
│              │  - validator.rs         │                     │
│              └─────────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 3.9 Design Principles

1. **Pure Core**: `mahjong_core` has zero I/O dependencies (testable, portable)
2. **Single Source of Truth**: Server (`mahjong_server`) is authoritative
3. **Event Sourcing**: All state changes are events (enables replay, debugging)
4. **Type Safety Across Boundaries**: Rust types auto-generate TypeScript types
5. **Separation of Concerns**: Logic, Network, UI are independent layers
6. **Cross-Platform**: Same UI codebase (React) runs on Web/Desktop/Mobile via Tauri

---

## 3.10 Future Enhancements

1. **AI Module** (`mahjong_core/src/ai/`) - Bot opponents (see Section 11)
2. **Persistence** (`mahjong_server/src/db.rs`) - PostgreSQL for game history
3. **Matchmaking** (`mahjong_server/src/matchmaking.rs`) - Queue system
4. **Replays** (`mahjong_server/src/replay.rs`) - Save/load game events
5. **Analytics** - Track pattern frequency, win rates
6. **Custom Cards** - Allow users to define house rules/custom patterns
