//! Tests for GamePhase transitions.

use crate::flow::charleston::CharlestonStage;
use crate::flow::playing::TurnStage;
use crate::flow::{GamePhase, PhaseTrigger, SetupStage, StateError};
use crate::player::Seat;

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
