//! Charleston-phase command handlers.

use crate::event::{private_events::PrivateEvent, public_events::PublicEvent, Event};
use crate::flow::charleston::{CharlestonStage, CharlestonVote};
use crate::flow::{GamePhase, PhaseTrigger};
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
/// A vector containing the `PrivateEvent::TilesPassed` event for replay integrity.
fn remove_tiles_from_players(table: &mut Table, player: Seat, tiles: &[Tile]) -> Vec<Event> {
    // Remove tiles from player's hand
    if let Some(p) = table.get_player_mut(player) {
        for &tile in tiles {
            let _ = p.hand.remove_tile(tile);
        }
    }

    // Emit TilesPassed event for replay integrity (private to player)
    vec![Event::Private(PrivateEvent::TilesPassed {
        player,
        tiles: tiles.to_vec(),
    })]
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
/// A vector of `PrivateEvent::TilesReceived` events, one for each exchange.
fn apply_exchanges(table: &mut Table, exchanges: Vec<(Seat, Vec<Tile>)>) -> Vec<Event> {
    let mut events = Vec::new();

    for (target, tiles) in exchanges {
        if let Some(target_player) = table.get_player_mut(target) {
            for tile in &tiles {
                target_player.hand.add_tile(*tile);
            }
            events.push(Event::Private(PrivateEvent::TilesReceived {
                player: target,
                tiles: tiles.clone(),
                from: None,
            }));
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
/// - After a blind pass stage completes, remaining incoming_tiles are added to hands
/// - Before a blind pass stage begins, tiles are kept as incoming_tiles for potential blind forwarding
/// - The charleston state's pending passes are cleared before stage transition
fn advance_charleston_stage(table: &mut Table, current_stage: CharlestonStage) -> Vec<Event> {
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

    // After a blind pass stage completes, add remaining incoming_tiles to hands
    if current_stage.allows_blind_pass() {
        // Collect tiles to add before mutating players
        let tiles_to_add: Vec<(Seat, Vec<Tile>)> = {
            let charleston = table.charleston_state.as_ref();
            if let Some(charleston) = charleston {
                Seat::all()
                    .iter()
                    .filter_map(|&seat| {
                        charleston.incoming_tiles.get(&seat).and_then(|incoming| {
                            if !incoming.is_empty() {
                                Some((seat, incoming.clone()))
                            } else {
                                None
                            }
                        })
                    })
                    .collect()
            } else {
                Vec::new()
            }
        };

        // Now add tiles to players
        for (seat, tiles) in tiles_to_add {
            if let Some(player) = table.get_player_mut(seat) {
                for tile in tiles {
                    player.hand.add_tile(tile);
                }
            }
        }
    }

    // Update charleston state
    if let Some(charleston) = &mut table.charleston_state {
        charleston.clear_pending_passes();
        charleston.stage = next_stage;
    }

    // Emit stage change event
    events.push(Event::Public(PublicEvent::CharlestonPhaseChanged {
        stage: next_stage,
    }));

    // Emit timer event if configured
    if let Some(charleston) = &table.charleston_state {
        if let Some(timer) = charleston.timer {
            events.push(Event::Public(PublicEvent::CharlestonTimerStarted {
                stage: next_stage,
                duration: timer,
                started_at_ms: 0,
                timer_mode: table.house_rules.ruleset.timer_mode.clone(),
            }));
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
/// 2. Handles blind pass/steal if specified (FirstLeft/SecondRight only)
/// 3. Marks the player as ready and checks if all players are ready
/// 4. If all ready, calculates and applies tile exchanges
/// 5. Detects and handles IOU scenario if all players blind pass all tiles
/// 6. Advances to the next Charleston stage
///
/// # Arguments
///
/// * `table` - Mutable reference to the game table
/// * `player` - The seat of the player passing tiles
/// * `tiles` - Slice of tiles being passed from the player's hand
/// * `blind_pass_count` - Optional number of incoming tiles to pass forward without looking (1-3)
///
/// # Blind Pass/Steal Rules
///
/// Per NMJL rules, on FirstLeft and SecondRight passes:
/// - Players can "steal" 1-3 incoming tiles and pass them forward unseen
/// - Total tiles passed must equal 3 (hand tiles + blind tiles)
/// - Blind tiles are taken from `incoming_tiles` and forwarded directly
///
/// # IOU Flow
///
/// When all players attempt to blind pass all 3 tiles:
/// - The Charleston ceases immediately per NMJL guidance
/// - All incoming tiles are added to hands
/// - Play begins without a second blind pass
///
/// # Returns
///
/// A vector of events documenting the pass operation and any resulting state changes.
///
/// # Examples
///
/// ```no_run
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::charleston::pass_tiles;
/// use mahjong_core::tile::tiles::DOT_1;
///
/// // Normal pass (3 tiles from hand)
/// let mut table = Table::new("charleston".to_string(), 0);
/// let events = pass_tiles(&mut table, Seat::East, &[DOT_1, DOT_1, DOT_1], None);
///
/// // Blind pass (1 from hand, 2 blind forwarded)
/// let events = pass_tiles(&mut table, Seat::East, &[DOT_1], Some(2));
/// ```
pub fn pass_tiles(
    table: &mut Table,
    player: Seat,
    tiles: &[Tile],
    blind_pass_count: Option<u8>,
) -> Vec<Event> {
    let mut events = vec![];
    let blind_count = blind_pass_count.unwrap_or(0);

    // Step 1: Remove tiles from player's hand and emit event
    if !tiles.is_empty() {
        events.extend(remove_tiles_from_players(table, player, tiles));
    }

    // Step 2: Handle blind pass/steal if specified
    let mut blind_tiles = Vec::new();
    if blind_count > 0 {
        if let Some(charleston) = &mut table.charleston_state {
            // Extract blind_count tiles from incoming_tiles for this player
            if let Some(incoming) = charleston.incoming_tiles.get_mut(&player) {
                let available = incoming.len().min(blind_count as usize);
                blind_tiles = incoming.drain(..available).collect();
            }

            // Emit blind pass event
            events.push(Event::Public(PublicEvent::BlindPassPerformed {
                player,
                blind_count,
                hand_count: tiles.len() as u8,
            }));
        }
    }

    // Step 3: Combine hand tiles and blind tiles for the pass
    let mut pass_tiles = tiles.to_vec();
    pass_tiles.extend(blind_tiles);

    // Step 4: Mark player as ready and store their pass
    let (should_advance, current_stage, exchanges, iou_detected) =
        if let Some(charleston) = &mut table.charleston_state {
            charleston
                .pending_passes
                .insert(player, Some(pass_tiles.clone()));
            charleston.pending_blind_passes.insert(player, blind_count);
            events.push(Event::Public(PublicEvent::PlayerReadyForPass { player }));

            // Check if all players are ready
            if charleston.all_players_ready() {
                // Check for IOU scenario on blind pass stages
                let mut iou_scenario = false;
                if charleston.stage.allows_blind_pass() && charleston.is_all_blind_pass() {
                    // All players attempted full blind pass - IOU scenario!
                    iou_scenario = true;

                    // Initialize IOU debts (each player owes 3 tiles)
                    for seat in Seat::all() {
                        charleston.iou_debts.insert(seat, 3);
                    }

                    // Emit IOU detected event
                    let debts: Vec<(Seat, u8)> = Seat::all().iter().map(|s| (*s, 3)).collect();
                    events.push(Event::Public(PublicEvent::IOUDetected { debts }));
                }

                // Emit passing event if there's a direction (not for IOU scenario)
                if !iou_scenario {
                    if let Some(direction) = charleston.stage.pass_direction() {
                        events.push(Event::Public(PublicEvent::TilesPassing { direction }));
                    }
                }

                let stage = charleston.stage;
                let exchanges = calculate_exchanges(table, stage);
                (true, stage, exchanges, iou_scenario)
            } else {
                (false, charleston.stage, Vec::new(), false)
            }
        } else {
            (false, CharlestonStage::FirstRight, Vec::new(), false)
        };

    // Step 5: Apply tile exchanges if all players are ready
    if should_advance {
        // Handle IOU scenario: no one can pass, Charleston ceases
        if iou_detected {
            // Per NMJL: "In the unlikely event that no one has a tile to pass,
            // then the Charleston ceases and play begins."

            // Collect tiles to add before mutating players
            let tiles_to_add: Vec<(Seat, Vec<Tile>)> = {
                let charleston = table.charleston_state.as_ref();
                if let Some(charleston) = charleston {
                    Seat::all()
                        .iter()
                        .filter_map(|&seat| {
                            charleston
                                .incoming_tiles
                                .get(&seat)
                                .map(|incoming| (seat, incoming.clone()))
                        })
                        .collect()
                } else {
                    Vec::new()
                }
            };

            // Add all incoming tiles to players' hands
            for (seat, tiles) in tiles_to_add {
                if let Some(player_obj) = table.get_player_mut(seat) {
                    for tile in tiles {
                        player_obj.hand.add_tile(tile);
                    }
                }
            }

            // Emit IOU resolved event
            events.push(Event::Public(PublicEvent::IOUResolved {
                summary: "No tiles available to pass - Charleston ceases".to_string(),
            }));

            // End Charleston early
            events.push(Event::Public(PublicEvent::CharlestonComplete));
            let _ = table.transition_phase(PhaseTrigger::CharlestonComplete);
            table.charleston_state = None;
        } else {
            // Normal flow
            // Determine if next stage allows blind pass
            let next_stage_allows_blind = matches!(
                current_stage,
                CharlestonStage::FirstAcross | CharlestonStage::SecondAcross
            );

            if next_stage_allows_blind {
                // Store tiles as incoming_tiles for the next stage (FirstLeft or SecondRight)
                // Players will decide whether to blind forward these in the next pass
                if let Some(charleston) = &mut table.charleston_state {
                    if let Some(direction) = current_stage.pass_direction() {
                        for seat in Seat::all() {
                            let target = direction.target_from(seat);
                            if let Some(Some(tiles)) = charleston.pending_passes.get(&seat) {
                                charleston
                                    .incoming_tiles
                                    .entry(target)
                                    .or_insert_with(Vec::new)
                                    .extend(tiles.clone());

                                // Emit TilesReceived event marking them as pending/incoming
                                events.push(Event::Private(PrivateEvent::TilesReceived {
                                    player: target,
                                    tiles: tiles.clone(),
                                    from: Some(seat),
                                }));
                            }
                        }
                    }
                }
            } else {
                // Normal pass: add tiles directly to hands
                let exchange_events = apply_exchanges(table, exchanges);
                events.extend(exchange_events);
            }

            // Step 6: Advance to next stage
            let stage_events = advance_charleston_stage(table, current_stage);
            events.extend(stage_events);
        }
    }

    events
}

/// Record a Charleston continue/stop vote and advance when all players vote.
///
/// # Examples
/// ```no_run
/// use mahjong_core::flow::charleston::CharlestonVote;
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::charleston::vote_charleston;
///
/// let mut table = Table::new("vote".to_string(), 0);
/// let _ = vote_charleston(&mut table, Seat::East, CharlestonVote::Stop);
/// ```
pub fn vote_charleston(table: &mut Table, player: Seat, vote: CharlestonVote) -> Vec<Event> {
    let mut events = vec![Event::Public(PublicEvent::PlayerVoted { player })];

    if let Some(charleston) = &mut table.charleston_state {
        charleston.votes.insert(player, vote);

        // If all players voted, tally result and transition
        if charleston.voting_complete() {
            if let Some(result) = charleston.vote_result() {
                // TODO: Include individual votes in VoteResult event for frontend display
                // Currently: VoteResult { result }
                // Desired: VoteResult { result, votes: charleston.votes.clone() }
                // Needed for US-005 AC-10: Show "East: Stop, South: Continue, West: Stop, North: Stop"
                // See: TODO-BACKEND-VOTING.md
                events.push(Event::Public(PublicEvent::VoteResult { result }));

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

                events.push(Event::Public(PublicEvent::CharlestonPhaseChanged {
                    stage: next_stage,
                }));

                if let Some(timer) = charleston.timer {
                    events.push(Event::Public(PublicEvent::CharlestonTimerStarted {
                        stage: next_stage,
                        duration: timer,
                        started_at_ms: 0,
                        timer_mode: table.house_rules.ruleset.timer_mode.clone(),
                    }));
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
pub fn propose_courtesy_pass(table: &mut Table, player: Seat, tile_count: u8) -> Vec<Event> {
    let mut events = vec![Event::Private(PrivateEvent::CourtesyPassProposed {
        player,
        tile_count,
    })];

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
                events.push(Event::Private(PrivateEvent::CourtesyPassMismatch {
                    pair,
                    proposed: (proposal_a, proposal_b),
                    agreed_count,
                }));
            }

            // Emit pair ready event (agreed_count is always min)
            events.push(Event::Private(PrivateEvent::CourtesyPairReady {
                pair,
                tile_count: agreed_count,
            }));
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
pub fn accept_courtesy_pass(table: &mut Table, player: Seat, tiles: Vec<Tile>) -> Vec<Event> {
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
    events.push(Event::Private(PrivateEvent::TilesPassed {
        player,
        tiles: tiles.clone(),
    }));

    // Mark ready and collect tile exchanges
    let mut exchanges: Vec<(Seat, Vec<Tile>)> = Vec::new();
    let mut should_complete = false;

    if let Some(charleston) = &mut table.charleston_state {
        charleston.pending_passes.insert(player, Some(tiles));
        events.push(Event::Public(PublicEvent::PlayerReadyForPass { player }));

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
            events.push(Event::Private(PrivateEvent::TilesReceived {
                player: target,
                tiles: tiles.clone(),
                from: Some(target.across()),
            }));
        }
    }

    // Transition to Complete if all ready
    if should_complete {
        events.push(Event::Public(PublicEvent::CourtesyPassComplete));
        events.push(Event::Public(PublicEvent::CharlestonComplete));
        let _ = table.transition_phase(PhaseTrigger::CharlestonComplete);
        table.charleston_state = None;

        // Emit TurnChanged event to notify clients that playing phase has started
        // Charleston always transitions to East's first discard
        if let crate::flow::GamePhase::Playing(stage) = &table.phase {
            table.current_turn = Seat::East;
            events.push(Event::Public(PublicEvent::TurnChanged {
                player: Seat::East,
                stage: stage.clone(),
            }));
        }
    }

    events
}
