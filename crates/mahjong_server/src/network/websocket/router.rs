//! Message routing and dispatch for WebSocket envelopes.
//!
//! This module provides centralized message routing with tracing and metrics hooks.
//! All authenticated client messages flow through [`dispatch_envelope`] which delegates
//! to [`handlers`] for message-specific behavior.

use crate::network::messages::Envelope;
use crate::network::websocket::handlers;
use crate::network::websocket::{responses::WsError, state::NetworkState, types::ConnectionCtx};
use std::sync::Arc;
use tracing::{debug, instrument};

/// Dispatches an envelope to the appropriate handler based on message type.
///
/// This is the central router for all authenticated WebSocket messages. It provides:
/// - Centralized tracing and logging for all message types
/// - Type-based dispatch to appropriate handlers
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

    let result = handlers::dispatch_envelope(envelope, ctx, state).await;

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::network::messages::{ErrorCode, PingPayload, PongPayload};
    use chrono::Utc;

    #[test]
    fn test_envelope_type() {
        use crate::network::messages::{
            AuthMethod, AuthenticatePayload, CommandPayload, CreateRoomPayload, JoinRoomPayload,
        };
        use mahjong_core::command::GameCommand;

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
                command: GameCommand::RollDice {
                    player: mahjong_core::player::Seat::East
                }
            })),
            "Command"
        );
        assert_eq!(
            envelope_type(&Envelope::CreateRoom(CreateRoomPayload {
                room_name: "My American Mahjong Game".to_string(),
                card_year: 2025,
                house_rules: None,
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
        let ctx = ConnectionCtx::new("player123".to_string(), "127.0.0.1".to_string());
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
        let ctx = ConnectionCtx::new("missing-player".to_string(), "127.0.0.1".to_string());
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
