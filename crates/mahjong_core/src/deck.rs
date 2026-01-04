//! Deck and Wall management for American Mahjong.
//!
//! The standard deck contains 152 tiles:
//! - 3 numbered suits (Dots, Bams, Cracks) with ranks 1-9, 4 of each = 108 tiles
//! - 4 Winds (E, S, W, N), 4 of each = 16 tiles
//! - 3 Dragons (G, R, W), 4 of each = 12 tiles
//! - 8 Flowers = 8 tiles
//! - 8 Jokers = 8 tiles

use crate::tile::{Tile, BAM_START, CRAK_START, DOT_START, WIND_START, DRAGON_START, FLOWER_INDEX, JOKER_INDEX, BLANK_INDEX};
use rand::seq::SliceRandom;
use rand::SeedableRng;
use serde::{Deserialize, Serialize};

/// The complete set of tiles used in American Mahjong.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deck {
    pub tiles: Vec<Tile>,
}

impl Deck {
    pub fn new() -> Self {
        Self::new_with_blanks(false)
    }

    pub fn new_with_blanks(include_blanks: bool) -> Self {
        let capacity = if include_blanks { 160 } else { 152 };
        let mut tiles = Vec::with_capacity(capacity);

        // Suited tiles (Bams, Craks, Dots) - 4 each
        for i in BAM_START..=26 {
            for _ in 0..4 {
                tiles.push(Tile(i));
            }
        }

        // Winds - 4 each
        for i in WIND_START..=30 {
            for _ in 0..4 {
                tiles.push(Tile(i));
            }
        }

        // Dragons - 4 each
        for i in DRAGON_START..=33 {
            for _ in 0..4 {
                tiles.push(Tile(i));
            }
        }

        // 8 Flowers
        for _ in 0..8 {
            tiles.push(Tile(FLOWER_INDEX));
        }

        // 8 Jokers
        for _ in 0..8 {
            tiles.push(Tile(JOKER_INDEX));
        }

        // 8 Blanks
        if include_blanks {
            for _ in 0..8 {
                tiles.push(Tile(BLANK_INDEX));
            }
        }

        Deck { tiles }
    }

    pub fn shuffle_with_seed(&mut self, seed: u64) {
        let mut rng = rand::rngs::SmallRng::seed_from_u64(seed);
        self.tiles.shuffle(&mut rng);
    }

    pub fn shuffle(&mut self) {
        #[cfg(test)]
        self.shuffle_with_seed(0);
        
        #[cfg(not(test))]
        {
            let mut rng = rand::thread_rng();
            self.tiles.shuffle(&mut rng);
        }
    }
}

impl Default for Deck {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wall {
    tiles: Vec<Tile>,
    dead_wall_size: usize,
}

impl Wall {
    pub fn from_deck(deck: Deck, break_point: usize) -> Self {
        Wall {
            tiles: deck.tiles,
            dead_wall_size: break_point * 2,
        }
    }

    pub fn from_deck_with_seed(seed: u64, break_point: usize) -> Self {
        let mut deck = Deck::new();
        deck.shuffle_with_seed(seed);
        Self::from_deck(deck, break_point)
    }

    pub fn draw(&mut self) -> Option<Tile> {
        if self.tiles.len() <= self.dead_wall_size {
            return None;
        }
        self.tiles.pop()
    }

    pub fn remaining(&self) -> usize { self.tiles.len().saturating_sub(self.dead_wall_size) }

    pub fn total_tiles(&self) -> usize {
        self.tiles.len()
    }

    pub fn deal_initial(&mut self) -> Result<[Vec<Tile>; 4], DeckError> {
        const TOTAL_NEEDED: usize = 4 * 13 + 1;
        if self.remaining() < TOTAL_NEEDED {
            return Err(DeckError::NotEnoughTiles);
        }

        let mut hands: [Vec<Tile>; 4] = [
            Vec::with_capacity(14),
            Vec::with_capacity(13),
            Vec::with_capacity(13),
            Vec::with_capacity(13),
        ];

        for _ in 0..3 {
            for hand in hands.iter_mut() {
                for _ in 0..4 {
                    hand.push(self.draw().ok_or(DeckError::NotEnoughTiles)?);
                }
            }
        }

        hands[0].push(self.draw().ok_or(DeckError::NotEnoughTiles)?);
        hands[1].push(self.draw().ok_or(DeckError::NotEnoughTiles)?);
        hands[2].push(self.draw().ok_or(DeckError::NotEnoughTiles)?);
        hands[0].push(self.draw().ok_or(DeckError::NotEnoughTiles)?);
        hands[3].push(self.draw().ok_or(DeckError::NotEnoughTiles)?);

        Ok(hands)
    }
}

#[derive(Debug, Clone, thiserror::Error, Serialize, Deserialize)]
pub enum DeckError {
    #[error("Not enough tiles")]
    NotEnoughTiles,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deck_counts() {
        let deck = Deck::new();
        assert_eq!(deck.tiles.len(), 152);
        
        let mut counts = [0u8; 37];
        for t in &deck.tiles {
            counts[t.0 as usize] += 1;
        }
        
        assert_eq!(counts[0], 4); // 1 Bam
        assert_eq!(counts[34], 8); // Flowers
        assert_eq!(counts[35], 8); // Jokers
    }
}
