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
    messages::ErrorCode,
    websocket::{auth::rate_limit_context, responses::WsError, state::NetworkState},
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
/// # Examples
///
/// ```no_run
/// # use mahjong_server::network::websocket::command::handle_command;
/// # use mahjong_server::network::NetworkState;
/// # use mahjong_core::command::GameCommand;
/// # use mahjong_core::player::Seat;
/// # use std::sync::Arc;
/// # async fn example(state: Arc<NetworkState>) {
/// let command = GameCommand::RollDice { player: Seat::East };
/// let result = handle_command(command, &state, "player123").await;
/// # }
/// ```
pub async fn handle_command(
    command: mahjong_core::command::GameCommand,
    state: &Arc<NetworkState>,
    player_id: &str,
) -> Result<(), WsError> {
    // Check rate limits before processing.
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

    // Get room and process command through server-authoritative handler.
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

/// Maps game logic [`CommandError`]s to WebSocket error codes and messages.
///
/// This function translates domain-specific errors from the game engine into
/// client-friendly error codes and messages.
///
/// # Examples
///
/// ```no_run
/// # use mahjong_server::network::websocket::command::map_command_error;
/// # use mahjong_core::table::CommandError;
/// let error = CommandError::NotYourTurn;
/// let ws_error = map_command_error(&error);
/// ```
pub fn map_command_error(error: &mahjong_core::table::CommandError) -> WsError {
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
}
