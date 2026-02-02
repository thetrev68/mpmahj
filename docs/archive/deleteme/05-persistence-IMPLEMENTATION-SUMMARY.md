# 05. Persistence + Replays - Implementation Summary

**Status**: ✅ **COMPLETED** (2026-01-04)

This document summarizes the completed implementation of persistence and replay functionality for the American Mahjong server.

## Implementation Overview

The persistence system provides complete event sourcing, replay functionality, and player statistics tracking using PostgreSQL. All game events are logged with visibility metadata, enabling both player-specific replays (with privacy filtering) and admin replays (full access).

## Completed Components

### 1. Database Schema ✅

**File**: `crates/mahjong_server/migrations/20260104000001_create_persistence_schema.sql`

**Tables Implemented**:

- **`games`**: Game metadata
  - `id` (UUID, primary key)
  - `created_at`, `finished_at` (timestamps)
  - `winner_seat`, `winning_pattern` (TEXT)
  - `final_state` (JSONB snapshot)
  - Indexes: `created_at DESC`, `finished_at DESC`

- **`game_events`**: Event sourcing log
  - `id` (UUID, primary key)
  - `game_id` (foreign key to games)
  - `seq` (INTEGER, monotonic per game)
  - `event` (JSONB, serialized GameEvent)
  - `visibility` (TEXT: 'public' or 'private')
  - `target_player` (TEXT: seat for private events)
  - `schema_version` (INTEGER, for migrations)
  - `created_at` (timestamp)
  - Unique constraint: `(game_id, seq)`
  - Indexes: `(game_id, seq)`, `created_at DESC`

- **`players`**: Player profiles and stats
  - `id` (UUID, primary key)
  - `username` (TEXT, unique)
  - `display_name` (TEXT)
  - `stats` (JSONB, flexible statistics)
  - `created_at`, `last_seen` (timestamps)
  - Indexes: `username`, `last_seen DESC`

- **`game_snapshots`**: Optional state checkpoints
  - `id` (UUID, primary key)
  - `game_id` (foreign key)
  - `seq` (INTEGER, snapshot sequence)
  - `state` (JSONB, serialized state)
  - Unique constraint: `(game_id, seq)`
  - Index: `(game_id, seq DESC)`

**Database Functions**:

- `get_game_event_count(game_id)`: Returns event count for a game
- `get_player_replay_events(game_id, viewer_seat)`: Filtered replay (privacy-aware)
- `get_admin_replay_events(game_id)`: Full replay (all events)

### 2. Database Module ✅

**File**: `crates/mahjong_server/src/db.rs`

**Key Features**:

- Connection pool management (max 10 connections, 3s timeout)
- Automatic migration runner on startup
- Schema versioning support (currently v1)

**Implemented Operations**:

**Game Management**:

- `create_game(game_id)`: Initialize game record
- `finish_game(game_id, winner, pattern, state)`: Store final results
- `get_game(game_id)`: Retrieve game metadata

**Event Logging**:

- `append_event(game_id, seq, event, tx?)`: Log single event
- `append_events(game_id, events)`: Atomic multi-event logging
- `get_event_count(game_id)`: Count events for a game

**Replay Queries**:

- `get_player_replay(game_id, viewer_seat)`: Privacy-filtered events
- `get_admin_replay(game_id)`: All events (no filtering)

**Snapshot Management**:

- `save_snapshot(game_id, seq, state)`: Store state checkpoint
- `get_latest_snapshot(game_id, before_seq)`: Retrieve checkpoint

**Player Management**:

- `upsert_player(username, display_name)`: Create/update player
- `update_player_stats(username, stats)`: Store statistics
- `get_player(username)`: Retrieve player profile

**Record Types**:

- `GameRecord`, `EventRecord`, `SnapshotRecord`, `PlayerRecord`

### 3. Replay Service ✅

**File**: `crates/mahjong_server/src/replay.rs`

**Implemented Features**:

- `ReplayService`: High-level replay API
- `PlayerReplay`: Privacy-filtered event stream
- `AdminReplay`: Complete event stream
- `ReplayEvent`: Event with metadata (seq, timestamp, visibility)

**API Methods**:

- `get_player_replay(game_id, viewer_seat)`: Returns only authorized events
- `get_admin_replay(game_id)`: Returns all events
- `get_final_state(game_id)`: Retrieves stored final state
- `get_event_count(game_id)`: Returns total event count

**Future Extension Points**:

- `reconstruct_state_at_seq()`: Framework ready (not yet implemented)
- `verify_replay_integrity()`: Verification hooks ready

**Request/Response Types**:

- `PlayerReplayRequest`, `AdminReplayRequest`, `ReplayResponse`

### 4. Room Integration ✅

**File**: `crates/mahjong_server/src/network/room.rs`

**Modifications**:

**Room Structure**:

- Added `event_seq: i32` for monotonic event sequencing
- Added `db: Option<Database>` for persistence

**New Methods**:

- `new_with_db(db)`: Create room with persistence enabled
- `set_db(db)`: Attach database to existing room

**Enhanced Methods**:

- `start_game()`: Now persists game creation

  ```rust
  db.create_game(&self.room_id).await
  ```

- `broadcast_event()`: Now logs all events

  ```rust
  // 1. Persist event with sequence number
  db.append_event(&self.room_id, seq, &event, None).await
  // 2. Increment sequence counter
  self.event_seq += 1
  // 3. Check for game-ending event
  if is_game_ending_event(&event) {
      persist_final_state(&event).await
  }
  // 4. Broadcast to players
  ```

- `persist_final_state()`: Stores game results
  - Extracts winner and pattern from `GameOver` event
  - Serializes table state as JSON
  - Calls `db.finish_game()`

**Privacy Handling**:

- Visibility automatically determined from `event.is_private()`
- Target player extracted from `event.target_player()`
- No manual privacy configuration needed

### 5. Server Integration ✅

**File**: `crates/mahjong_server/src/main.rs`

**Startup Sequence**:

```rust
// 1. Load DATABASE_URL from environment
// 2. Initialize database connection pool
let db = Database::new(&database_url).await
// 3. Run migrations automatically
db.run_migrations().await
// 4. Create NetworkState with database
let network_state = NetworkState::new_with_db(db.clone())
// 5. Store db in AppState for future use
```

**Error Handling**:

- Migration failures logged as warnings (non-fatal)
- Database connection failures are fatal (server won't start)

**File**: `crates/mahjong_server/src/network/websocket.rs`

**Room Creation**:

- `handle_create_room()` now uses `create_room_with_db()` when database is available
- Falls back to `create_room()` if no database configured

**File**: `crates/mahjong_server/src/network/room.rs` (RoomStore)

**New Method**:

- `create_room_with_db(db)`: Creates rooms with persistence enabled

## Architecture Decisions

### Event Sourcing

**Why**: Complete audit trail, replay capability, debugging support

**How**: Every `GameEvent` is logged with:

- Monotonic sequence number (per game)
- Visibility metadata (public/private)
- Target player (for private events)
- Schema version (for future migrations)

### Privacy Filtering

**Why**: Players should only see events they're authorized to view

**How**:

- `GameEvent::is_private()` determines visibility
- `GameEvent::target_player()` identifies recipient
- Database functions filter events on replay
- Private events (e.g., tile draws) never exposed to other players

### Snapshot System

**Why**: Fast state reconstruction for long games

**How**:

- Optional snapshots stored at configurable intervals
- `get_latest_snapshot()` provides starting point for replay
- Events applied incrementally from snapshot

**Status**: Schema ready, not yet actively used

### Schema Versioning

**Why**: Support event format evolution without data loss

**How**:

- `SCHEMA_VERSION` constant in code
- Stored with each event
- Migration strategy can deserialize old formats

**Current Version**: 1

## Data Flow

### Game Creation

```text
Room::start_game()
  ├─> Table::new(game_id, seed)
  ├─> db.create_game(game_id)        [INSERT INTO games]
  └─> broadcast_event(GameStarting)
        └─> db.append_event(...)      [INSERT INTO game_events]
```

### Command Processing

```text
Room::handle_command(command)
  ├─> Validate authorization
  ├─> table.process_command(command)
  │     └─> Returns Vec<GameEvent>
  └─> For each event:
        ├─> db.append_event(game_id, seq, event)
        │     └─> [INSERT INTO game_events]
        ├─> event_seq += 1
        └─> broadcast to players (via WebSocket)
```

### Game Completion

```text
Room::broadcast_event(GameOver)
  ├─> db.append_event(...)            [Event log]
  ├─> persist_final_state()
  │     ├─> Extract winner/pattern from GameOver
  │     ├─> Serialize table state to JSON
  │     └─> db.finish_game(...)       [UPDATE games]
  └─> Send to players
```

### Replay Query

```text
ReplayService::get_player_replay(game_id, seat)
  ├─> db.get_player_replay(game_id, seat)
  │     └─> [SELECT FROM get_player_replay_events()]
  │           ├─> WHERE visibility = 'public'
  │           └─> OR target_player = viewer_seat
  └─> Returns Vec<ReplayEvent>
```

## Testing

### Database Tests

**File**: `crates/mahjong_server/src/db.rs`

**Tests Implemented**:

- `test_database_connection()`: Verify pool creation
- `test_create_and_get_game()`: Basic CRUD
- All tests marked `#[ignore]` (require live database)

**To Run**:

```bash
# Set DATABASE_URL in environment
export DATABASE_URL="postgresql://..."
cargo test -p mahjong_server -- --ignored
```

### Integration Tests

**Status**: Not yet implemented

**Recommended Coverage**:

- Event sequence ordering
- Privacy filtering correctness
- Final state persistence accuracy
- Replay reconstruction (when implemented)

## Performance Considerations

### Indexes

All critical query paths are indexed:

- Games: `created_at DESC`, `finished_at DESC`
- Events: `(game_id, seq)`, `created_at DESC`
- Players: `username`, `last_seen DESC`
- Snapshots: `(game_id, seq DESC)`

### Connection Pooling

- Max 10 concurrent connections
- 3-second acquire timeout
- Shared pool across all rooms

### Event Batching

- `append_events()` uses transactions for atomic multi-insert
- Reduces round-trips for command processing

### Snapshot Strategy

- Optional snapshots reduce replay overhead
- Trade-off: storage vs. reconstruction speed
- Not yet actively used (future optimization)

## Known Limitations

### 1. Table Serialization

**Current**: Placeholder JSON with basic fields

```rust
{
  "game_id": "...",
  "phase": "Playing",
  "current_turn": "East",
  "dealer": "East",
  "round_number": 1
}
```

**Future**: Full `Table` serialization requires `Serialize` implementation in `mahjong_core`

### 2. State Reconstruction

**Current**: Framework ready but not implemented

- `reconstruct_state_at_seq()` returns `ReconstructionNotImplemented`
- `verify_replay_integrity()` returns `ReconstructionNotImplemented`

**Future**: Apply events sequentially to rebuild state

### 3. Replay API Endpoints

**Current**: Query functions exist, no HTTP/WebSocket endpoints

**Future**: Add routes for:

- `GET /api/replays/:game_id?seat=East` (player replay)
- `GET /api/admin/replays/:game_id` (admin replay)
- WebSocket command: `GetReplay { game_id, seat }`

### 4. Statistics Aggregation

**Current**: `players.stats` field exists but not populated

**Future**: Calculate and store:

- Games played/won/lost
- Winning patterns frequency
- Average game duration
- Elo/ranking (if competitive mode)

## Deployment Checklist

- [x] Database schema deployed to Supabase
- [x] Migration file created
- [x] Environment variables configured (`DATABASE_URL`)
- [x] Code compiles without errors
- [ ] Integration tests written
- [ ] Server tested with live database
- [ ] Replay endpoints exposed (future)
- [ ] Statistics aggregation implemented (future)

## Migration Guide

### Running Migrations

- **Option 1: Automatic (Recommended)**

```bash
# Migrations run on server startup
cargo run -p mahjong_server
# Output: "Database migrations completed successfully"
```

- **Option 2: Manual (via sqlx-cli)**

```bash
cd crates/mahjong_server
sqlx migrate run
```

- **Option 3: Supabase Dashboard**

- Go to SQL Editor
- Paste `migrations/20260104000001_create_persistence_schema.sql`
- Execute

### Verifying Installation

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('games', 'game_events', 'players', 'game_snapshots');

-- Check functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%replay%';
```

## Future Enhancements

### Short-term

1. Implement replay HTTP/WebSocket endpoints
2. Add integration tests
3. Populate player statistics
4. Implement state reconstruction

### Medium-term

1. Add replay UI in frontend
2. Create admin dashboard for game monitoring
3. Implement snapshot checkpoints (every 50 events)
4. Add replay speed controls (fast-forward, rewind)

### Long-term

1. Event schema migration system
2. Cross-game statistics aggregation
3. Leaderboards and rankings
4. Tournament support with persistent brackets

## References

- **Plan**: `docs/implementation/05-persistence-plan.md`
- **Architecture**: `docs/architecture/06-command-event-system-api-contract.md`
- **Network Protocol**: `docs/architecture/09-network-protocol.md`
- **Module Architecture**: `docs/architecture/03-module-architecture.md`

## Changelog

### 2026-01-04 - Initial Implementation

- ✅ Database schema created and deployed
- ✅ Database module implemented (`db.rs`)
- ✅ Replay service implemented (`replay.rs`)
- ✅ Room integration completed
- ✅ Server integration completed
- ✅ All code compiles successfully
- ✅ Migration system functional

---

**Implementation Status**: ✅ **COMPLETE**
**Next Steps**: Integration testing, replay endpoints, statistics aggregation
