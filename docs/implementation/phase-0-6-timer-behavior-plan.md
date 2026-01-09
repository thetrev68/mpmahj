# Phase 0.6: Timer Behavior - Detailed Implementation Plan

**Status:** PLANNED

**Created:** 2026-01-07

**Updated:** 2026-01-08

**Goal:** Implement server-side timer metadata aligned with ruleset configuration. Timers are **visual indicators only** - they never auto-advance game state. Support two modes: Visible (timer shown to players) and Hidden (no timer display).

**Note:** Line numbers mentioned in this document are approximate as of 2026-01-08. Use search patterns (provided throughout) to locate code if line numbers have shifted.

## Current State Analysis

### Existing Structure

| Component                                                                       | Status           | Details                                                        |
| ------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------- |
| [`TimerMode`](crates/mahjong_core/src/table/types.rs:13)                        | ✅ Exists        | Enum with `Visible` and `Hidden` variants (added in Phase 0.3) |
| [`Ruleset.timer_mode`](crates/mahjong_core/src/table/types.rs:29)               | ✅ Exists        | Timer mode stored in ruleset                                   |
| [`Ruleset.call_window_seconds`](crates/mahjong_core/src/table/types.rs:35)      | ✅ Exists        | Duration for call windows                                      |
| [`Ruleset.charleston_timer_seconds`](crates/mahjong_core/src/table/types.rs:38) | ✅ Exists        | Duration for Charleston passes                                 |
| [`CharlestonState.timer`](crates/mahjong_core/src/flow.rs:307)                  | ✅ Exists        | Hardcoded to 60 seconds                                        |
| [`TurnStage::CallWindow.timer`](crates/mahjong_core/src/flow.rs:443)            | ✅ Exists        | Timer field in CallWindow                                      |
| `CallWindowOpened` event                                                        | ⚠️ Missing timer | Event doesn't include timer value                              |
| Charleston timer events                                                         | ❌ Missing       | No events for Charleston timer updates                         |

### Current Behavior

**What works:**

- `TimerMode` exists in ruleset and persists to database
- Timer duration configured via `HouseRules`
- `CharlestonState` has a `timer` field
- `TurnStage::CallWindow` has a `timer` field

**What's missing:**

1. **No timer initialization from ruleset** - Charleston always uses 60 seconds, call window always uses 10 seconds
2. **No timer value in events** - `CallWindowOpened` doesn't tell clients how long they have
3. **No timer mode enforcement** - clients don't know whether to show timer or hide it
4. **No server start time** - clients can't display a consistent countdown or rejoin accurately
5. **Hardcoded values** - `CharlestonState::new()` ignores `charleston_timer_seconds` from ruleset

### Gap Analysis

The current implementation defines timer infrastructure but doesn't connect it to the ruleset or emit timer information in events. Clients have no way to know:

- How long a call window lasts
- How long a Charleston pass has
- Whether to show a timer at all

---

## Timestamp Strategy (IMPORTANT - Read First!)

**Problem:** Events need `started_at_ms` timestamps, but `mahjong_core` is a pure library with no I/O dependencies.

**Solution:** Timestamps are NOT generated in the core crate. Instead:

1. **Server layer responsibility**: The server (`mahjong_server`) generates timestamps when processing commands
2. **Events include placeholders**: For now, use `0` as placeholder in core crate
3. **Server enriches events**: Server replaces `0` with actual `SystemTime::now()` timestamp before broadcasting

**Why this approach:**

- Keeps `mahjong_core` pure (no `std::time::SystemTime` dependency)
- Allows deterministic testing (tests can verify logic without time-based flakiness)
- Server controls time source (enables time mocking for tests)

**Implementation pattern for this phase:**

```rust
// In mahjong_core - use placeholder timestamp
events.push(GameEvent::CallWindowOpened {
    tile,
    discarded_by: player,
    can_call: can_call_seats,
    timer: self.house_rules.ruleset.call_window_seconds,
    started_at_ms: 0,  // Placeholder - server will replace
    timer_mode: self.house_rules.ruleset.timer_mode.clone(),
});
```

```rust
// In mahjong_server (future work, NOT part of this phase)
// Server enriches events before broadcasting:
fn enrich_event_with_timestamp(event: &mut GameEvent) {
    match event {
        GameEvent::CallWindowOpened { started_at_ms, .. } => {
            *started_at_ms = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;
        }
        GameEvent::CharlestonTimerStarted { started_at_ms, .. } => {
            *started_at_ms = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;
        }
        _ => {}
    }
}
```

**For this phase:**

- Add `started_at_ms: u64` fields to events
- Use `0` as the value in all core crate code
- Document that server layer will populate real timestamps (future enhancement)

---

## Implementation Steps

### 0.6.1: Core - Add Timer Metadata to CallWindowOpened Event

**File:** [`crates/mahjong_core/src/event.rs`](crates/mahjong_core/src/event.rs)

**Search for:** `CallWindowOpened {` (currently around line 114)

**Update `CallWindowOpened` event to add timer fields:**

```rust
/// Call window opened (other players can call or pass)
CallWindowOpened {
    tile: Tile,
    discarded_by: Seat,
    /// Players who can call (excludes discarder)
    can_call: Vec<Seat>,
    /// Timer duration in seconds (from ruleset)
    timer: u32,
    /// Server start timestamp (epoch ms) - use 0 as placeholder in core crate
    started_at_ms: u64,
    /// Whether timer should be shown
    timer_mode: TimerMode,
},
```

**File:** [`crates/mahjong_core/src/table/handlers/playing.rs`](crates/mahjong_core/src/table/handlers/playing.rs)

**Search for:** `GameEvent::CallWindowOpened` (currently around line 99)

**Update emission to include timer fields:**

```rust
// In discard_tile handler:
events.push(GameEvent::CallWindowOpened {
    tile,
    discarded_by: player,
    can_call: can_call_seats,
    timer: table.house_rules.ruleset.call_window_seconds,
    started_at_ms: 0,  // Placeholder - server will enrich
    timer_mode: table.house_rules.ruleset.timer_mode.clone(),
});
```

**Client note:** Always emit timer metadata; clients hide UI when `timer_mode` is `Hidden`.

---

### 0.6.2: Core - Add Timer Events for Charleston

**File:** [`crates/mahjong_core/src/event.rs`](crates/mahjong_core/src/event.rs)

**Search for:** Charleston-related events (currently around line 54-93)

**Add new Charleston timer event after other Charleston events:**

```rust
/// Charleston timer started for current pass stage
CharlestonTimerStarted {
    stage: CharlestonStage,
    duration: u32, // seconds
    started_at_ms: u64,  // Use 0 as placeholder in core crate
    timer_mode: TimerMode,
},
```

**Note:** The `is_public()` method does NOT exist in the current codebase. Only `is_private()` exists. The new `CharlestonTimerStarted` event should be public (not in the `is_private()` matches), so no changes to visibility methods are needed.

---

### 0.6.3: Core - Initialize Charleston Timer from Ruleset

**File:** [`crates/mahjong_core/src/flow.rs`](crates/mahjong_core/src/flow.rs)

**Search for:** `impl CharlestonState` (currently around line 314)

**Update `CharlestonState::new()` to accept timer duration parameter:**

```rust
impl CharlestonState {
    /// Create a new Charleston state starting at FirstRight.
    /// The `timer_seconds` parameter comes from the ruleset.
    pub fn new(timer_seconds: u32) -> Self {
        CharlestonState {
            stage: CharlestonStage::FirstRight,
            pending_passes: HashMap::from([
                (Seat::East, None),
                (Seat::South, None),
                (Seat::West, None),
                (Seat::North, None),
            ]),
            votes: HashMap::new(),
            timer: Some(timer_seconds),
            courtesy_proposals: HashMap::new(),
        }
    }

    /// Reset state for the next pass stage, preserving timer duration.
    pub fn reset_for_next_pass(&mut self) {
        self.pending_passes = HashMap::from([
            (Seat::East, None),
            (Seat::South, None),
            (Seat::West, None),
            (Seat::North, None),
        ]);
        // Timer duration stays the same (already set from ruleset)
        // courtesy_proposals is NOT reset here (only relevant for CourtesyAcross stage)
    }
}
```

**Note:** There is NO `Default` impl for `CharlestonState` in the current codebase, so nothing needs to be removed.

---

### 0.6.4: Core - Update Table to Use Ruleset Timer

**File:** [`crates/mahjong_core/src/table/handlers/setup.rs`](crates/mahjong_core/src/table/handlers/setup.rs)

**Search for:** `CharlestonState::new()` (currently around line 60)

**Update to pass timer from ruleset:**

```rust
// In the handler that starts Charleston (when all players join):
let charleston_timer = table.house_rules.ruleset.charleston_timer_seconds;
table.charleston_state = Some(CharlestonState::new(charleston_timer));
```

**File:** [`crates/mahjong_core/src/table/handlers/charleston.rs`](crates/mahjong_core/src/table/handlers/charleston.rs)

**Search for:** `CharlestonPhaseChanged` event emissions

**Add `CharlestonTimerStarted` after EACH `CharlestonPhaseChanged` emission:**

You need to find ALL locations where Charleston stages change. Use this search command:

```bash
grep -n "CharlestonPhaseChanged" crates/mahjong_core/src/table/handlers/charleston.rs
```

For each location found, add the timer event immediately after:

```rust
// Example pattern (repeat for ALL CharlestonPhaseChanged emissions):
events.push(GameEvent::CharlestonPhaseChanged { stage: new_stage });

// Add this immediately after:
if let Some(charleston) = &table.charleston_state {
    if let Some(timer) = charleston.timer {
        events.push(GameEvent::CharlestonTimerStarted {
            stage: new_stage,
            duration: timer,
            started_at_ms: 0,  // Placeholder - server will enrich
            timer_mode: table.house_rules.ruleset.timer_mode.clone(),
        });
    }
}
```

**Locations to update** (as of 2026-01-08, verify with grep):

1. When transitioning from WaitingForPlayers → Charleston (FirstRight starts)
2. When advancing FirstRight → FirstAcross
3. When advancing FirstAcross → FirstLeft
4. When starting Second Charleston (SecondLeft)
5. When advancing SecondLeft → SecondAcross
6. When advancing SecondAcross → SecondRight
7. When entering CourtesyAcross stage

---

### 0.6.5: Core - Use Ruleset Timer in CallWindow Creation

**File:** [`crates/mahjong_core/src/table/handlers/playing.rs`](crates/mahjong_core/src/table/handlers/playing.rs)

**Search for:** `TurnStage::CallWindow {` in the discard handler

**Update to use ruleset timer value:**

```rust
// When opening call window after a discard:
let next_stage = TurnStage::CallWindow {
    tile,
    discarded_by: player,
    can_act: can_call_seats.clone(),
    pending_intents: vec![],
    timer: table.house_rules.ruleset.call_window_seconds,  // Use ruleset value instead of hardcoded
};
```

**Note:** The CallWindow timer is already a field in the TurnStage enum (flow.rs:443). This step ensures it's initialized from the ruleset instead of a hardcoded value.

---

### 0.6.6: Core - Add Snapshot Helper Method

**File:** [`crates/mahjong_core/src/snapshot.rs`](crates/mahjong_core/src/snapshot.rs)

**Search for:** `impl GameStateSnapshot` (currently around line 60)

**Add the `timers_visible()` helper method:**

The `timer_mode()` accessor already exists (line 67). Add this additional helper:

```rust
impl GameStateSnapshot {
    // ... existing methods (card_year, timer_mode) ...

    /// Check if timers should be visible to players.
    /// Returns true for Visible mode, false for Hidden mode.
    pub fn timers_visible(&self) -> bool {
        matches!(self.house_rules.ruleset.timer_mode, TimerMode::Visible)
    }
}
```

**Location:** Add after the existing `timer_mode()` method (around line 70).

---

### 0.6.7: Server - Broadcast Timer Mode to Clients

**File:** [`crates/mahjong_server/src/network/room.rs`](crates/mahjong_server/src/network/room.rs)

**Option 1: Include timer mode in `GameStarting` event**

Modify the server message protocol to include ruleset in game start. This requires a new event variant or extending `GameStarting`.

**Option 2: Send timer mode in initial snapshot (RECOMMENDED)**

Clients already receive `GameStateSnapshot` via session - no changes needed. Frontend can check `snapshot.timer_mode()`.

**Verify snapshot is sent after game starts (around line 172 in `start_game()`):**

```rust
async fn start_game(&mut self) {
    // ... existing setup ...

    // Broadcast GameStarting event
    let event = GameEvent::GameStarting;
    self.broadcast_event(event).await;

    // Note: Clients receive snapshot via Session, which includes timer_mode
}
```

No additional changes needed - timer mode is already in `HouseRules` → `Ruleset` → `GameStateSnapshot`.

---

### 0.6.8: Tests - Core Timer Initialization

**File:** [`crates/mahjong_core/tests/timer_behavior.rs`](crates/mahjong_core/tests/timer_behavior.rs) (new file)

**Create comprehensive timer tests:**

```rust
use mahjong_core::{
    command::GameCommand,
    event::GameEvent,
    flow::{CharlestonStage, GamePhase, PhaseTrigger, TurnStage},
    player::{Player, Seat},
    table::{HouseRules, Ruleset, Table, TimerMode},
    tile::Tile,
};

#[test]
fn test_charleston_timer_from_ruleset() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Visible,
        blank_exchange_enabled: false,
        call_window_seconds: 10,
        charleston_timer_seconds: 90, // Custom duration
    };
    let house_rules = HouseRules::with_ruleset(ruleset);
    let mut table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    // Add 4 players
    for seat in Seat::all() {
        table.players.insert(
            seat,
            Player::new(format!("player-{:?}", seat), seat, false),
        );
    }

    // Transition to Charleston
    let events = table.transition_phase(PhaseTrigger::AllPlayersJoined);

    // Charleston should start with 90 second timer
    if let Some(charleston) = &table.charleston_state {
        assert_eq!(charleston.timer, Some(90));
    } else {
        panic!("Charleston state not created");
    }

    // Should emit CharlestonTimerStarted event with duration 90
    assert!(events.iter().any(|e| matches!(
        e,
        GameEvent::CharlestonTimerStarted { duration, .. } if *duration == 90
    )));
}

#[test]
fn test_call_window_timer_from_ruleset() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Visible,
        blank_exchange_enabled: false,
        call_window_seconds: 15, // Custom duration
        charleston_timer_seconds: 60,
    };
    let house_rules = HouseRules::with_ruleset(ruleset);
    let mut table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    // Setup game in Playing phase
    for seat in Seat::all() {
        let mut player = Player::new(format!("player-{:?}", seat), seat, false);
        player.hand.add_tile(Tile(0));
        player.hand.add_tile(Tile(1));
        table.players.insert(seat, player);
    }
    table.phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::East });

    // Discard a tile to open call window
    let events = table.process_command(GameCommand::DiscardTile {
        player: Seat::East,
        tile: Tile(0),
    }).unwrap();

    // CallWindowOpened should have timer = 15
    assert!(events.iter().any(|e| matches!(
        e,
        GameEvent::CallWindowOpened { timer, .. } if *timer == 15
    )));

    // TurnStage should have timer = 15
    if let GamePhase::Playing(TurnStage::CallWindow { timer, .. }) = table.phase {
        assert_eq!(timer, 15);
    } else {
        panic!("Expected CallWindow stage");
    }
}

#[test]
fn test_timer_mode_visible() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Visible,
        blank_exchange_enabled: false,
        call_window_seconds: 10,
        charleston_timer_seconds: 60,
    };
    let house_rules = HouseRules::with_ruleset(ruleset);
    let table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    let snapshot = table.create_snapshot(Seat::East);
    assert!(matches!(snapshot.timer_mode(), TimerMode::Visible));
    assert!(snapshot.timers_visible());
}

#[test]
fn test_timer_mode_hidden() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Hidden,
        blank_exchange_enabled: false,
        call_window_seconds: 10,
        charleston_timer_seconds: 60,
    };
    let house_rules = HouseRules::with_ruleset(ruleset);
    let table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    let snapshot = table.create_snapshot(Seat::East);
    assert!(matches!(snapshot.timer_mode(), TimerMode::Hidden));
    assert!(!snapshot.timers_visible());
}

#[test]
fn test_charleston_stage_advances_with_new_timer_event() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Visible,
        blank_exchange_enabled: false,
        call_window_seconds: 10,
        charleston_timer_seconds: 60,
    };
    let house_rules = HouseRules::with_ruleset(ruleset);
    let mut table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    // Add players and start Charleston
    for seat in Seat::all() {
        table.players.insert(
            seat,
            Player::new(format!("player-{:?}", seat), seat, false),
        );
    }
    table.transition_phase(PhaseTrigger::AllPlayersJoined);

    // Charleston starts at FirstRight
    assert!(matches!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::FirstRight)
    ));

    // Pass tiles to advance to FirstAcross
    for seat in Seat::all() {
        table.process_command(GameCommand::PassTiles {
            player: seat,
            tiles: vec![Tile(0), Tile(1), Tile(2)],
            blind_pass_count: None,
        }).unwrap();
    }

    // Should emit CharlestonTimerStarted for FirstAcross
    let events = table.process_command(GameCommand::PassTiles {
        player: Seat::East,
        tiles: vec![],
        blind_pass_count: None,
    }).unwrap_or_default();

    // Check for timer event when stage advances
    // (This may require updating apply_pass_tiles to emit timer events)
}

#[test]
fn test_default_timer_values() {
    let table = Table::new("test-game".to_string(), 42);
    let snapshot = table.create_snapshot(Seat::East);

    // Defaults from Ruleset::default()
    assert_eq!(snapshot.house_rules.ruleset.call_window_seconds, 10);
    assert_eq!(snapshot.house_rules.ruleset.charleston_timer_seconds, 60);
    assert!(matches!(snapshot.house_rules.ruleset.timer_mode, TimerMode::Visible));
}
```

---

### 0.6.9: Tests - Event Timer Values

**File:** [`crates/mahjong_core/tests/timer_behavior.rs`](crates/mahjong_core/tests/timer_behavior.rs) (continued)

**Add tests for event timer fields:**

```rust
#[test]
fn test_call_window_opened_includes_timer() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Visible,
        blank_exchange_enabled: false,
        call_window_seconds: 12,
        charleston_timer_seconds: 60,
    };
    let house_rules = HouseRules::with_ruleset(ruleset);
    let mut table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    // Setup and discard
    for seat in Seat::all() {
        let mut player = Player::new(format!("player-{:?}", seat), seat, false);
        player.hand.add_tile(Tile(0));
        player.hand.add_tile(Tile(1));
        table.players.insert(seat, player);
    }
    table.phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::East });

    let events = table.process_command(GameCommand::DiscardTile {
        player: Seat::East,
        tile: Tile(0),
    }).unwrap();

    // Verify CallWindowOpened event has correct timer
    let call_window_event = events.iter().find(|e| matches!(
        e,
        GameEvent::CallWindowOpened { .. }
    ));

    assert!(call_window_event.is_some());
    if let Some(GameEvent::CallWindowOpened { timer, .. }) = call_window_event {
        assert_eq!(*timer, 12);
    }
}

#[test]
fn test_charleston_timer_started_on_phase_change() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Visible,
        blank_exchange_enabled: false,
        call_window_seconds: 10,
        charleston_timer_seconds: 75,
    };
    let house_rules = HouseRules::with_ruleset(ruleset);
    let mut table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    for seat in Seat::all() {
        table.players.insert(
            seat,
            Player::new(format!("player-{:?}", seat), seat, false),
        );
    }

    let events = table.transition_phase(PhaseTrigger::AllPlayersJoined);

    // Should have CharlestonTimerStarted with duration 75
    assert!(events.iter().any(|e| matches!(
        e,
        GameEvent::CharlestonTimerStarted { stage, duration }
        if *stage == CharlestonStage::FirstRight && *duration == 75
    )));
}
```

---

### 0.6.10: Update Existing Tests

**Breaking change:** `CharlestonState::new()` now requires a `timer_seconds` parameter.

#### Step 1: Find all broken tests

```bash
# This will find all locations that need updating:
grep -rn "CharlestonState::new()" crates/
```

#### Step 2: Update each location

As of 2026-01-08, these 7 locations need updating:

1. **`crates/mahjong_core/src/flow.rs:828`** - Unit test
   - Change: `CharlestonState::new()` → `CharlestonState::new(60)`

2. **`crates/mahjong_core/src/flow.rs:871`** - Unit test
   - Change: `CharlestonState::new()` → `CharlestonState::new(60)`

3. **`crates/mahjong_core/src/flow.rs:889`** - Unit test
   - Change: `CharlestonState::new()` → `CharlestonState::new(60)`

4. **`crates/mahjong_core/tests/charleston_flow.rs:26`** - Integration test
   - Change: `CharlestonState::new()` → `CharlestonState::new(60)`

5. **`crates/mahjong_core/src/table/tests.rs:186`** - Unit test
   - Change: `CharlestonState::new()` → `CharlestonState::new(60)`

6. **`crates/mahjong_core/src/table/tests.rs:208`** - Unit test
   - Change: `CharlestonState::new()` → `CharlestonState::new(60)`

7. **`crates/mahjong_core/src/table/handlers/setup.rs:60`** - Production code
   - Already updated in step 0.6.4 (uses `table.house_rules.ruleset.charleston_timer_seconds`)

#### Step 3: Update event assertions

Check if any tests assert on `CallWindowOpened` event structure and add the new fields:

```bash
grep -rn "CallWindowOpened" crates/mahjong_core/tests/
grep -rn "CallWindowOpened" crates/mahjong_server/tests/
```

Update assertions to match new event structure (with `timer`, `started_at_ms`, `timer_mode` fields).

---

### 0.6.11: Documentation - Update Architecture Docs

**File:** [`docs/architecture/04-state-machine-design.md`](docs/architecture/04-state-machine-design.md)

**Update CharlestonState documentation (around line 214):**

```markdown
pub struct CharlestonState {
pub stage: CharlestonStage,
pub pending_passes: HashMap<Seat, Option<Vec<Tile>>>,
pub votes: HashMap<Seat, CharlestonVote>,
/// Timer for the current pass (seconds from ruleset)
pub timer: Option<u32>,
}

impl CharlestonState {
/// Create with timer from ruleset
pub fn new(timer_seconds: u32) -> Self { ... }
}
```

**File:** [`docs/architecture/06-command-event-system-api-contract.md`](docs/architecture/06-command-event-system-api-contract.md)

**Update event examples to include timer (around line 228):**

```rust
CallWindowOpened {
    tile: Tile,
    discarded_by: Seat,
    can_call: Vec<Seat>,
    timer: u32, // Duration from ruleset
}
```

---

### 0.6.12: Generate TypeScript Bindings

**Run binding generation:**

```bash
cd crates/mahjong_core
cargo test export_bindings
```

This will regenerate TypeScript bindings for:

- Updated `GameEvent::CallWindowOpened` with `timer` field
- New `GameEvent::CharlestonTimerStarted` variant
- `GameStateSnapshot` with `timer_mode()` accessor

**Verify bindings:**

Check that the following files are updated:

- `apps/client/src/types/bindings/generated/GameEvent.ts`
- `apps/client/src/types/bindings/generated/CharlestonState.ts`
- `apps/client/src/types/bindings/generated/TurnStage.ts` (CallWindow timer)

---

## Files Modified

| File                                                                               | Changes                                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [`crates/mahjong_core/src/event.rs`](crates/mahjong_core/src/event.rs)             | Add timer fields to `CallWindowOpened`, add `CharlestonTimerStarted` event      |
| [`crates/mahjong_core/src/flow.rs`](crates/mahjong_core/src/flow.rs)               | Update `CharlestonState::new()` to accept timer duration parameter              |
| [`crates/mahjong_core/src/snapshot.rs`](crates/mahjong_core/src/snapshot.rs)       | Add `timers_visible()` helper method                                            |
| [`crates/mahjong_core/src/table/handlers/setup.rs`](...)                           | Pass ruleset timer to `CharlestonState::new()`                                  |
| [`crates/mahjong_core/src/table/handlers/charleston.rs`](...)                      | Emit `CharlestonTimerStarted` after each `CharlestonPhaseChanged`               |
| [`crates/mahjong_core/src/table/handlers/playing.rs`](...)                         | Update `CallWindowOpened` emissions, use ruleset timer in `CallWindow` creation |
| [`crates/mahjong_core/tests/timer_behavior.rs`](...)                               | **New file** with 10+ tests for timer behavior                                  |
| [`crates/mahjong_core/tests/charleston_flow.rs`](...)                              | Update `CharlestonState::new()` calls to pass timer (1 location)                |
| [`crates/mahjong_core/src/flow.rs`](crates/mahjong_core/src/flow.rs)               | Update `CharlestonState::new()` calls in unit tests (3 locations)               |
| [`crates/mahjong_core/src/table/tests.rs`](crates/mahjong_core/src/table/tests.rs) | Update `CharlestonState::new()` calls in unit tests (2 locations)               |
| [`docs/architecture/04-state-machine-design.md`](...)                              | Update CharlestonState documentation                                            |
| [`docs/architecture/06-command-event-system-api-contract.md`](...)                 | Update event examples with timer fields                                         |
| [`apps/client/src/types/bindings/generated/`](apps/client/src/types/bindings/...)  | Regenerated TypeScript bindings                                                 |

---

## Exit Criteria

1. ✅ `CharlestonState` timer initialized from `ruleset.charleston_timer_seconds`
2. ✅ `CallWindow` timer initialized from `ruleset.call_window_seconds`
3. ✅ `CallWindowOpened` event includes `timer` field
4. ✅ `CharlestonTimerStarted` event emitted on stage changes
5. ✅ `GameStateSnapshot.timers_visible()` returns correct value based on `TimerMode`
6. ✅ Timer values match ruleset configuration in all game phases
7. ✅ Timer mode (Visible/Hidden) persists and is accessible to clients
8. ✅ Unit tests pass for timer initialization and event emission
9. ✅ Integration tests verify timer values in events
10. ✅ TypeScript bindings regenerate correctly
11. ✅ All existing tests continue to pass after updates
12. ✅ **No auto-advance logic** - timers are display-only, never trigger game actions

---

## Effort Estimate

- **Core timer initialization:** 2-3 hours
- **Event updates:** 1-2 hours
- **Tests:** 2-3 hours
- **Documentation & bindings:** 1 hour
- **Fixing broken tests:** 1-2 hours
- **Total:** 7-11 hours

---

## Dependencies

- Phase 0.1: Call priority (complete) ✅
- Phase 0.2: Scoring (complete) ✅
- Phase 0.3: Ruleset metadata (complete) ✅ - **Provides `TimerMode` and timer durations**
- Phase 0.4: Joker restrictions (complete) ✅
- Phase 0.5: Courtesy pass (planned) - Will use Charleston timer
- Next: Phase 0.7 - Deterministic Replay (needs timer values in events)

---

## Implementation Notes

### Design Decision: Timers Are Display-Only

**Critical Constraint:** Timers **never** trigger automatic game actions.

- ❌ No auto-pass when Charleston timer expires
- ❌ No auto-discard when turn timer expires
- ❌ No auto-close call window when timer reaches zero
- ✅ Frontend displays countdown for pacing
- ✅ Players can take as long as they want (within reasonable limits)
- ✅ Server may implement separate idle timeout for disconnections (not part of this phase)

This design choice aligns with casual gameplay and prevents frustration from accidental timeouts. Competitive modes can add enforcement later without changing timer display logic.

### Timer Mode Semantics

**Visible Mode:**

- Timer value included in events
- Frontend displays countdown (e.g., "8 seconds remaining")
- Players aware of time pressure, but not enforced
- Typical for competitive/casual online games

**Hidden Mode:**

- Timer value still included in events (for consistency)
- Frontend ignores timer and doesn't display it
- No time pressure on players
- Typical for teaching games or async play

The distinction is purely presentational - the backend behavior is identical.

### Charleston Timer Lifecycle

Each Charleston stage gets a fresh timer:

1. `CharlestonPhaseChanged` emitted (e.g., FirstRight → FirstAcross)
2. `CharlestonTimerStarted` emitted immediately after
3. Timer value is always `ruleset.charleston_timer_seconds`
4. Frontend starts countdown from this value
5. When all players ready, timer becomes irrelevant (stage advances)

**Important:** The `CharlestonState.timer` field stores the **initial duration**, not the current countdown. Countdown logic is client-side only.

### Call Window Timer Lifecycle

1. `TileDiscarded` emitted
2. `CallWindowOpened` emitted with `timer` field
3. `TurnStage::CallWindow` created with `timer` field
4. Frontend starts countdown
5. Window closes when:
   - All players pass (no timer involved)
   - Someone declares call intent and window resolves
   - Timer expires (frontend only - server doesn't enforce)

**Server Behavior:** Server keeps window open indefinitely until all players act or someone calls. Timer is for client display only.

### Backward Compatibility

**Breaking Change:** `CharlestonState::new()` now requires a `timer_seconds` parameter.

All existing code that creates `CharlestonState` must be updated:

- Tests: Pass explicit duration (e.g., `60`)
- Table: Pass `self.house_rules.ruleset.charleston_timer_seconds`

**Event Schema Change:** `CallWindowOpened` gains a `timer` field.

Frontend must handle this gracefully:

- Old clients may not expect `timer` field (add optional in bindings)
- New clients should always receive `timer`

Consider adding a migration note to frontend documentation.

### Testing Strategy

**Unit Tests:** Verify timer values flow from ruleset to game state.

- Create table with custom timer durations
- Check `CharlestonState.timer` matches ruleset
- Check `CallWindow.timer` matches ruleset

**Integration Tests:** Verify timer values appear in events.

- Emit `CharlestonTimerStarted` with correct duration
- Emit `CallWindowOpened` with correct timer

**Regression Tests:** Ensure existing tests still pass.

- Update all `CharlestonState::new()` calls
- Verify no logic depends on hardcoded timer values

**Manual Testing (Frontend):**

- Visible mode: Timer appears and counts down
- Hidden mode: No timer displayed
- Timer values match configured durations
- Timer expiration doesn't break the game

### Future Enhancements (Out of Scope)

**Phase 0.6 does NOT implement:**

- ❌ Idle timeout enforcement (kick inactive players)
- ❌ Turn timer auto-advance (force discard on timeout)
- ❌ Timer warnings ("5 seconds remaining!" notification)
- ❌ Dynamic timer adjustment (faster timers as game progresses)
- ❌ Per-player timer preferences (some players get more time)

These may be added in later phases (e.g., "Phase 2.x: Competitive Rules") but are explicitly out of scope for baseline MVP.

### Alternative Considered: Server-Side Countdown

An earlier design considered having the server maintain countdown state and emit periodic `TimerTick` events. This was rejected because:

- Adds network overhead (frequent events)
- Complicates server state management
- Doesn't align with "display only" semantics
- Client-side countdown is simpler and more responsive

Instead, server emits **initial duration** only, and clients handle countdown locally. If clients drift, it doesn't matter - timer doesn't enforce anything anyway.

### Implementation Order Rationale

The steps are ordered to minimize test breakage:

1. Add new event fields (backward compatible if optional)
2. Update core initialization logic
3. Emit new events
4. Update tests to match
5. Regenerate bindings last (ensures all changes captured)

This allows incremental progress with tests passing at each milestone.

---

## Implementation Sessions

This implementation is divided into 2 sessions to maintain focus and provide natural checkpoints.

### Session 1: Core Implementation + Test Fixes

**Goal:** Get all core timer functionality working with tests passing.

**Steps to complete:** 0.6.1 - 0.6.6, 0.6.10

**Checklist:**

- [ ] 0.6.1: Add timer fields to `CallWindowOpened` event (event.rs + playing.rs)
- [ ] 0.6.2: Add `CharlestonTimerStarted` event (event.rs only)
- [ ] 0.6.3: Update `CharlestonState::new()` signature to accept `timer_seconds` (flow.rs)
- [ ] 0.6.4: Wire up ruleset timers in table handlers
  - [ ] Update setup.rs to pass timer to `CharlestonState::new()`
  - [ ] Add `CharlestonTimerStarted` emissions in charleston.rs (verify all 7 locations with grep)
- [ ] 0.6.5: Use ruleset timer in `CallWindow` creation (playing.rs)
- [ ] 0.6.6: Add `timers_visible()` helper method (snapshot.rs)
- [ ] 0.6.10: Fix all broken tests
  - [ ] Update 6 test calls to `CharlestonState::new(60)` (flow.rs x3, charleston_flow.rs x1, table/tests.rs x2)
  - [ ] Update any `CallWindowOpened` event assertions to include new fields
- [ ] **Verify:** Run `cargo test --package mahjong_core` - all tests should pass
- [ ] **Verify:** Run grep to confirm all 7 Charleston stage changes emit timer events

**Exit criteria:**

- Code compiles without errors
- All `mahjong_core` tests pass
- Charleston timer events emitted at all 7 stage transitions (verified via grep)

**Estimated time:** 3-5 hours

---

### Session 2: Comprehensive Tests + Documentation

**Goal:** Add comprehensive test coverage, update documentation, regenerate bindings.

**Steps to complete:** 0.6.7 - 0.6.9, 0.6.11 - 0.6.12

**Checklist:**

- [ ] 0.6.7: Verify server integration (timer mode already in snapshot - no changes needed)
- [ ] 0.6.8: Create `timer_behavior.rs` test file with comprehensive tests
  - [ ] `test_charleston_timer_from_ruleset()`
  - [ ] `test_call_window_timer_from_ruleset()`
  - [ ] `test_timer_mode_visible()`
  - [ ] `test_timer_mode_hidden()`
  - [ ] `test_charleston_stage_advances_with_new_timer_event()`
  - [ ] `test_default_timer_values()`
- [ ] 0.6.9: Add event timer value tests
  - [ ] `test_call_window_opened_includes_timer()`
  - [ ] `test_charleston_timer_started_on_phase_change()`
- [ ] 0.6.11: Update architecture documentation
  - [ ] Update `docs/architecture/04-state-machine-design.md` (CharlestonState docs)
  - [ ] Update `docs/architecture/06-command-event-system-api-contract.md` (event examples)
- [ ] 0.6.12: Regenerate TypeScript bindings
  - [ ] Run `cd crates/mahjong_core && cargo test export_bindings`
  - [ ] Verify `GameEvent.ts`, `CharlestonState.ts`, `TurnStage.ts` updated
- [ ] **Verify:** Run full test suite `cargo test` - all tests pass including new ones
- [ ] **Verify:** Check git diff to ensure bindings were regenerated

**Exit criteria:**

- All tests in `timer_behavior.rs` pass (10+ tests)
- Architecture docs updated
- TypeScript bindings regenerated and contain new timer fields
- Full test suite passes (`cargo test`)

**Estimated time:** 2-3 hours

---

## Revision History

**2026-01-08 Update:** Corrected implementation plan based on actual codebase state:

1. **Added Timestamp Strategy section** - Clarified that `started_at_ms` should use `0` placeholder in core crate (server enriches later)
2. **Updated file paths** - Changed from monolithic `table.rs` to modular `table/handlers/*.rs` structure
3. **Removed `is_public()` confusion** - Method doesn't exist; no visibility changes needed
4. **Added `timers_visible()` as new method** - Not verification, but actual implementation
5. **Provided explicit test locations** - Listed all 7 `CharlestonState::new()` call sites to update
6. **Added Charleston timer event locations** - Specified 7 stage transitions that need timer events
7. **Corrected line number references** - Updated to reflect current codebase structure

These corrections ensure the plan is implementable by another AI without encountering blockers or confusion about non-existent methods/files.
