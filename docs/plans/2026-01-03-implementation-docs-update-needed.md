# Implementation Docs Update Needed (Post-Refactor)

**Date:** 2026-01-03
**Context:** Histogram-first refactor completed - docs written pre-refactor need updates

---

## Summary

The implementation documents were written assuming the **semantic tile model** (enums with Suit/Rank). The histogram-first refactor fundamentally changed several core primitives. This document identifies what needs updating.

---

## Critical Updates Required

### 1. **[01-game-core.md](../implementation/01-game-core.md)** - NEEDS MAJOR UPDATE

**Current Issues:**

#### Section 3.1 "Tile" (Lines 136-151)

**Current (WRONG):**

```rust
Tile { suit: Suit, rank: Rank }
Suit: Dots, Bams, Cracks, Winds, Dragons, Flowers, Jokers
Rank:
  - Number(u8) for 1..=9
  - Winds: North, East, South, West
  - Dragons: Red, Green, White
```

**Should Be:**

```rust
Tile(u8) - Single byte primitive (0-36)
Mapping:
  - 0-8:   Bams (1-9)
  - 9-17:  Craks (1-9)
  - 18-26: Dots (1-9)
  - 27-30: Winds (East, South, West, North)
  - 31-33: Dragons (Green, Red, White/Soap)
  - 34:    Flower
  - 35:    Joker
  - 36:    Blank (House Rule)

Semantic getters available: is_bam(), is_joker(), rank(), display_name()
```

#### Section 3.2 "Hand" (Lines 153-160)

**Current (INCOMPLETE):**

```rust
Hand { concealed: Vec<Tile>, exposed: Vec<Meld>, joker_assignments: Option<HashMap<usize, Tile>> }
```

**Should Be:**

```rust
Hand {
  concealed: Vec<Tile>,          // Ordered tile list
  counts: Vec<u8>,                // Histogram (length 37) for O(1) lookups
  exposed: Vec<Meld>,
  joker_assignments: Option<HashMap<usize, Tile>>
}

Key operations:
  - has_tile(tile) -> bool         // O(1) via histogram
  - count_tile(tile) -> usize      // O(1) via histogram
  - calculate_deficiency(target_histogram) -> i32  // Core validation algorithm
```

#### Section 3.4 "Table" (Lines 172-183)

Missing `HouseRules` details. Should reference:

```rust
HouseRules {
  blank_exchange_enabled: bool,
  call_window_seconds: u32,
  charleston_timer_seconds: u32,
}
```

#### Implementation Status (Lines 9-92)

**Needs Update:**

Line 13-17 says:

```markdown
✅ tile.rs - Tile primitives with TileKind enum
  - Supports all tile types: Suited, Winds, Dragons, Flowers, Jokers, Blanks
  - Type-safe constructors for each tile variant
```

**Should say:**

```markdown
✅ tile.rs - High-performance Tile primitive (u8-based)
  - Histogram-first design: Tile(pub u8) mapping 0-36
  - O(1) type checks: is_bam(), is_joker(), is_suited()
  - Semantic getters: rank(), suit_name(), display_name()
  - Helper constants: tiles::BAM_1, tiles::JOKER, etc.
```

Line 26-30 says:

```markdown
✅ hand.rs - Hand and Meld types
  - Hand with concealed/exposed tiles
```

**Should say:**

```markdown
✅ hand.rs - Hand and Meld types (histogram-based)
  - Hand maintains both ordered Vec<Tile> and counts: Vec<u8> histogram
  - O(1) tile lookups via histogram (has_tile, count_tile)
  - calculate_deficiency() for O(1) pattern distance calculation
  - Histogram auto-updates on add_tile/remove_tile
```

Line 84-86 says:

```markdown
📋 Not Started
- rules/ - Pattern validation (deferred)
```

**Should say:**

```markdown
✅ rules/ - Histogram-based validation engine
  - UnifiedCard loader for unified_card2025.json (71 patterns, 1,002 variations)
  - HandValidator with O(1) deficiency calculation
  - Pre-computed histograms for all pattern variations
  - Performance: ~260 µs per validation (18,700 evaluations/sec)
```

Line 88-92 says:

```markdown
✅ cargo test - 84 tests passing
```

**Should say:**

```markdown
✅ cargo test - 72 tests passing (67 unit + 5 integration)
  - Includes unified card integration tests
  - All clippy warnings resolved
```

---

### 2. **[02-validation.md](../implementation/02-validation.md)** - NEEDS COMPLETE REWRITE

**Entire document is obsolete.** It describes a component-based validation system with VSUIT resolution and joker flexibility. The histogram-first refactor completely replaced this.

**New approach:**

1. **Input:** `Hand` (with histogram), `UnifiedCard` (pre-computed histograms)
2. **Algorithm:** Vector subtraction of histograms
3. **Output:** `AnalysisResult { pattern_id, variation_id, deficiency, score }`

**Replacement Outline:**

```markdown
# 02. Validation Engine Implementation Spec

## 1. Architecture

Histogram-first validation using pre-computed pattern histograms.

## 2. UnifiedCard Format

- Level 1 (Meta): Pattern ID, Name, Score, Concealed status
- Level 2 (Structure): Abstract components for UI rendering (not used in validation)
- Level 3 (Variations): Pre-calculated [u8; 42] histograms for every permutation

## 3. HandValidator

HandValidator::new(card: &UnifiedCard) -> creates flattened lookup table
  - Converts all pattern variations into AnalysisEntry structs
  - Total: 1,002 entries for 2025 card

## 4. Deficiency Calculation

calculate_deficiency(hand_histogram, target_histogram) -> i32
  - Compare histograms element-wise
  - missing_naturals: Tiles in pairs (< 3 count) - cannot use jokers
  - missing_groups: Tiles in groups (>= 3 count) - can use jokers
  - Return: missing_naturals + max(0, missing_groups - joker_count)
  - O(1) operation: ~17.67 ns per pattern

## 5. Win Validation

validate_win(hand: &Hand) -> Option<AnalysisResult>
  - Quick check: Must have 14 tiles
  - Scan all 1,002 variations
  - Return first with deficiency = 0
  - Performance: ~260 µs average

## 6. Analysis Mode

analyze(hand: &Hand, limit: usize) -> Vec<AnalysisResult>
  - Returns top N closest patterns
  - Sorted by deficiency (asc), then score (desc)
  - Used for AI hints and strategy

## 7. Performance

- Single validation: 260.81 µs (1,002 patterns)
- 1,000 evaluations: 53.45 ms (~18,700/sec)
- Deficiency calc: 17.67 ns per pattern
- Meets < 5ms requirement with 19x margin
```

**Action:** Either rewrite or replace [02-validation.md](../implementation/02-validation.md) entirely.

---

### 3. **[03-networking.md](../implementation/03-networking.md)** - MINOR UPDATE

### Section 2 "Message Types" (Lines 14-24)

Example shows old Tile format:

```json
"tile": { "suit": "Dots", "rank": { "type": "Number", "value": 5 } }
```

**Should be:**

```json
"tile": 22  // u8 index (22 = 5 Dots)
```

Or if we serialize with display name:

```json
"tile": { "id": 22, "name": "5 Dot" }
```

**Decision needed:** How do we serialize `Tile(u8)` over WebSocket?

- Option A: Send raw u8 (compact, fast)
- Option B: Send { id: u8, name: String } (readable, debuggable)
- Recommendation: Use serde with custom serializer for both

---

### 4. **[04-client-state.md](../implementation/04-client-state.md)** - MINOR UPDATE

No critical changes needed. The refactor is backend-only. Client still receives tiles and stores them.

---

## Status Updates

- 2026-01-03: `docs/implementation/03-networking.md` updated to reflect per-IP auth limits and Charleston pass throttling.

**Optional enhancement:** Client could maintain its own histogram for local validation, but not required.

---

### 5. **[05-persistence.md](../implementation/05-persistence.md)** - NO CHANGES NEEDED ✅

Event log is schema-agnostic. Tile representation in events will change, but persistence mechanism is unchanged.

---

### 6. **[06-testing.md](../implementation/06-testing.md)** - MINOR UPDATE

### Section 2 "Core Unit Tests" (Line 34)

Add:

```markdown
- Histogram-based validation tests:
  - Exact match (deficiency = 0)
  - Near-win (deficiency = 1)
  - Joker substitution in groups
  - Load unified_card2025.json (1,002 variations)
```

### Section 7 "CI Gates" (Line 92)

Update test counts:

```markdown
- cargo test (72 tests: 67 unit + 5 integration)
```

---

### 7. **[07-terminal-client.md](../implementation/07-terminal-client.md)** - MINOR UPDATE

### Section 4 "Terminal UI Layout" (Lines 94-97)

Tile display format is fine, but internally tiles are now u8 indices.

### Section 9 "State Management" (Lines 256-268)

Hand state updates correctly reference concealed/exposed. Internal histogram is transparent to terminal client.

**No critical updates needed** - terminal client sees the same logical tiles, just indexed differently internally.

---

## Summary Table

| Document | Priority | Update Scope | Estimated Effort |
|----------|----------|--------------|------------------|
| [01-game-core.md](../implementation/01-game-core.md) | **HIGH** | Major (Section 3, Status) | 30-45 min |
| [02-validation.md](../implementation/02-validation.md) | **HIGH** | Complete rewrite | 1-2 hours |
| [03-networking.md](../implementation/03-networking.md) | MEDIUM | Minor (tile serialization example) | 10 min |
| [04-client-state.md](../implementation/04-client-state.md) | LOW | None (optional enhancement) | 0 min |
| [05-persistence.md](../implementation/05-persistence.md) | NONE | No changes needed ✅ | 0 min |
| [06-testing.md](../implementation/06-testing.md) | LOW | Minor (add histogram tests) | 10 min |
| [07-terminal-client.md](../implementation/07-terminal-client.md) | LOW | None (implementation complete) | 0 min |

**Total Estimated Effort:** 2-3 hours

---

## Recommended Order

1. **[02-validation.md](../implementation/02-validation.md)** - Rewrite first (highest impact, most obsolete)
2. **[01-game-core.md](../implementation/01-game-core.md)** - Update Section 3 and status
3. **[06-testing.md](../implementation/06-testing.md)** - Add histogram test requirements
4. **[03-networking.md](../implementation/03-networking.md)** - Fix serialization example

Documents 04, 05, 07 are fine as-is.

---

## Notes

- The refactor is **internal only** - external API (commands/events) unchanged
- Tile serialization format needs decision (raw u8 vs enriched object)
- Performance metrics should be added to validation doc (see [2026-01-03-performance-results.md](2026-01-03-performance-results.md))
- Integration test suite validates the new system end-to-end
