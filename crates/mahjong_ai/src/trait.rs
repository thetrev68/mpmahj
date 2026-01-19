//! MahjongAI trait definition and difficulty levels.

use crate::context::VisibleTiles;
use mahjong_core::bot::BasicBot;
use mahjong_core::flow::{CharlestonStage, CharlestonVote};
use mahjong_core::hand::Hand;
use mahjong_core::meld::MeldType;
use mahjong_core::player::Seat;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// AI difficulty levels.
///
/// FRONTEND_INTEGRATION_POINT: This enum is exposed to clients via TypeScript bindings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum Difficulty {
    /// Easy: Random decisions (strategically void)
    Easy,

    /// Medium: Uses BasicBot from mahjong_core (simple heuristics)
    Medium,

    /// Hard: Greedy EV maximization (no lookahead)
    Hard,

    /// Expert: MCTS with 10,000 iterations (Deep search)
    Expert,
}

impl Difficulty {
    /// Get MCTS iteration count for this difficulty.
    pub fn mcts_iterations(&self) -> usize {
        match self {
            Difficulty::Easy => 0,
            Difficulty::Medium => 0,
            Difficulty::Hard => 0, // Greedy doesn't use MCTS
            Difficulty::Expert => 10_000,
        }
    }

    /// Should this difficulty use MCTS?
    pub fn uses_mcts(&self) -> bool {
        matches!(self, Difficulty::Expert)
    }
}

/// Trait for AI decision-making strategies.
///
/// All AI implementations (BasicBot, GreedyAI, ExpertAI) implement this trait,
/// making them interchangeable in the game loop.
pub trait MahjongAI: Send + Sync {
    /// Select tiles to pass during Charleston.
    ///
    /// # Arguments
    /// * `hand` - Current hand before passing
    /// * `stage` - Which Charleston stage (FirstRight, FirstAcross, etc.)
    /// * `visible` - Tiles visible to all players
    /// * `validator` - Validation engine for pattern analysis
    ///
    /// # Returns
    /// Vec of exactly 3 tiles to pass (must not include Jokers)
    fn select_charleston_tiles(
        &mut self,
        hand: &Hand,
        stage: CharlestonStage,
        visible: &VisibleTiles,
        validator: &HandValidator,
    ) -> Vec<Tile>;

    /// Vote to continue or stop Charleston after first Charleston.
    ///
    /// # Arguments
    /// * `hand` - Current hand after first Charleston
    /// * `visible` - Tiles visible to all players
    /// * `validator` - Validation engine
    ///
    /// # Returns
    /// Vote::Continue or Vote::Stop
    fn vote_charleston(
        &mut self,
        hand: &Hand,
        visible: &VisibleTiles,
        validator: &HandValidator,
    ) -> CharlestonVote;

    /// Select which tile to discard from hand after drawing.
    ///
    /// # Arguments
    /// * `hand` - Current hand (14 tiles after drawing)
    /// * `visible` - Tiles visible to all players
    /// * `validator` - Validation engine
    ///
    /// # Returns
    /// The tile to discard (must be in hand)
    fn select_discard(
        &mut self,
        hand: &Hand,
        visible: &VisibleTiles,
        validator: &HandValidator,
    ) -> Tile;

    /// Decide whether to call a discarded tile.
    ///
    /// # Arguments
    /// * `hand` - Current hand (13 tiles)
    /// * `discard` - The tile that was just discarded
    /// * `call_type` - Type of meld this would create (Pung/Kong/Quint/Mahjong)
    /// * `visible` - Tiles visible to all players
    /// * `validator` - Validation engine
    /// * `turn_number` - Current turn number (for phase-aware decisions)
    /// * `discarded_by` - Seat of player who discarded
    /// * `current_seat` - This AI's seat
    ///
    /// # Returns
    /// true if should call, false otherwise
    #[allow(clippy::too_many_arguments)]
    fn should_call(
        &mut self,
        hand: &Hand,
        discard: Tile,
        call_type: MeldType,
        visible: &VisibleTiles,
        validator: &HandValidator,
        turn_number: u32,
        discarded_by: Seat,
        current_seat: Seat,
    ) -> bool;
}

/// Create an AI player of specified difficulty.
///
/// # Arguments
/// * `difficulty` - AI difficulty level
/// * `seed` - Random seed for reproducibility
///
/// # Returns
/// Boxed trait object implementing MahjongAI
pub fn create_ai(difficulty: Difficulty, seed: u64) -> Box<dyn MahjongAI> {
    match difficulty {
        Difficulty::Easy => Box::new(crate::strategies::random::RandomAI::new(seed)),
        Difficulty::Medium => Box::new(BasicBotAI::new(seed)),
        Difficulty::Hard => Box::new(crate::strategies::greedy::GreedyAI::new(seed)),
        Difficulty::Expert => Box::new(crate::strategies::mcts_ai::MCTSAI::new(10_000, seed)),
    }
}

/// Adapter that wraps the mahjong_core BasicBot for MahjongAI usage.
struct BasicBotAI {
    /// Delegated mahjong_core AI instance.
    bot: BasicBot,
}

impl BasicBotAI {
    /// Builds a BasicBotAI with the default rules card.
    fn new(_seed: u64) -> Self {
        let card = load_default_card();
        Self {
            bot: BasicBot::new(&card),
        }
    }
}

impl MahjongAI for BasicBotAI {
    fn select_charleston_tiles(
        &mut self,
        hand: &Hand,
        _stage: CharlestonStage,
        _visible: &VisibleTiles,
        _validator: &HandValidator,
    ) -> Vec<Tile> {
        self.bot.choose_charleston_tiles(hand)
    }

    fn vote_charleston(
        &mut self,
        hand: &Hand,
        _visible: &VisibleTiles,
        validator: &HandValidator,
    ) -> CharlestonVote {
        let best = validator.analyze(hand, 1);
        let deficiency = best.first().map(|r| r.deficiency).unwrap_or(i32::MAX);
        if deficiency <= 4 {
            CharlestonVote::Stop
        } else {
            CharlestonVote::Continue
        }
    }

    fn select_discard(
        &mut self,
        hand: &Hand,
        _visible: &VisibleTiles,
        _validator: &HandValidator,
    ) -> Tile {
        self.bot.choose_discard(hand)
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
        self.bot
            .should_call(hand, discard)
            .map(|meld| meld.meld_type == call_type)
            .unwrap_or(false)
    }
}

/// Loads the bundled unified card for BasicBot decisions.
fn load_default_card() -> UnifiedCard {
    let json = crate::test_utils::load_test_card_json();
    UnifiedCard::from_json(json).expect("Load unified card")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_bindings_difficulty() {
        Difficulty::export().expect("Failed to export Difficulty");
    }
}
