//! HTTP and WebSocket entrypoint for the Mahjong server.
//!
//! Runs in one of two modes:
//! - Full mode when `DATABASE_URL` and `SUPABASE_URL` are set.
//! - Memory-only mode when either variable is missing.
//!
//! ```no_run
//! # async fn run() -> anyhow::Result<()> {
//! // Start the server with the environment configured.
//! // DATABASE_URL=postgres://... SUPABASE_URL=https://... cargo run -p mahjong_server
//! # Ok(())
//! # }
//! ```
use axum::{
    extract::{ConnectInfo, Path, Query, State, WebSocketUpgrade},
    http::{HeaderMap, StatusCode},
    response::Response,
    routing::get,
    Json, Router,
};
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

use mahjong_core::player::Seat;
use mahjong_server::auth::AuthState;
use mahjong_server::db::{Database, GameListRecord};
use mahjong_server::network::{ws_handler, NetworkState};
use mahjong_server::replay::{ReplayError, ReplayResponse, ReplayService};

/// Shared state available to all routes.
struct AppState {
    auth: AuthState,
    network: Arc<NetworkState>,
    db: Option<Database>,
}

/// Bootstraps the Axum server, state, and routes.
#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    let _ = dotenvy::dotenv();

    // Check if we should run with database.
    let database_url = env::var("DATABASE_URL").ok();
    let supabase_url = env::var("SUPABASE_URL").ok();

    let (network_state, auth_state, db) = match (database_url, supabase_url) {
        (Some(db_url), Some(supabase_url)) => {
            // Full mode with database and auth.
            println!("Starting with database and auth support...");
            let db = Database::new(&db_url)
                .await
                .expect("Failed to connect to database");

            if let Err(e) = db.run_migrations().await {
                eprintln!("WARNING: Failed to run database migrations: {}", e);
                eprintln!("Database persistence may not work correctly.");
            } else {
                println!("Database migrations completed successfully");
            }

            let auth = AuthState::new(supabase_url);
            if let Err(e) = auth.load_keys().await {
                eprintln!("CRITICAL WARNING: Failed to load Auth keys: {}", e);
            }

            let network = NetworkState::new_with_db(db.clone(), auth.clone());
            (Arc::new(network), auth, Some(db))
        }
        _ => {
            // Memory-only mode without database.
            println!("WARNING: Running in memory-only mode (no DATABASE_URL or SUPABASE_URL)");
            println!("Game state will not be persisted, and auth will use mock tokens.");
            let auth = AuthState::new("http://localhost:54321".to_string());
            let network = NetworkState::new();
            (Arc::new(network), auth, None)
        }
    };

    let state = Arc::new(AppState {
        auth: auth_state,
        network: network_state,
        db,
    });

    // Router.
    let app = Router::new()
        .route("/", get(health_check))
        .route("/me", get(get_current_user)) // Protected route.
        .route("/ws", get(websocket_handler)) // WebSocket endpoint.
        .route("/api/replays/:game_id", get(get_player_replay))
        .route("/api/admin/replays/:game_id", get(get_admin_replay))
        .route("/api/admin/games", get(list_admin_games))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    // Run.
    let port = env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = SocketAddr::from(([0, 0, 0, 0], port.parse().unwrap()));
    println!("Server running on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}

/// Basic liveness endpoint.
async fn health_check() -> &'static str {
    "Mahjong Server is Healthy!"
}

/// Query params for player-specific replay requests.
#[derive(serde::Deserialize)]
struct PlayerReplayQuery {
    seat: Seat,
}

/// Query params for admin game list requests.
#[derive(serde::Deserialize)]
struct AdminGamesQuery {
    limit: Option<i64>,
}

/// Retrieves a player-facing replay for the requested game.
async fn get_player_replay(
    Path(game_id): Path<String>,
    Query(query): Query<PlayerReplayQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<ReplayResponse>, (StatusCode, String)> {
    let db = state.db.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Database not configured".to_string(),
    ))?;

    ensure_game_exists(db, &game_id).await?;

    let service = ReplayService::new(db.clone());
    let replay = service
        .get_player_replay(&game_id, query.seat)
        .await
        .map_err(map_replay_error)?;

    Ok(Json(ReplayResponse::PlayerReplay(replay)))
}

/// Retrieves an admin replay, optionally enriched with in-memory analysis logs.
async fn get_admin_replay(
    Path(game_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<ReplayResponse>, (StatusCode, String)> {
    let db = state.db.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Database not configured".to_string(),
    ))?;

    ensure_game_exists(db, &game_id).await?;

    let service = ReplayService::new(db.clone());
    let mut replay = service
        .get_admin_replay(&game_id)
        .await
        .map_err(map_replay_error)?;

    if let Some(room_arc) = state.network.rooms.get_room(&game_id) {
        let room = room_arc.lock().await;
        let log = room.get_analysis_log();
        if !log.is_empty() {
            replay.analysis_log = Some(log.to_vec());
        }
    }

    Ok(Json(ReplayResponse::AdminReplay(replay)))
}

/// Lists recent games for admin tooling.
async fn list_admin_games(
    Query(query): Query<AdminGamesQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<GameListRecord>>, (StatusCode, String)> {
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

/// Ensures the referenced game exists in persistence before further work.
async fn ensure_game_exists(db: &Database, game_id: &str) -> Result<(), (StatusCode, String)> {
    let game = db
        .get_game(game_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if game.is_none() {
        return Err((StatusCode::NOT_FOUND, "Game not found".to_string()));
    }

    Ok(())
}

/// Converts replay errors into HTTP status codes with user-visible messages.
fn map_replay_error(err: ReplayError) -> (StatusCode, String) {
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

/// Example protected handler that validates a bearer token.
async fn get_current_user(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
) -> Result<String, (StatusCode, String)> {
    // Extract bearer token.
    let auth_header = headers
        .get("Authorization")
        .ok_or((
            StatusCode::UNAUTHORIZED,
            "Missing Authorization header".to_string(),
        ))?
        .to_str()
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid header format".to_string()))?;

    let token = auth_header.trim_start_matches("Bearer ").trim();

    // Verify token.
    let claims = state
        .auth
        .validate_token(token)
        .map_err(|e| (StatusCode::UNAUTHORIZED, format!("Invalid token: {}", e)))?;

    Ok(format!(
        "Hello user {}, your role is {}",
        claims.claims.sub, claims.claims.role
    ))
}

/// WebSocket handler that delegates to the network module.
async fn websocket_handler(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<AppState>>,
) -> Response {
    // Pass the Arc<NetworkState> directly
    ws_handler(ws, State(state.network.clone()), addr).await
}
