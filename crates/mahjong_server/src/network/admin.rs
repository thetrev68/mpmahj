//! Admin HTTP endpoints for managing stuck games and room health.
//!
//! Provides administrative controls including:
//! - Force-forfeit players
//! - Force-pause/resume games
//! - View room health metrics
//! - List all active rooms
//!
//! All endpoints require JWT authentication with admin/moderator role.
//! Admin actions emit public events for transparency and audit trails.
//!
//! # Authorization
//!
//! - **Moderator**: Force-forfeit, force-pause/resume, view health metrics
//! - **Admin**: All moderator actions + list all rooms
//! - **SuperAdmin**: Reserved for future elevated privileges
//!
//! # Example
//!
//! ```bash
//! # Force forfeit a player
//! curl -X POST http://localhost:3000/api/admin/rooms/ROOM_ID/forfeit \
//!   -H "Authorization: Bearer $ADMIN_TOKEN" \
//!   -H "Content-Type: application/json" \
//!   -d '{"player_seat": "East", "reason": "AFK timeout"}'
//! ```

use crate::authorization::require_admin_role;
use crate::event_delivery::EventDelivery;
use crate::network::events::dispatch_room_event;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Utc};
use mahjong_core::event::{public_events::PublicEvent, Event};
use mahjong_core::flow::outcomes::{AbandonReason, GameEndCondition, GameResult};
use mahjong_core::history::{MoveHistoryEntry, MoveHistorySummary};
use mahjong_core::player::Seat;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use ts_rs::TS;

/// Lightweight state struct for admin handlers.
///
/// This allows admin handlers to work with any parent state that contains
/// auth and network fields, avoiding tight coupling to main.rs AppState.
pub struct AdminState {
    pub auth: crate::auth::AuthState,
    pub network: Arc<crate::network::NetworkState>,
}

/// Generic success response for admin actions.
#[derive(Serialize)]
pub struct SuccessResponse {
    pub success: bool,
    pub message: String,
}

/// Request payload for force-forfeit endpoint.
#[derive(Deserialize)]
pub struct ForfeitPayload {
    pub player_seat: Seat,
    pub reason: String,
}

/// Request payload for force-pause endpoint.
#[derive(Deserialize)]
pub struct PausePayload {
    pub reason: String,
}

/// Memory metrics for a room.
#[derive(Serialize)]
pub struct MemoryMetrics {
    /// Analysis log size in KB
    pub analysis: usize,
    /// History size in KB
    pub history: usize,
    /// Total memory usage in KB
    pub total: usize,
}

/// Connection information for a player.
#[derive(Serialize)]
pub struct ConnectionInfo {
    pub seat: Seat,
    pub player_id: String,
    pub connected: bool,
    pub last_pong: DateTime<Utc>,
}

/// Room health metrics response.
#[derive(Serialize)]
pub struct RoomHealthResponse {
    pub room_id: String,
    pub created_at: DateTime<Utc>,
    pub game_started: bool,
    pub player_count: usize,
    pub bot_count: usize,
    pub paused: bool,
    pub paused_by: Option<Seat>,
    pub host_seat: Option<Seat>,
    pub memory_kb: MemoryMetrics,
    pub history_length: usize,
    pub analysis_log_length: usize,
    pub connections: Vec<ConnectionInfo>,
}

/// Summary of a room for the list endpoint.
#[derive(Serialize)]
pub struct RoomSummary {
    pub room_id: String,
    pub created_at: DateTime<Utc>,
    pub game_started: bool,
    pub player_count: usize,
    pub paused: bool,
}

/// Replay data format for download.
#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct ReplayData {
    pub room_id: String,
    pub created_at: DateTime<Utc>,
    pub players: HashMap<Seat, String>,
    pub history: Vec<MoveHistorySummary>,
}

/// Force a player to forfeit.
///
/// # Authorization
/// Requires Moderator+ role.
///
/// # Endpoint
/// `POST /api/admin/rooms/:room_id/forfeit`
///
/// # Request Body
/// ```json
/// {
///   "player_seat": "East",
///   "reason": "AFK timeout"
/// }
/// ```
///
/// # Emits
/// - `AdminForfeitOverride` event (public, broadcast to all)
/// - `GameOver` event with forfeit end condition
pub async fn admin_forfeit_player(
    Path(room_id): Path<String>,
    State(state): State<Arc<AdminState>>,
    headers: HeaderMap,
    Json(payload): Json<ForfeitPayload>,
) -> Result<Json<SuccessResponse>, (StatusCode, String)> {
    // Validate admin token
    let admin_ctx = require_admin_role(&headers, &state.auth)?;

    // Check role (Moderator+)
    if !admin_ctx.role.is_moderator_or_higher() {
        return Err((
            StatusCode::FORBIDDEN,
            "Moderator role required for forfeit action".to_string(),
        ));
    }

    // Get room
    let room = state
        .network
        .rooms
        .get_room(&room_id)
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    let mut room_lock = room.lock().await;

    // Validate player seat exists in room
    if !room_lock.sessions.is_occupied(payload.player_seat) {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("Player seat {:?} not found in room", payload.player_seat),
        ));
    }

    // Emit AdminForfeitOverride event
    let admin_event = Event::Public(PublicEvent::AdminForfeitOverride {
        admin_id: admin_ctx.user_id.clone(),
        admin_display_name: admin_ctx.display_name.clone(),
        forfeited_player: payload.player_seat,
        reason: payload.reason.clone(),
    });
    dispatch_room_event(&mut room_lock, admin_event, EventDelivery::broadcast()).await;

    // Emit PlayerForfeited event (reuse existing forfeit logic)
    let forfeit_event = Event::Public(PublicEvent::PlayerForfeited {
        player: payload.player_seat,
        reason: Some(payload.reason),
    });
    dispatch_room_event(&mut room_lock, forfeit_event, EventDelivery::broadcast()).await;

    // Create GameResult for forfeit
    if let Some(table) = room_lock.table.as_ref() {
        let mut final_hands = HashMap::new();
        let mut final_scores = HashMap::new();

        // Collect final hands from all players
        for seat in Seat::all() {
            if let Some(player_state) = table.players.get(&seat) {
                final_hands.insert(seat, player_state.hand.clone());
                // Mark forfeiting player with negative score, others with 0
                final_scores.insert(seat, if seat == payload.player_seat { -100 } else { 0 });
            }
        }

        let game_result = GameResult {
            winner: None,
            winning_pattern: None,
            score_breakdown: None,
            final_scores,
            final_hands,
            next_dealer: table.dealer,
            end_condition: GameEndCondition::Abandoned(AbandonReason::Forfeit),
        };

        // Emit GameOver event
        let game_over_event = Event::Public(PublicEvent::GameOver {
            winner: None,
            result: game_result,
        });
        dispatch_room_event(&mut room_lock, game_over_event, EventDelivery::broadcast()).await;
    }

    Ok(Json(SuccessResponse {
        success: true,
        message: format!(
            "Player {:?} forfeited by admin {}",
            payload.player_seat, admin_ctx.display_name
        ),
    }))
}

/// Force-pause a game.
///
/// # Authorization
/// Requires Moderator+ role.
///
/// # Endpoint
/// `POST /api/admin/rooms/:room_id/pause`
///
/// # Request Body
/// ```json
/// {
///   "reason": "Server maintenance"
/// }
/// ```
///
/// # Emits
/// - `AdminPauseOverride` event (public, broadcast to all)
pub async fn admin_pause_game(
    Path(room_id): Path<String>,
    State(state): State<Arc<AdminState>>,
    headers: HeaderMap,
    Json(payload): Json<PausePayload>,
) -> Result<Json<SuccessResponse>, (StatusCode, String)> {
    // Validate admin token
    let admin_ctx = require_admin_role(&headers, &state.auth)?;

    // Check role (Moderator+)
    if !admin_ctx.role.is_moderator_or_higher() {
        return Err((
            StatusCode::FORBIDDEN,
            "Moderator role required for pause action".to_string(),
        ));
    }

    // Get room
    let room = state
        .network
        .rooms
        .get_room(&room_id)
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    let mut room_lock = room.lock().await;

    // Check if already paused
    if room_lock.history.is_paused() {
        return Err((StatusCode::CONFLICT, "Game is already paused".to_string()));
    }

    // Update pause state
    room_lock.history.set_paused(true, None); // Admin override, not a specific seat

    // Emit AdminPauseOverride event
    let event = Event::Public(PublicEvent::AdminPauseOverride {
        admin_id: admin_ctx.user_id.clone(),
        admin_display_name: admin_ctx.display_name.clone(),
        reason: payload.reason.clone(),
    });
    dispatch_room_event(&mut room_lock, event, EventDelivery::broadcast()).await;

    Ok(Json(SuccessResponse {
        success: true,
        message: format!("Game paused by admin {}", admin_ctx.display_name),
    }))
}

/// Force-resume a game.
///
/// # Authorization
/// Requires Moderator+ role.
///
/// # Endpoint
/// `POST /api/admin/rooms/:room_id/resume`
///
/// # Emits
/// - `AdminResumeOverride` event (public, broadcast to all)
pub async fn admin_resume_game(
    Path(room_id): Path<String>,
    State(state): State<Arc<AdminState>>,
    headers: HeaderMap,
) -> Result<Json<SuccessResponse>, (StatusCode, String)> {
    // Validate admin token
    let admin_ctx = require_admin_role(&headers, &state.auth)?;

    // Check role (Moderator+)
    if !admin_ctx.role.is_moderator_or_higher() {
        return Err((
            StatusCode::FORBIDDEN,
            "Moderator role required for resume action".to_string(),
        ));
    }

    // Get room
    let room = state
        .network
        .rooms
        .get_room(&room_id)
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    let mut room_lock = room.lock().await;

    // Check if paused
    if !room_lock.history.is_paused() {
        return Err((StatusCode::CONFLICT, "Game is not paused".to_string()));
    }

    // Update pause state
    room_lock.history.set_paused(false, None);

    // Emit AdminResumeOverride event
    let event = Event::Public(PublicEvent::AdminResumeOverride {
        admin_id: admin_ctx.user_id.clone(),
        admin_display_name: admin_ctx.display_name.clone(),
    });
    dispatch_room_event(&mut room_lock, event, EventDelivery::broadcast()).await;

    Ok(Json(SuccessResponse {
        success: true,
        message: format!("Game resumed by admin {}", admin_ctx.display_name),
    }))
}

/// Get room health metrics.
///
/// # Authorization
/// Requires Moderator+ role.
///
/// # Endpoint
/// `GET /api/admin/rooms/:room_id/health`
///
/// # Response
/// Returns detailed metrics including:
/// - Player count, bot count
/// - Pause state and host
/// - Memory usage (analysis, history)
/// - Connection status per player
pub async fn admin_get_room_health(
    Path(room_id): Path<String>,
    State(state): State<Arc<AdminState>>,
    headers: HeaderMap,
) -> Result<Json<RoomHealthResponse>, (StatusCode, String)> {
    // Validate admin token
    let admin_ctx = require_admin_role(&headers, &state.auth)?;

    // Check role (Moderator+)
    if !admin_ctx.role.is_moderator_or_higher() {
        return Err((
            StatusCode::FORBIDDEN,
            "Moderator role required for health metrics".to_string(),
        ));
    }

    // Get room
    let room = state
        .network
        .rooms
        .get_room(&room_id)
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    let room_lock = room.lock().await;

    // Collect memory metrics
    let analysis_log = room_lock.analysis.get_analysis_log();
    let analysis_kb = std::mem::size_of_val(analysis_log) / 1024;
    let history = room_lock.history.get_history();
    let history_kb = std::mem::size_of_val(history) / 1024;
    let total_kb = analysis_kb + history_kb;

    // Collect connection info
    let mut connections = Vec::new();
    for (seat, session_arc) in room_lock.sessions.sessions_iter() {
        let session = session_arc.lock().await;
        connections.push(ConnectionInfo {
            seat: *seat,
            player_id: session.player_id.clone(),
            connected: session.connected,
            last_pong: session.last_pong,
        });
    }

    Ok(Json(RoomHealthResponse {
        room_id: room_lock.room_id.clone(),
        created_at: room_lock.created_at,
        game_started: room_lock.game_started,
        player_count: room_lock.sessions.player_count(),
        bot_count: room_lock.sessions.bot_seats().len(),
        paused: room_lock.history.is_paused(),
        paused_by: room_lock.history.get_paused_by(),
        host_seat: room_lock.sessions.get_host(),
        memory_kb: MemoryMetrics {
            analysis: analysis_kb,
            history: history_kb,
            total: total_kb,
        },
        history_length: room_lock.history.len(),
        analysis_log_length: room_lock.analysis.analysis_log_len(),
        connections,
    }))
}

/// List all active rooms.
///
/// # Authorization
/// Requires Admin+ role (higher privilege than moderator).
///
/// # Endpoint
/// `GET /api/admin/rooms`
///
/// # Response
/// Returns array of room summaries with basic info:
/// - room_id, created_at, game_started, player_count, paused
pub async fn admin_list_rooms(
    State(state): State<Arc<AdminState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<RoomSummary>>, (StatusCode, String)> {
    // Validate admin token
    let admin_ctx = require_admin_role(&headers, &state.auth)?;

    // Check role (Admin+ required - higher privilege)
    if !admin_ctx.role.is_admin_or_higher() {
        return Err((
            StatusCode::FORBIDDEN,
            "Admin role required for listing all rooms".to_string(),
        ));
    }

    // Get all room IDs
    let room_ids = state.network.rooms.list_rooms();

    // Collect summaries
    let mut summaries = Vec::new();
    for room_id in room_ids {
        if let Some(room) = state.network.rooms.get_room(&room_id) {
            let room_lock = room.lock().await;
            summaries.push(RoomSummary {
                room_id: room_lock.room_id.clone(),
                created_at: room_lock.created_at,
                game_started: room_lock.game_started,
                player_count: room_lock.sessions.len(),
                paused: room_lock.history.is_paused(),
            });
        }
    }

    Ok(Json(summaries))
}

/// Export full game history.
///
/// # Authorization
/// Requires Admin+ role.
///
/// # Endpoint
/// `GET /api/admin/rooms/:room_id/export`
///
/// # Response
/// Returns full move history vector including snapshots.
pub async fn admin_export_history(
    Path(room_id): Path<String>,
    State(state): State<Arc<AdminState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<MoveHistoryEntry>>, (StatusCode, String)> {
    // Validate admin token
    let admin_ctx = require_admin_role(&headers, &state.auth)?;

    // Check role (Admin+)
    if !admin_ctx.role.is_admin_or_higher() {
        return Err((
            StatusCode::FORBIDDEN,
            "Admin role required for export".to_string(),
        ));
    }

    // Get room
    let room = state
        .network
        .rooms
        .get_room(&room_id)
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    let room_lock = room.lock().await;

    // Return history - clone the vector of entries
    let history_entries: Vec<_> = room_lock.history.get_history().to_vec();
    Ok(Json(history_entries))
}

/// Download replay data.
///
/// # Authorization
/// Requires Admin+ role.
///
/// # Endpoint
/// `GET /api/admin/rooms/:room_id/replay/download`
///
/// # Response
/// Returns ReplayData struct for use in replay viewer.
pub async fn admin_download_replay(
    Path(room_id): Path<String>,
    State(state): State<Arc<AdminState>>,
    headers: HeaderMap,
) -> Result<Json<ReplayData>, (StatusCode, String)> {
    // Validate admin token
    let admin_ctx = require_admin_role(&headers, &state.auth)?;

    // Check role (Admin+)
    if !admin_ctx.role.is_admin_or_higher() {
        return Err((
            StatusCode::FORBIDDEN,
            "Admin role required for download".to_string(),
        ));
    }

    // Get room
    let room = state
        .network
        .rooms
        .get_room(&room_id)
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    let room_lock = room.lock().await;

    // Collect players
    let mut players = HashMap::new();
    for (seat, session_arc) in room_lock.sessions.sessions_iter() {
        let session = session_arc.lock().await;
        players.insert(*seat, session.player_id.clone());
    }

    // Convert history entries to summaries (lighter weight, no snapshots)
    let history_summaries: Vec<MoveHistorySummary> = room_lock
        .history
        .iter()
        .map(|entry| MoveHistorySummary {
            move_number: entry.move_number,
            timestamp: entry.timestamp,
            seat: entry.seat,
            action: entry.action.clone(),
            description: entry.description.clone(),
        })
        .collect();

    Ok(Json(ReplayData {
        room_id: room_lock.room_id.clone(),
        created_at: room_lock.created_at,
        players,
        history: history_summaries,
    }))
}
