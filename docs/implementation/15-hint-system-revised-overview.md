# Hint System: Revised Architecture Overview

**Status:** DRAFT - Ready for review
**Created:** 2026-01-09
**Philosophy:** Hints = AI recommendations + presentation layer

## Core Concept

**The hint system is NOT a separate decision engine.**

Instead, it's a thin **presentation layer** that:

1. Asks the existing AI what it would do
2. Formats the response based on player verbosity preference
3. Sends it to the frontend

## Key Insight

We already have sophisticated AI (BasicBot, GreedyAI, MCTSAI) that makes optimal decisions. The hint system should **leverage** this intelligence, not **duplicate** it.

### Before (Wrong Approach)

```
HintGenerator → recalculate tile values → recommend discard
    ↓
Duplicates AI logic, inconsistent with bot behavior
```

### After (Correct Approach)

```
Always-On Analyst → StrategicEvaluation (already exists)
    ↓
GreedyAI.select_discard() → best tile (already exists)
    ↓
HintFormatter → add explanation text (NEW - thin layer)
    ↓
HintData → to frontend
```

## Verbosity Levels (Not Intelligence Levels!)

All hints use **expert-level AI analysis**. Only the presentation changes:

### Beginner (Verbose)

- **What:** Tile + full reasoning
- **Example:** "Discard 7C because it keeps 3 patterns viable: Consecutive Run, Odd Numbers, Wind Pairs"
- **UI:** Text bubble with explanation

### Intermediate (Concise)

- **What:** Tile only
- **Example:** "Discard 7C"
- **UI:** Simple text label

### Expert (Visual)

- **What:** Just the tile
- **Example:** (no text, UI highlights the tile with a glow effect)
- **UI:** Visual indicator only

### Disabled

- **What:** Nothing
- **Effect:** No hints sent, zero bandwidth

## Architecture Components

### 1. Data Structures (15a)

```rust
pub enum HintVerbosity {
    Beginner,    // Full explanation
    Intermediate, // Action only
    Expert,      // Visual hint (no text)
    Disabled,    // No hints
}

pub struct HintData {
    recommended_discard: Option<Tile>,
    discard_reason: Option<String>,  // Only for Beginner
    best_patterns: Vec<PatternSummary>,
    distance_to_win: u8,
    hot_hand: bool,
}
```

### 2. AI Integration (15b - SIMPLIFIED)

```rust
pub struct HintService;

impl HintService {
    /// Generate hint by asking the AI what it would do
    pub fn generate(
        hand: &Hand,
        evaluations: &[StrategicEvaluation],
        visible: &VisibleTiles,
        validator: &HandValidator,
        verbosity: HintVerbosity,
    ) -> HintData {
        if verbosity == HintVerbosity::Disabled {
            return HintData::empty();
        }

        // Use existing AI to get best discard
        let mut ai = GreedyAI::new(0);
        let best_discard = ai.select_discard(hand, visible, validator);

        // Format based on verbosity
        let discard_reason = if verbosity == HintVerbosity::Beginner {
            Some(Self::explain_discard(best_discard, evaluations, validator))
        } else {
            None
        };

        // Use existing analysis for pattern info
        let best_patterns = Self::format_patterns(evaluations, verbosity);

        HintData {
            recommended_discard: Some(best_discard),
            discard_reason,
            best_patterns,
            distance_to_win: /* from evaluations */,
            hot_hand: /* distance == 1 */,
        }
    }

    /// Explain WHY this tile should be discarded
    fn explain_discard(
        tile: Tile,
        evaluations: &[StrategicEvaluation],
        validator: &HandValidator,
    ) -> String {
        // Count how many patterns would be affected
        let patterns_kept = count_patterns_using_tile(tile, evaluations, validator);
        format!("Keeps {} pattern{} viable", patterns_kept, if patterns_kept == 1 { "" } else { "s" })
    }
}
```

### 3. Event/Command Integration (15c - UNCHANGED)

Same as before - `HintUpdate` event, `RequestHint`/`SetHintLevel` commands.

### 4. Server Integration (15d - SIMPLIFIED)

```rust
// In analysis_worker, after AnalysisUpdate:
let verbosity = room.get_hint_verbosity(seat);

if verbosity != HintVerbosity::Disabled {
    let hint = HintService::generate(
        &player.hand,
        &analysis.evaluations,
        &visible_tiles,
        &validator,
        verbosity,
    );

    let hint_event = GameEvent::HintUpdate { hint };
    pending_events.push((session_arc.clone(), hint_event));
}
```

## Benefits of This Approach

✅ **Consistency:** Hints match bot behavior (both use same AI)
✅ **Simplicity:** No duplicate decision logic
✅ **Maintainability:** Improvements to AI automatically improve hints
✅ **Trust:** Players see exactly what the AI sees
✅ **Performance:** Reuses existing analysis (no extra computation)

## What Gets Removed

❌ Custom tile value calculation (use AI's logic)
❌ Custom discard recommendation (use `ai.select_discard()`)
❌ Custom pattern scoring (use `StrategicEvaluation`)
❌ Separate hint generator module (just formatting functions)

## What Gets Added

✅ `HintVerbosity` enum
✅ `explain_discard()` - formats AI decision into text
✅ `format_patterns()` - presents pattern data based on verbosity
✅ Verbosity setting in Room

## Estimated Effort

- **15a:** 1 hour (data structures - simpler now)
- **15b:** 2 hours (just formatting, no AI logic)
- **15c:** 1 hour (events/commands - unchanged)
- **15d:** 2 hours (server integration - simpler)
- **15e:** 2 hours (testing - fewer edge cases)

**Total: 8 hours** (vs. 15 hours in original plan)

## Next Steps

1. Review this architecture
2. Update 15a-15e documents with new approach
3. Implement simplified version
4. Frontend can add visual "glow" effect for Expert mode

## Open Questions

1. Should "Expert" mode still send text hints (for accessibility)?
2. Should we support custom verbosity messages per context (charleston vs discard)?
3. Should hints show multiple discard options or just the best one?

---

**Sleep on this. Review tomorrow with fresh eyes.**
