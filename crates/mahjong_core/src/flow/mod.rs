//! State Machine and Game Phases.
//!
//! This module defines the hierarchical state machine for American Mahjong game flow:
//! - Top-level GamePhase (WaitingForPlayers → Setup → Charleston → Playing → Scoring → GameOver)
//! - Charleston sub-phases (mandatory and optional passes)
//! - Turn stages (Drawing → Discarding → CallWindow)
//!
//! ## Module Structure
//!
//! - [`mod.rs`](self) - Core phase types ([`GamePhase`], [`StateError`], [`PhaseTrigger`], [`SetupStage`])
//! - [`charleston`] - Charleston subsystem (stage, state, vote logic)
//! - [`playing`] - Main gameplay turn management ([`playing::TurnStage`], [`playing::TurnAction`])
//! - [`outcomes`] - Win detection and scoring types
//!
//! ## Design Principles
//!
//! - **Type-safe state machine**: Invalid transitions prevented at compile time
//! - **Hierarchical phases**: Top-level [`GamePhase`] contains sub-phases for each game stage
//! - **Server-authoritative**: All state transitions validated server-side
//!
//! See [docs/archive/04-state-machine-design.md](../../../../docs/archive/04-state-machine-design.md) for design rationale.

use serde::{Deserialize, Serialize};
use thiserror::Error;
use ts_rs::TS;

pub mod charleston;
pub mod outcomes;
pub mod playing;

#[cfg(test)]
mod tests;

use crate::player::Seat;

/// Errors that occur during state transitions.
///
/// These errors represent invalid operations on the game state machine,
/// such as attempting transitions that aren't allowed in the current phase.
#[derive(Debug, Clone, PartialEq, Eq, Error, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum StateError {
    #[error("Invalid transition for current state")]
    InvalidTransition,

    #[error("Action is not allowed in the current stage")]
    InvalidActionForStage,

    #[error("Player tried to act when it's not their turn")]
    NotYourTurn,

    #[error("Charleston is already complete")]
    CharlestonAlreadyComplete,

    #[error("Vote result was needed but not provided")]
    MissingVoteResult,

    #[error("Player tried to call their own discard")]
    CannotCallOwnDiscard,
}

// ============================================================================
// Top-Level Game Phase
// ============================================================================

/// The top-level game phase that governs what type of activity is currently happening.
///
/// This is the root of the hierarchical state machine. Each phase may contain
/// sub-phases that track more granular states (e.g., [`charleston::CharlestonStage`], [`playing::TurnStage`]).
///
/// # State Transitions
///
/// ```text
/// WaitingForPlayers
///   ↓ AllPlayersJoined
/// Setup(RollingDice → BreakingWall → Dealing → OrganizingHands)
///   ↓ HandsOrganized
/// Charleston(FirstRight → ... → Complete)
///   ↓ CharlestonComplete
/// Playing(Drawing ↔ Discarding ↔ CallWindow)
///   ↓ MahjongDeclared
/// Scoring
///   ↓ ValidationComplete
/// GameOver
/// ```
///
/// # Examples
///
/// ```
/// use mahjong_core::flow::{GamePhase, PhaseTrigger, SetupStage};
///
/// let phase = GamePhase::WaitingForPlayers;
/// let next = phase.transition(PhaseTrigger::AllPlayersJoined).unwrap();
/// assert_eq!(next, GamePhase::Setup(SetupStage::RollingDice));
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum GamePhase {
    /// Waiting for 4 players to join
    WaitingForPlayers,

    /// Pre-game setup (dice roll, wall break, dealing)
    Setup(SetupStage),

    /// Mandatory tile exchange phase
    Charleston(charleston::CharlestonStage),

    /// Main draw-discard loop
    Playing(playing::TurnStage),

    /// Someone won - validating and scoring
    Scoring(outcomes::WinContext),

    /// Game completed, showing results
    GameOver(outcomes::GameResult),
}

impl GamePhase {
    /// Attempt to transition to the next phase based on the trigger event.
    ///
    /// # Errors
    ///
    /// Returns [`StateError::InvalidTransition`] if the trigger is not valid for the current phase.
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_core::flow::{GamePhase, PhaseTrigger, SetupStage};
    ///
    /// let phase = GamePhase::WaitingForPlayers;
    /// let next = phase.transition(PhaseTrigger::AllPlayersJoined).unwrap();
    /// assert_eq!(next, GamePhase::Setup(SetupStage::RollingDice));
    /// ```
    pub fn transition(&self, trigger: PhaseTrigger) -> Result<Self, StateError> {
        match (self, trigger) {
            // Players joined → Start setup
            (Self::WaitingForPlayers, PhaseTrigger::AllPlayersJoined) => {
                Ok(Self::Setup(SetupStage::RollingDice))
            }

            // Setup stages progress sequentially
            (Self::Setup(SetupStage::RollingDice), PhaseTrigger::DiceRolled) => {
                Ok(Self::Setup(SetupStage::BreakingWall))
            }
            (Self::Setup(SetupStage::BreakingWall), PhaseTrigger::WallBroken) => {
                Ok(Self::Setup(SetupStage::Dealing))
            }
            (Self::Setup(SetupStage::Dealing), PhaseTrigger::TilesDealt) => {
                Ok(Self::Setup(SetupStage::OrganizingHands))
            }
            (Self::Setup(SetupStage::OrganizingHands), PhaseTrigger::HandsOrganized) => {
                Ok(Self::Charleston(charleston::CharlestonStage::FirstRight))
            }

            // Charleston → Main game (East starts by discarding)
            (Self::Charleston(_), PhaseTrigger::CharlestonComplete) => {
                Ok(Self::Playing(playing::TurnStage::Discarding {
                    player: Seat::East,
                }))
            }

            // Someone declared Mahjong → Validate
            (Self::Playing(_), PhaseTrigger::MahjongDeclared(ctx)) => Ok(Self::Scoring(ctx)),

            // Validation complete → Show results
            (Self::Scoring(_), PhaseTrigger::ValidationComplete(result)) => {
                Ok(Self::GameOver(result))
            }

            // Wall exhausted (no winner)
            (Self::Playing(_), PhaseTrigger::WallExhausted(result)) => Ok(Self::GameOver(result)),

            _ => Err(StateError::InvalidTransition),
        }
    }
}

// ============================================================================
// Setup Sub-Phases
// ============================================================================

/// Setup sub-phases that occur before the Charleston.
///
/// These stages handle the pre-game ceremony: rolling dice to determine wall break,
/// dealing tiles, and giving players time to organize their hands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum SetupStage {
    /// East is rolling dice to determine wall break
    RollingDice,

    /// Wall is being broken at the dice position
    BreakingWall,

    /// Dealing initial tiles to all players
    Dealing,

    /// Players are organizing their initial hands
    OrganizingHands,
}

// ============================================================================
// Phase Triggers
// ============================================================================

/// Events that trigger phase transitions.
///
/// These are emitted by the game engine when significant events occur,
/// causing the state machine to advance to the next phase.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum PhaseTrigger {
    AllPlayersJoined,
    DiceRolled,
    WallBroken,
    TilesDealt,
    HandsOrganized,
    CharlestonComplete,
    MahjongDeclared(outcomes::WinContext),
    ValidationComplete(outcomes::GameResult),
    WallExhausted(outcomes::GameResult),
}
