# 8. Validation Engine

The validation engine is the most complex part of the game logic. It determines whether a player's 14 tiles match any winning pattern on The Card for the current year.

## 8.1 The Challenge

American Mahjong validation is computationally intensive because:

1. **Jokers are wildcards**: 8 Jokers can represent almost any tile, creating thousands of permutations
2. **Multiple patterns**: A hand must match at least one of ~40-50 patterns on The Card
3. **Variable suits**: Patterns use `VSUIT1`, `VSUIT2`, `VSUIT3` which must be resolved to actual suits (Dots, Bams, or Cracks)
4. **Flexibility markers**: Some tiles in a pattern can be Jokers, others cannot
5. **Concealed vs. Exposed**: Some patterns require fully concealed hands (marked with "C")

**Example of complexity:**

A hand with 3 Jokers has:

- 3 Jokers × ~144 possible tile identities each = potentially millions of combinations
- Must check each combination against ~50 patterns
- Must respect Joker placement rules (can't be in pairs, except specific patterns)

## 8.2 High-Level Algorithm

The validator uses a **normalize → permute → match** strategy:

```rust
/// Check if a hand is a valid Mahjong win
pub fn validate_hand(
    hand: &Hand,
    card: &CardDefinition,
    concealed_only: bool, // True if hand must be fully concealed
) -> ValidationResult {
    // Step 1: Normalize the hand into tile counts
    let normalized = normalize_hand(hand)?;

    // Step 2: Extract Jokers and generate possible assignments
    let joker_count = normalized.joker_count;
    let joker_permutations = generate_joker_permutations(&normalized, card);

    // Step 3: Try to match each permutation against all patterns
    for permutation in joker_permutations {
        for pattern in card.all_patterns() {
            // Skip concealed-only patterns if hand is exposed
            if pattern.concealed && !concealed_only {
                continue;
            }

            if let Some(matched) = try_match_pattern(&normalized, &permutation, pattern) {
                return ValidationResult::Valid {
                    pattern: pattern.clone(),
                    joker_assignments: matched.joker_assignments,
                    points: calculate_points(pattern, concealed_only),
                };
            }
        }
    }

    // No pattern matched
    ValidationResult::Invalid {
        reason: "Hand does not match any pattern on The Card".to_string(),
    }
}
```

---

## 8.3 Step 1: Normalize the Hand

Convert the hand into a compact representation (tile counts) for easier comparison.

```rust
/// Normalized representation of a hand for validation
#[derive(Debug, Clone)]
pub struct NormalizedHand {
    /// Count of each non-Joker tile
    pub tile_counts: HashMap<Tile, u8>,

    /// Number of Jokers in the hand
    pub joker_count: u8,

    /// Total tiles (should be 14)
    pub total_tiles: u8,

    /// Whether the hand is fully concealed
    pub is_concealed: bool,
}

/// Convert a Hand into a NormalizedHand
fn normalize_hand(hand: &Hand) -> Result<NormalizedHand, ValidationError> {
    let mut tile_counts: HashMap<Tile, u8> = HashMap::new();
    let mut joker_count = 0;

    // Count concealed tiles
    for tile in &hand.concealed {
        if tile.suit == Suit::Jokers {
            joker_count += 1;
        } else {
            *tile_counts.entry(*tile).or_insert(0) += 1;
        }
    }

    // Count exposed tiles (from melds)
    for meld in &hand.exposed {
        for tile in &meld.tiles {
            if tile.suit == Suit::Jokers {
                joker_count += 1;
            } else {
                *tile_counts.entry(*tile).or_insert(0) += 1;
            }
        }
    }

    let total_tiles = tile_counts.values().sum::<u8>() + joker_count;

    if total_tiles != 14 {
        return Err(ValidationError::InvalidTileCount {
            expected: 14,
            got: total_tiles,
        });
    }

    Ok(NormalizedHand {
        tile_counts,
        joker_count,
        total_tiles,
        is_concealed: hand.exposed.is_empty(),
    })
}
```

**Example:**

Hand: `[1D, 1D, Jkr, 3D, 3D, 3D, 5D, 5D, 5D, 5D, Jkr, 7D, 7D, 7D]`

Normalized:

```rust
NormalizedHand {
    tile_counts: {
        1D: 2,
        3D: 3,
        5D: 4,
        7D: 3,
    },
    joker_count: 2,
    total_tiles: 14,
    is_concealed: true,
}
```

---

## 8.4 Step 2: Generate Joker Permutations

**The Challenge:** If a hand has 3 Jokers, we don't know what they represent until we try matching patterns.

**Naive Approach (Too Slow):**

- Try all possible tile identities for each Joker
- 3 Jokers × 144 tiles each = 2,985,984 combinations
- This is computationally infeasible

**Optimized Approach (Pattern-Guided):**

Instead of brute-forcing all combinations, we **only generate Joker assignments that could possibly satisfy a pattern**.

```rust
/// Generate plausible Joker assignments based on pattern requirements
fn generate_joker_permutations(
    normalized: &NormalizedHand,
    card: &CardDefinition,
) -> Vec<JokerPermutation> {
    let mut permutations = Vec::new();

    // For each pattern, determine what Jokers could represent
    for pattern in card.all_patterns() {
        // Build a "required tiles" list from the pattern
        let required = build_required_tiles(pattern);

        // Calculate how many of each tile are missing
        let mut missing_tiles = Vec::new();
        for (tile, required_count) in required {
            let have_count = normalized.tile_counts.get(&tile).copied().unwrap_or(0);
            let deficit = required_count.saturating_sub(have_count);

            for _ in 0..deficit {
                missing_tiles.push(tile);
            }
        }

        // If we have exactly the right number of Jokers to fill the gaps, this is a candidate
        if missing_tiles.len() == normalized.joker_count as usize {
            permutations.push(JokerPermutation {
                assignments: missing_tiles,
                pattern_description: pattern.description.clone(),
            });
        }
    }

    permutations
}

#[derive(Debug, Clone)]
pub struct JokerPermutation {
    /// What each Joker represents (ordered by Joker index in hand)
    pub assignments: Vec<Tile>,

    /// Which pattern this permutation is trying to match
    pub pattern_description: String,
}

/// Build a "required tiles" map from a pattern with variable suits resolved
fn build_required_tiles(pattern: &HandPattern) -> HashMap<Tile, u8> {
    let mut required = HashMap::new();

    // Simplified: VSUIT*_DRAGON components are expanded during matching (dragon vs suit).
    // Iterate over all possible VSUIT assignments
    // VSUIT1 can be Dots, Bams, or Cracks
    // VSUIT2 can be any of the remaining two
    // VSUIT3 is the last one (or any if vsuit_count < 3)

    // This is simplified - see Section 8.5 for full VSUIT resolution
    for vsuit_mapping in generate_vsuit_mappings(pattern.vsuit_count) {
        let mut pattern_tiles = HashMap::new();

        for component in &pattern.components {
            // Note: VSUIT*_DRAGON expands to multiple options and is handled by the matcher.
            if let Some(tile) = resolve_component_tile(component, &vsuit_mapping) {
                *pattern_tiles.entry(tile).or_insert(0) += component.count;
            }
        }

        // Merge into required (keep all possible interpretations)
        for (tile, count) in pattern_tiles {
            required.insert(tile, count);
        }
    }

    required
}

/// Resolve a component into a concrete tile (simplified)
fn resolve_component_tile(
    component: &Component,
    mapping: &HashMap<ComponentSuit, Suit>,
) -> Option<Tile> {
    match component.suit {
        ComponentSuit::Dots => Tile::new_number(Suit::Dots, component.number).ok(),
        ComponentSuit::Bams => Tile::new_number(Suit::Bams, component.number).ok(),
        ComponentSuit::Cracks => Tile::new_number(Suit::Cracks, component.number).ok(),
        ComponentSuit::Wind => resolve_wind_tile(component.number),
        ComponentSuit::Dragon => resolve_dragon_tile(component.number),
        ComponentSuit::Flower => Some(Tile { suit: Suit::Flowers, rank: Rank::Flower }),
        ComponentSuit::VSUIT1 | ComponentSuit::VSUIT2 | ComponentSuit::VSUIT3 => {
            let suit = resolve_vsuit(component.suit, mapping)?;
            Tile::new_number(suit, component.number).ok()
        }
        ComponentSuit::VSUIT1_DRAGON | ComponentSuit::VSUIT2_DRAGON | ComponentSuit::VSUIT3_DRAGON => {
            // Expanded during matching: try both dragon and VSUIT branches.
            None
        }
    }
}
```

---

## 8.5 Variable Suit (VSUIT) Resolution

Patterns use `VSUIT1`, `VSUIT2`, `VSUIT3` as placeholders. We must resolve them to actual suits (Dots, Bams, Cracks).

**Rules:**

- **vsuit_count = 1**: All VSUITs map to the same suit (e.g., all Dots)
- **vsuit_count = 2**: VSUIT1 and VSUIT2 are different suits
- **vsuit_count = 3**: All three suits are used

**Implementation:**

```rust
/// All possible VSUIT mappings for a given vsuit_count
fn generate_vsuit_mappings(vsuit_count: u8) -> Vec<HashMap<ComponentSuit, Suit>> {
    let suits = [Suit::Dots, Suit::Bams, Suit::Cracks];
    let mut mappings = Vec::new();

    match vsuit_count {
        1 => {
            // All VSUITs map to the same suit
            for &suit in &suits {
                mappings.push(HashMap::from([
                    (ComponentSuit::VSUIT1, suit),
                    (ComponentSuit::VSUIT2, suit),
                    (ComponentSuit::VSUIT3, suit),
                ]));
            }
        }

        2 => {
            // VSUIT1 and VSUIT2 are different, VSUIT3 can be either
            for (i, &suit1) in suits.iter().enumerate() {
                for (j, &suit2) in suits.iter().enumerate() {
                    if i != j {
                        mappings.push(HashMap::from([
                            (ComponentSuit::VSUIT1, suit1),
                            (ComponentSuit::VSUIT2, suit2),
                            (ComponentSuit::VSUIT3, suit1), // Can be suit1 or suit2
                        ]));
                        mappings.push(HashMap::from([
                            (ComponentSuit::VSUIT1, suit1),
                            (ComponentSuit::VSUIT2, suit2),
                            (ComponentSuit::VSUIT3, suit2),
                        ]));
                    }
                }
            }
        }

        3 => {
            // All three suits must be different (all 6 permutations)
            use itertools::Itertools;
            for perm in suits.iter().permutations(3) {
                mappings.push(HashMap::from([
                    (ComponentSuit::VSUIT1, *perm[0]),
                    (ComponentSuit::VSUIT2, *perm[1]),
                    (ComponentSuit::VSUIT3, *perm[2]),
                ]));
            }
        }

        _ => panic!("Invalid vsuit_count: {}", vsuit_count),
    }

    mappings
}

/// Resolve a VSUIT placeholder to a Suit
fn resolve_vsuit(suit: ComponentSuit, mapping: &HashMap<ComponentSuit, Suit>) -> Option<Suit> {
    match suit {
        ComponentSuit::VSUIT1 | ComponentSuit::VSUIT2 | ComponentSuit::VSUIT3 => {
            mapping.get(&suit).copied()
        }
        _ => None,
    }
}
```

**Example:**

Pattern: `"11 333 5555 777 99 (Any 1 or 3 Suits)"` with `vsuit_count: 3`

VSUIT mappings generated:

```rust
[
    { "VSUIT1": Dots, "VSUIT2": Bams, "VSUIT3": Cracks },
    { "VSUIT1": Dots, "VSUIT2": Cracks, "VSUIT3": Bams },
    { "VSUIT1": Bams, "VSUIT2": Dots, "VSUIT3": Cracks },
    { "VSUIT1": Bams, "VSUIT2": Cracks, "VSUIT3": Dots },
    { "VSUIT1": Cracks, "VSUIT2": Dots, "VSUIT3": Bams },
    { "VSUIT1": Cracks, "VSUIT2": Bams, "VSUIT3": Dots },
]
```

For **each** mapping, we generate a required tile set and try to match the hand.

---

## 8.6 Step 3: Pattern Matching

Once we have a Joker permutation and a resolved pattern, we check if they match.

```rust
/// Attempt to match a permutation against a pattern
fn try_match_pattern(
    normalized: &NormalizedHand,
    permutation: &JokerPermutation,
    pattern: &HandPattern,
) -> Option<MatchResult> {
    // Resolve the pattern with VSUIT mappings
    for vsuit_mapping in generate_vsuit_mappings(pattern.vsuit_count) {
        let required_tiles = build_required_tiles_with_mapping(pattern, &vsuit_mapping);

        // Build actual hand (tiles + Joker assignments)
        let actual_tiles = merge_tiles_with_jokers(
            &normalized.tile_counts,
            &permutation.assignments,
        );

        // Check if actual_tiles exactly matches required_tiles
        if tiles_match(&actual_tiles, &required_tiles) {
            return Some(MatchResult {
                pattern_description: pattern.description.clone(),
                vsuit_mapping,
                joker_assignments: permutation.assignments.clone(),
            });
        }
    }

    None
}

#[derive(Debug, Clone)]
pub struct MatchResult {
    /// Which pattern matched
    pub pattern_description: String,

    /// How VSUITs were resolved
    pub vsuit_mapping: HashMap<String, Suit>,

    /// What each Joker represents
    pub joker_assignments: Vec<Tile>,
}

/// Merge normalized tiles with Joker assignments
fn merge_tiles_with_jokers(
    tile_counts: &HashMap<Tile, u8>,
    joker_assignments: &[Tile],
) -> HashMap<Tile, u8> {
    let mut merged = tile_counts.clone();

    for joker_tile in joker_assignments {
        *merged.entry(*joker_tile).or_insert(0) += 1;
    }

    merged
}

/// Check if two tile count maps are identical
fn tiles_match(actual: &HashMap<Tile, u8>, required: &HashMap<Tile, u8>) -> bool {
    if actual.len() != required.len() {
        return false;
    }

    for (tile, &required_count) in required {
        if actual.get(tile).copied().unwrap_or(0) != required_count {
            return false;
        }
    }

    true
}
```

---

## 8.7 Handling Joker Restrictions

Not all tiles in a pattern can be represented by Jokers. The `flexibility` field in the card data indicates this.

**From Section 7 (Card Schema):**

```json
{
  "suit": "VSUIT1",
  "number": 3,
  "count": 3,
  "flexibility": 2 // Only 2 of these 3 tiles can be Jokers
}
```

**Updated Joker Permutation Generator:**

```rust
/// Generate Joker permutations respecting flexibility constraints
fn generate_joker_permutations_with_flexibility(
    normalized: &NormalizedHand,
    pattern: &HandPattern,
) -> Vec<JokerPermutation> {
    let mut permutations = Vec::new();

    for vsuit_mapping in generate_vsuit_mappings(pattern.vsuit_count) {
        // Build required tiles with flexibility constraints
        let mut flexible_tiles = Vec::new(); // Tiles that CAN be Jokers
        let mut fixed_tiles = Vec::new();    // Tiles that CANNOT be Jokers

        for component in &pattern.components {
            let flexibility = component
                .flexibility
                .unwrap_or(default_flexibility(component));
            let tile = match resolve_component_tile(component, &vsuit_mapping) {
                Some(tile) => tile,
                None => continue, // VSUIT*_DRAGON handled elsewhere
            };
            let have_count = normalized.tile_counts.get(&tile).copied().unwrap_or(0);

            // How many real tiles do we need (cannot be Jokers)?
            let fixed_count = component.count.saturating_sub(flexibility);

            if have_count < fixed_count {
                // Not enough real tiles, pattern cannot match
                continue;
            }

            // Remaining deficit can be filled with Jokers
            let deficit = component.count.saturating_sub(have_count);
            for _ in 0..deficit.min(flexibility) {
                flexible_tiles.push(tile);
            }
        }

        // If we have exactly the right number of Jokers, this is valid
        if flexible_tiles.len() == normalized.joker_count as usize {
            permutations.push(JokerPermutation {
                assignments: flexible_tiles,
                pattern_description: pattern.description.clone(),
            });
        }
    }

    permutations
}

/// Default flexibility rules when component.flexibility is omitted
fn default_flexibility(component: &Component) -> u8 {
    match component.count {
        1 | 2 => 0, // singles/pairs cannot be Jokers
        _ => match component.suit {
            ComponentSuit::Flower => 0,
            _ => component.count,
        },
    }
}
```

**Example:**

Pattern: `"DDD 333 5555 777"` (Dragons + numbered tiles)

- `DDD` has `flexibility: 2` → Only 2 of the 3 Dragons can be Jokers
- If the hand has `R, G, Jkr`, the Joker can represent `W` (White Dragon)
- If the hand has `Jkr, Jkr, Jkr`, this pattern **cannot** match (need at least 1 real Dragon)

---

## 8.8 Special Cases

### 8.8.1 Pair Rules

In most patterns, pairs **cannot** be Jokers (e.g., `11` must be two real `1` tiles).

**Exception:** Some patterns explicitly allow Joker pairs (e.g., `Jkr Jkr` counts as a pair).

**Implementation:**

```rust
/// Check if a pair component allows Jokers
fn pair_allows_jokers(component: &Component) -> bool {
    // In standard American Mahjong, pairs cannot be Jokers
    // unless the pair IS Jokers (Jkr Jkr)
    component.count == 2
        && component
            .flexibility
            .unwrap_or(default_flexibility(component)) == component.count
}
```

### 8.8.2 Like Tiles (Winds, Dragons, Flowers)

Some patterns require "like" tiles (all Winds, all Dragons, all Flowers) without specifying which.

**Example:** `WWW DDD FFF` (any 3 Winds, any 3 Dragons, any 3 Flowers)

**Implementation:**

```rust
/// Match "any Wind" or "any Dragon" patterns
fn match_flexible_honors(
    actual: &HashMap<Tile, u8>,
    required_type: HonorType,
    required_count: u8,
) -> bool {
    let matching_tiles: Vec<_> = actual.keys()
        .filter(|tile| is_honor_type(tile, required_type))
        .collect();

    let total_count: u8 = matching_tiles.iter()
        .map(|tile| actual.get(tile).copied().unwrap_or(0))
        .sum();

    total_count >= required_count
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum HonorType {
    Wind,
    Dragon,
    Flower,
}

fn is_honor_type(tile: &Tile, honor_type: HonorType) -> bool {
    match honor_type {
        HonorType::Wind => tile.suit == Suit::Winds,
        HonorType::Dragon => tile.suit == Suit::Dragons,
        HonorType::Flower => tile.suit == Suit::Flowers,
    }
}
```

### 8.8.3 Year Patterns (2025, 2026, etc.)

Year patterns use `0` (White Dragon/Soap) as zero and numbered tiles for the year.

**Example:** `2025` = `2D, 0 (White Dragon), 2D, 5D`

**Implementation:**

```rust
/// Resolve year pattern (e.g., "2025")
fn resolve_year_pattern(year: u32) -> Vec<Tile> {
    let year_str = year.to_string();
    year_str.chars().map(|ch| {
        if ch == '0' {
            // White Dragon represents 0
            Tile { suit: Suit::Dragons, rank: Rank::White }
        } else {
            let digit = ch.to_digit(10).unwrap() as u8;
            // Default to Dots, but could be any suit (check pattern)
            Tile::new_number(Suit::Dots, digit).unwrap()
        }
    }).collect()
}
```

---

## 8.9 Performance Optimizations

### 8.9.1 Early Termination

Stop checking patterns as soon as a match is found:

```rust
for pattern in card.all_patterns() {
    if let Some(matched) = try_match_pattern(&normalized, &permutation, pattern) {
        return ValidationResult::Valid { ... };
    }
}
```

### 8.9.2 Pattern Ordering

Check most common patterns first:

```rust
// Sort patterns by frequency of occurrence (based on historical data)
let mut patterns = card.all_patterns();
patterns.sort_by_key(|p| p.popularity_rank);
```

### 8.9.3 Tile Count Pruning

Before trying to match a pattern, check if the total tile counts are compatible:

```rust
fn quick_reject(hand: &NormalizedHand, pattern: &HandPattern) -> bool {
    // If pattern requires 5 Flowers but hand has 0, skip immediately
    let required_flowers = pattern.components.iter()
        .filter(|c| c.suit == ComponentSuit::Flower)
        .map(|c| c.count)
        .sum::<u8>();

    let have_flowers = hand.tile_counts.iter()
        .filter(|(tile, _)| tile.suit == Suit::Flowers)
        .map(|(_, count)| count)
        .sum::<u8>();

    have_flowers + hand.joker_count < required_flowers
}
```

### 8.9.4 Caching

For AI opponents or hint systems that check validation frequently:

```rust
use lru::LruCache;

pub struct Validator {
    cache: LruCache<NormalizedHand, ValidationResult>,
}

impl Validator {
    pub fn validate_cached(&mut self, hand: &Hand, card: &CardDefinition) -> ValidationResult {
        let normalized = normalize_hand(hand).unwrap();

        if let Some(cached) = self.cache.get(&normalized) {
            return cached.clone();
        }

        let result = validate_hand(hand, card, hand.exposed.is_empty());
        self.cache.put(normalized.clone(), result.clone());
        result
    }
}
```

---

## 8.10 Validation Result

The validator returns a rich result with diagnostic information:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ValidationResult {
    /// Hand is valid
    Valid {
        /// Which pattern matched
        pattern: HandPattern,

        /// How Jokers were assigned
        joker_assignments: HashMap<usize, Tile>,

        // Note: Points calculation out of MVP scope
        // Future: Add points field based on pattern and house rules
    },

    /// Hand is invalid
    Invalid {
        /// Why it doesn't match
        reason: String,

        /// (Optional) Diagnostic info for debugging
        closest_pattern: Option<String>,
        tiles_short: Option<Vec<Tile>>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ValidationError {
    InvalidTileCount { expected: u8, got: u8 },
    TooManyJokers { got: u8, max: u8 },
    InvalidTile { tile: Tile },
}
```

---

## 8.11 Example: Full Validation Flow

**Hand:**

```rust
let hand = Hand {
    concealed: vec![
        Tile::new_number(Suit::Dots, 1).unwrap(),
        Tile::new_number(Suit::Dots, 1).unwrap(),
        Tile { suit: Suit::Jokers, rank: Rank::Joker },
        Tile::new_number(Suit::Dots, 3).unwrap(),
        Tile::new_number(Suit::Dots, 3).unwrap(),
        Tile::new_number(Suit::Dots, 3).unwrap(),
        Tile::new_number(Suit::Dots, 5).unwrap(),
        Tile::new_number(Suit::Dots, 5).unwrap(),
        Tile::new_number(Suit::Dots, 5).unwrap(),
        Tile::new_number(Suit::Dots, 5).unwrap(),
        Tile { suit: Suit::Jokers, rank: Rank::Joker },
        Tile::new_number(Suit::Dots, 7).unwrap(),
        Tile::new_number(Suit::Dots, 7).unwrap(),
        Tile::new_number(Suit::Dots, 7).unwrap(),
    ],
    exposed: vec![],
    joker_assignments: None,
};
```

**Pattern (from 2025 card):**

```json
{
  "description": "11 333 5555 777 99 (Any 1 or 3 Suits)",
  "vsuit_count": 1,
  "components": [
    { "suit": "VSUIT1", "number": 1, "count": 2 },
    { "suit": "VSUIT1", "number": 3, "count": 3 },
    { "suit": "VSUIT1", "number": 5, "count": 4 },
    { "suit": "VSUIT1", "number": 7, "count": 3 },
    { "suit": "VSUIT1", "number": 9, "count": 2 }
  ]
}
```

**Validation Process:**

1. **Normalize:**

   ```rust
   NormalizedHand {
       tile_counts: {
           1D: 2,
           3D: 3,
           5D: 4,
           7D: 3,
       },
       joker_count: 2,
       total_tiles: 14,
   }
   ```

1. **Generate Joker Permutations:**
   - Pattern requires: `1D×2, 3D×3, 5D×4, 7D×3, 9D×2`
   - Hand has: `1D×2, 3D×3, 5D×4, 7D×3` (missing `9D×2`)
   - Joker assignment: Both Jokers → `9D`

1. **Match:**
   - Required: `{1D:2, 3D:3, 5D:4, 7D:3, 9D:2}`
   - Actual (with Jokers): `{1D:2, 3D:3, 5D:4, 7D:3, 9D:2}`
   - **Match! ✓**

1. **Result:**

```rust
ValidationResult::Valid {
    pattern: "11 333 5555 777 99 (Any 1 or 3 Suits)",
    joker_assignments: {
        2: Tile::new_number(Suit::Dots, 9).unwrap(),  // 3rd tile (index 2) is Joker
        10: Tile::new_number(Suit::Dots, 9).unwrap(), // 11th tile (index 10) is Joker
    },
    points: 25,
}
```

---

## 8.12 Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_hand() {
        let hand = Hand::new(vec![
            Tile::new_number(Suit::Dots, 1).unwrap(),
            Tile::new_number(Suit::Dots, 1).unwrap(),
            Tile { suit: Suit::Jokers, rank: Rank::Joker },
        ]);

        let normalized = normalize_hand(&hand).unwrap();
        assert_eq!(normalized.joker_count, 1);
        assert_eq!(normalized.tile_counts.get(&Tile::new_number(Suit::Dots, 1).unwrap()), Some(&2));
    }

    #[test]
    fn test_vsuit_mappings() {
        let mappings = generate_vsuit_mappings(3);
        assert_eq!(mappings.len(), 6); // 3! permutations
    }

    #[test]
    fn test_validation_simple_pattern() {
        let card = load_card(2025);
        let hand = Hand::new(/* ... */);
        let result = validate_hand(&hand, &card, true);
        assert!(matches!(result, ValidationResult::Valid { .. }));
    }
}
```

### Integration Tests

```rust
#[test]
fn test_all_2025_patterns() {
    let card = load_card(2025);

    // For each pattern, construct a perfect hand and verify it validates
    for pattern in card.all_patterns() {
        let perfect_hand = construct_perfect_hand(pattern);
        let result = validate_hand(&perfect_hand, &card, true);
        assert!(matches!(result, ValidationResult::Valid { .. }),
            "Pattern {} should validate", pattern.description);
    }
}

#[test]
fn test_joker_heavy_hands() {
    // Test hands with maximum Jokers (8)
    let hand = Hand::new(vec![
        /* 6 real tiles + 8 Jokers */
    ]);

    let card = load_card(2025);
    let result = validate_hand(&hand, &card, true);
    // Should either match a flexible pattern or fail gracefully
}
```

---

## 8.13 Design Principles

1. **Correctness over Speed**: Validation must be 100% accurate (no false positives/negatives)
2. **Pattern-Guided Permutations**: Don't brute-force Joker assignments
3. **Early Termination**: Stop as soon as a match is found
4. **Incremental Validation**: Check impossible patterns first (tile count pruning)
5. **Clear Error Messages**: Help players understand why their hand is invalid
6. **Testability**: Every pattern should have a unit test

---

## 8.14 Future Enhancements

1. **Parallel Validation**: Check multiple patterns concurrently using `rayon`
2. **Hint System**: "You're 1 tile away from pattern X"
3. **Partial Match Scoring**: "This hand is 85% complete for pattern Y"
4. **Pattern Difficulty Rating**: Rank patterns by how hard they are to achieve
5. **Historical Analytics**: Track which patterns win most often
