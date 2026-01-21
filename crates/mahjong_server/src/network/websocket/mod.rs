//! WebSocket connection handler for the Mahjong game server.
//!
//! This module implements the server-authoritative WebSocket pipeline:
//!
//! 1. **Upgrade**: HTTP → WebSocket via [`ws_handler`]
//! 2. **Authentication**: Client must send [`Envelope::Authenticate`] as first message
//! 3. **Message Loop**: Receive → parse → dispatch → respond
//! 4. **Disconnect**: Grace period for reconnection
//!
//! ## Pipeline Flow
//!
//! ```text
//! Client connects → ws_handler → handle_socket
//!   ↓
//! Wait for Authenticate (10s timeout)
//!   ↓
//! Create/restore Session
//!   ↓
//! Spawn heartbeat task
//!   ↓
//! Message loop: receive → route → Room.handle_command → broadcast events
//!   ↓
//! On disconnect: mark session disconnected (5-minute grace period)
//! ```
//!
//! ## Architecture
//!
//! - **[`state`]**: Shared network state ([`NetworkState`])
//! - **[`auth`]**: Authentication flow and session creation
//! - **[`heartbeat`]**: Heartbeat task spawning for connection health monitoring
//! - **[`router`]**: Message routing and dispatch
//! - **[`command`]**: Game command handling
//! - **[`room_actions`]**: Room lifecycle operations (create, join, leave, close)
//! - **[`responses`]**: Message sending and error helpers
//! - **[`types`]**: Shared types ([`ConnectionCtx`])
//!
//! ## Examples
//!
//! ```no_run
//! use axum::extract::ws::WebSocketUpgrade;
//! use mahjong_server::network::websocket::ws_handler;
//! use std::net::SocketAddr;
//! # async fn run(ws: WebSocketUpgrade, state: std::sync::Arc<mahjong_server::network::NetworkState>) {
//! let _response = ws_handler(ws, axum::extract::State(state), SocketAddr::from(([127, 0, 0, 1], 3000))).await;
//! # }
//! ```

// Submodules
pub mod auth;
pub mod command;
pub mod heartbeat;
pub mod responses;
pub mod room_actions;
pub mod router;
pub mod state;
pub mod types;

// Re-exports
pub use state::NetworkState;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::Response,
};
use futures_util::StreamExt;
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::{debug, error, info, warn};

use super::{
    heartbeat::schedule_bot_takeover,
    messages::{Envelope, ErrorCode},
};

use responses::{send_error_to_player, send_error_to_player_with_context};
use router::dispatch_envelope;
use types::ConnectionCtx;

/// WebSocket upgrade handler - entry point for WebSocket connections.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<NetworkState>>,
    addr: SocketAddr,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state, addr))
}

/// Main WebSocket connection handler.
///
/// Flow:
/// 1. Wait for Authenticate message (must be first)
/// 2. Create or restore Session (with ws_sender embedded)
/// 3. Spawn heartbeat task
/// 4. Enter message loop: receive → parse → route → respond
/// 5. On disconnect: mark session disconnected
async fn handle_socket(socket: WebSocket, state: Arc<NetworkState>, addr: SocketAddr) {
    let (sender, mut receiver) = socket.split();
    let ip_key = addr.ip().to_string();
    let connection_key = format!("{}:{}", addr.ip(), addr.port());

    info!("New WebSocket connection established, waiting for authentication");

    // Step 1: Wait for Authenticate message (with timeout).
    let player_id = match tokio::time::timeout(
        std::time::Duration::from_secs(10),
        auth::wait_for_auth_and_create_session(
            &mut receiver,
            sender,
            &state,
            &ip_key,
            &connection_key,
        ),
    )
    .await
    {
        Ok(Ok(id)) => id,
        Ok(Err(e)) => {
            warn!("Authentication failed: {}", e);
            // Connection already closed or error sent in wait_for_auth_and_create_session
            return;
        }
        Err(_) => {
            warn!("Authentication timeout (10s)");
            // Can't send error because we don't have sender anymore
            return;
        }
    };

    info!(player_id = %player_id, "Player authenticated successfully");

    // Step 2: Spawn heartbeat task for this session.
    heartbeat::spawn_heartbeat(
        player_id.clone(),
        state.sessions.clone(),
        state.rooms.clone(),
    );

    // Step 3: Create connection context for routing.
    let ctx = ConnectionCtx::new(player_id.clone(), addr);

    // Step 4: Enter message loop - process incoming messages.
    // The session with ws_sender is now stored in SessionStore
    while let Some(msg_result) = receiver.next().await {
        match msg_result {
            Ok(Message::Text(text)) => {
                if let Err(e) = handle_text_message(&text, &state, &ctx).await {
                    error!(
                        player_id = %player_id,
                        error = %e.message,
                        code = ?e.code,
                        "Error handling message"
                    );
                    // Send error through session's ws_sender
                    let _ = send_error_to_player_with_context(
                        &state, &player_id, e.code, &e.message, e.context,
                    )
                    .await;
                }
            }
            Ok(Message::Close(_)) => {
                info!(player_id = %player_id, "Client closed connection");
                break;
            }
            Ok(Message::Ping(_)) | Ok(Message::Pong(_)) => {
                // WebSocket-level ping/pong, handled automatically by axum
                debug!(player_id = %player_id, "Received WebSocket ping/pong");
            }
            Ok(Message::Binary(_)) => {
                warn!(player_id = %player_id, "Received unexpected binary message");
                let _ = send_error_to_player(
                    &state,
                    &player_id,
                    ErrorCode::InvalidCommand,
                    "Binary messages not supported",
                )
                .await;
            }
            Err(e) => {
                error!(player_id = %player_id, error = %e, "WebSocket error");
                break;
            }
        }
    }

    // Step 5: Handle disconnect - move session to stored (5-minute grace period).
    info!(player_id = %player_id, "WebSocket connection closed, starting grace period");
    state.sessions.disconnect_session(&player_id).await;
    schedule_bot_takeover(
        player_id.clone(),
        state.sessions.clone(),
        state.rooms.clone(),
    );
    // Heartbeat task will stop automatically when session is no longer active
}

/// Handles a text message from an authenticated client.
///
/// Parses the JSON envelope and dispatches to the router for processing.
///
/// # Errors
///
/// Returns [`responses::WsError`] if:
/// - JSON parsing fails
/// - Router dispatch returns an error (see [`router::dispatch_envelope`])
async fn handle_text_message(
    text: &str,
    state: &Arc<NetworkState>,
    ctx: &ConnectionCtx,
) -> Result<(), responses::WsError> {
    // Parse envelope
    let envelope = Envelope::from_json(text).map_err(|e| {
        responses::WsError::new(ErrorCode::InvalidCommand, format!("Invalid JSON: {}", e))
    })?;

    // Dispatch through router
    dispatch_envelope(envelope, ctx, state).await
}
