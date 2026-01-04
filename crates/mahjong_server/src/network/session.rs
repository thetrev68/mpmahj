//! Session management for WebSocket connections.
//!
//! Each connected client has a Session that tracks:
//! - Player identity (player_id, display_name)
//! - Authentication state (session_token)
//! - Game state (room_id, seat)
//! - Connection health (last_pong timestamp)

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

    /// Convert this session to a StoredSession for persistence.
    pub fn to_stored(&self) -> StoredSession {
        StoredSession {
            player_id: self.player_id.clone(),
            display_name: self.display_name.clone(),
            session_token: self.session_token.clone(),
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
    pub player_id: String,
    pub display_name: String,
    pub session_token: String,
    pub room_id: Option<String>,
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
pub struct SessionStore {
    /// Active sessions by player_id
    active: DashMap<String, Arc<Mutex<Session>>>,
    /// Stored sessions by session_token (for reconnection)
    stored: DashMap<String, StoredSession>,
}

impl SessionStore {
    /// Create a new empty session store.
    pub fn new() -> Self {
        Self {
            active: DashMap::new(),
            stored: DashMap::new(),
        }
    }

    /// Add a new guest session.
    ///
    /// Returns the session data needed for AuthSuccess response.
    pub fn add_guest_session(
        &self,
        session: Session,
    ) -> (String, String, String, Arc<Mutex<Session>>) {
        let player_id = session.player_id.clone();
        let display_name = session.display_name.clone();
        let session_token = session.session_token.clone();

        let session_arc = Arc::new(Mutex::new(session));
        self.active.insert(player_id.clone(), session_arc.clone());

        (player_id, display_name, session_token, session_arc)
    }

    /// Restore a session from a token.
    ///
    /// Returns Ok with session data if token is valid and not expired.
    /// Returns Err if token is invalid or session has expired.
    pub fn restore_session(
        &self,
        token: &str,
        ws_sender: SplitSink<WebSocket, Message>,
    ) -> Result<
        (String, String, String, Option<String>, Option<Seat>, Arc<Mutex<Session>>),
        (String, SplitSink<WebSocket, Message>),
    >
    {
        // Look up stored session by token
        let stored = match self.stored.get(token) {
            Some(entry) => entry.clone(),
            None => {
                return Err(("Invalid session token".to_string(), ws_sender));
            }
        };

        // Check if expired
        if stored.is_expired() {
            self.stored.remove(token);
            return Err(("Session expired".to_string(), ws_sender));
        }

        // Restore session
        let player_id = stored.player_id.clone();
        let display_name = stored.display_name.clone();
        let session_token = stored.session_token.clone();
        let room_id = stored.room_id.clone();
        let seat = stored.seat;

        let session = Session::restore_from_token(&stored, ws_sender);
        let session_arc = Arc::new(Mutex::new(session));

        // Move from stored to active
        self.stored.remove(token);
        self.active.insert(player_id.clone(), session_arc.clone());

        Ok((
            player_id,
            display_name,
            session_token,
            room_id,
            seat,
            session_arc,
        ))
    }

    /// Get an active session by player_id.
    pub fn get_active(&self, player_id: &str) -> Option<Arc<Mutex<Session>>> {
        self.active.get(player_id).map(|entry| entry.clone())
    }

    /// Mark a session as disconnected and move to stored sessions.
    ///
    /// The session will be stored for 5 minutes to allow reconnection.
    pub async fn disconnect_session(&self, player_id: &str) {
        if let Some((_, session_arc)) = self.active.remove(player_id) {
            let mut session = session_arc.lock().await;
            session.disconnect();

            let stored = session.to_stored();
            let token = stored.session_token.clone();

            self.stored.insert(token, stored);
        }
    }

    /// Clean up expired stored sessions.
    ///
    /// Should be called periodically (e.g., every minute).
    pub fn cleanup_expired(&self) {
        self.stored.retain(|_, session| !session.is_expired());
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_store_creation() {
        let store = SessionStore::new();
        assert_eq!(store.active_count(), 0);
        assert_eq!(store.stored_count(), 0);
    }

    #[test]
    fn test_stored_session_expiration() {
        let mut stored = StoredSession {
            player_id: "test-player".to_string(),
            display_name: "Test".to_string(),
            session_token: "token-123".to_string(),
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

    #[test]
    fn test_stored_session_to_session_conversion() {
        let stored = StoredSession {
            player_id: "player-123".to_string(),
            display_name: "TestPlayer".to_string(),
            session_token: "token-456".to_string(),
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

    #[test]
    fn test_cleanup_expired_sessions() {
        let store = SessionStore::new();

        // Add expired session
        let expired = StoredSession {
            player_id: "expired-player".to_string(),
            display_name: "Expired".to_string(),
            session_token: "expired-token".to_string(),
            room_id: None,
            seat: None,
            disconnected_at: Some(Utc::now() - chrono::Duration::minutes(10)),
        };
        store.stored.insert("expired-token".to_string(), expired);

        // Add valid session
        let valid = StoredSession {
            player_id: "valid-player".to_string(),
            display_name: "Valid".to_string(),
            session_token: "valid-token".to_string(),
            room_id: None,
            seat: None,
            disconnected_at: Some(Utc::now() - chrono::Duration::minutes(2)),
        };
        store.stored.insert("valid-token".to_string(), valid);

        assert_eq!(store.stored_count(), 2);

        // Cleanup should remove expired but keep valid
        store.cleanup_expired();

        assert_eq!(store.stored_count(), 1);
        assert!(store.stored.get("valid-token").is_some());
        assert!(store.stored.get("expired-token").is_none());
    }
}
