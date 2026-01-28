# Room.rs Composition Refactor

**Project**: American Mahjong (NMJL) - Rust backend (Axum + WebSocket)

**Current Problem**: `crates/mahjong_server/src/network/room.rs` (914 lines) keeps re-growing after multiple refactors because concerns aren't properly encapsulated. New features get added directly to Room instead of going to the right module.

**Solution Approach**: Use **composition** (dependency injection) instead of more file splitting. Extract responsibility domains into separate manager types that Room *coordinates* but doesn't *contain* directly.

---

## Current Room Structure (Problematic)

Room struct currently mixes:

- **Session management**: `sessions` HashMap, player join/leave
- **Game state**: `table`, `game_started`
- **Analysis/AI**: `analysis_cache`, `analysis_config`, `analysis_hashes`, `analysis_tx`, `debug_mode`, `analysis_log`
- **History/Replay**: `history`, `history_mode`, `current_move_number`, `present_state`, `undo_request`, `last_call_resolution`, `last_called_tile`
- **Pause/Resume**: `paused`, `paused_by`
- **Bot control**: `bot_seats`, `bot_difficulty`, `bot_runner_active`
- **Host controls**: `host_seat`
- **Database**: `db: Option<Database>`

---

## Target Structure

### room.rs (SLIM COORDINATOR)

```rust
pub struct Room {
    room_id: String,
    table: Option<Table>,
    sessions: SessionManager,        // NEW
    analysis: AnalysisManager,       // NEW
    history: HistoryManager,         // NEW
    house_rules: Option<HouseRules>,
    created_at: DateTime<Utc>,
    game_started: bool,
    #[cfg(feature = "database")]
    db: Option<Database>,
}
```

### room/session_manager.rs (NEW)

```rust
pub struct SessionManager {
    sessions: HashMap<Seat, Arc<Mutex<Session>>>,
    bot_seats: HashSet<Seat>,
    host_seat: Option<Seat>,
}
```

**Responsibilities**:

- Track active player sessions per seat
- Manage bot seats and difficulty
- Handle host seat assignment
- Provide iteration over sessions

### room/analysis_manager.rs (NEW)

```rust
pub struct AnalysisManager {
    cache: HashMap<...>,
    config: AnalysisConfig,
    hashes: AnalysisHashState,
    tx: mpsc::Sender<AnalysisRequest>,
    debug_mode: bool,
    log: Vec<...>,
    hint_verbosity: HashMap<Seat, HintVerbosity>,
    pattern_lookup: HashMap<String, Pattern>,
}
```

**Responsibilities**:

- Cache AI analysis results
- Manage analysis request channel
- Track debug/comparison logging
- Store per-player hint verbosity
- Pattern lookup table

### room/history_manager.rs (NEW)

```rust
pub struct HistoryManager {
    history: Vec<MoveHistoryEntry>,
    mode: HistoryMode,
    move_number: u32,
    present_state: Option<GameStateSnapshot>,
    undo_request: Option<UndoRequest>,
    last_call_resolution: Option<CallResolution>,
    last_called_tile: Option<Tile>,
    paused: bool,
    paused_by: Option<Seat>,
}
```

**Responsibilities**:

- Track move history for replay
- Manage undo/redo state
- Handle pause/resume logic
- Maintain time-travel snapshots

---

## Implementation Strategy

### Phase 1: Create Manager Types (2 hours)

1. Create `crates/mahjong_server/src/network/room/` directory
2. Create `room/session_manager.rs` with SessionManager struct & impl
3. Create `room/analysis_manager.rs` with AnalysisManager struct & impl
4. Create `room/history_manager.rs` with HistoryManager struct & impl
5. Move all related methods from Room into their respective managers
6. Create `room/mod.rs` that re-exports Room and the managers

### Phase 2: Update Room Struct (1 hour)

1. Replace struct fields with the three managers
2. Update constructors (`new`, `new_with_rules`, `new_with_db`, `new_with_db_and_rules`)
3. Update Room methods to call manager methods instead of accessing fields directly

### Phase 3: Update All Call Sites (1-2 hours)

- Run `cargo check` to find compilation errors
- Update all Room method calls throughout `crates/mahjong_server/src/` to go through managers
- Files likely to need changes:
  - `crates/mahjong_server/src/network/websocket/room_actions.rs`
  - `crates/mahjong_server/src/network/commands.rs`
  - `crates/mahjong_server/src/network/events.rs`
  - `crates/mahjong_server/tests/*.rs`

### Phase 4: Testing & Validation (30 min)

1. Run `cargo test --package mahjong_server` to ensure no regressions
2. Verify all WebSocket integration tests pass
3. Check that room.rs is < 400 lines (down from 914)

---

## Key Files to Reference

- [crates/mahjong_server/src/network/room.rs](crates/mahjong_server/src/network/room.rs) (914 lines) — The current monolith
- [crates/mahjong_server/src/network/websocket/room_actions.rs](crates/mahjong_server/src/network/websocket/room_actions.rs) (509 lines) — Primary caller of room methods
- [crates/mahjong_server/src/network/room_store.rs](crates/mahjong_server/src/network/room_store.rs) (147 lines) — Room lifecycle management reference
- [crates/mahjong_core/src/history.rs](crates/mahjong_core/src/history.rs) — History/undo data structures

---

## Manager Method Signatures (Guide)

### SessionManager

```rust
pub async fn join(&mut self, seat: Seat, session: Arc<Mutex<Session>>) -> Result<Seat, String>
pub fn remove(&mut self, seat: Seat) -> bool
pub fn get_session(&self, seat: Seat) -> Option<Arc<Mutex<Session>>>
pub fn set_host(&mut self, seat: Seat)
pub fn get_host(&self) -> Option<Seat>
pub fn add_bot(&mut self, seat: Seat, difficulty: Difficulty)
pub fn remove_bot(&mut self, seat: Seat)
pub fn is_bot(&self, seat: Seat) -> bool
pub fn sessions_iter(&self) -> impl Iterator<Item = (Seat, Arc<Mutex<Session>>)>
```

### AnalysisManager

```rust
pub fn set_cache_entry(&mut self, key: String, value: CacheEntry)
pub fn get_cache_entry(&self, key: &str) -> Option<&CacheEntry>
pub fn log_analysis(&mut self, log_entry: LogEntry)
pub fn get_analysis_log(&self) -> &[LogEntry]
pub fn set_verbosity(&mut self, seat: Seat, verbosity: HintVerbosity)
pub fn get_verbosity(&self, seat: Seat) -> HintVerbosity
pub fn get_sender(&self) -> &mpsc::Sender<AnalysisRequest>
pub fn set_debug_mode(&mut self, enabled: bool)
pub fn is_debug_mode(&self) -> bool
```

### HistoryManager

```rust
pub fn add_entry(&mut self, entry: MoveHistoryEntry)
pub fn get_history(&self) -> &[MoveHistoryEntry]
pub fn len(&self) -> usize
pub fn set_undo_request(&mut self, req: UndoRequest)
pub fn get_undo_request(&self) -> Option<&UndoRequest>
pub fn clear_undo_request(&mut self)
pub fn set_paused(&mut self, paused: bool, by: Option<Seat>)
pub fn is_paused(&self) -> bool
pub fn get_paused_by(&self) -> Option<Seat>
pub fn set_history_mode(&mut self, mode: HistoryMode)
pub fn get_history_mode(&self) -> HistoryMode
pub fn get_move_number(&self) -> u32
pub fn set_present_state(&mut self, state: GameStateSnapshot)
pub fn get_present_state(&self) -> Option<&GameStateSnapshot>
```

---

## Acceptance Criteria

- [ ] Three new manager types created with clear responsibility boundaries
- [ ] Room struct reduced from 914 lines to <400 lines (80%+ reduction)
- [ ] All Room constructor variants work without errors
- [ ] `cargo test --package mahjong_server` passes 100%
- [ ] No logic duplication between managers and old code
- [ ] Managers are `pub` so they can be accessed via `room.analysis`, `room.history`, `room.sessions`
- [ ] Code compiles with no warnings
- [ ] New features naturally go into the right manager (not back into Room)

---

## Important Implementation Notes

### 1. Entry Points Matter

The Room struct is not the main entry point for WebSocket operations—`websocket/room_actions.rs` is. Focus on making sure those callers work smoothly with the new managers.

### 2. Reference Semantics

Be careful with `Arc<Mutex<Session>>` cloning and reference patterns. Ensure the new manager interfaces preserve existing async patterns.

### 3. Channel Ownership

The analysis system sends requests on a channel (`analysis_tx`). The AnalysisManager's getter for the sender must not break async patterns or cause lifetime issues.

### 4. History Complexity

History/undo is intricate. Study `crates/mahjong_core/src/history.rs` to understand `HistoryMode` and `MoveHistoryEntry` fully before implementing HistoryManager.

### 5. Bot Testing

Test with bot games—they exercise most room functionality and will catch integration issues quickly.

### 6. Compile-Driven Development

After creating the three manager types and updating the Room struct, run `cargo check` to identify all call-site changes needed before trying to fix them all at once.

---

## How to Use This Plan in a New Session

Copy this file and paste it with this request to a new chat:

> I need to refactor `crates/mahjong_server/src/network/room.rs` using a composition pattern. Here's my detailed plan:
>
> [paste contents of this file]
>
> Please start with Phase 1 and Phase 2 (creating the manager types). We'll handle Phase 3 (updating call sites) once the types are created and compiling.
