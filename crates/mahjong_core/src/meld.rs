//! Meld representation and validation helpers.

use crate::tile::Tile;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use ts_rs::TS;

/// A called or exposed meld (Pung, Kong, or Quint).
///
/// # Examples
/// ```
/// use mahjong_core::meld::{Meld, MeldType};
/// use mahjong_core::tile::tiles::DOT_2;
///
/// let meld = Meld::new(MeldType::Pung, vec![DOT_2, DOT_2, DOT_2], Some(DOT_2)).unwrap();
/// assert_eq!(meld.tile_count(), 3);
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct Meld {
    /// Pung, Kong, or Quint.
    pub meld_type: MeldType,
    /// Tiles in the meld, including jokers.
    pub tiles: Vec<Tile>,
    /// The tile that was called, if any.
    pub called_tile: Option<Tile>,
    /// Joker substitutions recorded by position.
    pub joker_assignments: HashMap<usize, Tile>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum MeldType {
    /// Three identical tiles.
    Pung,
    /// Four identical tiles.
    Kong,
    /// Five identical tiles (house rule).
    Quint,
    /// Six identical tiles (house rule).
    Sextet,
}

impl MeldType {
    /// Number of tiles required for this meld type.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::meld::MeldType;
    ///
    /// assert_eq!(MeldType::Kong.tile_count(), 4);
    /// assert_eq!(MeldType::Sextet.tile_count(), 6);
    /// ```
    pub fn tile_count(&self) -> usize {
        match self {
            MeldType::Pung => 3,
            MeldType::Kong => 4,
            MeldType::Quint => 5,
            MeldType::Sextet => 6,
        }
    }
}

impl Meld {
    /// Construct a meld with automatic joker assignments.
    ///
    /// Per NMJL rules, melds are allowed with zero natural tiles (all jokers).
    /// When a `called_tile` is provided, it serves as the base for joker substitutions.
    /// If no natural tiles exist and no `called_tile` is provided, joker assignments remain empty,
    /// disallowing future joker exchanges for that meld.
    ///
    /// # Errors
    /// Returns `MeldError::WrongTileCount` if the tile count does not match the meld type.
    /// Returns `MeldError::MismatchedTiles` if non-joker tiles do not all match.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::meld::{Meld, MeldType};
    /// use mahjong_core::tile::tiles::{DOT_5, JOKER};
    ///
    /// let meld = Meld::new(MeldType::Pung, vec![DOT_5, DOT_5, JOKER], Some(DOT_5)).unwrap();
    /// assert_eq!(meld.joker_assignments.len(), 1);
    ///
    /// // All-joker meld with called_tile
    /// let all_joker_meld = Meld::new(MeldType::Pung, vec![JOKER, JOKER, JOKER], Some(DOT_5)).unwrap();
    /// assert_eq!(all_joker_meld.joker_assignments.len(), 3);
    ///
    /// // All-joker meld without called_tile (no joker exchanges possible)
    /// let all_joker_no_base = Meld::new(MeldType::Pung, vec![JOKER, JOKER, JOKER], None).unwrap();
    /// assert_eq!(all_joker_no_base.joker_assignments.len(), 0);
    /// ```
    pub fn new(
        meld_type: MeldType,
        tiles: Vec<Tile>,
        called_tile: Option<Tile>,
    ) -> Result<Self, MeldError> {
        let mut joker_assignments = HashMap::new();

        // Determine base tile: prefer natural tiles, fallback to called_tile
        let base_tile = tiles
            .iter()
            .find(|t| !t.is_joker())
            .or(called_tile.as_ref());

        // Assign jokers based on base tile if available
        if let Some(&base) = base_tile {
            for (idx, tile) in tiles.iter().enumerate() {
                if tile.is_joker() {
                    joker_assignments.insert(idx, base);
                }
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

    /// Count tiles in the meld.
    pub fn tile_count(&self) -> usize {
        self.tiles.len()
    }

    /// Validate tile count and that all non-jokers match.
    ///
    /// Per NMJL rules, this validation allows melds with zero natural tiles (all jokers).
    /// Non-joker tiles must all match the base tile, and the meld must contain
    /// the correct number of tiles for its type.
    ///
    /// # Errors
    /// Returns `MeldError::WrongTileCount` if tile count does not match meld type.
    /// Returns `MeldError::MismatchedTiles` if non-joker tiles do not all match.
    pub fn validate(&self) -> Result<(), MeldError> {
        if self.tiles.len() != self.meld_type.tile_count() {
            return Err(MeldError::WrongTileCount);
        }

        // Get all non-joker tiles
        let non_jokers: Vec<&Tile> = self.tiles.iter().filter(|t| !t.is_joker()).collect();

        // If there are non-jokers, they must all match
        if !non_jokers.is_empty() {
            let base_tile = non_jokers[0];
            for tile in &non_jokers {
                if tile != &base_tile {
                    return Err(MeldError::MismatchedTiles);
                }
            }
        }
        // If all jokers, it's valid per NMJL (no error)

        Ok(())
    }

    /// Check if a joker can be exchanged for the provided replacement.
    ///
    /// Returns `true` only if:
    /// - The meld contains a joker
    /// - The replacement matches the meld's base tile (natural tile or called_tile if all-joker)
    ///
    /// For all-joker melds, a joker exchange is only possible if a `called_tile` was provided
    /// (establishing the base tile).
    pub fn can_exchange_joker(&self, replacement: Tile) -> bool {
        let has_joker = self.tiles.iter().any(|t| t.is_joker());
        if !has_joker {
            return false;
        }

        // Get base tile: natural tile if present, else called_tile
        let base_tile = self
            .tiles
            .iter()
            .find(|t| !t.is_joker())
            .or(self.called_tile.as_ref());

        if let Some(&base) = base_tile {
            replacement == base
        } else {
            // All jokers with no called_tile -> cannot exchange
            false
        }
    }

    /// Exchange a joker for a matching natural tile.
    ///
    /// # Errors
    /// Returns `MeldError::InvalidJokerExchange` if the replacement does not
    /// match the meld, or `MeldError::NoJokerToExchange` if no joker exists.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::meld::{Meld, MeldType};
    /// use mahjong_core::tile::tiles::{DOT_5, JOKER};
    ///
    /// let mut meld = Meld::new(MeldType::Pung, vec![DOT_5, DOT_5, JOKER], Some(DOT_5)).unwrap();
    /// let idx = meld.exchange_joker(DOT_5).unwrap();
    /// assert_eq!(meld.tiles[idx], DOT_5);
    /// ```
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
    /// The meld has the wrong number of tiles for its type.
    #[error("Wrong tile count")]
    WrongTileCount,
    /// Non-joker tiles do not match.
    #[error("Mismatched tiles")]
    MismatchedTiles,
    /// Replacement tile does not match the meld's base tile.
    #[error("Invalid joker exchange")]
    InvalidJokerExchange,
    /// No joker exists to exchange.
    #[error("No joker to exchange")]
    NoJokerToExchange,
}
