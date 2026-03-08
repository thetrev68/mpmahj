//! Win detection, scoring, and game result types.
//!
//! This module defines all types related to game outcomes:
//! - Win validation and context
//! - Scoring calculations and modifiers
//! - Final game results
//! - Game end conditions (win, draw, abandonment)
//!
//! # Win Validation Flow
//!
//! ```text
//! Player declares Mahjong
//!   ↓
//! Create WinContext (winner, winning_tile, hand, win_type)
//!   ↓
//! Validate hand matches a pattern from The Card
//!   ↓
//! Calculate score with modifiers (concealed, self-draw, dealer)
//!   ↓
//! Create GameResult with final scores
//! ```
//!
//! # Examples
//!
//! ```
//! use mahjong_core::flow::outcomes::{WinType, ScoreModifiers};
//! use mahjong_core::player::Seat;
//!
//! let modifiers = ScoreModifiers {
//!     concealed: true,
//!     self_draw: true,
//!     dealer_win: false,
//! };
//!
//! let win_type = WinType::SelfDraw;
//! assert!(matches!(win_type, WinType::SelfDraw));
//! ```

use std::collections::HashMap;

use crate::hand::Hand;
use crate::player::Seat;
use crate::tile::Tile;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

// ============================================================================
// Win Context
// ============================================================================

/// Context for a win declaration that needs validation.
///
/// When a player declares Mahjong, this struct captures all the information
/// needed to validate the win and calculate scoring.
///
/// # Validation Steps
///
/// 1. Check that the hand contains exactly 14 tiles
/// 2. Verify the hand matches a pattern from The Card
/// 3. Check joker usage is valid for the pattern
/// 4. Calculate score with appropriate modifiers
///
/// # Examples
///
/// ```
/// use mahjong_core::flow::outcomes::{WinContext, WinType};
/// use mahjong_core::player::Seat;
/// use mahjong_core::hand::Hand;
/// use mahjong_core::tile::tiles::JOKER;
///
/// let hand = Hand::empty(); // Would normally have 14 tiles
/// let ctx = WinContext {
///     winner: Seat::East,
///     win_type: WinType::SelfDraw,
///     winning_tile: JOKER,
///     hand,
/// };
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct WinContext {
    /// Who declared Mahjong
    pub winner: Seat,

    /// How they won (self-draw or called discard)
    pub win_type: WinType,

    /// The winning tile (drawn or called)
    ///
    /// This is the tile that completed the hand.
    pub winning_tile: Tile,

    /// The complete winning hand (for validation)
    ///
    /// Must contain exactly 14 tiles and match a pattern from The Card.
    pub hand: Hand,
}

// ============================================================================
// Win Type
// ============================================================================

/// How a player won.
///
/// In American Mahjong, the win type affects scoring:
/// - Self-draw typically awards bonus points
/// - Called discard means the discarder pays more
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum WinType {
    /// Won by drawing the winning tile themselves
    ///
    /// Awards self-draw bonus in most rulesets.
    SelfDraw,

    /// Won by calling someone else's discard
    ///
    /// The discarder typically pays double or more.
    CalledDiscard(Seat), // Who discarded the winning tile
}

// ============================================================================
// Scoring Types
// ============================================================================

/// Scoring modifiers based on win conditions.
///
/// These modifiers affect the final score calculation:
/// - **Concealed**: No exposed melds → bonus points
/// - **Self-draw**: Drew winning tile (vs called) → bonus points
/// - **Dealer win**: Winner is East → bonus points
///
/// # Examples
///
/// ```
/// use mahjong_core::flow::outcomes::ScoreModifiers;
///
/// let modifiers = ScoreModifiers {
///     concealed: true,
///     self_draw: true,
///     dealer_win: false,
/// };
/// // This would apply both concealed and self-draw bonuses
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct ScoreModifiers {
    /// Hand was fully concealed (no exposed melds)
    pub concealed: bool,

    /// Won by self-draw (not calling someone's discard)
    pub self_draw: bool,

    /// Winner is the dealer (East)
    pub dealer_win: bool,
}

/// Per-player score breakdown.
///
/// Shows how the final score was calculated, including:
/// - Base pattern score
/// - All applicable bonuses
/// - Payment flows between players
///
/// # Examples
///
/// ```
/// use mahjong_core::flow::outcomes::ScoreBreakdown;
/// use mahjong_core::player::Seat;
/// use std::collections::HashMap;
///
/// let breakdown = ScoreBreakdown {
///     base_score: 25,
///     self_draw_bonus: 10,
///     total: 35,
///     payments: HashMap::new(),
/// };
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct ScoreBreakdown {
    /// Base score for the pattern (from The Card)
    pub base_score: i32,

    /// Bonus for self-draw (if applicable)
    pub self_draw_bonus: i32,

    /// Total score (base + all bonuses)
    pub total: i32,

    /// How much this player pays/receives from each other player
    ///
    /// Positive values = receive, negative values = pay
    pub payments: HashMap<Seat, i32>,
}

// ============================================================================
// Game Result
// ============================================================================

/// Final game results.
///
/// Contains all information about how the game ended:
/// - Winner (if any)
/// - Winning pattern
/// - Score breakdown
/// - Final scores for all players
/// - All players' final hands (for review/replay)
/// - Next dealer
/// - End condition
///
/// # Examples
///
/// ```
/// use mahjong_core::flow::outcomes::{GameResult, GameEndCondition};
/// use mahjong_core::player::Seat;
/// use std::collections::HashMap;
///
/// let result = GameResult {
///     winner: Some(Seat::East),
///     winning_pattern: Some("2468 Consecutive Run".to_string()),
///     score_breakdown: None,
///     final_scores: HashMap::new(),
///     final_hands: HashMap::new(),
///     next_dealer: Seat::South,
///     end_condition: GameEndCondition::Win,
/// };
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct GameResult {
    /// The validated winner (None if wall exhausted or abandoned)
    pub winner: Option<Seat>,

    /// The winning pattern from The Card (e.g., "2468 Consecutive Run")
    pub winning_pattern: Option<String>,

    /// Score breakdown for the winner (if any)
    pub score_breakdown: Option<ScoreBreakdown>,

    /// Final scores for all players (net gains/losses)
    pub final_scores: HashMap<Seat, i32>,

    /// Final hands of all players (for review/replay)
    pub final_hands: HashMap<Seat, Hand>,

    /// Next dealer after this game
    ///
    /// In American Mahjong, the dealer typically rotates unless East wins.
    pub next_dealer: Seat,

    /// How the game ended (win, draw, or abandonment)
    pub end_condition: GameEndCondition,
}

// ============================================================================
// Game End Conditions
// ============================================================================

/// How the game concluded.
///
/// Games can end in three ways:
/// - **Win**: Someone successfully declared Mahjong
/// - **WallExhausted**: No tiles left, no winner (draw)
/// - **Abandoned**: Game ended prematurely (disconnection, forfeit, etc.)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum GameEndCondition {
    /// Someone won by mahjong
    Win,

    /// Wall exhausted with no winner (draw)
    ///
    /// In some rulesets, this triggers a redeal.
    WallExhausted,

    /// Game was abandoned before completion
    Abandoned(AbandonReason),
}

/// Reason for game abandonment.
///
/// Tracks why a game ended prematurely, for analytics and user feedback.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum AbandonReason {
    /// Players mutually agreed to end the game
    MutualAgreement,

    /// Not enough players remaining to continue
    ///
    /// Typically triggered when 2+ players disconnect.
    InsufficientPlayers,

    /// A player forfeited the game
    Forfeit,

    /// Game timed out due to inactivity
    ///
    /// Configured timeout period elapsed with no actions.
    Timeout,

    /// All players have dead hands
    ///
    /// Per NMJL rules, when all players have invalid tile counts or
    /// have declared mahjong in error, the game cannot continue.
    AllPlayersDead,
}
