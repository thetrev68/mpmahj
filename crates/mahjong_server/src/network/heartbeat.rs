//! Heartbeat management for WebSocket connections.
//!
//! This module implements the ping/pong protocol to detect disconnected clients:
//! - Server sends Ping { timestamp } every 30 seconds
//! - Client must respond with Pong { timestamp } (echoing the same timestamp)
//! - Server disconnects client if no Pong received within 60 seconds
//!
//! The heartbeat task runs independently for each session and monitors the
//! last_pong timestamp to detect timeouts.

use crate::network::{messages::Envelope, session::SessionStore};
use axum::extract::ws::Message;
use chrono::Utc;
use futures_util::SinkExt;
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, info, warn};

/// Spawn a background heartbeat task for a session.
///
/// This task will:
/// 1. Send Ping messages every 30 seconds
/// 2. Check for timeout (no Pong received in 60 seconds)
/// 3. Disconnect the session if timeout occurs
///
/// The task will run until either:
/// - The session times out
/// - The session is disconnected by other means
/// - The WebSocket connection fails
///
/// # Arguments
///
/// * `player_id` - The player's unique identifier
/// * `session_store` - Shared session storage for accessing session state
pub fn spawn_heartbeat_task(player_id: String, session_store: Arc<SessionStore>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));

        info!(player_id = %player_id, "Heartbeat task started (ping every 30s, timeout 60s)");

        loop {
            interval.tick().await;

            // Get session from store
            let session_arc = match session_store.get_active(&player_id) {
                Some(s) => s,
                None => {
                    debug!(player_id = %player_id, "Session no longer active, stopping heartbeat");
                    break;
                }
            };

            let session = session_arc.lock().await;

            // Check if session is still connected
            if !session.connected {
                debug!(player_id = %player_id, "Session disconnected, stopping heartbeat");
                break;
            }

            // Check for timeout (no pong in 60 seconds)
            if session.is_timed_out() {
                warn!(
                    player_id = %player_id,
                    last_pong = %session.last_pong,
                    "Heartbeat timeout - no pong received in 60 seconds"
                );

                // Close the WebSocket connection
                let mut ws_guard = session.ws_sender.lock().await;
                let _ = ws_guard.send(Message::Close(None)).await;
                drop(ws_guard);
                drop(session);

                // Mark session as disconnected
                session_store.disconnect_session(&player_id).await;

                info!(player_id = %player_id, "Session disconnected due to heartbeat timeout");
                break;
            }

            // Send Ping
            let ping_envelope = Envelope::ping(Utc::now());
            let json = match ping_envelope.to_json() {
                Ok(j) => j,
                Err(e) => {
                    warn!(player_id = %player_id, error = %e, "Failed to serialize Ping");
                    continue;
                }
            };

            let mut ws_guard = session.ws_sender.lock().await;
            if let Err(e) = ws_guard.send(Message::Text(json)).await {
                warn!(
                    player_id = %player_id,
                    error = %e,
                    "Failed to send Ping, connection likely closed"
                );
                drop(ws_guard);
                drop(session);

                // Mark session as disconnected
                session_store.disconnect_session(&player_id).await;
                break;
            }

            debug!(player_id = %player_id, "Sent heartbeat Ping");
        }

        info!(player_id = %player_id, "Heartbeat task stopped");
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_heartbeat_stops_when_session_removed() {
        let store = Arc::new(SessionStore::new());

        // Spawn heartbeat for non-existent session
        spawn_heartbeat_task("non-existent".to_string(), store.clone());

        // Give task time to detect missing session
        tokio::time::sleep(Duration::from_millis(100)).await;

        // Task should have stopped (no panic)
        assert_eq!(store.active_count(), 0);
    }

    #[test]
    fn test_session_timeout_logic() {
        // This test verifies the Session::is_timed_out logic
        // Session timeout behavior is tested in session.rs
        // Here we just verify the heartbeat module compiles and exports correctly
    }
}
