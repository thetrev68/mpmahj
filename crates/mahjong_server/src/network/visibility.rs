use crate::db::EventDelivery;
use mahjong_core::{command::GameCommand, event::GameEvent, player::Seat};

pub fn compute_event_delivery<I: Iterator<Item = Seat>>(
    event: &GameEvent,
    command: &GameCommand,
    current_turn_after: Seat,
    dealt_targets: &mut I,
) -> Option<EventDelivery> {
    if !event.is_private() {
        return Some(EventDelivery::broadcast());
    }

    match event {
        // Seat is explicit in the event.
        GameEvent::TilesReceived { player, .. } => Some(EventDelivery::unicast(*player)),

        // Seat is not embedded; infer from command/table context.
        GameEvent::TileDrawn { tile: Some(_), .. } => {
            let target = match command {
                GameCommand::DrawTile { player } => *player,
                _ => current_turn_after,
            };
            Some(EventDelivery::unicast(target))
        }

        // Core emits TilesDealt in Seat::all() order during dealing.
        GameEvent::TilesDealt { .. } => dealt_targets.next().map(EventDelivery::unicast),

        _ => None,
    }
}
