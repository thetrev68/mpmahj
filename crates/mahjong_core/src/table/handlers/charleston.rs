//! Charleston-phase command handlers.

use crate::event::{
    private_events::{IncomingContext, PrivateEvent},
    public_events::PublicEvent,
    Event,
};
use crate::flow::charleston::{CharlestonStage, CharlestonState, CharlestonVote};
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
/// Returns `(target_seat, tiles, source_seat)` tuples so the staging event can
/// record where the tiles came from.
///
/// For blind stages (`FirstLeft`, `SecondRight`) the source seat is always `None`
/// so the client cannot infer the identity of the sender from the event.
fn calculate_exchanges(
    table: &Table,
    stage: CharlestonStage,
) -> Vec<(Seat, Vec<Tile>, Option<Seat>)> {
    let mut exchanges = Vec::new();

    // Blind stages must hide the source seat per the receive-first contract.
    let from_fn: fn(Seat) -> Option<Seat> = if stage.allows_blind_pass() {
        |_| None
    } else {
        Some
    };

    if let Some(charleston) = &table.charleston_state {
        if let Some(direction) = stage.pass_direction() {
            for seat in Seat::all() {
                let target = direction.target_from(seat);
                if let Some(Some(tiles)) = charleston.pending_passes.get(&seat) {
                    exchanges.push((target, tiles.clone(), from_fn(seat)));
                }
            }
        }
    }

    exchanges
}

/// Stage incoming tile exchanges into `incoming_tiles` and emit `IncomingTilesStaged` events.
///
/// Tiles are NOT added to player hands here — they remain in the staging area until
/// the player submits `CommitCharlestonPass`, at which point remaining staged tiles
/// are absorbed into the hand automatically.
///
/// # Arguments
///
/// * `table` - Mutable reference to the game table
/// * `exchanges` - Vector of `(target_seat, tiles, source_seat)` tuples
///
/// # Returns
///
/// A vector of `IncomingTilesStaged` private events.
fn stage_exchanges(
    table: &mut Table,
    exchanges: Vec<(Seat, Vec<Tile>, Option<Seat>)>,
) -> Vec<Event> {
    let mut events = Vec::new();

    if let Some(charleston) = &mut table.charleston_state {
        for (target, tiles, from) in exchanges {
            charleston
                .incoming_tiles
                .entry(target)
                .or_insert_with(Vec::new)
                .extend(tiles.clone());

            events.push(Event::Private(PrivateEvent::IncomingTilesStaged {
                player: target,
                tiles,
                from,
                context: IncomingContext::Charleston,
            }));
        }
    }

    events
}

/// Absorb remaining staged incoming tiles (not forwarded) into a player's hand.
///
/// Called during `commit_charleston_pass` after the forwarded tiles have been
/// removed from `incoming_tiles`. Any tiles still in staging are merged into the
/// hand and emitted as `TilesReceived` for replay integrity.
fn absorb_remaining_incoming(table: &mut Table, player: Seat) -> Vec<Event> {
    let tiles: Vec<Tile> = table
        .charleston_state
        .as_mut()
        .and_then(|cs| cs.incoming_tiles.get_mut(&player))
        .map(std::mem::take)
        .unwrap_or_default();

    if tiles.is_empty() {
        return Vec::new();
    }

    if let Some(p) = table.get_player_mut(player) {
        for tile in &tiles {
            p.hand.add_tile(*tile);
        }
    }

    vec![Event::Private(PrivateEvent::TilesReceived {
        player,
        tiles,
        from: None,
    })]
}

/// Detect and initialize an IOU scenario for all-blind Charleston passes.
fn detect_iou_scenario(charleston: &mut CharlestonState, events: &mut Vec<Event>) -> bool {
    if !(charleston.stage.allows_blind_pass() && charleston.is_all_blind_pass()) {
        return false;
    }

    for seat in Seat::all() {
        charleston.iou_debts.insert(seat, 3);
    }

    let debts: Vec<(Seat, u8)> = Seat::all().iter().map(|s| (*s, 3)).collect();
    events.push(Event::Public(PublicEvent::IOUDetected { debts }));
    true
}

/// Resolve IOU cease-flow and end Charleston.
///
/// In staging-first semantics, when all players commit `forward_incoming_count == 3`
/// the pending pass bundles hold the forwarded tiles (already drained from staging).
/// Those tiles must be returned to their original owners before Charleston ends.
fn resolve_iou_and_complete_charleston(table: &mut Table, events: &mut Vec<Event>) {
    // Collect tiles from pending_passes (forwarded incoming that need returning).
    // Each seat owns the tiles in its own pending_pass bundle for the IOU scenario.
    let tiles_to_return: Vec<(Seat, Vec<Tile>)> = {
        if let Some(charleston) = &table.charleston_state {
            Seat::all()
                .iter()
                .filter_map(|&seat| {
                    charleston
                        .pending_passes
                        .get(&seat)
                        .and_then(|p| p.as_ref())
                        .filter(|tiles| !tiles.is_empty())
                        .map(|tiles| (seat, tiles.clone()))
                })
                .collect()
        } else {
            Vec::new()
        }
    };

    for (seat, tiles) in tiles_to_return {
        if let Some(player_obj) = table.get_player_mut(seat) {
            for tile in tiles {
                player_obj.hand.add_tile(tile);
            }
        }
    }

    events.push(Event::Public(PublicEvent::IOUResolved {
        summary: "No tiles available to pass - Charleston ceases".to_string(),
    }));
    events.push(Event::Public(PublicEvent::CharlestonComplete));
    let _ = table.transition_phase(PhaseTrigger::CharlestonComplete);
    table.charleston_state = None;
}

/// Route completed pass outcomes.
///
/// **Receive-first contract (US-058):**
/// - Ordinary stages (FirstRight, FirstAcross, SecondLeft, SecondAcross):
///   tiles are delivered immediately to the recipient's hand as `TilesReceived`
///   so the rack is back to its full count before the next stage begins.
/// - Blind stages (FirstLeft, SecondRight): tiles are placed in `incoming_tiles`
///   and emitted as `IncomingTilesStaged { from: None }` so the client can show
///   them face-down as blind candidates without mutating the hand.
fn apply_completed_pass_outcome(
    table: &mut Table,
    stage: CharlestonStage,
    exchanges: Vec<(Seat, Vec<Tile>, Option<Seat>)>,
    events: &mut Vec<Event>,
) {
    if stage.allows_blind_pass() {
        // Blind pass: stage tiles face-down, do not mutate hands yet.
        events.extend(stage_exchanges(table, exchanges));
    } else {
        // Ordinary pass: deliver tiles directly into recipient hands.
        for (target, tiles, from) in exchanges {
            if let Some(player) = table.get_player_mut(target) {
                for &tile in &tiles {
                    player.hand.add_tile(tile);
                }
            }
            events.push(Event::Private(PrivateEvent::TilesReceived {
                player: target,
                tiles,
                from,
            }));
        }
    }
}

/// Advances the Charleston stage and emits the corresponding events.
///
/// Under staging-first semantics, `incoming_tiles` absorption happens at commit
/// time (inside `commit_charleston_pass`), not here.  This function only
/// advances the stage pointer and emits the phase-change event.
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

    // Update charleston state (pending passes cleared; incoming_tiles left for
    // next-stage forwarding — they will be absorbed/forwarded at commit time)
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

/// Commit a Charleston pass from the staging model.
///
/// This is the main entry point for the `CommitCharlestonPass` command.  It
/// orchestrates the following steps:
///
/// 1. Forward `forward_incoming_count` staged incoming tiles into the pass bundle.
/// 2. Absorb the remaining staged incoming tiles into the player's hand.
/// 3. Remove `from_hand` tiles from the player's hand.
/// 4. Store the combined pass bundle and mark the player as ready.
/// 5. If all players are ready, resolve exchanges and advance the stage.
///
/// # IOU Flow
///
/// When all players forward all 3 of their staged incoming tiles (i.e., none
/// from hand on a blind stage), the Charleston ceases per NMJL guidance and
/// all remaining incoming tiles are returned to hands.
pub fn commit_charleston_pass(
    table: &mut Table,
    player: Seat,
    from_hand: &[Tile],
    forward_incoming_count: u8,
) -> Vec<Event> {
    let mut events = vec![];

    // Step 1: Forward incoming tiles and absorb the rest.
    let forwarded_tiles: Vec<Tile> = {
        let incoming = table
            .charleston_state
            .as_mut()
            .and_then(|cs| cs.incoming_tiles.get_mut(&player));

        if let Some(incoming) = incoming {
            let forward_count = (forward_incoming_count as usize).min(incoming.len());
            incoming.drain(..forward_count).collect()
        } else {
            Vec::new()
        }
    };

    // Step 2: Absorb remaining staged incoming tiles into hand and emit replay event.
    events.extend(absorb_remaining_incoming(table, player));

    // Step 3: Remove from_hand tiles from the player's hand and emit event.
    if !from_hand.is_empty() {
        events.extend(remove_tiles_from_players(table, player, from_hand));
    }

    // Step 4: Combine into the pass bundle and mark player ready.
    let mut pass_bundle = from_hand.to_vec();
    pass_bundle.extend(forwarded_tiles);

    let (should_advance, current_stage, exchanges, iou_detected) =
        if let Some(charleston) = &mut table.charleston_state {
            charleston
                .pending_passes
                .insert(player, Some(pass_bundle.clone()));
            // Track forward count for IOU detection (same slot as before).
            charleston
                .pending_blind_passes
                .insert(player, forward_incoming_count);

            for count in 1..=pass_bundle.len() as u8 {
                events.push(Event::Public(PublicEvent::PlayerStagedTile {
                    player,
                    count,
                }));
            }
            events.push(Event::Public(PublicEvent::PlayerReadyForPass { player }));

            if charleston.all_players_ready() {
                let iou_scenario = detect_iou_scenario(charleston, &mut events);

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

    // Step 5: Apply exchanges and advance stage if all players are ready.
    if should_advance {
        if iou_detected {
            resolve_iou_and_complete_charleston(table, &mut events);
        } else {
            apply_completed_pass_outcome(table, current_stage, exchanges, &mut events);
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
                events.push(Event::Public(PublicEvent::VoteResult {
                    result,
                    votes: charleston.votes.clone(),
                }));

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
        let staged_count = charleston
            .pending_passes
            .get(&player)
            .and_then(|entry| entry.as_ref())
            .map_or(0, |staged| staged.len() as u8);
        for count in 1..=staged_count {
            events.push(Event::Public(PublicEvent::PlayerStagedTile {
                player,
                count,
            }));
        }
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
