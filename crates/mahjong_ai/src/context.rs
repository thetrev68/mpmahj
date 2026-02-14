//! Game context structures for AI decision-making.
//!
//! This module provides data structures that represent the visible game state from an AI perspective:
//! what tiles are known to be unavailable (discards, exposed melds) and what remains in the wall.
//!
//! # Primary Type: VisibleTiles
//!
//! [`VisibleTiles`] tracks all information an AI can observe:
//! - **Histogram**: Count of each known-unavailable tile (for probability calculations)
//! - **Discard pile**: Ordered sequence of played tiles (for patterns like "last 3 discards")
//! - **Exposed melds**: All visible opponent melds by seat
//! - **Wall depletion**: Number of tiles drawn (to estimate wall remaining)
//!
//! # Integration with Evaluation
//!
//! [`VisibleTiles`] is used by [`evaluation::StrategicEvaluation`] and [`probability`] to compute:
//! - Tile availability (how many of each tile remain in wall)
//! - Win probability (likelihood of completing patterns)
//! - Hand difficulty (scarcity of required tiles)
//!
//! # Example: AI Reasoning
//!
//! ```text
//! Hand: BAM_1 BAM_2 BAM_3 CRAK_5 CRAK_5 CRAK_5 ...
//! Pattern: "11 555 777 99 DOT"
//!
//! VisibleTiles tracks:
//! - 2 copies of BAM_1 seen in discards → only 2 remain in wall
//! - Opponent exposed CRAK_7 CRAK_8 CRAK_9 → fewer CRAK available
//! - 40 tiles already drawn → wall ~60 tiles remaining
//!
//! Result: High deficiency but many draws available → moderate win probability
//! ```

use mahjong_core::flow::charleston::{CharlestonStage, PassDirection};
use mahjong_core::hand::Hand;
use mahjong_core::meld::Meld;
use mahjong_core::player::Seat;
use mahjong_core::tile::{Tile, HISTOGRAM_SIZE};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Tracks all tiles visible to all players.
///
/// This structure maintains the AI's knowledge of the game state,
/// including discards, exposed melds, and tile availability.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisibleTiles {
    /// Count of each tile type that is known to be unavailable.
    /// Uses histogram indices (flowers normalized to index 34).
    pub counts: Vec<u8>,

    /// Tiles in the discard pile (ordered, for sequence analysis).
    pub discards: Vec<Tile>,

    /// Exposed melds by each player.
    pub exposed_melds: HashMap<Seat, Vec<Meld>>,

    /// Total tiles drawn so far (for wall depletion tracking).
    pub tiles_drawn: usize,
}

impl VisibleTiles {
    /// Create a new tracker at game start.
    pub fn new() -> Self {
        Self {
            counts: vec![0u8; HISTOGRAM_SIZE],
            discards: Vec::new(),
            exposed_melds: HashMap::new(),
            tiles_drawn: 0,
        }
    }

    /// Add a discarded tile.
    pub fn add_discard(&mut self, tile: Tile) {
        let idx = tile.to_histogram_index();
        self.counts[idx] += 1;
        self.discards.push(tile);
    }

    /// Add an exposed meld.
    pub fn add_meld(&mut self, seat: Seat, meld: Meld) {
        for tile in &meld.tiles {
            if !tile.is_joker() {
                let idx = tile.to_histogram_index();
                self.counts[idx] += 1;
            }
        }
        self.exposed_melds.entry(seat).or_default().push(meld);
    }

    /// Record that a tile was drawn from the wall.
    pub fn record_draw(&mut self) {
        self.tiles_drawn += 1;
    }

    /// Get the number of a specific tile that are visible.
    pub fn count_visible(&self, tile: Tile) -> usize {
        let idx = tile.to_histogram_index();
        self.counts[idx] as usize
    }

    /// Calculate how many of a tile remain available.
    ///
    /// Standard American Mahjong has:
    /// - 4 of each suit tile (1-9 in Bam, Crak, Dot)
    /// - 4 of each Wind (N, E, S, W)
    /// - 4 of each Dragon (R, G, W)
    /// - 8 Flowers
    /// - 8 Jokers
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_ai::context::VisibleTiles;
    /// use mahjong_core::tile::tiles::BAM_1;
    ///
    /// let mut visible = VisibleTiles::new();
    ///
    /// // At game start, all 4 copies are available
    /// assert_eq!(visible.count_available(BAM_1), 4);
    ///
    /// // After discarding 2, only 2 remain
    /// visible.add_discard(BAM_1);
    /// visible.add_discard(BAM_1);
    /// assert_eq!(visible.count_available(BAM_1), 2);
    /// ```
    pub fn count_available(&self, tile: Tile) -> usize {
        let total: usize = if tile.is_flower() || tile.is_joker() {
            8
        } else {
            4
        };
        total.saturating_sub(self.count_visible(tile))
    }

    /// Check if a tile is "dead" (all copies are visible).
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_ai::context::VisibleTiles;
    /// use mahjong_core::tile::tiles::BAM_1;
    ///
    /// let mut visible = VisibleTiles::new();
    /// assert!(!visible.is_dead(BAM_1));
    ///
    /// // After all 4 copies are discarded, tile is dead
    /// for _ in 0..4 {
    ///     visible.add_discard(BAM_1);
    /// }
    /// assert!(visible.is_dead(BAM_1));
    /// ```
    pub fn is_dead(&self, tile: Tile) -> bool {
        self.count_available(tile) == 0
    }

    /// Estimate wall depletion percentage (0.0 = full, 1.0 = empty).
    ///
    /// Used to adjust risk tolerance (play aggressively when wall is depleting).
    pub fn wall_depletion(&self) -> f64 {
        const TOTAL_TILES: usize = 152;
        const DEAD_WALL: usize = 14; // Tiles reserved by dice roll
        const DEALT_TILES: usize = 52; // 13 per player

        let drawable = TOTAL_TILES - DEAD_WALL - DEALT_TILES;
        if drawable == 0 {
            return 1.0;
        }
        self.tiles_drawn as f64 / drawable as f64
    }
}

impl Default for VisibleTiles {
    /// Creates an empty visible tile tracker.
    fn default() -> Self {
        Self::new()
    }
}

/// Contextual information available to AI during different game phases.
///
/// Different game phases have different available information and decision types.
#[derive(Debug, Clone)]
pub enum GamePhaseContext {
    /// Charleston phase (tile passing).
    Charleston {
        /// Current Charleston stage.
        stage: CharlestonStage,
        /// AI hand snapshot for this decision.
        hand: Hand,
        /// Shared visibility tracker for known tiles.
        visible: VisibleTiles,
        /// Direction of the current Charleston pass.
        pass_direction: PassDirection,
    },

    /// Main playing phase (draw and discard).
    Playing {
        /// AI hand snapshot for this decision.
        hand: Hand,
        /// Shared visibility tracker for known tiles.
        visible: VisibleTiles,
        /// Tile just drawn this turn, if any.
        drawn_tile: Option<Tile>,
        /// Turn number within the hand.
        turn_number: u32,
        /// Seat currently taking the turn.
        current_seat: Seat,
    },

    /// Call window (deciding whether to call a discard).
    CallWindow {
        /// AI hand snapshot for this decision.
        hand: Hand,
        /// Shared visibility tracker for known tiles.
        visible: VisibleTiles,
        /// Tile just discarded that can be called.
        discard: Tile,
        /// Seat that discarded the tile.
        discarded_by: Seat,
        /// Seat currently deciding whether to call.
        current_seat: Seat,
    },
}

impl GamePhaseContext {
    /// Extract the AI's current hand.
    pub fn hand(&self) -> &Hand {
        match self {
            Self::Charleston { hand, .. } => hand,
            Self::Playing { hand, .. } => hand,
            Self::CallWindow { hand, .. } => hand,
        }
    }

    /// Extract visible tiles.
    pub fn visible(&self) -> &VisibleTiles {
        match self {
            Self::Charleston { visible, .. } => visible,
            Self::Playing { visible, .. } => visible,
            Self::CallWindow { visible, .. } => visible,
        }
    }
}

#[cfg(test)]
/// Unit tests for visible tile tracking and wall depletion calculations.
mod tests {
    use super::*;
    use mahjong_core::tile::tiles::*;

    #[test]
    fn test_visible_tiles_new() {
        let visible = VisibleTiles::new();
        assert_eq!(visible.counts.len(), HISTOGRAM_SIZE);
        assert_eq!(visible.discards.len(), 0);
        assert_eq!(visible.exposed_melds.len(), 0);
        assert_eq!(visible.tiles_drawn, 0);
    }

    #[test]
    fn test_add_discard() {
        let mut visible = VisibleTiles::new();
        visible.add_discard(BAM_1);
        visible.add_discard(BAM_1);

        assert_eq!(visible.count_visible(BAM_1), 2);
        assert_eq!(visible.discards.len(), 2);
    }

    #[test]
    fn test_count_available() {
        let mut visible = VisibleTiles::new();

        // Initially all tiles available
        assert_eq!(visible.count_available(BAM_1), 4);
        assert_eq!(visible.count_available(JOKER), 8);

        // Discard 2 BAM_1
        visible.add_discard(BAM_1);
        visible.add_discard(BAM_1);

        assert_eq!(visible.count_available(BAM_1), 2);
    }

    #[test]
    fn test_is_dead() {
        let mut visible = VisibleTiles::new();

        assert!(!visible.is_dead(BAM_1));

        // Discard all 4 copies
        for _ in 0..4 {
            visible.add_discard(BAM_1);
        }

        assert!(visible.is_dead(BAM_1));
    }

    #[test]
    fn test_wall_depletion() {
        let mut visible = VisibleTiles::new();

        // No tiles drawn yet
        assert_eq!(visible.wall_depletion(), 0.0);

        // Simulate drawing half the wall
        visible.tiles_drawn = 43; // (152 - 14 - 52) / 2

        let depletion = visible.wall_depletion();
        assert!(depletion > 0.4 && depletion < 0.6);
    }
}
