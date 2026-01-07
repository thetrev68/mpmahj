# Phase 0.6: Timer Behavior - Detailed Implementation Plan

**Status:** PLANNED

**Created:** 2026-01-07

**Goal:** Implement server-side timer metadata aligned with ruleset configuration. Timers are **visual indicators only** - they never auto-advance game state. Support two modes: Visible (timer shown to players) and Hidden (no timer display).

## Current State Analysis

### Existing Structure

| Component                                                                 | Status           | Details                                                        |
| ------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------- |
| [`TimerMode`](crates/mahjong_core/src/table.rs:39)                        | ✅ Exists        | Enum with `Visible` and `Hidden` variants (added in Phase 0.3) |
| [`Ruleset.timer_mode`](crates/mahjong_core/src/table.rs:55)               | ✅ Exists        | Timer mode stored in ruleset                                   |
| [`Ruleset.call_window_seconds`](crates/mahjong_core/src/table.rs:62)      | ✅ Exists        | Duration for call windows                                      |
| [`Ruleset.charleston_timer_seconds`](crates/mahjong_core/src/table.rs:65) | ✅ Exists        | Duration for Charleston passes                                 |
| [`CharlestonState.timer`](crates/mahjong_core/src/flow.rs:307)            | ✅ Exists        | Hardcoded to 60 seconds                                        |
| [`TurnStage::CallWindow.timer`](crates/mahjong_core/src/flow.rs:397)      | ✅ Exists        | Timer field in CallWindow                                      |
| `CallWindowOpened` event                                                  | ⚠️ Missing timer | Event doesn't include timer value                              |
| Charleston timer events                                                   | ❌ Missing       | No events for Charleston timer updates                         |

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

## Implementation Steps

**Note:** Line numbers are approximate. Search for function/struct names if they've shifted.

### 0.6.1: Core - Add Timer Metadata to CallWindowOpened Event

**File:** [`crates/mahjong_core/src/event.rs`](crates/mahjong_core/src/event.rs) (around line 94)

**Update `CallWindowOpened` event:**

```rust
/// Call window opened (other players can call or pass)
CallWindowOpened {
    tile: Tile,
    discarded_by: Seat,
    /// Players who can call (excludes discarder)
    can_call: Vec<Seat>,
    /// Timer duration in seconds (from ruleset)
    timer: u32,
    /// Server start timestamp (epoch ms)
    started_at_ms: u64,
    /// Whether timer should be shown
    timer_mode: TimerMode,
},
```

**File:** [`crates/mahjong_core/src/table.rs`](crates/mahjong_core/src/table.rs)

**Find all `CallWindowOpened` emissions and add timer field:**

Search for `GameEvent::CallWindowOpened` and update to include ruleset values and a server timestamp:

```rust
// Example (around line 1050 in apply_discard_tile):
events.push(GameEvent::CallWindowOpened {
    tile,
    discarded_by: player,
    can_call: can_call_seats,
    timer: self.house_rules.ruleset.call_window_seconds,
    started_at_ms: now_ms,
    timer_mode: self.house_rules.ruleset.timer_mode,
});
```

**Client note:** always emit timer metadata; clients hide UI when `timer_mode` is `Hidden`.

---

### 0.6.2: Core - Add Timer Events for Charleston

**File:** [`crates/mahjong_core/src/event.rs`](crates/mahjong_core/src/event.rs) (around line 54)

**Add new Charleston timer event:**

```rust
/// Charleston timer started for current pass stage
CharlestonTimerStarted {
    stage: CharlestonStage,
    duration: u32, // seconds
    started_at_ms: u64,
    timer_mode: TimerMode,
},
```

**Update `is_public()` method to include new event (around line 200):**

```rust
pub fn is_public(&self) -> bool {
    matches!(
        self,
        GameEvent::GameStarting
            | GameEvent::PlayerJoined { .. }
            | GameEvent::PlayerLeft { .. }
            | GameEvent::PhaseChanged { .. }
            | GameEvent::CharlestonPhaseChanged { .. }
            | GameEvent::CharlestonTimerStarted { .. }  // Add this
            | GameEvent::TileDiscarded { .. }
            // ... rest of matches
    )
}
```

---

### 0.6.3: Core - Initialize Charleston Timer from Ruleset

**File:** [`crates/mahjong_core/src/flow.rs`](crates/mahjong_core/src/flow.rs) (around line 310)

**Update `CharlestonState::new()` to accept timer duration:**

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
    }
}
```

**Remove hardcoded default:**

Delete or update the `Default` impl if it exists (it currently hardcodes 60):

```rust
// REMOVE THIS if it exists:
impl Default for CharlestonState {
    fn default() -> Self {
        Self::new(60)  // Don't use default, require explicit timer
    }
}
```

---

### 0.6.4: Core - Update Table to Use Ruleset Timer

**File:** [`crates/mahjong_core/src/table.rs`](crates/mahjong_core/src/table.rs)

**Find where `CharlestonState` is created (search for `CharlestonState::new`):**

Around line 269 in `transition_phase()`:

```rust
PhaseTrigger::AllPlayersJoined => {
    match self.phase {
        GamePhase::WaitingForPlayers => {
            // ... deal tiles logic ...

            // Create Charleston state with timer from ruleset
            let charleston_timer = self.house_rules.ruleset.charleston_timer_seconds;
            self.charleston_state = Some(CharlestonState::new(charleston_timer));

            // ... rest of transition ...
        }
        // ... other cases ...
    }
}
```

**Find where Charleston stages advance and emit timer events:**

Search for `CharlestonPhaseChanged` emissions and add `CharlestonTimerStarted`:

```rust
// Example pattern (multiple locations):
events.push(GameEvent::CharlestonPhaseChanged { stage: new_stage });

// Add after each CharlestonPhaseChanged:
if let Some(charleston) = &self.charleston_state {
    if let Some(timer) = charleston.timer {
        events.push(GameEvent::CharlestonTimerStarted {
            stage: new_stage,
            duration: timer,
            started_at_ms: now_ms,
            timer_mode: self.house_rules.ruleset.timer_mode,
        });
    }
}
```

**Server note:** `now_ms` should come from the server clock (e.g., `SystemTime::now()`), not the client.

---

### 0.6.5: Core - Use Ruleset Timer in CallWindow Creation

**File:** [`crates/mahjong_core/src/table.rs`](crates/mahjong_core/src/table.rs)

**Find where `TurnStage::CallWindow` is created (search for `CallWindow {`):**

Around line 1078 in `apply_discard_tile()`:

```rust
// Open call window
self.phase = GamePhase::Playing(TurnStage::CallWindow {
    tile,
    discarded_by: player,
    can_act: can_call_seats.clone(),
    pending_intents: vec![],
    timer: self.house_rules.ruleset.call_window_seconds,  // Use ruleset value
});
```

---

### 0.6.6: Core - Add Snapshot Method for Timer Mode

**File:** [`crates/mahjong_core/src/snapshot.rs`](crates/mahjong_core/src/snapshot.rs)

**Verify accessor exists (added in Phase 0.3, around line 217):**

```rust
impl GameStateSnapshot {
    /// Get the timer mode for this game's ruleset.
    pub fn timer_mode(&self) -> &TimerMode {
        &self.house_rules.ruleset.timer_mode
    }

    /// Check if timers should be visible.
    pub fn timers_visible(&self) -> bool {
        matches!(self.house_rules.ruleset.timer_mode, TimerMode::Visible)
    }
}
```

**Add the `timers_visible()` helper if it doesn't exist.**

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

**Files to check and update:**

1. **[`crates/mahjong_core/tests/charleston_flow.rs`](crates/mahjong_core/tests/charleston_flow.rs)**
   - Update `CharlestonState::new()` calls to include timer duration
   - Example: `CharlestonState::new(60)`

2. **[`crates/mahjong_server/tests/full_game_lifecycle.rs`](crates/mahjong_server/tests/full_game_lifecycle.rs)**
   - Verify timer fields are present in events
   - May need to update assertions to check for `timer` field

**Search and replace pattern:**

```bash
# Find all CharlestonState::new() without arguments
grep -r "CharlestonState::new()" crates/

# Update each to pass timer duration from ruleset or use default
CharlestonState::new(60)  # or get from table.house_rules.ruleset.charleston_timer_seconds
```

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

| File                                                                                                                     | Changes                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`crates/mahjong_core/src/event.rs`](crates/mahjong_core/src/event.rs)                                                   | Add `timer` to `CallWindowOpened`, add `CharlestonTimerStarted` event, update `is_public()`                                                                           |
| [`crates/mahjong_core/src/flow.rs`](crates/mahjong_core/src/flow.rs)                                                     | Update `CharlestonState::new()` to accept timer duration, add `reset_for_next_pass()`                                                                                 |
| [`crates/mahjong_core/src/table.rs`](crates/mahjong_core/src/table.rs)                                                   | Pass ruleset timer to `CharlestonState::new()`, use ruleset timer in `CallWindow` creation, emit `CharlestonTimerStarted` events, update `CallWindowOpened` emissions |
| [`crates/mahjong_core/src/snapshot.rs`](crates/mahjong_core/src/snapshot.rs)                                             | Add `timers_visible()` helper method                                                                                                                                  |
| [`crates/mahjong_core/tests/timer_behavior.rs`](crates/mahjong_core/tests/timer_behavior.rs)                             | New test file with 10+ tests for timer behavior                                                                                                                       |
| [`crates/mahjong_core/tests/charleston_flow.rs`](crates/mahjong_core/tests/charleston_flow.rs)                           | Update `CharlestonState::new()` calls to pass timer                                                                                                                   |
| [`crates/mahjong_server/tests/full_game_lifecycle.rs`](crates/mahjong_server/tests/full_game_lifecycle.rs)               | Verify timer fields in events (may need assertion updates)                                                                                                            |
| [`docs/architecture/04-state-machine-design.md`](docs/architecture/04-state-machine-design.md)                           | Update CharlestonState documentation                                                                                                                                  |
| [`docs/architecture/06-command-event-system-api-contract.md`](docs/architecture/06-command-event-system-api-contract.md) | Update event examples with timer fields                                                                                                                               |
| [`apps/client/src/types/bindings/generated/`](apps/client/src/types/bindings/generated/)                                 | Regenerated TypeScript bindings                                                                                                                                       |

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
