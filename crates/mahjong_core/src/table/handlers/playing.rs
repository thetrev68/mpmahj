//! Playing-phase command handlers.

use crate::event::{
    private_events::PrivateEvent, public_events::PublicEvent, types::ReplacementReason, Event,
};
use crate::flow::playing::{TurnAction, TurnStage};
use crate::flow::{GamePhase, PhaseTrigger};
use crate::hand::Hand;
use crate::meld::MeldType;
use crate::player::Seat;
use crate::table::types::DiscardedTile;
use crate::table::Table;
use crate::tile::Tile;
use std::collections::HashMap;

/// Draw a tile for the active player and advance the turn.
///
/// This function also tracks the draw action for potential Finesse rule application.
///
/// # Examples
/// ```no_run
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::playing::draw_tile;
///
/// let mut table = Table::new("draw".to_string(), 0);
/// let _ = draw_tile(&mut table, Seat::East);
/// ```
pub fn draw_tile(table: &mut Table, player: Seat) -> Vec<Event> {
    let mut events = vec![];

    // Skip dead players in turn progression
    if let Some(p) = table.get_player(player) {
        if !p.can_act() {
            // Player is dead, skip to next active player
            let next = table.next_active_player(player);
            
            // Check if we cycled back (all players dead) - avoid infinite recursion
            if next == player || !table.get_player(next).is_some_and(|p| p.can_act()) {
                // All players are dead - game should end
                events.push(Event::Public(crate::event::public_events::PublicEvent::GameAbandoned {
                    reason: crate::flow::outcomes::AbandonReason::AllPlayersDead,
                    initiator: None,
                }));
                
                let all_hands: std::collections::HashMap<Seat, crate::hand::Hand> = table
                    .players
                    .iter()
                    .map(|(seat, p)| (*seat, p.hand.clone()))
                    .collect();
                
                let game_result = crate::scoring::build_abandon_result(
                    all_hands,
                    table.dealer,
                    crate::flow::outcomes::AbandonReason::AllPlayersDead,
                );
                
                table.phase = crate::flow::GamePhase::GameOver(game_result.clone());
                
                events.push(Event::Public(crate::event::public_events::PublicEvent::GameOver {
                    winner: None,
                    result: game_result,
                }));
                
                return events;
            }
            
            // Update to next active player
            table.current_turn = next;
            table.phase = crate::flow::GamePhase::Playing(TurnStage::Drawing { player: next });
            
            events.push(Event::Public(crate::event::public_events::PublicEvent::PlayerSkipped {
                player,
                reason: "Dead hand".to_string(),
            }));
            events.push(Event::Public(crate::event::public_events::PublicEvent::TurnChanged {
                player: next,
                stage: TurnStage::Drawing { player: next },
            }));
            
            // Recursively call draw_tile for the next active player
            return draw_tile(table, next);
        }
    }

    if let Some(tile) = table.wall.draw() {
        // Add tile to player's hand
        if let Some(p) = table.get_player_mut(player) {
            p.hand.add_tile(tile);
        }

        // Track this draw action for Finesse rule
        table.last_action = crate::table::LastAction::Draw { player };

        // Private event for drawer (includes tile)
        events.push(Event::Private(PrivateEvent::TileDrawnPrivate {
            tile,
            remaining_tiles: table.wall.remaining(),
        }));

        // Public event for others (tile hidden)
        events.push(Event::Public(PublicEvent::TileDrawnPublic {
            remaining_tiles: table.wall.remaining(),
        }));

        // Transition to Discarding stage
        if let GamePhase::Playing(stage) = &table.phase {
            if let Ok((next_stage, next_turn)) = stage.next(TurnAction::Draw, table.current_turn) {
                table.phase = GamePhase::Playing(next_stage.clone());
                table.current_turn = next_turn;
                events.push(Event::Public(PublicEvent::TurnChanged {
                    player: next_turn,
                    stage: next_stage,
                }));
            }
        }
    } else {
        // Wall exhausted - game ends in a draw
        events.push(Event::Public(PublicEvent::WallExhausted {
            remaining_tiles: table.wall.remaining(),
        }));

        // Collect all final hands
        let all_hands: HashMap<Seat, Hand> = table
            .players
            .iter()
            .map(|(seat, p)| (*seat, p.hand.clone()))
            .collect();

        // Build draw result
        let game_result = crate::scoring::build_draw_result(all_hands, table.dealer);

        let _ = table.transition_phase(PhaseTrigger::WallExhausted(game_result.clone()));

        events.push(Event::Public(PublicEvent::GameOver {
            winner: None,
            result: game_result,
        }));
    }

    events
}

/// Discard a tile, update the discard pile, and open a call window.
///
/// Per NMJL rules, discarded jokers are dead tiles and cannot be called.
/// When a joker is discarded, the turn advances directly to the next player
/// without opening a call window.
///
/// This function also clears any previous action tracking (e.g., joker exchange)
/// since the turn is progressing normally.
///
/// # Examples
/// ```no_run
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::playing::discard_tile;
/// use mahjong_core::tile::tiles::DOT_1;
///
/// let mut table = Table::new("discard".to_string(), 0);
/// let _ = discard_tile(&mut table, Seat::East, DOT_1);
/// ```
pub fn discard_tile(table: &mut Table, player: Seat, tile: Tile) -> Vec<Event> {
    let mut events = vec![];

    // Remove tile from player's hand
    if let Some(p) = table.get_player_mut(player) {
        let _ = p.hand.remove_tile(tile);
    }

    // Track this discard action and clear any previous joker exchange
    table.last_action = crate::table::LastAction::Discard { player, tile };

    // Add to discard pile
    table.discard_pile.push(DiscardedTile {
        tile,
        discarded_by: player,
    });

    events.push(Event::Public(PublicEvent::TileDiscarded { player, tile }));

    // NMJL Rule: Discarded jokers are dead tiles - skip call window
    if tile.is_joker() {
        // Advance directly to next player's Drawing stage
        let next_player = table.current_turn.right();
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

        return events;
    }

    // Open call window for non-joker tiles
    if let GamePhase::Playing(stage) = &table.phase {
        if let Ok((mut next_stage, _)) = stage.next(TurnAction::Discard(tile), table.current_turn) {
            // Override timer from ruleset
            if let TurnStage::CallWindow { timer, .. } = &mut next_stage {
                *timer = table.house_rules.ruleset.call_window_seconds;
            }

            table.phase = GamePhase::Playing(next_stage.clone());

            // Emit call window event
            if let TurnStage::CallWindow {
                tile,
                discarded_by,
                can_act,
                timer,
                ..
            } = &next_stage
            {
                events.push(Event::Public(PublicEvent::CallWindowOpened {
                    tile: *tile,
                    discarded_by: *discarded_by,
                    can_call: can_act.iter().copied().collect(),
                    timer: *timer,
                    started_at_ms: 0,
                    timer_mode: table.house_rules.ruleset.timer_mode.clone(),
                }));
            }
        }
    }

    events
}

/// Record a call intent and resolve the window if all players have acted.
///
/// # Examples
/// ```no_run
/// use mahjong_core::call_resolution::CallIntentKind;
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::playing::declare_call_intent;
///
/// let mut table = Table::new("intent".to_string(), 0);
/// let _ = declare_call_intent(&mut table, Seat::South, CallIntentKind::Mahjong);
/// ```
pub fn declare_call_intent(
    table: &mut Table,
    player: Seat,
    intent: crate::call_resolution::CallIntentKind,
) -> Vec<Event> {
    // Add intent to pending intents in CallWindow
    if let GamePhase::Playing(TurnStage::CallWindow {
        pending_intents,
        can_act,
        ..
    }) = &mut table.phase
    {
        // Sequence uses server arrival order (not client timestamps) for security.
        // Call priority is resolved by seat order, not sequence. See ADR-0007/0020.
        let sequence = pending_intents.len() as u32;

        // Create and add the intent
        let call_intent = crate::call_resolution::CallIntent::new(player, intent, sequence);
        pending_intents.push(call_intent);

        // Remove player from can_act (they've declared their intent)
        can_act.remove(&player);

        // If all players have acted, resolve immediately
        if can_act.is_empty() {
            return resolve_call_window(table);
        }
    }

    vec![]
}

/// Pass during a call window; resolves once all players have acted.
///
/// When a player passes, they're removed from the `can_act` set. Once all players
/// have acted (either by declaring intent or passing), the call window is resolved
/// via `resolve_call_window()` which handles priority adjudication.
///
/// # Examples
/// ```no_run
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::playing::pass;
///
/// let mut table = Table::new("pass".to_string(), 0);
/// let _ = pass(&mut table, Seat::West);
/// ```
pub fn pass(table: &mut Table, player: Seat) -> Vec<Event> {
    // Remove player from can_act set
    if let GamePhase::Playing(TurnStage::CallWindow { can_act, .. }) = &mut table.phase {
        can_act.remove(&player);

        // If all players passed or declared intent, resolve the call window
        if can_act.is_empty() {
            return resolve_call_window(table);
        }
    }

    vec![]
}

/// Resolve the call window by adjudicating pending intents.
///
/// # Examples
/// ```no_run
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::playing::resolve_call_window;
///
/// let mut table = Table::new("resolve".to_string(), 0);
/// let _ = resolve_call_window(&mut table);
/// ```
pub fn resolve_call_window(table: &mut Table) -> Vec<Event> {
    let mut events = vec![];

    if let GamePhase::Playing(TurnStage::CallWindow {
        pending_intents,
        discarded_by,
        tile,
        ..
    }) = &table.phase
    {
        let intents = pending_intents.clone();
        let discarded_by = *discarded_by;
        let tile = *tile;

        // Resolve using priority rules
        let resolution = crate::call_resolution::resolve_calls(&intents, discarded_by);

        events.push(Event::Public(PublicEvent::CallResolved {
            resolution: resolution.clone(),
        }));

        // Process the resolution
        match resolution {
            crate::call_resolution::CallResolution::NoCall => {
                // No one called - advance to next player
                events.push(Event::Public(PublicEvent::CallWindowClosed));

                if let GamePhase::Playing(stage) = &table.phase {
                    if let Ok((next_stage, next_turn)) = stage.next(
                        crate::flow::playing::TurnAction::AllPassed,
                        table.current_turn,
                    ) {
                        table.phase = GamePhase::Playing(next_stage.clone());
                        table.current_turn = next_turn;
                        table.turn_number += 1;
                        events.push(Event::Public(PublicEvent::TurnChanged {
                            player: next_turn,
                            stage: next_stage,
                        }));
                    }
                }
            }
            crate::call_resolution::CallResolution::Meld { seat, meld } => {
                // Process the meld call
                // Remove called tile from discard pile
                if table.discard_pile.last().map(|d| d.tile) == Some(tile) {
                    table.discard_pile.pop();
                }

                // Add meld to player's exposed melds
                if let Some(p) = table.get_player_mut(seat) {
                    let _ = p.hand.expose_meld(meld.clone());
                }

                // Determine if replacement draw is needed (BEFORE moving meld)
                let replacement_reason = match meld.meld_type {
                    MeldType::Kong => Some(ReplacementReason::Kong),
                    MeldType::Quint => Some(ReplacementReason::Quint),
                    MeldType::Sextet => Some(ReplacementReason::Sextet),
                    _ => None,
                };

                events.push(Event::Public(PublicEvent::TileCalled {
                    player: seat,
                    meld,
                    called_tile: tile,
                }));

                // Handle replacement draw for Kong/Quint
                if let Some(reason) = replacement_reason {
                    if let Some(replacement_tile) = table.wall.draw() {
                        // Add to player's hand
                        if let Some(p) = table.get_player_mut(seat) {
                            p.hand.add_tile(replacement_tile);
                        }

                        // Emit replacement draw event (private - only for drawing player)
                        events.push(Event::Private(PrivateEvent::ReplacementDrawn {
                            player: seat,
                            tile: replacement_tile,
                            reason,
                        }));
                    } else {
                        // Wall exhausted during replacement draw
                        events.push(Event::Public(PublicEvent::WallExhausted {
                            remaining_tiles: table.wall.remaining(),
                        }));

                        // Collect all final hands
                        let all_hands: HashMap<Seat, Hand> = table
                            .players
                            .iter()
                            .map(|(seat, p)| (*seat, p.hand.clone()))
                            .collect();

                        // Build draw result
                        let game_result =
                            crate::scoring::build_draw_result(all_hands, table.dealer);

                        let _ = table
                            .transition_phase(PhaseTrigger::WallExhausted(game_result.clone()));

                        events.push(Event::Public(PublicEvent::GameOver {
                            winner: None,
                            result: game_result,
                        }));

                        return events;
                    }
                }

                // Transition to Discarding stage for caller
                if let GamePhase::Playing(stage) = &table.phase {
                    if let Ok((next_stage, next_turn)) = stage.next(
                        crate::flow::playing::TurnAction::Call(seat),
                        table.current_turn,
                    ) {
                        table.phase = GamePhase::Playing(next_stage.clone());
                        table.current_turn = next_turn;
                        table.turn_number += 1;
                        events.push(Event::Public(PublicEvent::TurnChanged {
                            player: next_turn,
                            stage: next_stage,
                        }));
                    }
                }
            }
            crate::call_resolution::CallResolution::Mahjong(seat) => {
                // Mahjong declared - transition to AwaitingMahjong stage
                // Store the discard tile and wait for DeclareMahjong validation
                events.push(Event::Public(PublicEvent::MahjongDeclared { player: seat }));

                // Remove the discard from the pile and store it in the new stage
                if table.discard_pile.last().map(|d| d.tile) == Some(tile) {
                    table.discard_pile.pop();
                }

                // Transition to AwaitingMahjong stage
                let next_stage = TurnStage::AwaitingMahjong {
                    caller: seat,
                    tile,
                    discarded_by,
                };
                table.phase = GamePhase::Playing(next_stage.clone());

                events.push(Event::Public(PublicEvent::TurnChanged {
                    player: seat,
                    stage: next_stage,
                }));

                // Emit event prompting the caller to send DeclareMahjong
                events.push(Event::Public(PublicEvent::AwaitingMahjongValidation {
                    caller: seat,
                    called_tile: tile,
                    discarded_by,
                }));
            }
        }
    }

    events
}
