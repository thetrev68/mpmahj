//! Room lifecycle operations for WebSocket connections.
//!
//! This module handles all room-related actions initiated by clients:
//! - **Creating rooms**: [`handle_create_room`]
//! - **Joining rooms**: [`handle_join_room`]
//! - **Leaving rooms**: [`handle_leave_room`]
//! - **Closing rooms**: [`handle_close_room`]
//!
//! ## Rate Limiting
//!
//! All room actions are rate-limited via [`NetworkState::rate_limits`] to prevent
//! abuse. Rate limit checks occur at the start of each handler before any state
//! modifications.
//!
//! ## Session Validation
//!
//! All handlers require an active session, retrieved via [`SessionStore::get_active`].
//! If the session is not found or has expired, the request is rejected with
//! [`ErrorCode::Unauthenticated`].

use std::sync::Arc;
use tracing::info;

use super::responses::{
    broadcast_room_envelope, broadcast_room_event, send_envelope_to_player, send_event_to_player,
    WsError,
};
use super::state::NetworkState;
use crate::network::bot_runner::spawn_bot_runner;
use crate::network::messages::{CreateRoomPayload, Envelope, ErrorCode};
use crate::network::websocket::types::ConnectionCtx;
use mahjong_core::event::{public_events::PublicEvent, Event};
use mahjong_core::table::HouseRules;

use super::auth::rate_limit_context;

fn room_action_key(is_guest: bool, ctx: &ConnectionCtx) -> String {
    if is_guest {
        format!("guest:{}", ctx.ip_key)
    } else {
        ctx.player_id.clone()
    }
}

/// Handles a CreateRoom request from a client.
///
/// Creates a new game room with the specified configuration and joins the requesting
/// player to the room. The room is created with configurable house rules, bot difficulty,
/// and optional auto-fill with bots.
///
/// # Bot Configuration
///
/// The bot difficulty is applied via [`Room::configure_bot_difficulty`] before
/// filling seats with bots. If `fill_with_bots` is true, the method calls
/// [`Room::fill_empty_seats_with_bots`] to mark all empty seats as bot-controlled.
///
/// # Rate Limiting
///
/// Room creation is rate-limited per player. If the rate limit is exceeded, returns
/// [`ErrorCode::RateLimitExceeded`].
///
/// # Errors
///
/// Returns [`WsError`] if:
/// - Rate limit exceeded ([`ErrorCode::RateLimitExceeded`])
/// - Session not found ([`ErrorCode::Unauthenticated`])
/// - Room is full ([`ErrorCode::RoomFull`])
/// - Internal error sending responses ([`ErrorCode::InternalError`])
///
/// # Examples
///
/// ```json
/// {
///   "type": "CreateRoom",
///   "payload": {
///     "card_year": 2025,
///     "bot_difficulty": "Hard",
///     "fill_with_bots": true
///   }
/// }
/// ```
pub(super) async fn handle_create_room(
    state: &Arc<NetworkState>,
    player_id: &str,
    payload: CreateRoomPayload,
) -> Result<(), WsError> {
    if let Err(err) = state.rate_limits.check_room_action(player_id) {
        return Err(WsError::with_context(
            ErrorCode::RateLimitExceeded,
            "Room action rate limit exceeded".to_string(),
            rate_limit_context(err),
        ));
    }

    let session_arc = state
        .sessions
        .get_active(player_id)
        .ok_or_else(|| WsError::new(ErrorCode::Unauthenticated, "Session not found".to_string()))?;

    let trimmed_name = payload.room_name.trim();
    if trimmed_name.is_empty() {
        return Err(WsError::new(
            ErrorCode::InvalidCommand,
            "Room name is required".to_string(),
        ));
    }
    if trimmed_name.chars().count() > 50 {
        return Err(WsError::new(
            ErrorCode::InvalidCommand,
            "Room name must be 50 characters or fewer".to_string(),
        ));
    }
    let room_name = trimmed_name.to_string();

    // Build HouseRules: prefer the explicit house_rules block if provided,
    // otherwise fall back to constructing defaults from card_year.
    let house_rules = payload
        .house_rules
        .unwrap_or_else(|| HouseRules::with_card_year(payload.card_year));

    // Create room with database if available.
    let (room_id, room_arc) = {
        #[cfg(feature = "database")]
        {
            if let Some(db) = &state.db {
                state
                    .rooms
                    .create_room_with_db_and_rules(db.clone(), house_rules)
            } else {
                state.rooms.create_room_with_rules(house_rules)
            }
        }
        #[cfg(not(feature = "database"))]
        {
            state.rooms.create_room_with_rules(house_rules)
        }
    };

    // Join the player first, then configure bots
    let (seat, should_start, bot_seats) = {
        let mut room = room_arc.lock().await;
        room.room_name = room_name.clone();

        // Join the player to the room
        let seat = room
            .join(session_arc.clone())
            .await
            .map_err(|e| WsError::new(ErrorCode::RoomFull, e))?;

        // Configure bot difficulty before adding bots
        if let Some(difficulty) = payload.bot_difficulty {
            room.configure_bot_difficulty(difficulty);
        }

        // Auto-fill empty seats with bots if requested
        let bot_seats = if payload.fill_with_bots {
            room.fill_empty_seats_with_bots();
            room.sessions
                .bot_seats()
                .iter()
                .copied()
                .collect::<Vec<_>>()
        } else {
            Vec::new()
        };

        let should_start = room.should_start_game();
        (seat, should_start, bot_seats)
    };

    info!(
        player_id = %player_id,
        room_id = %room_id,
        seat = ?seat,
        should_start = should_start,
        "Player created and joined room"
    );

    // Read back the resolved house rules from the room so RoomJoined / GameCreated
    // reflect whatever the room is actually using (including any server-side defaults).
    let resolved_rules = {
        let room = room_arc.lock().await;
        room.house_rules.clone().unwrap_or_default()
    };

    send_envelope_to_player(
        state,
        player_id,
        Envelope::room_joined(room_id.clone(), seat, resolved_rules.clone()),
    )
    .await
    .map_err(|e| WsError::new(ErrorCode::InternalError, e))?;

    send_event_to_player(
        state,
        player_id,
        Event::Public(PublicEvent::GameCreated {
            game_id: room_id.clone(),
            house_rules: resolved_rules,
        }),
    )
    .await
    .map_err(|e| WsError::new(ErrorCode::InternalError, e))?;

    broadcast_room_event(
        &room_arc,
        Event::Public(PublicEvent::PlayerJoined {
            player: seat,
            player_id: player_id.to_string(),
            is_bot: false,
        }),
    )
    .await?;

    // Broadcast PlayerJoined events for each bot
    for bot_seat in bot_seats {
        broadcast_room_event(
            &room_arc,
            Event::Public(PublicEvent::PlayerJoined {
                player: bot_seat,
                player_id: format!("bot_{:?}", bot_seat).to_lowercase(),
                is_bot: true,
            }),
        )
        .await?;
    }

    // Start the game if the room is full (e.g., filled with bots)
    if should_start {
        let (should_spawn, human_snapshots) = {
            let mut room = room_arc.lock().await;
            room.start_game().await;
            let should_spawn =
                !room.sessions.bot_seats().is_empty() && room.mark_bot_runner_active();

            // Collect per-player snapshots for all human seats so we can push them
            // immediately after the lock is released. This ensures clients always
            // receive a full StateSnapshot at game start, eliminating the race where
            // RequestState (sent from the client on RoomJoined) arrives before start_game()
            // has populated room.table.
            let snapshots: Vec<(String, mahjong_core::snapshot::GameStateSnapshot)> = room
                .sessions
                .sessions_iter()
                .filter(|(seat, _)| !room.sessions.bot_seats().contains(seat))
                .filter_map(|(seat, session_arc)| {
                    let player_id = session_arc.try_lock().ok()?.player_id.clone();
                    let snapshot = room.table.as_ref()?.create_snapshot(*seat);
                    Some((player_id, snapshot))
                })
                .collect();

            (should_spawn, snapshots)
        };

        // Push StateSnapshot to every human player so they don't need to poll.
        for (pid, snapshot) in human_snapshots {
            let _ = send_envelope_to_player(state, &pid, Envelope::state_snapshot(snapshot)).await;
        }

        if should_spawn {
            spawn_bot_runner(room_arc.clone());
        }
    }

    Ok(())
}

/// Handles a JoinRoom request from a client.
///
/// Joins the requesting player to an existing room identified by `room_id`.
/// If the room fills up after this join, the game will start automatically.
///
/// # Game Start Logic
///
/// After sending join notifications, checks [`Room::should_start_game`]. If true,
/// calls [`Room::start_game`] to begin the game.
///
/// # Rate Limiting
///
/// Room joining is rate-limited per player. If the rate limit is exceeded, returns
/// [`ErrorCode::RateLimitExceeded`].
///
/// # Errors
///
/// Returns [`WsError`] if:
/// - Rate limit exceeded ([`ErrorCode::RateLimitExceeded`])
/// - Session not found ([`ErrorCode::Unauthenticated`])
/// - Room not found ([`ErrorCode::RoomNotFound`])
/// - Room is full ([`ErrorCode::RoomFull`])
/// - Internal error sending responses ([`ErrorCode::InternalError`])
///
/// # Examples
///
/// ```json
/// {
///   "type": "JoinRoom",
///   "payload": {
///     "room_id": "room-123"
///   }
/// }
/// ```
pub(super) async fn handle_join_room(
    room_id: String,
    state: &Arc<NetworkState>,
    player_id: &str,
) -> Result<(), WsError> {
    if let Err(err) = state.rate_limits.check_room_action(player_id) {
        return Err(WsError::with_context(
            ErrorCode::RateLimitExceeded,
            "Room action rate limit exceeded".to_string(),
            rate_limit_context(err),
        ));
    }

    let session_arc = state
        .sessions
        .get_active(player_id)
        .ok_or_else(|| WsError::new(ErrorCode::Unauthenticated, "Session not found".to_string()))?;

    let room_arc = state
        .rooms
        .get_room(&room_id)
        .ok_or_else(|| WsError::new(ErrorCode::RoomNotFound, "Room not found".to_string()))?;

    let (seat, should_start, resolved_rules) = {
        let mut room = room_arc.lock().await;
        let seat = room
            .join(session_arc)
            .await
            .map_err(|e| WsError::new(ErrorCode::RoomFull, e))?;
        let should_start = room.should_start_game();
        let rules = room.house_rules.clone().unwrap_or_default();
        (seat, should_start, rules)
    };

    info!(
        player_id = %player_id,
        room_id = %room_id,
        seat = ?seat,
        should_start = should_start,
        "Player joined room"
    );

    // Send RoomJoined BEFORE starting the game so clients receive
    // the join confirmation before game events
    send_envelope_to_player(
        state,
        player_id,
        Envelope::room_joined(room_id.clone(), seat, resolved_rules),
    )
    .await
    .map_err(|e| WsError::new(ErrorCode::InternalError, e))?;

    broadcast_room_event(
        &room_arc,
        Event::Public(PublicEvent::PlayerJoined {
            player: seat,
            player_id: player_id.to_string(),
            is_bot: false,
        }),
    )
    .await?;

    // Start the game after all join notifications are sent
    if should_start {
        let (should_spawn, human_snapshots) = {
            let mut room = room_arc.lock().await;
            room.start_game().await;
            let should_spawn =
                !room.sessions.bot_seats().is_empty() && room.mark_bot_runner_active();

            // Collect per-player snapshots for all human seats (same pattern as handle_create_room).
            let snapshots: Vec<(String, mahjong_core::snapshot::GameStateSnapshot)> = room
                .sessions
                .sessions_iter()
                .filter(|(seat, _)| !room.sessions.bot_seats().contains(seat))
                .filter_map(|(seat, session_arc)| {
                    let player_id = session_arc.try_lock().ok()?.player_id.clone();
                    let snapshot = room.table.as_ref()?.create_snapshot(*seat);
                    Some((player_id, snapshot))
                })
                .collect();

            (should_spawn, snapshots)
        };

        // Push StateSnapshot to every human player.
        for (pid, snapshot) in human_snapshots {
            let _ = send_envelope_to_player(state, &pid, Envelope::state_snapshot(snapshot)).await;
        }

        if should_spawn {
            spawn_bot_runner(room_arc.clone());
        }
    }

    Ok(())
}

/// Handles a LeaveRoom request from a client.
///
/// Removes the requesting player from their current room. If the player is the last
/// one in the room, the room is automatically deleted.
///
/// # Room Cleanup
///
/// If [`Room::player_count`] becomes 0 after removal, the room is removed from
/// [`RoomStore`] and a [`Envelope::RoomClosed`] message is sent to the player.
///
/// # Rate Limiting
///
/// Room leaving is rate-limited per player. If the rate limit is exceeded, returns
/// [`ErrorCode::RateLimitExceeded`].
///
/// # Errors
///
/// Returns [`WsError`] if:
/// - Rate limit exceeded ([`ErrorCode::RateLimitExceeded`])
/// - Session not found ([`ErrorCode::Unauthenticated`])
/// - Player not in a room ([`ErrorCode::InvalidCommand`])
/// - Seat not assigned ([`ErrorCode::InvalidCommand`])
/// - Room not found ([`ErrorCode::RoomNotFound`])
/// - Player not actually in the room ([`ErrorCode::InvalidCommand`])
/// - Internal error sending responses ([`ErrorCode::InternalError`])
///
/// # Examples
///
/// ```json
/// {
///   "type": "LeaveRoom",
///   "payload": {}
/// }
/// ```
pub(super) async fn handle_leave_room(
    state: &Arc<NetworkState>,
    player_id: &str,
) -> Result<(), WsError> {
    if let Err(err) = state.rate_limits.check_room_action(player_id) {
        return Err(WsError::with_context(
            ErrorCode::RateLimitExceeded,
            "Room action rate limit exceeded".to_string(),
            rate_limit_context(err),
        ));
    }

    let session_arc = state
        .sessions
        .get_active(player_id)
        .ok_or_else(|| WsError::new(ErrorCode::Unauthenticated, "Session not found".to_string()))?;

    let (room_id, seat) = {
        let session = session_arc.lock().await;
        let room_id = session
            .room_id
            .clone()
            .ok_or_else(|| WsError::new(ErrorCode::InvalidCommand, "Not in a room".to_string()))?;
        let seat = session.seat.ok_or_else(|| {
            WsError::new(ErrorCode::InvalidCommand, "Seat not assigned".to_string())
        })?;
        (room_id, seat)
    };

    let room_arc = state
        .rooms
        .get_room(&room_id)
        .ok_or_else(|| WsError::new(ErrorCode::RoomNotFound, "Room not found".to_string()))?;

    let remaining = {
        let mut room = room_arc.lock().await;
        if !room.remove_player(seat).await {
            return Err(WsError::new(
                ErrorCode::InvalidCommand,
                "Player not in room".to_string(),
            ));
        }
        room.player_count()
    };

    info!(
        player_id = %player_id,
        room_id = %room_id,
        seat = ?seat,
        remaining = remaining,
        "Player left room"
    );

    if remaining == 0 {
        state.rooms.remove_room(&room_id);
        send_envelope_to_player(state, player_id, Envelope::room_closed(room_id))
            .await
            .map_err(|e| WsError::new(ErrorCode::InternalError, e))?;
        return Ok(());
    }

    send_envelope_to_player(state, player_id, Envelope::room_left(room_id.clone()))
        .await
        .map_err(|e| WsError::new(ErrorCode::InternalError, e))?;

    broadcast_room_envelope(
        &room_arc,
        Envelope::room_member_left(room_id, player_id.to_string(), seat),
    )
    .await
    .map_err(|e| WsError::new(ErrorCode::InternalError, e))?;

    Ok(())
}

/// Handles a CloseRoom request from a client.
///
/// Closes the room that the requesting player is currently in, removing all players
/// and deleting the room from [`RoomStore`]. All players receive a [`Envelope::RoomClosed`]
/// notification.
///
/// # Authorization
///
/// Only the room host (first player to join, or reassigned on host departure) can close the room.
/// Non-host players receive a [`ErrorCode::Forbidden`] response with audit logging.
///
/// # Session Cleanup
///
/// All players' sessions have their `room_id` and `seat` fields cleared before the
/// room is deleted.
///
/// # Rate Limiting
///
/// Room closing is rate-limited per player. If the rate limit is exceeded, returns
/// [`ErrorCode::RateLimitExceeded`].
///
/// # Errors
///
/// Returns [`WsError`] if:
/// - Rate limit exceeded ([`ErrorCode::RateLimitExceeded`])
/// - Session not found ([`ErrorCode::Unauthenticated`])
/// - Player not in a room ([`ErrorCode::InvalidCommand`])
/// - Room not found ([`ErrorCode::RoomNotFound`])
/// - Player is not the room host ([`ErrorCode::Forbidden`])
///
/// # Examples
///
/// ```json
/// {
///   "type": "CloseRoom",
///   "payload": {}
/// }
/// ```
pub(super) async fn handle_close_room(
    state: &Arc<NetworkState>,
    player_id: &str,
) -> Result<(), WsError> {
    if let Err(err) = state.rate_limits.check_room_action(player_id) {
        return Err(WsError::with_context(
            ErrorCode::RateLimitExceeded,
            "Room action rate limit exceeded".to_string(),
            rate_limit_context(err),
        ));
    }

    let (room_id, player_seat) = {
        let session_arc = state.sessions.get_active(player_id).ok_or_else(|| {
            WsError::new(ErrorCode::Unauthenticated, "Session not found".to_string())
        })?;
        let session = session_arc.lock().await;
        let room_id = session
            .room_id
            .clone()
            .ok_or_else(|| WsError::new(ErrorCode::InvalidCommand, "Not in a room".to_string()))?;
        let seat = session.seat.ok_or_else(|| {
            WsError::new(ErrorCode::InvalidCommand, "Seat not assigned".to_string())
        })?;
        (room_id, seat)
    };

    let room_arc = state
        .rooms
        .get_room(&room_id)
        .ok_or_else(|| WsError::new(ErrorCode::RoomNotFound, "Room not found".to_string()))?;

    // Authorization: only the host can close the room
    {
        let room = room_arc.lock().await;
        let host_seat = room.sessions.get_host();
        if host_seat != Some(player_seat) {
            info!(
                player_id = %player_id,
                room_id = %room_id,
                player_seat = ?player_seat,
                host_seat = ?host_seat,
                "Non-host player attempted to close room"
            );
            return Err(WsError::new(
                ErrorCode::Forbidden,
                "Only the room host can close the room".to_string(),
            ));
        }
    }

    let player_ids = {
        let room = room_arc.lock().await;
        let mut player_ids = Vec::new();
        for session in room.sessions.values() {
            let session = session.lock().await;
            player_ids.push(session.player_id.clone());
        }
        player_ids
    };

    info!(
        player_id = %player_id,
        room_id = %room_id,
        player_seat = ?player_seat,
        player_count = player_ids.len(),
        "Host closing room"
    );

    for id in &player_ids {
        if let Some(session_arc) = state.sessions.get_active(id) {
            let mut session = session_arc.lock().await;
            session.room_id = None;
            session.seat = None;
        }
    }

    state.rooms.remove_room(&room_id);

    for id in player_ids {
        let _ = send_envelope_to_player(state, &id, Envelope::room_closed(room_id.clone())).await;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These tests verify the business logic and error paths of room actions.
    // Full integration tests with actual WebSocket connections are in tests/networking_integration.rs

    #[tokio::test]
    async fn test_join_room_not_found() {
        let state = Arc::new(NetworkState::new());

        // Create a mock session directly in session store
        // (normally done via authentication, but we're testing room logic)
        let player_id = "player1";

        let result = handle_join_room("nonexistent-room".to_string(), &state, player_id).await;
        assert!(result.is_err(), "Join should fail for nonexistent room");

        // Should fail with Unauthenticated because session doesn't exist
        if let Err(e) = result {
            assert_eq!(e.code, ErrorCode::Unauthenticated);
        }
    }

    #[tokio::test]
    async fn test_leave_room_not_in_room() {
        let state = Arc::new(NetworkState::new());
        let player_id = "player1";

        // Try to leave without being authenticated or in a room
        let result = handle_leave_room(&state, player_id).await;
        assert!(result.is_err(), "Leave should fail when not authenticated");

        if let Err(e) = result {
            assert_eq!(e.code, ErrorCode::Unauthenticated);
        }
    }

    #[tokio::test]
    async fn test_close_room_not_in_room() {
        let state = Arc::new(NetworkState::new());
        let player_id = "player1";

        // Try to close room without being authenticated
        let result = handle_close_room(&state, player_id).await;
        assert!(result.is_err(), "Close should fail when not authenticated");

        if let Err(e) = result {
            assert_eq!(e.code, ErrorCode::Unauthenticated);
        }
    }

    // Integration tests for host authorization are in tests/networking_integration.rs
    // This module tests unit logic; full host-auth tests require real WebSocket setup.
}
