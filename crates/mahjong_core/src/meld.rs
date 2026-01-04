use crate::tile::Tile;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct Meld {
    pub meld_type: MeldType,
    pub tiles: Vec<Tile>,
    pub called_tile: Option<Tile>,
    pub joker_assignments: HashMap<usize, Tile>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
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
        let base_tile = tiles
            .iter()
            .find(|t| !t.is_joker())
            .ok_or(MeldError::AllJokers)?;

        for (idx, tile) in tiles.iter().enumerate() {
            if tile.is_joker() {
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
        self.tiles.len()
    }

    pub fn validate(&self) -> Result<(), MeldError> {
        if self.tiles.len() != self.meld_type.tile_count() {
            return Err(MeldError::WrongTileCount);
        }
        let base_tile = self
            .tiles
            .iter()
            .find(|t| !t.is_joker())
            .ok_or(MeldError::AllJokers)?;
        for tile in &self.tiles {
            if !tile.is_joker() && tile != base_tile {
                return Err(MeldError::MismatchedTiles);
            }
        }
        Ok(())
    }

    pub fn can_exchange_joker(&self, replacement: Tile) -> bool {
        let has_joker = self.tiles.iter().any(|t| t.is_joker());
        if !has_joker {
            return false;
        }
        let base_tile = self
            .tiles
            .iter()
            .find(|t| !t.is_joker())
            .expect("Valid meld has base tile");
        replacement == *base_tile
    }

    pub fn exchange_joker(&mut self, replacement: Tile) -> Result<usize, MeldError> {
        if !self.can_exchange_joker(replacement) {
            return Err(MeldError::InvalidJokerExchange);
        }
        let joker_idx = self
            .tiles
            .iter()
            .position(|t| t.is_joker())
            .ok_or(MeldError::NoJokerToExchange)?;
        self.tiles[joker_idx] = replacement;
        self.joker_assignments.remove(&joker_idx);
        Ok(joker_idx)
    }
}

#[derive(Debug, Clone, Error, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
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
