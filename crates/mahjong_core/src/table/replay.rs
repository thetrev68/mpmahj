use crate::{
    event::GameEvent,
    flow::{GamePhase, TurnStage},
    table::{DiscardedTile, Table},
};

/// Apply an event directly to the table state (for replay reconstruction).
///
/// This bypasses command validation and should only be used when rebuilding
/// a table from a known-good event stream.
///
/// # Errors
/// Returns a string if an event cannot be applied to the current state.
///
/// # Examples
/// ```
/// use mahjong_core::event::GameEvent;
/// use mahjong_core::table::Table;
///
/// let mut table = Table::new("replay".to_string(), 0);
/// let event = GameEvent::GameStarting;
/// let _ = mahjong_core::table::replay::apply_event(&mut table, event);
/// ```
pub fn apply_event(table: &mut Table, event: GameEvent) -> Result<(), String> {
    match event {
        GameEvent::TileDrawn { tile, .. } => {
            // TileDrawn event does not contain player seat, so we use current_turn
            if let Some(t) = tile {
                if let Some(p) = table.get_player_mut(table.current_turn) {
                    p.hand.add_tile(t);
                }
            }
            table.wall.draw_index += 1;
            Ok(())
        }
        GameEvent::ReplacementDrawn { player, tile, .. } => {
            if let Some(p) = table.get_player_mut(player) {
                p.hand.add_tile(tile);
            }
            table.wall.draw_index += 1;
            Ok(())
        }
        GameEvent::TileDiscarded { player, tile } => {
            if let Some(p) = table.get_player_mut(player) {
                let _ = p.hand.remove_tile(tile);
            }
            table.discard_pile.push(DiscardedTile {
                tile,
                discarded_by: player,
            });
            Ok(())
        }
        GameEvent::TilesReceived { player, tiles, .. } => {
            if let Some(p) = table.get_player_mut(player) {
                for tile in tiles {
                    p.hand.add_tile(tile);
                }
            }
            Ok(())
        }
        GameEvent::TilesPassed { player, tiles } => {
            if let Some(p) = table.get_player_mut(player) {
                for tile in tiles {
                    let _ = p.hand.remove_tile(tile);
                }
            }
            Ok(())
        }
        GameEvent::CharlestonPhaseChanged { stage, .. } => {
            if let Some(cs) = &mut table.charleston_state {
                cs.stage = stage;
            }
            Ok(())
        }
        GameEvent::PhaseChanged { phase, .. } => {
            table.phase = phase;
            if let GamePhase::Charleston(stage) = &table.phase {
                if table.charleston_state.is_none() {
                    table.charleston_state = Some(crate::flow::CharlestonState::new(0));
                }
                if let Some(cs) = &mut table.charleston_state {
                    cs.stage = *stage;
                }
            }
            Ok(())
        }
        GameEvent::TurnChanged { player, stage } => {
            table.current_turn = player;
            if let GamePhase::Playing(ref mut s) = table.phase {
                *s = stage;
            }
            Ok(())
        }
        GameEvent::CallWindowOpened {
            tile,
            discarded_by,
            can_call,
            ..
        } => {
            if let GamePhase::Playing(ref mut stage) = table.phase {
                *stage = TurnStage::CallWindow {
                    tile,
                    discarded_by,
                    can_act: can_call.into_iter().collect(),
                    pending_intents: Vec::new(),
                    timer: 0,
                };
            }
            Ok(())
        }
        GameEvent::CallResolved { resolution } => {
            if let crate::call_resolution::CallResolution::Meld { seat, meld } = resolution {
                if let Some(called) = meld.called_tile {
                    if table.discard_pile.last().map(|d| d.tile) == Some(called) {
                        table.discard_pile.pop();
                    }
                }
                if let Some(p) = table.get_player_mut(seat) {
                    let _ = p.hand.expose_meld(meld);
                }
                if let GamePhase::Playing(ref mut stage) = table.phase {
                    *stage = TurnStage::Discarding { player: seat };
                }
            }
            Ok(())
        }
        _ => Ok(()),
    }
}
