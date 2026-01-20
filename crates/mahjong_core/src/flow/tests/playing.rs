//! Tests for TurnStage and playing phase logic.

use std::collections::HashSet;

use crate::flow::playing::{TurnAction, TurnStage};
use crate::flow::StateError;
use crate::player::Seat;
use crate::tile::tiles::{DOT_1, JOKER};

#[test]
fn test_turn_stage_active_player() {
    let stage = TurnStage::Drawing { player: Seat::East };
    assert_eq!(stage.active_player(), Some(Seat::East));

    let stage = TurnStage::Discarding {
        player: Seat::South,
    };
    assert_eq!(stage.active_player(), Some(Seat::South));

    let stage = TurnStage::CallWindow {
        tile: JOKER,
        discarded_by: Seat::West,
        can_act: HashSet::new(),
        pending_intents: Vec::new(),
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
        tile: JOKER,
        discarded_by: Seat::East,
        can_act,
        pending_intents: Vec::new(),
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
    let tile = JOKER;
    let (next_stage, next_turn) = stage.next(TurnAction::Discard(tile), Seat::East).unwrap();

    match next_stage {
        TurnStage::CallWindow {
            tile: window_tile,
            discarded_by,
            can_act,
            pending_intents: _,
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
        tile: JOKER,
        discarded_by: Seat::East,
        can_act,
        pending_intents: Vec::new(),
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
        tile: JOKER,
        discarded_by: Seat::East,
        can_act,
        pending_intents: Vec::new(),
        timer: 10,
    };

    let result = stage.next(TurnAction::Call(Seat::East), Seat::East);
    assert_eq!(result.unwrap_err(), StateError::CannotCallOwnDiscard);
}

#[test]
fn test_turn_stage_all_passed() {
    let stage = TurnStage::CallWindow {
        tile: JOKER,
        discarded_by: Seat::East,
        can_act: HashSet::new(),
        pending_intents: Vec::new(),
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
    let result = stage.next(TurnAction::Discard(DOT_1), Seat::East);
    assert_eq!(result.unwrap_err(), StateError::InvalidActionForStage);
}
