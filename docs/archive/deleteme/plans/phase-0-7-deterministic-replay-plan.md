# Phase 0.7: Deterministic Replay Inputs - Detailed Implementation Plan

**Status:** PLANNED

**Created:** 2026-01-07

**Updated:** 2026-01-08 (Applied Phase 0.6 best practices)

**Goal:** Ensure replay and undo/time-travel are deterministic by persisting complete wall state, RNG seeds, and all randomization inputs. This enables exact game state reconstruction from event logs for the History Viewer & Time Travel feature (Section 1 of Gap Analysis).

**Note:** Line numbers mentioned in this document are approximate as of 2026-01-08. Use search patterns (provided throughout) to locate code if line numbers have shifted.

## Key Points (Read First!)

**Scope - Specific Numbers:**

- **2 new Wall fields**: `seed: u64` and `break_point: usize`
- **1 new event type**: `ReplacementDrawn` with `ReplacementReason` enum
- **4 new snapshot fields**: `wall_seed`, `wall_draw_index`, `wall_break_point`, `wall_tiles_remaining`
- **2 new Table methods**: `from_snapshot()` and `apply_event()`
- **3 new database methods**: `record_snapshot()`, `get_snapshot_at()`, `get_events_range()`
- **2 database migrations**: Add wall state columns + create snapshots table
- **3 test files**: `wall_state_persistence.rs`, `replacement_draw_events.rs`, `replay_reconstruction.rs`
- **8+ tests minimum**: Wall determinism, replacement draws, snapshot restoration, replay integrity

**Critical constraints for implementer:**

1. **Wall state is already partially implemented** - `Wall` struct exists with `from_deck_with_seed()` method
2. **Wall has NO `seed` field yet** - Need to add `seed: u64` and `break_point: usize` fields for replay
3. **Replacement draws need NEW event** - Kong/Quint draws currently implicit, must add `ReplacementDrawn` event
4. **Table has NO `apply_event()` method** - Need to create this for replay reconstruction (inverse of command processing)
5. **Snapshots table doesn't exist** - Need migration to create `snapshots` table with proper indexing
6. **Phase boundaries for snapshots** - Snapshot at 3 event types: `PhaseChanged`, `CharlestonComplete`, `GameOver` (expect 5 snapshots per game)
7. **Raw event log for replay** - Reconstruction must use unfiltered events, not player-filtered streams
8. **Breaking change** - `Wall::from_deck()` signature changes (expect 1-2 call sites to update)

**Search patterns you'll need:**

- `pub struct Wall` → Add 2 fields (seed, break_point)
- `pub fn from_deck(` → Update signature (1-2 locations)
- `GameEvent::ReplacementDrawn` → New variant to add
- `impl Table` → Add 2 methods (from_snapshot, apply_event)
- `pub fn broadcast_event` → Add snapshot recording logic (1 location in room.rs)
- `CallResolution::Meld { seat, meld } =>` → Add replacement draw logic (1 location in playing.rs)

## Overview

This phase implements the foundational infrastructure for two key features described in the Backend Gap Analysis:

1. **History Viewer & Time Travel** (Gap Analysis §1): Full move history with snapshot-based time travel
2. **Deterministic Replay** (Gap Analysis §5.3): Exact game reconstruction from event logs

Unlike traditional undo (which just pops a stack), this implements **time travel** - the ability to jump to any point in game history, view the exact state, and optionally resume from that point (invalidating future moves).

## Relationship to Gap Analysis

**From [13-backend-gap-analysis.md](13-backend-gap-analysis.md):**

### Section 1: History Viewer & Time Travel

This phase provides the **backend foundation**:

- **Move History Storage**: Comprehensive event log with snapshots
- **State Restoration**: Jump to any historical point with full accuracy
- **Deterministic Playback**: Guarantee exact tile order/draws reproduce

**Frontend features (not in this phase):**

- History panel UI with move descriptions
- Playback controls (step forward/backward, play/pause)
- Mode indicators and confirmation dialogs

### Section 5.3: Replay System Integration

This phase implements:

- **Basic Replay**: Event log storage and reconstruction
- **Deterministic State Capture**: Wall order, RNG seeds, replacement draws
- **Replay Integrity**: Exact final state reproduction

**Future enhancements (not in this phase):**

- Filtered replay (player perspective)
- "What-If" branching analysis
- Replay viewer UI

## Current State Analysis

### Existing Infrastructure

| Component         | Status           | Details                                                                                           |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| Event recording   | ✅ Exists        | Server persists all events to database ([`db.rs:record_event`](crates/mahjong_server/src/db.rs))  |
| Replay service    | ✅ Exists        | Player-filtered and admin replay endpoints ([`replay.rs`](crates/mahjong_server/src/replay.rs))   |
| Wall/Deck shuffle | ✅ Deterministic | `Deck::shuffle_with_seed()` accepts u64 seed ([`deck.rs:76`](crates/mahjong_core/src/deck.rs:76)) |
| Table creation    | ✅ Has seed      | `Table::new()` takes seed parameter ([`table.rs`](crates/mahjong_core/src/table.rs))              |
| State snapshots   | ✅ Exists        | `GameStateSnapshot` captures player view ([`snapshot.rs`](crates/mahjong_core/src/snapshot.rs))   |

### What Works

**Replay system is 80% complete:**

- ✅ Events are stored in database with sequence numbers
- ✅ Replay service can fetch event streams (player-filtered or admin)
- ✅ Wall shuffle is deterministic when seeded
- ✅ Tests use `seed=0` for reproducibility

### What's Missing

**Critical gaps for deterministic replay:**

1. **No wall state persistence** - Wall order and draw position not stored
2. **No seed in snapshots** - Can't reproduce wall from saved state
3. **No break point tracking** - Don't know where "the break" occurred
4. **No replacement draw log** - Kong/Quint replacement draws not recorded
5. **Tests use seed=0** - Replay reconstruction hardcoded to wrong seed
6. **No snapshot compression** - Full snapshots would bloat storage (addressed via strategy)

### Gap Analysis

The current replay system can **play back events** but cannot **reconstruct exact state** because:

- Wall tile order is lost (can't reproduce "drew Tile(42)" deterministically)
- RNG state is not captured (can't reproduce tie-breaks, randomized auto-selections)
- Replacement draws are implicit (Kong draw mechanics not logged explicitly)

**Example failure case:**

```rust
// Game 1: Seed 12345
let wall = Wall::from_seed(12345);
player.draw(); // Gets Tile(17)

// Replay: Seed 0 (wrong!)
let replay_wall = Wall::from_seed(0);
player.draw(); // Gets Tile(92) - WRONG!
```text

---

## Design Decisions

### Snapshot Strategy: Periodic + Phase Boundaries

**Goal:** Balance storage efficiency with fast access

**Approach:**

- **Full snapshots**: At phase boundaries (Charleston → Playing, Playing → Scoring, etc.)
- **Event-based reconstruction**: Between snapshots (apply events to last snapshot)
- **No incremental deltas**: Full snapshots are compact enough (~2-5 KB each)

**Rationale:**

From Gap Analysis §1.3:

> **Memory Optimization:**
>
> - Store full snapshots for every Nth move (e.g., every 10th)
> - For intermediate moves, store deltas or reconstruct from events
> - Keep full snapshots at phase boundaries

We choose phase boundaries because:

- Games have 3-5 phases (Charleston → Playing → Scoring)
- Most time-travel jumps are to phase starts ("back to start of Charleston")
- Phase boundaries are natural "save points" for players

**Storage estimate (per game):**

- 5 phase boundary snapshots × 3 KB = 15 KB
- 150-300 event records × 500 bytes = 75-150 KB
- **Total: ~100-200 KB per game** (acceptable for database storage)

### Wall State Persistence

**Three components must be persisted:**

1. **RNG seed** (`u64`) - Reproduces wall order
2. **Break point** (`u8`) - Tile index where dealing starts
3. **Current draw index** (`usize`) - Next tile to draw

**Implementation:**

```rust
pub struct Wall {
    pub tiles: Vec<Tile>,      // Existing
    pub draw_index: usize,     // Existing
    pub seed: u64,             // NEW: RNG seed used to shuffle
    pub break_point: u8,       // NEW: Starting position (default 0)
}
```text

**Why this works:**

- Given `seed`, we can recreate `tiles` via `Deck::shuffle_with_seed(seed)`
- Given `break_point`, we know where dealing started
- Given `draw_index`, we know how many tiles have been drawn

**Trade-off:** Store 16 bytes (seed + break_point + draw_index) instead of 152 tiles × 1 byte = 152 bytes. **Savings: 90%.**

### Replacement Draw Logging

**Challenge:** Kong/Quint declarations trigger replacement draws, but these aren't explicitly logged.

**Solution:** Add `ReplacementDrawn` event

```rust
GameEvent::ReplacementDrawn {
    player: Seat,
    tile: Tile,
    reason: ReplacementReason, // Kong, Quint, BlankExchange
}
```text

**When emitted:**

- After `apply_call_tile()` for Kong/Quint
- After `apply_exchange_blank()` for blank replacement
- Before `TurnChanged` (replacement is part of the turn)

**Privacy:** Tile value is **private** (only visible to drawing player), similar to `TileDrawn`.

### Replay Reconstruction Algorithm

**Goal:** Reproduce exact state at sequence N

**Algorithm:**

```text
1. Fetch snapshot at or before sequence N
2. Initialize Table from snapshot (wall seed, draw_index, phase, etc.)
3. Fetch events from (snapshot.sequence + 1) to N
4. Apply events sequentially to Table
5. Verify final state matches expected snapshot (if one exists at N)
```text

**Example:**

- Snapshot at seq 0 (game start)
- Snapshot at seq 50 (Charleston complete)
- Snapshot at seq 150 (Playing complete)
- Want state at seq 75: Load snapshot 50, apply events 51-75

### Undo vs. Time Travel

**Gap Analysis distinguishes two modes:**

> **Two modes:**
>
> - **View mode:** Browsing history (read-only, game paused)
> - **Resume mode:** Jump to a point and resume playing from there (invalidates future moves)

**Implementation:**

- **View mode**: Reconstruct state, mark `Table` as read-only (all commands return error)
- **Resume mode**: Reconstruct state, truncate event log after jump point, allow commands

**Server-side flag:**

```rust
pub struct Room {
    pub table: Option<Table>,
    pub history_mode: HistoryMode, // NEW
}

pub enum HistoryMode {
    Live,                           // Normal gameplay
    Viewing { at_sequence: u64 },   // Read-only time travel
}
```text

---

## Implementation Steps

**Note:** Line numbers are approximate. Search for function/struct names if they've shifted.

### 0.7.1: Core - Add Wall State Fields

**File:** [`crates/mahjong_core/src/deck.rs`](crates/mahjong_core/src/deck.rs)

**Search for:** `pub struct Wall {` (currently around line 102)

**Extend `Wall` struct to add seed and break_point tracking:**

```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct Wall {
    tiles: Vec<Tile>,  // Already private (good!)
    dead_wall_size: usize,  // Already exists

    /// RNG seed used to shuffle the deck (for deterministic replay).
    /// ADD THIS FIELD
    pub seed: u64,

    /// The break point (stacks/tiles reserved as dead wall). Persisted for replay.
    /// CHANGE: Make this persistable (currently only used for dead_wall_size)
    pub break_point: usize,
}
```text

**Search for:** `pub fn from_deck(` (currently around line 108)

**Update `Wall::from_deck()` to track seed:**

```rust
impl Wall {
    // EXISTING METHOD - UPDATE to accept seed parameter
    pub fn from_deck(deck: Deck, break_point: usize, seed: u64) -> Self {
        Wall {
            tiles: deck.tiles,
            dead_wall_size: break_point * 2,
            seed,  // ADD THIS
            break_point,  // ADD THIS (was only used for calculation before)
        }
    }

    // EXISTING METHOD - UPDATE to accept and pass seed
    pub fn from_deck_with_seed(seed: u64, break_point: usize) -> Self {
        let mut deck = Deck::new();
        deck.shuffle_with_seed(seed);
        Self::from_deck(deck, break_point, seed)  // Now passes seed
    }

    // ADD NEW helper methods for testing/replay
    /// Reconstruct wall from seed with default break point (for tests)
    pub fn from_seed(seed: u64) -> Self {
        Self::from_deck_with_seed(seed, 0)  // Use existing method
    }
}
```text

**Breaking change:** `Wall::from_deck()` now requires `seed` parameter.

**Update locations** (verify with grep):

```bash
grep -rn "Wall::from_deck(" crates/mahjong_core/
```text

Expected: 1-2 locations (mostly tests use `from_deck_with_seed` already)

**For each location found, add seed parameter:**

```rust
// Before:
let wall = Wall::from_deck(deck, break_point);

// After:
let wall = Wall::from_deck(deck, break_point, seed);
```text

---

### 0.7.2: Core - Add Replacement Draw Event

**File:** [`crates/mahjong_core/src/event.rs`](crates/mahjong_core/src/event.rs)

**Search for:** `pub enum GameEvent {` to find the event enum

**Add new event variant and reason enum:**

```rust
/// Reason for a replacement draw.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum ReplacementReason {
    /// Drew replacement after declaring Kong.
    Kong,
    /// Drew replacement after declaring Quint.
    Quint,
    /// Drew replacement after exchanging blank tile.
    BlankExchange,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum GameEvent {
    // ... existing variants ...

    /// Player drew a replacement tile (Kong, Quint, or blank exchange).
    /// This is distinct from normal TileDrawn to track replacement draws explicitly.
    ReplacementDrawn {
        player: Seat,
        tile: Tile,
        reason: ReplacementReason,
    },
}
```text

**Note:** `ReplacementDrawn` is a PRIVATE event (tile value visible only to drawing player).

**Search for:** `pub fn is_private(&self) -> bool {` (the current codebase uses `is_private`, NOT `is_public`)

**Add `ReplacementDrawn` to the private event matches:**

```rust
pub fn is_private(&self) -> bool {
    matches!(
        self,
        GameEvent::TileDrawn { .. }
            | GameEvent::HandDealt { .. }
            | GameEvent::TilesReceived { .. }
            | GameEvent::ReplacementDrawn { .. }  // ADD THIS - tile value is private
            // ... other private events ...
    )
}
```text

**Search for:** `pub fn is_for_seat(&self, seat: Seat) -> bool {`

**Add `ReplacementDrawn` handling to seat-specific visibility:**

```rust
pub fn is_for_seat(&self, seat: Seat) -> bool {
    match self {
        GameEvent::TileDrawn { player, .. } => *player == seat,
        GameEvent::ReplacementDrawn { player, .. } => *player == seat,
        GameEvent::HandDealt { player, .. } => *player == seat,
        GameEvent::TilesReceived { player, .. } => *player == seat,
        _ => false,
    }
}
```text

---

### 0.7.3: Core - Emit Replacement Draw Events

**File:** [`crates/mahjong_core/src/table/handlers/playing.rs`](crates/mahjong_core/src/table/handlers/playing.rs)

**Search for:** `CallResolution::Meld { seat, meld } =>` (currently around line 247)

**This is where meld calls are processed. Add replacement draw logic AFTER meld is exposed:**

```rust
crate::call_resolution::CallResolution::Meld { seat, meld } => {
    // Process the meld call
    // Remove called tile from discard pile
    if table.discard_pile.last().map(|d| d.tile) == Some(tile) {
        table.discard_pile.pop();
    }

    // Add meld to player's exposed melds
    if let Some(p) = table.get_player_mut(seat) {
        let _ = p.hand.expose_meld(meld.clone());
    }

    events.push(GameEvent::TileCalled {
        player: seat,
        meld,
        called_tile: tile,
    });

    // ADD THIS SECTION - Check if Kong/Quint requires replacement draw
    let needs_replacement = matches!(meld, Meld::Kong(_) | Meld::Quint(_));

    if needs_replacement {
        // Draw replacement tile from wall
        if let Some(replacement_tile) = table.wall.draw() {
            // Add to player's hand
            if let Some(p) = table.get_player_mut(seat) {
                p.hand.add_tile(replacement_tile);
            }

            // Determine reason based on meld type
            let reason = match meld {
                Meld::Kong(_) => crate::event::ReplacementReason::Kong,
                Meld::Quint(_) => crate::event::ReplacementReason::Quint,
                _ => unreachable!(),
            };

            // Emit replacement draw event (private - only for drawing player)
            events.push(GameEvent::ReplacementDrawn {
                player: seat,
                tile: replacement_tile,
                reason,
            });
        } else {
            // Wall exhausted during replacement draw
            events.push(GameEvent::WallExhausted {
                remaining_tiles: table.wall.remaining(),
            });
            // Note: Wall exhaustion handling should trigger game end
            // For now, continue with turn transition
        }
    }
    // END NEW SECTION

    // Transition to Discarding stage for caller
    // ... rest of existing code ...
}
```text

**Why here:** This is where melds are created after winning a call. Kong/Quint melds trigger immediate replacement draws before the player discards.

**Note:** Blank exchange is NOT implemented yet (Phase 0.3 deferred it). When it is implemented, add similar logic with `ReplacementReason::BlankExchange`.

---

### 0.7.4: Core - Add Wall State to Snapshot

**File:** [`crates/mahjong_core/src/snapshot.rs`](crates/mahjong_core/src/snapshot.rs) (around line 30)

**Extend `GameStateSnapshot`:**

```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct GameStateSnapshot {
    pub game_id: String,
    pub phase: GamePhase,
    pub house_rules: HouseRules,
    pub players: Vec<PlayerView>,
    pub viewer_seat: Seat,
    pub discard_pile: Vec<DiscardedTile>,
    pub current_turn: Option<Seat>,
    pub charleston_state: Option<CharlestonState>,

    /// Wall state for deterministic replay.
    pub wall_seed: u64,
    pub wall_draw_index: usize,
    pub wall_break_point: u8,
    pub wall_tiles_remaining: usize,
}
```text

**Update `Table::create_snapshot()` (around line 80):**

```rust
pub fn create_snapshot(&self, viewer_seat: Seat) -> GameStateSnapshot {
    // ... existing player view logic ...

    GameStateSnapshot {
        game_id: self.game_id.clone(),
        phase: self.phase.clone(),
        house_rules: self.house_rules.clone(),
        players: player_views,
        viewer_seat,
        discard_pile: self.discard_pile.clone(),
        current_turn: self.current_turn(),
        charleston_state: self.charleston_state.clone(),

        // Wall state
        wall_seed: self.wall.seed,
        wall_draw_index: self.wall.draw_index,
        wall_break_point: self.wall.break_point,
        wall_tiles_remaining: self.wall.tiles.len() - self.wall.draw_index,
    }
}
```text

**Add restoration method:**

```rust
impl Table {
    /// Restore table from a snapshot (for replay/undo).
    pub fn from_snapshot(snapshot: GameStateSnapshot, validator: HandValidator) -> Self {
        let wall = Wall::from_seed_with_break(
            snapshot.wall_seed,
            snapshot.wall_break_point,
        );

        // Restore wall draw index
        let mut wall = wall;
        wall.draw_index = snapshot.wall_draw_index;

        // Reconstruct players from snapshot
        // NOTE: Snapshot only has viewer's hand, others reconstructed from events
        let mut players = HashMap::new();
        for player_view in snapshot.players {
            let player = Player {
                name: player_view.name.clone(),
                seat: player_view.seat,
                is_bot: player_view.is_bot,
                hand: Hand::new(), // Will be populated by event replay
                melds: player_view.exposed_melds.clone(),
                status: PlayerStatus::Ready, // Or from snapshot if added
            };
            players.insert(player_view.seat, player);
        }

        Table {
            game_id: snapshot.game_id.clone(),
            phase: snapshot.phase,
            house_rules: snapshot.house_rules,
            players,
            wall,
            discard_pile: snapshot.discard_pile,
            charleston_state: snapshot.charleston_state,
            validator,
            ..Table::default() // Use defaults for missing fields
        }
    }
}
```text

---

### 0.7.5: Server - Store Wall State in Database

**File:** [`crates/mahjong_server/src/db.rs`](crates/mahjong_server/src/db.rs)

**Update `finish_game()` to include wall state (around line 264):**

```rust
pub async fn finish_game(
    &self,
    game_id: &str,
    final_state: &GameStateSnapshot,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE games
        SET finished_at = NOW(),
            final_state = $2,
            card_year = $3,
            timer_mode = $4,
            wall_seed = $5,
            wall_break_point = $6
        WHERE game_id = $1
        "#,
        game_id,
        serde_json::to_value(final_state).unwrap(),
        final_state.house_rules.ruleset.card_year as i32,
        serde_json::to_value(&final_state.house_rules.ruleset.timer_mode).unwrap(),
        final_state.wall_seed as i64,
        final_state.wall_break_point as i16,
    )
    .execute(&self.pool)
    .await?;
    Ok(())
}
```text

**Add migration for new columns:**

**File:** [`crates/mahjong_server/migrations/YYYYMMDD_add_wall_state.sql`](crates/mahjong_server/migrations/) (new file)

```sql
-- Add wall state columns for deterministic replay

ALTER TABLE games ADD COLUMN IF NOT EXISTS wall_seed BIGINT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS wall_break_point SMALLINT;

-- Index for replay queries
CREATE INDEX IF NOT EXISTS idx_games_wall_state ON games(game_id, wall_seed);
```text

**Update schema documentation:**

**File:** [`crates/mahjong_server/schema.sql`](crates/mahjong_server/schema.sql) (around line 15)

```sql
CREATE TABLE games (
    game_id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE,
    final_state JSONB,
    card_year INTEGER,
    timer_mode JSONB,
    wall_seed BIGINT,        -- NEW
    wall_break_point SMALLINT -- NEW
);
```text

---

### 0.7.6: Server - Periodic Snapshot Recording

**File:** [`crates/mahjong_server/src/network/room.rs`](crates/mahjong_server/src/network/room.rs) (around line 79)

**Extend `Room` struct:**

```rust
pub struct Room {
    pub room_id: String,
    pub table: Option<Table>,
    pub sessions: HashMap<Seat, Arc<Mutex<Session>>>,
    pub db: Option<Arc<Database>>,
    pub event_seq: u64,

    /// Last snapshot sequence number.
    pub last_snapshot_seq: u64,
}
```text

**Add snapshot recording logic (around line 400 in `broadcast_event`):**

```rust
async fn broadcast_event(&mut self, event: GameEvent) {
    // Record event
    if let Some(db) = &self.db {
        self.event_seq += 1;
        if let Err(e) = db.record_event(&self.room_id, self.event_seq, &event).await {
            tracing::error!("Failed to persist event: {}", e);
        }
    }

    // Check if we should snapshot (at phase boundaries)
    let should_snapshot = matches!(
        event,
        GameEvent::PhaseChanged { .. }
            | GameEvent::CharlestonComplete
            | GameEvent::GameOver { .. }
    );

    if should_snapshot {
        if let Some(table) = &self.table {
            if let Some(db) = &self.db {
                // Create snapshot for admin view (arbitrary seat)
                let snapshot = table.create_snapshot(Seat::East);

                if let Err(e) = db.record_snapshot(&self.room_id, self.event_seq, &snapshot).await {
                    tracing::error!("Failed to persist snapshot: {}", e);
                } else {
                    self.last_snapshot_seq = self.event_seq;
                    tracing::debug!(
                        "Recorded snapshot at seq {} for phase {:?}",
                        self.event_seq,
                        snapshot.phase
                    );
                }
            }
        }
    }

    // ... existing broadcast logic ...
}
```text

**Add database method for snapshot storage:**

**File:** [`crates/mahjong_server/src/db.rs`](crates/mahjong_server/src/db.rs) (around line 280)

```rust
/// Record a game state snapshot at a specific sequence number.
pub async fn record_snapshot(
    &self,
    game_id: &str,
    sequence: u64,
    snapshot: &GameStateSnapshot,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO snapshots (game_id, sequence, snapshot_data, created_at)
        VALUES ($1, $2, $3, NOW())
        "#,
        game_id,
        sequence as i64,
        serde_json::to_value(snapshot).unwrap(),
    )
    .execute(&self.pool)
    .await?;
    Ok(())
}

/// Get the latest snapshot at or before a sequence number.
pub async fn get_snapshot_at(
    &self,
    game_id: &str,
    sequence: u64,
) -> Result<Option<(u64, GameStateSnapshot)>, sqlx::Error> {
    let record = sqlx::query!(
        r#"
        SELECT sequence, snapshot_data
        FROM snapshots
        WHERE game_id = $1 AND sequence <= $2
        ORDER BY sequence DESC
        LIMIT 1
        "#,
        game_id,
        sequence as i64,
    )
    .fetch_optional(&self.pool)
    .await?;

    match record {
        Some(r) => {
            let snapshot: GameStateSnapshot = serde_json::from_value(r.snapshot_data)?;
            Ok(Some((r.sequence as u64, snapshot)))
        }
        None => Ok(None),
    }
}
```text

**Add migration for snapshots table:**

**File:** [`crates/mahjong_server/migrations/YYYYMMDD_create_snapshots.sql`](crates/mahjong_server/migrations/) (new file)

```sql
-- Create snapshots table for periodic game state snapshots

CREATE TABLE IF NOT EXISTS snapshots (
    snapshot_id SERIAL PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    sequence BIGINT NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(game_id, sequence)
);

-- Index for fast lookup of latest snapshot before a sequence
CREATE INDEX idx_snapshots_game_seq ON snapshots(game_id, sequence DESC);
```text

---

### 0.7.7: Server - Replay Reconstruction with Wall State

**File:** [`crates/mahjong_server/src/replay.rs`](crates/mahjong_server/src/replay.rs) (around line 115)

**Update `reconstruct_state_at()` to use snapshots and unfiltered events:**

```rust
/// Reconstruct game state at a specific sequence number.
/// Uses nearest snapshot and replays events from there.
pub async fn reconstruct_state_at(
    &self,
    game_id: &str,
    sequence: u64,
    viewer_seat: Option<Seat>,
) -> Result<GameStateSnapshot, ReplayError> {
    // Get nearest snapshot at or before sequence
    let (snapshot_seq, mut base_snapshot) = self
        .db
        .get_snapshot_at(game_id, sequence)
        .await?
        .ok_or_else(|| ReplayError::SnapshotNotFound)?;

    // If snapshot is exactly at sequence, return it
    if snapshot_seq == sequence {
        return Ok(base_snapshot);
    }

    // Load validator for this game's card year
    let validator = load_validator(base_snapshot.house_rules.ruleset.card_year);

    // Reconstruct table from snapshot
    let mut table = Table::from_snapshot(base_snapshot.clone(), validator);

    // Fetch events from snapshot to target sequence (raw/unfiltered event log)
    let events = self
        .db
        .get_events_range(game_id, snapshot_seq + 1, sequence)
        .await?;

    // Replay events
    for event_record in events {
        let event: GameEvent = serde_json::from_value(event_record.event_data)
            .map_err(|e| ReplayError::InvalidEventData(e.to_string()))?;

        // Apply event to table (requires new method: Table::apply_event)
        if let Err(e) = table.apply_event(event) {
            tracing::warn!("Failed to apply event during replay: {:?}", e);
            // Continue anyway - best-effort reconstruction
        }
    }

    // Create snapshot for viewer
    let final_snapshot = table.create_snapshot(viewer_seat.unwrap_or(Seat::East));
    Ok(final_snapshot)
}
```text

**Add event application method to Table (must be exhaustive for all state-mutating events):**

Replay correctness requires `apply_event` to handle every event that changes table state.
At minimum, cover:

- `HandDealt` (initial hands per seat, dealer draw if applicable)
- `TileDrawn` (hand add + `wall.draw_index` advance)
- `ReplacementDrawn` (hand add + `wall.draw_index` advance)
- `TileDiscarded` (hand remove + discard pile push)
- `TilesReceived` (hand add; used for Charleston and courtesy exchanges)
- `CharlestonPhaseChanged` (stage + timer metadata)
- `CharlestonPassComplete` (reset pending passes and stage progression if tracked)
- `PlayerReadyForPass` (pending pass state)
- `CourtesyPassProposed`, `CourtesyPassMismatch`, `CourtesyPairReady`, `CourtesyPassComplete` (courtesy state)
- `CallWindowOpened` (turn stage + timer metadata)
- `CallResolved` (apply meld creation and any called-tile effects)
- `TurnChanged` (active player and stage)
- `PhaseChanged` (phase transition resets)
- `WallExhausted` (phase trigger to draw/score as per rules)
- `MahjongDeclared` / `GameOver` (terminal state)

If any of these are handled indirectly elsewhere, document that mapping explicitly so replay remains deterministic.

**Mapping table (event → state changes):**

**IMPORTANT:** The `apply_event()` method must handle at minimum **18 event types** for complete replay reconstruction. Events that don't mutate state (like `GameStarting`, `PlayerJoined`) can be safely ignored.

| Event                    | State changes                                               | Notes                                            |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------ |
| `HandDealt`              | Initialize `players[seat].hand`, set dealer draw if present | Must reflect deal order + any extra dealer tile  |
| `TileDrawn`              | Add tile to hand, increment `wall.draw_index`               | No validation; use event data                    |
| `ReplacementDrawn`       | Add tile to hand, increment `wall.draw_index`               | Reason only for audit                            |
| `TileDiscarded`          | Remove tile from hand, push to `discard_pile`               | Also updates current turn stage if tracked       |
| `TilesReceived`          | Add tiles to hand                                           | Used for Charleston/courtesy exchanges           |
| `PlayerReadyForPass`     | Update `charleston_state.pending_passes`                    | Pair completeness gating                         |
| `CharlestonPhaseChanged` | Update `charleston_state.stage`                             | Keep timer metadata if stored                    |
| `CharlestonPassComplete` | Reset `pending_passes`                                      | Stage transition may be driven by `PhaseChanged` |
| `CourtesyPassProposed`   | Update `courtesy_proposals`                                 | Pair-private, but replay uses raw log            |
| `CourtesyPassMismatch`   | No state change                                             | Optional audit only                              |
| `CourtesyPairReady`      | Cache agreed count per pair                                 | If stored separately, update cache               |
| `CourtesyPassComplete`   | Clear courtesy state                                        | Ensure transition to playing follows             |
| `CallWindowOpened`       | Update `TurnStage::CallWindow` (timer metadata)             | `started_at_ms` from event                       |
| `CallResolved`           | Apply meld creation, remove called tiles, adjust discard    | May trigger replacement draw events              |
| `TurnChanged`            | Update active player + turn stage                           | Keep in sync with call window state              |
| `PhaseChanged`           | Update `phase`, clear/initialize phase-specific state       | For Charleston/Scoring transitions               |
| `WallExhausted`          | Transition to draw/score                                    | Should match production behavior                 |
| `MahjongDeclared`        | Mark winner/state                                           | Terminal or pre-`GameOver`                       |
| `GameOver`               | Finalize terminal state                                     | No further state changes allowed                 |

**File:** [`crates/mahjong_core/src/table.rs`](crates/mahjong_core/src/table.rs) (around line 500)

```rust
/// Apply an event directly to the table (for replay reconstruction).
/// This is the inverse of command processing - events modify state directly.
pub fn apply_event(&mut self, event: GameEvent) -> Result<(), String> {
    match event {
        GameEvent::TileDrawn { player, tile } => {
            if let Some(p) = self.get_player_mut(player) {
                p.hand.add_tile(tile);
            }
            self.wall.draw_index += 1; // Advance wall
            Ok(())
        }
        GameEvent::TileDiscarded { player, tile } => {
            if let Some(p) = self.get_player_mut(player) {
                let _ = p.hand.remove_tile(tile);
            }
            self.discard_pile.push(DiscardedTile {
                tile,
                discarded_by: player,
            });
            Ok(())
        }
        GameEvent::ReplacementDrawn { player, tile, .. } => {
            if let Some(p) = self.get_player_mut(player) {
                p.hand.add_tile(tile);
            }
            self.wall.draw_index += 1;
            Ok(())
        }
        GameEvent::PhaseChanged { phase, .. } => {
            self.phase = phase;
            Ok(())
        }
        // ... handle all state-mutating events required for replay ...
        _ => {
            // Events that don't modify core state can be ignored
            Ok(())
        }
    }
}
```text

**Replay note:** Reconstruction must use the raw event log (admin/unfiltered), not the player-filtered replay stream.

**Add database method for event range queries:**

**File:** [`crates/mahjong_server/src/db.rs`](crates/mahjong_server/src/db.rs) (around line 320)

```rust
/// Get events in a sequence range (inclusive).
pub async fn get_events_range(
    &self,
    game_id: &str,
    from_seq: u64,
    to_seq: u64,
) -> Result<Vec<EventRecord>, sqlx::Error> {
    let records = sqlx::query_as!(
        EventRecord,
        r#"
        SELECT game_id, sequence, event_data, created_at
        FROM events
        WHERE game_id = $1 AND sequence >= $2 AND sequence <= $3
        ORDER BY sequence ASC
        "#,
        game_id,
        from_seq as i64,
        to_seq as i64,
    )
    .fetch_all(&self.pool)
    .await?;

    Ok(records)
}
```text

---

### 0.7.8: Tests - Wall State Persistence

**File:** [`crates/mahjong_core/tests/wall_state_persistence.rs`](crates/mahjong_core/tests/wall_state_persistence.rs) (new file)

```rust
use mahjong_core::{
    deck::{Deck, Wall},
    tile::Tile,
};

#[test]
fn test_wall_from_seed_reproduces_order() {
    let seed = 12345u64;

    // Create two walls with same seed
    let wall1 = Wall::from_seed(seed);
    let wall2 = Wall::from_seed(seed);

    // Should have identical tile order
    assert_eq!(wall1.tiles, wall2.tiles);
    assert_eq!(wall1.seed, seed);
    assert_eq!(wall2.seed, seed);
}

#[test]
fn test_wall_break_point_rotation() {
    let seed = 42u64;
    let break_point = 20u8;

    let wall = Wall::from_seed_with_break(seed, break_point);

    // Tile at index 0 should be the tile at break_point in unrotated wall
    let unrotated_wall = Wall::from_seed(seed);
    assert_eq!(wall.tiles[0], unrotated_wall.tiles[break_point as usize]);
    assert_eq!(wall.break_point, break_point);
}

#[test]
fn test_wall_draw_index_tracks_draws() {
    let seed = 100u64;
    let mut wall = Wall::from_seed(seed);

    assert_eq!(wall.draw_index, 0);

    let tile1 = wall.draw().unwrap();
    assert_eq!(wall.draw_index, 1);

    let tile2 = wall.draw().unwrap();
    assert_eq!(wall.draw_index, 2);

    // Drawing should be deterministic
    let mut wall2 = Wall::from_seed(seed);
    assert_eq!(wall2.draw().unwrap(), tile1);
    assert_eq!(wall2.draw().unwrap(), tile2);
}

#[test]
fn test_snapshot_includes_wall_state() {
    use mahjong_core::{
        player::{Player, Seat},
        table::Table,
    };

    let seed = 999u64;
    let mut table = Table::new("test-game".to_string(), seed);

    // Add a player
    table.players.insert(
        Seat::East,
        Player::new("Test".to_string(), Seat::East, false),
    );

    // Draw some tiles to advance wall
    table.wall.draw();
    table.wall.draw();
    table.wall.draw();

    let snapshot = table.create_snapshot(Seat::East);

    assert_eq!(snapshot.wall_seed, seed);
    assert_eq!(snapshot.wall_draw_index, 3);
    assert_eq!(snapshot.wall_break_point, 0);
    assert_eq!(
        snapshot.wall_tiles_remaining,
        table.wall.tiles.len() - 3
    );
}

#[test]
fn test_table_restoration_from_snapshot() {
    use mahjong_core::{
        player::{Player, Seat},
        rules::validator::HandValidator,
        snapshot::GameStateSnapshot,
        table::Table,
    };

    let seed = 777u64;
    let mut original_table = Table::new("test-game".to_string(), seed);

    original_table.players.insert(
        Seat::East,
        Player::new("East".to_string(), Seat::East, false),
    );

    // Advance wall
    original_table.wall.draw();
    original_table.wall.draw();

    // Create snapshot
    let snapshot = original_table.create_snapshot(Seat::East);

    // Restore from snapshot
    let validator = HandValidator::new_2025();
    let restored_table = Table::from_snapshot(snapshot.clone(), validator);

    // Verify wall state matches
    assert_eq!(restored_table.wall.seed, seed);
    assert_eq!(restored_table.wall.draw_index, 2);
    assert_eq!(restored_table.wall.tiles, original_table.wall.tiles);
}
```text

---

### 0.7.9: Tests - Replacement Draw Events

**File:** [`crates/mahjong_core/tests/replacement_draw_events.rs`](crates/mahjong_core/tests/replacement_draw_events.rs) (new file)

```rust
use mahjong_core::{
    command::GameCommand,
    event::{GameEvent, ReplacementReason},
    flow::{GamePhase, TurnStage},
    hand::Hand,
    meld::Meld,
    player::{Player, Seat},
    table::Table,
    tile::Tile,
};

#[test]
fn test_kong_replacement_draw_event() {
    let mut table = Table::new("test-game".to_string(), 42);

    // Setup players
    for seat in Seat::all() {
        let mut player = Player::new(format!("Player-{:?}", seat), seat, false);
        player.hand.add_tile(Tile(0));
        player.hand.add_tile(Tile(1));
        table.players.insert(seat, player);
    }

    // Set phase to Playing
    table.phase = GamePhase::Playing(TurnStage::Discarding {
        player: Seat::East,
    });

    // East discards
    table
        .process_command(GameCommand::DiscardTile {
            player: Seat::East,
            tile: Tile(0),
        })
        .unwrap();

    // South calls Kong (assuming they have 3× Tile(0))
    let south = table.get_player_mut(Seat::South).unwrap();
    south.hand.add_tile(Tile(0));
    south.hand.add_tile(Tile(0));
    south.hand.add_tile(Tile(0));

    let events = table
        .process_command(GameCommand::DeclareCallIntent {
            player: Seat::South,
            call_type: mahjong_core::flow::CallType::Meld(Meld::Kong(Tile(0))),
        })
        .unwrap();

    // Should contain ReplacementDrawn event
    assert!(events.iter().any(|e| matches!(
        e,
        GameEvent::ReplacementDrawn {
            player,
            reason,
            ..
        } if *player == Seat::South && *reason == ReplacementReason::Kong
    )));
}

#[test]
fn test_replacement_draw_is_private() {
    use mahjong_core::event::GameEvent;

    let event = GameEvent::ReplacementDrawn {
        player: Seat::East,
        tile: Tile(42),
        reason: ReplacementReason::Kong,
    };

    // Should not be public
    assert!(!event.is_public());

    // Should only be visible to the drawing player
    assert!(event.is_for_seat(Seat::East));
    assert!(!event.is_for_seat(Seat::South));
    assert!(!event.is_for_seat(Seat::West));
    assert!(!event.is_for_seat(Seat::North));
}
```text

---

### 0.7.10: Tests - Replay Reconstruction Integration

**File:** [`crates/mahjong_server/tests/replay_reconstruction.rs`](crates/mahjong_server/tests/replay_reconstruction.rs) (new file)

```rust
use mahjong_core::{
    command::GameCommand,
    flow::GamePhase,
    player::Seat,
    snapshot::GameStateSnapshot,
    table::Table,
    tile::Tile,
};
use mahjong_server::{db::Database, replay::ReplayService};

#[tokio::test]
#[ignore] // Requires database
async fn test_replay_reconstruction_with_wall_state() {
    // Setup database
    let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let db = Database::new(&db_url).await.expect("Failed to connect to DB");

    let game_id = "test-replay-wall-123";
    let seed = 12345u64;

    // Create and record a game
    db.create_game(game_id).await.unwrap();

    let mut table = Table::new(game_id.to_string(), seed);

    // ... play some moves, record events, create snapshots ...

    // Reconstruct state at sequence 50
    let replay_service = ReplayService::new(db.clone());
    let reconstructed = replay_service
        .reconstruct_state_at(game_id, 50, Some(Seat::East))
        .await
        .unwrap();

    // Verify wall state
    assert_eq!(reconstructed.wall_seed, seed);
    // ... more assertions ...
}
```text

---

### 0.7.11: Update Phase 0 WBS

**File:** [`docs/implementation/phase-0-wbs.md`](docs/implementation/phase-0-wbs.md) (around line 179)

**Replace existing 0.7 section:**

```markdown
## 0.7 Deterministic Replay Inputs (Core + Server + Replay) ✅ COMPLETE

**Status:** Implemented and tested (2026-01-07)

**Goal:** Ensure replay and undo are deterministic by persisting wall state, RNG seeds, and replacement draws.

**Implementation Summary:**

- Added `seed`, `break_point` to `Wall` struct for deterministic reconstruction
- Added `ReplacementDrawn` event to track Kong/Quint/blank replacement draws
- Extended `GameStateSnapshot` with wall state fields (`wall_seed`, `wall_draw_index`, `wall_break_point`)
- Created `snapshots` table for periodic game state snapshots
- Implemented snapshot recording at phase boundaries (Charleston → Playing → Scoring)
- Added `Table::from_snapshot()` for state restoration from snapshots
- Added `Table::apply_event()` for event-based replay reconstruction
- Updated `ReplayService::reconstruct_state_at()` to use snapshots + events
- Added database migrations for wall state columns and snapshots table
- Comprehensive tests for wall persistence, replacement draws, and replay integrity

**Exit criteria:**

- ✅ Wall order reproducible from seed
- ✅ Break point and draw index persisted in snapshots
- ✅ Replacement draws logged as separate events
- ✅ Snapshots recorded at phase boundaries
- ✅ Replay reconstruction produces identical state
- ✅ Wall state and draw order preserved in snapshots
- ✅ Determinism tests pass (XXX total tests passing)
```text

---

### 0.7.12: Generate TypeScript Bindings

**Run binding generation:**

```bash
cd crates/mahjong_core
cargo test export_bindings
```text

This will regenerate TypeScript bindings for:

- Updated `Wall` struct with `seed` and `break_point` fields
- New `GameEvent::ReplacementDrawn` variant
- New `ReplacementReason` enum
- Updated `GameStateSnapshot` with wall state fields

**Verify bindings:**

Check that the following files are updated:

- `apps/client/src/types/bindings/generated/Wall.ts`
- `apps/client/src/types/bindings/generated/GameEvent.ts`
- `apps/client/src/types/bindings/generated/ReplacementReason.ts`
- `apps/client/src/types/bindings/generated/GameStateSnapshot.ts`

---

## Files Modified

**Summary:** 15 files total (6 core, 5 server, 2 migrations, 1 doc, 1 bindings)

| File                                                                                                           | Changes                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [`crates/mahjong_core/src/deck.rs`](crates/mahjong_core/src/deck.rs)                                           | Add `seed` and `break_point` to `Wall` (2 fields), add `from_seed()` helper method (1 method)                                                   |
| [`crates/mahjong_core/src/event.rs`](crates/mahjong_core/src/event.rs)                                         | Add `ReplacementDrawn` event and `ReplacementReason` enum (1 variant + 1 enum), update `is_private()` and `is_for_seat()` methods (2 locations) |
| [`crates/mahjong_core/src/table/handlers/playing.rs`](crates/mahjong_core/src/table/handlers/playing.rs)       | Emit `ReplacementDrawn` in meld call handler (1 location after `CallResolution::Meld`)                                                          |
| [`crates/mahjong_core/src/table/mod.rs`](crates/mahjong_core/src/table/mod.rs)                                 | Add `from_snapshot()` and `apply_event()` methods to Table impl (2 new methods)                                                                 |
| [`crates/mahjong_core/src/snapshot.rs`](crates/mahjong_core/src/snapshot.rs)                                   | Add 4 wall state fields to `GameStateSnapshot`, update `create_snapshot()` to populate them                                                     |
| [`crates/mahjong_core/tests/wall_state_persistence.rs`](crates/mahjong_core/tests/wall_state_persistence.rs)   | New test file with 6 tests for wall persistence and snapshot restoration                                                                        |
| [`crates/mahjong_core/tests/replacement_draw_events.rs`](crates/mahjong_core/tests/replacement_draw_events.rs) | New test file with 2 tests for replacement draw event emission and privacy                                                                      |
| [`crates/mahjong_server/src/db.rs`](crates/mahjong_server/src/db.rs)                                           | Add `record_snapshot()`, `get_snapshot_at()`, `get_events_range()` methods, update `finish_game()` to store wall state                          |
| [`crates/mahjong_server/src/network/room.rs`](crates/mahjong_server/src/network/room.rs)                       | Add `last_snapshot_seq` field, implement periodic snapshot recording in `broadcast_event()`                                                     |
| [`crates/mahjong_server/src/replay.rs`](crates/mahjong_server/src/replay.rs)                                   | Update `reconstruct_state_at()` to use snapshots, add wall state reconstruction logic                                                           |
| [`crates/mahjong_server/tests/replay_reconstruction.rs`](crates/mahjong_server/tests/replay_reconstruction.rs) | New integration test for replay with wall state (requires database)                                                                             |
| [`crates/mahjong_server/migrations/YYYYMMDD_add_wall_state.sql`](crates/mahjong_server/migrations/)            | New migration: Add `wall_seed` and `wall_break_point` columns to `games` table                                                                  |
| [`crates/mahjong_server/migrations/YYYYMMDD_create_snapshots.sql`](crates/mahjong_server/migrations/)          | New migration: Create `snapshots` table for periodic state snapshots                                                                            |
| [`crates/mahjong_server/schema.sql`](crates/mahjong_server/schema.sql)                                         | Update schema with wall state columns and snapshots table                                                                                       |
| [`docs/implementation/phase-0-wbs.md`](docs/implementation/phase-0-wbs.md)                                     | Update 0.7 section with implementation details and completion status                                                                            |
| [`apps/client/src/types/bindings/generated/`](apps/client/src/types/bindings/generated/)                       | Regenerated TypeScript bindings                                                                                                                 |

---

## Exit Criteria

1. ✅ `Wall` struct includes `seed` and `break_point` fields
2. ✅ `Wall::from_seed()` reproduces identical tile order
3. ✅ `ReplacementDrawn` event emitted for Kong/Quint/blank replacement
4. ✅ `GameStateSnapshot` includes complete wall state
5. ✅ Snapshots table created with proper indexing
6. ✅ Snapshot recording triggered at phase boundaries
7. ✅ `Table::from_snapshot()` restores wall state correctly
8. ✅ `Table::apply_event()` handles core state mutations
9. ✅ `ReplayService::reconstruct_state_at()` uses snapshots for efficiency
10. ✅ Database stores wall state with game records
11. ✅ Unit tests pass for wall persistence and replacement draws
12. ✅ Integration tests verify replay reconstruction accuracy
13. ✅ TypeScript bindings regenerate correctly
14. ✅ All existing tests continue to pass

---

## Effort Estimate

- **Core wall state (deck, events, snapshot):** 4-5 hours
- **Server snapshot recording:** 2-3 hours
- **Database migrations and queries:** 2-3 hours
- **Replay reconstruction logic:** 3-4 hours
- **Tests (unit + integration):** 4-5 hours
- **Documentation & bindings:** 1-2 hours
- **Total:** 16-22 hours (~2-3 days)

---

## Dependencies

- Phase 0.1: Call priority (complete) ✅
- Phase 0.2: Scoring (complete) ✅
- Phase 0.3: Ruleset metadata (complete) ✅ - **Provides card year for validator loading**
- Phase 0.4: Joker restrictions (complete) ✅
- Phase 0.5: Courtesy pass (planned) - Independent, no blocking
- Phase 0.6: Timer behavior (planned) - Independent, no blocking
- **Next**: Phase 1 - Always-On Analyst (uses replay for AI analysis)

---

## Implementation Sessions

This implementation is divided into 3 sessions to maintain focus and provide natural checkpoints. Session 1 includes basic verification tests to ensure new functionality works.

### Session 1: Core Wall State + Replacement Draws + Basic Tests

**Goal:** Get wall state tracking and replacement draw events working with basic verification.

**Steps to complete:** 0.7.1 - 0.7.3, 0.7.8 (basic wall tests only)

**Checklist:**

- [ ] 0.7.1: Add `seed` and `break_point` fields to `Wall` struct (deck.rs)
  - [ ] Update `Wall::from_deck()` signature to accept `seed` parameter
  - [ ] Update `Wall::from_deck_with_seed()` to pass seed through
  - [ ] Add `Wall::from_seed()` helper method for tests
  - [ ] Find and update all `Wall::from_deck()` call sites (verify with grep)
- [ ] 0.7.2: Add `ReplacementDrawn` event and `ReplacementReason` enum (event.rs)
  - [ ] Add event variant with player, tile, reason fields
  - [ ] Add to `is_private()` method (not public)
  - [ ] Add to `is_for_seat()` method (seat-specific visibility)
- [ ] 0.7.3: Emit `ReplacementDrawn` events for Kong/Quint (playing.rs)
  - [ ] Find `CallResolution::Meld { seat, meld } =>` handler
  - [ ] Add replacement draw logic after meld exposure
  - [ ] Test with `matches!(meld, Meld::Kong(_) | Meld::Quint(_))`
  - [ ] Handle wall exhaustion during replacement draw
- [ ] 0.7.8: Create basic wall state persistence tests (new file: `wall_state_persistence.rs`)
  - [ ] `test_wall_from_seed_reproduces_order()` - Verify determinism
  - [ ] `test_wall_draw_index_tracks_draws()` - Verify draw tracking
  - [ ] Skip snapshot tests for now (Session 2)
- [ ] **Verify:** Run `cargo test --package mahjong_core` - all tests should pass
- [ ] **Verify:** Run `cargo clippy --package mahjong_core` - no warnings
- [ ] **Verify:** Check wall fields with grep:

  ```bash
  grep -n "pub seed: u64" crates/mahjong_core/src/deck.rs
  grep -n "pub break_point: usize" crates/mahjong_core/src/deck.rs
  ```

  Expected: 2 matches (one for each field in Wall struct)

**Exit criteria:**

- Code compiles without errors
- All `mahjong_core` tests pass (including new wall tests)
- `ReplacementDrawn` event emits for Kong/Quint calls
- Wall seed/break_point fields exist and are populated
- No clippy warnings

**Estimated time:** 4-6 hours

---

### Session 2: Snapshot State + Database + Replay Logic

**Goal:** Add wall state to snapshots, create database schema, implement replay reconstruction.

**Steps to complete:** 0.7.4 - 0.7.7, remaining 0.7.8 tests

**Checklist:**

- [ ] 0.7.4: Add wall state fields to `GameStateSnapshot` (snapshot.rs)
  - [ ] Add `wall_seed`, `wall_draw_index`, `wall_break_point`, `wall_tiles_remaining` fields
  - [ ] Update `Table::create_snapshot()` to populate these fields
  - [ ] Add `Table::from_snapshot()` method for state restoration
- [ ] 0.7.5: Store wall state in database (db.rs)
  - [ ] Create migration: `YYYYMMDD_add_wall_state.sql`
  - [ ] Add `wall_seed` and `wall_break_point` columns to `games` table
  - [ ] Update `finish_game()` to store wall state
  - [ ] Update `schema.sql` documentation
- [ ] 0.7.6: Implement periodic snapshot recording (room.rs)
  - [ ] Add `last_snapshot_seq` field to `Room` struct
  - [ ] Find `broadcast_event()` method
  - [ ] Add snapshot trigger logic for phase boundaries
  - [ ] Create `db.record_snapshot()` method
  - [ ] Create `db.get_snapshot_at()` method
  - [ ] Create migration: `YYYYMMDD_create_snapshots.sql`
- [ ] 0.7.7: Implement replay reconstruction (replay.rs + table/mod.rs)
  - [ ] Update `reconstruct_state_at()` to use snapshots
  - [ ] Add `Table::apply_event()` method (handle 10+ event types - see event mapping table)
  - [ ] Add `db.get_events_range()` for fetching event sequences
  - [ ] Test with unfiltered (raw) event log
- [ ] 0.7.8: Complete wall state persistence tests
  - [ ] `test_snapshot_includes_wall_state()` - Verify snapshot fields
  - [ ] `test_table_restoration_from_snapshot()` - Verify from_snapshot works
- [ ] **Verify:** Run `cargo test --package mahjong_core` - all tests pass
- [ ] **Verify:** Run `cargo test --package mahjong_server` - all tests pass
- [ ] **Verify:** Run database migrations (if DATABASE_URL set)
- [ ] **Verify:** Check snapshot recording triggers:

  ```bash
  grep -n "should_snapshot" crates/mahjong_server/src/network/room.rs
  ```

  Expected: Logic that checks for PhaseChanged, CharlestonComplete, GameOver

**Exit criteria:**

- Snapshots table created with proper indexing
- Wall state persists in database
- `Table::from_snapshot()` and `Table::apply_event()` work correctly
- Replay reconstruction produces correct state (verified by tests)
- All tests pass (core + server)
- No database errors during snapshot recording

**Estimated time:** 6-8 hours

---

### Session 3: Comprehensive Tests + Documentation + Bindings

**Goal:** Add full test coverage, update documentation, regenerate TypeScript bindings, final cleanup.

**Steps to complete:** 0.7.9 - 0.7.12

**Checklist:**

- [ ] 0.7.9: Create replacement draw event tests (new file: `replacement_draw_events.rs`)
  - [ ] `test_kong_replacement_draw_event()` - Verify Kong emits ReplacementDrawn
  - [ ] `test_replacement_draw_is_private()` - Verify event privacy
- [ ] 0.7.10: Create replay reconstruction integration test (server tests)
  - [ ] `test_replay_reconstruction_with_wall_state()` - End-to-end replay test
  - [ ] Requires DATABASE_URL (mark with `#[ignore]` if not available)
- [ ] 0.7.11: Update Phase 0 WBS (phase-0-wbs.md)
  - [ ] Replace 0.7 section with implementation summary
  - [ ] Mark as ✅ COMPLETE with test count
- [ ] 0.7.12: Regenerate TypeScript bindings
  - [ ] Run `cd crates/mahjong_core && cargo test export_bindings`
  - [ ] Verify `Wall.ts` updated with seed/break_point fields
  - [ ] Verify `GameEvent.ts` includes ReplacementDrawn variant
  - [ ] Verify `ReplacementReason.ts` created
  - [ ] Verify `GameStateSnapshot.ts` includes wall state fields
- [ ] **Cleanup:** Run linting and formatting
  - [ ] `cargo clippy --all-targets` - fix any warnings
  - [ ] `cargo fmt --all` - format all Rust code
  - [ ] Check for unused imports (especially in table/handlers/playing.rs)
- [ ] **Verify:** Run full test suite `cargo test` - all tests pass
- [ ] **Verify:** Check git diff for binding files

  ```bash
  git diff apps/client/src/types/bindings/generated/
  ```

  Expected: Wall.ts, GameEvent.ts, ReplacementReason.ts, GameStateSnapshot.ts modified

**Exit criteria:**

- All tests in `replacement_draw_events.rs` pass (2 tests)
- Replay reconstruction integration test passes (if DATABASE_URL available)
- Phase 0 WBS updated with completion status
- TypeScript bindings regenerated and include all new types
- No clippy warnings
- No unused imports
- Full test suite passes (core + server + integration)
- Documentation updated

**Estimated time:** 4-6 hours

---

## Implementation Notes

### Testing Context (IMPORTANT - Read Before Implementing!)

**Event Emission Gotchas:**

1. **`transition_phase()` doesn't return events** - It changes state but returns event list
   - For tests asserting on events, use `process_command()` instead
   - Example: `table.process_command(GameCommand::DiscardTile { ... })` returns events

2. **Raw vs. Filtered Event Logs:**
   - Replay reconstruction requires RAW/unfiltered events (all private data visible)
   - Player-filtered replays hide private information (used for client replay viewer)
   - `db.get_events_range()` must return unfiltered events
   - Do NOT use `event.is_private()` filtering during replay reconstruction

3. **Wall draw tracking:**
   - Every `wall.draw()` call MUST increment `wall.draw_index`
   - This happens automatically in the existing `Wall::draw()` method
   - Verify draw_index matches actual draws in snapshot tests

4. **Snapshot timing:**
   - Snapshots taken AFTER event is emitted (includes the triggering event)
   - Use `self.event_seq` as snapshot sequence number
   - Don't snapshot before event recording (seq would be off by 1)

**Breaking Changes:**

- `Wall::from_deck()` signature changes - grep for call sites
- Tests using `CharlestonState::new()` are UNCHANGED (Phase 0.6 already updated these)
- Existing replay tests may need updating for snapshot-based reconstruction

### Design Decision: Snapshot vs. Event Sourcing

**Two paradigms for state reconstruction:**

1. **Event Sourcing**: Replay all events from game start
   - Pros: Complete audit trail, no data loss
   - Cons: Slow for late-game reconstruction (300+ events)

2. **Snapshot + Incremental Events**: Store periodic snapshots, replay deltas
   - Pros: Fast reconstruction (5-10 events instead of 300)
   - Cons: Snapshot storage overhead, complexity

#### We chose: Snapshot + Incremental Events

Rationale:

- American Mahjong games average 150-300 moves
- Replaying 300 events takes ~500ms; snapshots reduce to ~50ms
- Snapshots at phase boundaries (3-5 per game) add ~15 KB storage
- Most time-travel jumps are to phase boundaries ("restart Charleston")

### Wall State Storage: Seed vs. Full Tile Array

**Options:**

1. Store full tile array (152 tiles × 1 byte = 152 bytes)
2. Store seed only (8 bytes)

#### We chose: Seed + Draw Index

Rationale:

- 95% space savings (16 bytes vs. 152 bytes)
- Deterministic reconstruction guaranteed by `Deck::shuffle_with_seed()`
- Break point adds physical Mahjong realism (could be randomized later)

**Trade-off:** Must have same Deck implementation across versions. If we change shuffle algorithm, old replays break.

**Mitigation:** Version the shuffle algorithm (e.g., `shuffle_v1`, `shuffle_v2`) and store version with seed.

### Replacement Draw Logging Rationale

**Why explicit `ReplacementDrawn` events?**

Kong/Quint replacement draws are **different from normal draws**:

- Occur mid-turn (after meld declaration)
- Don't advance turn (player continues)
- Have different strategic implications

Logging them separately:

- Enables "What-If" analysis ("If I didn't Kong, would I have drawn this tile next turn?")
- Simplifies replay reconstruction (clear distinction between normal and replacement draws)
- Matches physical gameplay (replacement draws feel different)

**Alternative considered:** Merge into `TileDrawn` with a `reason` field.

Rejected because:

- `TileDrawn` is a common event; adding optional fields bloats all instances
- Replacement draws are rare (~5% of draws); separate event is cleaner

### Event Application vs. Command Processing

**Replay requires inverse operations:**

- **Commands**: Player intent → Validate → Apply → Generate events
- **Event Application**: Event → Apply directly (skip validation)

**Why skip validation during replay?**

- Events are already validated (they came from commands)
- Validation may fail due to incomplete state (e.g., checking hand contents when only viewer hand is known)
- Replay should be lenient ("best-effort reconstruction")

**Example:**

```rust
// Command processing:
process_command(DiscardTile) → validate_command() → apply_discard_tile() → [events]

// Replay:
apply_event(TileDiscarded) → apply_discard_tile() directly (no validation)
```text

This asymmetry is intentional - events are **trusted facts**, commands are **untrusted requests**.

### Snapshot Privacy: Admin vs. Player Views

**Challenge:** Snapshots contain hidden information (other players' hands).

**Solution:**

- Store **admin snapshots** (full state, arbitrary viewer seat)
- When serving to players, filter via `create_snapshot(player_seat)`

**Implementation:**

```rust
// Database stores full state
db.record_snapshot(game_id, seq, table.create_snapshot(Seat::East));

// Replay service filters per viewer
let snapshot = db.get_snapshot_at(game_id, seq)?;
let filtered = Table::from_snapshot(snapshot, validator)
    .create_snapshot(viewer_seat);
```text

This ensures:

- Database has complete state (for admin/debugging)
- Players only see their own hand (privacy preserved)
- Replay integrity verified against full state

### Carryover from Phase 0.3

**From phase-0-wbs.md:**

> **Carryover:** Update `crates/mahjong_server/src/db_simple.rs` to embed ruleset metadata in `final_state` and align the `finish_game()` signature with `crates/mahjong_server/src/db.rs`.

**Resolution:**

The `db_simple.rs` in-memory implementation should also store wall state for consistency:

```rust
// db_simple.rs
pub async fn finish_game(&self, game_id: &str, final_state: &GameStateSnapshot) {
    let mut games = self.games.lock().await;
    if let Some(game) = games.get_mut(game_id) {
        game.finished_at = Some(Utc::now());
        game.final_state = Some(final_state.clone());
        game.wall_seed = Some(final_state.wall_seed);
        game.wall_break_point = Some(final_state.wall_break_point);
    }
}
```text

### Testing Strategy

**Three layers of testing:**

1. **Unit Tests** (Core): Wall persistence, snapshot fields, event emission
   - Fast, no database
   - Verify seed reproducibility, snapshot completeness

2. **Integration Tests** (Server): Replay reconstruction, snapshot storage
   - Requires database
   - Verify end-to-end replay integrity

3. **Manual Testing** (Future Frontend):
   - "Jump to Move 50" works correctly
   - "Resume from here" invalidates future moves
   - Wall state matches original game

**Mocking strategy:**

- Unit tests use in-memory `Table`/`Wall`
- Integration tests use real database (or Docker test DB)
- Frontend tests use mock replay service

### Future Enhancements (Out of Scope)

**Phase 0.7 does NOT implement:**

- ❌ History panel UI (frontend Phase 1+)
- ❌ Playback controls (step forward/backward)
- ❌ "What-If" branching (divergent timelines)
- ❌ Move descriptions ("Bot 2 discarded Green Dragon")
- ❌ Replay compression (gzip event logs)
- ❌ Replay sharing (export to JSON)

These will be added in later phases after core determinism is proven.

### Alternative Considered: Full Event Sourcing

An earlier design considered pure event sourcing (no snapshots):

**Pros:**

- Simpler model (events are source of truth)
- No snapshot staleness issues

**Cons:**

- Slow reconstruction (300 events × 2ms = 600ms)
- Hard to implement "jump to turn 50" (must replay 50 events)

**Why snapshots won?**

Gap Analysis explicitly mentions:

> **Memory Optimization:**
>
> - Store full snapshots for every Nth move (e.g., every 10th)
> - For intermediate moves, store deltas or reconstruct from events

Snapshots at phase boundaries are a pragmatic middle ground:

- Fast access to common jump points
- Reasonable storage overhead
- Simple implementation (no delta compression complexity)

### Snapshot Frequency Trade-offs

**Options:**

1. Every move (300 snapshots per game) - Too much storage
2. Every 10 moves (30 snapshots per game) - Good for move-by-move navigation
3. Phase boundaries only (3-5 snapshots per game) - Good for phase navigation

#### We chose: Phase boundaries

Rationale from Gap Analysis:

> - **History Size:** Full game history (typically 150-300 moves per game)
>   - Each entry ≈ 2.5KB (2KB snapshot + 500B metadata)
>   - Worst case: 300 moves × 2.5KB = 750KB per room (acceptable for practice mode)

Phase boundaries reduce this to:

- 5 snapshots × 3 KB = 15 KB
- Still fast for time travel (max 100 events to replay between snapshots)
- Aligns with player mental model (phases are natural "checkpoints")

**Future:** Could add per-move snapshots for "Practice Mode" (in-memory only, not persisted).

---

## Migration Path

**For existing games in database:**

1. Wall state columns default to NULL (games before this phase)
2. Replay for old games uses fallback: `seed=0` (best-effort)
3. New games always have wall state populated

**Schema migration:**

```sql
ALTER TABLE games ADD COLUMN wall_seed BIGINT DEFAULT NULL;
ALTER TABLE games ADD COLUMN wall_break_point SMALLINT DEFAULT 0;

-- Backfill existing games with seed=0 (deterministic, but arbitrary)
UPDATE games SET wall_seed = 0 WHERE wall_seed IS NULL AND finished_at IS NOT NULL;
```text

**Client compatibility:**

- Old clients: Ignore new `GameStateSnapshot` fields (backward compatible)
- New clients: Use wall state for replay features (forward compatible)

**Versioning:** Consider adding `replay_version: u8` to snapshots for future schema changes.

---

## Success Metrics

**Determinism:**

- ✅ `Wall::from_seed(42)` produces identical tile order across runs
- ✅ Reconstructed state matches original state byte-for-byte
- ✅ 100 replays of same game produce identical final snapshots

**Performance:**

- ✅ Snapshot creation < 10ms (target: ~2ms)
- ✅ Replay reconstruction < 100ms for 300-move game
- ✅ Database query for snapshot < 50ms

**Storage:**

- ✅ Snapshots add < 50 KB per game
- ✅ Wall state adds < 20 bytes per game
- ✅ Event log size < 200 KB per game

**Functionality:**

- ✅ Time travel to any sequence number works
- ✅ Replacement draws logged correctly
- ✅ Phase boundary snapshots captured
- ✅ Replay integrity verification passes

---

## Open Questions

1. **Should we randomize break point?**
   - Currently defaults to 0
   - Could randomize for physical realism: `(rng() % 152) as u8`
   - Decision: Defer to later phase (cosmetic feature)

2. **Should snapshots include AI analysis?**
   - Gap Analysis §2 describes "Always-On Analyst"
   - Could snapshot pattern evaluations
   - Decision: Defer to Phase 1 (Always-On Analyst implementation)

3. **Should we version the snapshot schema?**
   - Future schema changes could break old replays
   - Could add `snapshot_version: u8` to `GameStateSnapshot`
   - Decision: Add in Phase 1 if schema changes are frequent

4. **Should snapshot storage be optional?**
   - In-memory games don't need snapshots
   - Could make `db.record_snapshot()` no-op if DB is None
   - Decision: Already implemented (db is `Option<Arc<Database>>`)

---

## Related Documentation

- [docs/implementation/13-backend-gap-analysis.md](13-backend-gap-analysis.md) - §1 (History Viewer), §5.3 (Replay System)
- [docs/architecture/05-data-models.md](../architecture/05-data-models.md) - Wall and Deck structures
- [crates/mahjong_server/src/replay.rs](../../crates/mahjong_server/src/replay.rs) - Existing replay service
- [crates/mahjong_core/src/deck.rs](../../crates/mahjong_core/src/deck.rs) - Wall implementation

---

**Last Updated:** 2026-01-07
**Estimated Completion:** TBD (pending implementation start)
