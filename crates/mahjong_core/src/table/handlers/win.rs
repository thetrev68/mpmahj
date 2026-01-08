use crate::event::GameEvent;
use crate::flow::{AbandonReason, PhaseTrigger, WinContext, WinType};
use crate::hand::Hand;
use crate::player::Seat;
use crate::table::Table;
use crate::tile::Tile;
use std::collections::HashMap;

pub fn declare_mahjong(
    table: &mut Table,
    player: Seat,
    hand: Hand,
    winning_tile: Option<Tile>,
) -> Vec<GameEvent> {
    let mut events = vec![GameEvent::MahjongDeclared { player }];

    let validation = table
        .validator
        .as_ref()
        .and_then(|validator| validator.validate_win(&hand));

    if table.validator.is_some() && validation.is_none() {
        events.push(GameEvent::HandValidated {
            player,
            valid: false,
            pattern: None,
        });
        events.push(GameEvent::CommandRejected {
            player,
            reason: "Invalid Mahjong (no matching pattern)".to_string(),
        });
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
        .map(|analysis| analysis.pattern_id.clone())
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

    events.push(GameEvent::HandValidated {
        player,
        valid: true,
        pattern: Some(winning_pattern),
    });

    events.push(GameEvent::GameOver {
        winner: Some(player),
        result: game_result,
    });

    events
}

pub fn abandon_game(table: &mut Table, player: Seat, reason: AbandonReason) -> Vec<GameEvent> {
    let mut events = vec![GameEvent::GameAbandoned {
        reason,
        initiator: Some(player),
    }];

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

    events.push(GameEvent::GameOver {
        winner: None,
        result: game_result,
    });

    events
}

pub fn exchange_joker(
    table: &mut Table,
    player: Seat,
    target_seat: Seat,
    meld_index: usize,
    replacement: Tile,
) -> Vec<GameEvent> {
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

        return vec![GameEvent::JokerExchanged {
            player,
            target_seat,
            joker,
            replacement,
        }];
    }

    vec![]
}

pub fn exchange_blank(table: &mut Table, player: Seat, discard_index: usize) -> Vec<GameEvent> {
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

    vec![GameEvent::BlankExchanged { player }]
}
