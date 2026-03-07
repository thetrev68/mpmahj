//! Shared types for WebSocket message handling.
//!
//! This module provides common data structures used throughout the WebSocket
//! handler pipeline for passing context between functions.

/// Connection context passed through message handlers.
///
/// Contains the minimal contextual information needed to process messages from
/// an authenticated client.
///
/// Internal context struct used by the websocket router.
#[derive(Debug, Clone)]
pub struct ConnectionCtx {
    /// Authenticated player ID.
    pub player_id: String,
    /// Client IP key for moderation and rate-limit namespaces.
    pub ip_key: String,
}

impl ConnectionCtx {
    /// Creates a new connection context.
    ///
    /// Internal helper constructor.
    pub fn new(player_id: String, ip_key: String) -> Self {
        Self { player_id, ip_key }
    }
}
