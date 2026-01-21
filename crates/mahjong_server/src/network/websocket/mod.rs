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
//! - **[`room_actions`]**: Room lifecycle operations (create, join, leave, close)
//! - **[`responses`]**: Message sending and error helpers
//! - Handler functions: Commands, pong
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
pub mod responses;
pub mod room_actions;
pub mod state;

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
    heartbeat::{schedule_bot_takeover, spawn_heartbeat_task},
    messages::{Envelope, ErrorCode},
    RoomCommands,
};

use auth::rate_limit_context;
use responses::{send_error_to_player, send_error_to_player_with_context, WsError};

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
/// 3. Enter message loop: receive → parse → process → respond
/// 4. On disconnect: mark session disconnected
async fn handle_socket(socket: WebSocket, state: Arc<NetworkState>, addr: SocketAddr) {
    let (sender, mut receiver) = socket.split();
    let ip_key = addr.ip().to_string();
    let connection_key = format!("{}:{}", addr.ip(), addr.port());

    info!("New WebSocket connection established, waiting for authentication");

    // Step 1: Wait for Authenticate message (with timeout).
    let player_id = match tokio::time::timeout(
        std::time::Duration::from_secs(10),
        auth::wait_for_auth_and_create_session(&mut receiver, sender, &state, &ip_key, &connection_key),
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
    spawn_heartbeat_task(
        player_id.clone(),
        state.sessions.clone(),
        state.rooms.clone(),
    );

    // Step 3: Enter message loop - process incoming messages.
    // The session with ws_sender is now stored in SessionStore
    while let Some(msg_result) = receiver.next().await {
        match msg_result {
            Ok(Message::Text(text)) => {
                if let Err(e) = handle_text_message(&text, &state, &player_id).await {
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

    // Step 4: Handle disconnect - move session to stored (5-minute grace period).
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
async fn handle_text_message(
    text: &str,
    state: &Arc<NetworkState>,
    player_id: &str,
) -> Result<(), WsError> {
    // Parse envelope
    let envelope = Envelope::from_json(text)
        .map_err(|e| WsError::new(ErrorCode::InvalidCommand, format!("Invalid JSON: {}", e)))?;

    match envelope {
        Envelope::Command(payload) => {
            handle_command(payload.command, state, player_id).await?;
        }
        Envelope::CreateRoom(payload) => {
            room_actions::handle_create_room(state, player_id, payload).await?;
        }
        Envelope::JoinRoom(payload) => {
            room_actions::handle_join_room(payload.room_id, state, player_id).await?;
        }
        Envelope::LeaveRoom(_) => {
            room_actions::handle_leave_room(state, player_id).await?;
        }
        Envelope::CloseRoom(_) => {
            room_actions::handle_close_room(state, player_id).await?;
        }
        Envelope::Pong(payload) => {
            handle_pong(payload.timestamp, state, player_id).await?;
        }
        Envelope::Authenticate(_) => {
            // Already authenticated, ignore.
            warn!(player_id = %player_id, "Received Authenticate after already authenticated, ignoring");
        }
        _ => {
            return Err(WsError::new(
                ErrorCode::InvalidCommand,
                "Unexpected message type from client".to_string(),
            ));
        }
    }

    Ok(())
}

/// Handles a Command message.
async fn handle_command(
    command: mahjong_core::command::GameCommand,
    state: &Arc<NetworkState>,
    player_id: &str,
) -> Result<(), WsError> {
    if let Err(err) = state.rate_limits.check_command(player_id, &command) {
        return Err(WsError::with_context(
            ErrorCode::RateLimitExceeded,
            "Command rate limit exceeded".to_string(),
            rate_limit_context(err),
        ));
    }

    // Get room_id from session.
    let room_id = {
        let session_arc = state.sessions.get_active(player_id).ok_or_else(|| {
            WsError::new(ErrorCode::Unauthenticated, "Session not found".to_string())
        })?;
        let session = session_arc.lock().await;
        session.room_id.clone().ok_or_else(|| {
            WsError::new(
                ErrorCode::InvalidCommand,
                "Player not in a room".to_string(),
            )
        })?
    };

    debug!(
        player_id = %player_id,
        room_id = %room_id,
        command = ?command,
        "Processing command"
    );

    // Get room and process command.
    let room_arc = state
        .rooms
        .get_room(&room_id)
        .ok_or_else(|| WsError::new(ErrorCode::RoomNotFound, "Room not found".to_string()))?;

    let mut room = room_arc.lock().await;
    room.handle_command(command, player_id)
        .await
        .map_err(|e| map_command_error(&e))?;

    // Note: Events are broadcasted internally by Room::handle_command
    // via the broadcast_event method which filters by visibility.

    Ok(())
}

/// Handles a Pong message (updates last_pong timestamp).
async fn handle_pong(
    timestamp: chrono::DateTime<chrono::Utc>,
    state: &Arc<NetworkState>,
    player_id: &str,
) -> Result<(), WsError> {
    let session_arc = state
        .sessions
        .get_active(player_id)
        .ok_or_else(|| WsError::new(ErrorCode::Unauthenticated, "Session not found".to_string()))?;

    let mut session = session_arc.lock().await;
    session.update_pong();

    debug!(
        player_id = %player_id,
        timestamp = %timestamp,
        "Received pong"
    );

    Ok(())
}

/// Maps table command errors to websocket error payloads.
fn map_command_error(error: &mahjong_core::table::CommandError) -> WsError {
    use mahjong_core::table::CommandError;

    match error {
        CommandError::NotYourTurn => WsError::new(ErrorCode::NotYourTurn, error.to_string()),
        CommandError::TileNotInHand => WsError::new(ErrorCode::InvalidTile, error.to_string()),
        CommandError::PlayerNotFound => {
            WsError::new(ErrorCode::InvalidCommand, "Player not in game".to_string())
        }
        _ => WsError::new(ErrorCode::InvalidCommand, error.to_string()),
    }
}
