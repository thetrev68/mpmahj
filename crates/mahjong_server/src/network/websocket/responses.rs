//! Response helpers for WebSocket communication.
//!
//! This module provides utilities for sending messages and errors to WebSocket clients,
//! including:
//! - Error types ([`WsError`])
//! - Individual player message sending
//! - Room-wide broadcasting
//! - Pre-authentication error sending

use axum::extract::ws::Message;
use futures_util::SinkExt;
use std::sync::Arc;

use super::super::messages::{Envelope, ErrorCode};
use super::super::RoomEvents;
use super::state::NetworkState;
use mahjong_core::event::Event;

/// WebSocket error with structured error code and optional context.
///
/// Used internally by WebSocket handlers to return errors that will be
/// sent to clients as Error envelopes.
///
/// WsError is used internally by websocket handlers and is not exposed as a
/// public API surface.
#[derive(Debug)]
pub struct WsError {
    /// Error code to return to clients.
    pub(super) code: ErrorCode,
    /// Human-readable error message.
    pub(super) message: String,
    /// Optional structured context to include.
    pub(super) context: Option<serde_json::Value>,
}

impl WsError {
    /// Creates a new websocket error without context.
    ///
    /// Internal helper.
    pub fn new(code: ErrorCode, message: String) -> Self {
        Self {
            code,
            message,
            context: None,
        }
    }

    /// Creates a new websocket error with additional context.
    ///
    /// Internal helper with structured context.
    pub fn with_context(code: ErrorCode, message: String, context: serde_json::Value) -> Self {
        Self {
            code,
            message,
            context: Some(context),
        }
    }
}

/// Sends an error envelope to a specific player.
///
/// # Errors
///
/// Returns an error if the session is not found or if sending fails.
pub(super) async fn send_error_to_player(
    state: &Arc<NetworkState>,
    player_id: &str,
    code: ErrorCode,
    message: &str,
) -> Result<(), String> {
    send_error_to_player_with_context(state, player_id, code, message, None).await
}

/// Sends an error envelope to a specific player with optional context.
///
/// # Errors
///
/// Returns an error if the session is not found or if sending fails.
pub(super) async fn send_error_to_player_with_context(
    state: &Arc<NetworkState>,
    player_id: &str,
    code: ErrorCode,
    message: &str,
    context: Option<serde_json::Value>,
) -> Result<(), String> {
    let session_arc = state
        .sessions
        .get_active(player_id)
        .ok_or("Session not found")?;

    let session = session_arc.lock().await;
    let mut ws_guard = session.ws_sender.lock().await;

    let envelope = if let Some(context) = context {
        Envelope::error_with_context(code, message, context)
    } else {
        Envelope::error(code, message)
    };
    let json = envelope
        .to_json()
        .map_err(|e| format!("Serialize error: {}", e))?;

    ws_guard
        .send(Message::Text(json))
        .await
        .map_err(|e| format!("Send error: {}", e))?;

    Ok(())
}

/// Sends an event envelope to a specific player.
///
/// # Errors
///
/// Returns an error if the session is not found or if sending fails.
pub(super) async fn send_event_to_player(
    state: &Arc<NetworkState>,
    player_id: &str,
    event: Event,
) -> Result<(), String> {
    send_envelope_to_player(state, player_id, Envelope::event(event)).await
}

/// Sends a raw envelope to a specific player.
///
/// # Errors
///
/// Returns an error if the session is not found or if sending fails.
pub(super) async fn send_envelope_to_player(
    state: &Arc<NetworkState>,
    player_id: &str,
    envelope: Envelope,
) -> Result<(), String> {
    let session_arc = state
        .sessions
        .get_active(player_id)
        .ok_or("Session not found")?;
    let session = session_arc.lock().await;
    let mut ws_guard = session.ws_sender.lock().await;

    let json = envelope
        .to_json()
        .map_err(|e| format!("Serialize error: {}", e))?;
    ws_guard
        .send(Message::Text(json))
        .await
        .map_err(|e| format!("Send error: {}", e))?;
    Ok(())
}

/// Broadcasts a game event to all room sessions.
///
/// # Errors
///
/// Returns an error if broadcasting fails.
pub(super) async fn broadcast_room_event(
    room_arc: &Arc<tokio::sync::Mutex<super::super::room::Room>>,
    event: Event,
) -> Result<(), WsError> {
    let mut room = room_arc.lock().await;
    room.broadcast_event(event, crate::event_delivery::EventDelivery::broadcast())
        .await;
    Ok(())
}

/// Broadcasts a raw envelope to all room sessions.
///
/// # Errors
///
/// Returns an error if sending to any session fails.
pub(super) async fn broadcast_room_envelope(
    room_arc: &Arc<tokio::sync::Mutex<super::super::room::Room>>,
    envelope: Envelope,
) -> Result<(), String> {
    let room = room_arc.lock().await;
    for session in room.sessions.values() {
        let session = session.lock().await;
        let mut ws_guard = session.ws_sender.lock().await;
        let json = envelope
            .to_json()
            .map_err(|e| format!("Serialize error: {}", e))?;
        ws_guard
            .send(Message::Text(json))
            .await
            .map_err(|e| format!("Send error: {}", e))?;
    }
    Ok(())
}

/// Sends an error envelope directly on a WebSocket sender (pre-auth).
///
/// Used during the authentication phase before a session is established.
///
/// # Errors
///
/// Returns an error if serialization or sending fails.
pub(super) async fn send_error_on_sender(
    sender: &mut futures_util::stream::SplitSink<axum::extract::ws::WebSocket, Message>,
    code: ErrorCode,
    message: &str,
    context: Option<serde_json::Value>,
) -> Result<(), String> {
    let envelope = if let Some(context) = context {
        Envelope::error_with_context(code, message, context)
    } else {
        Envelope::error(code, message)
    };
    let json = envelope
        .to_json()
        .map_err(|e| format!("Serialize error: {}", e))?;
    sender
        .send(Message::Text(json))
        .await
        .map_err(|e| format!("Send error: {}", e))?;
    Ok(())
}

/// Sends an AuthFailure envelope directly on a WebSocket sender (pre-auth).
///
/// Used during the authentication phase to notify clients of authentication failures.
///
/// # Errors
///
/// Returns an error if serialization or sending fails.
pub(super) async fn send_auth_failure(
    sender: &mut futures_util::stream::SplitSink<axum::extract::ws::WebSocket, Message>,
    reason: &str,
) -> Result<(), String> {
    let envelope = Envelope::auth_failure(reason);
    let json = envelope
        .to_json()
        .map_err(|e| format!("Serialize error: {}", e))?;
    sender
        .send(Message::Text(json))
        .await
        .map_err(|e| format!("Send error: {}", e))?;
    Ok(())
}
