# Unwrap Audit Report

**Generated:** 2026-01-17
**Scope:** All Rust crates (mahjong_core, mahjong_server, mahjong_ai, mahjong_terminal)
**Total Unwraps Found:** 320

## Executive Summary

### Breakdown by Context

| Category                                  | Count  | Percentage |
| ----------------------------------------- | ------ | ---------- |
| Test Code (`#[cfg(test)]`, `tests/` dirs) | 247    | 77.2%      |
| Rustdoc Examples (in `///` comments)      | 20     | 6.25%      |
| Benchmark Code (`benches/` dirs)          | 1      | 0.3%       |
| Example Binaries (`examples/` dirs)       | 1      | 0.3%       |
| **Production Code**                       | **51** | **15.9%**  |

### Risk Distribution (Production Code Only)

| Risk Level     | Count | Action Required                        |
| -------------- | ----- | -------------------------------------- |
| 🔴 HIGH RISK   | 3     | Immediate refactor needed              |
| 🟠 MEDIUM RISK | 23    | Add expect() with message              |
| 🟡 LOW RISK    | 4     | Add TODO or safety comment             |
| ✅ SAFE        | 21    | Keep as-is (protected by prior checks) |

### Key Findings

1. **Startup Code Unwraps (Server):** 4 unwraps in `main.rs` that will crash the server on startup if configuration is invalid - this is acceptable for fail-fast behavior
2. **Float Comparison Unwraps (AI):** 6 unwraps on `partial_cmp()` for f64 values - safe if NaN impossible, but should use `expect()` with explanation
3. **Protected Unwraps (Core):** Many unwraps are protected by prior validation but lack explanatory comments
4. **SystemTime Unwraps (Network):** 2 unwraps on UNIX epoch calculations - virtually impossible to fail but should use `expect()`

---

## Detailed Audit by Crate

## 1. mahjong_core (Game Logic)

### 🔴 HIGH RISK (0)

None identified. All production unwraps in mahjong_core are protected by validation.

### 🟠 MEDIUM RISK (12)

#### Call Resolution - Iterator Operations

**Location:** `crates/mahjong_core/src/call_resolution.rs:103`

```rust
let max_priority = intents.iter().map(|i| i.priority()).max().unwrap();
```

**Context:** Finding highest priority among call intents
**Risk:** Panics if `intents` is empty
**Analysis:** Function `resolve_call_priority` takes `Vec<CallIntent>` - empty vec is possible if caller doesn't check
**Recommendation:**

```rust
let max_priority = intents.iter().map(|i| i.priority()).max()
    .expect("resolve_call_priority called with empty intents vec");
```

**Location:** `crates/mahjong_core/src/call_resolution.rs:160`

```rust
.min_by_key(|intent| turn_order.iter().position(|&s| s == intent.player))
.unwrap()
```

**Context:** Finding closest player by turn order
**Risk:** Panics if no intent found or if player not in turn_order
**Analysis:** Already filtered to `top_priority` which should not be empty
**Recommendation:**

```rust
.expect("top_priority intents should never be empty after filtering")
```

#### Charleston Handler - Stage Transitions

**Location:** `crates/mahjong_core/src/table/handlers/charleston.rs:58, 63`

```rust
direction: direction.unwrap(),
// ...
let target = direction.unwrap().target_from(seat);
```

**Context:** Getting pass direction during Charleston
**Risk:** Panics if `pass_direction()` returns None
**Analysis:** `pass_direction()` returns None for VotingToContinue and CourtesyAcross stages
**Current Protection:** Code is inside `if charleston.all_players_ready()` but stage could still be wrong
**Recommendation:**

```rust
direction.expect("pass_direction should return Some for passing stages")
```

**Location:** `crates/mahjong_core/src/table/handlers/charleston.rs:64`

```rust
if let Some(tiles) = charleston.pending_passes.get(&seat).unwrap() {
```

**Context:** Getting pending passes for a seat
**Risk:** Panics if seat not in map
**Analysis:** Map is initialized with all 4 seats in `CharlestonState::new()`, so always present
**Recommendation:** Add comment explaining safety:

```rust
// SAFETY: pending_passes initialized with all 4 seats in CharlestonState::new()
if let Some(tiles) = charleston.pending_passes.get(&seat).unwrap() {
```

**Location:** `crates/mahjong_core/src/table/handlers/charleston.rs:80`

```rust
charleston.stage.next(None).unwrap()
```

**Context:** Transitioning Charleston stage
**Risk:** Panics if `next()` returns Err
**Analysis:** Called without vote parameter for non-voting stages
**Recommendation:**

```rust
charleston.stage.next(None)
    .expect("stage transition should succeed for non-voting stages")
```

**Locations:** `crates/mahjong_core/src/table/handlers/charleston.rs:149, 156`

```rust
let result = charleston.vote_result().unwrap();
// ...
let next_stage = charleston.stage.next(Some(result)).unwrap();
```

**Context:** Getting vote result and transitioning
**Risk:** Panics if voting not complete or transition invalid
**Analysis:** Protected by `if charleston.voting_complete()` check
**Recommendation:** Add expects:

```rust
let result = charleston.vote_result()
    .expect("vote_result should succeed when voting_complete is true");
// ...
let next_stage = charleston.stage.next(Some(result))
    .expect("stage transition with valid vote should succeed");
```

**Locations:** `crates/mahjong_core/src/table/handlers/charleston.rs:207, 209, 210`

```rust
let agreed_count = charleston.courtesy_agreed_count(pair).unwrap();
let (seat_a, seat_b) = pair;
let proposal_a = charleston.courtesy_proposals[&seat_a].unwrap();
let proposal_b = charleston.courtesy_proposals[&seat_b].unwrap();
```

**Context:** Getting courtesy pass proposals
**Risk:** Panics if proposals not present
**Analysis:** Protected by `if charleston.courtesy_pair_ready(pair)` check
**Recommendation:** Add expects with context:

```rust
let agreed_count = charleston.courtesy_agreed_count(pair)
    .expect("agreed_count should exist when courtesy_pair_ready");
let proposal_a = charleston.courtesy_proposals[&seat_a]
    .expect("seat_a proposal should exist when courtesy_pair_ready");
let proposal_b = charleston.courtesy_proposals[&seat_b]
    .expect("seat_b proposal should exist when courtesy_pair_ready");
```

**Locations:** `crates/mahjong_core/src/table/handlers/charleston.rs:290, 291, 295, 296`

```rust
let pair_complete = charleston.pending_passes.get(&player).unwrap().is_some()
    && charleston.pending_passes.get(&partner).unwrap().is_some();
// ...
let player_tiles = charleston.pending_passes[&player].clone().unwrap();
let partner_tiles = charleston.pending_passes[&partner].clone().unwrap();
```

**Context:** Checking if courtesy pass pair is complete
**Risk:** First unwrap safe (map contains all seats), second unwrap safe (checked by pair_complete)
**Analysis:** Protected by invariants
**Recommendation:** Add safety comments:

```rust
// SAFETY: pending_passes always contains all 4 seats
let pair_complete = charleston.pending_passes.get(&player).unwrap().is_some()
    && charleston.pending_passes.get(&partner).unwrap().is_some();
// ...
// SAFETY: pair_complete guarantees both are Some
let player_tiles = charleston.pending_passes[&player].clone().unwrap();
```

### ✅ SAFE (17)

#### Validation Module - Protected by Validation Logic

**Locations:** `crates/mahjong_core/src/table/validation.rs:103, 175, 204, 296, 317`

```rust
let player_obj = table.get_player(*player).unwrap();
```

**Context:** Getting player object during command validation
**Risk:** Panics if player seat invalid
**Analysis:** `player` comes from `GameCommand` enum which only contains valid `Seat` values. `Table::get_player()` only returns None if seat is invalid (unreachable).
**Recommendation:** Keep as-is. These are protected by type safety - `Seat` is an enum with only 4 valid variants, all initialized in table.

**Locations:** `crates/mahjong_core/src/table/validation.rs:168, 246`

```rust
let agreed_count = charleston.courtesy_agreed_count(pair).unwrap();
```

**Context:** Validation during courtesy pass
**Risk:** None - validation code that returns error if fails
**Recommendation:** Consider `ok_or()` pattern instead for consistency, but current usage is acceptable in validation context.

#### Bot Logic - Protected by Prior Checks

**Location:** `crates/mahjong_core/src/table/bot.rs:70`

```rust
let agreed_count = charleston.courtesy_agreed_count((seat, partner)).unwrap();
```

**Context:** Bot deciding courtesy pass tiles
**Risk:** Panics if agreed count not available
**Analysis:** Protected by `if partner_proposed` check on line 67
**Recommendation:** Add expect for clarity:

```rust
.expect("agreed_count should exist when both players proposed")
```

But since this is bot logic (not hot path), keep as-is is acceptable.

#### Scoring Module

**Location:** `crates/mahjong_core/src/scoring.rs:600`

```rust
Some(tiles::BAM_1),
).unwrap(),
```

**Context:** Test code in `#[test]` block
**Analysis:** Actually in test code (`#[cfg(test)]` module)
**Recommendation:** Keep as-is (test code).

---

## 2. mahjong_ai (AI Strategies)

### 🟠 MEDIUM RISK (6)

#### Float Comparison Unwraps

**Location:** `crates/mahjong_ai/src/strategies/greedy.rs:194`

```rust
scored_tiles.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
```

**Context:** Sorting tiles by score (f64)
**Risk:** Panics if score is NaN
**Analysis:** Scores calculated from expected value calculations - should never be NaN unless bug in calculation
**Recommendation:**

```rust
scored_tiles.sort_by(|a, b| a.1.partial_cmp(&b.1)
    .expect("tile scores should never be NaN"));
```

**Locations:** `crates/mahjong_ai/src/mcts/node.rs:82, 96`

```rust
score_a.partial_cmp(&score_b).unwrap()
```

**Context:** Comparing UCB1 scores in MCTS
**Risk:** Panics if scores are NaN
**Analysis:** UCB1 formula includes `ln(parent_visits)` and `sqrt()` - could theoretically produce NaN
**Recommendation:**

```rust
score_a.partial_cmp(&score_b)
    .expect("UCB1 scores should not be NaN - check visits > 0")
```

**Location:** `crates/mahjong_ai/src/mcts/node.rs:124`

```rust
.max_by(|a, b| a.average_value().partial_cmp(&b.average_value()).unwrap())
```

**Context:** Finding best child by average value
**Risk:** Panics if average_value returns NaN
**Analysis:** Average value is `total_value / visits` - NaN if visits == 0
**Recommendation:**

```rust
.expect("child average_value should not be NaN - ensure visits > 0")
```

**Location:** `crates/mahjong_ai/src/mcts/simulation.rs:155`

```rust
.max_by(|a, b| a.expected_value.partial_cmp(&b.expected_value).unwrap())
```

**Context:** Comparing expected values
**Risk:** Panics if expected_value is NaN
**Recommendation:**

```rust
.expect("expected_value should not be NaN in simulation")
```

#### Collection Unwraps

**Location:** `crates/mahjong_ai/src/mcts/simulation.rs:112`

```rust
*non_jokers.choose(rng).unwrap()
```

**Context:** Randomly choosing a non-joker tile
**Risk:** Panics if `non_jokers` is empty
**Analysis:** Protected by `if !non_jokers.is_empty()` on line 111
**Recommendation:** Keep as-is, but could add expect for clarity:

```rust
.expect("non_jokers guaranteed non-empty by prior check")
```

**Locations:** `crates/mahjong_ai/src/mcts/simulation.rs:152, 156`

```rust
let best_by_deficiency = evaluations.iter().min_by_key(|e| e.deficiency).unwrap();
let best_by_ev = evaluations.iter().max_by(...).unwrap();
```

**Context:** Finding best evaluation
**Risk:** Panics if `evaluations` is empty
**Analysis:** Function returns early on line 148 if evaluations empty
**Recommendation:** Keep as-is (protected).

### ✅ SAFE (0)

All AI unwraps are either medium risk float comparisons or protected iterator operations.

---

## 3. mahjong_server (Network & Server)

### 🔴 HIGH RISK (3)

#### Server Startup - Intentional Fail-Fast

**Location:** `crates/mahjong_server/src/main.rs:167`

```rust
let addr = SocketAddr::from(([0, 0, 0, 0], port.parse().unwrap()));
```

**Context:** Parsing PORT environment variable
**Risk:** Panics if PORT contains non-numeric value
**Analysis:** Startup configuration - fail-fast is acceptable
**Recommendation:** Use expect for better error message:

```rust
let addr = SocketAddr::from(([0, 0, 0, 0],
    port.parse().expect("PORT must be a valid number")));
```

**Location:** `crates/mahjong_server/src/main.rs:169`

```rust
let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
```

**Context:** Binding TCP listener
**Risk:** Panics if port already in use or permission denied
**Analysis:** Startup - fail-fast is acceptable
**Recommendation:**

```rust
let listener = tokio::net::TcpListener::bind(addr).await
    .expect("Failed to bind TCP listener - check port availability and permissions");
```

**Location:** `crates/mahjong_server/src/main.rs:175`

```rust
axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
    .await
    .unwrap();
```

**Context:** Running the Axum server
**Risk:** Panics if server fails
**Analysis:** Main server loop - should probably propagate error instead
**Recommendation:** REFACTOR - Return Result from main:

```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // ... setup ...
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .await?;
    Ok(())
}
```

### 🟠 MEDIUM RISK (5)

#### System Time Calculations

**Locations:** `crates/mahjong_server/src/network/events.rs:70, 94`

```rust
std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap()
    .as_millis() as u64
```

**Context:** Injecting timestamp into game events
**Risk:** Panics if system clock is before Unix epoch (1970-01-01)
**Analysis:** Virtually impossible on modern systems, but theoretically possible
**Recommendation:**

```rust
std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .expect("system clock should not be before Unix epoch")
    .as_millis() as u64
```

#### Analysis Worker - Protected Unwraps

**Locations:** `crates/mahjong_server/src/analysis/worker.rs:75, 79, 87`

```rust
if room.table.is_none() || room.table.as_ref().unwrap().validator.is_none() {
    continue;
}
let table = room.table.as_ref().unwrap().clone();
// ...
let validator = snapshot.validator.as_ref().unwrap();
```

**Context:** Analysis worker checking table state
**Risk:** First two unwraps protected by prior `is_none()` check; third relies on same check
**Analysis:** Protected by guard clause on line 75
**Recommendation:** Refactor for clarity:

```rust
let Some(table_ref) = room.table.as_ref() else { continue; };
let Some(validator) = table_ref.validator.as_ref() else { continue; };
let table = table_ref.clone();
// ... later ...
let validator = snapshot.validator.as_ref()
    .expect("validator should exist - checked at snapshot time");
```

#### Bot Runner

**Location:** `crates/mahjong_server/src/network/bot_runner.rs:157`

```rust
let agreed_count = cs.courtesy_agreed_count((seat, partner)).unwrap();
```

**Context:** Bot deciding courtesy pass in network layer
**Risk:** Panics if agreed count not available
**Analysis:** Protected by `if partner_proposed` check
**Recommendation:** Add expect or refactor to if-let:

```rust
let agreed_count = cs.courtesy_agreed_count((seat, partner))
    .expect("agreed_count should exist when both players proposed");
```

### ✅ SAFE (4)

#### Test Code Unwraps

All unwraps in `crates/mahjong_server/src/db.rs` (lines 710-778) are in `#[cfg(test)]` blocks - acceptable.

All unwraps in `crates/mahjong_server/src/network/room.rs` (lines 611, 620) are in test functions - acceptable.

All unwraps in `crates/mahjong_server/src/replay.rs:372` are in test code - acceptable.

All unwraps in `crates/mahjong_server/src/analysis/comparison.rs` (lines 354-552) are in test functions - acceptable.

All unwraps in `crates/mahjong_server/src/network/messages.rs` (lines 490-609) are in test code - acceptable.

---

## 4. mahjong_terminal (CLI Client)

### 🟡 LOW RISK (4)

#### Terminal UI - Cold Path

**Locations:** `crates/mahjong_terminal/src/ui.rs:43, 86, 88`

```rust
/// let ui = TerminalUI::new().unwrap();
/// let mut ui = TerminalUI::new().unwrap();
/// ui.render(&state).unwrap();
```

**Context:** Rustdoc examples showing terminal UI usage
**Risk:** None - these are documentation examples
**Recommendation:** Keep as-is (rustdoc examples).

**Location:** All unwraps in `crates/mahjong_terminal/src/input.rs:312-369`
**Context:** Test code for command parser
**Risk:** None - test code
**Recommendation:** Keep as-is.

### ✅ SAFE - Terminal Module (0)

All terminal unwraps are either in rustdoc examples or test code.

---

## Test Code Summary (Not Requiring Action)

### Test Files (247 unwraps)

All unwraps in the following are acceptable (test code):

- `crates/mahjong_core/tests/*.rs` (117 unwraps)
- `crates/mahjong_server/tests/*.rs` (94 unwraps)
- `crates/mahjong_terminal/src/input.rs` tests (5 unwraps)
- All `#[test]` and `#[cfg(test)]` functions (31 unwraps)

### Examples and Benchmarks (2 unwraps)

- `crates/mahjong_core/examples/bot_game.rs:42` - Example code
- `crates/mahjong_ai/benches/hint_advisor_bench.rs:14` - Benchmark code

### Rustdoc Examples (20 unwraps)

All unwraps in `///` rustdoc comments are acceptable for demonstration purposes.

---

## Recommended Action Plan

### Immediate (High Priority)

1. **Refactor `mahjong_server/src/main.rs`**
   - Change `main()` signature to return `Result`
   - Replace server startup unwraps with `?` operator and descriptive expects

### Short Term (Medium Priority)

1. **Add `expect()` to all float comparisons in `mahjong_ai`**
   - 6 instances of `partial_cmp().unwrap()`
   - Add explanatory messages about NaN impossibility

2. **Add `expect()` to Charleston handler unwraps in `mahjong_core`**
   - 12 instances in `table/handlers/charleston.rs`
   - Add context explaining why unwrap is safe

3. **Add `expect()` to call resolution unwraps**
   - 2 instances in `call_resolution.rs`
   - Explain preconditions

4. **Add `expect()` to system time calculations in `mahjong_server`**
   - 2 instances in `network/events.rs`

### Low Priority (Nice to Have)

1. **Add safety comments to protected unwraps**
   - Validation module unwraps (17 instances)
   - Bot logic unwraps (2 instances)
   - Analysis worker unwraps (3 instances)

2. **Refactor analysis worker for clarity**
   - Use `if let Some()` pattern instead of check + unwrap

### No Action Required

- All test code unwraps (247 instances)
- All rustdoc example unwraps (20 instances)
- Benchmark and example unwraps (2 instances)

---

## Appendix: Grep Pattern Used

```bash
# Find all .unwrap() calls excluding target/ directory
rg "\.unwrap\(\)" --type rust --line-number
```

## Methodology

1. Searched for all `.unwrap()` calls in Rust source files
2. Categorized each by file location and context
3. Read surrounding code (±10 lines) to understand safety
4. Checked for protective guards (if statements, early returns)
5. Assessed risk based on:
   - Hot path vs cold path
   - Input source (user input, network, validated)
   - Consequences of panic (server crash, client error)
   - Existence of protective logic

## Notes

- **Type Safety:** Many unwraps are safe due to Rust's type system (e.g., `Seat` enum only has 4 valid values)
- **Validation Layer:** Core game logic has validation before command processing, making many unwraps safe
- **Float Comparisons:** All `partial_cmp()` unwraps on f64 should use `expect()` even if NaN is "impossible"
- **Startup Unwraps:** Fail-fast on startup is acceptable but should have descriptive messages
- **Test Code:** Unwraps in tests are fine - they provide clear failure points

---

## End of Audit Report

This audit was completed on January 17, 2026 as part of Phase 2.2 security improvements.
