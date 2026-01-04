# Plan: Unified Card System Refactor

**Complete**

**Date:** 2026-01-03
**Goal:** Align Rust codebase and JSON data formats to a single, high-performance "Histogram-First" model to support the analysis engine and O(1) validation.

---

## 1. Data Strategy: The Unified JSON

Consolidate `card2025.json` and `runtime_card2025.json` into a single `unified_card2025.json`.

- **Level 1 (Meta):** Pattern ID, Name, Score, Description, Concealed status.
- **Level 2 (Structure):** Abstract components (e.g., "Pair of 1s") for UI rendering.
- **Level 3 (Variations):** Pre-calculated `[u8; 42]` histograms for every possible suit/rank permutation.

## 2. Code Strategy: Data-Oriented Refactor

Shift from semantic enums to index-based primitives.

### Phase 1: `tile.rs` (The Primitive)

- **Change:** Replace `enum TileKind` and `struct Tile` with `struct Tile(pub u8)`.
- **Mapping:**
  - 0-8: Bams (1-9)
  - 9-17: Craks (1-9)
  - 18-26: Dots (1-9)
  - 27-30: Winds (E, S, W, N)
  - 31-33: Dragons (G, R, W/Soap)
  - 34: Flower
  - 35: Joker
  - 36: Blank
- **Impact:** All logic becomes array indexing. Semantic names are moved to `impl Display`.

### Phase 2: `hand.rs` (The Container)

- **Change:** `Hand` will now internally track a `[u8; 42]` histogram.
- **Logic:** Adding/removing a tile is a `histogram[tile.0] += 1` operation.
- **Analysis:** "Distance to win" becomes vector subtraction between `Hand.histogram` and `Pattern.variation.histogram`.

### Phase 3: `deck.rs` (The Generator)

- **Change:** Update the deck generation to produce the new `Tile(u8)` indices.
- **Count:** 152 tiles (Standard) or 160 (with Blanks).

### Phase 4: `rules/` (The Engine)

- **Change:** Implement `UnifiedCard` loader using `serde`.
- **Validator:** Implement the `Distance` algorithm: `Sum(Max(0, Target[i] - Player[i])) <= Jokers`.

### Phase 5: Cascade Updates

- Update `table.rs`, `command.rs`, and `event.rs` to handle the new `Tile` struct.
- Fix all failing tests (expected significant breakage initially).

## 3. Verification Plan

1. **Unit Tests:** Rewrite `tile_tests`, `hand_tests`, and `deck_tests` to match the `u8` model.
2. **Integration:** Validate that a sample hand correctly matches a pattern from the new `unified_card.json`.
3. **Performance:** Benchmark 1,000 hand evaluations to ensure sub-millisecond latency.
