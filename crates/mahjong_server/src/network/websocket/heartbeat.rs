//! Heartbeat management for WebSocket connections.
//!
//! This module provides a thin wrapper around the core heartbeat functionality
//! from [`crate::network::heartbeat`]. It handles spawning heartbeat tasks for
//! authenticated WebSocket sessions.
//!
//! The heartbeat task monitors the connection health by:
//! - Sending Ping messages every 30 seconds
//! - Checking for Pong responses within 60 seconds
//! - Disconnecting timed-out sessions
//!
//! See [`crate::network::heartbeat`] for the full heartbeat implementation.

use crate::network::heartbeat::spawn_heartbeat_task as spawn_core_heartbeat;
use crate::network::{RoomStore, SessionStore};
use std::sync::Arc;

/// Spawns a heartbeat task for a WebSocket session.
///
/// This is a thin wrapper around [`crate::network::heartbeat::spawn_heartbeat_task`]
/// that provides a websocket-specific interface.
///
/// # Arguments
///
/// * `player_id` - The player's unique identifier
/// * `sessions` - Shared session storage
/// * `rooms` - Shared room storage (needed for bot takeover)
///
/// Internal helper spawned during websocket handling.
pub fn spawn_heartbeat(player_id: String, sessions: Arc<SessionStore>, rooms: Arc<RoomStore>) {
    spawn_core_heartbeat(player_id, sessions, rooms);
}
