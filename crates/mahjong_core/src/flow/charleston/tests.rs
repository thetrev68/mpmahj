//! Tests for Charleston stage and state management.

use crate::flow::charleston::{CharlestonStage, CharlestonState, CharlestonVote, PassDirection};
use crate::flow::StateError;
use crate::player::Seat;
use crate::tile::tiles::JOKER;

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
    let mut state = CharlestonState::new(60);
    assert!(!state.all_players_ready());

    // Simulate players selecting tiles
    state
        .pending_passes
        .insert(Seat::East, Some(vec![JOKER, JOKER, JOKER]));
    assert!(!state.all_players_ready());

    state
        .pending_passes
        .insert(Seat::South, Some(vec![JOKER, JOKER, JOKER]));
    state
        .pending_passes
        .insert(Seat::West, Some(vec![JOKER, JOKER, JOKER]));
    state
        .pending_passes
        .insert(Seat::North, Some(vec![JOKER, JOKER, JOKER]));
    assert!(state.all_players_ready());
}

#[test]
fn test_charleston_state_voting() {
    let mut state = CharlestonState::new(60);
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
    let mut state = CharlestonState::new(60);
    state.stage = CharlestonStage::VotingToContinue;

    state.votes.insert(Seat::East, CharlestonVote::Continue);
    state.votes.insert(Seat::South, CharlestonVote::Stop); // One stop
    state.votes.insert(Seat::West, CharlestonVote::Continue);
    state.votes.insert(Seat::North, CharlestonVote::Continue);

    assert!(state.voting_complete());
    assert_eq!(state.vote_result(), Some(CharlestonVote::Stop));
}
