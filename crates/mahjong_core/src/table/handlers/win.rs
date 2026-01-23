//! Win-phase command handlers and settlement actions.

use crate::event::{
    private_events::PrivateEvent, public_events::PublicEvent, types::ReplacementReason, Event,
};
use crate::flow::outcomes::{AbandonReason, WinContext, WinType};
use crate::flow::playing::TurnStage;
use crate::flow::{GamePhase, PhaseTrigger};
use crate::hand::Hand;
use crate::player::Seat;
use crate::table::Table;
use crate::tile::Tile;
use std::collections::HashMap;

/// Validate and declare Mahjong, transitioning to scoring if valid.
///
/// This function implements Phase 1 server-side verification:
/// - Ignores the client-supplied hand payload
/// - Rebuilds the hand from server state
/// - For called discard wins, validates the stored tile from `AwaitingMahjong`
/// - Rejects invalid Mahjong without advancing the game phase
///
/// # Arguments
///
/// * `table` - The game table (mutable)
/// * `player` - The player declaring Mahjong
/// * `hand` - Client-supplied hand (ignored; server-side state is authoritative)
/// * `winning_tile` - Optional winning tile (only used for validation context)
///
/// # Returns
///
/// Events including validation result and either:
/// - `HandValidated { valid: false }` + `CommandRejected` if invalid (game continues)
/// - `HandValidated { valid: true }` + `GameOver` if valid (game ends)
///
/// # Examples
/// ```no_run
/// use mahjong_core::hand::Hand;
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::win::declare_mahjong;
///
/// let mut table = Table::new("win".to_string(), 0);
/// let hand = Hand::empty();
/// let _ = declare_mahjong(&mut table, Seat::East, hand, None);
/// ```
pub fn declare_mahjong(
    table: &mut Table,
    player: Seat,
    _hand: Hand,
    _winning_tile: Option<Tile>,
) -> Vec<Event> {
    let mut events = vec![];

    // Check if we're in AwaitingMahjong stage
    let (is_awaiting_mahjong, stored_tile, discarded_by_seat) =
        if let GamePhase::Playing(TurnStage::AwaitingMahjong {
            caller,
            tile,
            discarded_by,
        }) = &table.phase
        {
            if *caller != player {
                // Wrong player trying to declare
                events.push(Event::Public(PublicEvent::CommandRejected {
                    player,
                    reason: "Not the Mahjong caller in AwaitingMahjong stage".to_string(),
                }));
                return events;
            }
            (true, Some(*tile), Some(*discarded_by))
        } else {
            (false, None, None)
        };

    // Rebuild hand from server state (ignore client payload)
    let mut server_hand = match table.get_player(player) {
        Some(p) => p.hand.clone(),
        None => {
            events.push(Event::Public(PublicEvent::CommandRejected {
                player,
                reason: "Player not found".to_string(),
            }));
            return events;
        }
    };

    // Ensure the called tile is present in state for AwaitingMahjong.
    if is_awaiting_mahjong {
        if let Some(tile) = stored_tile {
            if server_hand.total_tiles() < 14 {
                server_hand.add_tile(tile);
                if let Some(p) = table.get_player_mut(player) {
                    p.hand.add_tile(tile);
                }
            }
        }
    }

    // Validate the hand
    let validation = table
        .validator
        .as_ref()
        .and_then(|validator| validator.validate_win(&server_hand));

    // Check basic tile count
    if server_hand.total_tiles() != 14 {
        // NMJL Rule: Wrong tile count = dead hand
        table.mark_hand_dead(player);

        events.push(Event::Public(PublicEvent::HandValidated {
            player,
            valid: false,
            pattern: None,
        }));
        events.push(Event::Public(PublicEvent::CommandRejected {
            player,
            reason: format!(
                "Invalid tile count: {} (expected 14) - hand marked dead",
                server_hand.total_tiles()
            ),
        }));
        events.push(Event::Public(PublicEvent::HandDeclaredDead {
            player,
            reason: "Wrong tile count".to_string(),
        }));

        if is_awaiting_mahjong {
            let next_player = table.next_active_player(player);
            if !table.get_player(next_player).is_some_and(|p| p.can_act()) {
                events.push(Event::Public(PublicEvent::GameAbandoned {
                    reason: AbandonReason::AllPlayersDead,
                    initiator: None,
                }));

                let all_hands: HashMap<Seat, Hand> = table
                    .players
                    .iter()
                    .map(|(seat, p)| (*seat, p.hand.clone()))
                    .collect();

                let game_result = crate::scoring::build_abandon_result(
                    all_hands,
                    table.dealer,
                    AbandonReason::AllPlayersDead,
                );

                table.phase = GamePhase::GameOver(game_result.clone());

                events.push(Event::Public(PublicEvent::GameOver {
                    winner: None,
                    result: game_result,
                }));

                return events;
            }

            let next_stage = TurnStage::Drawing {
                player: next_player,
            };

            table.phase = GamePhase::Playing(next_stage.clone());
            table.current_turn = next_player;
            table.turn_number += 1;

            events.push(Event::Public(PublicEvent::TurnChanged {
                player: next_player,
                stage: next_stage,
            }));
        }
        return events;
    }

    // Check for valid pattern
    if table.validator.is_some() && validation.is_none() {
        // NMJL Rule: Mahjong in error = dead hand
        // The called tile (if any) stays with the caller
        table.mark_hand_dead(player);

        events.push(Event::Public(PublicEvent::HandValidated {
            player,
            valid: false,
            pattern: None,
        }));
        events.push(Event::Public(PublicEvent::CommandRejected {
            player,
            reason: "Invalid Mahjong (no matching pattern) - hand marked dead".to_string(),
        }));
        events.push(Event::Public(PublicEvent::HandDeclaredDead {
            player,
            reason: "Mahjong in error".to_string(),
        }));

        // Game continues with the caller's hand now dead
        // If in AwaitingMahjong, transition back to playing
        if is_awaiting_mahjong {
            // The tile stays with the dead player; advance to next active player
            let next_player = table.next_active_player(player);
            if !table.get_player(next_player).is_some_and(|p| p.can_act()) {
                events.push(Event::Public(PublicEvent::GameAbandoned {
                    reason: AbandonReason::AllPlayersDead,
                    initiator: None,
                }));

                let all_hands: HashMap<Seat, Hand> = table
                    .players
                    .iter()
                    .map(|(seat, p)| (*seat, p.hand.clone()))
                    .collect();

                let game_result = crate::scoring::build_abandon_result(
                    all_hands,
                    table.dealer,
                    AbandonReason::AllPlayersDead,
                );

                table.phase = GamePhase::GameOver(game_result.clone());

                events.push(Event::Public(PublicEvent::GameOver {
                    winner: None,
                    result: game_result,
                }));

                return events;
            }

            let next_stage = TurnStage::Drawing {
                player: next_player,
            };

            table.phase = GamePhase::Playing(next_stage.clone());
            table.current_turn = next_player;
            table.turn_number += 1;

            events.push(Event::Public(PublicEvent::TurnChanged {
                player: next_player,
                stage: next_stage,
            }));
        }

        return events;
    }

    // Validation succeeded - build win context
    let final_winning_tile = stored_tile.unwrap_or_else(|| {
        // Self-draw case: use first concealed tile or fallback
        server_hand.concealed.first().copied().unwrap_or({
            // Last resort fallback
            crate::tile::tiles::BAM_1
        })
    });

    // Determine win type, applying the NMJL "Finesse" rule:
    // If a player exchanges a joker and immediately declares Mahjong without discarding,
    // it counts as a self-draw win for scoring purposes.
    let win_type = if is_awaiting_mahjong {
        // Called discard win
        WinType::CalledDiscard(discarded_by_seat.unwrap_or(player))
    } else {
        // Check for Finesse rule: joker exchange followed by immediate Mahjong
        match &table.last_action {
            crate::table::LastAction::JokerExchange {
                player: exchange_player,
            } if *exchange_player == player => {
                // Finesse rule applies: treat as self-draw
                WinType::SelfDraw
            }
            _ => {
                // Normal self-draw win
                WinType::SelfDraw
            }
        }
    };

    let win_context = WinContext {
        winner: player,
        win_type,
        winning_tile: final_winning_tile,
        hand: server_hand.clone(),
    };

    // Transition to Scoring phase
    let _ = table.transition_phase(PhaseTrigger::MahjongDeclared(win_context.clone()));

    let winning_pattern = validation
        .as_ref()
        .map(|analysis| analysis.pattern_name.clone())
        .unwrap_or_else(|| "Pattern Validation Not Implemented".to_string());

    // Collect all final hands
    let all_hands: HashMap<Seat, Hand> = table
        .players
        .iter()
        .map(|(seat, p)| (*seat, p.hand.clone()))
        .collect();

    // Build complete game result with scoring
    let game_result = crate::scoring::build_win_result(
        &win_context,
        winning_pattern.clone(),
        all_hands,
        table.dealer,
    );

    let _ = table.transition_phase(PhaseTrigger::ValidationComplete(game_result.clone()));

    events.push(Event::Public(PublicEvent::HandValidated {
        player,
        valid: true,
        pattern: Some(winning_pattern),
    }));

    events.push(Event::Public(PublicEvent::GameOver {
        winner: Some(player),
        result: game_result,
    }));

    events
}

/// Abandon the current game and emit a GameOver result.
///
/// # Examples
/// ```no_run
/// use mahjong_core::flow::outcomes::AbandonReason;
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::win::abandon_game;
///
/// let mut table = Table::new("abandon".to_string(), 0);
/// let _ = abandon_game(&mut table, Seat::East, AbandonReason::Timeout);
/// ```
pub fn abandon_game(table: &mut Table, player: Seat, reason: AbandonReason) -> Vec<Event> {
    let mut events = vec![Event::Public(PublicEvent::GameAbandoned {
        reason,
        initiator: Some(player),
    })];

    // Collect all final hands
    let all_hands: HashMap<Seat, Hand> = table
        .players
        .iter()
        .map(|(seat, p)| (*seat, p.hand.clone()))
        .collect();

    // Build abandon result
    let game_result = crate::scoring::build_abandon_result(all_hands, table.dealer, reason);

    // Transition to GameOver
    table.phase = crate::flow::GamePhase::GameOver(game_result.clone());

    events.push(Event::Public(PublicEvent::GameOver {
        winner: None,
        result: game_result,
    }));

    events
}

/// Exchange a joker from a target player's meld.
///
/// Per NMJL "Finesse" rule: If a player exchanges a joker and immediately
/// declares Mahjong without discarding, it counts as a self-draw win for
/// scoring purposes. This function tracks the exchange for that purpose.
///
/// # Examples
/// ```no_run
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::win::exchange_joker;
/// use mahjong_core::tile::tiles::DOT_1;
///
/// let mut table = Table::new("joker".to_string(), 0);
/// let _ = exchange_joker(&mut table, Seat::East, Seat::South, 0, DOT_1);
/// ```
pub fn exchange_joker(
    table: &mut Table,
    player: Seat,
    target_seat: Seat,
    meld_index: usize,
    replacement: Tile,
) -> Vec<Event> {
    let mut joker_tile = None;

    // Get the Joker from target's meld
    if let Some(target) = table.get_player_mut(target_seat) {
        if let Some(meld) = target.hand.exposed.get_mut(meld_index) {
            if meld.exchange_joker(replacement).is_ok() {
                joker_tile = Some(crate::tile::tiles::JOKER);
            }
        }
    }

    // Give Joker to player, remove replacement from their hand
    if let (Some(joker), Some(p)) = (joker_tile, table.get_player_mut(player)) {
        let _ = p.hand.remove_tile(replacement);
        p.hand.add_tile(joker);

        // Track this joker exchange for Finesse rule
        table.last_action = crate::table::LastAction::JokerExchange { player };

        return vec![Event::Public(PublicEvent::JokerExchanged {
            player,
            target_seat,
            joker,
            replacement,
        })];
    }

    vec![]
}

/// Exchange a blank tile with a discard from the pile.
///
/// # Examples
/// ```no_run
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::win::exchange_blank;
///
/// let mut table = Table::new("blank".to_string(), 0);
/// let _ = exchange_blank(&mut table, Seat::East, 0);
/// ```
pub fn exchange_blank(table: &mut Table, player: Seat, discard_index: usize) -> Vec<Event> {
    // Get the tile from discard pile first
    let discarded_tile = if discard_index < table.discard_pile.len() {
        Some(table.discard_pile[discard_index].tile)
    } else {
        None
    };

    // Remove blank from player's hand and add discarded tile
    if let Some(p) = table.get_player_mut(player) {
        // Find and remove blank
        if let Some(pos) = p.hand.concealed.iter().position(|t| t.is_blank()) {
            p.hand.concealed.remove(pos);
        }

        // Add tile from discard pile
        if let Some(tile) = discarded_tile {
            p.hand.add_tile(tile);
        }
    }

    // Remove tile from discard pile
    if discard_index < table.discard_pile.len() {
        table.discard_pile.remove(discard_index);
    }

    vec![Event::Public(PublicEvent::BlankExchanged { player })]
}

/// Upgrade an exposed meld by adding a tile during the player's turn.
///
/// Allows transforming Pung → Kong, Kong → Quint, Quint → Sextet, etc.
/// The player must own the tile being added, and it must match the meld's base tile.
/// This operation only modifies the meld type and tile count; it does not emit
/// validation events for pattern matching (the meld is already exposed and valid).
///
/// # Arguments
///
/// * `table` - The game table (mutable)
/// * `player` - The player adding to their exposed meld
/// * `meld_index` - Index of the meld in the player's exposed melds
/// * `tile` - The tile to add to the meld
///
/// # Returns
///
/// Events including:
/// - `MeldUpgraded { player, meld_index, new_meld_type }` on success
/// - Empty if operation fails (validation should have prevented this)
///
/// # Examples
/// ```no_run
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::win::add_to_exposure;
/// use mahjong_core::tile::tiles::DOT_5;
///
/// let mut table = Table::new("add_exposure".to_string(), 0);
/// let _ = add_to_exposure(&mut table, Seat::East, 0, DOT_5);
/// ```
pub fn add_to_exposure(
    table: &mut Table,
    player: Seat,
    meld_index: usize,
    tile: Tile,
) -> Vec<Event> {
    let mut events = vec![];
    let mut replacement_reason = None;

    if let Some(p) = table.get_player_mut(player) {
        if meld_index >= p.hand.exposed.len() {
            return events;
        }

        let meld = &mut p.hand.exposed[meld_index];

        // Calculate new meld type
        let new_meld_type = match meld.meld_type {
            crate::meld::MeldType::Pung => crate::meld::MeldType::Kong,
            crate::meld::MeldType::Kong => crate::meld::MeldType::Quint,
            crate::meld::MeldType::Quint => crate::meld::MeldType::Sextet,
            crate::meld::MeldType::Sextet => {
                // Cannot upgrade beyond Sextet - shouldn't reach here due to validation
                return events;
            }
        };

        // Add the tile to the meld
        meld.tiles.push(tile);
        meld.meld_type = new_meld_type;

        // Remove the tile from the player's concealed hand
        let _ = p.hand.remove_tile(tile);

        events.push(Event::Public(PublicEvent::MeldUpgraded {
            player,
            meld_index,
            new_meld_type,
        }));

        replacement_reason = match new_meld_type {
            crate::meld::MeldType::Kong => Some(ReplacementReason::Kong),
            crate::meld::MeldType::Quint => Some(ReplacementReason::Quint),
            crate::meld::MeldType::Sextet => Some(ReplacementReason::Sextet),
            _ => None,
        };
    }

    if let Some(reason) = replacement_reason {
        if let Some(replacement_tile) = table.wall.draw() {
            if let Some(p) = table.get_player_mut(player) {
                p.hand.add_tile(replacement_tile);
            }
            events.push(Event::Private(PrivateEvent::ReplacementDrawn {
                player,
                tile: replacement_tile,
                reason,
            }));
        } else {
            events.push(Event::Public(PublicEvent::WallExhausted {
                remaining_tiles: table.wall.remaining(),
            }));

            let all_hands: HashMap<Seat, Hand> = table
                .players
                .iter()
                .map(|(seat, p)| (*seat, p.hand.clone()))
                .collect();

            let game_result = crate::scoring::build_draw_result(all_hands, table.dealer);

            let _ = table.transition_phase(PhaseTrigger::WallExhausted(game_result.clone()));

            events.push(Event::Public(PublicEvent::GameOver {
                winner: None,
                result: game_result,
            }));
        }
    }

    events
}
