//! Shared types for WebSocket message handling.
//!
//! This module provides common data structures used throughout the WebSocket
//! handler pipeline for passing context between functions.

use std::net::SocketAddr;

/// Connection context passed through message handlers.
///
/// Contains all the contextual information needed to process messages from
/// an authenticated client, including player identity and network information.
///
/// # Examples
///
/// ```no_run
/// # use mahjong_server::network::websocket::types::ConnectionCtx;
/// # use std::net::SocketAddr;
/// let ctx = ConnectionCtx {
///     player_id: "player123".to_string(),
///     ip_key: "192.168.1.1".to_string(),
///     addr: SocketAddr::from(([192, 168, 1, 1], 8080)),
/// };
/// ```
#[derive(Debug, Clone)]
pub struct ConnectionCtx {
    /// Authenticated player ID.
    pub player_id: String,
    /// IP address key for rate limiting (IP as string).
    pub ip_key: String,
    /// Full socket address (IP + port).
    pub addr: SocketAddr,
}

impl ConnectionCtx {
    /// Creates a new connection context.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// # use mahjong_server::network::websocket::types::ConnectionCtx;
    /// # use std::net::SocketAddr;
    /// let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    /// let ctx = ConnectionCtx::new("player123".to_string(), addr);
    /// ```
    pub fn new(player_id: String, addr: SocketAddr) -> Self {
        Self {
            player_id,
            ip_key: addr.ip().to_string(),
            addr,
        }
    }
}
