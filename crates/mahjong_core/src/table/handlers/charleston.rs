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

            events.push(GameEvent::CharlestonPhaseChanged { stage: next_stage });
        }
    }

    events
}

#[allow(clippy::unused_self)]
pub fn propose_courtesy_pass(_table: &mut Table, _player: Seat, _tile_count: u8) -> Vec<GameEvent> {
    // This is a simplified implementation
    // In a full implementation, this would open negotiation with across partner
    vec![]
}

pub fn accept_courtesy_pass(table: &mut Table, player: Seat, tiles: Vec<Tile>) -> Vec<GameEvent> {
    let mut events = vec![];

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

        // If all ready, collect exchanges
        if charleston.all_players_ready() {
            // Collect all tile exchanges to perform
            for seat in Seat::all() {
                let target = seat.across();
                if let Some(tiles) = charleston.pending_passes.get(&seat).unwrap() {
                    if !tiles.is_empty() {
                        exchanges.push((target, tiles.clone()));
                    }
                }
            }
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
            });
        }
    }

    // Complete Charleston if needed
    if should_complete {
        events.push(GameEvent::CharlestonComplete);
        let _ = table.transition_phase(PhaseTrigger::CharlestonComplete);
        table.charleston_state = None;
    }

    events
}
