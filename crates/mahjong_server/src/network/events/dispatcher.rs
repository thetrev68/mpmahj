//! Event dispatch boundary for room event workflows.

use crate::event_delivery::EventDelivery;
use crate::network::events::RoomEvents;
use crate::network::messages::Envelope;
use crate::network::room::Room;
use mahjong_core::event::Event;

/// Dispatch a room event using existing `RoomEvents` behavior.
pub async fn dispatch_room_event(room: &mut Room, event: Event, delivery: EventDelivery) {
    room.broadcast_event(event, delivery).await;
}

/// Helper used by replay/storage boundaries without changing existing behavior.
#[allow(dead_code)]
pub fn envelope_from_event(event: Event) -> Envelope {
    Envelope::event(event)
}
