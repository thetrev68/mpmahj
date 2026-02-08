use crate::{
    event::{private_events::PrivateEvent, public_events::PublicEvent, Event},
    flow::playing::TurnStage,
    flow::GamePhase,
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
/// use mahjong_core::event::Event;
/// use mahjong_core::table::Table;
///
/// let mut table = Table::new("replay".to_string(), 0);
/// let event = Event::Public(mahjong_core::event::public_events::PublicEvent::GameStarting);
/// let _ = mahjong_core::table::replay::apply_event(&mut table, event);
/// ```
pub fn apply_event(table: &mut Table, event: Event) -> Result<(), String> {
    match event {
        Event::Private(PrivateEvent::TileDrawnPrivate { tile, .. }) => {
            // Tile draw events do not contain player seat, so we use current_turn.
            if let Some(p) = table.get_player_mut(table.current_turn) {
                p.hand.add_tile(tile);
            }
            table.wall.draw_index += 1;
            Ok(())
        }
        Event::Public(PublicEvent::TileDrawnPublic { .. }) => {
            table.wall.draw_index += 1;
            Ok(())
        }
        Event::Private(PrivateEvent::ReplacementDrawn { player, tile, .. }) => {
            if let Some(p) = table.get_player_mut(player) {
                p.hand.add_tile(tile);
            }
            table.wall.draw_index += 1;
            Ok(())
        }
        Event::Public(PublicEvent::TileDiscarded { player, tile }) => {
            if let Some(p) = table.get_player_mut(player) {
                let _ = p.hand.remove_tile(tile);
            }
            table.discard_pile.push(DiscardedTile {
                tile,
                discarded_by: player,
            });
            Ok(())
        }
        Event::Private(PrivateEvent::TilesReceived { player, tiles, .. }) => {
            if let Some(p) = table.get_player_mut(player) {
                for tile in tiles {
                    p.hand.add_tile(tile);
                }
            }
            Ok(())
        }
        Event::Private(PrivateEvent::TilesPassed { player, tiles }) => {
            if let Some(p) = table.get_player_mut(player) {
                for tile in tiles {
                    let _ = p.hand.remove_tile(tile);
                }
            }
            Ok(())
        }
        Event::Public(PublicEvent::CharlestonPhaseChanged { stage, .. }) => {
            if let Some(cs) = &mut table.charleston_state {
                cs.stage = stage;
            }
            Ok(())
        }
        Event::Public(PublicEvent::PhaseChanged { phase, .. }) => {
            table.phase = phase;
            if let GamePhase::Charleston(stage) = &table.phase {
                if table.charleston_state.is_none() {
                    table.charleston_state = Some(crate::flow::charleston::CharlestonState::new(0));
                }
                if let Some(cs) = &mut table.charleston_state {
                    cs.stage = *stage;
                }
            }
            Ok(())
        }
        Event::Public(PublicEvent::TurnChanged { player, stage }) => {
            table.current_turn = player;
            if let GamePhase::Playing(ref mut s) = table.phase {
                *s = stage;
            }
            Ok(())
        }
        Event::Public(PublicEvent::CallWindowOpened {
            tile,
            discarded_by,
            can_call,
            ..
        }) => {
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
        Event::Public(PublicEvent::CallResolved { resolution, .. }) => {
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
        // Pause/resume/forfeit events are server-level meta-events that don't modify table state.
        // They're tracked in history and persisted, but don't require state changes in replay.
        Event::Public(
            PublicEvent::GamePaused { .. }
            | PublicEvent::GameResumed { .. }
            | PublicEvent::PlayerForfeited { .. }
            | PublicEvent::AdminForfeitOverride { .. }
            | PublicEvent::AdminPauseOverride { .. }
            | PublicEvent::AdminResumeOverride { .. },
        ) => Ok(()),
        _ => Ok(()),
    }
}
