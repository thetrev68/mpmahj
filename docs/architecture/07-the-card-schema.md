# 7. The Card Schema


The National Mah Jongg League publishes a new card annually with 50+ winning hand patterns. This section defines how to represent these patterns as data that the validation engine can use.

**Note**: This design is based on a proven format used in a previous implementation of American Mahjong, adapted for Rust. The original JavaScript format has been validated with 5 years of real NMJL card data.

### 7.1 Design Goals

1. **Data-Driven**: The card is loaded from JSON/TOML, not hardcoded
2. **Flexible**: Support any pattern the NMJL might design (past, present, future)
3. **Expressive**: Capture complex constraints using variable suits (VSUIT1, VSUIT2, VSUIT3)
4. **Efficient**: Enable fast validation through simple component matching
5. **Human-Readable**: Proven format that non-programmers can edit
6. **Proven**: Based on working implementation with real card data

---

### 7.2 Core Structures

The schema uses a simple component-based approach. Each hand pattern is a list of components, where each component specifies a suit, number, and count.

```rust
/// The complete card for a given year
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardDefinition {
    /// Year this card is valid for
    pub year: u16,

    /// All sections on the card (groups related patterns)
    pub sections: Vec<HandGroup>,
}

/// A group of related hand patterns (e.g., "2025", "Like Numbers", "Winds-Dragons")
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandGroup {
    /// Group name as it appears on the card
    pub group_description: String,

    /// All patterns in this group
    pub hands: Vec<HandPattern>,
}

/// A single winning hand pattern
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandPattern {
    /// Full description from the card (e.g., "222 0000 222 5555 (Any 2 Suits)")
    pub description: String,

    /// How many different "variable" suits are involved (1-3)
    /// This is the key innovation: VSUIT1, VSUIT2, VSUIT3 are placeholders
    /// that get resolved during validation
    pub vsuit_count: u8,

    /// Must this hand be concealed, or can it be exposed?
    pub concealed: bool,

    /// Constraint: All numbers must be odd
    pub odd: bool,

    /// Constraint: All numbers must be even
    pub even: bool,

    /// The components that make up this hand (must total 14 tiles)
    pub components: Vec<Component>,

    /// Optional: Point value for scoring (if not specified, use default)
    #[serde(default = "default_points")]
    pub points: u32,
}

fn default_points() -> u32 { 25 }

/// A component is a group of identical tiles (or a single tile)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Component {
    /// What suit this component uses
    pub suit: ComponentSuit,

    /// What number/rank (0-9, or special values for winds/dragons)
    pub number: u8,

    /// How many of this tile (1-5)
    /// 1 = single tile, 2 = pair, 3 = pung, 4 = kong, 5 = quint
    pub count: u8,
}

/// Suit specification for a component
/// This is the key to the pattern system's flexibility
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ComponentSuit {
    // ===== CONCRETE SUITS =====
    /// Dots suit (numbered 1-9)
    Dots,

    /// Bams suit (numbered 1-9)
    Bams,

    /// Cracks suit (numbered 1-9)
    Cracks,

    /// Flowers (all identical)
    Flower,

    /// Dragons (Red, Green, White/Soap)
    Dragon,

    /// Winds (N, E, S, W)
    Wind,

    // ===== VARIABLE SUITS (The Innovation!) =====
    /// First variable suit - resolves to Dots, Bams, or Cracks during validation
    /// Example: Pattern "1111 2222 3333 44" uses VSUIT1 for all components
    ///          Valid: All Dots, All Bams, or All Cracks
    VSUIT1,

    /// Second variable suit - must be different from VSUIT1
    /// Example: Pattern with VSUIT1 and VSUIT2 requires 2 different suits
    VSUIT2,

    /// Third variable suit - must be different from VSUIT1 and VSUIT2
    VSUIT3,

    // ===== FLEXIBLE SUITS (Suit OR Dragon) =====
    /// VSUIT1 OR any dragon
    /// Example: Used in "FF 111 111 111 DDD (Any 3 Suits, Any Dragon)"
    ///          The DDD can be Red, Green, or White dragons
    VSUIT1_DRAGON,

    VSUIT2_DRAGON,
    VSUIT3_DRAGON,
}

/// Special number constants for dragons and winds
pub mod special_numbers {
    // Dragons (used with ComponentSuit::Dragon)
    pub const DRAGON_RED: u8 = 1;
    pub const DRAGON_GREEN: u8 = 2;
    pub const DRAGON_WHITE: u8 = 3;  // Also represents "0" in year patterns

    // Winds (used with ComponentSuit::Wind)
    pub const WIND_NORTH: u8 = 1;
    pub const WIND_EAST: u8 = 2;
    pub const WIND_SOUTH: u8 = 3;
    pub const WIND_WEST: u8 = 4;

    // Variable numbers (for "any consecutive number" patterns)
    pub const VNUMBER_CONSECUTIVE1: u8 = 100;  // First number in a consecutive sequence
    pub const VNUMBER_CONSECUTIVE2: u8 = 101;  // Second number (CONSECUTIVE1 + 1)
    pub const VNUMBER_CONSECUTIVE3: u8 = 102;  // Third number (CONSECUTIVE1 + 2)
    pub const VNUMBER_CONSECUTIVE4: u8 = 103;  // Fourth number (CONSECUTIVE1 + 3)
}
```

---

### 7.3 How Variable Suits Work (The Key Innovation)

Variable suits (`VSUIT1`, `VSUIT2`, `VSUIT3`) are placeholders that get resolved during validation. This is the elegant solution to representing patterns like "All same suit" or "Any 2 different suits".

**Example 1: Single Variable Suit**

Pattern: `"1111 2222 3333 44 (Any 1 Suit)"`
- All components use `VSUIT1`
- `vsuit_count: 1`
- During validation, `VSUIT1` can resolve to Dots, Bams, OR Cracks
- Valid hands: All Dots, All Bams, or All Cracks (but NOT mixed)

**Example 2: Two Variable Suits**

Pattern: `"222 0000 222 5555 (Any 2 Suits)"`
- Components with 2s use `VSUIT1`
- Components with 5s use `VSUIT2`
- `vsuit_count: 2`
- During validation, `VSUIT1` and `VSUIT2` must resolve to DIFFERENT suits
- Valid: 2-Dots + 5-Bams, 2-Bams + 5-Cracks, etc.
- Invalid: 2-Dots + 5-Dots (both same suit)

**Example 3: Three Variable Suits**

Pattern: `"FFFF 2025 222 222 (Any 3 Suits, Like Pungs 2s or 5s In Opp. Suits)"`
- Flowers are concrete
- The "2" and "5" in "2025" use `VSUIT1`
- The first pung of 2s uses `VSUIT2`
- The second pung of 2s uses `VSUIT3`
- `vsuit_count: 3`
- During validation, all three must be different suits

**Key Benefits:**
1. **Simple representation**: No complex relational references
2. **Clear constraints**: `vsuit_count` explicitly states how many different suits
3. **Easy validation**: Try all combinations of 1-3 suits from {Dots, Bams, Cracks}
4. **Proven**: Works with 5 years of real NMJL card data

---

### 7.4 Real Card Pattern Examples (From Actual Data)

These examples are taken directly from the 2025 card data in the `/2025` folder.

**Example 1: Year Pattern "222 0000 222 5555" (From hands2025.js)**

```rust
HandPattern {
    description: "222 0000 222 5555 (Any 2 Suits)".to_string(),
    vsuit_count: 2,
    concealed: false,
    odd: false,
    even: false,
    points: 25,
    components: vec![
        Component { suit: ComponentSuit::VSUIT1, number: 2, count: 3 },  // Pung of 2s
        Component { suit: ComponentSuit::Dragon, number: 0 /* WHITE */, count: 4 },  // Kong of White Dragons (0)
        Component { suit: ComponentSuit::VSUIT2, number: 2, count: 3 },  // Pung of 2s (different suit)
        Component { suit: ComponentSuit::VSUIT2, number: 5, count: 4 },  // Kong of 5s (same suit as prev)
    ],
}
// Valid hands: 2-Dots + (0-Dragons + 2-Bams + 5-Bams), or any 2 different suits
```

**Example 2: "11 222 3333 444 55" Consecutive Run (From handsConsecutive.js)**

```rust
HandPattern {
    description: "11 222 3333 444 55 (Any 1 Suit, These Nos Only)".to_string(),
    vsuit_count: 1,
    concealed: false,
    odd: false,
    even: false,
    points: 25,
    components: vec![
        Component { suit: ComponentSuit::VSUIT1, number: 1, count: 2 },
        Component { suit: ComponentSuit::VSUIT1, number: 2, count: 3 },
        Component { suit: ComponentSuit::VSUIT1, number: 3, count: 4 },
        Component { suit: ComponentSuit::VSUIT1, number: 4, count: 3 },
        Component { suit: ComponentSuit::VSUIT1, number: 5, count: 2 },
    ],
}
// All components use VSUIT1, so entire hand must be one suit (all Dots, all Bams, or all Cracks)
```

**Example 3: "FF 111 111 111 DDD" Like Numbers with Dragon (From handsLikeNumbers.js)**

```rust
use special_numbers::*;

HandPattern {
    description: "FF 111 111 111 DDD (Any 3 Suits. Any Dragon)".to_string(),
    vsuit_count: 3,
    concealed: true,
    odd: false,
    even: false,
    points: 25,
    components: vec![
        Component { suit: ComponentSuit::Flower, number: 0, count: 2 },
        Component { suit: ComponentSuit::VSUIT1, number: VNUMBER_CONSECUTIVE1, count: 3 },
        Component { suit: ComponentSuit::VSUIT2, number: VNUMBER_CONSECUTIVE1, count: 3 },
        Component { suit: ComponentSuit::VSUIT3, number: VNUMBER_CONSECUTIVE1, count: 3 },
        Component { suit: ComponentSuit::VSUIT1_DRAGON, number: 0, count: 3 },  // Any dragon
    ],
}
// VNUMBER_CONSECUTIVE1 means "any number, but all must be the same"
// VSUIT1_DRAGON means "same suit as VSUIT1, OR any dragon"
```

**Example 4: "FFFF 2025 222 222" (From hands2025.js - 3 suits required)**

```rust
HandPattern {
    description: "FFFF 2025 222 222 (Any 3 Suits, Like Pungs 2s or 5s In Opp. Suits)".to_string(),
    vsuit_count: 3,
    concealed: false,
    odd: false,
    even: false,
    points: 25,
    components: vec![
        Component { suit: ComponentSuit::Flower, number: 0, count: 4 },
        Component { suit: ComponentSuit::VSUIT1, number: 2, count: 1 },  // Single 2
        Component { suit: ComponentSuit::Dragon, number: 0 /* WHITE */, count: 1 },  // Single White Dragon
        Component { suit: ComponentSuit::VSUIT1, number: 2, count: 1 },  // Single 2 (same suit)
        Component { suit: ComponentSuit::VSUIT1, number: 5, count: 1 },  // Single 5 (same suit)
        Component { suit: ComponentSuit::VSUIT2, number: 2, count: 3 },  // Pung of 2s (different suit)
        Component { suit: ComponentSuit::VSUIT3, number: 2, count: 3 },  // Pung of 2s (yet another suit)
    ],
}
// This requires 3 different numbered suits due to vsuit_count: 3
```

**Example 5: Consecutive Run with Variable Numbers (From handsConsecutive.js)**

```rust
use special_numbers::*;

HandPattern {
    description: "111 2222 333 4444 (Any 1 or 2 Suits, Any 4 Consec Nos)".to_string(),
    vsuit_count: 1,
    concealed: false,
    odd: false,
    even: false,
    points: 25,
    components: vec![
        Component { suit: ComponentSuit::VSUIT1, number: VNUMBER_CONSECUTIVE1, count: 3 },
        Component { suit: ComponentSuit::VSUIT1, number: VNUMBER_CONSECUTIVE2, count: 4 },
        Component { suit: ComponentSuit::VSUIT1, number: VNUMBER_CONSECUTIVE3, count: 3 },
        Component { suit: ComponentSuit::VSUIT1, number: VNUMBER_CONSECUTIVE4, count: 4 },
    ],
}
// CONSECUTIVE1/2/3/4 resolve to any 4 consecutive numbers (e.g., 2-3-4-5, or 5-6-7-8)
```

---

### 7.5 JSON Representation

For data files, patterns are stored as JSON. Here's a complete example matching the simpler format:

```json
{
  "year": 2025,
  "sections": [
    {
      "group_description": "2025",
      "hands": [
        {
          "description": "222 0000 222 5555 (Any 2 Suits)",
          "vsuit_count": 2,
          "concealed": false,
          "odd": false,
          "even": false,
          "points": 25,
          "components": [
            { "suit": "VSUIT1", "number": 2, "count": 3 },
            { "suit": "Dragon", "number": 0, "count": 4 },
            { "suit": "VSUIT2", "number": 2, "count": 3 },
            { "suit": "VSUIT2", "number": 5, "count": 4 }
          ]
        },
        {
          "description": "FFFF 2025 222 222 (Any 3 Suits)",
          "vsuit_count": 3,
          "concealed": false,
          "odd": false,
          "even": false,
          "points": 25,
          "components": [
            { "suit": "Flower", "number": 0, "count": 4 },
            { "suit": "VSUIT1", "number": 2, "count": 1 },
            { "suit": "Dragon", "number": 0, "count": 1 },
            { "suit": "VSUIT1", "number": 2, "count": 1 },
            { "suit": "VSUIT1", "number": 5, "count": 1 },
            { "suit": "VSUIT2", "number": 2, "count": 3 },
            { "suit": "VSUIT3", "number": 2, "count": 3 }
          ]
        }
      ]
    },
    {
      "group_description": "Consecutive",
      "hands": [
        {
          "description": "11 222 3333 444 55 (Any 1 Suit, These Nos Only)",
          "vsuit_count": 1,
          "concealed": false,
          "odd": false,
          "even": false,
          "points": 25,
          "components": [
            { "suit": "VSUIT1", "number": 1, "count": 2 },
            { "suit": "VSUIT1", "number": 2, "count": 3 },
            { "suit": "VSUIT1", "number": 3, "count": 4 },
            { "suit": "VSUIT1", "number": 4, "count": 3 },
            { "suit": "VSUIT1", "number": 5, "count": 2 }
          ]
        }
      ]
    }
  ]
}
```

**Converting from your existing JavaScript files:**

Your existing `.js` files can be converted to JSON with minimal changes:
1. Remove the `import` statements
2. Remove the `export const handsFoo =` wrapper
3. Convert JavaScript object literals to valid JSON (add quotes around keys)
4. Save as `.json` instead of `.js`

---

### 7.6 Loading and Parsing

```rust
impl CardDefinition {
    /// Load a card from a JSON file
    pub fn from_json(path: &str) -> Result<Self, CardError> {
        let contents = std::fs::read_to_string(path)
            .map_err(|e| CardError::IoError(e.to_string()))?;

        let card: CardDefinition = serde_json::from_str(&contents)
            .map_err(|e| CardError::ParseError(e.to_string()))?;

        // Validate the card
        card.validate()?;

        Ok(card)
    }

    /// Validate that the card is well-formed
    pub fn validate(&self) -> Result<(), CardError> {
        for section in &self.sections {
            for hand in &section.hands {
                // Check all patterns have exactly 14 tiles
                let total_tiles: u8 = hand.components.iter()
                    .map(|c| c.count)
                    .sum();

                if total_tiles != 14 {
                    return Err(CardError::InvalidPattern {
                        description: hand.description.clone(),
                        reason: format!("Pattern has {} tiles, expected 14", total_tiles),
                    });
                }

                // Validate vsuit_count is reasonable (1-3)
                if hand.vsuit_count < 1 || hand.vsuit_count > 3 {
                    return Err(CardError::InvalidPattern {
                        description: hand.description.clone(),
                        reason: format!("Invalid vsuit_count: {}", hand.vsuit_count),
                    });
                }

                // Validate component counts (1-5 for pairs/pungs/kongs/quints)
                for component in &hand.components {
                    if component.count < 1 || component.count > 5 {
                        return Err(CardError::InvalidPattern {
                            description: hand.description.clone(),
                            reason: format!("Invalid component count: {}", component.count),
                        });
                    }
                }
            }
        }

        Ok(())
    }

    /// Get all patterns (flattened)
    pub fn all_patterns(&self) -> Vec<&HandPattern> {
        self.sections.iter()
            .flat_map(|group| group.hands.iter())
            .collect()
    }

    /// Find patterns by description substring
    pub fn search_patterns(&self, query: &str) -> Vec<&HandPattern> {
        self.all_patterns().into_iter()
            .filter(|p| p.description.to_lowercase().contains(&query.to_lowercase()))
            .collect()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CardError {
    IoError(String),
    ParseError(String),
    InvalidPattern { description: String, reason: String },
}
```

---

### 7.7 Design Decisions

**Why this format is better:**

1. **Proven**: Used successfully in a working implementation with 5 years of real NMJL card data
2. **Simple**: Each pattern is just a description + array of components
3. **Variable Suits**: The `VSUIT1/2/3` innovation elegantly handles "same suit" constraints without complex relational logic
4. **Easy to Edit**: The JSON format is readable and editable by non-programmers
5. **Compact**: Patterns are concise - compare to the verbose `GroupPattern` / `TilePattern` approach originally designed

**Joker Handling:**

- Jokers are NOT part of the pattern schema
- The validation engine (Section 8) will handle "trying all Joker permutations"
- Patterns define what tiles are NEEDED, not what tiles (including Jokers) are ALLOWED

**Performance:**

- Patterns are loaded once at startup, then cached in memory
- No runtime parsing of pattern strings (everything is pre-validated)
- Variable suit resolution tries at most 3×2×1 = 6 combinations (for 3-suit patterns)

**Extensibility:**

- New `ComponentSuit` variants can be added (e.g., `VSUIT4` for hypothetical 4-suit patterns)
- New special number constants can be added (e.g., for new consecutive patterns)
- The schema is future-proof for NMJL card innovations

---

### 7.8 Future Enhancements

**Not in MVP, but planned:**

1. **Pattern Verification Tool**: CLI tool to validate hand patterns are possible with 152 tiles
2. **Card Editor UI**: Web interface for creating/editing cards
3. **Pattern Search**: "Show me all patterns I'm 1 tile away from"
4. **Historical Cards**: Database of past years' cards for practice/nostalgia
5. **Custom Cards**: Players can create house-rule cards

**Next Section**: Section 8 (Validation Engine) will use these patterns to check if a hand is a winner

---
