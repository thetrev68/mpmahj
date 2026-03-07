//! Command handling for game commands sent by authenticated players.
//!
//! This module processes [`GameCommand`]s received from clients and dispatches them
//! to the appropriate room through the server-authoritative pipeline.
//!
//! ## Rate Limiting
//!
//! Commands are rate-limited per player to prevent abuse. The rate limit checks
//! are performed before command execution.
//!
//! ## Error Handling
//!
//! Command errors from the game logic layer ([`CommandError`]) are mapped to
//! WebSocket error codes and messages for client consumption.

use crate::network::{
    commands::RoomCommands,
    messages::{Envelope, ErrorCode},
    websocket::{
        auth::rate_limit_context,
        responses::{send_envelope_to_player, WsError},
        state::NetworkState,
        types::ConnectionCtx,
    },
};
use std::sync::Arc;
use tracing::debug;

/// Handles a [`GameCommand`] from an authenticated player.
///
/// This function:
/// 1. Checks rate limits for the command
/// 2. Retrieves the player's room from their session
/// 3. Dispatches the command to the room's [`handle_command`] method
/// 4. Maps any errors to WebSocket-compatible error responses
///
/// # Errors
///
/// Returns [`WsError`] if:
/// - Rate limit is exceeded for this player/command type
/// - Player session is not found (not authenticated)
/// - Player is not in a room
/// - Room is not found
/// - Command execution fails (invalid move, not player's turn, etc.)
///
/// This handler is invoked from the websocket router; it is not part of the
/// public API.
pub async fn handle_command(
    command: mahjong_core::command::GameCommand,
    state: &Arc<NetworkState>,
    ctx: &ConnectionCtx,
) -> Result<(), WsError> {
    let session_arc = state
        .sessions
        .get_active(&ctx.player_id)
        .ok_or_else(|| WsError::new(ErrorCode::Unauthenticated, "Session not found".to_string()))?;

    let (is_guest, room_id, session_seat) = {
        let session = session_arc.lock().await;
        let room_id = session.room_id.clone().ok_or_else(|| {
            WsError::new(
                ErrorCode::InvalidCommand,
                "Player not in a room".to_string(),
            )
        })?;
        let seat = session.seat.ok_or_else(|| {
            WsError::new(
                ErrorCode::InvalidCommand,
                "Player seat not assigned".to_string(),
            )
        })?;
        (session.is_guest, room_id, seat)
    };

    let actor_key = if is_guest {
        format!("guest:{}", ctx.ip_key)
    } else {
        ctx.player_id.clone()
    };

    if let Err(err) = state
        .rate_limits
        .check_command_for_session(is_guest, &actor_key, &command)
    {
        return Err(WsError::with_context(
            ErrorCode::RateLimitExceeded,
            "Command rate limit exceeded".to_string(),
            rate_limit_context(err),
        ));
    }

    debug!(
        player_id = %ctx.player_id,
        is_guest = is_guest,
        actor_key = %actor_key,
        room_id = %room_id,
        command = ?command,
        "Processing command"
    );

    // Get room and process command through server-authoritative handler.
    let room_arc = state
        .rooms
        .get_room(&room_id)
        .ok_or_else(|| WsError::new(ErrorCode::RoomNotFound, "Room not found".to_string()))?;

    if let mahjong_core::command::GameCommand::RequestState { player } = &command {
        if *player != session_seat {
            return Err(WsError::new(
                ErrorCode::InvalidCommand,
                "Player not in game".to_string(),
            ));
        }

        let snapshot = {
            let room = room_arc.lock().await;
            room.table
                .as_ref()
                .map(|table| table.create_snapshot(*player))
        };

        if let Some(snapshot) = snapshot {
            send_envelope_to_player(state, &ctx.player_id, Envelope::state_snapshot(snapshot))
                .await
                .map_err(|e| WsError::new(ErrorCode::InternalError, e))?;
        }

        return Ok(());
    }

    let mut room = room_arc.lock().await;
    room.handle_command(command, &ctx.player_id)
        .await
        .map_err(|e| map_command_error(&e))?;

    // Note: Events are broadcasted internally by Room::handle_command
    // via the broadcast_event method which filters by visibility.

    Ok(())
}

/// Maps game logic [`CommandError`]s to WebSocket error codes and messages.
///
/// This function translates domain-specific errors from the game engine into
/// client-friendly error codes and messages.
///
/// # Examples
///
/// Error mapping helper used by websocket command handling.
pub fn map_command_error(error: &mahjong_core::table::CommandError) -> WsError {
    use mahjong_core::table::CommandError;

    match error {
        CommandError::NotYourTurn => WsError::new(ErrorCode::NotYourTurn, error.to_string()),
        CommandError::TileNotInHand => WsError::with_context(
            ErrorCode::InvalidTile,
            error.to_string(),
            serde_json::json!({ "retryable": false }),
        ),
        CommandError::AlreadySubmitted => WsError::with_context(
            ErrorCode::AlreadySubmitted,
            error.to_string(),
            serde_json::json!({ "retryable": false }),
        ),
        CommandError::PlayerNotFound => {
            WsError::new(ErrorCode::InvalidCommand, "Player not in game".to_string())
        }
        _ => WsError::new(ErrorCode::InvalidCommand, error.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mahjong_core::table::CommandError;

    #[test]
    fn test_map_command_error_not_your_turn() {
        let error = CommandError::NotYourTurn;
        let ws_error = map_command_error(&error);
        assert_eq!(ws_error.code, ErrorCode::NotYourTurn);
    }

    #[test]
    fn test_map_command_error_tile_not_in_hand() {
        let error = CommandError::TileNotInHand;
        let ws_error = map_command_error(&error);
        assert_eq!(ws_error.code, ErrorCode::InvalidTile);
    }

    #[test]
    fn test_map_command_error_player_not_found() {
        let error = CommandError::PlayerNotFound;
        let ws_error = map_command_error(&error);
        assert_eq!(ws_error.code, ErrorCode::InvalidCommand);
        assert_eq!(ws_error.message, "Player not in game");
    }

    #[test]
    fn test_map_command_error_already_submitted() {
        let error = CommandError::AlreadySubmitted;
        let ws_error = map_command_error(&error);
        assert_eq!(ws_error.code, ErrorCode::AlreadySubmitted);
        assert!(ws_error.context.is_some());
        let ctx = ws_error.context.unwrap();
        assert_eq!(ctx["retryable"], false);
    }

    #[test]
    fn test_map_command_error_tile_not_in_hand_has_context() {
        let error = CommandError::TileNotInHand;
        let ws_error = map_command_error(&error);
        assert_eq!(ws_error.code, ErrorCode::InvalidTile);
        assert!(ws_error.context.is_some());
        let ctx = ws_error.context.unwrap();
        assert_eq!(ctx["retryable"], false);
    }
}
