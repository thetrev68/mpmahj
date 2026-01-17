//! Charleston-phase command handlers.

use crate::event::GameEvent;
use crate::flow::{CharlestonStage, CharlestonVote, GamePhase, PhaseTrigger};
use crate::player::Seat;
use crate::table::Table;
use crate::tile::Tile;

/// Removes tiles from a player's hand and emits the TilesPassed event.
///
/// This is a helper function used during Charleston tile passing.
///
/// # Arguments
///
/// * `table` - Mutable reference to the game table
/// * `player` - The seat of the player passing tiles
/// * `tiles` - Slice of tiles to remove from the player's hand
///
/// # Returns
///
/// A vector containing the `GameEvent::TilesPassed` event for replay integrity.
fn remove_tiles_from_players(table: &mut Table, player: Seat, tiles: &[Tile]) -> Vec<GameEvent> {
    // Remove tiles from player's hand
    if let Some(p) = table.get_player_mut(player) {
        for &tile in tiles {
            let _ = p.hand.remove_tile(tile);
        }
    }

    // Emit TilesPassed event for replay integrity (private to player)
    vec![GameEvent::TilesPassed {
        player,
        tiles: tiles.to_vec(),
    }]
}

/// Calculates tile exchanges based on the Charleston stage and collected passes.
///
/// This function determines which tiles should be exchanged between which players
/// based on the current Charleston stage's pass direction.
///
/// # Arguments
///
/// * `table` - Reference to the game table
/// * `stage` - The current Charleston stage
///
/// # Returns
///
/// A vector of tuples where each tuple contains:
/// - The target seat receiving tiles
/// - The vector of tiles to be received
fn calculate_exchanges(table: &Table, stage: CharlestonStage) -> Vec<(Seat, Vec<Tile>)> {
    let mut exchanges = Vec::new();

    if let Some(charleston) = &table.charleston_state {
        if let Some(direction) = stage.pass_direction() {
            // Collect all tile exchanges to perform
            for seat in Seat::all() {
                let target = direction.target_from(seat);
                if let Some(Some(tiles)) = charleston.pending_passes.get(&seat) {
                    exchanges.push((target, tiles.clone()));
                }
            }
        }
    }

    exchanges
}

/// Applies tile exchanges to players and emits the corresponding events.
///
/// This function adds tiles to target players' hands and emits `TilesReceived` events
/// for each exchange.
///
/// # Arguments
///
/// * `table` - Mutable reference to the game table
/// * `exchanges` - Vector of exchanges, each containing target seat and tiles
///
/// # Returns
///
/// A vector of `GameEvent::TilesReceived` events, one for each exchange.
fn apply_exchanges(table: &mut Table, exchanges: Vec<(Seat, Vec<Tile>)>) -> Vec<GameEvent> {
    let mut events = Vec::new();

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

    events
}

/// Advances the Charleston stage and emits the corresponding events.
///
/// This function determines the next Charleston stage, updates the table state,
/// and emits phase change and timer events as needed.
///
/// # Arguments
///
/// * `table` - Mutable reference to the game table
/// * `current_stage` - The current Charleston stage before advancement
///
/// # Returns
///
/// A vector of events including `CharlestonPhaseChanged` and optionally
/// `CharlestonTimerStarted`.
///
/// # Implementation Notes
///
/// The next stage is determined as follows:
/// - `FirstLeft` transitions to `VotingToContinue`
/// - Other passing stages call `stage.next(None)` for sequential progression
/// - The charleston state's pending passes are cleared before stage transition
fn advance_charleston_stage(table: &mut Table, current_stage: CharlestonStage) -> Vec<GameEvent> {
    let mut events = Vec::new();

    // Determine next stage
    let next_stage = if current_stage == CharlestonStage::FirstLeft {
        CharlestonStage::VotingToContinue
    } else if matches!(
        current_stage,
        CharlestonStage::FirstRight
            | CharlestonStage::FirstAcross
            | CharlestonStage::SecondLeft
            | CharlestonStage::SecondAcross
            | CharlestonStage::SecondRight
    ) {
        // Safe to unwrap here: these stages always have a next stage
        current_stage
            .next(None)
            .expect("Charleston stage transition failed - invalid state")
    } else {
        current_stage
    };

    // Update charleston state
    if let Some(charleston) = &mut table.charleston_state {
        charleston.clear_pending_passes();
        charleston.stage = next_stage;
    }

    // Emit stage change event
    events.push(GameEvent::CharlestonPhaseChanged { stage: next_stage });

    // Emit timer event if configured
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

    // Update table phase
    table.phase = GamePhase::Charleston(next_stage);

    events
}

/// Apply a Charleston pass from a player and advance the stage if all are ready.
///
/// This is the main entry point for Charleston tile passing. It orchestrates the following steps:
/// 1. Removes tiles from the player's hand
/// 2. Marks the player as ready and checks if all players are ready
/// 3. If all ready, calculates and applies tile exchanges
/// 4. Advances to the next Charleston stage
///
/// # Arguments
///
/// * `table` - Mutable reference to the game table
/// * `player` - The seat of the player passing tiles
/// * `tiles` - Slice of tiles being passed
/// * `_blind_pass_count` - Optional blind pass count (reserved for future use)
///
/// # Returns
///
/// A vector of events documenting the pass operation and any resulting state changes.
///
/// # Implementation Notes
///
/// The function uses several helper functions to break down the complex logic:
/// - `remove_tiles_from_players()` - Handles tile removal and initial event
/// - `calculate_exchanges()` - Determines which tiles go to which players
/// - `apply_exchanges()` - Executes the tile transfers
/// - `advance_charleston_stage()` - Handles stage transition and events
///
/// # Examples
///
/// ```no_run
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::charleston::pass_tiles;
/// use mahjong_core::tile::tiles::DOT_1;
///
/// let mut table = Table::new("charleston".to_string(), 0);
/// let events = pass_tiles(&mut table, Seat::East, &[DOT_1, DOT_1, DOT_1], None);
/// assert!(!events.is_empty());
/// ```
pub fn pass_tiles(
    table: &mut Table,
    player: Seat,
    tiles: &[Tile],
    _blind_pass_count: Option<u8>,
) -> Vec<GameEvent> {
    // Step 1: Remove tiles from player and emit initial event
    let mut events = remove_tiles_from_players(table, player, tiles);

    // Step 2: Mark player as ready and determine if we should proceed
    let (should_advance, current_stage, exchanges) =
        if let Some(charleston) = &mut table.charleston_state {
            charleston
                .pending_passes
                .insert(player, Some(tiles.to_vec()));
            events.push(GameEvent::PlayerReadyForPass { player });

            // Check if all players are ready
            if charleston.all_players_ready() {
                // Emit passing event if there's a direction
                if let Some(direction) = charleston.stage.pass_direction() {
                    events.push(GameEvent::TilesPassing { direction });
                }

                let stage = charleston.stage;
                let exchanges = calculate_exchanges(table, stage);
                (true, stage, exchanges)
            } else {
                (false, charleston.stage, Vec::new())
            }
        } else {
            (false, CharlestonStage::FirstRight, Vec::new())
        };

    // Step 3: Apply tile exchanges if all players are ready
    if should_advance {
        let exchange_events = apply_exchanges(table, exchanges);
        events.extend(exchange_events);

        // Step 4: Advance to next stage
        let stage_events = advance_charleston_stage(table, current_stage);
        events.extend(stage_events);
    }

    events
}

/// Record a Charleston continue/stop vote and advance when all players vote.
///
/// # Examples
/// ```no_run
/// use mahjong_core::flow::CharlestonVote;
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::charleston::vote_charleston;
///
/// let mut table = Table::new("vote".to_string(), 0);
/// let _ = vote_charleston(&mut table, Seat::East, CharlestonVote::Stop);
/// ```
pub fn vote_charleston(table: &mut Table, player: Seat, vote: CharlestonVote) -> Vec<GameEvent> {
    let mut events = vec![GameEvent::PlayerVoted { player }];

    if let Some(charleston) = &mut table.charleston_state {
        charleston.votes.insert(player, vote);

        // If all players voted, tally result and transition
        if charleston.voting_complete() {
            if let Some(result) = charleston.vote_result() {
                events.push(GameEvent::VoteResult { result });

                // Clear votes
                charleston.votes.clear();

                // Transition to next stage based on vote
                // Safe: VotingToContinue stage always has a valid next stage
                let next_stage = charleston
                    .stage
                    .next(Some(result))
                    .expect("Charleston voting stage transition failed - invalid state");
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
    }

    events
}

/// Record a courtesy pass proposal for the player's pair.
///
/// # Examples
/// ```no_run
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::charleston::propose_courtesy_pass;
///
/// let mut table = Table::new("courtesy".to_string(), 0);
/// let _ = propose_courtesy_pass(&mut table, Seat::East, 1);
/// ```
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
            // Safe: courtesy_pair_ready guarantees both proposals exist
            let agreed_count = charleston
                .courtesy_agreed_count(pair)
                .expect("Courtesy agreed count should exist when pair is ready");
            let (seat_a, seat_b) = pair;
            let proposal_a = charleston.courtesy_proposals[&seat_a]
                .expect("Proposal A should exist when pair is ready");
            let proposal_b = charleston.courtesy_proposals[&seat_b]
                .expect("Proposal B should exist when pair is ready");

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

/// Accept a courtesy pass by submitting tiles to exchange.
///
/// # Examples
/// ```no_run
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::charleston::accept_courtesy_pass;
///
/// let mut table = Table::new("courtesy-accept".to_string(), 0);
/// let _ = accept_courtesy_pass(&mut table, Seat::East, vec![]);
/// ```
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

    // Emit TilesPassed event for replay integrity (private to player)
    events.push(GameEvent::TilesPassed {
        player,
        tiles: tiles.clone(),
    });

    // Mark ready and collect tile exchanges
    let mut exchanges: Vec<(Seat, Vec<Tile>)> = Vec::new();
    let mut should_complete = false;

    if let Some(charleston) = &mut table.charleston_state {
        charleston.pending_passes.insert(player, Some(tiles));
        events.push(GameEvent::PlayerReadyForPass { player });

        // Check if this pair is now complete (both submitted tiles)
        let partner = player.across();
        let pair_complete = charleston
            .pending_passes
            .get(&player)
            .and_then(|p| p.as_ref())
            .is_some()
            && charleston
                .pending_passes
                .get(&partner)
                .and_then(|p| p.as_ref())
                .is_some();

        if pair_complete {
            // Perform exchange for this pair only
            // Safe: pair_complete check guarantees both pending_passes exist and are Some
            let player_tiles = charleston.pending_passes[&player]
                .clone()
                .expect("Player tiles should exist when pair is complete");
            let partner_tiles = charleston.pending_passes[&partner]
                .clone()
                .expect("Partner tiles should exist when pair is complete");

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
