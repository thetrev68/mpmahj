use crate::tile::{Tile, TILE_COUNT, JOKER_INDEX};
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

    pub fn calculate_deficiency(&self, target_histogram: &[u8]) -> i32 {
        let mut missing_naturals = 0;
        let mut missing_groups = 0;
        let my_jokers = self.counts[JOKER_INDEX as usize];

        // Compare up to the smaller of the two lengths (usually 35-42)
        let limit = std::cmp::min(target_histogram.len(), 35);

        for i in 0..limit {
            let needed = target_histogram[i];
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
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Meld {
    pub meld_type: MeldType,
    pub tiles: Vec<Tile>,
    pub called_tile: Option<Tile>,
    pub joker_assignments: HashMap<usize, Tile>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MeldType {
    Pung,
    Kong,
    Quint,
}

impl MeldType {
    pub fn tile_count(&self) -> usize {
        match self {
            MeldType::Pung => 3,
            MeldType::Kong => 4,
            MeldType::Quint => 5,
        }
    }
}

impl Meld {
    pub fn new(
        meld_type: MeldType,
        tiles: Vec<Tile>,
        called_tile: Option<Tile>,
    ) -> Result<Self, MeldError> {
        let mut joker_assignments = HashMap::new();
        let base_tile = tiles.iter().find(|t| !t.is_joker()).ok_or(MeldError::AllJokers)?;

        for (idx, tile) in tiles.iter().enumerate() {
            if tile.is_joker() {
                joker_assignments.insert(idx, *base_tile);
            }
        }

        let meld = Meld { meld_type, tiles, called_tile, joker_assignments };
        meld.validate()?;
        Ok(meld)
    }

    pub fn tile_count(&self) -> usize {
        self.tiles.len()
    }

    pub fn validate(&self) -> Result<(), MeldError> {
        if self.tiles.len() != self.meld_type.tile_count() {
            return Err(MeldError::WrongTileCount);
        }
        let base_tile = self.tiles.iter().find(|t| !t.is_joker()).ok_or(MeldError::AllJokers)?;
        for tile in &self.tiles {
            if !tile.is_joker() && tile != base_tile {
                return Err(MeldError::MismatchedTiles);
            }
        }
        Ok(())
    }

    pub fn can_exchange_joker(&self, replacement: Tile) -> bool {
        let has_joker = self.tiles.iter().any(|t| t.is_joker());
        if !has_joker { return false; }
        let base_tile = self.tiles.iter().find(|t| !t.is_joker()).expect("Valid meld has base tile");
        replacement == *base_tile
    }

    pub fn exchange_joker(&mut self, replacement: Tile) -> Result<usize, MeldError> {
        if !self.can_exchange_joker(replacement) {
            return Err(MeldError::InvalidJokerExchange);
        }
        let joker_idx = self.tiles.iter().position(|t| t.is_joker()).ok_or(MeldError::NoJokerToExchange)?;
        self.tiles[joker_idx] = replacement;
        self.joker_assignments.remove(&joker_idx);
        Ok(joker_idx)
    }
}

#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum HandError {
    #[error("Tile not found in hand")]
    TileNotFound,
}

#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum MeldError {
    #[error("Wrong tile count")]
    WrongTileCount,
    #[error("Mismatched tiles")]
    MismatchedTiles,
    #[error("All jokers")]
    AllJokers,
    #[error("Invalid joker exchange")]
    InvalidJokerExchange,
    #[error("No joker to exchange")]
    NoJokerToExchange,
}
