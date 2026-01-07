# Phase 0.3: Ruleset Metadata - Detailed Implementation Plan

**Status:** IMPLEMENTED (2026-01-06)

**Created:** 2026-01-06

**Goal:** Persist the exact ruleset used for every game, including card year, timer modes, and rule flags. Multi-year NMJL card support is part of MVP - the infrastructure must support selecting any card year (2017-2025), with the understanding that some years may need additional data preparation.

## Current State Analysis

### Existing Structure

| Component | Status | Details |
| --------- | ------ | ------- |
| [`HouseRules`](crates/mahjong_core/src/table.rs:39) | Raw | Currently just 3 fields (`blank_exchange_enabled`, `call_window_seconds`, `charleston_timer_seconds`) |
| [`Table.house_rules`](crates/mahjong_core/src/table.rs:169) | Raw | Table stores HouseRules inline |
| [`GameStateSnapshot.house_rules`](crates/mahjong_core/src/snapshot.rs:53) | Raw | Snapshot includes HouseRules |
| Database `final_state` | Raw | Table serialization includes house_rules |
| Card data | Raw | Yearly cards in `data/cards/` (2017-2025, unified format for 2025) |

### Gap Analysis

1. **HouseRules needs expansion** - add card year, timer mode, and other rule flags
2. **No card year selector** - cannot determine which NMJL card to validate against
3. **No timer mode** - passive vs enforced timer behavior not configurable
4. **Server hardcodes 2025** - `load_default_validator()` in [`room.rs:29`](crates/mahjong_server/src/network/room.rs:29) always loads unified_card2025.json
5. **No ruleset configuration on room creation** - rooms always use default rules

---

## Implementation Steps

**Note:** Line numbers referenced throughout are approximate and may shift as earlier steps are implemented. Search for the relevant function/struct names instead.

### 0.3.0: Cleanup - Remove Phase 0.2 Timer References

**Context:** Phase 0.2 incorrectly added auto-advance timer terminology. We need to remove any references to "Enforced" or "Passive" timer modes that may have been added, as these concepts don't match our requirements (timers are display-only, never auto-advance).

**Files to check and clean:**

1. **Check [`crates/mahjong_core/src/flow.rs`](crates/mahjong_core/src/flow.rs)**
   - Search for any `TimerMode`, `Passive`, or `Enforced` enums/fields
   - If found, remove them (they will be replaced in 0.3.1)

2. **Check [`crates/mahjong_core/src/event.rs`](crates/mahjong_core/src/event.rs)**
   - Search for timer-related events that mention auto-advance behavior
   - Remove any `TimerExpired` events that trigger game actions

3. **Check [`crates/mahjong_server/src/network/room.rs`](crates/mahjong_server/src/network/room.rs)**
   - Search for timer enforcement logic
   - Remove any auto-pass or auto-action code

**Note:** If no such references exist, skip this step. The existing timer fields in `CharlestonState` and `CallWindow` that store duration values are fine—we're only removing mode/enforcement logic.

---

### 0.3.1: Core - Define Ruleset Types

**File:** [`crates/mahjong_core/src/table.rs`](crates/mahjong_core/src/table.rs)

**Add new types after imports (around line 30):**

```rust
/// Timer behavior mode for call windows and Charleston.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum TimerMode {
    /// Timer is visible to players but does not enforce actions (visual indicator only).
    Visible,
    /// Timer is not shown to players (no time pressure).
    Hidden,
}

/// Complete ruleset configuration for a game.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct Ruleset {
    /// NMJL card year (e.g., 2025).
    pub card_year: u16,

    /// Timer behavior configuration.
    pub timer_mode: TimerMode,

    /// Allow blank tile exchange from discard pile.
    pub blank_exchange_enabled: bool,

    /// Call window duration in seconds.
    pub call_window_seconds: u32,

    /// Charleston pass timer in seconds.
    pub charleston_timer_seconds: u32,
}

impl Default for Ruleset {
    fn default() -> Self {
        Self {
            card_year: 2025,
            timer_mode: TimerMode::Visible,
            blank_exchange_enabled: false,
            call_window_seconds: 10,
            charleston_timer_seconds: 60,
        }
    }
}
```

**Replace existing `HouseRules` struct (around line 39) with:**

```rust
/// House rules that modify game behavior. Contains the complete ruleset configuration.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct HouseRules {
    /// The ruleset configuration.
    pub ruleset: Ruleset,
}

impl Default for HouseRules {
    fn default() -> Self {
        Self {
            ruleset: Ruleset::default(),
        }
    }
}

impl HouseRules {
    /// Create with a specific card year (uses defaults for other settings).
    pub fn with_card_year(card_year: u16) -> Self {
        Self {
            ruleset: Ruleset {
                card_year,
                ..Ruleset::default()
            },
        }
    }

    /// Create with custom ruleset.
    pub fn with_ruleset(ruleset: Ruleset) -> Self {
        Self { ruleset }
    }
}
```

---

### 0.3.2: Core - Update Table Creation

**File:** [`crates/mahjong_core/src/table.rs`](crates/mahjong_core/src/table.rs) (around line 183)

**Replace constructors:**

```rust
impl Table {
    /// Create a new game table with default ruleset (2025 card).
    #[must_use]
    pub fn new(game_id: String, seed: u64) -> Self {
        Self::new_with_rules(game_id, seed, HouseRules::default())
    }

    /// Create a new game table with custom house rules.
    #[must_use]
    pub fn new_with_rules(game_id: String, seed: u64, house_rules: HouseRules) -> Self {
        let wall = Wall::from_deck_with_seed(seed, 0);

        Table {
            game_id,
            players: HashMap::new(),
            wall,
            discard_pile: Vec::new(),
            phase: GamePhase::WaitingForPlayers,
            current_turn: Seat::East,
            dealer: Seat::East,
            round_number: 1,
            house_rules,
            charleston_state: None,
            #[serde(skip)]
            validator: None,
            ready_players: HashSet::new(),
        }
    }
}
```

---

### 0.3.3: Core - Update Table Usages

**Update all references to `house_rules.*` fields to use `house_rules.ruleset.*`:**

- Line 580: `blank_exchange_enabled` → `ruleset.blank_exchange_enabled`
- Line 581: `blank_exchange_enabled` → `ruleset.blank_exchange_enabled`
- Line 1731: `blank_exchange_enabled` → `ruleset.blank_exchange_enabled`

**Example pattern:**

```rust
// Before
if self.house_rules.blank_exchange_enabled {

// After
if self.house_rules.ruleset.blank_exchange_enabled {
```

---

### 0.3.4: Core - Snapshot Accessors

**File:** [`crates/mahjong_core/src/snapshot.rs`](crates/mahjong_core/src/snapshot.rs)

**Add accessor methods to `GameStateSnapshot` (after line 58):**

```rust
impl GameStateSnapshot {
    /// Get the card year for this game's ruleset.
    pub fn card_year(&self) -> u16 {
        self.house_rules.ruleset.card_year
    }

    /// Get the timer mode for this game's ruleset.
    pub fn timer_mode(&self) -> &TimerMode {
        &self.house_rules.ruleset.timer_mode
    }
}
```

**Import TimerMode at top of file:**

```rust
use crate::table::{HouseRules, TimerMode};
```

---

### 0.3.5: Server - Multi-Year Card Loading

**File:** [`crates/mahjong_server/src/network/room.rs`](crates/mahjong_server/src/network/room.rs)

**Replace `load_default_validator()` (around line 29) with:**

```rust
use mahjong_core::table::HouseRules;
use mahjong_core::rules::{card::UnifiedCard, validator::HandValidator};

/// Load validator for a specific card year.
/// Returns None if the card file doesn't exist or can't be parsed.
fn load_validator(card_year: u16) -> Option<HandValidator> {
    // Map year to file - unified format for 2025, individual year files for others
    // Note: Years 2021-2024 are not yet available (data conversion in progress)
    let filename = match card_year {
        2025 => "unified_card2025.json",
        2020 => "card2020.json",
        2019 => "card2019.json",
        2018 => "card2018.json",
        2017 => "card2017.json",
        _ => {
            tracing::error!("No card data available for year {}", card_year);
            return None;
        }
    };

    // Use workspace-relative path (assumes server runs from workspace root)
    let path = std::path::Path::new("data/cards").join(filename);
    match std::fs::read_to_string(&path) {
        Ok(json) => {
            let card = UnifiedCard::from_json(&json).map_err(|e| {
                tracing::error!("Failed to parse card {}: {}", filename, e);
            }).ok()?;
            Some(HandValidator::new(&card))
        }
        Err(e) => {
            tracing::error!("Failed to load card file {}: {}", path.display(), e);
            None
        }
    }
}
```

---

### 0.3.6: Server - Room with Configurable Ruleset

**File:** [`crates/mahjong_server/src/network/room.rs`](crates/mahjong_server/src/network/room.rs)

**Add to Room struct (around line 42):**

```rust
pub struct Room {
    /// Unique room identifier
    pub room_id: String,
    /// Players by seat (up to 4)
    pub sessions: HashMap<Seat, Arc<Mutex<Session>>>,
    /// The game table (contains all game state)
    pub table: Option<Table>,
    /// When this room was created
    pub created_at: DateTime<Utc>,
    /// Whether the game has started
    pub game_started: bool,
    /// Event sequence counter for persistence (monotonically increasing)
    event_seq: i32,
    /// Database handle for persistence (optional for testing)
    db: Option<Database>,
    /// Seats controlled by bots (for takeover)
    bot_seats: HashSet<Seat>,
    /// Whether a bot runner task is active
    bot_runner_active: bool,
    /// Difficulty level for bots in this room
    pub bot_difficulty: Difficulty,
    /// Custom house rules for this room (None = use defaults)
    pub house_rules: Option<HouseRules>,
}
```

**Update constructors (around line 67):**

```rust
impl Room {
    /// Create a new empty room with default rules.
    pub fn new() -> Self {
        Self::new_with_rules(HouseRules::default())
    }

    /// Create a new room with database persistence and default rules.
    pub fn new_with_db(db: Database) -> Self {
        Self::new_with_db_and_rules(db, HouseRules::default())
    }

    /// Create a new room with custom house rules.
    pub fn new_with_rules(house_rules: HouseRules) -> Self {
        let room_id = Uuid::new_v4().to_string();
        Self {
            room_id,
            sessions: HashMap::new(),
            table: None,
            created_at: Utc::now(),
            game_started: false,
            event_seq: 0,
            db: None,
            bot_seats: HashSet::new(),
            bot_runner_active: false,
            bot_difficulty: Difficulty::Easy,
            house_rules: Some(house_rules),
        }
    }

    /// Create a room with database and custom rules.
    pub fn new_with_db_and_rules(db: Database, house_rules: HouseRules) -> Self {
        let room_id = Uuid::new_v4().to_string();
        Self {
            room_id,
            sessions: HashMap::new(),
            table: None,
            created_at: Utc::now(),
            game_started: false,
            event_seq: 0,
            db: Some(db),
            bot_seats: HashSet::new(),
            bot_runner_active: false,
            bot_difficulty: Difficulty::Easy,
            house_rules: Some(house_rules),
        }
    }
}
```

**Update `start_game()` method (around line 172):**

```rust
async fn start_game(&mut self) {
    // Get house rules (custom or default)
    let house_rules = self.house_rules.clone().unwrap_or_default();
    let card_year = house_rules.ruleset.card_year;

    // Create the game table with the configured rules
    let seed = rand::random::<u64>();
    let mut table = Table::new_with_rules(self.room_id.clone(), seed, house_rules);

    // Load validator for the card year
    if let Some(validator) = load_validator(card_year) {
        table.set_validator(validator);
    } else {
        // Warn but continue - game can proceed without win validation
        tracing::warn!(
            "Failed to load validator for year {} - win validation disabled. \
             Game will proceed but cannot validate Mahjong declarations.",
            card_year
        );
    }

    // Populate players from sessions
    for (seat, session_arc) in &self.sessions {
        let session = session_arc.lock().await;
        let player = mahjong_core::player::Player::new(
            session.player_id.clone(),
            *seat,
            false,
        );
        table.players.insert(*seat, player);
    }

    // Transition to Setup phase
    let _ = table.transition_phase(mahjong_core::flow::PhaseTrigger::AllPlayersJoined);
    self.table = Some(table);
    self.game_started = true;

    // Persist game creation
    if let Some(db) = &self.db {
        if let Err(e) = db.create_game(&self.room_id).await {
            tracing::error!("Failed to persist game creation: {}", e);
        }
    }

    // Broadcast GameStarting event
    let event = GameEvent::GameStarting;
    self.broadcast_event(event).await;
}
```

---

### 0.3.7: Server - Persist Ruleset Metadata

**File:** [`crates/mahjong_server/src/db.rs`](crates/mahjong_server/src/db.rs)

**Note:** This change embeds ruleset metadata into the existing `final_state` JSON column. No database migration is required.

**Update `finish_game()` to include ruleset metadata (around line 76):**

```rust
/// Update game with final state when it ends
pub async fn finish_game(
    &self,
    game_id: &str,
    winner_seat: Option<Seat>,
    winning_pattern: Option<&str>,
    final_state: &JsonValue,
    card_year: u16,
    timer_mode: &str,
) -> Result<(), sqlx::Error> {
    let uuid = Uuid::parse_str(game_id).map_err(|e| {
        sqlx::Error::Decode(Box::new(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("Invalid UUID: {}", e),
        )))
    })?;

    let winner_str = winner_seat.map(|s| format!("{:?}", s));

    // Extend final state with ruleset metadata
    let mut extended_state = final_state.clone();
    if let Some(obj) = extended_state.as_object_mut() {
        obj.insert("ruleset_metadata".to_string(), json!({
            "card_year": card_year,
            "timer_mode": timer_mode,
        }));
    }

    sqlx::query!(
        r#"
        UPDATE games
        SET finished_at = $1,
            winner_seat = $2,
            winning_pattern = $3,
            final_state = $4
        WHERE id = $5
        "#,
        Utc::now(),
        winner_str,
        winning_pattern,
        extended_state,
        uuid
    )
    .execute(&self.pool)
    .await?;

    Ok(())
}
```

**Update `Room::persist_final_state()` (room.rs, around line 372):**

```rust
async fn persist_final_state(&self, event: &GameEvent) {
    if let Some(db) = &self.db {
        if let Some(table) = &self.table {
            let (winner_seat, winning_pattern) = match event {
                GameEvent::GameOver { winner, result } => {
                    (*winner, result.winning_pattern.as_deref())
                }
                _ => (None, None),
            };

            let final_state = serde_json::to_value(table).unwrap_or_else(|_| {
                serde_json::json!({
                    "game_id": table.game_id,
                    "phase": format!("{:?}", table.phase),
                })
            });

            // Extract ruleset metadata
            let card_year = table.house_rules.ruleset.card_year;
            let timer_mode = format!("{:?}", table.house_rules.ruleset.timer_mode);

            if let Err(e) = db
                .finish_game(
                    &self.room_id,
                    winner_seat,
                    winning_pattern,
                    &final_state,
                    card_year,
                    &timer_mode,
                )
                .await
            {
                tracing::error!("Failed to persist final game state: {}", e);
            }

            // ... existing player stats update ...
        }
    }
}
```

---

### 0.3.8: Server - RoomStore with Ruleset Support

**File:** [`crates/mahjong_server/src/network/room.rs`](crates/mahjong_server/src/network/room.rs) (around line 686)

**Add convenience methods to RoomStore:**

```rust
impl RoomStore {
    /// Create a new room with default rules.
    pub fn create_room(&self) -> (String, Arc<Mutex<Room>>) {
        let room = Room::new();
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());
        (room_id, room_arc)
    }

    /// Create a new room with database persistence and default rules.
    pub fn create_room_with_db(&self, db: Database) -> (String, Arc<Mutex<Room>>) {
        let room = Room::new_with_db(db);
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());
        (room_id, room_arc)
    }

    /// Create a new room with custom house rules.
    pub fn create_room_with_rules(
        &self,
        house_rules: HouseRules,
    ) -> (String, Arc<Mutex<Room>>) {
        let room = Room::new_with_rules(house_rules);
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());
        (room_id, room_arc)
    }

    /// Create a room with database and custom rules.
    pub fn create_room_with_db_and_rules(
        &self,
        db: Database,
        house_rules: HouseRules,
    ) -> (String, Arc<Mutex<Room>>) {
        let room = Room::new_with_db_and_rules(db, house_rules);
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());
        (room_id, room_arc)
    }
}
```

---

### 0.3.9: Tests - Core Ruleset

**File:** [`crates/mahjong_core/src/table.rs`](crates/mahjong_core/src/table.rs) (tests section, around line 1492)

**Add tests:**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::table::{HouseRules, Ruleset, TimerMode};

    #[test]
    fn test_ruleset_default_values() {
        let ruleset = Ruleset::default();
        assert_eq!(ruleset.card_year, 2025);
        assert!(matches!(ruleset.timer_mode, TimerMode::Visible));
        assert!(!ruleset.blank_exchange_enabled);
        assert_eq!(ruleset.call_window_seconds, 10);
        assert_eq!(ruleset.charleston_timer_seconds, 60);
    }

    #[test]
    fn test_ruleset_custom_values() {
        let ruleset = Ruleset {
            card_year: 2024,
            timer_mode: TimerMode::Hidden,
            blank_exchange_enabled: true,
            call_window_seconds: 15,
            charleston_timer_seconds: 90,
        };

        assert_eq!(ruleset.card_year, 2024);
        assert!(matches!(ruleset.timer_mode, TimerMode::Hidden));
        assert!(ruleset.blank_exchange_enabled);
    }

    #[test]
    fn test_house_rules_default() {
        let house_rules = HouseRules::default();
        assert_eq!(house_rules.ruleset.card_year, 2025);
        assert!(matches!(house_rules.ruleset.timer_mode, TimerMode::Visible));
    }

    #[test]
    fn test_house_rules_with_card_year() {
        let house_rules = HouseRules::with_card_year(2020);
        assert_eq!(house_rules.ruleset.card_year, 2020);
        // Other values should be defaults
        assert!(matches!(house_rules.ruleset.timer_mode, TimerMode::Visible));
    }

    #[test]
    fn test_house_rules_with_custom_ruleset() {
        let ruleset = Ruleset {
            card_year: 2025,
            timer_mode: TimerMode::Hidden,
            blank_exchange_enabled: true,
            call_window_seconds: 20,
            charleston_timer_seconds: 120,
        };
        let house_rules = HouseRules::with_ruleset(ruleset);

        assert_eq!(house_rules.ruleset.card_year, 2025);
        assert!(matches!(house_rules.ruleset.timer_mode, TimerMode::Hidden));
        assert!(house_rules.ruleset.blank_exchange_enabled);
        assert_eq!(house_rules.ruleset.call_window_seconds, 20);
    }

    #[test]
    fn test_table_creation_with_house_rules() {
        let house_rules = HouseRules::with_card_year(2025);
        let table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

        assert_eq!(table.house_rules.ruleset.card_year, 2025);
        assert!(!table.house_rules.ruleset.blank_exchange_enabled);
    }

    #[test]
    fn test_snapshot_contains_ruleset() {
        let table = Table::new("test-game".to_string(), 42);
        let snapshot = table.create_snapshot(Seat::East);

        assert_eq!(snapshot.house_rules.ruleset.card_year, 2025);
        assert!(matches!(snapshot.house_rules.ruleset.timer_mode, TimerMode::Visible));
    }

    #[test]
    fn test_snapshot_card_year_accessors() {
        let table = Table::new("test-game".to_string(), 42);
        let snapshot = table.create_snapshot(Seat::East);

        assert_eq!(snapshot.card_year(), 2025);
        assert!(matches!(snapshot.timer_mode(), TimerMode::Visible));
    }
}
```

---

### 0.3.10: Tests - Server

**File:** [`crates/mahjong_server/src/network/room.rs`](crates/mahjong_server/src/network/room.rs) (tests section, around line 735)

**Add integration tests:**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use mahjong_core::table::{HouseRules, Ruleset, TimerMode};

    #[test]
    fn test_room_creation_with_default_rules() {
        let room = Room::new();
        assert!(!room.room_id.is_empty());
        assert_eq!(room.player_count(), 0);
        assert!(!room.game_started);
        // Default house rules should be present
        assert!(room.house_rules.is_some());
        assert_eq!(room.house_rules.unwrap().ruleset.card_year, 2025);
    }

    #[test]
    fn test_room_creation_with_custom_rules() {
        let house_rules = HouseRules::with_card_year(2020);
        let room = Room::new_with_rules(house_rules);

        assert_eq!(room.house_rules.unwrap().ruleset.card_year, 2020);
    }

    #[tokio::test]
    async fn test_room_store_create_with_rules() {
        let store = RoomStore::new();
        let house_rules = HouseRules::with_card_year(2024);
        let (room_id, _) = store.create_room_with_rules(house_rules);

        let room = store.get_room(&room_id).unwrap();
        let room_guard = room.lock().await;
        assert_eq!(room_guard.house_rules.unwrap().ruleset.card_year, 2024);
    }

    #[test]
    fn test_validator_loads_for_2025() {
        let validator = load_validator(2025);
        assert!(validator.is_some());
    }

    #[test]
    fn test_validator_returns_none_for_missing_year() {
        // Year with no card data should return None
        let validator = load_validator(2016);
        assert!(validator.is_none());
    }
}
```

---

### 0.3.11: Tests - Database

**File:** [`crates/mahjong_server/src/db.rs`](crates/mahjong_server/src/db.rs) (tests section, around line 621)

**Add integration test:**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires DATABASE_URL
    async fn test_ruleset_persistence() {
        let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set");
        let db = Database::new(&db_url).await.unwrap();
        db.run_migrations().await.unwrap();

        let game_id = Uuid::new_v4().to_string();
        db.create_game(&game_id).await.unwrap();

        let final_state = serde_json::json!({
            "game_id": game_id,
            "phase": "GameOver",
        });

        db.finish_game(
            &game_id,
            Some(Seat::East),
            Some("2025-GRP1-H1"),
            &final_state,
            2025,
            "Visible",
        )
        .await
        .unwrap();

        // Verify persistence
        let game = db.get_game(&game_id).await.unwrap().unwrap();
        assert!(game.final_state.is_some());

        let state = game.final_state.unwrap();
        let ruleset_meta = state.get("ruleset_metadata").unwrap();
        assert_eq!(ruleset_meta.get("card_year").unwrap(), 2025);
        assert_eq!(ruleset_meta.get("timer_mode").unwrap(), "Visible");
    }
}
```

---

## Files Modified

| File | Changes |
| --------- | ------- |
| [`crates/mahjong_core/src/table.rs`](crates/mahjong_core/src/table.rs) | Add `TimerMode`, `Ruleset`, refactor `HouseRules`, update `Table` constructors, update usages |
| [`crates/mahjong_core/src/snapshot.rs`](crates/mahjong_core/src/snapshot.rs) | Add accessor methods, import `TimerMode` |
| [`crates/mahjong_server/src/db.rs`](crates/mahjong_server/src/db.rs) | Update `finish_game()` with ruleset metadata |
| [`crates/mahjong_server/src/network/room.rs`](crates/mahjong_server/src/network/room.rs) | Add `load_validator()`, update `Room` with `house_rules`, update constructors, update `start_game()`, add `RoomStore` methods |

---

## Exit Criteria

1. ✅ `HouseRules` contains complete `Ruleset` with all fields (`card_year`, `timer_mode`, timers, `blank_exchange_enabled`)
2. ✅ `Table::new()` and `Table::new_with_house_rules()` create tables with ruleset
3. ✅ `GameStateSnapshot` includes full ruleset and provides accessor methods
4. ✅ Server loads validators by card year (multi-year infrastructure complete)
5. ✅ Server persists ruleset metadata with game records
6. ✅ Unit tests pass (`cargo test -p mahjong_core`)
7. ✅ Integration tests pass (`cargo test -p mahjong_server`)
8. ✅ TypeScript bindings regenerate correctly (`cargo test -p mahjong_core`)
9. ✅ Room creation supports custom ruleset via `RoomStore::create_room_with_rules()`

---

## Effort Estimate

- **Core types and Table:** 2-3 hours
- **Server integration:** 2-3 hours
- **Tests:** 1-2 hours
- **Total:** 5-8 hours

---

## Dependencies

- Phase 0.1: Call priority (complete) ✅
- Phase 0.2: Scoring (complete) ✅
- Next: Phase 0.4 - Joker Restrictions (depends on ruleset metadata for per-pattern joker limits)
