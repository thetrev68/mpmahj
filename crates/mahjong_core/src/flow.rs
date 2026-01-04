//! State Machine and Game Phases.
//!
//! This module defines the hierarchical state machine for American Mahjong game flow:
//! - Top-level GamePhase (WaitingForPlayers → Setup → Charleston → Playing → Scoring → GameOver)
//! - Charleston sub-phases (mandatory and optional passes)
//! - Turn stages (Drawing → Discarding → CallWindow)
//!
//! See architecture doc: docs/architecture/04-state-machine-design.md

use crate::hand::Hand;
use crate::player::Seat;
use crate::tile::Tile;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use thiserror::Error;
use ts_rs::TS;

/// Errors that occur during state transitions.
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
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum GamePhase {
    /// Waiting for 4 players to join
    WaitingForPlayers,

    /// Pre-game setup (dice roll, wall break, dealing)
    Setup(SetupStage),

    /// Mandatory tile exchange phase
    Charleston(CharlestonStage),

    /// Main draw-discard loop
    Playing(TurnStage),

    /// Someone won - validating and scoring
    Scoring(WinContext),

    /// Game completed, showing results
    GameOver(GameResult),
}

impl GamePhase {
    /// Attempt to transition to the next phase based on the trigger event.
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
                Ok(Self::Charleston(CharlestonStage::FirstRight))
            }

            // Charleston → Main game (East starts by discarding)
            (Self::Charleston(_), PhaseTrigger::CharlestonComplete) => {
                Ok(Self::Playing(TurnStage::Discarding { player: Seat::East }))
            }

            // Someone declared Mahjong → Validate
            (Self::Playing(_), PhaseTrigger::MahjongDeclared(ctx)) => Ok(Self::Scoring(ctx)),

            // Validation complete → Show results
            (Self::Scoring(_), PhaseTrigger::ValidationComplete(result)) => {
                Ok(Self::GameOver(result))
            }

            // Wall exhausted (no winner)
            (Self::Playing(_), PhaseTrigger::WallExhausted) => {
                // Note: In a real game, this would be a draw. For now, we use a placeholder.
                Ok(Self::GameOver(GameResult {
                    winner: Seat::East, // Placeholder - need to handle draws properly
                    winning_pattern: "No Winner (Draw)".to_string(),
                    final_hands: HashMap::new(),
                }))
            }

            _ => Err(StateError::InvalidTransition),
        }
    }
}

// ============================================================================
// Setup Sub-Phases
// ============================================================================

/// Setup sub-phases that occur before the Charleston.
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
    MahjongDeclared(WinContext),
    ValidationComplete(GameResult),
    WallExhausted,
}

// ============================================================================
// Charleston Stage
// ============================================================================

/// Charleston sub-phases tracking the complex tile-passing sequence.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum CharlestonStage {
    // ===== FIRST CHARLESTON (Mandatory) =====
    /// First pass: Everyone passes 3 tiles RIGHT
    FirstRight,

    /// Second pass: Everyone passes 3 tiles ACROSS
    FirstAcross,

    /// Third pass: Everyone passes 3 tiles LEFT
    /// Note: Blind pass/steal option available here
    FirstLeft,

    // ===== DECISION POINT =====
    /// All players vote: Continue to Second Charleston or stop?
    /// If ANY player votes "stop", move to CourtesyAcross
    /// If ALL players vote "continue", move to SecondLeft
    VotingToContinue,

    // ===== SECOND CHARLESTON (Optional - requires unanimous vote) =====
    /// Fourth pass: Everyone passes 3 tiles LEFT (reverse direction)
    SecondLeft,

    /// Fifth pass: Everyone passes 3 tiles ACROSS
    SecondAcross,

    /// Sixth pass: Everyone passes 3 tiles RIGHT
    /// Note: Blind pass/steal option available here
    SecondRight,

    // ===== COURTESY PASS (Optional) =====
    /// Across partners negotiate passing 0-3 tiles
    /// East-West negotiate independently of North-South
    CourtesyAcross,

    /// Charleston is complete, transitioning to main game
    Complete,
}

impl CharlestonStage {
    /// Get the direction tiles are being passed.
    pub fn pass_direction(&self) -> Option<PassDirection> {
        match self {
            Self::FirstRight | Self::SecondRight => Some(PassDirection::Right),
            Self::FirstAcross | Self::SecondAcross => Some(PassDirection::Across),
            Self::FirstLeft | Self::SecondLeft => Some(PassDirection::Left),
            Self::CourtesyAcross => Some(PassDirection::Across),
            Self::VotingToContinue | Self::Complete => None,
        }
    }

    /// Can players do a blind pass/steal on this stage?
    pub fn allows_blind_pass(&self) -> bool {
        matches!(self, Self::FirstLeft | Self::SecondRight)
    }

    /// Is this the courtesy pass (different rules)?
    pub fn is_courtesy_pass(&self) -> bool {
        matches!(self, Self::CourtesyAcross)
    }

    /// Get the next stage after this one completes.
    pub fn next(&self, vote_result: Option<CharlestonVote>) -> Result<Self, StateError> {
        match self {
            Self::FirstRight => Ok(Self::FirstAcross),
            Self::FirstAcross => Ok(Self::FirstLeft),
            Self::FirstLeft => Ok(Self::VotingToContinue),

            Self::VotingToContinue => match vote_result {
                Some(CharlestonVote::Continue) => Ok(Self::SecondLeft),
                Some(CharlestonVote::Stop) => Ok(Self::CourtesyAcross),
                None => Err(StateError::MissingVoteResult),
            },

            Self::SecondLeft => Ok(Self::SecondAcross),
            Self::SecondAcross => Ok(Self::SecondRight),
            Self::SecondRight => Ok(Self::CourtesyAcross),

            Self::CourtesyAcross => Ok(Self::Complete),
            Self::Complete => Err(StateError::CharlestonAlreadyComplete),
        }
    }

    /// Check if this stage requires players to pass tiles.
    pub fn requires_pass(&self) -> bool {
        matches!(
            self,
            Self::FirstRight
                | Self::FirstAcross
                | Self::FirstLeft
                | Self::SecondLeft
                | Self::SecondAcross
                | Self::SecondRight
        )
    }
}

/// Direction for Charleston tile passing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum PassDirection {
    Right,
    Across,
    Left,
}

impl PassDirection {
    /// Get the target seat for a pass from a given seat.
    pub fn target_from(&self, from: Seat) -> Seat {
        match self {
            PassDirection::Right => from.right(),
            PassDirection::Across => from.across(),
            PassDirection::Left => from.left(),
        }
    }
}

/// Vote for whether to continue to the Second Charleston.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum CharlestonVote {
    Continue, // Do the optional Second Charleston
    Stop,     // Skip to Courtesy Pass
}

/// Tracks Charleston state for all players.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct CharlestonState {
    /// Current stage of the Charleston
    pub stage: CharlestonStage,

    /// Tiles selected by each player for the current pass
    /// None means they haven't selected yet
    pub pending_passes: HashMap<Seat, Option<Vec<Tile>>>,

    /// Votes for continuing to Second Charleston
    /// Only populated during VotingToContinue stage
    pub votes: HashMap<Seat, CharlestonVote>,

    /// Timer for the current pass (seconds remaining)
    pub timer: Option<u32>,
}

impl CharlestonState {
    /// Create a new Charleston state starting at FirstRight.
    pub fn new() -> Self {
        CharlestonState {
            stage: CharlestonStage::FirstRight,
            pending_passes: HashMap::from([
                (Seat::East, None),
                (Seat::South, None),
                (Seat::West, None),
                (Seat::North, None),
            ]),
            votes: HashMap::new(),
            timer: Some(60),
        }
    }

    /// Check if all players have submitted their tiles for this pass.
    pub fn all_players_ready(&self) -> bool {
        self.pending_passes.values().all(|tiles| tiles.is_some())
    }

    /// Check if voting is complete.
    pub fn voting_complete(&self) -> bool {
        self.stage == CharlestonStage::VotingToContinue && self.votes.len() == 4
    }

    /// Get the vote result (Continue only if unanimous).
    pub fn vote_result(&self) -> Option<CharlestonVote> {
        if !self.voting_complete() {
            return None;
        }

        // If ANY player votes Stop, the result is Stop
        if self.votes.values().any(|v| *v == CharlestonVote::Stop) {
            Some(CharlestonVote::Stop)
        } else {
            Some(CharlestonVote::Continue)
        }
    }

    /// Clear pending passes in preparation for the next stage.
    pub fn clear_pending_passes(&mut self) {
        for value in self.pending_passes.values_mut() {
            *value = None;
        }
    }
}

impl Default for CharlestonState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Turn Stage (Main Game Loop)
// ============================================================================

/// Turn sub-phases during main gameplay.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum TurnStage {
    /// Current player needs to draw a tile from the wall
    /// (East starts with 14 tiles, so skips this on first turn)
    Drawing { player: Seat },

    /// Current player has drawn and must now discard or declare Mahjong
    Discarding { player: Seat },

    /// A tile was just discarded - other players can call it or pass
    CallWindow {
        /// The tile that was just discarded
        tile: Tile,

        /// Who discarded it
        discarded_by: Seat,

        /// Players who can still act (haven't passed yet)
        /// As players pass, they're removed from this set
        can_act: HashSet<Seat>,

        /// Timer for the call window (typically 5-10 seconds)
        timer: u32,
    },
}

impl TurnStage {
    /// Get the player whose turn it is (for Drawing/Discarding).
    pub fn active_player(&self) -> Option<Seat> {
        match self {
            Self::Drawing { player } | Self::Discarding { player } => Some(*player),
            Self::CallWindow { .. } => None, // Multiple players can act
        }
    }

    /// Check if a specific player can take an action right now.
    pub fn can_player_act(&self, seat: Seat) -> bool {
        match self {
            Self::Drawing { player } | Self::Discarding { player } => *player == seat,
            Self::CallWindow {
                can_act,
                discarded_by,
                ..
            } => {
                // Can't call your own discard
                seat != *discarded_by && can_act.contains(&seat)
            }
        }
    }

    /// Transition to the next stage based on an action.
    pub fn next(&self, action: TurnAction, current_turn: Seat) -> Result<(Self, Seat), StateError> {
        match (self, action) {
            // Drew a tile → Now must discard
            (Self::Drawing { player }, TurnAction::Draw) => {
                Ok((Self::Discarding { player: *player }, current_turn))
            }

            // Discarded a tile → Open call window for others
            (Self::Discarding { player }, TurnAction::Discard(tile)) => {
                let mut can_act = HashSet::new();
                can_act.insert(player.right());
                can_act.insert(player.across());
                can_act.insert(player.left());

                Ok((
                    Self::CallWindow {
                        tile,
                        discarded_by: *player,
                        can_act,
                        timer: 10, // Default 10 second window
                    },
                    current_turn,
                ))
            }

            // Player called the discard → They become active player
            (Self::CallWindow { discarded_by, .. }, TurnAction::Call(caller)) => {
                if caller == *discarded_by {
                    return Err(StateError::CannotCallOwnDiscard);
                }
                // Caller gets the tile and must now discard
                Ok((Self::Discarding { player: caller }, caller))
            }

            // All players passed → Next player draws
            (Self::CallWindow { .. }, TurnAction::AllPassed) => {
                let next_player = current_turn.right();
                Ok((
                    Self::Drawing {
                        player: next_player,
                    },
                    next_player,
                ))
            }

            _ => Err(StateError::InvalidActionForStage),
        }
    }
}

/// Actions that can happen during a turn.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum TurnAction {
    Draw,
    Discard(Tile),
    Call(Seat), // Who called
    AllPassed,
}

// ============================================================================
// Win Context and Game Result
// ============================================================================

/// Context for a win declaration that needs validation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct WinContext {
    /// Who declared Mahjong
    pub winner: Seat,

    /// How they won
    pub win_type: WinType,

    /// The winning tile (drawn or called)
    pub winning_tile: Tile,

    /// The complete winning hand (for validation)
    pub hand: Hand,
}

/// How a player won.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum WinType {
    /// Won by drawing the winning tile themselves
    SelfDraw,

    /// Won by calling someone else's discard
    CalledDiscard(Seat), // Who discarded the winning tile
}

/// Final game results.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct GameResult {
    /// The validated winner
    pub winner: Seat,

    /// The winning pattern from The Card
    pub winning_pattern: String, // e.g., "2468 Consecutive Run"

    /// Final hands of all players (for review)
    pub final_hands: HashMap<Seat, Hand>,
    // Note: Point calculation is out of MVP scope
    // Future: Add points, bonuses, payment calculations
}

#[cfg(test)]
mod tests {
    use super::*;

    // ========================================================================
    // GamePhase Transition Tests
    // ========================================================================

    #[test]
    fn test_game_phase_waiting_to_setup() {
        let phase = GamePhase::WaitingForPlayers;
        let result = phase.transition(PhaseTrigger::AllPlayersJoined);
        assert_eq!(result.unwrap(), GamePhase::Setup(SetupStage::RollingDice));
    }

    #[test]
    fn test_game_phase_setup_progression() {
        let phase = GamePhase::Setup(SetupStage::RollingDice);
        let phase = phase.transition(PhaseTrigger::DiceRolled).unwrap();
        assert_eq!(phase, GamePhase::Setup(SetupStage::BreakingWall));

        let phase = phase.transition(PhaseTrigger::WallBroken).unwrap();
        assert_eq!(phase, GamePhase::Setup(SetupStage::Dealing));

        let phase = phase.transition(PhaseTrigger::TilesDealt).unwrap();
        assert_eq!(phase, GamePhase::Setup(SetupStage::OrganizingHands));

        let phase = phase.transition(PhaseTrigger::HandsOrganized).unwrap();
        assert_eq!(phase, GamePhase::Charleston(CharlestonStage::FirstRight));
    }

    #[test]
    fn test_game_phase_charleston_to_playing() {
        let phase = GamePhase::Charleston(CharlestonStage::Complete);
        let result = phase.transition(PhaseTrigger::CharlestonComplete);
        assert_eq!(
            result.unwrap(),
            GamePhase::Playing(TurnStage::Discarding { player: Seat::East })
        );
    }

    #[test]
    fn test_game_phase_invalid_transition() {
        let phase = GamePhase::WaitingForPlayers;
        let result = phase.transition(PhaseTrigger::DiceRolled);
        assert_eq!(result.unwrap_err(), StateError::InvalidTransition);
    }

    // ========================================================================
    // Charleston Stage Tests
    // ========================================================================

    #[test]
    fn test_charleston_stage_progression_first() {
        let stage = CharlestonStage::FirstRight;
        let stage = stage.next(None).unwrap();
        assert_eq!(stage, CharlestonStage::FirstAcross);

        let stage = stage.next(None).unwrap();
        assert_eq!(stage, CharlestonStage::FirstLeft);

        let stage = stage.next(None).unwrap();
        assert_eq!(stage, CharlestonStage::VotingToContinue);
    }

    #[test]
    fn test_charleston_vote_to_second() {
        let stage = CharlestonStage::VotingToContinue;
        let stage = stage.next(Some(CharlestonVote::Continue)).unwrap();
        assert_eq!(stage, CharlestonStage::SecondLeft);

        let stage = stage.next(None).unwrap();
        assert_eq!(stage, CharlestonStage::SecondAcross);

        let stage = stage.next(None).unwrap();
        assert_eq!(stage, CharlestonStage::SecondRight);

        let stage = stage.next(None).unwrap();
        assert_eq!(stage, CharlestonStage::CourtesyAcross);
    }

    #[test]
    fn test_charleston_vote_to_courtesy() {
        let stage = CharlestonStage::VotingToContinue;
        let stage = stage.next(Some(CharlestonVote::Stop)).unwrap();
        assert_eq!(stage, CharlestonStage::CourtesyAcross);

        let stage = stage.next(None).unwrap();
        assert_eq!(stage, CharlestonStage::Complete);
    }

    #[test]
    fn test_charleston_stage_already_complete() {
        let stage = CharlestonStage::Complete;
        let result = stage.next(None);
        assert_eq!(result.unwrap_err(), StateError::CharlestonAlreadyComplete);
    }

    #[test]
    fn test_charleston_vote_missing_result() {
        let stage = CharlestonStage::VotingToContinue;
        let result = stage.next(None);
        assert_eq!(result.unwrap_err(), StateError::MissingVoteResult);
    }

    #[test]
    fn test_charleston_pass_directions() {
        assert_eq!(
            CharlestonStage::FirstRight.pass_direction(),
            Some(PassDirection::Right)
        );
        assert_eq!(
            CharlestonStage::FirstAcross.pass_direction(),
            Some(PassDirection::Across)
        );
        assert_eq!(
            CharlestonStage::FirstLeft.pass_direction(),
            Some(PassDirection::Left)
        );
        assert_eq!(
            CharlestonStage::SecondLeft.pass_direction(),
            Some(PassDirection::Left)
        );
        assert_eq!(
            CharlestonStage::SecondAcross.pass_direction(),
            Some(PassDirection::Across)
        );
        assert_eq!(
            CharlestonStage::SecondRight.pass_direction(),
            Some(PassDirection::Right)
        );
        assert_eq!(CharlestonStage::VotingToContinue.pass_direction(), None);
        assert_eq!(CharlestonStage::Complete.pass_direction(), None);
    }

    #[test]
    fn test_charleston_blind_pass_allowed() {
        assert!(!CharlestonStage::FirstRight.allows_blind_pass());
        assert!(!CharlestonStage::FirstAcross.allows_blind_pass());
        assert!(CharlestonStage::FirstLeft.allows_blind_pass());
        assert!(!CharlestonStage::SecondLeft.allows_blind_pass());
        assert!(!CharlestonStage::SecondAcross.allows_blind_pass());
        assert!(CharlestonStage::SecondRight.allows_blind_pass());
    }

    #[test]
    fn test_pass_direction_targets() {
        assert_eq!(PassDirection::Right.target_from(Seat::East), Seat::South);
        assert_eq!(PassDirection::Right.target_from(Seat::South), Seat::West);
        assert_eq!(PassDirection::Across.target_from(Seat::East), Seat::West);
        assert_eq!(PassDirection::Across.target_from(Seat::South), Seat::North);
        assert_eq!(PassDirection::Left.target_from(Seat::East), Seat::North);
        assert_eq!(PassDirection::Left.target_from(Seat::South), Seat::East);
    }

    // ========================================================================
    // Charleston State Tests
    // ========================================================================

    #[test]
    fn test_charleston_state_all_players_ready() {
        let mut state = CharlestonState::new();
        assert!(!state.all_players_ready());

        // Simulate players selecting tiles
        state.pending_passes.insert(
            Seat::East,
            Some(vec![
                crate::tile::tiles::JOKER,
                crate::tile::tiles::JOKER,
                crate::tile::tiles::JOKER,
            ]),
        );
        assert!(!state.all_players_ready());

        state.pending_passes.insert(
            Seat::South,
            Some(vec![
                crate::tile::tiles::JOKER,
                crate::tile::tiles::JOKER,
                crate::tile::tiles::JOKER,
            ]),
        );
        state.pending_passes.insert(
            Seat::West,
            Some(vec![
                crate::tile::tiles::JOKER,
                crate::tile::tiles::JOKER,
                crate::tile::tiles::JOKER,
            ]),
        );
        state.pending_passes.insert(
            Seat::North,
            Some(vec![
                crate::tile::tiles::JOKER,
                crate::tile::tiles::JOKER,
                crate::tile::tiles::JOKER,
            ]),
        );
        assert!(state.all_players_ready());
    }

    #[test]
    fn test_charleston_state_voting() {
        let mut state = CharlestonState::new();
        state.stage = CharlestonStage::VotingToContinue;

        assert!(!state.voting_complete());
        assert_eq!(state.vote_result(), None);

        state.votes.insert(Seat::East, CharlestonVote::Continue);
        state.votes.insert(Seat::South, CharlestonVote::Continue);
        state.votes.insert(Seat::West, CharlestonVote::Continue);
        assert!(!state.voting_complete());

        state.votes.insert(Seat::North, CharlestonVote::Continue);
        assert!(state.voting_complete());
        assert_eq!(state.vote_result(), Some(CharlestonVote::Continue));
    }

    #[test]
    fn test_charleston_state_voting_any_stop_wins() {
        let mut state = CharlestonState::new();
        state.stage = CharlestonStage::VotingToContinue;

        state.votes.insert(Seat::East, CharlestonVote::Continue);
        state.votes.insert(Seat::South, CharlestonVote::Stop); // One stop
        state.votes.insert(Seat::West, CharlestonVote::Continue);
        state.votes.insert(Seat::North, CharlestonVote::Continue);

        assert!(state.voting_complete());
        assert_eq!(state.vote_result(), Some(CharlestonVote::Stop));
    }

    // ========================================================================
    // Turn Stage Tests
    // ========================================================================

    #[test]
    fn test_turn_stage_active_player() {
        let stage = TurnStage::Drawing { player: Seat::East };
        assert_eq!(stage.active_player(), Some(Seat::East));

        let stage = TurnStage::Discarding {
            player: Seat::South,
        };
        assert_eq!(stage.active_player(), Some(Seat::South));

        let stage = TurnStage::CallWindow {
            tile: crate::tile::tiles::JOKER,
            discarded_by: Seat::West,
            can_act: HashSet::new(),
            timer: 10,
        };
        assert_eq!(stage.active_player(), None);
    }

    #[test]
    fn test_turn_stage_can_player_act() {
        let stage = TurnStage::Drawing { player: Seat::East };
        assert!(stage.can_player_act(Seat::East));
        assert!(!stage.can_player_act(Seat::South));

        let mut can_act = HashSet::new();
        can_act.insert(Seat::South);
        can_act.insert(Seat::North);

        let stage = TurnStage::CallWindow {
            tile: crate::tile::tiles::JOKER,
            discarded_by: Seat::East,
            can_act,
            timer: 10,
        };
        assert!(!stage.can_player_act(Seat::East)); // Can't call own discard
        assert!(stage.can_player_act(Seat::South));
        assert!(!stage.can_player_act(Seat::West)); // Not in can_act
        assert!(stage.can_player_act(Seat::North));
    }

    #[test]
    fn test_turn_stage_draw_to_discard() {
        let stage = TurnStage::Drawing { player: Seat::East };
        let (next_stage, next_turn) = stage.next(TurnAction::Draw, Seat::East).unwrap();
        assert_eq!(next_stage, TurnStage::Discarding { player: Seat::East });
        assert_eq!(next_turn, Seat::East);
    }

    #[test]
    fn test_turn_stage_discard_to_call_window() {
        let stage = TurnStage::Discarding { player: Seat::East };
        let tile = crate::tile::tiles::JOKER;
        let (next_stage, next_turn) = stage.next(TurnAction::Discard(tile), Seat::East).unwrap();

        match next_stage {
            TurnStage::CallWindow {
                tile: window_tile,
                discarded_by,
                can_act,
                timer,
            } => {
                assert_eq!(window_tile, tile);
                assert_eq!(discarded_by, Seat::East);
                assert_eq!(can_act.len(), 3);
                assert!(can_act.contains(&Seat::South));
                assert!(can_act.contains(&Seat::West));
                assert!(can_act.contains(&Seat::North));
                assert_eq!(timer, 10);
            }
            _ => panic!("Expected CallWindow"),
        }
        assert_eq!(next_turn, Seat::East);
    }

    #[test]
    fn test_turn_stage_call_window_to_discard() {
        let mut can_act = HashSet::new();
        can_act.insert(Seat::South);
        can_act.insert(Seat::West);

        let stage = TurnStage::CallWindow {
            tile: crate::tile::tiles::JOKER,
            discarded_by: Seat::East,
            can_act,
            timer: 10,
        };

        let (next_stage, next_turn) = stage
            .next(TurnAction::Call(Seat::South), Seat::East)
            .unwrap();
        assert_eq!(
            next_stage,
            TurnStage::Discarding {
                player: Seat::South
            }
        );
        assert_eq!(next_turn, Seat::South);
    }

    #[test]
    fn test_turn_stage_cannot_call_own_discard() {
        let mut can_act = HashSet::new();
        can_act.insert(Seat::South);

        let stage = TurnStage::CallWindow {
            tile: crate::tile::tiles::JOKER,
            discarded_by: Seat::East,
            can_act,
            timer: 10,
        };

        let result = stage.next(TurnAction::Call(Seat::East), Seat::East);
        assert_eq!(result.unwrap_err(), StateError::CannotCallOwnDiscard);
    }

    #[test]
    fn test_turn_stage_all_passed() {
        let stage = TurnStage::CallWindow {
            tile: crate::tile::tiles::JOKER,
            discarded_by: Seat::East,
            can_act: HashSet::new(),
            timer: 10,
        };

        let (next_stage, next_turn) = stage.next(TurnAction::AllPassed, Seat::East).unwrap();
        assert_eq!(
            next_stage,
            TurnStage::Drawing {
                player: Seat::South
            }
        );
        assert_eq!(next_turn, Seat::South);
    }

    #[test]
    fn test_turn_stage_invalid_action() {
        let stage = TurnStage::Drawing { player: Seat::East };
        let result = stage.next(TurnAction::Discard(crate::tile::tiles::JOKER), Seat::East);
        assert_eq!(result.unwrap_err(), StateError::InvalidActionForStage);
    }
}
