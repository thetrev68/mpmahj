//! Deck and Wall management for American Mahjong.
//!
//! The standard deck contains 152 tiles:
//! - 3 numbered suits (Dots, Bams, Cracks) with ranks 1-9, 4 of each = 108 tiles
//! - 4 Winds (N, E, W, S), 4 of each = 16 tiles
//! - 3 Dragons (R, G, W), 4 of each = 12 tiles
//! - 8 Flowers (all identical in American Mahjong) = 8 tiles
//! - 8 Jokers (wildcards) = 8 tiles
//!
//! With the blank tiles house rule enabled, the deck contains 160 tiles:
//! - All standard tiles (152) plus 8 blank tiles

use crate::tile::{Dragon, Rank, Suit, Tile, Wind};
use rand::seq::SliceRandom;
use rand::SeedableRng;
use serde::{Deserialize, Serialize};

/// The complete set of tiles used in American Mahjong.
/// Standard: 152 tiles. With blanks: 160 tiles.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deck {
    pub tiles: Vec<Tile>,
}

impl Deck {
    /// Create a standard American Mahjong deck with 152 tiles (no blanks).
    pub fn new() -> Self {
        Self::new_with_blanks(false)
    }

    /// Create a deck with optional blank tiles.
    /// If `include_blanks` is true, adds 8 blank tiles (160 total).
    /// If false, creates a standard 152-tile deck.
    pub fn new_with_blanks(include_blanks: bool) -> Self {
        let capacity = if include_blanks { 160 } else { 152 };
        let mut tiles = Vec::with_capacity(capacity);

        // Add numbered tiles: Dots, Bams, Cracks (1-9), 4 of each
        for suit in [Suit::Dots, Suit::Bams, Suit::Cracks] {
            for rank_num in 1..=9 {
                if let Some(rank) = Rank::from_u8(rank_num) {
                    for _ in 0..4 {
                        if let Some(tile) = Tile::new_suited(suit, rank) {
                            tiles.push(tile);
                        }
                    }
                }
            }
        }

        // Add Winds: North, East, West, South (4 of each)
        for wind in [Wind::North, Wind::East, Wind::West, Wind::South] {
            for _ in 0..4 {
                tiles.push(Tile::new_wind(wind));
            }
        }

        // Add Dragons: Red, Green, White (4 of each)
        for dragon in [Dragon::Red, Dragon::Green, Dragon::White] {
            for _ in 0..4 {
                tiles.push(Tile::new_dragon(dragon));
            }
        }

        // Add 8 Flowers (indexed 0-7, but all identical in function)
        for i in 0..8 {
            tiles.push(Tile::new_flower(i));
        }

        // Add 8 Jokers
        for _ in 0..8 {
            tiles.push(Tile::new_joker());
        }

        // Add 8 Blank tiles if house rule is enabled
        if include_blanks {
            for _ in 0..8 {
                tiles.push(Tile::new_blank());
            }
        }

        let expected_count = if include_blanks { 160 } else { 152 };
        assert_eq!(tiles.len(), expected_count, "Deck must have exactly {} tiles", expected_count);

        Deck { tiles }
    }

    /// Shuffle the deck using a deterministic RNG for testing.
    /// Uses SmallRng which is fast and reproducible with the same seed.
    pub fn shuffle_with_seed(&mut self, seed: u64) {
        let mut rng = rand::rngs::SmallRng::seed_from_u64(seed);
        self.tiles.shuffle(&mut rng);
    }

    /// Shuffle the deck using a cryptographically secure RNG.
    /// Use this for production games where randomness quality matters.
    #[cfg(not(test))]
    pub fn shuffle(&mut self) {
        let mut rng = rand::thread_rng();
        self.tiles.shuffle(&mut rng);
    }

    /// For testing, provide a way to shuffle with a seed.
    #[cfg(test)]
    pub fn shuffle(&mut self) {
        // In tests, use a fixed seed for reproducibility
        self.shuffle_with_seed(0);
    }
}

impl Default for Deck {
    fn default() -> Self {
        Self::new()
    }
}

/// The "Wall" - the drawable pile of tiles during the game.
/// The wall is created by shuffling the deck and "breaking" it at a position
/// determined by the dealer's dice roll.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wall {
    /// The tiles available to draw from
    tiles: Vec<Tile>,

    /// The "dead wall" - tiles reserved and not drawable
    /// This is determined by the dice roll during setup
    dead_wall_size: usize,
}

impl Wall {
    /// Create a wall from a shuffled deck.
    /// The break_point is determined by East's dice roll (typically 2-12).
    /// In American Mahjong, the dead wall is the number of tile groups equal to the dice roll.
    /// Each "group" is 2 tiles, so a roll of 7 means 14 tiles are in the dead wall.
    pub fn from_deck(deck: Deck, break_point: usize) -> Self {
        Wall {
            tiles: deck.tiles,
            dead_wall_size: break_point * 2,
        }
    }

    /// Create a wall from a shuffled deck with a specific seed for testing.
    pub fn from_deck_with_seed(seed: u64, break_point: usize) -> Self {
        let mut deck = Deck::new();
        deck.shuffle_with_seed(seed);
        Self::from_deck(deck, break_point)
    }

    /// Draw a tile from the wall.
    /// Returns None if the wall is exhausted (only dead wall remains).
    pub fn draw(&mut self) -> Option<Tile> {
        if self.tiles.len() <= self.dead_wall_size {
            return None; // Wall exhausted
        }
        self.tiles.pop()
    }

    /// Get the number of drawable tiles remaining.
    /// This is visible to all players.
    pub fn remaining(&self) -> usize {
        self.tiles.len().saturating_sub(self.dead_wall_size)
    }

    /// Deal initial hands to 4 players according to American Mahjong rules.
    ///
    /// Dealing sequence:
    /// 1. Deal 3 rounds of 4 tiles to each player (12 tiles each)
    /// 2. Final round: East gets 2 tiles (for 14 total), others get 1 each (for 13 total)
    ///
    /// Returns a Vec of 4 hands, where index 0 is East, 1 is South, 2 is West, 3 is North.
    pub fn deal_initial(&mut self) -> Result<[Vec<Tile>; 4], DeckError> {
        const TILES_PER_PLAYER: usize = 13;
        const TOTAL_NEEDED: usize = 4 * TILES_PER_PLAYER + 1; // +1 for East's 14th tile

        if self.remaining() < TOTAL_NEEDED {
            return Err(DeckError::NotEnoughTiles);
        }

        let mut hands: [Vec<Tile>; 4] = [
            Vec::with_capacity(14), // East
            Vec::with_capacity(13), // South
            Vec::with_capacity(13), // West
            Vec::with_capacity(13), // North
        ];

        // Deal 3 rounds of 4 tiles each (12 tiles per player)
        for _ in 0..3 {
            for hand in hands.iter_mut() {
                for _ in 0..4 {
                    hand.push(self.draw().ok_or(DeckError::NotEnoughTiles)?);
                }
            }
        }

        // Final round: East gets 1st tile, others get 1 tile each, then East gets 2nd tile
        hands[0].push(self.draw().ok_or(DeckError::NotEnoughTiles)?); // East's 13th
        hands[1].push(self.draw().ok_or(DeckError::NotEnoughTiles)?); // South's 13th
        hands[2].push(self.draw().ok_or(DeckError::NotEnoughTiles)?); // West's 13th
        hands[0].push(self.draw().ok_or(DeckError::NotEnoughTiles)?); // East's 14th
        hands[3].push(self.draw().ok_or(DeckError::NotEnoughTiles)?); // North's 13th

        Ok(hands)
    }

    /// Get the total number of tiles in the wall (including dead wall).
    pub fn total_tiles(&self) -> usize {
        self.tiles.len()
    }

    /// Get the dead wall size.
    pub fn dead_wall_size(&self) -> usize {
        self.dead_wall_size
    }
}

/// Errors that can occur during deck/wall operations.
#[derive(Debug, Clone, thiserror::Error, Serialize, Deserialize)]
pub enum DeckError {
    #[error("Not enough tiles remaining in the wall to complete this operation")]
    NotEnoughTiles,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tile::TileKind;

    #[test]
    fn test_deck_has_152_tiles() {
        let deck = Deck::new();
        assert_eq!(deck.tiles.len(), 152);
    }

    #[test]
    fn test_deck_composition() {
        let deck = Deck::new();

        // Count tiles by type
        let mut numbered_count = 0;
        let mut wind_count = 0;
        let mut dragon_count = 0;
        let mut flower_count = 0;
        let mut joker_count = 0;
        let mut blank_count = 0;

        for tile in &deck.tiles {
            match tile.kind {
                TileKind::Suited(_, _) => numbered_count += 1,
                TileKind::HonorWind(_) => wind_count += 1,
                TileKind::HonorDragon(_) => dragon_count += 1,
                TileKind::Flower(_) => flower_count += 1,
                TileKind::Joker => joker_count += 1,
                TileKind::Blank => blank_count += 1,
            }
        }

        assert_eq!(numbered_count, 108); // 3 suits × 9 ranks × 4 copies
        assert_eq!(wind_count, 16);      // 4 winds × 4 copies
        assert_eq!(dragon_count, 12);    // 3 dragons × 4 copies
        assert_eq!(flower_count, 8);     // 8 flowers
        assert_eq!(joker_count, 8);      // 8 jokers
        assert_eq!(blank_count, 0);      // No blanks in standard deck
    }

    #[test]
    fn test_deck_with_blanks() {
        let deck = Deck::new_with_blanks(true);
        assert_eq!(deck.tiles.len(), 160);

        // Count blank tiles
        let blank_count = deck.tiles.iter().filter(|t| matches!(t.kind, TileKind::Blank)).count();
        assert_eq!(blank_count, 8);
    }

    #[test]
    fn test_deterministic_shuffle() {
        let mut deck1 = Deck::new();
        let mut deck2 = Deck::new();

        deck1.shuffle_with_seed(42);
        deck2.shuffle_with_seed(42);

        // Same seed should produce identical shuffle
        assert_eq!(deck1.tiles, deck2.tiles);
    }

    #[test]
    fn test_different_seeds_produce_different_shuffles() {
        let mut deck1 = Deck::new();
        let mut deck2 = Deck::new();

        deck1.shuffle_with_seed(42);
        deck2.shuffle_with_seed(123);

        // Different seeds should (almost certainly) produce different shuffles
        assert_ne!(deck1.tiles, deck2.tiles);
    }

    #[test]
    fn test_wall_draw() {
        let mut wall = Wall::from_deck_with_seed(42, 7); // Dice roll of 7 = 14 dead wall

        let initial_remaining = wall.remaining();
        assert_eq!(initial_remaining, 152 - 14);

        let tile = wall.draw();
        assert!(tile.is_some());
        assert_eq!(wall.remaining(), initial_remaining - 1);
    }

    #[test]
    fn test_wall_exhaustion() {
        let mut wall = Wall::from_deck_with_seed(42, 7);

        // Draw all available tiles
        let drawable = wall.remaining();
        for _ in 0..drawable {
            assert!(wall.draw().is_some());
        }

        // Wall should now be exhausted
        assert_eq!(wall.remaining(), 0);
        assert!(wall.draw().is_none());
    }

    #[test]
    fn test_deal_initial_hands() {
        let mut wall = Wall::from_deck_with_seed(42, 7);

        let hands = wall.deal_initial().expect("Should deal successfully");

        // Verify hand sizes
        assert_eq!(hands[0].len(), 14); // East has 14 tiles
        assert_eq!(hands[1].len(), 13); // South has 13 tiles
        assert_eq!(hands[2].len(), 13); // West has 13 tiles
        assert_eq!(hands[3].len(), 13); // North has 13 tiles

        // Total tiles dealt: 53
        let total_dealt = hands.iter().map(|h| h.len()).sum::<usize>();
        assert_eq!(total_dealt, 53);
    }

    #[test]
    fn test_deterministic_dealing() {
        let mut wall1 = Wall::from_deck_with_seed(123, 8);
        let mut wall2 = Wall::from_deck_with_seed(123, 8);

        let hands1 = wall1.deal_initial().unwrap();
        let hands2 = wall2.deal_initial().unwrap();

        // Same seed should produce identical hands
        for i in 0..4 {
            assert_eq!(hands1[i], hands2[i]);
        }
    }
}
