//! Top-level event wrapper and helper methods.
//!
//! The unified [`Event`] enum exposes classification helpers used by the
//! server to route events to the correct recipients.

use crate::{
    event::{
        analysis_events::AnalysisEvent, private_events::PrivateEvent, public_events::PublicEvent,
    },
    player::Seat,
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Top-level event wrapper containing public, private, and analysis-only events.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum Event {
    /// Broadcast event visible to all players.
    Public(PublicEvent),
    /// Event scoped to a single player or courtesy pair.
    Private(PrivateEvent),
    /// Analysis or hinting event (always private).
    Analysis(AnalysisEvent),
}

impl Event {
    /// True if this event should only be sent to specific client(s).
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::event::{
    ///     Event,
    ///     private_events::PrivateEvent,
    ///     public_events::PublicEvent,
    /// };
    ///
    /// let private_event = Event::Private(PrivateEvent::TilesDealt { your_tiles: vec![] });
    /// let public_event = Event::Public(PublicEvent::GameStarting);
    /// assert!(private_event.is_private());
    /// assert!(!public_event.is_private());
    /// ```
    pub fn is_private(&self) -> bool {
        matches!(self, Self::Private(_) | Self::Analysis(_))
    }

    /// Returns the target player for private events, if the event explicitly names a seat.
    /// Returns `None` when server routing determines the recipient.
    /// Pair-private courtesy events return `None` because delivery targets two seats.
    pub fn target_player(&self) -> Option<Seat> {
        match self {
            Self::Private(PrivateEvent::TilesPassed { player, .. })
            | Self::Private(PrivateEvent::TilesReceived { player, .. })
            | Self::Private(PrivateEvent::ReplacementDrawn { player, .. })
            | Self::Private(PrivateEvent::IncomingTilesStaged { player, .. }) => Some(*player),
            Self::Private(PrivateEvent::TilesDealt { .. })
            | Self::Private(PrivateEvent::TileDrawnPrivate { .. })
            | Self::Private(PrivateEvent::CourtesyPassProposed { .. })
            | Self::Private(PrivateEvent::CourtesyPassMismatch { .. })
            | Self::Private(PrivateEvent::CourtesyPairReady { .. })
            | Self::Analysis(_)
            | Self::Public(_) => None,
        }
    }

    /// Returns `true` if this is an error/rejection event.
    pub fn is_error(&self) -> bool {
        matches!(self, Self::Public(PublicEvent::CommandRejected { .. }))
    }

    /// Returns true if this event is scoped to a particular seat (used for pair-private events).
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::event::{Event, private_events::PrivateEvent};
    /// use mahjong_core::player::Seat;
    ///
    /// let event = Event::Private(PrivateEvent::CourtesyPassProposed {
    ///     player: Seat::East,
    ///     tile_count: 2,
    /// });
    /// assert!(event.is_for_seat(Seat::East));
    /// assert!(event.is_for_seat(Seat::West));
    /// assert!(!event.is_for_seat(Seat::South));
    /// ```
    pub fn is_for_seat(&self, seat: Seat) -> bool {
        match self {
            Self::Private(PrivateEvent::CourtesyPassProposed { player, .. }) => {
                *player == seat || player.across() == seat
            }
            Self::Private(PrivateEvent::CourtesyPassMismatch { pair, .. })
            | Self::Private(PrivateEvent::CourtesyPairReady { pair, .. }) => {
                pair.0 == seat || pair.1 == seat
            }
            Self::Private(PrivateEvent::ReplacementDrawn { player, .. })
            | Self::Private(PrivateEvent::TilesPassed { player, .. })
            | Self::Private(PrivateEvent::TilesReceived { player, .. })
            | Self::Private(PrivateEvent::IncomingTilesStaged { player, .. }) => *player == seat,
            Self::Private(PrivateEvent::TileDrawnPrivate { .. })
            | Self::Private(PrivateEvent::TilesDealt { .. })
            | Self::Analysis(_)
            | Self::Public(_) => false,
        }
    }

    /// Returns the associated player (actor) for the event when available.
    pub fn associated_player(&self) -> Option<Seat> {
        match self {
            Self::Public(
                PublicEvent::PlayerJoined { player, .. }
                | PublicEvent::PlayerReadyForPass { player }
                | PublicEvent::PlayerStagedTile { player, .. }
                | PublicEvent::PlayerVoted { player }
                | PublicEvent::TurnChanged { player, .. }
                | PublicEvent::TileDrawnPublic { player, .. }
                | PublicEvent::TileDiscarded { player, .. }
                | PublicEvent::TileCalled { player, .. }
                | PublicEvent::JokerExchanged { player, .. }
                | PublicEvent::BlankExchanged { player }
                | PublicEvent::MahjongDeclared { player }
                | PublicEvent::HandValidated { player, .. }
                | PublicEvent::PlayerForfeited { player, .. }
                | PublicEvent::CommandRejected { player, .. },
            ) => Some(*player),
            Self::Public(PublicEvent::AwaitingMahjongValidation { caller, .. }) => Some(*caller),
            Self::Public(PublicEvent::GamePaused { by, .. })
            | Self::Public(PublicEvent::GameResumed { by }) => Some(*by),
            Self::Public(PublicEvent::GameOver { winner, .. }) => *winner,
            Self::Public(PublicEvent::AdminForfeitOverride {
                forfeited_player, ..
            }) => Some(*forfeited_player),
            Self::Private(
                PrivateEvent::TilesPassed { player, .. }
                | PrivateEvent::TilesReceived { player, .. }
                | PrivateEvent::ReplacementDrawn { player, .. }
                | PrivateEvent::CourtesyPassProposed { player, .. }
                | PrivateEvent::IncomingTilesStaged { player, .. },
            ) => Some(*player),
            Self::Private(
                PrivateEvent::TilesDealt { .. }
                | PrivateEvent::TileDrawnPrivate { .. }
                | PrivateEvent::CourtesyPassMismatch { .. }
                | PrivateEvent::CourtesyPairReady { .. },
            )
            | Self::Analysis(_) => None,
            Self::Public(_) => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_bindings_event() {
        use ts_rs::TS;
        Event::export().expect("Failed to export Event");
    }
}
