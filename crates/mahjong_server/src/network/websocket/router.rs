//! Message routing and dispatch for WebSocket envelopes.
//!
//! This module provides centralized message routing with tracing and metrics hooks.
//! All authenticated client messages flow through [`dispatch_envelope`] which delegates
//! to appropriate submodule handlers based on message type.
//!
//! ## Message Flow
//!
//! ```text
//! Client Message (Text)
//!   ↓
//! Parse to Envelope
//!   ↓
//! dispatch_envelope (entry trace)
//!   ↓
//! Match message type → delegate to handler:
//!   - Command       → command::handle_command
//!   - CreateRoom    → room_actions::handle_create_room
//!   - JoinRoom      → room_actions::handle_join_room
//!   - LeaveRoom     → room_actions::handle_leave_room
//!   - CloseRoom     → room_actions::handle_close_room
//!   - Pong          → handle_pong (inline)
//!   - Authenticate  → ignored (already authenticated)
//!   - Other         → error
//!   ↓
//! Handler executes (with tracing)
//!   ↓
//! dispatch_envelope (exit trace)
//! ```

use crate::network::{
    messages::{Envelope, ErrorCode},
    websocket::{
        command, responses::WsError, room_actions, state::NetworkState, types::ConnectionCtx,
    },
};
use std::sync::Arc;
use tracing::{debug, instrument, warn};

/// Dispatches an envelope to the appropriate handler based on message type.
///
/// This is the central router for all authenticated WebSocket messages. It provides:
/// - Centralized tracing and logging for all message types
/// - Type-based dispatch to specialized handlers
/// - Consistent error handling across all message types
///
/// # Arguments
///
/// - `envelope`: The parsed message envelope from the client
/// - `ctx`: Connection context (player ID, IP, address)
/// - `state`: Shared network state (sessions, rooms, rate limits)
///
/// # Errors
///
/// Returns [`WsError`] if:
/// - The envelope type is not supported or unexpected from an authenticated client
/// - Any handler returns an error (authentication failure, rate limit, invalid command, etc.)
///
/// Internal: `dispatch_envelope` is called from the websocket message loop.
#[instrument(
    skip(envelope, state),
    fields(
        player_id = %ctx.player_id,
        message_type = ?envelope_type(&envelope)
    )
)]
pub async fn dispatch_envelope(
    envelope: Envelope,
    ctx: &ConnectionCtx,
    state: &Arc<NetworkState>,
) -> Result<(), WsError> {
    debug!(
        player_id = %ctx.player_id,
        message_type = ?envelope_type(&envelope),
        "Dispatching message"
    );

    let result = match envelope {
        Envelope::Command(payload) => {
            command::handle_command(payload.command, state, &ctx.player_id).await
        }
        Envelope::CreateRoom(payload) => {
            room_actions::handle_create_room(state, &ctx.player_id, payload).await
        }
        Envelope::JoinRoom(payload) => {
            room_actions::handle_join_room(payload.room_id, state, &ctx.player_id).await
        }
        Envelope::LeaveRoom(_) => room_actions::handle_leave_room(state, &ctx.player_id).await,
        Envelope::CloseRoom(_) => room_actions::handle_close_room(state, &ctx.player_id).await,
        Envelope::Pong(payload) => handle_pong(payload.timestamp, state, &ctx.player_id).await,
        Envelope::Authenticate(_) => {
            // Already authenticated, ignore.
            warn!(
                player_id = %ctx.player_id,
                "Received Authenticate after already authenticated, ignoring"
            );
            Ok(())
        }
        _ => Err(WsError::new(
            ErrorCode::InvalidCommand,
            "Unexpected message type from client".to_string(),
        )),
    };

    if let Err(ref e) = result {
        debug!(
            player_id = %ctx.player_id,
            error = %e.message,
            error_code = ?e.code,
            "Message dispatch failed"
        );
    }

    result
}

/// Returns a string representation of the envelope type for logging.
fn envelope_type(envelope: &Envelope) -> &'static str {
    match envelope {
        Envelope::Command(_) => "Command",
        Envelope::CreateRoom(_) => "CreateRoom",
        Envelope::JoinRoom(_) => "JoinRoom",
        Envelope::LeaveRoom(_) => "LeaveRoom",
        Envelope::CloseRoom(_) => "CloseRoom",
        Envelope::Pong(_) => "Pong",
        Envelope::Authenticate(_) => "Authenticate",
        Envelope::Ping(_) => "Ping",
        Envelope::Event(_) => "Event",
        Envelope::RoomJoined(_) => "RoomJoined",
        Envelope::RoomLeft(_) => "RoomLeft",
        Envelope::RoomClosed(_) => "RoomClosed",
        Envelope::RoomMemberLeft(_) => "RoomMemberLeft",
        Envelope::Error(_) => "Error",
        Envelope::AuthSuccess(_) => "AuthSuccess",
        Envelope::AuthFailure(_) => "AuthFailure",
        Envelope::StateSnapshot(_) => "StateSnapshot",
    }
}

/// Handles a Pong message (updates last_pong timestamp).
///
/// # Errors
///
/// Returns [`WsError`] if the player's session is not found (should not happen
/// for authenticated connections).
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::network::messages::{PingPayload, PongPayload};
    use chrono::Utc;

    #[test]
    fn test_envelope_type() {
        use crate::network::messages::{
            AuthMethod, AuthenticatePayload, CommandPayload, CreateRoomPayload, JoinRoomPayload,
        };
        use mahjong_core::command::GameCommand;
        use mahjong_core::player::Seat;

        assert_eq!(
            envelope_type(&Envelope::Authenticate(AuthenticatePayload {
                method: AuthMethod::Guest,
                credentials: None,
                version: "1.0".to_string(),
            })),
            "Authenticate"
        );
        assert_eq!(
            envelope_type(&Envelope::Command(CommandPayload {
                command: GameCommand::RollDice { player: Seat::East }
            })),
            "Command"
        );
        assert_eq!(
            envelope_type(&Envelope::CreateRoom(CreateRoomPayload {
                card_year: 2025,
                bot_difficulty: None,
                fill_with_bots: false,
            })),
            "CreateRoom"
        );
        assert_eq!(
            envelope_type(&Envelope::JoinRoom(JoinRoomPayload {
                room_id: "test".to_string()
            })),
            "JoinRoom"
        );
    }

    #[tokio::test]
    async fn dispatch_rejects_unexpected_message() {
        let state = Arc::new(NetworkState::new());
        let ctx = ConnectionCtx::new("player123".to_string());
        let envelope = Envelope::Ping(PingPayload {
            timestamp: Utc::now(),
        });

        let result = dispatch_envelope(envelope, &ctx, &state).await;

        assert!(result.is_err());
        if let Err(err) = result {
            assert_eq!(err.code, ErrorCode::InvalidCommand);
        }
    }

    #[tokio::test]
    async fn dispatch_pong_without_session_is_unauthenticated() {
        let state = Arc::new(NetworkState::new());
        let ctx = ConnectionCtx::new("missing-player".to_string());
        let envelope = Envelope::Pong(PongPayload {
            timestamp: Utc::now(),
        });

        let result = dispatch_envelope(envelope, &ctx, &state).await;

        assert!(result.is_err());
        if let Err(err) = result {
            assert_eq!(err.code, ErrorCode::Unauthenticated);
        }
    }
}
