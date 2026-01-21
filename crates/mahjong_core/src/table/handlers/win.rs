//! Win-phase command handlers and settlement actions.

use crate::event::{public_events::PublicEvent, Event};
use crate::flow::outcomes::{AbandonReason, WinContext, WinType};
use crate::flow::PhaseTrigger;
use crate::hand::Hand;
use crate::player::Seat;
use crate::table::Table;
use crate::tile::Tile;
use std::collections::HashMap;

/// Validate and declare Mahjong, transitioning to scoring if valid.
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
    hand: Hand,
    winning_tile: Option<Tile>,
) -> Vec<Event> {
    let mut events = vec![Event::Public(PublicEvent::MahjongDeclared { player })];

    let validation = table
        .validator
        .as_ref()
        .and_then(|validator| validator.validate_win(&hand));

    if table.validator.is_some() && validation.is_none() {
        events.push(Event::Public(PublicEvent::HandValidated {
            player,
            valid: false,
            pattern: None,
        }));
        events.push(Event::Public(PublicEvent::CommandRejected {
            player,
            reason: "Invalid Mahjong (no matching pattern)".to_string(),
        }));
        return events;
    }

    // Determine win type
    let win_type = if let Some(_tile) = winning_tile {
        // Called discard
        WinType::CalledDiscard(table.discard_pile.last().map_or(player, |d| d.discarded_by))
    } else {
        WinType::SelfDraw
    };

    // Create win context
    let win_context = WinContext {
        winner: player,
        win_type,
        winning_tile: winning_tile.unwrap_or_else(|| hand.concealed[0]),
        hand: hand.clone(),
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
