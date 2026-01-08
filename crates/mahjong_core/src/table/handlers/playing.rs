use crate::event::GameEvent;
use crate::flow::{GamePhase, PhaseTrigger, TurnAction, TurnStage};
use crate::hand::Hand;
use crate::meld::Meld;
use crate::player::Seat;
use crate::table::types::DiscardedTile;
use crate::table::Table;
use crate::tile::Tile;
use std::collections::HashMap;

pub fn draw_tile(table: &mut Table, player: Seat) -> Vec<GameEvent> {
    let mut events = vec![];

    if let Some(tile) = table.wall.draw() {
        // Add tile to player's hand
        if let Some(p) = table.get_player_mut(player) {
            p.hand.add_tile(tile);
        }

        // Private event for drawer (includes tile)
        events.push(GameEvent::TileDrawn {
            tile: Some(tile),
            remaining_tiles: table.wall.remaining(),
        });

        // Public event for others (tile hidden)
        events.push(GameEvent::TileDrawn {
            tile: None,
            remaining_tiles: table.wall.remaining(),
        });

        // Transition to Discarding stage
        if let GamePhase::Playing(stage) = &table.phase {
            if let Ok((next_stage, next_turn)) = stage.next(TurnAction::Draw, table.current_turn) {
                table.phase = GamePhase::Playing(next_stage.clone());
                table.current_turn = next_turn;
                events.push(GameEvent::TurnChanged {
                    player: next_turn,
                    stage: next_stage,
                });
            }
        }
    } else {
        // Wall exhausted - game ends in a draw
        events.push(GameEvent::WallExhausted {
            remaining_tiles: table.wall.remaining(),
        });

        // Collect all final hands
        let all_hands: HashMap<Seat, Hand> = table
            .players
            .iter()
            .map(|(seat, p)| (*seat, p.hand.clone()))
            .collect();

        // Build draw result
        let game_result = crate::scoring::build_draw_result(all_hands, table.dealer);

        let _ = table.transition_phase(PhaseTrigger::WallExhausted(game_result.clone()));

        events.push(GameEvent::GameOver {
            winner: None,
            result: game_result,
        });
    }

    events
}

pub fn discard_tile(table: &mut Table, player: Seat, tile: Tile) -> Vec<GameEvent> {
    let mut events = vec![];

    // Remove tile from player's hand
    if let Some(p) = table.get_player_mut(player) {
        let _ = p.hand.remove_tile(tile);
    }

    // Add to discard pile
    table.discard_pile.push(DiscardedTile {
        tile,
        discarded_by: player,
    });

    events.push(GameEvent::TileDiscarded { player, tile });

    // Open call window
    if let GamePhase::Playing(stage) = &table.phase {
        if let Ok((next_stage, _)) = stage.next(TurnAction::Discard(tile), table.current_turn) {
            table.phase = GamePhase::Playing(next_stage.clone());

            // Emit call window event
            if let TurnStage::CallWindow {
                tile,
                discarded_by,
                can_act,
                ..
            } = &next_stage
            {
                events.push(GameEvent::CallWindowOpened {
                    tile: *tile,
                    discarded_by: *discarded_by,
                    can_call: can_act.iter().copied().collect(),
                });
            }
        }
    }

    events
}

pub fn declare_call_intent(
    table: &mut Table,
    player: Seat,
    intent: crate::call_resolution::CallIntentKind,
) -> Vec<GameEvent> {
    // Add intent to pending intents in CallWindow
    if let GamePhase::Playing(TurnStage::CallWindow {
        pending_intents,
        can_act,
        ..
    }) = &mut table.phase
    {
        // Get next sequence number
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

pub fn call_tile(table: &mut Table, player: Seat, meld: Meld) -> Vec<GameEvent> {
    let mut events = vec![];

    // Get the called tile (last discard)
    let called_tile = if let Some(last) = table.discard_pile.last() {
        last.tile
    } else {
        return vec![];
    };

    // Remove called tile from discard pile
    table.discard_pile.pop();

    // Add meld to player's exposed melds
    if let Some(p) = table.get_player_mut(player) {
        let _ = p.hand.expose_meld(meld.clone());
    }

    events.push(GameEvent::TileCalled {
        player,
        meld,
        called_tile,
    });

    // Transition to Discarding stage for caller
    if let GamePhase::Playing(stage) = &table.phase {
        if let Ok((next_stage, next_turn)) =
            stage.next(TurnAction::Call(player), table.current_turn)
        {
            table.phase = GamePhase::Playing(next_stage.clone());
            table.current_turn = next_turn;
            events.push(GameEvent::TurnChanged {
                player: next_turn,
                stage: next_stage,
            });
        }
    }

    events
}

pub fn pass(table: &mut Table, player: Seat) -> Vec<GameEvent> {
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
pub fn resolve_call_window(table: &mut Table) -> Vec<GameEvent> {
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

        events.push(GameEvent::CallResolved {
            resolution: resolution.clone(),
        });

        // Process the resolution
        match resolution {
            crate::call_resolution::CallResolution::NoCall => {
                // No one called - advance to next player
                events.push(GameEvent::CallWindowClosed);

                if let GamePhase::Playing(stage) = &table.phase {
                    if let Ok((next_stage, next_turn)) =
                        stage.next(crate::flow::TurnAction::AllPassed, table.current_turn)
                    {
                        table.phase = GamePhase::Playing(next_stage.clone());
                        table.current_turn = next_turn;
                        events.push(GameEvent::TurnChanged {
                            player: next_turn,
                            stage: next_stage,
                        });
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

                events.push(GameEvent::TileCalled {
                    player: seat,
                    meld,
                    called_tile: tile,
                });

                // Transition to Discarding stage for caller
                if let GamePhase::Playing(stage) = &table.phase {
                    if let Ok((next_stage, next_turn)) =
                        stage.next(crate::flow::TurnAction::Call(seat), table.current_turn)
                    {
                        table.phase = GamePhase::Playing(next_stage.clone());
                        table.current_turn = next_turn;
                        events.push(GameEvent::TurnChanged {
                            player: next_turn,
                            stage: next_stage,
                        });
                    }
                }
            }
            crate::call_resolution::CallResolution::Mahjong(seat) => {
                // Mahjong declared - transition to scoring
                // The actual hand validation will be done when DeclareMahjong command is processed
                // For now, just record that someone won via call
                events.push(GameEvent::MahjongDeclared { player: seat });

                // Note: Full win processing should happen through DeclareMahjong command
                // This path is for when Mahjong is declared via call intent
            }
        }
    }

    events
}
