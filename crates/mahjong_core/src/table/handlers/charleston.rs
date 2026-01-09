use crate::event::GameEvent;
use crate::flow::{CharlestonStage, CharlestonVote, GamePhase, PhaseTrigger};
use crate::player::Seat;
use crate::table::Table;
use crate::tile::Tile;

pub fn pass_tiles(
    table: &mut Table,
    player: Seat,
    tiles: &[Tile],
    _blind_pass_count: Option<u8>,
) -> Vec<GameEvent> {
    let mut events = vec![];

    // Remove tiles from player's hand
    if let Some(p) = table.get_player_mut(player) {
        for &tile in tiles {
            let _ = p.hand.remove_tile(tile);
        }
    }

    // Mark player as ready in Charleston state and collect tile exchanges
    let mut exchanges: Vec<(Seat, Vec<Tile>)> = Vec::new();
    let mut should_advance = false;
    let mut next_stage = CharlestonStage::FirstRight;

    if let Some(charleston) = &mut table.charleston_state {
        charleston
            .pending_passes
            .insert(player, Some(tiles.to_vec()));

        events.push(GameEvent::PlayerReadyForPass { player });

        // If all players ready, collect exchanges
        if charleston.all_players_ready() {
            let direction = charleston.stage.pass_direction();
            events.push(GameEvent::TilesPassing {
                direction: direction.unwrap(),
            });

            // Collect all tile exchanges to perform
            for seat in Seat::all() {
                let target = direction.unwrap().target_from(seat);
                if let Some(tiles) = charleston.pending_passes.get(&seat).unwrap() {
                    exchanges.push((target, tiles.clone()));
                }
            }

            // Determine next stage
            next_stage = if charleston.stage == CharlestonStage::FirstLeft {
                CharlestonStage::VotingToContinue
            } else if matches!(
                charleston.stage,
                CharlestonStage::FirstRight
                    | CharlestonStage::FirstAcross
                    | CharlestonStage::SecondLeft
                    | CharlestonStage::SecondAcross
                    | CharlestonStage::SecondRight
            ) {
                charleston.stage.next(None).unwrap()
            } else {
                charleston.stage
            };

            should_advance = true;
        }
    }

    // Execute tile exchanges (after dropping charleston borrow)
    for (target, tiles) in exchanges {
        if let Some(target_player) = table.get_player_mut(target) {
            for tile in &tiles {
                target_player.hand.add_tile(*tile);
            }
            events.push(GameEvent::TilesReceived {
                player: target,
                tiles: tiles.clone(),
                from: None,
            });
        }
    }

    // Advance stage if needed
    if should_advance {
        if let Some(charleston) = &mut table.charleston_state {
            charleston.clear_pending_passes();
            charleston.stage = next_stage;
        }
        events.push(GameEvent::CharlestonPhaseChanged { stage: next_stage });

        // Timer event
        if let Some(charleston) = &table.charleston_state {
            if let Some(timer) = charleston.timer {
                events.push(GameEvent::CharlestonTimerStarted {
                    stage: next_stage,
                    duration: timer,
                    started_at_ms: 0,
                    timer_mode: table.house_rules.ruleset.timer_mode.clone(),
                });
            }
        }

        table.phase = GamePhase::Charleston(next_stage);
    }

    events
}

pub fn vote_charleston(table: &mut Table, player: Seat, vote: CharlestonVote) -> Vec<GameEvent> {
    let mut events = vec![GameEvent::PlayerVoted { player }];

    if let Some(charleston) = &mut table.charleston_state {
        charleston.votes.insert(player, vote);

        // If all players voted, tally result and transition
        if charleston.voting_complete() {
            let result = charleston.vote_result().unwrap();
            events.push(GameEvent::VoteResult { result });

            // Clear votes
            charleston.votes.clear();

            // Transition to next stage based on vote
            let next_stage = charleston.stage.next(Some(result)).unwrap();
            charleston.stage = next_stage;
            table.phase = GamePhase::Charleston(next_stage);

            // Reset state for next stage (SecondLeft or CourtesyAcross)
            charleston.reset_for_next_pass();

            events.push(GameEvent::CharlestonPhaseChanged { stage: next_stage });

            if let Some(timer) = charleston.timer {
                events.push(GameEvent::CharlestonTimerStarted {
                    stage: next_stage,
                    duration: timer,
                    started_at_ms: 0,
                    timer_mode: table.house_rules.ruleset.timer_mode.clone(),
                });
            }
        }
    }

    events
}

pub fn propose_courtesy_pass(table: &mut Table, player: Seat, tile_count: u8) -> Vec<GameEvent> {
    let mut events = vec![GameEvent::CourtesyPassProposed { player, tile_count }];

    if let Some(charleston) = &mut table.charleston_state {
        charleston
            .courtesy_proposals
            .insert(player, Some(tile_count));

        // Determine which pair this player belongs to
        let pair = if player == Seat::East || player == Seat::West {
            (Seat::East, Seat::West)
        } else {
            (Seat::North, Seat::South)
        };

        // Check if both players in the pair have proposed
        if charleston.courtesy_pair_ready(pair) {
            let agreed_count = charleston.courtesy_agreed_count(pair).unwrap();
            let (seat_a, seat_b) = pair;
            let proposal_a = charleston.courtesy_proposals[&seat_a].unwrap();
            let proposal_b = charleston.courtesy_proposals[&seat_b].unwrap();

            // Emit mismatch event if proposals differ
            if proposal_a != proposal_b {
                events.push(GameEvent::CourtesyPassMismatch {
                    pair,
                    proposed: (proposal_a, proposal_b),
                    agreed_count,
                });
            }

            // Emit pair ready event (agreed_count is always min)
            events.push(GameEvent::CourtesyPairReady {
                pair,
                tile_count: agreed_count,
            });
        }
    }

    events
}

pub fn accept_courtesy_pass(table: &mut Table, player: Seat, tiles: Vec<Tile>) -> Vec<GameEvent> {
    let mut events = vec![];

    // Determine which pair this player belongs to
    let pair = if player == Seat::East || player == Seat::West {
        (Seat::East, Seat::West)
    } else {
        (Seat::North, Seat::South)
    };

    let agreed_count = if let Some(charleston) = &table.charleston_state {
        charleston.courtesy_agreed_count(pair)
    } else {
        None
    };

    // Validate tile count matches agreed proposal (smallest wins)
    let expected_count = agreed_count.unwrap_or(0) as usize;
    if tiles.len() != expected_count {
        // This should be caught by validation, but double-check
        // Invalid tile count - return early with no events
        return events;
    }

    // Remove tiles from player's hand
    if let Some(p) = table.get_player_mut(player) {
        for tile in &tiles {
            let _ = p.hand.remove_tile(*tile);
        }
    }

    // Mark ready and collect tile exchanges
    let mut exchanges: Vec<(Seat, Vec<Tile>)> = Vec::new();
    let mut should_complete = false;

    if let Some(charleston) = &mut table.charleston_state {
        charleston.pending_passes.insert(player, Some(tiles));
        events.push(GameEvent::PlayerReadyForPass { player });

        // Check if this pair is now complete (both submitted tiles)
        let partner = player.across();
        let pair_complete = charleston.pending_passes.get(&player).unwrap().is_some()
            && charleston.pending_passes.get(&partner).unwrap().is_some();

        if pair_complete {
            // Perform exchange for this pair only
            let player_tiles = charleston.pending_passes[&player].clone().unwrap();
            let partner_tiles = charleston.pending_passes[&partner].clone().unwrap();

            if !player_tiles.is_empty() {
                exchanges.push((partner, player_tiles));
            }
            if !partner_tiles.is_empty() {
                exchanges.push((player, partner_tiles));
            }
        }

        // Check if all players (both pairs) are complete
        if charleston.all_players_ready() {
            should_complete = true;
        }
    }

    // Execute tile exchanges (after dropping charleston borrow)
    for (target, tiles) in exchanges {
        if let Some(target_player) = table.get_player_mut(target) {
            for tile in &tiles {
                target_player.hand.add_tile(*tile);
            }
            events.push(GameEvent::TilesReceived {
                player: target,
                tiles: tiles.clone(),
                from: Some(target.across()),
            });
        }
    }

    // Transition to Complete if all ready
    if should_complete {
        events.push(GameEvent::CourtesyPassComplete);
        events.push(GameEvent::CharlestonComplete);
        let _ = table.transition_phase(PhaseTrigger::CharlestonComplete);
        table.charleston_state = None;
    }

    events
}
