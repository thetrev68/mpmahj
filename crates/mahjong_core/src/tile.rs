//! Tile identifiers and helpers for American Mahjong.

use serde::{Deserialize, Serialize};
use std::fmt;
use ts_rs::TS;

/// The total number of unique tile types (0-43).
/// Includes 8 distinct flower tiles for rendering purposes.
pub const TILE_COUNT: usize = 44;

/// The size of histogram arrays used for pattern validation.
/// Flowers are normalized to index 34 in histograms.
pub const HISTOGRAM_SIZE: usize = 42;

// ============ Index Ranges (Tile ID space: 0-43) ============

/// Start of Bam suit tile IDs (0-8: Bam 1-9)
pub const BAM_START: u8 = 0;
/// Start of Crack suit tile IDs (9-17: Crack 1-9)
pub const CRAK_START: u8 = 9;
/// Start of Dot suit tile IDs (18-26: Dot 1-9)
pub const DOT_START: u8 = 18;
/// Start of Wind tile IDs (27-30: East, South, West, North)
pub const WIND_START: u8 = 27;
/// Start of Dragon tile IDs (31-33: Green, Red, White/Soap)
pub const DRAGON_START: u8 = 31;

// ============ Flower Tiles (8 distinct variants for rendering) ============

/// Flower tile 1 ID (normalizes to histogram index 34)
pub const FLOWER_1_INDEX: u8 = 34;
/// Flower tile 2 ID (normalizes to histogram index 34)
pub const FLOWER_2_INDEX: u8 = 35;
/// Flower tile 3 ID (normalizes to histogram index 34)
pub const FLOWER_3_INDEX: u8 = 36;
/// Flower tile 4 ID (normalizes to histogram index 34)
pub const FLOWER_4_INDEX: u8 = 37;
/// Flower tile 5 ID (normalizes to histogram index 34)
pub const FLOWER_5_INDEX: u8 = 38;
/// Flower tile 6 ID (normalizes to histogram index 34)
pub const FLOWER_6_INDEX: u8 = 39;
/// Flower tile 7 ID (normalizes to histogram index 34)
pub const FLOWER_7_INDEX: u8 = 40;
/// Flower tile 8 ID (normalizes to histogram index 34)
pub const FLOWER_8_INDEX: u8 = 41;
/// Start of flower tile ID range (34-41)
pub const FLOWER_START: u8 = 34;
/// End of flower tile ID range (34-41)
pub const FLOWER_END: u8 = 41;

/// Legacy constant for backward compatibility (same as FLOWER_1_INDEX)
pub const FLOWER_INDEX: u8 = 34;

// ============ Non-Suited Tiles ============

/// Joker tile ID (wild tile, can substitute for any tile in a set)
pub const JOKER_INDEX: u8 = 42;
/// Blank tile ID (house rule, used in optional variations)
pub const BLANK_INDEX: u8 = 43;

/// A high-performance Tile primitive represented as a single byte (0-43).
///
/// Mapping:
/// - 0-8:   Bams (1-9)
/// - 9-17:  Cracks (1-9)
/// - 18-26: Dots (1-9)
/// - 27-30: Winds (East, South, West, North)
/// - 31-33: Dragons (Green, Red, White/Soap)
/// - 34-41: Flowers (8 distinct variants for rendering)
/// - 42:    Joker
/// - 43:    Blank (House Rule)
///
/// Note: For histogram-based validation, all flower variants (34-41) are
/// normalized to index 34 in the histogram space.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct Tile(pub u8);

impl Tile {
    /// Create a tile from a raw ID.
    ///
    /// # Panics
    /// Panics if the ID is outside the valid range 0..=43.
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

    /// Convert a tile ID to its histogram index for pattern validation.
    ///
    /// Flowers (34-41) are normalized to index 34.
    /// Joker (42) maps to index 35.
    /// Blank (43) maps to index 36.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::tile::Tile;
    ///
    /// let flower1 = Tile::new(34);
    /// let flower8 = Tile::new(41);
    /// assert_eq!(flower1.to_histogram_index(), 34);
    /// assert_eq!(flower8.to_histogram_index(), 34); // Normalized to same index
    /// ```
    pub fn to_histogram_index(&self) -> usize {
        match self.0 {
            0..=33 => self.0 as usize,
            34..=41 => 34, // All flowers normalize to index 34
            42 => 35,      // Joker
            43 => 36,      // Blank
            _ => panic!("Invalid tile ID: {}", self.0),
        }
    }

    /// Get the flower variant number (1-8) if this is a flower tile.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::tile::Tile;
    ///
    /// let flower1 = Tile::new(34);
    /// assert_eq!(flower1.flower_variant(), Some(1));
    /// let flower8 = Tile::new(41);
    /// assert_eq!(flower8.flower_variant(), Some(8));
    /// ```
    pub fn flower_variant(&self) -> Option<u8> {
        if self.is_flower() {
            Some(self.0 - FLOWER_START + 1)
        } else {
            None
        }
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
        self.0 >= DRAGON_START && self.0 < FLOWER_START
    }

    /// Returns true if the tile is a Flower (any of the 8 variants).
    pub fn is_flower(&self) -> bool {
        self.0 >= FLOWER_START && self.0 <= FLOWER_END
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
            34..=41 => format!("Flower {}", self.0 - FLOWER_START + 1),
            42 => "Joker".to_string(),
            43 => "Blank".to_string(),
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
    /// `1 Bam` tile (`0`).
    pub const BAM_1: Tile = Tile(0);
    /// `2 Bam` tile (`1`).
    pub const BAM_2: Tile = Tile(1);
    /// `3 Bam` tile (`2`).
    pub const BAM_3: Tile = Tile(2);
    /// `4 Bam` tile (`3`).
    pub const BAM_4: Tile = Tile(3);
    /// `5 Bam` tile (`4`).
    pub const BAM_5: Tile = Tile(4);
    /// `6 Bam` tile (`5`).
    pub const BAM_6: Tile = Tile(5);
    /// `7 Bam` tile (`6`).
    pub const BAM_7: Tile = Tile(6);
    /// `8 Bam` tile (`7`).
    pub const BAM_8: Tile = Tile(7);
    /// `9 Bam` tile (`8`).
    pub const BAM_9: Tile = Tile(8);

    /// `1 Crak` tile (`9`).
    pub const CRAK_1: Tile = Tile(9);
    /// `2 Crak` tile (`10`).
    pub const CRAK_2: Tile = Tile(10);
    /// `3 Crak` tile (`11`).
    pub const CRAK_3: Tile = Tile(11);
    /// `4 Crak` tile (`12`).
    pub const CRAK_4: Tile = Tile(12);
    /// `5 Crak` tile (`13`).
    pub const CRAK_5: Tile = Tile(13);
    /// `6 Crak` tile (`14`).
    pub const CRAK_6: Tile = Tile(14);
    /// `7 Crak` tile (`15`).
    pub const CRAK_7: Tile = Tile(15);
    /// `8 Crak` tile (`16`).
    pub const CRAK_8: Tile = Tile(16);
    /// `9 Crak` tile (`17`).
    pub const CRAK_9: Tile = Tile(17);

    /// `1 Dot` tile (`18`).
    pub const DOT_1: Tile = Tile(18);
    /// `2 Dot` tile (`19`).
    pub const DOT_2: Tile = Tile(19);
    /// `3 Dot` tile (`20`).
    pub const DOT_3: Tile = Tile(20);
    /// `4 Dot` tile (`21`).
    pub const DOT_4: Tile = Tile(21);
    /// `5 Dot` tile (`22`).
    pub const DOT_5: Tile = Tile(22);
    /// `6 Dot` tile (`23`).
    pub const DOT_6: Tile = Tile(23);
    /// `7 Dot` tile (`24`).
    pub const DOT_7: Tile = Tile(24);
    /// `8 Dot` tile (`25`).
    pub const DOT_8: Tile = Tile(25);
    /// `9 Dot` tile (`26`).
    pub const DOT_9: Tile = Tile(26);

    /// East wind tile (`27`).
    pub const EAST: Tile = Tile(27);
    /// South wind tile (`28`).
    pub const SOUTH: Tile = Tile(28);
    /// West wind tile (`29`).
    pub const WEST: Tile = Tile(29);
    /// North wind tile (`30`).
    pub const NORTH: Tile = Tile(30);

    /// Green dragon tile (`31`).
    pub const GREEN: Tile = Tile(31);
    /// Red dragon tile (`32`).
    pub const RED: Tile = Tile(32);
    /// White dragon (soap) tile (`33`).
    pub const WHITE: Tile = Tile(33);

    // 8 distinct flower tiles
    /// Flower variant 1 (`34`).
    pub const FLOWER_1: Tile = Tile(34);
    /// Flower variant 2 (`35`).
    pub const FLOWER_2: Tile = Tile(35);
    /// Flower variant 3 (`36`).
    pub const FLOWER_3: Tile = Tile(36);
    /// Flower variant 4 (`37`).
    pub const FLOWER_4: Tile = Tile(37);
    /// Flower variant 5 (`38`).
    pub const FLOWER_5: Tile = Tile(38);
    /// Flower variant 6 (`39`).
    pub const FLOWER_6: Tile = Tile(39);
    /// Flower variant 7 (`40`).
    pub const FLOWER_7: Tile = Tile(40);
    /// Flower variant 8 (`41`).
    pub const FLOWER_8: Tile = Tile(41);

    // Legacy alias for backward compatibility
    /// Legacy alias for [`FLOWER_1`].
    pub const FLOWER: Tile = FLOWER_1;

    /// Joker tile (`42`).
    pub const JOKER: Tile = Tile(42);
    /// Blank tile (`43`) used by optional house rules.
    pub const BLANK: Tile = Tile(43);
}
