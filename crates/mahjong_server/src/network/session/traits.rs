//! Trait definitions for session storage abstraction.
//!
//! These traits enable pluggable session backends, supporting both in-memory
//! and distributed (Redis, Postgres) implementations for horizontally scaled deployments.
//!
//! # Motivation
//!
//! In single-instance deployments, in-memory session storage is efficient.
//! In multi-instance deployments, sessions must be shared across instances
//! to support reconnection after failover and consistent rate limiting.
//!
//! # Implementation Guidelines
//!
//! ## In-Memory Implementation
//! - Use `DashMap` for concurrent access
//! - Local cleanup task for expired sessions
//! - Suitable for single-instance or sticky-session deployments
//!
//! ## Distributed Implementation (Redis/Postgres)
//! - Use external store with connection pooling
//! - TTL for automatic session expiration
//! - Pub/sub or event stream for cleanup coordination
//! - Required for true horizontal scaling
//!
//! # Migration Path
//!
//! The default implementation uses in-memory storage. To support horizontal scaling:
//!
//! 1. **Sticky sessions** (short-term solution): Configure load balancer to route reconnections
//!    to the same instance where the player originally connected.
//!
//! 2. **Redis** (recommended): Add Redis dependency, implement trait for Redis backend,
//!    update `main.rs` to use conditional compilation or env-based selection.
//!
//! 3. **Postgres** (durability): Store sessions in database with TTL, implement trait for
//!    database-backed store, coordinate cleanup via distributed task queue.
//!
//! # Example: Switching to Redis
//!
//! Update `Cargo.toml`:
//!
//! ```text
//! [dependencies]
//! redis = { version = "0.24", features = ["tokio-comp", "connection-manager"] }
//! ```
//!
//! Implement the trait:
//!
//! ```ignore
//! // In src/network/session/redis_store.rs
//! pub struct RedisSessionStore { /* ... */ }
//! impl SessionStoreBackend for RedisSessionStore { /* ... */ }
//!
//! // In main.rs
//! #[cfg(feature = "redis")]
//! let sessions = Arc::new(RedisSessionStore::new(...));
//! #[cfg(not(feature = "redis"))]
//! let sessions = Arc::new(SessionStore::new());
//! ```

use super::Session;
use std::sync::Arc;

/// Trait for session storage with concurrent access.
///
/// Implementations must be thread-safe and support concurrent reads/writes
/// from multiple WebSocket handlers. This trait abstracts storage details
/// to enable both in-memory and distributed backends.
///
/// **Note**: `disconnect_session` and `take_stored_by_player_id` have async
/// implementations that read from DashMap. For trait object usage requiring
/// true async, use concrete types or an async trait library.
pub trait SessionStoreBackend: Send + Sync {
    /// Get an active session by player_id.
    fn get_active(&self, player_id: &str) -> Option<Arc<tokio::sync::Mutex<Session>>>;

    /// Add a new guest session. Returns (player_id, display_name, session_token, session_arc).
    fn add_guest_session(
        &self,
        session: Session,
    ) -> (String, String, String, Arc<tokio::sync::Mutex<Session>>);

    /// Get the number of active sessions.
    fn active_count(&self) -> usize;

    /// Get the number of stored sessions.
    fn stored_count(&self) -> usize;

    /// Clean up expired sessions. Returns number of sessions removed.
    ///
    /// For in-memory stores, this scans the stored sessions map and removes
    /// entries where `is_expired()` is true.
    ///
    /// For distributed stores, this may be a no-op (relying on TTL) or coordinate
    /// with a central cleanup task.
    fn cleanup_expired(&self) -> usize;
}
