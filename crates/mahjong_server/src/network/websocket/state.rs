//! Shared state for WebSocket network operations.
//!
//! This module defines [`NetworkState`], the core state container for
//! WebSocket handlers. It manages:
//! - Active and disconnected sessions ([`SessionStore`])
//! - Game rooms ([`RoomStore`])
//! - Rate limiting ([`RateLimitStore`])
//! - Optional persistence (database) and authentication

use std::sync::Arc;

use super::super::{rate_limit::RateLimitStore, session::SessionStore, RoomStore};
use crate::auth::AuthState;
#[cfg(feature = "database")]
use crate::db::Database;

/// Shared application state for WebSocket handlers.
///
/// This struct contains all shared state needed for WebSocket connection handling,
/// including session management, room management, rate limiting, and optional
/// persistence and authentication support.
///
/// # Examples
///
/// ```
/// use mahjong_server::network::NetworkState;
///
/// // Create state without persistence or auth
/// let state = NetworkState::new();
/// ```
///
/// ```
/// # #[cfg(feature = "database")]
/// # {
/// use mahjong_server::network::NetworkState;
/// # use mahjong_server::db::Database;
/// # use mahjong_server::auth::AuthState;
/// # async fn example() {
/// # let db = Database::new("test.db").await.unwrap();
/// # let auth = AuthState::new("secret".to_string());
///
/// // Create state with persistence and auth enabled
/// let state = NetworkState::new_with_db(db, auth);
/// # }
/// # }
/// ```
pub struct NetworkState {
    /// Session store for active and disconnected sessions.
    pub sessions: Arc<SessionStore>,
    /// Room store for active game rooms.
    pub rooms: Arc<RoomStore>,
    /// Rate limiting state for WebSocket actions.
    pub rate_limits: Arc<RateLimitStore>,
    /// Optional database handle for persistence.
    #[cfg(feature = "database")]
    pub db: Option<Database>,
    /// Optional auth state for JWT validation.
    pub auth: Option<AuthState>,
}

impl NetworkState {
    /// Creates a new network state without persistence or auth.
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_server::network::NetworkState;
    ///
    /// let state = NetworkState::new();
    /// assert_eq!(state.sessions.active_count(), 0);
    /// ```
    pub fn new() -> Self {
        #[cfg(test)]
        let auth = Some(AuthState::new("http://localhost:54321".to_string(), None));

        #[cfg(not(test))]
        let auth = None;

        Self {
            sessions: Arc::new(SessionStore::new()),
            rooms: Arc::new(RoomStore::new()),
            rate_limits: Arc::new(RateLimitStore::new()),
            #[cfg(feature = "database")]
            db: None,
            auth,
        }
    }

    /// Creates a new network state with persistence and auth enabled.
    ///
    /// # Examples
    ///
    /// ```
    /// # #[cfg(feature = "database")]
    /// # {
    /// use mahjong_server::network::NetworkState;
    /// # use mahjong_server::db::Database;
    /// # use mahjong_server::auth::AuthState;
    /// # async fn example() {
    /// # let db = Database::new("test.db").await.unwrap();
    /// # let auth = AuthState::new("secret".to_string());
    ///
    /// let state = NetworkState::new_with_db(db, auth);
    /// # }
    /// # }
    /// ```
    #[cfg(feature = "database")]
    pub fn new_with_db(db: Database, auth: AuthState) -> Self {
        Self {
            sessions: Arc::new(SessionStore::new()),
            rooms: Arc::new(RoomStore::new()),
            rate_limits: Arc::new(RateLimitStore::new()),
            db: Some(db),
            auth: Some(auth),
        }
    }

    /// Creates a new network state with JWT auth enabled but without persistence.
    ///
    /// Useful for local development when database connectivity is unavailable but
    /// authentication should still be enforced.
    pub fn new_with_auth(auth: AuthState) -> Self {
        Self {
            sessions: Arc::new(SessionStore::new()),
            rooms: Arc::new(RoomStore::new()),
            rate_limits: Arc::new(RateLimitStore::new()),
            #[cfg(feature = "database")]
            db: None,
            auth: Some(auth),
        }
    }
}

impl Default for NetworkState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Ensures the state initializes with empty stores.
    #[test]
    fn test_network_state_creation() {
        let state = NetworkState::new();
        // Verify state is initialized
        assert_eq!(state.sessions.active_count(), 0);
        assert_eq!(state.sessions.stored_count(), 0);
    }

    /// Ensures Default delegates to the standard constructor.
    #[test]
    fn test_network_state_default() {
        let state = NetworkState::default();
        assert_eq!(state.sessions.active_count(), 0);
    }
}
