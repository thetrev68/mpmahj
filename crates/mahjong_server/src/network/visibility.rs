//! Event delivery visibility helpers.
//!
//! ```no_run
//! use mahjong_server::network::visibility::compute_event_delivery;
//! use mahjong_core::{command::GameCommand, event::Event, player::Seat};
//! let event = Event::Public(mahjong_core::event::public_events::PublicEvent::CallWindowClosed);
//! let command = GameCommand::RequestState { player: Seat::East };
//! let mut dealt = Seat::all().into_iter();
//! let _ = compute_event_delivery(&event, &command, Seat::East, &mut dealt);
//! ```
use crate::event_delivery::EventDelivery;
use mahjong_core::{
    command::GameCommand,
    event::{private_events::PrivateEvent, Event},
    player::Seat,
};

/// Computes delivery metadata for a game event.
pub fn compute_event_delivery<I: Iterator<Item = Seat>>(
    event: &Event,
    command: &GameCommand,
    current_turn_after: Seat,
    dealt_targets: &mut I,
) -> Option<EventDelivery> {
    // Pair-scoped events (courtesy pass) are treated as broadcasts, but the
    // event itself has is_for_seat() logic to filter visibility per seat
    // This way the server can broadcast and the event filtering happens naturally
    if let Event::Private(
        PrivateEvent::CourtesyPassProposed { .. }
        | PrivateEvent::CourtesyPassMismatch { .. }
        | PrivateEvent::CourtesyPairReady { .. },
    ) = event
    {
        // These are pair-private but we broadcast them and let the
        // event's is_for_seat() method handle filtering
        return Some(EventDelivery::broadcast());
    }

    if !event.is_private() {
        return Some(EventDelivery::broadcast());
    }

    match event {
        // Seat is explicit in the event.
        Event::Private(
            PrivateEvent::TilesReceived { player, .. }
            | PrivateEvent::TilesPassed { player, .. }
            | PrivateEvent::ReplacementDrawn { player, .. },
        ) => Some(EventDelivery::unicast(*player)),

        // Seat is not embedded; infer from command/table context.
        Event::Private(PrivateEvent::TileDrawnPrivate { .. }) => {
            let target = match command {
                GameCommand::DrawTile { player } => *player,
                _ => current_turn_after,
            };
            Some(EventDelivery::unicast(target))
        }

        // Core emits TilesDealt in Seat::all() order during dealing.
        Event::Private(PrivateEvent::TilesDealt { .. }) => {
            dealt_targets.next().map(EventDelivery::unicast)
        }

        _ => None,
    }
}
