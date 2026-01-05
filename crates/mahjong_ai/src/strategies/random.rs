use crate::context::VisibleTiles;
use crate::r#trait::MahjongAI;
use mahjong_core::flow::{CharlestonStage, CharlestonVote};
use mahjong_core::hand::Hand;
use mahjong_core::meld::MeldType;
use mahjong_core::player::Seat;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;
use rand::prelude::SliceRandom;
use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha8Rng;

/// A purely random AI that makes legally valid but strategicially void decisions.
pub struct RandomAI {
    rng: ChaCha8Rng,
}

impl RandomAI {
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
        // Just pick 3 random tiles from the hand
        let mut tiles: Vec<Tile> = hand.concealed.to_vec();
        // Filter out jokers if they aren't allowed to be passed (assuming validator checks this,
        // but core usually enforces no jokers in charleston)
        tiles.retain(|t: &Tile| !t.is_joker());

        tiles.choose_multiple(&mut self.rng, 3).cloned().collect()
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
        // Discard a random tile
        *hand
            .concealed
            .choose(&mut self.rng)
            .expect("Hand should not be empty")
    }

    fn should_call(
        &mut self,
        _hand: &Hand,
        _discard: Tile,
        _call_type: MeldType,
        _visible: &VisibleTiles,
        _validator: &HandValidator,
        _turn_number: u32,
        _discarded_by: Seat,
        _current_seat: Seat,
    ) -> bool {
        // Randomly decide to call (10% chance to reduce chaos)
        self.rng.gen_bool(0.1)
    }
}
