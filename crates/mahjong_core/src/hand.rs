//! Player Hand management for American Mahjong.
//!
//! A hand consists of:
//! - Concealed tiles (private, only visible to the player)
//! - Exposed melds (public, visible to all players)
//! - Optional joker assignments (resolved during win validation)

use crate::tile::{Suit, Tile};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A player's hand, consisting of concealed and exposed tiles.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Hand {
    /// Tiles only the player can see
    pub concealed: Vec<Tile>,

    /// Melds that have been exposed by calling discards
    pub exposed: Vec<Meld>,

    /// Resolved Joker assignments for concealed tiles (populated by validator)
    /// Maps index in concealed Vec to what that Joker represents
    /// Only populated after successful validation
    pub joker_assignments: Option<HashMap<usize, Tile>>,
}

impl Hand {
    /// Create a new hand from a list of tiles.
    pub fn new(tiles: Vec<Tile>) -> Self {
        Hand {
            concealed: tiles,
            exposed: Vec::new(),
            joker_assignments: None,
        }
    }

    /// Create an empty hand.
    pub fn empty() -> Self {
        Hand {
            concealed: Vec::new(),
            exposed: Vec::new(),
            joker_assignments: None,
        }
    }

    /// Total tile count (should always be 13, or 14 for dealer at start).
    pub fn total_tiles(&self) -> usize {
        let exposed_count: usize = self.exposed.iter().map(|m| m.tile_count()).sum();
        self.concealed.len() + exposed_count
    }

    /// Add a tile (from draw or Charleston pass).
    pub fn add_tile(&mut self, tile: Tile) {
        self.concealed.push(tile);
        // Clear joker assignments when hand changes
        self.joker_assignments = None;
    }

    /// Remove a tile (for discard or Charleston pass).
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

    /// Check if the hand contains a specific tile.
    pub fn has_tile(&self, tile: Tile) -> bool {
        self.concealed.contains(&tile)
    }

    /// Count how many of a specific tile are in the concealed hand.
    pub fn count_tile(&self, tile: Tile) -> usize {
        self.concealed.iter().filter(|&&t| t == tile).count()
    }

    /// Expose a meld (when calling a discard).
    /// Removes the tiles from the concealed hand and adds the meld to exposed.
    pub fn expose_meld(&mut self, meld: Meld) -> Result<(), HandError> {
        // Verify player has the required tiles (excluding the called tile)
        for tile in &meld.tiles {
            // Skip the called tile - it came from the discard
            if let Some(called) = meld.called_tile {
                if *tile == called {
                    // Only skip one instance of the called tile
                    continue;
                }
            }

            // Remove tile from concealed hand
            if !self.has_tile(*tile) {
                return Err(HandError::TileNotFound);
            }
            self.remove_tile(*tile)?;
        }

        self.exposed.push(meld);
        // Clear joker assignments when hand changes
        self.joker_assignments = None;
        Ok(())
    }

    /// Get what a specific concealed Joker represents (for UI display).
    pub fn get_joker_identity(&self, joker_index: usize) -> Option<Tile> {
        self.joker_assignments
            .as_ref()
            .and_then(|map| map.get(&joker_index).copied())
    }

    /// Set Joker assignments after validation.
    /// Called by the validation engine when a winning hand is found.
    pub fn set_joker_assignments(&mut self, assignments: HashMap<usize, Tile>) {
        self.joker_assignments = Some(assignments);
    }

    /// Sort concealed tiles by suit and rank (helper for UI and validation).
    pub fn sort(&mut self) {
        self.concealed.sort_by_key(|tile| {
            // Custom sort order: Dots < Bams < Cracks < Winds < Dragons < Flowers < Jokers < Blanks
            match tile.suit() {
                Suit::Dots => 0,
                Suit::Bams => 1,
                Suit::Cracks => 2,
                Suit::Winds => 3,
                Suit::Dragons => 4,
                Suit::Flowers => 5,
                Suit::Jokers => 6,
                Suit::Blanks => 7,
            }
        });
    }
}

/// An exposed set of tiles (Pung/Kong/Quint).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Meld {
    pub meld_type: MeldType,
    pub tiles: Vec<Tile>,

    /// The tile that was called from discard (if any).
    /// None means this is a self-made meld (not applicable in American Mahjong usually).
    pub called_tile: Option<Tile>,

    /// Tracks which tiles in this meld are Jokers and what they represent.
    /// Maps index in tiles Vec to the actual tile the Joker represents.
    /// Example: If tiles[1] is a Joker representing 4-Bam, map contains (1, 4-Bam).
    pub joker_assignments: HashMap<usize, Tile>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MeldType {
    Pung,  // 3 identical tiles
    Kong,  // 4 identical tiles
    Quint, // 5 identical tiles (requires Joker)
}

impl MeldType {
    /// Get the number of tiles required for this meld type.
    pub fn tile_count(&self) -> usize {
        match self {
            MeldType::Pung => 3,
            MeldType::Kong => 4,
            MeldType::Quint => 5,
        }
    }
}

impl Meld {
    /// Create a new meld with automatic Joker assignment detection.
    pub fn new(
        meld_type: MeldType,
        tiles: Vec<Tile>,
        called_tile: Option<Tile>,
    ) -> Result<Self, MeldError> {
        let mut joker_assignments = HashMap::new();

        // Find the base tile (first non-Joker)
        let base_tile = tiles
            .iter()
            .find(|t| t.suit() != Suit::Jokers)
            .ok_or(MeldError::AllJokers)?;

        // Assign all Jokers to represent the base tile
        for (idx, tile) in tiles.iter().enumerate() {
            if tile.suit() == Suit::Jokers {
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

    /// Get the number of tiles in this meld.
    pub fn tile_count(&self) -> usize {
        self.tiles.len()
    }

    /// Validate that a meld is legal.
    pub fn validate(&self) -> Result<(), MeldError> {
        if self.tiles.len() != self.meld_type.tile_count() {
            return Err(MeldError::WrongTileCount);
        }

        // All tiles must be the same (ignoring Jokers)
        let base_tile = self
            .tiles
            .iter()
            .find(|t| t.suit() != Suit::Jokers)
            .ok_or(MeldError::AllJokers)?;

        for tile in &self.tiles {
            if tile.suit() != Suit::Jokers && tile != base_tile {
                return Err(MeldError::MismatchedTiles);
            }
        }

        Ok(())
    }

    /// Check if a Joker can be exchanged for a real tile.
    pub fn can_exchange_joker(&self, replacement: Tile) -> bool {
        // Must have at least one Joker
        let has_joker = self.tiles.iter().any(|t| t.suit() == Suit::Jokers);
        if !has_joker {
            return false;
        }

        // Replacement must match the meld's base tile
        let base_tile = self
            .tiles
            .iter()
            .find(|t| t.suit() != Suit::Jokers)
            .expect("Validated melds must have at least one non-Joker");

        replacement == *base_tile
    }

    /// Exchange a Joker in this meld for a real tile.
    /// Returns the index of the swapped Joker for UI updates.
    pub fn exchange_joker(&mut self, replacement: Tile) -> Result<usize, MeldError> {
        if !self.can_exchange_joker(replacement) {
            return Err(MeldError::InvalidJokerExchange);
        }

        // Find first Joker in the meld
        let joker_idx = self
            .tiles
            .iter()
            .position(|t| t.suit() == Suit::Jokers)
            .ok_or(MeldError::NoJokerToExchange)?;

        // Replace the Joker with the real tile
        self.tiles[joker_idx] = replacement;

        // Remove from joker_assignments since it's no longer a Joker
        self.joker_assignments.remove(&joker_idx);

        Ok(joker_idx)
    }

    /// Get what a Joker at a specific index represents.
    pub fn get_joker_identity(&self, joker_index: usize) -> Option<Tile> {
        self.joker_assignments.get(&joker_index).copied()
    }
}

/// Errors that can occur during hand operations.
#[derive(Debug, Clone, thiserror::Error, Serialize, Deserialize)]
pub enum HandError {
    #[error("Tile not found in hand")]
    TileNotFound,

    #[error("Invalid tile count: expected {expected}, got {got}")]
    InvalidTileCount { expected: usize, got: usize },
}

/// Errors that can occur during meld operations.
#[derive(Debug, Clone, thiserror::Error, Serialize, Deserialize)]
pub enum MeldError {
    #[error("Wrong tile count for this meld type")]
    WrongTileCount,

    #[error("Tiles in meld do not match")]
    MismatchedTiles,

    #[error("Melds must have at least one real tile (cannot be all Jokers)")]
    AllJokers,

    #[error("Replacement tile doesn't match meld base tile")]
    InvalidJokerExchange,

    #[error("Meld has no Jokers to exchange")]
    NoJokerToExchange,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tile::Rank;

    #[test]
    fn test_hand_creation() {
        let hand = Hand::empty();
        assert_eq!(hand.total_tiles(), 0);
        assert_eq!(hand.concealed.len(), 0);
        assert_eq!(hand.exposed.len(), 0);
    }

    #[test]
    fn test_add_remove_tile() {
        let mut hand = Hand::empty();
        let tile = Tile::new_suited(Suit::Dots, Rank::Five).unwrap();

        hand.add_tile(tile);
        assert_eq!(hand.total_tiles(), 1);
        assert!(hand.has_tile(tile));

        hand.remove_tile(tile).unwrap();
        assert_eq!(hand.total_tiles(), 0);
        assert!(!hand.has_tile(tile));
    }

    #[test]
    fn test_pung_creation() {
        let tile = Tile::new_suited(Suit::Bams, Rank::Seven).unwrap();
        let tiles = vec![tile, tile, tile];

        let meld = Meld::new(MeldType::Pung, tiles, Some(tile)).unwrap();
        assert_eq!(meld.tile_count(), 3);
        assert_eq!(meld.meld_type, MeldType::Pung);
    }

    #[test]
    fn test_pung_with_joker() {
        let tile = Tile::new_suited(Suit::Cracks, Rank::Three).unwrap();
        let joker = Tile::new_joker();
        let tiles = vec![tile, tile, joker];

        let meld = Meld::new(MeldType::Pung, tiles, Some(tile)).unwrap();
        assert_eq!(meld.tile_count(), 3);

        // Joker should be assigned to represent the base tile
        assert_eq!(meld.joker_assignments.len(), 1);
        assert_eq!(meld.joker_assignments.get(&2), Some(&tile));
    }

    #[test]
    fn test_joker_exchange() {
        let tile = Tile::new_suited(Suit::Dots, Rank::Nine).unwrap();
        let joker = Tile::new_joker();
        let tiles = vec![tile, joker, tile, tile];

        let mut meld = Meld::new(MeldType::Kong, tiles, Some(tile)).unwrap();

        // Can exchange joker
        assert!(meld.can_exchange_joker(tile));

        // Exchange the joker
        let idx = meld.exchange_joker(tile).unwrap();
        assert_eq!(idx, 1); // Joker was at index 1

        // After exchange, meld should have no jokers
        assert!(!meld.tiles.iter().any(|t| t.suit() == Suit::Jokers));
    }

    #[test]
    fn test_meld_validation_wrong_count() {
        let tile = Tile::new_suited(Suit::Bams, Rank::Two).unwrap();
        let tiles = vec![tile, tile]; // Only 2 tiles for a Pung

        let result = Meld::new(MeldType::Pung, tiles, None);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), MeldError::WrongTileCount));
    }

    #[test]
    fn test_meld_validation_mismatched() {
        let tile1 = Tile::new_suited(Suit::Bams, Rank::Two).unwrap();
        let tile2 = Tile::new_suited(Suit::Bams, Rank::Three).unwrap();
        let tiles = vec![tile1, tile1, tile2]; // Mixed ranks

        let result = Meld::new(MeldType::Pung, tiles, None);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), MeldError::MismatchedTiles));
    }

    #[test]
    fn test_kong_creation() {
        let tile = Tile::new_suited(Suit::Dots, Rank::One).unwrap();
        let tiles = vec![tile, tile, tile, tile];

        let meld = Meld::new(MeldType::Kong, tiles, Some(tile)).unwrap();
        assert_eq!(meld.tile_count(), 4);
        assert_eq!(meld.meld_type, MeldType::Kong);
    }

    #[test]
    fn test_quint_with_jokers() {
        let tile = Tile::new_suited(Suit::Cracks, Rank::Eight).unwrap();
        let joker = Tile::new_joker();
        let tiles = vec![tile, tile, tile, joker, joker];

        let meld = Meld::new(MeldType::Quint, tiles, Some(tile)).unwrap();
        assert_eq!(meld.tile_count(), 5);
        assert_eq!(meld.meld_type, MeldType::Quint);
        assert_eq!(meld.joker_assignments.len(), 2); // 2 jokers
    }
}
