//! Session management for WebSocket connections.
//!
//! This module provides the core session management infrastructure for maintaining
//! player connections and enabling reconnection after temporary disconnects.
//!
//! # Architecture
//!
//! Each connected client has a [`Session`] that tracks:
//! - Player identity (`player_id`, `display_name`)
//! - Authentication state (`session_token`)
//! - Game state (`room_id`, `seat`)
//! - Connection health (`last_pong` timestamp)
//!
//! # Session Lifecycle
//!
//! 1. **Connection**: New guest session created with unique player_id and session_token
//! 2. **Active**: Session stored in `SessionStore.active` map while connected
//! 3. **Disconnect**: Session moved to `SessionStore.stored` map with 5-minute grace period
//! 4. **Reconnection**: Client can restore session using original session_token
//! 5. **Expiration**: Sessions older than 5 minutes are cleaned up by background task
//!
//! # Automatic Cleanup
//!
//! The server spawns a background task (see `main.rs::spawn_session_cleanup_task`) that
//! periodically calls [`SessionStore::cleanup_expired`] to prevent unbounded memory growth.
//! The cleanup interval defaults to 60 seconds and can be configured via the
//! `SESSION_CLEANUP_INTERVAL_SECS` environment variable.
//!
//! # Thread Safety
//!
//! All session storage uses `DashMap` for lock-free concurrent access. Sessions
//! themselves use `Arc<Mutex<Session>>` for safe mutation across async tasks.
//!
//! # Examples
//!
//! ```no_run
//! use mahjong_server::network::session::{SessionStore, StoredSession};
//!
//! // Create a new session store
//! let store = SessionStore::new();
//!
//! // Periodic cleanup (normally done by background task)
//! let cleaned = store.cleanup_expired();
//! if cleaned > 0 {
//!     println!("Removed {} expired sessions", cleaned);
//! }
//! ```
//!
//! # FRONTEND_INTEGRATION_POINT
//!
//! Clients connect via WebSocket and authenticate with either:
//! - Guest authentication (generates new session_token)
//! - Session token reconnection (restores previous session)
//!
//! See [`crate::network::ws_handler`] for WebSocket message protocol.

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
    /// Player identifier associated with the session.
    pub player_id: String,
    /// Display name at the time of disconnect.
    pub display_name: String,
    /// Session token used for reconnection.
    pub session_token: String,
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
/// # Storage Strategy
///
/// The store maintains three concurrent maps:
/// - `active`: Maps `player_id` → `Arc<Mutex<Session>>` for connected clients
/// - `stored`: Maps `session_token` → `StoredSession` for disconnected clients (5-min grace period)
/// - `stored_by_player`: Maps `player_id` → `session_token` for JWT-based reconnection
///
/// # Memory Management
///
/// **IMPORTANT**: Without automatic cleanup, the `stored` and `stored_by_player` maps
/// would grow unbounded as players disconnect. The [`cleanup_expired`] method MUST be
/// called periodically by a background task to prevent memory leaks.
///
/// In production, `main.rs` spawns a background task that calls [`cleanup_expired`]
/// every 60 seconds (configurable via `SESSION_CLEANUP_INTERVAL_SECS`).
///
/// # Concurrency
///
/// All methods are thread-safe and can be called from multiple async tasks simultaneously.
/// Uses [`DashMap`] for lock-free concurrent access with minimal contention.
///
/// [`cleanup_expired`]: SessionStore::cleanup_expired
pub struct SessionStore {
    /// Active sessions by player_id
    active: DashMap<String, Arc<Mutex<Session>>>,
    /// Stored sessions by session_token (for reconnection)
    stored: DashMap<String, StoredSession>,
    /// Stored session token by player_id (for JWT reconnect)
    stored_by_player: DashMap<String, String>,
}

/// Ok tuple returned by `restore_session`.
type RestoreSessionOk = (
    String,
    String,
    String,
    Option<String>,
    Option<Seat>,
    Arc<Mutex<Session>>,
);
/// Err tuple returned by `restore_session` including the unused sender.
type RestoreSessionErr = (String, SplitSink<WebSocket, Message>);

impl SessionStore {
    /// Create a new empty session store.
    pub fn new() -> Self {
        Self {
            active: DashMap::new(),
            stored: DashMap::new(),
            stored_by_player: DashMap::new(),
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
    ) -> Result<RestoreSessionOk, RestoreSessionErr> {
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
            self.stored_by_player.remove(&stored.player_id);
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
        self.stored_by_player.remove(&player_id);
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

            self.stored.insert(token.clone(), stored);
            self.stored_by_player.insert(player_id.to_string(), token);
        }
    }

    /// Clean up expired stored sessions.
    ///
    /// Should be called periodically (e.g., every minute) by a background task.
    ///
    /// # Returns
    ///
    /// Returns the number of sessions that were cleaned up (expired and removed).
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use mahjong_server::network::session::SessionStore;
    ///
    /// let store = SessionStore::new();
    /// // ... sessions are added and some expire ...
    /// let cleaned = store.cleanup_expired();
    /// if cleaned > 0 {
    ///     println!("Cleaned up {} expired sessions", cleaned);
    /// }
    /// ```
    ///
    /// # Implementation Notes
    ///
    /// This method removes sessions where `disconnected_at` is older than
    /// 5 minutes (the grace period). It also removes the corresponding
    /// entries from `stored_by_player` to maintain consistency.
    ///
    /// The cleanup is atomic per-session and thread-safe due to DashMap's
    /// concurrent access guarantees.
    pub fn cleanup_expired(&self) -> usize {
        let mut cleaned = 0;
        self.stored.retain(|_, session| {
            let keep = !session.is_expired();
            if !keep {
                self.stored_by_player.remove(&session.player_id);
                cleaned += 1;
            }
            keep
        });
        cleaned
    }

    /// Restore a session using player_id (JWT reconnect path).
    pub fn take_stored_by_player_id(&self, player_id: &str) -> Option<StoredSession> {
        let token = self.stored_by_player.get(player_id)?.value().clone();
        self.stored_by_player.remove(player_id);
        let stored = self.stored.remove(&token).map(|(_, session)| session)?;
        if stored.is_expired() {
            return None;
        }
        Some(stored)
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

    /// Ensures cleanup removes expired sessions only and returns the count.
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
        store
            .stored_by_player
            .insert("expired-player".to_string(), "expired-token".to_string());

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
        store
            .stored_by_player
            .insert("valid-player".to_string(), "valid-token".to_string());

        assert_eq!(store.stored_count(), 2);

        // Cleanup should remove expired but keep valid, and return count
        let cleaned = store.cleanup_expired();

        assert_eq!(cleaned, 1);
        assert_eq!(store.stored_count(), 1);
        assert!(store.stored.get("valid-token").is_some());
        assert!(store.stored.get("expired-token").is_none());
        // Verify stored_by_player was also cleaned
        assert!(store.stored_by_player.get("expired-player").is_none());
        assert!(store.stored_by_player.get("valid-player").is_some());
    }
}
