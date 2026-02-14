//! Event delivery and visibility constraints.
//!
//! This module defines how events are delivered to clients based on game state and visibility rules.
//! It is owned by the server boundary (mahjong_server) rather than mahjong_core because delivery
//! concerns depend on connection/session context, while core `Event` types represent only
//! *what happened* in the game.
//!
//! # Events and Visibility
//!
//! - **Public events**: Broadcast to all players (e.g., "North discarded 5B").
//! - **Private events**: Delivered only to targeted player (e.g., "Your hidden tile is 3C").
//!
//! # Persistence
//!
//! `EventVisibility` is persisted to the database and used during replay to reconstruct
//! which players would have seen which events.

use mahjong_core::player::Seat;

/// Delivery metadata for events.
///
/// This is intentionally owned by the server boundary (mahjong_server): the core
/// `Event` type represents *what happened*, while delivery concerns (who can
/// see an event) depend on connection/session context.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EventVisibility {
    /// Visible to all players.
    Public,
    /// Visible only to the targeted player.
    Private,
}

impl EventVisibility {
    /// Returns the string representation used by the database.
    #[cfg(feature = "database")]
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Public => "public",
            Self::Private => "private",
        }
    }
}

/// Where an event is delivered.
///
/// - Public events are broadcast to all players.
/// - Private events are delivered only to `target_player`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EventDelivery {
    /// Visibility level to apply in persistence and replay.
    pub visibility: EventVisibility,
    /// Targeted player for private events.
    pub target_player: Option<Seat>,
}

impl EventDelivery {
    /// Creates a delivery descriptor for public broadcasts.
    #[must_use]
    pub fn broadcast() -> Self {
        Self {
            visibility: EventVisibility::Public,
            target_player: None,
        }
    }

    /// Creates a delivery descriptor for a private event.
    #[must_use]
    pub fn unicast(target_player: Seat) -> Self {
        Self {
            visibility: EventVisibility::Private,
            target_player: Some(target_player),
        }
    }

    /// Returns the string stored in the database for the target player.
    #[cfg(feature = "database")]
    pub(crate) fn target_player_db_value(self) -> Option<String> {
        self.target_player.map(|s| format!("{:?}", s))
    }
}
