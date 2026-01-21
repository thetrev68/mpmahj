//! Player hand representation and utility helpers.

use crate::meld::Meld;
use crate::tile::{Tile, JOKER_INDEX, TILE_COUNT};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use ts_rs::TS;

/// A player's hand, consisting of concealed and exposed tiles.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
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
    /// Create a new hand from a list of concealed tiles.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::hand::Hand;
    /// use mahjong_core::tile::tiles::{BAM_1, BAM_2, BAM_3};
    ///
    /// let hand = Hand::new(vec![BAM_1, BAM_2, BAM_3]);
    /// assert_eq!(hand.concealed.len(), 3);
    /// ```
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

    /// Create an empty hand with zero tiles.
    pub fn empty() -> Self {
        Hand {
            concealed: Vec::new(),
            counts: vec![0u8; TILE_COUNT],
            exposed: Vec::new(),
            joker_assignments: None,
        }
    }

    /// Count total tiles across concealed and exposed melds.
    pub fn total_tiles(&self) -> usize {
        let exposed_count: usize = self.exposed.iter().map(|m| m.tile_count()).sum();
        self.concealed.len() + exposed_count
    }

    /// Get the tile count (concealed + exposed) for public player info.
    pub fn tile_count(&self) -> usize {
        self.total_tiles()
    }

    /// Add a tile to the concealed hand and clear joker assignments.
    pub fn add_tile(&mut self, tile: Tile) {
        self.concealed.push(tile);
        self.counts[tile.0 as usize] += 1;
        self.joker_assignments = None;
    }

    /// Remove one instance of a tile from the concealed hand.
    ///
    /// # Errors
    /// Returns `HandError::TileNotFound` if the tile is not in the concealed list.
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

    /// Check whether the concealed hand contains a tile.
    pub fn has_tile(&self, tile: Tile) -> bool {
        self.counts[tile.0 as usize] > 0
    }

    /// Count occurrences of a tile in the concealed hand.
    pub fn count_tile(&self, tile: Tile) -> usize {
        self.counts[tile.0 as usize] as usize
    }

    /// Calculate the "deficiency" (distance to win) for a given target pattern.
    ///
    /// This implements the core histogram-based validation algorithm with strict joker rules:
    /// 1. Check strict requirements (Singles, Pairs, Flowers) against `ineligible_histogram`.
    ///    - Any deficit here MUST be filled by natural tiles (jokers cannot help).
    /// 2. Check total volume requirements against `target_histogram`.
    ///    - Remaining deficit can be filled by Jokers.
    ///
    /// A deficiency of 0 means Mahjong (winning hand).
    ///
    /// # Arguments
    /// * `target_histogram` - The pattern's total tile frequency array
    /// * `ineligible_histogram` - The pattern's NO-JOKER tile frequency array (singles, pairs, flowers)
    ///
    /// # Returns
    /// The total number of tiles needed to complete the pattern (0 = win)
    ///
    /// # Examples
    ///
    /// ## Example 1: Pair (strict) vs Pung (flexible)
    /// ```rust
    /// # use mahjong_core::hand::Hand;
    /// # use mahjong_core::tile::tiles::*;
    /// // Pattern: 11 333 (pair + pung)
    /// let mut target = vec![0u8; 42];
    /// target[0] = 2; // 2× 1Bam (pair)
    /// target[2] = 3; // 3× 3Bam (pung)
    ///
    /// let mut ineligible = vec![0u8; 42];
    /// ineligible[0] = 2; // Pair must be natural
    /// // (pung is flexible, ineligible[2] = 0)
    ///
    /// // Hand with joker in pair: [1B, J, 3B, 3B, 3B]
    /// let hand_bad = Hand::new(vec![BAM_1, JOKER, BAM_3, BAM_3, BAM_3]);
    /// assert_eq!(hand_bad.calculate_deficiency(&target, &ineligible), 1);
    /// // ^ Joker cannot fill the pair → still need 1 natural 1B
    ///
    /// // Hand with joker in pung: [1B, 1B, J, J, 3B]
    /// let hand_good = Hand::new(vec![BAM_1, BAM_1, JOKER, JOKER, BAM_3]);
    /// assert_eq!(hand_good.calculate_deficiency(&target, &ineligible), 0);
    /// // ^ Pair satisfied with naturals, jokers fill pung → WIN!
    /// ```
    ///
    /// ## Example 2: Flowers are always ineligible
    /// ```rust
    /// # use mahjong_core::hand::Hand;
    /// # use mahjong_core::tile::tiles::*;
    /// let mut target = vec![0u8; 42];
    /// target[34] = 4; // 4 Flowers
    ///
    /// let mut ineligible = vec![0u8; 42];
    /// ineligible[34] = 4; // All flowers must be natural
    ///
    /// let hand = Hand::new(vec![FLOWER, FLOWER, FLOWER, JOKER]);
    /// assert_eq!(hand.calculate_deficiency(&target, &ineligible), 1);
    /// // ^ Joker cannot substitute for flower
    /// ```
    pub fn calculate_deficiency(
        &self,
        target_histogram: &[u8],
        ineligible_histogram: &[u8],
    ) -> i32 {
        let (missing_naturals, missing_groups) =
            self.compute_base_deficiency(target_histogram, ineligible_histogram);

        let my_jokers = self.counts[JOKER_INDEX as usize];
        self.apply_joker_adjustments(missing_naturals, missing_groups, my_jokers)
    }

    /// Computes the base deficiency before applying joker substitutions.
    ///
    /// This function calculates two components:
    /// 1. **Missing naturals**: Tiles that must be acquired as natural tiles (cannot use jokers)
    /// 2. **Missing groups**: Tiles that can be filled by either naturals or jokers
    ///
    /// # Arguments
    /// * `target_histogram` - The target tile distribution for the pattern
    /// * `ineligible_histogram` - Tiles that cannot be substituted with jokers
    ///
    /// # Returns
    /// A tuple `(missing_naturals, missing_groups)` where:
    /// * `missing_naturals` - Number of specific tiles needed (joker-ineligible)
    /// * `missing_groups` - Number of tiles needed that jokers could fill
    ///
    /// # Implementation Notes
    /// For each tile type (0..JOKER_INDEX):
    /// - Calculate strict deficit: tiles required as naturals (ineligible for jokers)
    /// - Calculate flexible deficit: remaining tiles after strict requirements
    /// - Flexible tiles can be satisfied by either naturals or jokers during resolution
    fn compute_base_deficiency(
        &self,
        target_histogram: &[u8],
        ineligible_histogram: &[u8],
    ) -> (i32, i32) {
        let mut missing_naturals = 0;
        let mut missing_groups = 0;

        // Check standard tiles up to JOKER_INDEX (exclude Joker and Blank from requirements)
        let limit = std::cmp::min(target_histogram.len(), JOKER_INDEX as usize);

        for i in 0..limit {
            let have = self.counts[i];
            let total_needed = target_histogram[i];

            // If ineligible_histogram is shorter or missing, assume 0 (not strict)
            let strict_needed = if i < ineligible_histogram.len() {
                ineligible_histogram[i]
            } else {
                0
            };

            if total_needed == 0 && strict_needed == 0 {
                continue;
            }

            // 1. Calculate strict deficit (Must be filled by Naturals)
            let strict_deficit = if have < strict_needed {
                (strict_needed - have) as i32
            } else {
                0
            };

            missing_naturals += strict_deficit;

            // 2. Calculate remaining deficit (Can be filled by Jokers)
            // Effectively, we used 'strict_deficit' imaginary naturals to satisfy strict needs.
            // Or rather, we need to acquire 'strict_deficit' naturals.
            // Once acquired, our 'have' becomes 'have + strict_deficit'.
            // The remaining need is 'total_needed - (have + strict_deficit)'.

            let effective_have = have as i32 + strict_deficit;
            let flexible_needed = (total_needed as i32) - effective_have;

            if flexible_needed > 0 {
                missing_groups += flexible_needed;
            }
        }

        (missing_naturals, missing_groups)
    }

    /// Applies joker adjustments to calculate final deficiency.
    ///
    /// This function determines how many tiles still need to be acquired after
    /// accounting for available jokers that can substitute for flexible tiles.
    ///
    /// # Arguments
    /// * `missing_naturals` - Number of specific tiles needed (cannot use jokers)
    /// * `missing_groups` - Number of tiles that jokers could substitute for
    /// * `joker_count` - Number of jokers available in the hand
    ///
    /// # Returns
    /// The total deficiency: tiles still needed after using available jokers
    ///
    /// # Implementation Notes
    /// - Jokers can only satisfy `missing_groups`, not `missing_naturals`
    /// - The final deficiency is: `missing_naturals + max(0, missing_groups - joker_count)`
    /// - If we have more jokers than needed, excess jokers don't reduce deficiency below zero
    fn apply_joker_adjustments(
        &self,
        missing_naturals: i32,
        missing_groups: i32,
        joker_count: u8,
    ) -> i32 {
        let remaining_group_deficit = std::cmp::max(0, missing_groups - (joker_count as i32));
        missing_naturals + remaining_group_deficit
    }

    /// Move tiles into an exposed meld, removing called tiles from the concealed hand.
    ///
    /// # Errors
    /// Returns `HandError::TileNotFound` if a required concealed tile is missing.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::hand::Hand;
    /// use mahjong_core::meld::{Meld, MeldType};
    /// use mahjong_core::tile::tiles::DOT_5;
    ///
    /// let mut hand = Hand::new(vec![DOT_5, DOT_5]);
    /// let meld = Meld::new(MeldType::Pung, vec![DOT_5, DOT_5, DOT_5], Some(DOT_5)).unwrap();
    /// hand.expose_meld(meld).unwrap();
    /// assert_eq!(hand.concealed.len(), 0);
    /// ```
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

    /// Store joker assignments from the validator.
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
    /// The requested tile was not found in the concealed hand.
    ///
    /// This error type is not exported to TypeScript; it is converted to a
    /// string message for payloads.
    #[error("Tile not found in hand")]
    TileNotFound,
}
