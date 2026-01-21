//! Tile identifiers and helpers for American Mahjong.

use serde::{Deserialize, Serialize};
use std::fmt;
use ts_rs::TS;

/// The total number of unique tile types (0-36).
pub const TILE_COUNT: usize = 37;

// Index Ranges
pub const BAM_START: u8 = 0;
pub const CRAK_START: u8 = 9;
pub const DOT_START: u8 = 18;
pub const WIND_START: u8 = 27;
pub const DRAGON_START: u8 = 31;
pub const FLOWER_INDEX: u8 = 34;
pub const JOKER_INDEX: u8 = 35;
pub const BLANK_INDEX: u8 = 36;

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
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct Tile(pub u8);

impl Tile {
    /// Create a tile from a raw ID.
    ///
    /// # Panics
    /// Panics if the ID is outside the valid range 0..=36.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::tile::Tile;
    ///
    /// let tile = Tile::new(0);
    /// assert!(tile.is_bam());
    /// ```
    pub fn new(id: u8) -> Self {
        assert!(id < TILE_COUNT as u8, "Invalid tile ID: {}", id);
        Self(id)
    }

    // --- Type Checks ---

    /// Returns true if the tile is a suited tile (Bam/Crak/Dot).
    pub fn is_suited(&self) -> bool {
        self.0 <= 26
    }

    /// Returns true if the tile is a Bam.
    pub fn is_bam(&self) -> bool {
        self.0 < CRAK_START // BAM_START is 0, so >= 0 is always true for u8
    }

    /// Returns true if the tile is a Crak.
    pub fn is_crak(&self) -> bool {
        self.0 >= CRAK_START && self.0 < DOT_START
    }

    /// Returns true if the tile is a Dot.
    pub fn is_dot(&self) -> bool {
        self.0 >= DOT_START && self.0 < WIND_START
    }

    /// Returns true if the tile is a Wind.
    pub fn is_wind(&self) -> bool {
        self.0 >= WIND_START && self.0 < DRAGON_START
    }

    /// Returns true if the tile is a Dragon.
    pub fn is_dragon(&self) -> bool {
        self.0 >= DRAGON_START && self.0 < FLOWER_INDEX
    }

    /// Returns true if the tile is a Flower.
    pub fn is_flower(&self) -> bool {
        self.0 == FLOWER_INDEX
    }

    /// Returns true if the tile is a Joker.
    pub fn is_joker(&self) -> bool {
        self.0 == JOKER_INDEX
    }

    /// Returns true if the tile is a Blank (house rule).
    pub fn is_blank(&self) -> bool {
        self.0 == BLANK_INDEX
    }

    // --- Semantic Getters ---

    /// Returns the rank (1-9) for suited tiles. Returns None for others.
    pub fn rank(&self) -> Option<u8> {
        if self.is_suited() {
            Some((self.0 % 9) + 1)
        } else {
            None
        }
    }

    /// Returns the suit name for display.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::tile::tiles::CRAK_2;
    ///
    /// assert_eq!(CRAK_2.suit_name(), "Cracks");
    /// ```
    pub fn suit_name(&self) -> &'static str {
        if self.is_bam() {
            "Bams"
        } else if self.is_crak() {
            "Cracks"
        } else if self.is_dot() {
            "Dots"
        } else if self.is_wind() {
            "Winds"
        } else if self.is_dragon() {
            "Dragons"
        } else if self.is_flower() {
            "Flowers"
        } else if self.is_joker() {
            "Jokers"
        } else {
            "Blanks"
        }
    }

    /// Returns a human-readable name (e.g., "1 Bam", "East Wind").
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::tile::tiles::EAST;
    ///
    /// assert_eq!(EAST.display_name(), "East Wind");
    /// ```
    pub fn display_name(&self) -> String {
        match self.0 {
            0..=8 => format!("{} Bam", (self.0 - BAM_START) + 1),
            9..=17 => format!("{} Crak", (self.0 - CRAK_START) + 1),
            18..=26 => format!("{} Dot", (self.0 - DOT_START) + 1),
            27 => "East Wind".to_string(),
            28 => "South Wind".to_string(),
            29 => "West Wind".to_string(),
            30 => "North Wind".to_string(),
            31 => "Green Dragon".to_string(),
            32 => "Red Dragon".to_string(),
            33 => "White Dragon (Soap)".to_string(),
            34 => "Flower".to_string(),
            35 => "Joker".to_string(),
            36 => "Blank".to_string(),
            _ => "Unknown Tile".to_string(),
        }
    }
}

impl fmt::Display for Tile {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.display_name())
    }
}

/// Helper constants for easy use in code.
pub mod tiles {
    use super::Tile;
    pub const BAM_1: Tile = Tile(0);
    pub const BAM_2: Tile = Tile(1);
    pub const BAM_3: Tile = Tile(2);
    pub const BAM_4: Tile = Tile(3);
    pub const BAM_5: Tile = Tile(4);
    pub const BAM_6: Tile = Tile(5);
    pub const BAM_7: Tile = Tile(6);
    pub const BAM_8: Tile = Tile(7);
    pub const BAM_9: Tile = Tile(8);

    pub const CRAK_1: Tile = Tile(9);
    pub const CRAK_2: Tile = Tile(10);
    pub const CRAK_3: Tile = Tile(11);
    pub const CRAK_4: Tile = Tile(12);
    pub const CRAK_5: Tile = Tile(13);
    pub const CRAK_6: Tile = Tile(14);
    pub const CRAK_7: Tile = Tile(15);
    pub const CRAK_8: Tile = Tile(16);
    pub const CRAK_9: Tile = Tile(17);

    pub const DOT_1: Tile = Tile(18);
    pub const DOT_2: Tile = Tile(19);
    pub const DOT_3: Tile = Tile(20);
    pub const DOT_4: Tile = Tile(21);
    pub const DOT_5: Tile = Tile(22);
    pub const DOT_6: Tile = Tile(23);
    pub const DOT_7: Tile = Tile(24);
    pub const DOT_8: Tile = Tile(25);
    pub const DOT_9: Tile = Tile(26);

    pub const EAST: Tile = Tile(27);
    pub const SOUTH: Tile = Tile(28);
    pub const WEST: Tile = Tile(29);
    pub const NORTH: Tile = Tile(30);

    pub const GREEN: Tile = Tile(31);
    pub const RED: Tile = Tile(32);
    pub const WHITE: Tile = Tile(33);

    pub const FLOWER: Tile = Tile(34);
    pub const JOKER: Tile = Tile(35);
    pub const BLANK: Tile = Tile(36);
}
