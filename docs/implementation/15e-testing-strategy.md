# Hint System: Comprehensive Testing Strategy (15e)

**Status:** READY FOR IMPLEMENTATION
**Prerequisites:** 15a, 15b, 15c, 15d (all backend implementation complete)
**Estimated Time:** 2-3 hours

## Overview

This document provides a complete testing strategy for the hint system, from unit tests to end-to-end integration tests. All test code is fully specified.

## Test Pyramid

```
        E2E Tests (1-2)
       /               \
    Integration (3-4)
   /                    \
Unit Tests (15-20)
```

## Unit Tests (Already Included in Previous Docs)

### Summary of Existing Tests

1. **15a: hint.rs** - 5 tests
   - `test_hint_skill_level_default`
   - `test_hint_data_empty`
   - `test_hint_data_not_empty_with_patterns`
   - `test_hint_data_not_empty_with_discard`
   - `test_hot_hand_detection`

2. **15b: hint_generator.rs** - 10 tests
   - `test_generate_empty_for_disabled`
   - `test_generate_empty_for_no_viable_patterns`
   - `test_generate_hot_hand_detection`
   - `test_select_best_patterns_counts`
   - `test_extract_pattern_name`
   - `test_calculate_missing_tiles`
   - `test_calculate_missing_tiles_complete_hand`
   - `test_recommend_discard_no_jokers`
   - `test_recommend_discard_returns_some`
   - `test_extract_tiles_needed_combines_patterns`

3. **15c: event.rs** - 1 test
   - `test_hint_update_is_private`

4. **15d: hint handler** - 1 test
   - `test_set_hint_level`

**Total Unit Tests: 17**

## Integration Tests

### Test 1: Full Hint Pipeline with Real Card Data

**File:** `crates/mahjong_server/tests/hint_full_pipeline.rs` (NEW FILE)

```rust
//! Full hint system integration test with real game state.

use mahjong_ai::evaluation::StrategicEvaluation;
use mahjong_ai::hint_generator::HintGenerator;
use mahjong_core::event::{GameEvent, PatternDifficulty};
use mahjong_core::hand::Hand;
use mahjong_core::hint::HintSkillLevel;
use mahjong_core::player::Seat;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::tiles::*;
use mahjong_server::network::room::Room;

#[tokio::test]
async fn test_hint_generation_with_real_card() {
    // Load actual 2025 card
    let card_json = include_str!("../../../data/cards/unified_card2025.json");
    let card = UnifiedCard::from_json(card_json).expect("Failed to parse card");
    let validator = HandValidator::new(&card);

    // Create a realistic hand (partial pattern)
    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3,  // Bam run
        CRAK_1, CRAK_1,       // Pair
        DOT_2, DOT_4, DOT_6,  // Even numbers
        WIND_EAST, WIND_EAST, // Pair
        JOKER, JOKER, JOKER,  // 3 Jokers
    ]);

    // Analyze the hand
    let analysis_results = validator.analyze(&hand, 10);
    assert!(!analysis_results.is_empty(), "Should find viable patterns");

    // Create mock evaluations (in real server, this comes from AI)
    let mut evaluations = Vec::new();
    for result in analysis_results.iter().take(5) {
        let histogram = validator.histogram_for_variation(&result.variation_id).unwrap();

        let eval = StrategicEvaluation {
            pattern_id: result.pattern_id.clone(),
            variation_id: result.variation_id.clone(),
            deficiency: result.deficiency,
            difficulty: result.deficiency as f64,
            difficulty_class: if result.deficiency <= 2 {
                PatternDifficulty::Easy
            } else if result.deficiency <= 4 {
                PatternDifficulty::Medium
            } else {
                PatternDifficulty::Hard
            },
            probability: 1.0 / (result.deficiency as f64 + 1.0),
            expected_value: (result.score as f64) / (result.deficiency as f64 + 1.0),
            score: result.score,
            viable: true,
        };
        evaluations.push(eval);
    }

    // Generate hints at different skill levels
    let beginner_hint = HintGenerator::generate(&evaluations, &hand, HintSkillLevel::Beginner, &validator);
    let intermediate_hint = HintGenerator::generate(&evaluations, &hand, HintSkillLevel::Intermediate, &validator);
    let expert_hint = HintGenerator::generate(&evaluations, &hand, HintSkillLevel::Expert, &validator);
    let disabled_hint = HintGenerator::generate(&evaluations, &hand, HintSkillLevel::Disabled, &validator);

    // Verify beginner gets most detail
    assert!(!beginner_hint.best_patterns.is_empty());
    assert_eq!(beginner_hint.best_patterns.len(), std::cmp::min(3, evaluations.len()));

    // Verify intermediate gets more patterns
    assert_eq!(intermediate_hint.best_patterns.len(), std::cmp::min(5, evaluations.len()));

    // Verify expert gets minimal patterns
    assert!(expert_hint.recommended_discard.is_none(), "Expert should not get discard recommendations");

    // Verify disabled gets nothing
    assert!(disabled_hint.is_empty(), "Disabled should get empty hint");

    // Verify distance to win is consistent
    let min_distance = evaluations.iter().map(|e| e.deficiency.max(0) as u8).min().unwrap_or(14);
    assert_eq!(beginner_hint.distance_to_win, min_distance);
    assert_eq!(intermediate_hint.distance_to_win, min_distance);
    assert_eq!(expert_hint.distance_to_win, min_distance);
}

#[tokio::test]
async fn test_hot_hand_scenario() {
    // Load card
    let card_json = include_str!("../../../data/cards/unified_card2025.json");
    let card = UnifiedCard::from_json(card_json).expect("Failed to parse card");
    let validator = HandValidator::new(&card);

    // Create a hand that's 1 tile away from winning
    // (This requires knowing a specific pattern - simplified for test)
    let hand = Hand::new(vec![
        BAM_1, BAM_1, BAM_2, BAM_2, BAM_3, BAM_3,
        DOT_1, DOT_1, DOT_2, DOT_2, DOT_3, DOT_3,
        WIND_EAST,  // Need 1 more WIND_EAST for pair
    ]);

    let analysis = validator.analyze(&hand, 10);

    // Find pattern closest to winning
    if let Some(closest) = analysis.first() {
        if closest.deficiency <= 1 {
            let histogram = validator.histogram_for_variation(&closest.variation_id).unwrap();

            let eval = StrategicEvaluation {
                pattern_id: closest.pattern_id.clone(),
                variation_id: closest.variation_id.clone(),
                deficiency: closest.deficiency,
                difficulty: 0.5,
                difficulty_class: PatternDifficulty::Easy,
                probability: 0.9,
                expected_value: 45.0,
                score: closest.score,
                viable: true,
            };

            let hint = HintGenerator::generate(&[eval], &hand, HintSkillLevel::Intermediate, &validator);

            assert_eq!(hint.distance_to_win, closest.deficiency.max(0) as u8);
            if hint.distance_to_win == 1 {
                assert!(hint.hot_hand, "Should detect hot hand (1 away)");
                assert!(!hint.tiles_needed_for_win.is_empty(), "Should list needed tiles");
            }
        }
    }
}
```

### Test 2: Room-Level Hint Settings

**File:** `crates/mahjong_server/tests/hint_room_settings.rs` (NEW FILE)

```rust
//! Test hint settings integration in Room.

use mahjong_core::hint::HintSkillLevel;
use mahjong_core::player::Seat;
use mahjong_server::network::room::Room;

#[tokio::test]
async fn test_default_hint_levels() {
    let (room, _rx) = Room::new();

    // All players should default to Intermediate
    assert_eq!(room.get_hint_level(Seat::East), HintSkillLevel::Intermediate);
    assert_eq!(room.get_hint_level(Seat::South), HintSkillLevel::Intermediate);
    assert_eq!(room.get_hint_level(Seat::West), HintSkillLevel::Intermediate);
    assert_eq!(room.get_hint_level(Seat::North), HintSkillLevel::Intermediate);
}

#[tokio::test]
async fn test_set_hint_levels_per_player() {
    let (mut room, _rx) = Room::new();

    // Set different levels for each player
    room.set_hint_level(Seat::East, HintSkillLevel::Beginner);
    room.set_hint_level(Seat::South, HintSkillLevel::Intermediate);
    room.set_hint_level(Seat::West, HintSkillLevel::Expert);
    room.set_hint_level(Seat::North, HintSkillLevel::Disabled);

    // Verify each player has correct setting
    assert_eq!(room.get_hint_level(Seat::East), HintSkillLevel::Beginner);
    assert_eq!(room.get_hint_level(Seat::South), HintSkillLevel::Intermediate);
    assert_eq!(room.get_hint_level(Seat::West), HintSkillLevel::Expert);
    assert_eq!(room.get_hint_level(Seat::North), HintSkillLevel::Disabled);
}

#[tokio::test]
async fn test_update_hint_level() {
    let (mut room, _rx) = Room::new();

    // Start with default
    assert_eq!(room.get_hint_level(Seat::East), HintSkillLevel::Intermediate);

    // Change to Beginner
    room.set_hint_level(Seat::East, HintSkillLevel::Beginner);
    assert_eq!(room.get_hint_level(Seat::East), HintSkillLevel::Beginner);

    // Change again to Expert
    room.set_hint_level(Seat::East, HintSkillLevel::Expert);
    assert_eq!(room.get_hint_level(Seat::East), HintSkillLevel::Expert);

    // Other players unaffected
    assert_eq!(room.get_hint_level(Seat::South), HintSkillLevel::Intermediate);
}
```

### Test 3: Event Privacy Verification

**File:** `crates/mahjong_core/tests/hint_event_privacy.rs` (NEW FILE)

```rust
//! Verify HintUpdate events are marked as private.

use mahjong_core::event::GameEvent;
use mahjong_core::hint::HintData;

#[test]
fn test_hint_update_is_private() {
    let event = GameEvent::HintUpdate {
        hint: HintData::empty(),
    };

    assert!(event.is_private(), "HintUpdate must be private event");
}

#[test]
fn test_hint_update_with_data_is_private() {
    use mahjong_core::hint::{BestPattern, HintSkillLevel};
    use mahjong_core::tile::tiles::*;

    let pattern = BestPattern {
        pattern_id: "TEST-001".to_string(),
        pattern_name: "Test Pattern".to_string(),
        probability: 0.8,
        score: 50,
        tiles_needed: vec![BAM_3, CRAK_6],
        distance: 2,
    };

    let hint = HintData {
        recommended_discard: Some(BAM_7),
        discard_reason: Some("Test reason".to_string()),
        best_patterns: vec![pattern],
        tiles_needed_for_win: vec![BAM_3],
        distance_to_win: 2,
        hot_hand: false,
    };

    let event = GameEvent::HintUpdate { hint };

    assert!(event.is_private(), "HintUpdate with data must be private");
}
```

### Test 4: Command Handling

**File:** `crates/mahjong_server/tests/hint_commands.rs` (NEW FILE)

```rust
//! Test hint command handling in server.

use mahjong_core::command::GameCommand;
use mahjong_core::hint::HintSkillLevel;
use mahjong_core::player::Seat;

#[test]
fn test_request_hint_command_structure() {
    let cmd = GameCommand::RequestHint {
        player: Seat::East,
        skill_level: HintSkillLevel::Beginner,
    };

    // Verify command can be created
    assert!(matches!(cmd, GameCommand::RequestHint { .. }));
}

#[test]
fn test_set_hint_level_command_structure() {
    let cmd = GameCommand::SetHintLevel {
        player: Seat::South,
        level: HintSkillLevel::Expert,
    };

    // Verify command can be created
    assert!(matches!(cmd, GameCommand::SetHintLevel { .. }));
}

#[test]
fn test_all_skill_levels() {
    let levels = vec![
        HintSkillLevel::Beginner,
        HintSkillLevel::Intermediate,
        HintSkillLevel::Expert,
        HintSkillLevel::Disabled,
    ];

    for level in levels {
        let cmd = GameCommand::SetHintLevel {
            player: Seat::East,
            level,
        };

        assert!(matches!(cmd, GameCommand::SetHintLevel { .. }));
    }
}
```

## End-to-End Test (Manual)

Since we don't have a frontend yet, this will be a server-only E2E test using WebSocket client.

### Test Scenario: Complete Hint Flow

**Test Steps:**

1. **Setup:**

   ```bash
   cd crates/mahjong_server
   cargo run
   ```

2. **Connect WebSocket Client (wscat):**

   ```bash
   npm install -g wscat
   wscat -c ws://localhost:3000/ws
   ```

3. **Authenticate:**

   ```json
   {
     "type": "Authenticate",
     "payload": {
       "player_id": "test_player",
       "token": null
     }
   }
   ```

4. **Create and Join Room:**

   ```json
   { "type": "CreateRoom" }
   { "type": "JoinRoom", "payload": { "room_id": "<room_id>" } }
   ```

5. **Start Game (needs 4 players or bots):**

   ```json
   { "type": "Command", "payload": { "ReadyToStart": { "player": "East" } } }
   ```

6. **Verify Automatic Hints:**
   - After tiles dealt, expect `HintUpdate` event
   - Verify event structure matches TypeScript bindings

7. **Request Hints Explicitly:**

   ```json
   {
     "type": "Command",
     "payload": {
       "RequestHint": {
         "player": "East",
         "skill_level": "Beginner"
       }
     }
   }
   ```

   - Expect immediate `HintUpdate` response

8. **Change Hint Level:**

   ```json
   {
     "type": "Command",
     "payload": {
       "SetHintLevel": {
         "player": "East",
         "level": "Expert"
       }
     }
   }
   ```

   - Future hints should have Expert verbosity

9. **Disable Hints:**

   ```json
   {
     "type": "Command",
     "payload": {
       "SetHintLevel": {
         "player": "East",
         "level": "Disabled"
       }
     }
   }
   ```

   - No more `HintUpdate` events should arrive

**Expected Results:**

- ✅ `HintUpdate` events arrive after state changes
- ✅ Events are private (only sent to owning player)
- ✅ `RequestHint` provides immediate response
- ✅ `SetHintLevel` changes future hint verbosity
- ✅ `Disabled` stops hint events entirely
- ✅ All events match TypeScript type definitions

## Performance Tests

### Test: Hint Generation Overhead

**File:** `crates/mahjong_ai/benches/hint_benchmark.rs` (NEW FILE)

```rust
//! Benchmark hint generation performance.

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use mahjong_ai::evaluation::StrategicEvaluation;
use mahjong_ai::hint_generator::HintGenerator;
use mahjong_core::event::PatternDifficulty;
use mahjong_core::hand::Hand;
use mahjong_core::hint::HintSkillLevel;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::tiles::*;

fn bench_hint_generation(c: &mut Criterion) {
    // Setup
    let card_json = include_str!("../../../data/cards/unified_card2025.json");
    let card = UnifiedCard::from_json(card_json).unwrap();
    let validator = HandValidator::new(&card);

    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_1, CRAK_1,
        DOT_2, DOT_4, DOT_6, WIND_EAST, WIND_EAST,
        JOKER, JOKER, JOKER,
    ]);

    // Create mock evaluations
    let mut evaluations = Vec::new();
    for i in 0..10 {
        evaluations.push(StrategicEvaluation {
            pattern_id: format!("PATTERN-{}", i),
            variation_id: format!("VAR-{}", i),
            deficiency: (i % 5) as i32,
            difficulty: (i % 5) as f64,
            difficulty_class: PatternDifficulty::Medium,
            probability: 0.5,
            expected_value: 25.0,
            score: 50,
            viable: true,
        });
    }

    // Benchmark
    c.bench_function("hint_generation_beginner", |b| {
        b.iter(|| {
            HintGenerator::generate(
                black_box(&evaluations),
                black_box(&hand),
                black_box(HintSkillLevel::Beginner),
                black_box(&validator),
            )
        })
    });

    c.bench_function("hint_generation_intermediate", |b| {
        b.iter(|| {
            HintGenerator::generate(
                black_box(&evaluations),
                black_box(&hand),
                black_box(HintSkillLevel::Intermediate),
                black_box(&validator),
            )
        })
    });

    c.bench_function("hint_generation_expert", |b| {
        b.iter(|| {
            HintGenerator::generate(
                black_box(&evaluations),
                black_box(&hand),
                black_box(HintSkillLevel::Expert),
                black_box(&validator),
            )
        })
    });
}

criterion_group!(benches, bench_hint_generation);
criterion_main!(benches);
```

**Add to `Cargo.toml`:**

```toml
[[bench]]
name = "hint_benchmark"
harness = false

[dev-dependencies]
criterion = "0.5"
```

**Run:**

```bash
cd crates/mahjong_ai
cargo bench hint_benchmark
```

**Expected:** <1ms per hint generation (target: <500μs)

## Test Execution Plan

### Phase 1: Unit Tests (15 minutes)

```bash
# Run all unit tests
cd crates/mahjong_core
cargo test hint

cd ../mahjong_ai
cargo test hint_generator

cd ../mahjong_server
cargo test hint
```

**Expected:** All tests pass, ~17 total

### Phase 2: Integration Tests (20 minutes)

```bash
cd crates/mahjong_server
cargo test --test hint_full_pipeline
cargo test --test hint_room_settings
cargo test --test hint_commands

cd ../mahjong_core
cargo test --test hint_event_privacy
```

**Expected:** All integration tests pass, ~10 total

### Phase 3: End-to-End Test (15 minutes)

Manual testing with wscat (see E2E test scenario above)

**Expected:** All manual test steps complete successfully

### Phase 4: Performance Benchmark (10 minutes)

```bash
cd crates/mahjong_ai
cargo bench hint_benchmark
```

**Expected:** <1ms per hint generation

## Success Criteria Checklist

- [ ] All 17 unit tests pass
- [ ] All 10 integration tests pass
- [ ] E2E manual test completes successfully
- [ ] `HintUpdate` events are private
- [ ] `RequestHint` provides immediate response
- [ ] `SetHintLevel` changes future hints
- [ ] `Disabled` stops hint events
- [ ] Hint generation <1ms (benchmark)
- [ ] No memory leaks (run with valgrind)
- [ ] TypeScript bindings match Rust types

## Regression Testing

### After Implementation

Run full test suite to ensure no regressions:

```bash
# All core tests
cd crates/mahjong_core
cargo test

# All AI tests
cd ../mahjong_ai
cargo test

# All server tests
cd ../mahjong_server
cargo test

# All integration tests
cargo test --tests
```

**Expected:** All existing tests still pass (no regressions)

## Documentation Verification

- [ ] All public APIs have doc comments
- [ ] Examples compile and run
- [ ] TypeScript bindings generated
- [ ] Integration guide complete
- [ ] No TODOs in production code

## Final Checklist

Before marking implementation complete:

1. ✅ All tests pass (unit + integration + E2E)
2. ✅ Performance benchmarks meet targets (<1ms)
3. ✅ TypeScript bindings verified
4. ✅ Code review checklist:
   - No unwrap() in production paths
   - All errors handled gracefully
   - No clippy warnings
   - No dead code
   - Proper error messages
5. ✅ Documentation complete
6. ✅ Integration guide reviewed
7. ✅ Ready for frontend team

## Estimated Total Testing Time

- Unit tests setup: 30 min
- Integration tests setup: 45 min
- E2E manual testing: 30 min
- Performance benchmarks: 20 min
- Documentation review: 15 min

**Total:** ~2.5 hours
