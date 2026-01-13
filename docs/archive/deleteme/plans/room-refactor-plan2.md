# Room.rs Refactoring Plan

## Current State Analysis

The `room.rs` file has grown to 1300+ lines and contains multiple responsibilities:

1. **Room struct** - Core game room state and lifecycle
2. **RoomStore** - Thread-safe room management
3. **analysis_worker** - 300+ line background analysis task
4. **Event handling** - Broadcasting and session management
5. **Command processing** - Game command validation and execution
6. **Tests** - Unit and integration tests

## Refactoring Strategy

### Phase 1: Extract Analysis Worker

**File:** `crates/mahjong_server/src/analysis/worker.rs`

**Note:** A module `crates/mahjong_server/src/analysis.rs` already exists. To support a submodule structure:

1. Move `crates/mahjong_server/src/analysis.rs` to `crates/mahjong_server/src/analysis/mod.rs`.
2. Create `crates/mahjong_server/src/analysis/worker.rs`.

Move the `analysis_worker` function and related logic:

```rust
// analysis/worker.rs
pub async fn analysis_worker(weak_room: Weak<Mutex<Room>>, mut rx: mpsc::Receiver<AnalysisRequest>) {
    // ... existing implementation
}

async fn send_event_to_session(session: &Arc<Mutex<Session>>, event: GameEvent) {
    // ... existing implementation
}
```

**Benefits:**

- Separates CPU-intensive analysis logic from room management
- Easier to test analysis logic independently
- Reduces room.rs by ~300 lines

### Phase 2: Extract Room Store

**File:** `crates/mahjong_server/src/network/room_store.rs`

Move `RoomStore` struct and implementation:

```rust
// room_store.rs
pub struct RoomStore {
    rooms: DashMap<String, Arc<Mutex<Room>>>,
}

// All RoomStore methods...
```

**Benefits:**

- Room lifecycle management separate from individual room logic
- Easier to test room storage independently
- Follows single responsibility principle

### Phase 3: Extract Event Broadcasting

**File:** `crates/mahjong_server/src/network/events.rs`

Move event-related methods from Room impl:

```rust
// events.rs
impl Room {
    pub async fn broadcast_event(&mut self, event: GameEvent, delivery: EventDelivery) {
        // ... existing implementation
    }

    async fn send_to_session(&self, session: &Arc<Mutex<Session>>, event: GameEvent) {
        // ... existing implementation
    }

    fn is_game_ending_event(&self, event: &GameEvent) -> bool {
        // ... existing implementation
    }
}
```

**Benefits:**

- Event handling logic centralized
- Easier to modify broadcasting behavior
- Separates communication concerns

### Phase 4: Extract Command Processing

**File:** `crates/mahjong_server/src/network/commands.rs`

Move command-related methods from Room impl:

```rust
// commands.rs
impl Room {
    pub async fn handle_command(&mut self, command: GameCommand, sender_player_id: &str) -> Result<(), CommandError> {
        // ... existing implementation
    }

    pub async fn handle_bot_command(&mut self, command: GameCommand) -> Result<(), CommandError> {
        // ... existing implementation
    }

    async fn handle_get_analysis_command(&mut self, seat: Seat) -> Result<(), CommandError> {
        // ... existing implementation
    }

    async fn handle_request_hint(&mut self, seat: Seat, verbosity: HintVerbosity) -> Result<(), CommandError> {
        // ... existing implementation
    }
}
```

**Benefits:**

- Command validation and processing isolated
- Easier to add new commands
- Separates business logic from infrastructure

### Phase 5: Extract Analysis Methods

**File:** `crates/mahjong_server/src/network/analysis.rs`

Move analysis-related methods from Room impl:

```rust
// analysis.rs
impl Room {
    async fn run_analysis_for_seat(&mut self, seat: Seat) {
        // ... existing implementation
    }

    fn should_trigger_analysis(&self, event: &GameEvent) -> bool {
        // ... existing implementation
    }

    fn enqueue_analysis(&self, event: GameEvent, delivery: &EventDelivery) {
        // ... existing implementation
    }
}
```

**Benefits:**

- Analysis triggering logic grouped together
- Easier to modify analysis behavior
- Separates analysis concerns

### Phase 6: Core Room Struct

**File:** `crates/mahjong_server/src/network/room.rs` (reduced)

Keep only:

- Room struct definition
- Core lifecycle methods (join, remove_player, etc.)
- Basic getters/setters
- Default impl

**Final size:** ~300-400 lines

## Module Structure

```text
crates/mahjong_server/src/network/
├── mod.rs
├── room.rs           # Core Room struct (~300 lines)
├── room_store.rs     # RoomStore implementation
├── events.rs         # Event broadcasting
├── commands.rs       # Command processing
└── analysis.rs       # Analysis triggering

crates/mahjong_server/src/analysis/
├── mod.rs
└── worker.rs         # Background analysis worker
```

## Implementation Order

1. **Start with analysis/worker.rs** - Low risk, self-contained
2. **Create room_store.rs** - Straightforward extraction
3. **Extract events.rs** - Event logic is cohesive
4. **Extract commands.rs** - Command logic is cohesive
5. **Extract analysis.rs** - Analysis logic is cohesive
6. **Update room.rs** - Remove extracted code, add imports

## Benefits

- **Maintainability:** Each file has a single responsibility
- **Testability:** Smaller units easier to test
- **Parallel Development:** Multiple developers can work on different modules
- **Code Navigation:** Faster to find specific functionality
- **Reusability:** Event/commands/analysis logic could be reused

## Migration Strategy

- Use `#[path]` attributes during transition to avoid breaking imports
- Update imports gradually
- Run tests after each extraction
- Keep backward compatibility during refactoring

## Risk Mitigation

- Extract in small, testable increments
- Maintain all existing tests
- Use feature flags if needed for gradual rollout
- Ensure no performance regression in event broadcasting</content>
  </xai:function_call">The refactoring plan has been saved to `plans/room-refactor-plan.md`. This provides a systematic approach to break down the monolithic `room.rs` file into focused, maintainable modules while preserving functionality and test coverage.
