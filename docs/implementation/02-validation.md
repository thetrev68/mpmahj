# 02. Validation Engine Implementation Spec

This document specifies how to validate an American Mahjong hand against NMJL card patterns.

---

## 1. Inputs and Outputs

Inputs:

- `hand: Hand`
- `card: CardDefinition`
- `concealed_only: bool` (true if hand must be fully concealed)

Outputs:

- `ValidationResult::Valid { pattern, joker_assignments }`
- `ValidationResult::Invalid { reason, closest_pattern, tiles_short }`

Note: Points calculation is out of MVP scope. Validation only confirms win validity.

---

## 2. Normalization

Normalize a `Hand` into tile counts:

- Count all non-joker tiles from `concealed` and `exposed` melds.
- Count Joker tiles separately (`joker_count`).
- Ensure total tiles == 14.

Data structure:

- `NormalizedHand { tile_counts, joker_count, total_tiles, is_concealed }`

---

## 3. Pattern Iteration Order

Validation tries patterns in deterministic order:

1. Card sections in listed order
2. Hands in listed order within each section

This preserves the card’s natural ordering for deterministic results.

Optional optimization:

- Maintain a `popularity_rank` list to prefer common patterns.

---

## 4. VSUIT Resolution

Generate all suit mappings based on `vsuit_count`:

- 1: VSUIT1/2/3 map to same suit
- 2: VSUIT1 != VSUIT2, VSUIT3 is either
- 3: all three suits distinct (6 permutations)

Implementation type:

- `HashMap<ComponentSuit, Suit>`

---

## 5. Component Resolution

Resolve a `Component` into required tiles.

Rules:

- `ComponentSuit::Dots/Bams/Cracks`: numbered tile
- `ComponentSuit::Wind`: uses `special_numbers::WIND_*`
- `ComponentSuit::Dragon`: uses `special_numbers::DRAGON_*` (White = 0)
- `ComponentSuit::Flower`: flower tile
- `ComponentSuit::VSUIT1/2/3`: numbered tile using vsuit mapping
- `ComponentSuit::VSUIT*_DRAGON`: expands into two branches:
  - branch A: suit = vsuit mapping (numbered tile)
  - branch B: any dragon of required count

VSUIT\*\_DRAGON handling is implemented during matching by trying both branches.

---

## 6. Joker Flexibility Defaults

`Component.flexibility` is optional. If missing:

- count 1 or 2: flexibility = 0
- count >= 3:
  - Flowers: 0
  - Others: flexibility = count

Explicit `flexibility` overrides defaults.

---

## 7. Matching Algorithm (Deterministic)

High-level loop:

1. Normalize hand
2. For each pattern:
   - Skip if `pattern.concealed` and hand is exposed
3. For each VSUIT mapping:
   - Build required tile counts
   - Apply VSUIT\*\_DRAGON branching if present
4. Validate counts using joker assignments

Pseudo-flow:

- `required_tiles` from pattern + mapping
- `missing_tiles` = tiles deficit vs hand
- If `missing_tiles.len() > joker_count`, reject
- If any component violates flexibility rules, reject
- If fillable and total tiles match, accept

Matching must consider:

- Joker restrictions for pairs (pairs not allowed to be Jokers unless explicitly flexible)
- Fixed tiles where `fixed_count = count - flexibility` must exist in hand

---

## 8. Joker Assignment Strategy

The goal is not to enumerate all tile identities, only viable ones:

- For each pattern + vsuit mapping:
  - Determine deficits per component
  - If deficit <= flexibility and total deficits == joker_count, produce a single assignment vector

If multiple assignments are valid, return the first encountered (deterministic).

---

## 9. Valid/Invalid Result Formatting

Valid result includes:

- `pattern` (full `HandPattern`)
- `joker_assignments: HashMap<usize, Tile>` indexed to Joker positions in the concealed hand

Note: MVP does not calculate points. Future implementation will add scoring.

Invalid result includes:

- `reason: String` (clear failure)
- `closest_pattern: Option<String>` (optional; see Hint system)
- `tiles_short: Option<Vec<Tile>>` (optional)

---

## 10. Minimum Tests

- Exact match with zero Jokers
- Multiple Jokers with valid flexibility
- Joker in pair -> reject
- VSUIT2 different suit enforcement
- VSUIT\*\_DRAGON branching
- Concealed-only pattern with exposed hand -> reject
- White dragon (0) in year patterns

---

## 11. Performance Requirements

- Validate in < 5 ms on desktop for typical hands.
- Avoid brute-force Joker identity enumeration.
- Use early exits for impossible patterns.
