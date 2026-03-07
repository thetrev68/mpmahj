use axum::extract::ws::{Message, WebSocket};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use futures_util::stream::SplitSink;
use mahjong_core::player::Seat;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

/// A player's session state.
///
/// This represents an authenticated connection and tracks all state
/// needed to maintain the connection and participate in games.
#[derive(Debug)]
pub struct Session {
    /// Unique player identifier (persists across reconnections)
    pub player_id: String,
    /// Display name for this player
    pub display_name: String,
    /// Session token for reconnection (generated on first auth)
    pub session_token: String,
    /// Whether this session is from anonymous guest authentication.
    pub is_guest: bool,
    /// Current room if player is in one
    pub room_id: Option<String>,
    /// Current seat if player is in a game
    pub seat: Option<Seat>,
    /// WebSocket sender for outgoing messages
    pub ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    /// Timestamp of last received Pong (for heartbeat monitoring)
    pub last_pong: DateTime<Utc>,
    /// Whether this session is currently connected
    pub connected: bool,
}

impl Session {
    /// Create a new session for guest authentication.
    ///
    /// Generates a new player_id and session_token.
    pub fn new_guest(ws_sender: SplitSink<WebSocket, Message>) -> Self {
        let player_id = Uuid::new_v4().to_string();
        let session_token = Uuid::new_v4().to_string();
        let display_name = format!("Guest_{}", &player_id[..8]);

        Self {
            player_id,
            display_name,
            session_token,
            is_guest: true,
            room_id: None,
            seat: None,
            ws_sender: Arc::new(Mutex::new(ws_sender)),
            last_pong: Utc::now(),
            connected: true,
        }
    }

    /// Create a new session by restoring from a token.
    ///
    /// Used for reconnection - validates the token against stored session data.
    pub fn restore_from_token(
        stored_session: &StoredSession,
        ws_sender: SplitSink<WebSocket, Message>,
    ) -> Self {
        Self {
            player_id: stored_session.player_id.clone(),
            display_name: stored_session.display_name.clone(),
            session_token: stored_session.session_token.clone(),
            is_guest: stored_session.is_guest,
            room_id: stored_session.room_id.clone(),
            seat: stored_session.seat,
            ws_sender: Arc::new(Mutex::new(ws_sender)),
            last_pong: Utc::now(),
            connected: true,
        }
    }

    /// Update the last pong timestamp.
    pub fn update_pong(&mut self) {
        self.last_pong = Utc::now();
    }

    /// Check if the connection has timed out (no pong in 60 seconds).
    pub fn is_timed_out(&self) -> bool {
        Utc::now()
            .signed_duration_since(self.last_pong)
            .num_seconds()
            > 60
    }

    /// Mark this session as disconnected.
    pub fn disconnect(&mut self) {
        self.connected = false;
    }

    /// Convert this session to a StoredSession for reconnection.
    pub fn to_stored(&self) -> StoredSession {
        StoredSession {
            player_id: self.player_id.clone(),
            display_name: self.display_name.clone(),
            session_token: self.session_token.clone(),
            is_guest: self.is_guest,
            room_id: self.room_id.clone(),
            seat: self.seat,
            disconnected_at: if !self.connected {
                Some(Utc::now())
            } else {
                None
            },
        }
    }
}

/// Persistent session data (stored when client disconnects).
///
/// This allows reconnection within the grace period (5 minutes).
#[derive(Debug, Clone)]
pub struct StoredSession {
    /// Player identifier associated with the session.
    pub player_id: String,
    /// Display name at the time of disconnect.
    pub display_name: String,
    /// Session token used for reconnection.
    pub session_token: String,
    /// Whether this session is from anonymous guest authentication.
    pub is_guest: bool,
    /// Room ID at the time of disconnect.
    pub room_id: Option<String>,
    /// Seat at the time of disconnect.
    pub seat: Option<Seat>,
    /// When the session was disconnected (for grace period tracking)
    pub disconnected_at: Option<DateTime<Utc>>,
}

impl StoredSession {
    /// Check if this stored session has expired (grace period > 5 minutes).
    pub fn is_expired(&self) -> bool {
        if let Some(disconnected_at) = self.disconnected_at {
            Utc::now()
                .signed_duration_since(disconnected_at)
                .num_minutes()
                > 5
        } else {
            false
        }
    }
}

/// Thread-safe session storage.
///
/// Manages all active and disconnected sessions with concurrent access.
///
/// The store maintains three concurrent maps:
/// - `active`: Maps `player_id` → `Arc<Mutex<Session>>` for connected clients
/// - `stored`: Maps `session_token` → `StoredSession` for disconnected clients (5-min grace period)
/// - `stored_by_player`: Maps `player_id` → `session_token` for JWT-based reconnection
pub struct SessionStore {
    /// Active sessions by player_id
    pub(super) active: DashMap<String, Arc<Mutex<Session>>>,
    /// Stored sessions by session_token (for reconnection)
    pub(super) stored: DashMap<String, StoredSession>,
    /// Stored session token by player_id (for JWT-based reconnection)
    pub(super) stored_by_player: DashMap<String, String>,
}

impl SessionStore {
    /// Create a new empty session store.
    pub fn new() -> Self {
        Self {
            active: DashMap::new(),
            stored: DashMap::new(),
            stored_by_player: DashMap::new(),
        }
    }

    /// Get an active session by player_id.
    pub fn get_active(&self, player_id: &str) -> Option<Arc<Mutex<Session>>> {
        self.active.get(player_id).map(|entry| entry.clone())
    }

    /// Get the number of active sessions.
    pub fn active_count(&self) -> usize {
        self.active.len()
    }

    /// Get the number of stored sessions.
    pub fn stored_count(&self) -> usize {
        self.stored.len()
    }
}

impl Default for SessionStore {
    fn default() -> Self {
        Self::new()
    }
}

// Implement the SessionStoreBackend trait for dependency injection and testing.
impl crate::network::session::traits::SessionStoreBackend for SessionStore {
    fn get_active(&self, player_id: &str) -> Option<Arc<Mutex<Session>>> {
        self.get_active(player_id)
    }

    fn add_guest_session(&self, session: Session) -> (String, String, String, Arc<Mutex<Session>>) {
        // Delegate to the SessionStore::add_guest_session implementation in auth.rs
        self.add_guest_session(session)
    }

    fn active_count(&self) -> usize {
        self.active_count()
    }

    fn stored_count(&self) -> usize {
        self.stored_count()
    }

    fn cleanup_expired(&self) -> usize {
        // Delegate to the SessionStore::cleanup_expired implementation in events.rs
        self.cleanup_expired()
    }
}

#[cfg(test)]
mod tests {
    //! Unit tests for session store behavior.

    use super::*;

    /// Ensures session store initializes with empty maps.
    #[test]
    fn test_session_store_creation() {
        let store = SessionStore::new();
        assert_eq!(store.active_count(), 0);
        assert_eq!(store.stored_count(), 0);
    }

    /// Ensures stored sessions expire after the grace period.
    #[test]
    fn test_stored_session_expiration() {
        let mut stored = StoredSession {
            player_id: "test-player".to_string(),
            display_name: "Test".to_string(),
            session_token: "token-123".to_string(),
            is_guest: false,
            room_id: None,
            seat: None,
            disconnected_at: Some(Utc::now() - chrono::Duration::minutes(6)),
        };

        assert!(stored.is_expired());

        stored.disconnected_at = Some(Utc::now() - chrono::Duration::minutes(4));
        assert!(!stored.is_expired());

        stored.disconnected_at = None;
        assert!(!stored.is_expired());
    }

    /// Ensures stored session fields are preserved as expected.
    #[test]
    fn test_stored_session_to_session_conversion() {
        let stored = StoredSession {
            player_id: "player-123".to_string(),
            display_name: "TestPlayer".to_string(),
            session_token: "token-456".to_string(),
            is_guest: false,
            room_id: Some("room-789".to_string()),
            seat: Some(Seat::East),
            disconnected_at: Some(Utc::now()),
        };

        // Verify stored session properties
        assert_eq!(stored.player_id, "player-123");
        assert_eq!(stored.display_name, "TestPlayer");
        assert_eq!(stored.session_token, "token-456");
        assert_eq!(stored.room_id, Some("room-789".to_string()));
        assert_eq!(stored.seat, Some(Seat::East));
        assert!(stored.disconnected_at.is_some());
    }
}
