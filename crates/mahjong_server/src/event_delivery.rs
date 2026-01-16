use mahjong_core::player::Seat;

/// Delivery metadata for events.
///
/// This is intentionally owned by the server boundary (mahjong_server): the core
/// `GameEvent` type represents *what happened*, while delivery concerns (who can
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
    pub(crate) fn target_player_db_value(self) -> Option<String> {
        self.target_player.map(|s| format!("{:?}", s))
    }
}
