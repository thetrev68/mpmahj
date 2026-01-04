//! WebSocket connection handler for the Mahjong game server.
//!
//! This module implements:
//! - WebSocket upgrade handling
//! - Authentication flow (Authenticate message must be first)
//! - Message receive/send loop
//! - Command dispatching to Room
//! - Error handling with structured Error envelopes
//! - Graceful disconnect handling

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::Response,
};
use futures_util::StreamExt;
use std::sync::Arc;
use tracing::{debug, error, info, warn};

use super::{
    heartbeat::spawn_heartbeat_task,
    messages::{AuthMethod, Credentials, Envelope, ErrorCode},
    room::RoomStore,
    session::SessionStore,
};

/// Shared application state for WebSocket handlers
pub struct NetworkState {
    pub sessions: Arc<SessionStore>,
    pub rooms: Arc<RoomStore>,
}

impl NetworkState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(SessionStore::new()),
            rooms: Arc::new(RoomStore::new()),
        }
    }
}

impl Default for NetworkState {
    fn default() -> Self {
        Self::new()
    }
}

/// WebSocket upgrade handler - entry point for WebSocket connections
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<NetworkState>>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

/// Main WebSocket connection handler
///
/// Flow:
/// 1. Wait for Authenticate message (must be first)
/// 2. Create or restore Session (with ws_sender embedded)
/// 3. Enter message loop: receive → parse → process → respond
/// 4. On disconnect: mark session disconnected
async fn handle_socket(socket: WebSocket, state: Arc<NetworkState>) {
    let (sender, mut receiver) = socket.split();

    info!("New WebSocket connection established, waiting for authentication");

    // Step 1: Wait for Authenticate message (with timeout)
    let player_id = match tokio::time::timeout(
        std::time::Duration::from_secs(10),
        wait_for_auth_and_create_session(&mut receiver, sender, &state),
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

    // Step 2: Spawn heartbeat task for this session
    spawn_heartbeat_task(player_id.clone(), state.sessions.clone());

    // Step 3: Enter message loop - process incoming messages
    // The session with ws_sender is now stored in SessionStore
    while let Some(msg_result) = receiver.next().await {
        match msg_result {
            Ok(Message::Text(text)) => {
                if let Err(e) = handle_text_message(&text, &state, &player_id).await {
                    error!(player_id = %player_id, error = %e, "Error handling message");
                    // Send error through session's ws_sender
                    let _ = send_error_to_player(&state, &player_id, ErrorCode::InvalidCommand, &format!("Error processing message: {}", e)).await;
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
                let _ = send_error_to_player(&state, &player_id, ErrorCode::InvalidCommand, "Binary messages not supported").await;
            }
            Err(e) => {
                error!(player_id = %player_id, error = %e, "WebSocket error");
                break;
            }
        }
    }

    // Step 4: Handle disconnect - move session to stored (5-minute grace period)
    info!(player_id = %player_id, "WebSocket connection closed, starting grace period");
    state.sessions.disconnect_session(&player_id).await;
    // Heartbeat task will stop automatically when session is no longer active
}

/// Wait for Authenticate message and create session
///
/// Returns the player_id if successful
async fn wait_for_auth_and_create_session(
    receiver: &mut futures_util::stream::SplitStream<WebSocket>,
    sender: futures_util::stream::SplitSink<WebSocket, Message>,
    state: &Arc<NetworkState>,
) -> Result<String, String> {
    while let Some(msg_result) = receiver.next().await {
        match msg_result {
            Ok(Message::Text(text)) => {
                // Parse envelope
                let envelope = Envelope::from_json(&text)
                    .map_err(|e| format!("Invalid JSON envelope: {}", e))?;

                // Only accept Authenticate messages
                match envelope {
                    Envelope::Authenticate(payload) => {
                        // Process authentication and create session
                        return process_authenticate(payload.method, payload.credentials, state, sender).await;
                    }
                    _ => {
                        // Try to send error (we still have sender)
                        let error_env = Envelope::error(ErrorCode::InvalidCredentials, "First message must be Authenticate");
                        if let Ok(json) = error_env.to_json() {
                            // We can't use sender here easily, so just return error
                            let _ = json;
                        }
                        return Err("First message must be Authenticate".to_string());
                    }
                }
            }
            Ok(Message::Close(_)) => {
                return Err("Connection closed before authentication".to_string());
            }
            Ok(_) => {
                // Ignore other message types during auth
                continue;
            }
            Err(e) => {
                return Err(format!("WebSocket error during auth: {}", e));
            }
        }
    }

    Err("Connection closed before authentication".to_string())
}

/// Process authentication and create session
///
/// Returns the player_id if successful
async fn process_authenticate(
    method: AuthMethod,
    credentials: Option<Credentials>,
    state: &Arc<NetworkState>,
    sender: futures_util::stream::SplitSink<WebSocket, Message>,
) -> Result<String, String> {
    match method {
        AuthMethod::Guest => {
            // Guest authentication - create new session with embedded ws_sender
            let session = super::session::Session::new_guest(sender);

            let player_id = session.player_id.clone();
            let display_name = session.display_name.clone();
            let session_token = session.session_token.clone();
            let room_id = session.room_id.clone();
            let seat = session.seat;

            // Send AuthSuccess before storing session
            let response = Envelope::auth_success(
                player_id.clone(),
                display_name,
                session_token,
                room_id,
                seat,
            );

            // Send through the session's ws_sender
            {
                let mut ws_guard = session.ws_sender.lock().await;
                let json = response.to_json().map_err(|e| format!("Serialize error: {}", e))?;
                use futures_util::SinkExt;
                ws_guard.send(Message::Text(json)).await.map_err(|e| format!("Send error: {}", e))?;
            }

            // Add to session store
            let (_, _, _, _session_arc) = state.sessions.add_guest_session(session);

            Ok(player_id)
        }
        AuthMethod::Token => {
            // Token authentication - restore session
            let token = credentials
                .and_then(|c| Some(c.token))
                .ok_or("Missing token in credentials")?;

            let (player_id, display_name, session_token, room_id, seat, _session_arc) = state
                .sessions
                .restore_session(&token, sender)
                .map_err(|e| format!("Session restoration failed: {}", e))?;

            // Send AuthSuccess (session's ws_sender will be used)
            let response = Envelope::auth_success(
                player_id.clone(),
                display_name,
                session_token,
                room_id,
                seat,
            );

            // Send through the restored session's ws_sender
            {
                let session_arc = state.sessions.get_active(&player_id)
                    .ok_or("Session not found after restoration")?;
                let session = session_arc.lock().await;
                let mut ws_guard = session.ws_sender.lock().await;
                let json = response.to_json().map_err(|e| format!("Serialize error: {}", e))?;
                use futures_util::SinkExt;
                ws_guard.send(Message::Text(json)).await.map_err(|e| format!("Send error: {}", e))?;
            }

            Ok(player_id)
        }
    }
}

/// Handle a text message from an authenticated client
async fn handle_text_message(
    text: &str,
    state: &Arc<NetworkState>,
    player_id: &str,
) -> Result<(), String> {
    // Parse envelope
    let envelope = Envelope::from_json(text)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    match envelope {
        Envelope::Command(payload) => {
            handle_command(payload.command, state, player_id).await?;
        }
        Envelope::Pong(payload) => {
            handle_pong(payload.timestamp, state, player_id).await?;
        }
        Envelope::Authenticate(_) => {
            // Already authenticated, ignore
            warn!(player_id = %player_id, "Received Authenticate after already authenticated, ignoring");
        }
        _ => {
            return Err("Unexpected message type from client".to_string());
        }
    }

    Ok(())
}

/// Handle a Command message
async fn handle_command(
    command: mahjong_core::command::GameCommand,
    state: &Arc<NetworkState>,
    player_id: &str,
) -> Result<(), String> {
    // Get room_id from session
    let room_id = {
        let session_arc = state.sessions.get_active(player_id)
            .ok_or("Session not found")?;
        let session = session_arc.lock().await;
        session.room_id.clone().ok_or("Player not in a room")?
    };

    debug!(
        player_id = %player_id,
        room_id = %room_id,
        command = ?command,
        "Processing command"
    );

    // Get room and process command
    let room_arc = state.rooms.get_room(&room_id)
        .ok_or("Room not found")?;

    let mut room = room_arc.lock().await;
    room.handle_command(command).await
        .map_err(|e| format!("Command failed: {:?}", e))?;

    // Note: Events are broadcasted internally by Room::handle_command
    // via the broadcast_event method which filters by visibility

    Ok(())
}

/// Handle a Pong message (updates last_pong timestamp)
async fn handle_pong(
    timestamp: chrono::DateTime<chrono::Utc>,
    state: &Arc<NetworkState>,
    player_id: &str,
) -> Result<(), String> {
    let session_arc = state.sessions.get_active(player_id)
        .ok_or("Session not found")?;

    let mut session = session_arc.lock().await;
    session.update_pong();

    debug!(
        player_id = %player_id,
        timestamp = %timestamp,
        "Received pong"
    );

    Ok(())
}

/// Send an error envelope to a specific player
async fn send_error_to_player(
    state: &Arc<NetworkState>,
    player_id: &str,
    code: ErrorCode,
    message: &str,
) -> Result<(), String> {
    let session_arc = state.sessions.get_active(player_id)
        .ok_or("Session not found")?;

    let session = session_arc.lock().await;
    let mut ws_guard = session.ws_sender.lock().await;

    let envelope = Envelope::error(code, message);
    let json = envelope.to_json().map_err(|e| format!("Serialize error: {}", e))?;

    use futures_util::SinkExt;
    ws_guard.send(Message::Text(json)).await
        .map_err(|e| format!("Send error: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_network_state_creation() {
        let state = NetworkState::new();
        // Verify state is initialized
        assert_eq!(state.sessions.active_count(), 0);
        assert_eq!(state.sessions.stored_count(), 0);
    }

    #[test]
    fn test_network_state_default() {
        let state = NetworkState::default();
        assert_eq!(state.sessions.active_count(), 0);
    }

    // Note: Reconnection tests are in session.rs since they test SessionStore functionality
    // Integration tests for full WebSocket flow will be added in tests/networking_integration.rs
}
