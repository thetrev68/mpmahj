# 5. Data Models

This section defines the core Rust data structures that represent the game state. These are all part of `mahjong_core` and are pure logic with no network or UI concerns.

## 5.1 Tile

The fundamental unit of the game.

```rust
/// Represents a single Mahjong tile
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Tile {
    pub suit: Suit,
    pub rank: Rank,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Suit {
    Dots,
    Bams,
    Cracks,
    Winds,
    Dragons,
    Flowers,
    Jokers,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Rank {
    // For numbered suits (Dots, Bams, Cracks)
    Number(u8), // 1-9

    // For Winds
    North,
    East,
    West,
    South,

    // For Dragons
    Red,
    Green,
    White, // "Soap" - also represents Zero

    // For Flowers (all treated identically in American Mahjong)
    Flower,

    // For Jokers (wildcards)
    Joker,

    // For Blank tiles (optional - some sets include blank tiles)
    // Can be exchanged with any discard pile tile (house rule)
    Blank,
}
```

**Design Decisions**:

- `Tile` is `Copy` because it's small and frequently passed around
- `Hash` allows using tiles as HashMap keys (useful for counting)
- White Dragon (`Soap`) represents zero in year hands (e.g., 2020)
- All 8 Flowers are identical (no seasonal distinctions like in Chinese Mahjong)

**Helper Methods**:

```rust
impl Tile {
    /// Create a numbered tile (Dots, Bams, or Cracks)
    pub fn new_number(suit: Suit, num: u8) -> Result<Self, TileError> {
        if num < 1 || num > 9 {
            return Err(TileError::InvalidRank);
        }
        Ok(Tile { suit, rank: Rank::Number(num) })
    }

    /// Check if this tile can be used in a run (1-2-3)
    /// In American Mahjong, runs are NOT callable, but exist on The Card
    pub fn is_sequential(&self) -> bool {
        matches!(self.rank, Rank::Number(_))
    }

    /// Check if tile is an "honor" tile (Winds/Dragons)
    pub fn is_honor(&self) -> bool {
        matches!(self.suit, Suit::Winds | Suit::Dragons)
    }

    /// Display name for UI (e.g., "3 Dots", "Red Dragon", "Joker")
    pub fn display_name(&self) -> String {
        match (&self.suit, &self.rank) {
            (Suit::Dots, Rank::Number(n)) => format!("{} Dots", n),
            (Suit::Bams, Rank::Number(n)) => format!("{} Bams", n),
            (Suit::Cracks, Rank::Number(n)) => format!("{} Cracks", n),
            (Suit::Winds, Rank::North) => "North".to_string(),
            (Suit::Winds, Rank::East) => "East".to_string(),
            (Suit::Winds, Rank::West) => "West".to_string(),
            (Suit::Winds, Rank::South) => "South".to_string(),
            (Suit::Dragons, Rank::Red) => "Red Dragon".to_string(),
            (Suit::Dragons, Rank::Green) => "Green Dragon".to_string(),
            (Suit::Dragons, Rank::White) => "White Dragon".to_string(), // or "Soap"
            (Suit::Flowers, Rank::Flower) => "Flower".to_string(),
            (Suit::Jokers, Rank::Joker) => "Joker".to_string(),
            (_, Rank::Blank) => "Blank".to_string(),
            _ => "Invalid Tile".to_string(),
        }
    }
}
```

---

## 5.2 Deck / Wall

Manages the 152-tile pool and dealing logic.

**Design Note - Wall Structure**:
Physically, American Mahjong uses 4 walls (one per player) of 19×2 tiles each. For MVP, we simplify this to a single `Vec<Tile>` since the game logic doesn't require tracking which physical wall is being drawn from. If we later add wall-building animations, we can extend `Wall` with:

- `current_wall: Seat` - which player's wall is active
- `wall_position: usize` - position within that wall
- Logic to rotate to the next wall (counterclockwise) when exhausted

```rust
/// The complete set of 152 tiles
pub struct Deck {
    tiles: Vec<Tile>,
}

impl Deck {
    /// Create a standard American Mahjong deck
    pub fn new() -> Self {
        let mut tiles = Vec::with_capacity(152);

        // Add 4 of each numbered tile (Dots, Bams, Cracks: 1-9)
        for suit in [Suit::Dots, Suit::Bams, Suit::Cracks] {
            for num in 1..=9 {
                for _ in 0..4 {
                    tiles.push(Tile::new_number(suit, num).unwrap());
                }
            }
        }

        // Add 4 of each Wind
        for wind in [Rank::North, Rank::East, Rank::West, Rank::South] {
            for _ in 0..4 {
                tiles.push(Tile { suit: Suit::Winds, rank: wind });
            }
        }

        // Add 4 of each Dragon
        for dragon in [Rank::Red, Rank::Green, Rank::White] {
            for _ in 0..4 {
                tiles.push(Tile { suit: Suit::Dragons, rank: dragon });
            }
        }

        // Add 8 Flowers
        for _ in 0..8 {
            tiles.push(Tile { suit: Suit::Flowers, rank: Rank::Flower });
        }

        // Add 8 Jokers
        for _ in 0..8 {
            tiles.push(Tile { suit: Suit::Jokers, rank: Rank::Joker });
        }

        assert_eq!(tiles.len(), 152, "Deck must have exactly 152 tiles");

        Deck { tiles }
    }

    /// Shuffle the deck using a CSPRNG (for fairness)
    pub fn shuffle(&mut self) {
        use rand::seq::SliceRandom;
        let mut rng = rand::thread_rng();
        self.tiles.shuffle(&mut rng);
    }
}

/// The "wall" - the active drawable pile during the game
pub struct Wall {
    tiles: Vec<Tile>,
    dead_wall_size: usize, // Tiles reserved by East's dice roll
}

impl Wall {
    /// Create a wall from a shuffled deck
    /// `break_point` is determined by East's dice roll
    pub fn from_deck(mut deck: Deck, break_point: usize) -> Self {
        deck.shuffle();
        Wall {
            tiles: deck.tiles,
            dead_wall_size: break_point * 2, // Each "group" is 2 tiles
        }
    }

    /// Draw a tile from the wall
    pub fn draw(&mut self) -> Option<Tile> {
        if self.tiles.len() <= self.dead_wall_size {
            return None; // Wall exhausted
        }
        self.tiles.pop()
    }

    /// Peek at remaining tile count (visible to players)
    pub fn remaining(&self) -> usize {
        self.tiles.len().saturating_sub(self.dead_wall_size)
    }

    /// Deal initial hands (12 tiles each, then +1 for final round)
    pub fn deal_initial(&mut self, num_players: usize) -> Result<Vec<Vec<Tile>>, DeckError> {
        let tiles_per_player = 13;
        let total_needed = num_players * tiles_per_player;

        if self.remaining() < total_needed {
            return Err(DeckError::NotEnoughTiles);
        }

        let mut hands = vec![Vec::with_capacity(tiles_per_player); num_players];

        // Deal 3 rounds of 4 tiles each (12 tiles per player)
        for _ in 0..3 {
            for hand in hands.iter_mut() {
                for _ in 0..4 {
                    hand.push(self.draw().unwrap());
                }
            }
        }

        // Final round: East gets 1st and 3rd tile, others get 1 tile each
        // East is always player 0
        hands[0].push(self.draw().unwrap()); // East's 1st tile
        hands[1].push(self.draw().unwrap()); // South's tile
        hands[2].push(self.draw().unwrap()); // West's tile (2nd tile overall)
        hands[0].push(self.draw().unwrap()); // East's 3rd tile (14 total)
        hands[3].push(self.draw().unwrap()); // North's tile

        Ok(hands)
    }
}
```

---

## 5.3 Hand

Represents a player's tiles (concealed + exposed).

```rust
/// A player's hand, consisting of concealed and exposed tiles
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hand {
    /// Tiles only the player can see
    pub concealed: Vec<Tile>,

    /// Melds that have been exposed by calling
    pub exposed: Vec<Meld>,

    /// Resolved Joker assignments for concealed tiles (populated by validator)
    /// Maps index in concealed Vec to what that Joker represents
    /// Only populated after successful validation
    pub joker_assignments: Option<HashMap<usize, Tile>>,
}

impl Hand {
    pub fn new(tiles: Vec<Tile>) -> Self {
        Hand {
            concealed: tiles,
            exposed: Vec::new(),
            joker_assignments: None,
        }
    }

    /// Total tile count (should always be 13, or 14 for East at start)
    pub fn total_tiles(&self) -> usize {
        let exposed_count: usize = self.exposed.iter().map(|m| m.tile_count()).sum();
        self.concealed.len() + exposed_count
    }

    /// Add a tile (from draw or Charleston pass)
    pub fn add_tile(&mut self, tile: Tile) {
        self.concealed.push(tile);
        // Clear joker assignments when hand changes
        self.joker_assignments = None;
    }

    /// Remove a tile (for discard or Charleston pass)
    pub fn remove_tile(&mut self, tile: Tile) -> Result<(), HandError> {
        if let Some(pos) = self.concealed.iter().position(|&t| t == tile) {
            self.concealed.remove(pos);
            // Clear joker assignments when hand changes
            self.joker_assignments = None;
            Ok(())
        } else {
            Err(HandError::TileNotFound)
        }
    }

    /// Expose a meld (when calling a discard)
    pub fn expose_meld(&mut self, meld: Meld) -> Result<(), HandError> {
        // Verify player has the tiles (minus the called tile)
        // This is simplified - actual impl needs to handle Jokers
        self.exposed.push(meld);
        // Clear joker assignments when hand changes
        self.joker_assignments = None;
        Ok(())
    }

    /// Get what a specific concealed Joker represents (for UI display)
    pub fn get_joker_identity(&self, joker_index: usize) -> Option<Tile> {
        self.joker_assignments
            .as_ref()
            .and_then(|map| map.get(&joker_index).copied())
    }

    /// Set Joker assignments after validation
    /// Called by the validation engine when a winning hand is found
    pub fn set_joker_assignments(&mut self, assignments: HashMap<usize, Tile>) {
        self.joker_assignments = Some(assignments);
    }

    /// Sort tiles by suit and rank (helper for UI and validation)
    pub fn sort(&mut self) {
        self.concealed.sort_by_key(|tile| {
            // Custom sort order: Dots < Bams < Cracks < Winds < Dragons < Flowers < Jokers
            match tile.suit {
                Suit::Dots => (0, tile.rank),
                Suit::Bams => (1, tile.rank),
                Suit::Cracks => (2, tile.rank),
                Suit::Winds => (3, tile.rank),
                Suit::Dragons => (4, tile.rank),
                Suit::Flowers => (5, tile.rank),
                Suit::Jokers => (6, tile.rank),
            }
        });
    }
}
```

---

## 5.4 Meld

Represents an exposed group of tiles (Pung/Kong/Quint).

```rust
/// An exposed set of tiles
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Meld {
    pub meld_type: MeldType,
    pub tiles: Vec<Tile>,
    pub called_tile: Option<Tile>, // The tile that was called from discard (if any)

    /// Tracks which tiles in this meld are Jokers and what they represent
    /// Maps index in tiles Vec to the actual tile the Joker represents
    /// Example: If tiles[1] is a Joker representing 4-Bam, map contains (1, 4-Bam)
    pub joker_assignments: HashMap<usize, Tile>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MeldType {
    Pung,  // 3 identical tiles
    Kong,  // 4 identical tiles
    Quint, // 5 identical tiles (requires Joker)
}

impl Meld {
    /// Create a new meld with automatic Joker assignment detection
    pub fn new(meld_type: MeldType, tiles: Vec<Tile>, called_tile: Option<Tile>) -> Result<Self, MeldError> {
        let mut joker_assignments = HashMap::new();

        // Find the base tile (first non-Joker)
        let base_tile = tiles.iter()
            .find(|t| t.suit != Suit::Jokers)
            .ok_or(MeldError::AllJokers)?;

        // Assign all Jokers to represent the base tile
        for (idx, tile) in tiles.iter().enumerate() {
            if tile.suit == Suit::Jokers {
                joker_assignments.insert(idx, *base_tile);
            }
        }

        let meld = Meld {
            meld_type,
            tiles,
            called_tile,
            joker_assignments,
        };

        meld.validate()?;
        Ok(meld)
    }

    pub fn tile_count(&self) -> usize {
        match self.meld_type {
            MeldType::Pung => 3,
            MeldType::Kong => 4,
            MeldType::Quint => 5,
        }
    }

    /// Validate that a meld is legal
    pub fn validate(&self) -> Result<(), MeldError> {
        if self.tiles.len() != self.tile_count() {
            return Err(MeldError::WrongTileCount);
        }

        // All tiles must be the same (ignoring Jokers)
        let base_tile = self.tiles.iter()
            .find(|t| t.suit != Suit::Jokers)
            .ok_or(MeldError::AllJokers)?;

        for tile in &self.tiles {
            if tile.suit != Suit::Jokers && tile != base_tile {
                return Err(MeldError::MismatchedTiles);
            }
        }

        Ok(())
    }

    /// Check if a Joker can be exchanged for a real tile
    pub fn can_exchange_joker(&self, replacement: Tile) -> bool {
        // Must have at least one Joker
        let has_joker = self.tiles.iter().any(|t| t.suit == Suit::Jokers);
        if !has_joker {
            return false;
        }

        // Replacement must match the meld's base tile
        let base_tile = self.tiles.iter()
            .find(|t| t.suit != Suit::Jokers)
            .unwrap();

        replacement == *base_tile
    }

    /// Exchange a Joker in this meld for a real tile
    /// Returns the index of the swapped Joker for UI updates
    pub fn exchange_joker(&mut self, replacement: Tile) -> Result<usize, MeldError> {
        if !self.can_exchange_joker(replacement) {
            return Err(MeldError::InvalidJokerExchange);
        }

        // Find first Joker in the meld
        let joker_idx = self.tiles.iter()
            .position(|t| t.suit == Suit::Jokers)
            .ok_or(MeldError::NoJokerToExchange)?;

        // Replace the Joker with the real tile
        self.tiles[joker_idx] = replacement;

        // Remove from joker_assignments since it's no longer a Joker
        self.joker_assignments.remove(&joker_idx);

        Ok(joker_idx)
    }

    /// Get what a Joker at a specific index represents
    pub fn get_joker_identity(&self, joker_index: usize) -> Option<Tile> {
        self.joker_assignments.get(&joker_index).copied()
    }
}
```

---

## 5.5 Player

Represents one of the four players.

```rust
/// A player at the table
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: PlayerId,
    pub seat: Seat,
    pub hand: Hand,
    pub is_bot: bool,
    pub status: PlayerStatus,
}

pub type PlayerId = String; // Could be UUID or username

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Seat {
    East,
    South,
    West,
    North,
}

impl Seat {
    /// Get the player to the right (turn order)
    pub fn right(&self) -> Seat {
        match self {
            Seat::East => Seat::North,
            Seat::North => Seat::West,
            Seat::West => Seat::South,
            Seat::South => Seat::East,
        }
    }

    /// Get the player across
    pub fn across(&self) -> Seat {
        match self {
            Seat::East => Seat::West,
            Seat::West => Seat::East,
            Seat::South => Seat::North,
            Seat::North => Seat::South,
        }
    }

    /// Get the player to the left
    pub fn left(&self) -> Seat {
        match self {
            Seat::East => Seat::South,
            Seat::South => Seat::West,
            Seat::West => Seat::North,
            Seat::North => Seat::East,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlayerStatus {
    Active,
    Dead, // Incorrect tile count or invalid hand
    Waiting,
}

impl Player {
    pub fn new(id: PlayerId, seat: Seat, is_bot: bool) -> Self {
        Player {
            id,
            seat,
            hand: Hand::new(Vec::new()),
            is_bot,
            status: PlayerStatus::Waiting,
        }
    }
}
```

---

## 5.6 Table (Game State)

The aggregate state of the entire game.

```rust
/// The complete game state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Table {
    pub players: HashMap<Seat, Player>,
    pub wall: Wall,
    pub discard_pile: Vec<DiscardedTile>,
    pub current_turn: Seat,
    pub phase: GamePhase,
    pub dealer: Seat, // Always East in first round, rotates after
    pub round_number: u32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct DiscardedTile {
    pub tile: Tile,
    pub discarded_by: Seat,
    pub turn_number: u32,
}

impl Table {
    pub fn new(player_ids: [PlayerId; 4]) -> Self {
        let seats = [Seat::East, Seat::South, Seat::West, Seat::North];
        let mut players = HashMap::new();

        for (i, seat) in seats.iter().enumerate() {
            players.insert(*seat, Player::new(player_ids[i].clone(), *seat, false));
        }

        Table {
            players,
            wall: Wall::from_deck(Deck::new(), 0), // Dice roll happens later
            discard_pile: Vec::new(),
            current_turn: Seat::East,
            phase: GamePhase::WaitingForPlayers,
            dealer: Seat::East,
            round_number: 1,
        }
    }

    /// Get the current player
    pub fn current_player(&self) -> &Player {
        self.players.get(&self.current_turn).unwrap()
    }

    /// Get the current player (mutable)
    pub fn current_player_mut(&mut self) -> &mut Player {
        self.players.get_mut(&self.current_turn).unwrap()
    }

    /// Advance to the next player
    pub fn next_turn(&mut self) {
        self.current_turn = self.current_turn.right();
    }
}
```

---

## 5.7 Error Types

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TileError {
    InvalidRank,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeckError {
    NotEnoughTiles,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HandError {
    TileNotFound,
    InvalidTileCount,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MeldError {
    WrongTileCount,
    MismatchedTiles,
    AllJokers, // Melds must have at least one real tile
    InvalidJokerExchange, // Replacement tile doesn't match meld base tile
    NoJokerToExchange, // Meld has no Jokers to exchange
}
```

---

## Key Design Principles

1. **Immutability where possible**: Most operations return `Result<T, E>` to avoid invalid states
2. **Serialization**: All types are `Serialize`/`Deserialize` for:
   - Sending over WebSocket
   - Auto-generating TypeScript types via `ts-rs`
   - Saving/loading games
3. **Type Safety**: Using enums for `Seat`, `Suit`, `Rank` prevents impossible values
4. **Visibility Control**: `Hand` separates `concealed` (private) from `exposed` (public)
