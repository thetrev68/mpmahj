//! Randomized AI strategy for baseline behavior.

use crate::context::VisibleTiles;
use crate::r#trait::MahjongAI;
use mahjong_core::flow::charleston::{CharlestonStage, CharlestonVote};
use mahjong_core::hand::Hand;
use mahjong_core::meld::MeldType;
use mahjong_core::player::Seat;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;
use rand::prelude::SliceRandom;
use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha8Rng;

/// A purely random AI that makes legally valid but strategically void decisions.
pub struct RandomAI {
    /// RNG used to select random tiles and decisions.
    rng: ChaCha8Rng,
}

impl RandomAI {
    /// Create a new RandomAI with a deterministic seed.
    pub fn new(seed: u64) -> Self {
        Self {
            rng: ChaCha8Rng::seed_from_u64(seed),
        }
    }
}

impl MahjongAI for RandomAI {
    fn select_charleston_tiles(
        &mut self,
        hand: &Hand,
        _stage: CharlestonStage,
        _visible: &VisibleTiles,
        _validator: &HandValidator,
    ) -> Vec<Tile> {
        // Filter out jokers; Charleston cannot pass jokers
        let non_jokers: Vec<Tile> = hand
            .concealed
            .iter()
            .filter(|t| !t.is_joker())
            .cloned()
            .collect();

        // Return up to 3 non-joker tiles (may be fewer if hand is mostly jokers)
        let count = non_jokers.len().min(3);
        non_jokers
            .choose_multiple(&mut self.rng, count)
            .cloned()
            .collect()
    }

    fn vote_charleston(
        &mut self,
        _hand: &Hand,
        _visible: &VisibleTiles,
        _validator: &HandValidator,
    ) -> CharlestonVote {
        // Randomly vote continue or stop
        if self.rng.gen_bool(0.5) {
            CharlestonVote::Continue
        } else {
            CharlestonVote::Stop
        }
    }

    fn select_discard(
        &mut self,
        hand: &Hand,
        _visible: &VisibleTiles,
        _validator: &HandValidator,
    ) -> Tile {
        // Prefer discarding non-jokers; jokers are valuable wildcards
        let non_jokers: Vec<&Tile> = hand.concealed.iter().filter(|t| !t.is_joker()).collect();
        if let Some(tile) = non_jokers.choose(&mut self.rng) {
            **tile
        } else {
            // Hand is all jokers; must discard one
            *hand
                .concealed
                .choose(&mut self.rng)
                .expect("Hand should not be empty")
        }
    }

    fn should_call(
        &mut self,
        hand: &Hand,
        discard: Tile,
        call_type: MeldType,
        _visible: &VisibleTiles,
        _validator: &HandValidator,
        _turn_number: u32,
        _discarded_by: Seat,
        _current_seat: Seat,
    ) -> bool {
        // Don't call jokers (can't be called)
        if discard.is_joker() {
            return false;
        }

        // Check if we can form this specific meld type
        let natural_count = hand.count_tile(discard);
        let required = match call_type {
            MeldType::Pung => 2,
            MeldType::Kong => 3,
            MeldType::Quint => 4,
        };

        if natural_count < required {
            return false;
        }

        // Legal call - randomly decide (10% chance to reduce chaos)
        self.rng.gen_bool(0.1)
    }
}
