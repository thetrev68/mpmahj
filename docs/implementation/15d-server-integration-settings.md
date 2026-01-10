# Hint System: Server Integration and Settings (15d)

**Status:** READY FOR IMPLEMENTATION
**Prerequisites:** 15a, 15b, 15c
**Estimated Time:** 2-3 hours

## Overview

This document integrates the hint system into the server's Always-On Analyst worker and adds per-player verbosity settings. The server composes `HintData` using `analysis_cache` and calls `mahjong_ai::hint::HintAdvisor` for discard/call/defense suggestions.

## Step 1: Add Hint Settings and Pattern Lookup to Room

**File:** `crates/mahjong_server/src/network/room.rs`

### Add Imports

```rust
use mahjong_core::hint::HintVerbosity;
use std::collections::HashMap;
```

### Add Fields to Room

```rust
pub struct Room {
    // ... existing fields ...
    pub analysis_tx: mpsc::Sender<AnalysisRequest>,

    /// Hint verbosity per player (default: Intermediate).
    pub hint_verbosity: HashMap<Seat, HintVerbosity>,

    /// Pattern ID → display name (from UnifiedCard).
    /// Used for HintData.best_patterns.
    pub pattern_lookup: HashMap<String, String>,
}
```

### Initialize in Constructors

```rust
Self {
    // ... existing fields ...
    analysis_tx: tx,
    hint_verbosity: HashMap::new(),
    pattern_lookup: HashMap::new(),
}
```

### Add Helper Methods

```rust
impl Room {
    pub fn get_hint_verbosity(&self, seat: Seat) -> HintVerbosity {
        self.hint_verbosity
            .get(&seat)
            .copied()
            .unwrap_or(HintVerbosity::Intermediate)
    }

    pub fn set_hint_verbosity(&mut self, seat: Seat, level: HintVerbosity) {
        self.hint_verbosity.insert(seat, level);
    }

    pub fn pattern_name(&self, pattern_id: &str) -> Option<&str> {
        self.pattern_lookup.get(pattern_id).map(|s| s.as_str())
    }
}
```

## Step 2: Load Pattern Lookup with Validator

**File:** `crates/mahjong_server/src/resources.rs`

Add a helper that returns both the validator and a pattern lookup map:

```rust
use std::collections::HashMap;

pub struct CardResources {
    pub validator: HandValidator,
    pub pattern_lookup: HashMap<String, String>,
}

pub fn load_card_resources(card_year: u16) -> Option<CardResources> {
    let filename = match card_year {
        2025 => "unified_card2025.json",
        2020 => "card2020.json",
        2019 => "card2019.json",
        2018 => "card2018.json",
        2017 => "card2017.json",
        _ => return None,
    };

    let paths = [
        std::path::Path::new("data/cards").join(filename),
        std::path::Path::new("../../data/cards").join(filename),
    ];

    for path in &paths {
        if let Ok(json) = std::fs::read_to_string(path) {
            if let Ok(card) = UnifiedCard::from_json(&json) {
                let validator = HandValidator::new(&card);
                let pattern_lookup = card
                    .patterns
                    .iter()
                    .map(|p| (p.id.clone(), p.description.clone()))
                    .collect();
                return Some(CardResources {
                    validator,
                    pattern_lookup,
                });
            }
        }
    }

    None
}
```

Use `CardResources` when setting up the room so `Room.pattern_lookup` is populated alongside the validator.

## Step 3: Add Analysis Helpers

**File:** `crates/mahjong_server/src/analysis.rs`

Add helper functions to reuse the same `VisibleTiles` and call context logic:

```rust
use mahjong_ai::context::VisibleTiles;
use mahjong_core::table::{GamePhase, TurnStage, Table};

pub fn build_visible_tiles(table: &Table) -> VisibleTiles {
    let mut visible = VisibleTiles::new();
    for discarded in &table.discard_pile {
        visible.add_discard(discarded.tile);
    }
    for (seat, player) in &table.players {
        for meld in &player.hand.exposed {
            visible.add_meld(*seat, meld.clone());
        }
    }
    visible
}

pub fn call_context_from_table(
    table: &Table,
    seat: mahjong_core::player::Seat,
) -> Option<crate::hint::CallContext> {
    match &table.phase {
        GamePhase::Playing(TurnStage::CallWindow {
            tile,
            discarded_by,
            can_act,
            ..
        }) if can_act.contains(&seat) && *discarded_by != seat => Some(crate::hint::CallContext {
            discarded_tile: *tile,
            discarded_by: *discarded_by,
            current_seat: seat,
            turn_number: table.discard_pile.len() as u32,
        }),
        _ => None,
    }
}
```

## Step 4: Create Hint Composer in Server

**File:** `crates/mahjong_server/src/hint/mod.rs` (NEW FILE)

```rust
//! Hint composition using analysis_cache and AI helpers.

use mahjong_ai::context::VisibleTiles;
use mahjong_ai::hint::HintAdvisor;
use mahjong_core::hand::Hand;
use mahjong_core::hint::{HintData, HintVerbosity, PatternSummary};
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;

use crate::analysis::HandAnalysis;

pub struct HintComposer;

impl HintComposer {
    pub fn compose(
        analysis: &HandAnalysis,
        hand: &Hand,
        visible: &VisibleTiles,
        validator: &HandValidator,
        verbosity: HintVerbosity,
        pattern_lookup: &std::collections::HashMap<String, String>,
        call_context: Option<CallContext>,
    ) -> HintData {
        if verbosity == HintVerbosity::Disabled {
            return HintData::empty();
        }

        let recommended_discard = HintAdvisor::recommend_discard(hand, visible, validator);
        let discard_reason = match verbosity {
            HintVerbosity::Beginner => {
                let top = analysis.top_patterns.first();
                top.map(|eval| {
                    let name = pattern_lookup
                        .get(&eval.pattern_id)
                        .cloned()
                        .unwrap_or_else(|| eval.pattern_id.clone());
                    format!("Discard {} - best EV: {} ({} away)", recommended_discard, name, eval.deficiency)
                })
            }
            HintVerbosity::Intermediate => {
                Some(format!("Discard {}", recommended_discard))
            }
            HintVerbosity::Expert | HintVerbosity::Disabled => None,
        };

        let best_patterns = if matches!(verbosity, HintVerbosity::Beginner) {
            analysis
                .top_patterns
                .iter()
                .map(|eval| {
                    let name = pattern_lookup
                        .get(&eval.pattern_id)
                        .cloned()
                        .unwrap_or_else(|| eval.pattern_id.clone());
                    PatternSummary {
                        pattern_id: eval.pattern_id.clone(),
                        variation_id: eval.variation_id.clone(),
                        pattern_name: name,
                        probability: eval.probability,
                        score: eval.score,
                        distance: eval.deficiency.max(0) as u8,
                    }
                })
                .collect()
        } else {
            Vec::new()
        };

        let tiles_needed_for_win = Self::tiles_needed_for_best_pattern(
            analysis,
            hand,
            validator,
            visible,
        );

        let call_opportunities = if let Some(ctx) = call_context {
            HintAdvisor::recommend_calls(
                hand,
                visible,
                validator,
                ctx.discarded_by,
                ctx.current_seat,
                ctx.discarded_tile,
                ctx.turn_number,
            )
        } else {
            Vec::new()
        };

        let defensive_hints = if matches!(verbosity, HintVerbosity::Beginner | HintVerbosity::Intermediate) {
            vec![HintAdvisor::evaluate_defense(recommended_discard, visible)]
        } else {
            Vec::new()
        };

        let distance_to_win = if analysis.distance_to_win == i32::MAX {
            14
        } else {
            analysis.distance_to_win.max(0) as u8
        };

        HintData {
            recommended_discard: Some(recommended_discard),
            discard_reason,
            best_patterns,
            tiles_needed_for_win,
            distance_to_win,
            hot_hand: distance_to_win <= 1,
            call_opportunities,
            defensive_hints,
        }
    }

    fn tiles_needed_for_best_pattern(
        analysis: &HandAnalysis,
        hand: &Hand,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> Vec<Tile> {
        let best = analysis.top_patterns.first();
        let Some(best) = best else { return Vec::new(); };
        let Some(target) = validator.histogram_for_variation(&best.variation_id) else {
            return Vec::new();
        };

        let mut missing = Vec::new();
        for (idx, &needed) in target.iter().enumerate() {
            let have = hand.counts.get(idx).copied().unwrap_or(0);
            if needed > have {
                let tile = Tile(idx as u8);
                if !tile.is_joker() && !visible.is_dead(tile) {
                    missing.push(tile);
                }
            }
        }

        missing.sort();
        missing.dedup();
        missing
    }
}

pub struct CallContext {
    pub discarded_tile: Tile,
    pub discarded_by: mahjong_core::player::Seat,
    pub current_seat: mahjong_core::player::Seat,
    pub turn_number: u32,
}
```

Add module export:

**File:** `crates/mahjong_server/src/lib.rs`

```rust
pub mod hint;
```

## Step 5: Update Hint Command Handler

**File:** `crates/mahjong_server/src/network/handlers/hint.rs` (NEW FILE)

```rust
//! Hint command handlers.

use crate::hint::{CallContext, HintComposer};
use crate::network::room::Room;
use crate::network::session::Session;
use mahjong_core::event::GameEvent;
use mahjong_core::hint::HintVerbosity;
use mahjong_core::player::Seat;
use mahjong_core::rules::validator::HandValidator;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn handle_request_hint(
    room: &mut Room,
    player: Seat,
    verbosity: HintVerbosity,
    session: &Arc<Mutex<Session>>,
    validator: &HandValidator,
) -> Result<(), String> {
    let table = room
        .table
        .as_ref()
        .ok_or_else(|| "Game not started".to_string())?;
    let player_state = table
        .get_player(player)
        .ok_or_else(|| format!("Player {:?} not in game", player))?;

    let analysis = room
        .analysis_cache
        .get(&player)
        .ok_or_else(|| "Analysis not available yet".to_string())?;

    let visible = crate::analysis::build_visible_tiles(table);
    let call_context = crate::analysis::call_context_from_table(table, player);

    let hint = HintComposer::compose(
        analysis,
        &player_state.hand,
        &visible,
        validator,
        verbosity,
        &room.pattern_lookup,
        call_context,
    );

    let event = GameEvent::HintUpdate { hint };
    session
        .lock()
        .await
        .send(event)
        .await
        .map_err(|e| format!("Failed to send hint: {}", e))?;

    Ok(())
}

pub async fn handle_set_hint_verbosity(
    room: &mut Room,
    player: Seat,
    verbosity: HintVerbosity,
) -> Result<(), String> {
    if room.table.is_none() {
        return Err("Game not started".to_string());
    }

    if !room.sessions.contains_key(&player) {
        return Err(format!("Player {:?} not in game", player));
    }

    room.set_hint_verbosity(player, verbosity);
    Ok(())
}
```

Add module export:

**File:** `crates/mahjong_server/src/network/handlers/mod.rs`

```rust
pub mod hint;
```

## Step 6: Integrate Hint Composition into analysis_worker

**File:** `crates/mahjong_server/src/network/room.rs`

After emitting `AnalysisUpdate`, add hint composition:

```rust
use crate::hint::HintComposer;

let verbosity = room.get_hint_verbosity(seat);
if verbosity != HintVerbosity::Disabled {
    let call_context = crate::analysis::call_context_from_table(&snapshot, seat);
    let hint = HintComposer::compose(
        &analysis,
        &player.hand,
        &visible,
        validator,
        verbosity,
        &room.pattern_lookup,
        call_context,
    );

    let hint_event = GameEvent::HintUpdate { hint };
    pending_events.push((session_arc.clone(), hint_event));
}
```

## Verification Steps

```bash
cd crates/mahjong_server
cargo build
```

**Expected:** ✅ No compilation errors

## Success Criteria

- ✅ `hint_verbosity` and `pattern_lookup` added to `Room`
- ✅ `CardResources` loader returns validator + pattern lookup
- ✅ `HintComposer` builds `HintData` from analysis_cache
- ✅ `RequestHint` uses cached analysis (no recompute)
- ✅ Hints sent in analysis_worker when verbosity != Disabled

## Notes

- **Analysis Cache is source of truth** for patterns and distances.
- **AI helpers** provide discard/call/defense decisions.
- **Pattern names** are loaded from UnifiedCard and stored in `Room.pattern_lookup`.
