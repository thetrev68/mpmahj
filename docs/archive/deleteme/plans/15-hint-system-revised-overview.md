# Hint System: Architecture Overview

**Status:** READY FOR IMPLEMENTATION
**Created:** 2026-01-09
**Philosophy:** Hints = AI recommendations + server-side composition

## Core Concept

**The hint system is NOT a separate decision engine.**

Instead, it's a thin **composition layer** that:

1. Reuses Always-On Analyst results for pattern and distance data
2. Asks AI helpers what they would do for discard/call/defense
3. Formats the response based on player verbosity preference
4. Sends a single `HintData` payload to the frontend

## Key Insight

We already have sophisticated AI (GreedyAI, MCTSAI) that makes optimal decisions. The hint system should **leverage** this intelligence, not **duplicate** it.

### Wrong Approach (Original)

```text
HintGenerator → recalculate tile values → recommend discard
    ↓
Duplicates AI logic, inconsistent with bot behavior
```

### Correct Approach (This Implementation)

```text
Always-On Analyst → StrategicEvaluation (already exists)
    ↓
Room::analysis_cache → server-side HintComposer (NEW - thin layer)
    ↓
mahjong_ai::hint::HintAdvisor (discard/call/defense helpers)
    ↓
HintData → to frontend
```

## Verbosity Levels

All hints use **expert-level AI analysis**. Only the **text explanation** varies:

| Level            | Visual Cues     | Text Explanation  | Use Case            |
| ---------------- | --------------- | ----------------- | ------------------- |
| **Beginner**     | ✅ Always shown | ✅ Full reasoning | Learning players    |
| **Intermediate** | ✅ Always shown | ✅ Short labels   | Experienced players |
| **Expert**       | ✅ Always shown | ❌ No text        | Minimal UI clutter  |
| **Disabled**     | ❌ Nothing      | ❌ Nothing        | No hints sent       |

**Important:**

- If hints are enabled at ANY level (Beginner/Intermediate/Expert), the recommended tile is visually highlighted
- Text is supplementary - the visual indicator is the primary hint
- Expert mode removes text for players who just want the visual cue
- Call opportunities and defensive hints also follow the same verbosity rules

## Data Structures

### HintVerbosity Enum (15a)

Controls how much text detail is shown to the player.

```rust
pub enum HintVerbosity {
    /// Show explicit tile recommendations + detailed reasoning.
    /// Visual indicator always shown. Best for learning players.
    Beginner,

    /// Show short labels, no detailed reasoning.
    /// Visual indicator always shown. Best for intermediate players.
    Intermediate,

    /// Show visual indicator only, no text.
    /// Best for experienced players who want minimal UI.
    Expert,

    /// No hints (analysis still runs for pattern viability display).
    /// Zero bandwidth overhead.
    Disabled,
}
```

### HintData Struct (15a)

```rust
pub struct HintData {
    /// Recommended tile to discard (None for Disabled)
    /// Frontend should visually highlight this tile at ALL verbosity levels
    pub recommended_discard: Option<Tile>,

    /// Reason for the discard recommendation (None for Expert/Disabled)
    pub discard_reason: Option<String>,

    /// Top patterns to focus on, sorted by expected value
    /// Empty for Expert/Disabled
    pub best_patterns: Vec<PatternSummary>,

    /// Call suggestions during CallWindow (empty outside CallWindow)
    pub call_opportunities: Vec<CallOpportunity>,

    /// Defensive hints about safe discards (Beginner/Intermediate only)
    pub defensive_hints: Vec<DefensiveHint>,

    /// Minimum tiles needed to win (0-14)
    pub distance_to_win: u8,

    /// Is player "hot" (1 tile away)? Used for visual alerts
    pub hot_hand: bool,
}
```

## Architecture Components

### 1. Data Structures (15a)

**File:** `crates/mahjong_core/src/hint.rs` (NEW)

```rust
//! Hint system data structures for intelligent gameplay suggestions.

use crate::player::Seat;
use crate::tile::Tile;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum HintVerbosity {
    Beginner,
    Intermediate,
    Expert,
    Disabled,
}

impl Default for HintVerbosity {
    fn default() -> Self {
        Self::Intermediate
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct HintData {
    pub recommended_discard: Option<Tile>,
    pub discard_reason: Option<String>,
    pub best_patterns: Vec<PatternSummary>,
    pub tiles_needed_for_win: Vec<Tile>,
    pub call_opportunities: Vec<CallOpportunity>,
    pub defensive_hints: Vec<DefensiveHint>,
    pub distance_to_win: u8,
    pub hot_hand: bool,
}

impl HintData {
    pub fn empty() -> Self { /* ... */ }
    pub fn is_empty(&self) -> bool { /* ... */ }
}
```

### 2. AI Integration (15b)

**File:** `crates/mahjong_ai/src/hint/mod.rs` (NEW)

```rust
//! Hint advisor - thin AI layer for discard/call/defense hints.

use crate::context::VisibleTiles;
use crate::strategies::greedy::GreedyAI;
use crate::r#trait::MahjongAI;
use mahjong_core::hint::{CallOpportunity, DefensiveHint, HintVerbosity};
use mahjong_core::meld::MeldType;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;

/// Generate hints by asking the AI what it would do.
///
/// This is a THIN PRESENTATION LAYER - all decisions come from existing AI.
pub struct HintAdvisor;

impl HintAdvisor {
    /// Recommend a discard using GreedyAI.
    pub fn recommend_discard(
        hand: &mahjong_core::hand::Hand,
        visible_tiles: &VisibleTiles,
        validator: &HandValidator,
    ) -> Tile {
        let mut ai = GreedyAI::new(0);
        ai.select_discard(hand, visible_tiles, validator)
    }

    /// Recommend call opportunities during CallWindow.
    pub fn recommend_calls(
        hand: &mahjong_core::hand::Hand,
        visible_tiles: &VisibleTiles,
        validator: &HandValidator,
        discarded_by: mahjong_core::player::Seat,
        current_seat: mahjong_core::player::Seat,
        discarded_tile: Tile,
        turn_number: u32,
    ) -> Vec<CallOpportunity> {
        let mut ai = GreedyAI::new(0);
        let mut opportunities = Vec::new();

        for meld_type in [MeldType::Pung, MeldType::Kong, MeldType::Quint] {
            let should_call = ai.should_call(
                hand,
                discarded_tile,
                meld_type,
                visible_tiles,
                validator,
                turn_number,
                discarded_by,
                current_seat,
            );

            if should_call {
                opportunities.push(CallOpportunity::new(
                    discarded_tile,
                    meld_type,
                    true,
                    "Improves expected value".to_string(),
                ));
            }
        }

        opportunities
    }

    /// Evaluate defensive safety of a candidate discard.
    pub fn evaluate_defense(
        tile: Tile,
        visible_tiles: &VisibleTiles,
    ) -> DefensiveHint {
        if visible_tiles.is_dead(tile) {
            DefensiveHint::safe(tile, "All copies are visible".to_string())
        } else {
            DefensiveHint::risky(tile, "Tile still available to opponents".to_string())
        }
    }
}

    /// Count how many patterns in hand require this tile.
    fn count_patterns_using_tile(
        tile: Tile,
        hand: &Hand,
        validator: &HandValidator,
    ) -> usize {
        // Simplified: count how many copies of this tile are in hand
        // Real implementation would query the validator's pattern analysis
        hand.counts[tile.index()] as usize
    }
}
```

### 3. Event/Command Integration (15c - UNCHANGED)

Same as before - `HintUpdate` event, `RequestHint`/`SetHintVerbosity` commands.

### 4. Server Integration (15d)

**File:** `crates/mahjong_server/src/network/room.rs`

```rust
// In Room struct:
pub struct Room {
    // ... existing fields ...
    pub hint_verbosity: HashMap<Seat, HintVerbosity>, // ADD THIS
}

// In analysis_worker, after emitting AnalysisUpdate:
let verbosity = room.get_hint_verbosity(seat);

if verbosity != HintVerbosity::Disabled {
    let visible = build_visible_tiles(&table);
    let hint = HintComposer::from_analysis(
        &analysis,
        &player.hand,
        &visible,
        &validator,
        verbosity,
        &room.pattern_lookup,
    );

    let hint_event = GameEvent::HintUpdate { hint };
    pending_events.push((session_arc.clone(), hint_event));
}
```

## What Gets Added

| Component                | File                                 | Lines | Purpose                                |
| ------------------------ | ------------------------------------ | ----- | -------------------------------------- |
| HintVerbosity enum       | `mahjong_core/src/hint.rs`           | 15    | Controls verbosity level               |
| HintData struct          | `mahjong_core/src/hint.rs`           | 40    | Hint response structure                |
| HintAdvisor              | `mahjong_ai/src/hint/mod.rs`         | 80    | Discard/call/defense helpers           |
| HintUpdate event         | `mahjong_core/src/event.rs`          | 5     | Event variant                          |
| RequestHint command      | `mahjong_core/src/command.rs`        | 5     | Command to request hint                |
| SetHintVerbosity command | `mahjong_core/src/command.rs`        | 5     | Command to change verbosity            |
| Room integration         | `mahjong_server/src/network/room.rs` | 30    | Per-player settings + hint composition |

## What Gets REMOVED (vs. original design)

- ❌ Custom tile value calculation (use AI's logic)
- ❌ Custom discard recommendation (use GreedyAI)
- ❌ Complex `calculate_missing_tiles()` algorithm in core
- ❌ Separate hint generator module in `mahjong_core`

## Benefits of This Approach

| Benefit             | Explanation                                 |
| ------------------- | ------------------------------------------- |
| **Consistency**     | Hints match bot behavior (both use same AI) |
| **Simplicity**      | No duplicate decision logic                 |
| **Maintainability** | AI improvements automatically improve hints |
| **Trust**           | Players see exactly what the AI sees        |
| **Performance**     | Reuses existing analysis                    |

## Frontend Integration Note

**For ALL enabled verbosity levels (Beginner/Intermediate/Expert):**

- Frontend receives `HintData` with `recommended_discard: Some(Tile)`
- Frontend should visually highlight the recommended tile
- Beginner: Show text explanation + visual highlight
- Intermediate: Show tile name + visual highlight
- Expert: Visual highlight only (no text)

**For Disabled:**

- No `HintUpdate` events sent
- Zero bandwidth overhead

## Estimated Effort

| Phase                        | Time    |
| ---------------------------- | ------- |
| 15a: Data structures         | 1 hour  |
| 15b: HintAdvisor (AI helper) | 1 hour  |
| 15c: Events/commands         | 1 hour  |
| 15d: Server integration      | 2 hours |
| 15e: Testing                 | 2 hours |

### Total: 7 hours

## Implementation Order

1. **[15a](15a-hint-data-structures.md)** - Create `hint.rs` with types
2. **[15b](15b-hint-service.md)** - Create `mahjong_ai::hint::HintAdvisor`
3. **[15c](15c-event-command-integration.md)** - Add events/commands to core
4. **[15d](15d-server-integration-settings.md)** - Integrate into server
5. **[15e](15e-testing-strategy.md)** - Add tests

## AI Consistency Guarantee

**All hint recommendations come from the same AI logic used by bots.**

This means:

- When a Beginner player asks for a hint, they get what GreedyAI would do
- When the bot plays, it uses the same GreedyAI logic
- Players learn the optimal strategy by following hints

## Privacy

`HintUpdate` events are **private** - only sent to the owning player via the `is_private()` method on `GameEvent`.

---

**Document Version:** 2.1 (Revised)
**Last Updated:** 2026-01-10
