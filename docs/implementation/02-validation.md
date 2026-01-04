# 02. Validation Engine Implementation Spec

This document specifies the histogram-based validation system for American Mahjong hands against NMJL card patterns.

<!-- ****implemented**** -->

---

## 1. Architecture Overview

The validation engine uses a **data-oriented, histogram-first** approach:

- **Pre-computed histograms** for all pattern variations (stored in `unified_card2025.json`)
- **O(1) vector subtraction** to calculate distance-to-win
- **No runtime pattern expansion** - all permutations pre-calculated
- **Performance target:** < 1ms per validation ✅ **Achieved: ~53 µs (19x faster)**

---

## 2. Data Format: Unified Card

The unified card format consolidates pattern metadata and validation data into a single JSON file.

### 2.1 Structure

**Level 1 (Meta)** - Pattern identification:

```json
{
  "id": "2025-13579-1-1",
  "category": "13579",
  "description": "11 333 5555 777 99 (Any 1 or 3 Suits)",
  "score": 25,
  "concealed": false
}
```

**Level 2 (Structure)** - UI rendering components (not used for validation):

```json
{
  "structure": [
    { "type": "pair", "value": "1", "suit_var": "VSUIT1" },
    { "type": "pung", "value": "3", "suit_var": "VSUIT1" }
  ]
}
```

**Level 3 (Variations)** - Pre-computed histograms for validation:

```json
{
  "variations": [
    {
      "id": "2025-13579-1-1-SEQ1",
      "histogram": [2, 0, 3, 0, 4, 0, 3, 0, 2, 0, 0, ..., 0]
    }
  ]
}
```

### 2.2 Histogram Format

Each histogram is a `Vec<u8>` of length 42, mapping tile indices to required counts:

- **Indices 0-34:** Standard tiles (Bams, Craks, Dots, Winds, Dragons, Flower)
- **Index 35:** Jokers (always 0 in target histograms, since jokers are wild)
- **Indices 36-41:** Reserved for future expansion

Example histogram `[2, 0, 3, 0, 4, 0, 3, 0, 2, ...]`:

- Position 0 (1 Bam): need 2
- Position 2 (3 Bam): need 3
- Position 4 (5 Bam): need 4
- Position 6 (7 Bam): need 3
- Position 8 (9 Bam): need 2

### 2.3 Card Statistics (2025)

- **71 patterns** (across all categories)
- **1,002 variations** (all suit permutations pre-computed)
- **Total file size:** 47,812 lines (~2.3 MB)

---

## 3. Core Types

### 3.1 UnifiedCard

```rust
pub struct UnifiedCard {
    pub meta: CardMeta,
    pub patterns: Vec<Pattern>,
}

pub struct CardMeta {
    pub year: u16,
    pub version: String,
    pub generated_at: Option<String>,
}

pub struct Pattern {
    pub id: String,
    pub category: String,
    pub description: String,
    pub score: u16,
    pub concealed: bool,
    pub structure: Vec<PatternComponent>,  // For UI rendering
    pub variations: Vec<Variation>,        // For validation
}

pub struct Variation {
    pub id: String,
    pub note: Option<String>,
    pub histogram: Vec<u8>,  // Length 42
}
```

### 3.2 AnalysisEntry

Flattened lookup table entry (used internally by validator):

```rust
pub struct AnalysisEntry {
    pub histogram: Vec<u8>,
    pub pattern_id: String,
    pub variation_id: String,
    pub score: u16,
    pub concealed: bool,
}
```

### 3.3 AnalysisResult

Validation output:

```rust
pub struct AnalysisResult {
    pub pattern_id: String,      // e.g., "2025-13579-1-1"
    pub variation_id: String,    // e.g., "2025-13579-1-1-SEQ1"
    pub deficiency: i32,         // Tiles needed to win (0 = Mahjong)
    pub score: u16,              // Pattern score if won
}
```

---

## 4. HandValidator

### 4.1 Initialization

```rust
pub struct HandValidator {
    lookup_table: Vec<AnalysisEntry>,
}

impl HandValidator {
    pub fn new(card: &UnifiedCard) -> Self {
        // Flatten all patterns + variations into lookup table
        Self {
            lookup_table: card.to_analysis_table(),
        }
    }
}
```

The `lookup_table` contains all 1,002 variations as flat entries for fast scanning.

### 4.2 Core Algorithm: Deficiency Calculation

The heart of the validation engine is `Hand::calculate_deficiency()`:

```rust
/// Calculate the "deficiency" (distance to win) for a given target pattern.
///
/// This implements the core histogram-based validation algorithm:
/// 1. Compare the hand's histogram against the target pattern's histogram
/// 2. Count missing tiles in two categories:
///    - `missing_naturals`: Tiles needed in pairs (< 3 count) - cannot use jokers
///    - `missing_groups`: Tiles needed in groups (>= 3 count) - can use jokers
/// 3. Subtract available jokers from group deficits
/// 4. Return total: naturals + remaining groups
///
/// A deficiency of 0 means Mahjong (winning hand).
pub fn calculate_deficiency(&self, target_histogram: &[u8]) -> i32 {
    let mut missing_naturals = 0;
    let mut missing_groups = 0;
    let my_jokers = self.counts[JOKER_INDEX as usize];

    let limit = std::cmp::min(target_histogram.len(), 35);

    for (i, &needed) in target_histogram.iter().enumerate().take(limit) {
        let have = self.counts[i];

        if needed > 0 && have < needed {
            let diff = (needed - have) as i32;
            if needed < 3 {
                missing_naturals += diff;
            } else {
                missing_groups += diff;
            }
        }
    }

    let remaining_group_deficit = std::cmp::max(0, missing_groups - (my_jokers as i32));
    missing_naturals + remaining_group_deficit
}
```

**Key Insights:**

- **Pairs (count < 3):** Must be natural tiles, jokers cannot substitute
- **Groups (count ≥ 3):** Can use jokers to fill deficits
- **O(1) complexity:** Fixed 35 iterations regardless of hand composition
- **Performance:** ~17.67 ns per deficiency calculation

---

## 5. Validation Functions

### 5.1 Win Validation

Check if a hand is a winning hand (Mahjong):

```rust
pub fn validate_win(&self, hand: &Hand) -> Option<AnalysisResult> {
    // Quick check: Must have 14 tiles
    if hand.total_tiles() != 14 {
        return None;
    }

    let best = self.analyze(hand, 1).pop();

    if let Some(res) = best {
        if res.deficiency == 0 {
            return Some(res);
        }
    }
    None
}
```

**Returns:**

- `Some(AnalysisResult)` if hand matches a pattern perfectly (deficiency = 0)
- `None` if hand does not win

**Performance:** ~260 µs average (scans all 1,002 variations)

### 5.2 Analysis Mode

Find the closest N patterns to a hand (used for hints and AI):

```rust
pub fn analyze(&self, hand: &Hand, limit: usize) -> Vec<AnalysisResult> {
    let mut results = Vec::with_capacity(self.lookup_table.len());

    for entry in &self.lookup_table {
        // Skip concealed patterns if hand has exposed melds
        if entry.concealed && !hand.exposed.is_empty() {
            continue;
        }

        let dist = hand.calculate_deficiency(&entry.histogram);

        results.push(AnalysisResult {
            pattern_id: entry.pattern_id.clone(),
            variation_id: entry.variation_id.clone(),
            deficiency: dist,
            score: entry.score,
        });
    }

    // Sort: Primary = Deficiency (asc), Secondary = Score (desc)
    results.sort_by(|a, b| {
        match a.deficiency.cmp(&b.deficiency) {
            std::cmp::Ordering::Equal => b.score.cmp(&a.score),
            other => other,
        }
    });

    results.into_iter().take(limit).collect()
}
```

**Returns:** Top N closest patterns, sorted by:

1. **Deficiency (ascending):** Fewest tiles needed to win
2. **Score (descending):** Highest-scoring patterns if tied

**Use Cases:**

- **AI Strategy:** Find which patterns to pursue
- **Hint System:** Show player what they're close to
- **Charleston Planning:** Decide which tiles to keep/discard

---

## 6. Joker Handling

### 6.1 Joker Rules (NMJL)

- Jokers are **wild** and can substitute for any tile in **groups of 3+**
- Jokers **cannot** be used in pairs (count < 3)
- Exception: Some patterns explicitly allow joker pairs (rare, marked in pattern metadata)

### 6.2 Implementation

The deficiency algorithm automatically enforces joker rules:

```rust
if needed < 3 {
    missing_naturals += diff;  // Cannot use jokers
} else {
    missing_groups += diff;    // Can use jokers
}
```

No explicit joker assignment needed during validation - we only count deficiency.

### 6.3 Joker Assignment (Post-Validation)

After a win is confirmed, `Hand.joker_assignments` can be populated:

```rust
pub fn set_joker_assignments(&mut self, assignments: HashMap<usize, Tile>) {
    self.joker_assignments = Some(assignments);
}
```

This maps joker indices in `hand.concealed` to the tiles they represent, used for:

- Display/UI (show what jokers are standing in for)
- Replay reconstruction
- Statistics tracking

---

## 7. Concealed vs Exposed Hands

### 7.1 Pattern Constraint

Some patterns require a **fully concealed hand** (no exposed melds):

```json
{
  "id": "2025-CONCEALED-1-1",
  "concealed": true,
  ...
}
```

### 7.2 Validation Logic

The validator automatically filters concealed-only patterns:

```rust
if entry.concealed && !hand.exposed.is_empty() {
    continue;  // Skip this pattern
}
```

**Result:** Hands with exposed melds cannot match concealed-only patterns, even if tile composition matches.

---

## 8. Performance Characteristics

### 8.1 Benchmark Results

From [2026-01-03-performance-results.md](../plans/2026-01-03-performance-results.md):

| Operation                 | Time          | Notes                           |
| ------------------------- | ------------- | ------------------------------- |
| **Deficiency Calc**       | **17.67 ns**  | Single histogram comparison     |
| **Histogram Lookup**      | **36.01 ns**  | O(1) tile presence check        |
| **Single Win Validation** | **260.81 µs** | Full scan of 1,002 variations   |
| **Analyze Top 10**        | **246.62 µs** | Sort all results, return top 10 |
| **1,000 Evaluations**     | **53.45 ms**  | ~18,700 evaluations/sec         |

### 8.2 Complexity Analysis

- **Deficiency calculation:** O(1) - always 35 iterations
- **Win validation:** O(N) where N = number of variations (1,002 for 2025 card)
- **Analysis mode:** O(N log N) due to sorting
- **Histogram lookups:** O(1) - direct array indexing

### 8.3 Memory Usage

- **UnifiedCard:** ~2.3 MB in memory (1,002 × 42-byte histograms + metadata)
- **Hand histogram:** 37 bytes (fixed size)
- **Lookup table:** ~1,002 entries × ~100 bytes ≈ 100 KB

**Total memory footprint:** ~2.5 MB per validator instance (negligible for modern systems)

---

## 9. Error Cases and Edge Handling

### 9.1 Invalid Hands

Validation gracefully handles:

- **Wrong tile count:** `validate_win()` returns `None` if not 14 tiles
- **Impossible patterns:** High deficiency indicates hand is far from any pattern
- **All jokers:** Deficiency calculation treats jokers as wildcards correctly

### 9.2 Missing Data

If `unified_card.json` is malformed:

- `UnifiedCard::from_json()` returns `Err(serde_json::Error)`
- Server should fail-fast on startup if card cannot load
- No runtime validation errors - all patterns known at initialization

---

## 10. Integration with Game Flow

### 10.1 Server-Side Validation

When a player declares Mahjong:

```rust
// In table.rs command processing
fn handle_declare_mahjong(&mut self, player: Seat) -> Vec<GameEvent> {
    let hand = &self.players[&player].hand;

    // Validate using HandValidator
    let result = self.validator.validate_win(hand);

    match result {
        Some(analysis) => {
            // Valid win!
            vec![
                GameEvent::MahjongDeclared { player },
                GameEvent::HandValidated {
                    player,
                    pattern_id: analysis.pattern_id,
                    score: analysis.score,
                },
                GameEvent::GameOver {
                    winner: player,
                    result: GameResult::Win { /* ... */ },
                },
            ]
        }
        None => {
            // Invalid win - penalize player
            vec![GameEvent::CommandRejected {
                reason: "Invalid Mahjong - hand does not match any pattern".into(),
            }]
        }
    }
}
```

### 10.2 AI Hint System

AI can query closest patterns during gameplay:

```rust
// AI deciding which tile to discard
let current_hand = ai_player.hand.clone();

// Try discarding each tile, see which keeps us closest to a pattern
let mut best_discard = None;
let mut best_deficiency = i32::MAX;

for (idx, tile) in current_hand.concealed.iter().enumerate() {
    let mut test_hand = current_hand.clone();
    test_hand.remove_tile(*tile).unwrap();

    let results = validator.analyze(&test_hand, 1);
    if let Some(best) = results.first() {
        if best.deficiency < best_deficiency {
            best_deficiency = best.deficiency;
            best_discard = Some(idx);
        }
    }
}
```

---

## 11. Future Optimizations

### 11.1 SIMD Vectorization

The deficiency calculation is embarrassingly parallel:

```rust
// Current: scalar loop
for (i, &needed) in target_histogram.iter().enumerate() {
    let have = self.counts[i];
    // ...
}

// Future: SIMD vector operations
// Process 8-16 histogram elements at once using AVX/NEON
```

**Potential speedup:** 4-8x on modern CPUs

### 11.2 Early Exit

Stop scanning after finding deficiency = 0:

```rust
for entry in &self.lookup_table {
    let dist = hand.calculate_deficiency(&entry.histogram);
    if dist == 0 {
        return Some(AnalysisResult { /* ... */ });
    }
}
```

**Benefit:** Average-case speedup for winning hands (current: scans all 1,002)

### 11.3 Pattern Caching

Pre-compute common hand signatures and cache results:

```rust
// Hash hand histogram -> Vec<AnalysisResult>
let cache_key = hash(&hand.counts);
if let Some(cached) = pattern_cache.get(&cache_key) {
    return cached.clone();
}
```

**Benefit:** Repeated analysis of similar hands (useful for AI simulations)

### 11.4 Bloom Filter Pre-screening

Use a Bloom filter to quickly reject impossible patterns:

- **Phase 1:** Bloom filter eliminates 90% of patterns (few nanoseconds)
- **Phase 2:** Full deficiency calc on remaining 10% (~100 patterns)

**Potential speedup:** 5-10x for hands far from winning

---

## 12. Testing Requirements

### 12.1 Unit Tests

Minimum test coverage:

- **Exact match:** Hand with deficiency = 0 validates as win
- **Near-win:** Hand 1 tile away has deficiency = 1
- **Joker substitution:** Joker in group reduces deficiency correctly
- **Joker in pair:** Joker in pair position **does not** reduce deficiency
- **Concealed filter:** Exposed hand skips concealed-only patterns
- **Load unified card:** Successfully parse `unified_card2025.json` (1,002 variations)

### 12.2 Integration Tests

See [tests/unified_card_integration.rs](../../crates/mahjong_core/tests/unified_card_integration.rs):

- `test_load_unified_card` - Parse and validate card structure
- `test_winning_hand_validation` - Exact pattern match
- `test_near_win_analysis` - Deficiency calculation accuracy
- `test_joker_substitution` - Joker in group validates correctly
- `test_random_hand_analysis_performance` - Performance baseline

### 12.3 Property Tests

Invariants that must always hold:

- `validate_win()` never panics (even with malformed hands)
- Deficiency is always non-negative
- Deficiency = 0 ⟹ hand has exactly 14 tiles
- All random hands return either `Some(result)` or `None` (no crashes)

---

## 13. Migration from Old System

### 13.1 Old Approach (Pre-Refactor)

**Component-based validation:**

- Patterns stored as abstract components (e.g., "Pair of 1s", "Pung of VSUIT1")
- VSUIT resolution at runtime (generate suit permutations on-the-fly)
- Joker flexibility rules applied per-component
- Brute-force search through component combinations

**Problems:**

- Slow (~5ms per validation)
- Complex branching logic (VSUIT_DRAGON had special cases)
- Hard to optimize or parallelize

### 13.2 New Approach (Current)

**Histogram-first validation:**

- Pre-compute all suit permutations offline (stored in JSON)
- Single vector subtraction per pattern variation
- No runtime branching for VSUIT resolution
- Trivially parallelizable (SIMD-ready)

**Benefits:**

- **19x faster** than target (<1ms → ~53 µs)
- Simpler code (no VSUIT expansion logic)
- Easier to test (deterministic histograms)
- Ready for Monte Carlo simulations (thousands of evaluations/second)

---

## 14. Implementation Checklist

- [x] UnifiedCard types and JSON parser
- [x] HandValidator with lookup table
- [x] Hand histogram maintenance (add/remove tiles)
- [x] Deficiency calculation algorithm
- [x] Win validation (deficiency = 0)
- [x] Analysis mode (top N patterns)
- [x] Concealed pattern filtering
- [x] Integration tests (5 tests passing)
- [x] Performance benchmarks (Criterion)
- [ ] SIMD optimization (future)
- [ ] Pattern caching (future)
- [ ] Bloom filter pre-screening (future)

---

## 15. API Reference

### 15.1 Loading the Card

```rust
use mahjong_core::rules::card::UnifiedCard;
use std::fs;

let json = fs::read_to_string("data/cards/unified_card2025.json")?;
let card = UnifiedCard::from_json(&json)?;
println!("Loaded {} patterns", card.patterns.len());
```

### 15.2 Creating a Validator

```rust
use mahjong_core::rules::validator::HandValidator;

let validator = HandValidator::new(&card);
// Validator is now ready, contains flattened lookup table of 1,002 variations
```

### 15.3 Validating a Win

```rust
use mahjong_core::hand::Hand;
use mahjong_core::tile::Tile;

let hand = Hand::new(vec![
    Tile(0), Tile(0),  // 1 Bam x2
    // ... (14 tiles total)
]);

if let Some(result) = validator.validate_win(&hand) {
    println!("Mahjong! Pattern: {} (score: {})",
             result.pattern_id, result.score);
} else {
    println!("Not a winning hand");
}
```

### 15.4 Analyzing Closest Patterns

```rust
let results = validator.analyze(&hand, 5);

for (i, result) in results.iter().enumerate() {
    println!("{}. {} - {} tiles away (score: {})",
             i + 1,
             result.pattern_id,
             result.deficiency,
             result.score);
}
```

---

## Appendix: Histogram Index Reference

```
Index  | Tile
-------|---------------------
0-8    | Bams 1-9
9-17   | Craks 1-9
18-26  | Dots 1-9
27     | East Wind
28     | South Wind
29     | West Wind
30     | North Wind
31     | Green Dragon
32     | Red Dragon
33     | White Dragon (Soap)
34     | Flower
35     | Joker (always 0 in target histograms)
36-41  | Reserved (future expansion)
```
