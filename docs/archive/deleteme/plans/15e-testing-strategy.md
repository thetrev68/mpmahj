# Hint System: Comprehensive Testing Strategy (15e)

**Status:** ✅ **COMPLETE**
**Prerequisites:** 15a, 15b, 15c, 15d
**Estimated Time:** 2-3 hours

## Overview

This document provides a complete testing strategy for the hint system, from unit tests to end-to-end integration tests. It aligns with the updated architecture: `HintAdvisor` in `mahjong_ai` and `HintComposer` in `mahjong_server`.

## Test Pyramid

```text
        E2E Tests (1-2)
       /               \
   Integration (3-4)
  /                    \
Unit Tests (10-12)
```text

## Unit Tests

### 1. Hint Data Structures (mahjong_core)

**File:** `crates/mahjong_core/src/hint.rs`

Existing tests (from 15a):

- `test_hint_verbosity_default`
- `test_hint_data_empty`
- `test_hint_data_not_empty_with_patterns`
- `test_hint_data_not_empty_with_discard`
- `test_hot_hand_detection`

### 2. Hint Advisor (mahjong_ai)

**File:** `crates/mahjong_ai/src/hint/mod.rs`

Add tests:

- `test_recommend_discard_never_joker`
- `test_evaluate_defense_dead_tile_safe`

### 3. Event Privacy (mahjong_core)

**File:** `crates/mahjong_core/tests/hint_event_privacy.rs`

```rust
use mahjong_core::event::GameEvent;
use mahjong_core::hint::HintData;

#[test]
fn test_hint_update_is_private() {
    let event = GameEvent::HintUpdate {
        hint: HintData::empty(),
    };
    assert!(event.is_private(), "HintUpdate must be private event");
}
```text

## Integration Tests

### Test 1: Hint Composer Pipeline

**File:** `crates/mahjong_server/tests/hint_composer_pipeline.rs` (NEW FILE)

```rust
use mahjong_ai::context::VisibleTiles;
use mahjong_core::hand::Hand;
use mahjong_core::hint::HintVerbosity;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::tiles::*;
use mahjong_server::analysis::HandAnalysis;
use mahjong_server::hint::HintComposer;

#[test]
fn test_hint_composer_builds_hint_data() {
    let card_json = include_str!("../../../data/cards/unified_card2025.json");
    let card = UnifiedCard::from_json(card_json).expect("Failed to parse card");
    let validator = HandValidator::new(&card);

    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3,
        CRAK_1, CRAK_1,
        DOT_1, DOT_2, DOT_3,
        WIND_EAST, JOKER,
    ]);

    let visible = VisibleTiles::new();
    let analysis = {
        let results = validator.analyze(&hand, 5);
        let evaluations = results
            .into_iter()
            .filter_map(|r| {
                let target = validator.histogram_for_variation(&r.variation_id)?;
                Some(mahjong_ai::evaluation::StrategicEvaluation::from_analysis(
                    r,
                    &hand,
                    &visible,
                    target,
                ))
            })
            .collect();
        HandAnalysis::from_evaluations(evaluations)
    };

    let mut lookup = std::collections::HashMap::new();
    lookup.insert("TEST".to_string(), "Test Pattern".to_string());

    let hint = HintComposer::compose(
        &analysis,
        &hand,
        &visible,
        &validator,
        HintVerbosity::Beginner,
        &lookup,
        None,
    );

    assert!(hint.recommended_discard.is_some());
    assert!(hint.discard_reason.is_some());
}
```text

### Test 2: Room-Level Hint Verbosity Settings

**File:** `crates/mahjong_server/tests/hint_room_settings.rs` (NEW FILE)

```rust
use mahjong_core::hint::HintVerbosity;
use mahjong_core::player::Seat;
use mahjong_server::network::room::Room;

#[tokio::test]
async fn test_default_hint_verbosity() {
    let (room, _rx) = Room::new();
    assert_eq!(room.get_hint_verbosity(Seat::East), HintVerbosity::Intermediate);
}

#[tokio::test]
async fn test_set_hint_verbosity_per_player() {
    let (mut room, _rx) = Room::new();
    room.set_hint_verbosity(Seat::East, HintVerbosity::Beginner);
    assert_eq!(room.get_hint_verbosity(Seat::East), HintVerbosity::Beginner);
}
```text

## End-to-End Test (Manual)

Use a WebSocket client (wscat) to verify real-time hint events.

1. Start server:

```bash
cd crates/mahjong_server
cargo run
```text

1. Connect with `wscat`:

```bash
npm install -g wscat
wscat -c ws://localhost:3000/ws
```text

1. Request hints:

```json
{
  "type": "Command",
  "payload": {
    "RequestHint": {
      "player": "East",
      "verbosity": "Beginner"
    }
  }
}
```text

**Expected:**

- `HintUpdate` events arrive after analysis updates
- `HintUpdate` is private (only sent to requesting player)
- Beginner includes text reasoning + visual cues
- Intermediate includes short labels + visual cues
- Expert includes visual cues only
- Defensive and call hints appear during CallWindow

## Performance Tests

Optional benchmark (reuse existing `criterion` setup):

**File:** `crates/mahjong_ai/benches/hint_advisor_bench.rs` (NEW FILE)

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use mahjong_ai::context::VisibleTiles;
use mahjong_ai::hint::HintAdvisor;
use mahjong_core::hand::Hand;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::tiles::*;

fn bench_hint_advisor(c: &mut Criterion) {
    let card_json = include_str!("../../../data/cards/unified_card2025.json");
    let card = UnifiedCard::from_json(card_json).unwrap();
    let validator = HandValidator::new(&card);
    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_1, CRAK_1,
        DOT_2, DOT_4, DOT_6, WIND_EAST, WIND_EAST,
        JOKER, JOKER, JOKER,
    ]);
    let visible = VisibleTiles::new();

    c.bench_function("hint_advisor_discard", |b| {
        b.iter(|| {
            HintAdvisor::recommend_discard(
                black_box(&hand),
                black_box(&visible),
                black_box(&validator),
            )
        })
    });
}

criterion_group!(benches, bench_hint_advisor);
criterion_main!(benches);
```text

## Success Criteria Checklist

- [ ] All unit tests pass (core + ai + server)
- [ ] Integration tests pass
- [ ] `HintUpdate` events are private
- [ ] `RequestHint` responds immediately
- [ ] `SetHintVerbosity` changes future hints
- [ ] Defensive/call hints appear during CallWindow
- [ ] Performance acceptable (<1ms per discard recommendation)
