use crate::meld::Meld;
use crate::tile::{Tile, JOKER_INDEX, TILE_COUNT};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// A player's hand, consisting of concealed and exposed tiles.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Hand {
    /// Tiles only the player can see (ordered list).
    pub concealed: Vec<Tile>,

    /// O(1) Lookup table: Count of each tile type in the concealed hand.
    /// Uses Vec for easier serialization, but always length TILE_COUNT.
    pub counts: Vec<u8>,

    /// Melds that have been exposed by calling discards.
    pub exposed: Vec<Meld>,

    /// Resolved Joker assignments for concealed tiles (populated by validator).
    pub joker_assignments: Option<HashMap<usize, Tile>>,
}

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

    pub fn empty() -> Self {
        Hand {
            concealed: Vec::new(),
            counts: vec![0u8; TILE_COUNT],
            exposed: Vec::new(),
            joker_assignments: None,
        }
    }

    pub fn total_tiles(&self) -> usize {
        let exposed_count: usize = self.exposed.iter().map(|m| m.tile_count()).sum();
        self.concealed.len() + exposed_count
    }

    pub fn add_tile(&mut self, tile: Tile) {
        self.concealed.push(tile);
        self.counts[tile.0 as usize] += 1;
        self.joker_assignments = None;
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

    pub fn has_tile(&self, tile: Tile) -> bool {
        self.counts[tile.0 as usize] > 0
    }

    pub fn count_tile(&self, tile: Tile) -> usize {
        self.counts[tile.0 as usize] as usize
    }

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
    ///
    /// # Arguments
    /// * `target_histogram` - The pattern's tile frequency array (typically length 42)
    ///
    /// # Returns
    /// The total number of tiles needed to complete the pattern (0 = win)
    pub fn calculate_deficiency(&self, target_histogram: &[u8]) -> i32 {
        let mut missing_naturals = 0;
        let mut missing_groups = 0;
        let my_jokers = self.counts[JOKER_INDEX as usize];

        // Compare up to the smaller of the two lengths (usually 35-42)
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

    pub fn expose_meld(&mut self, meld: Meld) -> Result<(), HandError> {
        let mut to_remove = meld.tiles.clone();
        if let Some(called) = meld.called_tile {
            if let Some(pos) = to_remove.iter().position(|&t| t == called) {
                to_remove.remove(pos);
            }
        }

        for t in to_remove {
            self.remove_tile(t)?;
        }

        self.exposed.push(meld);
        Ok(())
    }

    pub fn set_joker_assignments(&mut self, assignments: HashMap<usize, Tile>) {
        self.joker_assignments = Some(assignments);
    }

    /// Check if hand contains a pair (at least 2) of the given tile.
    ///
    /// Used by AI for scoring potential hand patterns.
    pub fn contains_pair(&self, tile: Tile) -> bool {
        self.counts[tile.0 as usize] >= 2
    }

    /// Check if a tile is "isolated" (no nearby tiles in same suit).
    ///
    /// For suited tiles (Bams, Craks, Dots), checks if there are no adjacent
    /// rank tiles (e.g., for 5 Bam, checks for 4 Bam and 6 Bam).
    /// For honor tiles (Winds, Dragons, Flower), always returns true since
    /// they cannot form sequences.
    ///
    /// Used by AI to identify tiles that are less useful for pattern building.
    pub fn is_isolated(&self, tile: Tile) -> bool {
        if !tile.is_suited() {
            return true; // Winds/Dragons/Flower are always isolated
        }

        let idx = tile.0 as usize;

        // Check neighbors (±1 rank in same suit)
        // Need to be careful about suit boundaries
        if idx > 0 && !idx.is_multiple_of(9) && self.counts[idx - 1] > 0 {
            return false; // Has lower neighbor in same suit
        }
        if idx < 26 && !(idx + 1).is_multiple_of(9) && self.counts[idx + 1] > 0 {
            return false; // Has higher neighbor in same suit
        }

        true
    }
}

#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum HandError {
    #[error("Tile not found in hand")]
    TileNotFound,
}
