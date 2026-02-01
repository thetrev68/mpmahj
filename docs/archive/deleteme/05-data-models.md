# 5. Data Models

This section defines the core Rust data structures that represent the game state. These are all part of `mahjong_core` and are pure logic with no network or UI concerns.

**Architecture Note**: This project uses a **histogram-first** design where tiles are represented as u8 indices (0-36) for O(1) validation performance. This was chosen after performance analysis showed the need for sub-millisecond pattern validation.

---

## 5.1 Tile

The fundamental unit of the game.

```rust
/// A high-performance Tile primitive represented as a single byte (0-36).
///
/// Mapping:
/// - 0-8:   Bams (1-9)
/// - 9-17:  Cracks (1-9)
/// - 18-26: Dots (1-9)
/// - 27-30: Winds (East, South, West, North)
/// - 31-33: Dragons (Green, Red, White/Soap)
/// - 34:    Flower
/// - 35:    Joker
/// - 36:    Blank (House Rule)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, TS)]
pub struct Tile(pub u8);

// Index constants
pub const TILE_COUNT: usize = 37;
pub const BAM_START: u8 = 0;
pub const CRAK_START: u8 = 9;
pub const DOT_START: u8 = 18;
pub const WIND_START: u8 = 27;
pub const DRAGON_START: u8 = 31;
pub const FLOWER_INDEX: u8 = 34;
pub const JOKER_INDEX: u8 = 35;
pub const BLANK_INDEX: u8 = 36;
```text

**Design Decisions**:

- **u8 index representation**: Enables O(1) histogram-based validation
- **Small and Copy**: Single byte, passed by value
- **Hash + Ord**: Allows usage in HashMap/BTreeMap for counting and sorting
- **White Dragon** (`Soap`): Represents zero in year hands (e.g., 2020)
- **All Flowers identical**: No seasonal distinctions (unlike Chinese Mahjong)

**Helper Methods**:

```rust
impl Tile {
    pub fn new(id: u8) -> Self {
        assert!(id < TILE_COUNT as u8, "Invalid tile ID: {}", id);
        Self(id)
    }

    // --- Type Checks (O(1) range checks) ---

    pub fn is_suited(&self) -> bool {
        self.0 <= 26 // Bams, Cracks, Dots
    }

    pub fn is_bam(&self) -> bool {
        self.0 < CRAK_START
    }

    pub fn is_crak(&self) -> bool {
        self.0 >= CRAK_START && self.0 < DOT_START
    }

    pub fn is_dot(&self) -> bool {
        self.0 >= DOT_START && self.0 < WIND_START
    }

    pub fn is_wind(&self) -> bool {
        self.0 >= WIND_START && self.0 < DRAGON_START
    }

    pub fn is_dragon(&self) -> bool {
        self.0 >= DRAGON_START && self.0 < FLOWER_INDEX
    }

    pub fn is_flower(&self) -> bool {
        self.0 == FLOWER_INDEX
    }

    pub fn is_joker(&self) -> bool {
        self.0 == JOKER_INDEX
    }

    pub fn is_blank(&self) -> bool {
        self.0 == BLANK_INDEX
    }

    // --- Semantic Getters ---

    /// Returns the rank (1-9) for suited tiles
    pub fn rank(&self) -> Option<u8> {
        if self.is_suited() {
            Some((self.0 % 9) + 1)
        } else {
            None
        }
    }

    /// Returns the suit name for display
    pub fn suit_name(&self) -> &'static str {
        if self.is_bam() { "Bams" }
        else if self.is_crak() { "Cracks" }
        else if self.is_dot() { "Dots" }
        else if self.is_wind() { "Winds" }
        else if self.is_dragon() { "Dragons" }
        else if self.is_flower() { "Flower" }
        else if self.is_joker() { "Joker" }
        else if self.is_blank() { "Blank" }
        else { "Unknown" }
    }

    /// Display name for UI (e.g., "3 Dots", "Red Dragon", "Joker")
    pub fn display_name(&self) -> String {
        // Implementation returns formatted string based on index
    }
}
```text

**Helper Constants** (for convenience in code):

```rust
// Bams: Tile(0) through Tile(8)
pub const BAM_1: Tile = Tile(0);
pub const BAM_9: Tile = Tile(8);

// Cracks: Tile(9) through Tile(17)
pub const CRAK_1: Tile = Tile(9);
pub const CRAK_9: Tile = Tile(17);

// Dots: Tile(18) through Tile(26)
pub const DOT_1: Tile = Tile(18);
pub const DOT_9: Tile = Tile(26);

// Winds
pub const EAST: Tile = Tile(27);
pub const SOUTH: Tile = Tile(28);
pub const WEST: Tile = Tile(29);
pub const NORTH: Tile = Tile(30);

// Dragons
pub const GREEN_DRAGON: Tile = Tile(31);
pub const RED_DRAGON: Tile = Tile(32);
pub const WHITE_DRAGON: Tile = Tile(33); // "Soap"

// Special
pub const FLOWER: Tile = Tile(34);
pub const JOKER: Tile = Tile(35);
pub const BLANK: Tile = Tile(36);
```text

---

## 5.2 Deck / Wall

Manages the 152-tile pool and dealing logic.

```rust
/// The complete set of 152 tiles
pub struct Deck {
    tiles: Vec<Tile>,
}

impl Deck {
    /// Create a standard American Mahjong deck
    pub fn new() -> Self {
        let mut tiles = Vec::with_capacity(152);

        // Add 4 of each suited tile (Bams 1-9, Cracks 1-9, Dots 1-9)
        for base in [BAM_START, CRAK_START, DOT_START] {
            for offset in 0..9 {
                for _ in 0..4 {
                    tiles.push(Tile(base + offset));
                }
            }
        }

        // Add 4 of each Wind
        for wind_idx in WIND_START..DRAGON_START {
            for _ in 0..4 {
                tiles.push(Tile(wind_idx));
            }
        }

        // Add 4 of each Dragon
        for dragon_idx in DRAGON_START..FLOWER_INDEX {
            for _ in 0..4 {
                tiles.push(Tile(dragon_idx));
            }
        }

        // Add 8 Flowers
        for _ in 0..8 {
            tiles.push(FLOWER);
        }

        // Add 8 Jokers
        for _ in 0..8 {
            tiles.push(JOKER);
        }

        assert_eq!(tiles.len(), 152, "Deck must have exactly 152 tiles");

        Deck { tiles }
    }

    /// Shuffle the deck using a cryptographically secure RNG
    pub fn shuffle(&mut self, seed: Option<u64>) {
        // Uses ChaCha20Rng for deterministic replay if seed provided
        // Falls back to thread_rng() for normal play
    }
}
```text

**Wall** represents the drawable pile during the game:

```rust
pub struct Wall {
    tiles: Vec<Tile>,
    dead_wall_size: usize, // Tiles reserved by dice roll
}

impl Wall {
    /// Create a wall from a shuffled deck
    pub fn from_deck(deck: Deck, break_point: usize) -> Self {
        Wall {
            tiles: deck.tiles,
            dead_wall_size: break_point * 2,
        }
    }

    /// Draw a tile from the wall
    pub fn draw(&mut self) -> Option<Tile> {
        if self.tiles.len() <= self.dead_wall_size {
            return None; // Wall exhausted
        }
        self.tiles.pop()
    }

    /// Remaining tiles available for draw (visible to all players)
    pub fn remaining(&self) -> usize {
        self.tiles.len().saturating_sub(self.dead_wall_size)
    }
}
```text

---

## 5.3 Hand

Represents a player's tiles using **both ordered list and histogram** for optimal performance.

```rust
/// A player's hand, consisting of concealed and exposed tiles.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
pub struct Hand {
    /// Tiles only the player can see (ordered list for display)
    pub concealed: Vec<Tile>,

    /// O(1) Lookup table: Count of each tile type in the concealed hand
    /// Always length TILE_COUNT (37)
    pub counts: Vec<u8>,

    /// Melds that have been exposed by calling discards
    pub exposed: Vec<Meld>,

    /// Resolved Joker assignments (populated by validator on win)
    pub joker_assignments: Option<HashMap<usize, Tile>>,
}
```text

**Design Decisions**:

- **Dual representation**: `concealed` Vec for UI ordering, `counts` histogram for validation
- **Automatic sync**: `add_tile`/`remove_tile` update both representations atomically
- **Joker assignments**: Optional because only populated when validation succeeds

**Key Methods**:

```rust
impl Hand {
    pub fn new(tiles: Vec<Tile>) -> Self {
        let mut counts = vec![0u8; TILE_COUNT];
        for t in &tiles {
            counts[t.0 as usize] += 1;
        }

        Hand {
            concealed: tiles,
            counts,
            exposed: Vec::new(),
            joker_assignments: None,
        }
    }

    pub fn add_tile(&mut self, tile: Tile) {
        self.concealed.push(tile);
        self.counts[tile.0 as usize] += 1;
        self.joker_assignments = None; // Invalidate previous assignments
    }

    pub fn remove_tile(&mut self, tile: Tile) -> Result<(), HandError> {
        if let Some(pos) = self.concealed.iter().position(|&t| t == tile) {
            self.concealed.remove(pos);
            self.counts[tile.0 as usize] -= 1;
            self.joker_assignments = None;
            Ok(())
        } else {
            Err(HandError::TileNotFound)
        }
    }

    /// O(1) tile existence check
    pub fn has_tile(&self, tile: Tile) -> bool {
        self.counts[tile.0 as usize] > 0
    }

    /// O(1) tile count check
    pub fn count_tile(&self, tile: Tile) -> usize {
        self.counts[tile.0 as usize] as usize
    }

    /// Calculate "deficiency" (distance to win) for a target pattern
    /// This is the core validation algorithm
    /// Returns 0 if the hand is a winning hand (Mahjong)
    pub fn calculate_deficiency(
        &self,
        target_histogram: &[u8],
        ineligible_histogram: &[u8],
    ) -> i32 {
        // Implements strict joker rules:
        // 1. Singles/Pairs must use natural tiles (no Jokers)
        // 2. Groups (3+) can use Jokers after naturals are allocated
        // Returns total missing tiles (0 = win)
    }

    pub fn total_tiles(&self) -> usize {
        let exposed_count: usize = self.exposed.iter().map(|m| m.tile_count()).sum();
        self.concealed.len() + exposed_count
    }
}
```text

---

## 5.4 Meld

Represents an exposed group of tiles (Pung/Kong/Quint).

```rust
/// An exposed set of tiles
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
pub struct Meld {
    pub meld_type: MeldType,
    pub tiles: Vec<Tile>,
    pub called_tile: Option<Tile>, // The discarded tile that was called

    /// Tracks which tiles are Jokers and what they represent
    pub joker_assignments: HashMap<usize, Tile>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
pub enum MeldType {
    Pung,  // 3 identical tiles
    Kong,  // 4 identical tiles
    Quint, // 5 identical tiles (requires Joker)
}

impl Meld {
    pub fn new(meld_type: MeldType, tiles: Vec<Tile>, called_tile: Option<Tile>)
        -> Result<Self, MeldError>
    {
        // Validates that:
        // - Tile count matches meld type (3/4/5)
        // - All tiles are identical (ignoring Jokers)
        // - At least one real tile present
    }

    pub fn tile_count(&self) -> usize {
        match self.meld_type {
            MeldType::Pung => 3,
            MeldType::Kong => 4,
            MeldType::Quint => 5,
        }
    }

    pub fn can_exchange_joker(&self, replacement: Tile) -> bool {
        // True if meld contains a Joker and replacement matches the base tile
    }

    pub fn exchange_joker(&mut self, replacement: Tile) -> Result<usize, MeldError> {
        // Swaps first Joker with replacement tile
        // Returns index of swapped Joker for UI animation
    }
}
```text

---

## 5.5 Player

Represents one of the four players at the table.

```rust
/// A player at the table
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct Player {
    pub id: String, // Player ID (username or UUID)
    pub seat: Seat,
    pub hand: Hand,
    pub is_bot: bool,
    pub status: PlayerStatus,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
pub enum Seat {
    East,
    South,
    West,
    North,
}

impl Seat {
    /// Get the player to the right (turn order: E → S → W → N → E)
    pub fn right(&self) -> Seat {
        match self {
            Seat::East => Seat::South,
            Seat::South => Seat::West,
            Seat::West => Seat::North,
            Seat::North => Seat::East,
        }
    }

    /// Get the player across (Charleston partner)
    pub fn across(&self) -> Seat {
        match self {
            Seat::East => Seat::West,
            Seat::West => Seat::East,
            Seat::South => Seat::North,
            Seat::North => Seat::South,
        }
    }

    /// Get the player to the left (opposite of turn order)
    pub fn left(&self) -> Seat {
        self.right().right().right()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
pub enum PlayerStatus {
    Active,
    Dead, // Incorrect tile count or invalid declaration
    Waiting,
    Disconnected,
}
```text

---

## 5.6 Table (Game State)

The aggregate state of the entire game. **Note**: The actual implementation is more complex than shown here (see `crates/mahjong_core/src/table/` for the full modular structure).

```rust
/// The complete game state
pub struct Table {
    pub game_id: String,
    pub players: HashMap<Seat, PlayerState>,
    pub wall: Wall,
    pub discard_pile: Vec<DiscardedTile>,
    pub phase: GamePhase,
    pub turn: TurnState,
    pub house_rules: HouseRules,
    pub dealer: Seat,
    pub round_number: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct DiscardedTile {
    pub tile: Tile,
    pub discarded_by: Seat,
    pub turn_number: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct HouseRules {
    pub ruleset: Ruleset,
    pub blank_exchange_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct Ruleset {
    pub card_year: u16, // e.g., 2025
    pub timer_mode: TimerMode,
    pub call_window_seconds: u32,
    pub charleston_timer_seconds: u32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS)]
pub enum TimerMode {
    Visible,  // Timer shown to players
    Hidden,   // No timer displayed (metadata only)
}
```text

**Game Phases**:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub enum GamePhase {
    WaitingForPlayers,
    Setup,           // Rolling dice, dealing
    Charleston(CharlestonState),
    Playing(PlayingState),
    GameOver(GameResult),
}
```text

See [04-state-machine-design.md](04-state-machine-design.md) for detailed phase transitions.

---

## 5.7 Error Types

```rust
#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum HandError {
    #[error("Tile not found in hand")]
    TileNotFound,

    #[error("Invalid tile count: {0}")]
    InvalidTileCount(usize),
}

#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum MeldError {
    #[error("Wrong tile count for meld type")]
    WrongTileCount,

    #[error("Meld contains mismatched tiles")]
    MismatchedTiles,

    #[error("Meld must have at least one real tile")]
    AllJokers,

    #[error("Replacement tile doesn't match meld base")]
    InvalidJokerExchange,

    #[error("No Joker available to exchange")]
    NoJokerToExchange,
}
```text

---

## Key Design Principles

1. **Histogram-First Architecture**: Tiles as u8 indices enable O(1) validation (~260µs for 1,002 patterns)
2. **Dual Representation**: Hand maintains both `Vec<Tile>` (for UI) and `Vec<u8>` histogram (for validation)
3. **Automatic Synchronization**: All mutations (`add_tile`, `remove_tile`) update both representations atomically
4. **Type Safety**: Enums for `Seat`, `MeldType`, `GamePhase` prevent impossible states
5. **Serialization**: All types implement `Serialize`/`Deserialize` for:
   - WebSocket communication
   - Auto-generating TypeScript types via `ts-rs`
   - Database persistence (event sourcing)
6. **Immutability where possible**: Most operations return `Result<T, E>` to avoid invalid states

---

## Performance Characteristics

| Operation                             | Complexity    | Notes                            |
| ------------------------------------- | ------------- | -------------------------------- |
| `Hand::has_tile(tile)`                | O(1)          | Histogram lookup                 |
| `Hand::count_tile(tile)`              | O(1)          | Histogram lookup                 |
| `Hand::calculate_deficiency(pattern)` | O(37)         | Fixed-size histogram comparison  |
| `Hand::add_tile(tile)`                | O(1)          | Vec append + histogram increment |
| `Hand::remove_tile(tile)`             | O(n)          | Vec search + removal             |
| Win validation (all patterns)         | O(1,002 × 37) | ~260µs average                   |

The histogram-first design was chosen after benchmarking showed it met the <5ms validation requirement with a 19× margin.

---

## Related Documents

- [08-validation-engine.md](08-validation-engine.md) - Detailed validation algorithm
- [07-the-card-schema.md](07-the-card-schema.md) - Pattern data format
- [04-state-machine-design.md](04-state-machine-design.md) - Game phase transitions
