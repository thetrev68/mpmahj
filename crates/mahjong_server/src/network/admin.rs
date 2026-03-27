//! Admin HTTP endpoints for managing stuck games and room health.
//!
//! Provides administrative controls including:
//! - Force-pause/resume games
//! - View room health metrics
//! - List all active rooms
//!
//! All endpoints require JWT authentication with admin/moderator role.
//! Admin actions emit public events for transparency and audit trails.
//!
//! # Authorization
//!
//! - **Moderator**: Force-pause/resume, view health metrics
//! - **Admin**: All moderator actions + list all rooms
//! - **SuperAdmin**: Reserved for future elevated privileges

use crate::authorization::require_admin_role;
#[cfg(feature = "database")]
use crate::db::GameListRecord;
use crate::event_delivery::EventDelivery;
use crate::network::events::dispatch_room_event;
#[cfg(feature = "database")]
use crate::replay::{ReplayError, ReplayResponse, ReplayService};
#[cfg(feature = "database")]
use axum::extract::Query;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Utc};
use mahjong_core::event::{public_events::PublicEvent, Event};
use mahjong_core::history::{MoveHistoryEntry, MoveHistorySummary};
use mahjong_core::player::Seat;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use ts_rs::TS;

/// Lightweight state struct for admin handlers.
///
/// This allows admin handlers to work with any parent state that contains
/// auth, network, and database fields, avoiding tight coupling to main.rs AppState.
pub struct AdminState {
    /// Authentication state used for role checks.
    pub auth: crate::auth::AuthState,
    /// Shared network state containing active rooms/sessions.
    pub network: Arc<crate::network::NetworkState>,
    /// Optional database connection for replay and game history queries.
    #[cfg(feature = "database")]
    pub db: Option<crate::db::Database>,
}

/// Generic success response for admin actions.
#[derive(Serialize)]
pub struct SuccessResponse {
    /// Whether the operation succeeded.
    pub success: bool,
    /// Human-readable operation result.
    pub message: String,
}

/// Request payload for force-pause endpoint.
#[derive(Deserialize)]
pub struct PausePayload {
    /// Operator-provided pause reason.
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
    /// Seat bound to this connection entry.
    pub seat: Seat,
    /// Auth player identifier for this seat.
    pub player_id: String,
    /// Whether websocket/session is currently connected.
    pub connected: bool,
    /// Timestamp of last successful pong heartbeat.
    pub last_pong: DateTime<Utc>,
}

/// Room health metrics response.
#[derive(Serialize)]
pub struct RoomHealthResponse {
    /// Target room identifier.
    pub room_id: String,
    /// Room creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Whether the game has started in this room.
    pub game_started: bool,
    /// Number of occupied seats (human + bots).
    pub player_count: usize,
    /// Number of bot-controlled seats.
    pub bot_count: usize,
    /// Whether gameplay is currently paused.
    pub paused: bool,
    /// Seat that initiated pause, if player-host pause.
    pub paused_by: Option<Seat>,
    /// Current host/creator seat for the room.
    pub host_seat: Option<Seat>,
    /// Approximate memory consumption metrics.
    pub memory_kb: MemoryMetrics,
    /// Count of history entries recorded.
    pub history_length: usize,
    /// Count of analysis log entries recorded.
    pub analysis_log_length: usize,
    /// Per-seat connectivity status details.
    pub connections: Vec<ConnectionInfo>,
}

/// Summary of a room for the list endpoint.
#[derive(Serialize)]
pub struct RoomSummary {
    /// Room identifier.
    pub room_id: String,
    /// Room creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Whether the game has started in this room.
    pub game_started: bool,
    /// Number of occupied seats.
    pub player_count: usize,
    /// Whether gameplay is currently paused.
    pub paused: bool,
}

/// Replay data format for download.
#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct ReplayData {
    /// Room identifier.
    pub room_id: String,
    /// Room creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Player identifiers keyed by seat.
    pub players: HashMap<Seat, String>,
    /// Replay move summaries in chronological order.
    pub history: Vec<MoveHistorySummary>,
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
    let admin_id = admin_ctx.user_id;
    let admin_display_name = admin_ctx.display_name;
    let message = format!("Game paused by admin {}", admin_display_name);
    let reason = payload.reason;

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
        admin_id,
        admin_display_name,
        reason,
    });
    dispatch_room_event(&mut room_lock, event, EventDelivery::broadcast()).await;

    Ok(Json(SuccessResponse {
        success: true,
        message,
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
    let admin_id = admin_ctx.user_id;
    let admin_display_name = admin_ctx.display_name;
    let message = format!("Game resumed by admin {}", admin_display_name);

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
        admin_id,
        admin_display_name,
    });
    dispatch_room_event(&mut room_lock, event, EventDelivery::broadcast()).await;

    Ok(Json(SuccessResponse {
        success: true,
        message,
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
        room_id,
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
                room_id,
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
        room_id,
        created_at: room_lock.created_at,
        players,
        history: history_summaries,
    }))
}

/// Query params for admin replay requests.
#[cfg(feature = "database")]
#[derive(serde::Deserialize)]
pub struct AdminReplayQuery {
    /// Optional query param (unused, reserved for consistency with player replay endpoint).
    pub _unused: Option<String>,
}

/// Retrieves an admin replay, optionally enriched with in-memory analysis logs.
///
/// # Authorization
/// Requires Admin+ role (higher privilege than moderator).
///
/// # Endpoint
/// `GET /api/admin/replays/:game_id`
///
/// # Response
/// Returns full admin replay with all events and optional analysis log.
/// Includes live analysis logs if the room is still active.
#[cfg(feature = "database")]
pub async fn admin_get_replay(
    Path(game_id): Path<String>,
    State(state): State<Arc<AdminState>>,
    headers: HeaderMap,
) -> Result<Json<ReplayResponse>, (StatusCode, String)> {
    // Validate admin token
    let admin_ctx = require_admin_role(&headers, &state.auth)?;

    // Check role (Admin+ required)
    if !admin_ctx.role.is_admin_or_higher() {
        return Err((
            StatusCode::FORBIDDEN,
            "Admin role required to access replays".to_string(),
        ));
    }

    // Log admin access for audit trail
    tracing::info!(
        admin_id = %admin_ctx.user_id,
        admin_name = %admin_ctx.display_name,
        game_id = %game_id,
        "Admin accessed game replay"
    );

    let db = state.db.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Database not configured".to_string(),
    ))?;

    // Ensure game exists before attempting to load replay
    let game = db
        .get_game(&game_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if game.is_none() {
        return Err((StatusCode::NOT_FOUND, "Game not found".to_string()));
    }

    let service = ReplayService::new(db.clone());
    let mut replay = service
        .get_admin_replay(&game_id)
        .await
        .map_err(map_admin_replay_error)?;

    // Enrich with live analysis logs if the room is still active
    if let Some(room_arc) = state.network.rooms.get_room(&game_id) {
        let room = room_arc.lock().await;
        let log = room.analysis.get_analysis_log();
        if !log.is_empty() {
            replay.analysis_log = Some(log.to_vec());
        }
    }

    Ok(Json(ReplayResponse::AdminReplay(replay)))
}

/// Query params for admin games list.
#[cfg(feature = "database")]
#[derive(serde::Deserialize)]
pub struct AdminGamesListQuery {
    /// Maximum number of games to return (1-200, default 20).
    pub limit: Option<i64>,
}

/// Lists recent games for admin tooling.
///
/// # Authorization
/// Requires Admin+ role.
///
/// # Endpoint
/// `GET /api/admin/games`
///
/// # Response
/// Returns array of game records with basic metadata.
#[cfg(feature = "database")]
pub async fn admin_list_games(
    Query(query): Query<AdminGamesListQuery>,
    State(state): State<Arc<AdminState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<GameListRecord>>, (StatusCode, String)> {
    // Validate admin token
    let admin_ctx = require_admin_role(&headers, &state.auth)?;

    // Check role (Admin+ required)
    if !admin_ctx.role.is_admin_or_higher() {
        return Err((
            StatusCode::FORBIDDEN,
            "Admin role required to list games".to_string(),
        ));
    }

    // Log admin access for audit trail
    tracing::info!(
        admin_id = %admin_ctx.user_id,
        admin_name = %admin_ctx.display_name,
        limit = ?query.limit,
        "Admin listed games"
    );

    let db = state.db.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Database not configured".to_string(),
    ))?;

    let limit = query.limit.unwrap_or(20).clamp(1, 200);
    let games = db
        .list_recent_games(limit)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(games))
}

/// Converts replay errors into HTTP status codes with user-visible messages.
#[cfg(feature = "database")]
fn map_admin_replay_error(err: ReplayError) -> (StatusCode, String) {
    match err {
        ReplayError::GameNotFound => (StatusCode::NOT_FOUND, "Game not found".to_string()),
        ReplayError::Deserialization(_) | ReplayError::Database(_) => {
            (StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
        }
        ReplayError::ValidatorUnavailable(_) => {
            (StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
        }
    }
}

#[cfg(feature = "database")]
#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::{AuthState, Claims};
    use axum::extract::{Path, Query, State};
    use axum::http::header::AUTHORIZATION as AXUM_AUTHORIZATION;
    use axum::http::{HeaderMap, HeaderValue, StatusCode};
    use axum::{routing::get, Router};
    use reqwest::header::AUTHORIZATION as REQWEST_AUTHORIZATION;
    use reqwest::Client;
    use std::sync::Arc;
    use tokio::net::TcpListener;

    fn non_admin_auth_state() -> AuthState {
        AuthState::with_test_tokens(
            "http://localhost:54321".to_string(),
            None,
            vec![(
                "non-admin-token".to_string(),
                Claims {
                    sub: "user-123".to_string(),
                    exp: 1_700_000_000,
                    role: "user".to_string(),
                },
            )],
        )
    }

    fn admin_auth_state() -> AuthState {
        AuthState::with_test_tokens(
            "http://localhost:54321".to_string(),
            None,
            vec![(
                "admin-token".to_string(),
                Claims {
                    sub: "admin-123".to_string(),
                    exp: 1_700_000_000,
                    role: "admin".to_string(),
                },
            )],
        )
    }

    fn admin_state_with_token(token_role: &str) -> (Arc<AdminState>, HeaderMap) {
        let auth = match token_role {
            "user" => non_admin_auth_state(),
            _ => admin_auth_state(),
        };

        let state = Arc::new(AdminState {
            auth,
            network: Arc::new(crate::network::NetworkState::new()),
            #[cfg(feature = "database")]
            db: None,
        });

        let mut headers = HeaderMap::new();
        if token_role == "anonymous" {
            return (state, headers);
        }

        let token = match token_role {
            "admin" => "admin-token",
            "user" => "non-admin-token",
            _ => "admin-token",
        };
        headers.insert(
            AXUM_AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        );
        (state, headers)
    }

    fn build_query(limit: Option<i64>) -> Query<AdminGamesListQuery> {
        Query(AdminGamesListQuery { limit })
    }

    fn admin_router_for_http_tests() -> Router {
        let auth = AuthState::with_test_tokens(
            "http://localhost:54321".to_string(),
            None,
            vec![
                (
                    "admin-token".to_string(),
                    Claims {
                        sub: "admin-123".to_string(),
                        exp: 1_700_000_000,
                        role: "admin".to_string(),
                    },
                ),
                (
                    "non-admin-token".to_string(),
                    Claims {
                        sub: "user-123".to_string(),
                        exp: 1_700_000_000,
                        role: "user".to_string(),
                    },
                ),
            ],
        );

        let state = Arc::new(AdminState {
            auth,
            network: Arc::new(crate::network::NetworkState::new()),
            #[cfg(feature = "database")]
            db: None,
        });

        Router::new()
            .route("/api/admin/replays/:game_id", get(admin_get_replay))
            .route("/api/admin/games", get(admin_list_games))
            .with_state(state)
    }

    async fn send_request(path: &str, auth_header: Option<&str>) -> u16 {
        let app = admin_router_for_http_tests();
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("failed to bind test listener");
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            axum::serve(listener, app.into_make_service())
                .await
                .expect("admin test server exited unexpectedly");
        });

        let client = Client::new();
        let mut request = client.get(format!("http://{}/{}", addr, path));
        if let Some(value) = auth_header {
            request = request.header(REQWEST_AUTHORIZATION, value);
        }

        let response = request.send().await.expect("failed to send HTTP request");
        let status = response.status();
        let numeric = status.as_u16();
        server.abort();
        numeric
    }

    #[tokio::test]
    async fn admin_get_replay_unauthenticated_is_unauthorized() {
        let (state, headers) = admin_state_with_token("anonymous");
        let result = admin_get_replay(Path("game-123".to_string()), State(state), headers).await;
        assert_eq!(result.unwrap_err().0, StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn admin_get_replay_forbidden_for_non_admin_token() {
        let (state, headers) = admin_state_with_token("user");
        let result = admin_get_replay(Path("game-123".to_string()), State(state), headers).await;
        assert_eq!(result.unwrap_err().0, StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn admin_list_games_unauthenticated_is_unauthorized() {
        let (state, headers) = admin_state_with_token("anonymous");
        let result = admin_list_games(build_query(None), State(state), headers).await;
        assert_eq!(result.unwrap_err().0, StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn admin_list_games_forbidden_for_non_admin_token() {
        let (state, headers) = admin_state_with_token("user");
        let result = admin_list_games(build_query(None), State(state), headers).await;
        assert_eq!(result.unwrap_err().0, StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn with_test_admin_state_allows_admin_role_requests_to_reach_db_gate() {
        let (state, headers) = admin_state_with_token("admin");
        let result = admin_list_games(build_query(None), State(state), headers).await;
        let (status, _) =
            result.expect_err("admin endpoint should fail before db access with test token");
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn admin_get_replay_route_rejects_unauthenticated_as_401() {
        let status = send_request("api/admin/replays/game-123", None).await;
        assert_eq!(status, 401);
    }

    #[tokio::test]
    async fn admin_get_replay_route_rejects_non_admin_as_403() {
        let status =
            send_request("api/admin/replays/game-123", Some("Bearer non-admin-token")).await;
        assert_eq!(status, 403);
    }

    #[tokio::test]
    async fn admin_list_games_route_rejects_unauthenticated_as_401() {
        let status = send_request("api/admin/games", None).await;
        assert_eq!(status, 401);
    }

    #[tokio::test]
    async fn admin_list_games_route_rejects_non_admin_as_403() {
        let status = send_request("api/admin/games", Some("Bearer non-admin-token")).await;
        assert_eq!(status, 403);
    }
}
