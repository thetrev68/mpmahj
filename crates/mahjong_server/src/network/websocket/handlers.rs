use crate::network::{
    messages::{Envelope, ErrorCode},
    websocket::{
        command, responses::WsError, room_actions, state::NetworkState, types::ConnectionCtx,
    },
};

use std::sync::Arc;
use tracing::{debug, warn};

/// Dispatches an already-parsed envelope to the correct websocket handler.
pub async fn dispatch_envelope(
    envelope: Envelope,
    ctx: &ConnectionCtx,
    state: &Arc<NetworkState>,
) -> Result<(), WsError> {
    debug!(
        player_id = %ctx.player_id,
        envelope_type = ?envelope_name(&envelope),
        "Dispatching message"
    );

    match envelope {
        Envelope::Command(payload) => command::handle_command(payload.command, state, ctx).await,
        Envelope::CreateRoom(payload) => {
            room_actions::handle_create_room(state, ctx, payload).await
        }
        Envelope::JoinRoom(payload) => {
            room_actions::handle_join_room(payload.room_id, state, ctx).await
        }
        Envelope::LeaveRoom(_) => room_actions::handle_leave_room(state, ctx).await,
        Envelope::CloseRoom(_) => room_actions::handle_close_room(state, ctx).await,
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
    }
}

fn envelope_name(envelope: &Envelope) -> &'static str {
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
/// Returns [`WsError`] if the player's session is not found (should not happen
/// for authenticated connections).
async fn handle_pong(
    _timestamp: chrono::DateTime<chrono::Utc>,
    state: &Arc<NetworkState>,
    player_id: &str,
) -> Result<(), WsError> {
    let session_arc = state
        .sessions
        .get_active(player_id)
        .ok_or_else(|| WsError::new(ErrorCode::Unauthenticated, "Session not found".to_string()))?;

    let mut session = session_arc.lock().await;
    session.update_pong();

    debug!(player_id = %player_id, "Received pong");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::network::messages::PingPayload;

    #[tokio::test]
    async fn rejects_unsupported_messages() {
        let state = Arc::new(NetworkState::new());
        let ctx = command_test_ctx();

        let result = dispatch_envelope(
            Envelope::Ping(PingPayload {
                timestamp: chrono::Utc::now(),
            }),
            &ctx,
            &state,
        )
        .await;

        assert!(result.is_err());
        if let Err(err) = result {
            assert_eq!(err.code, ErrorCode::InvalidCommand);
        }
    }

    fn command_test_ctx() -> ConnectionCtx {
        ConnectionCtx::new("player-id".to_string(), "127.0.0.1".to_string())
    }
}
