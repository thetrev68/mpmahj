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
use axum::http::{
    header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE},
    HeaderValue, Method,
};
use axum::{
    extract::{ConnectInfo, State, WebSocketUpgrade},
    http::{HeaderMap, StatusCode},
    response::Response,
    routing::{get, post},
    Router,
};
#[cfg(feature = "database")]
use axum::{
    extract::{Path, Query},
    Json,
};
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::{AllowOrigin, CorsLayer};

#[cfg(feature = "database")]
use mahjong_core::player::Seat;
use mahjong_server::auth::AuthState;
use mahjong_server::authorization::extract_bearer_token;
#[cfg(feature = "database")]
use mahjong_server::db::Database;
use mahjong_server::network::admin::{
    admin_download_replay, admin_export_history, admin_forfeit_player, admin_get_room_health,
    admin_list_rooms, admin_pause_game, admin_resume_game, AdminState,
};
#[cfg(feature = "database")]
use mahjong_server::network::admin::{admin_get_replay, admin_list_games};
use mahjong_server::network::{ws_handler, NetworkState};
#[cfg(feature = "database")]
use mahjong_server::replay::{ReplayError, ReplayResponse, ReplayService};

/// Shared state available to all routes.
struct AppState {
    auth: AuthState,
    network: Arc<NetworkState>,
    #[cfg(feature = "database")]
    db: Option<Database>,
}

/// Spawns a background task to periodically clean up expired sessions.
///
/// This task runs indefinitely, waking up at regular intervals (configured via
/// `SESSION_CLEANUP_INTERVAL_SECS` environment variable, default 60 seconds) to
/// remove sessions that have exceeded their grace period (5 minutes since disconnect).
///
/// # Purpose
///
/// Without automatic cleanup, the session store would grow unbounded as players
/// disconnect and reconnect. This task ensures memory is reclaimed for sessions
/// that will never reconnect.
///
/// # Configuration
///
/// Set the cleanup interval via environment variable:
/// ```bash
/// SESSION_CLEANUP_INTERVAL_SECS=120  # Check every 2 minutes
/// ```
///
/// # Implementation Notes
///
/// - The task uses `tokio::time::interval` for precise timing
/// - Cleanup is logged at DEBUG level when sessions are removed
/// - The task runs for the lifetime of the server process
/// - Thread-safe via `Arc<NetworkState>` and `DashMap` in `SessionStore`
///
/// # Examples
///
/// ```no_run
/// use std::sync::Arc;
/// use mahjong_server::network::NetworkState;
///
/// # async fn example() {
/// let network_state = Arc::new(NetworkState::new());
/// // spawn_session_cleanup_task(network_state);
/// # }
/// ```
fn spawn_session_cleanup_task(network_state: Arc<NetworkState>) {
    let cleanup_interval_secs = env::var("SESSION_CLEANUP_INTERVAL_SECS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(60);

    tracing::info!(
        "Starting session cleanup task with interval: {} seconds",
        cleanup_interval_secs
    );

    tokio::spawn({
        async move {
            let mut interval = tokio::time::interval(Duration::from_secs(cleanup_interval_secs));
            loop {
                interval.tick().await;
                let cleaned = network_state.sessions.cleanup_expired();
                if cleaned > 0 {
                    tracing::debug!("Session cleanup: removed {} expired sessions", cleaned);
                }
            }
        }
    });
}

/// Bootstraps the Axum server, state, and routes.
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    let _ = dotenvy::dotenv();

    // Check if we should run with database.
    #[cfg(feature = "database")]
    let database_url = env::var("DATABASE_URL").ok();
    #[cfg(feature = "database")]
    let supabase_url = env::var("SUPABASE_URL").ok();
    #[cfg(feature = "database")]
    let supabase_audience = env::var("SUPABASE_AUDIENCE").ok().and_then(|value| {
        let items: Vec<String> = value
            .split(',')
            .map(|item| item.trim())
            .filter(|item| !item.is_empty())
            .map(|item| item.to_string())
            .collect();
        if items.is_empty() {
            None
        } else {
            Some(items)
        }
    });

    #[cfg(feature = "database")]
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

            let auth = AuthState::new(supabase_url, supabase_audience.clone());
            auth.load_keys()
                .await
                .expect("Failed to load JWT keys from Supabase during startup. Auth is required in full mode.");

            let network = NetworkState::new_with_db(db.clone(), auth.clone());
            (Arc::new(network), auth, Some(db))
        }
        _ => {
            // Memory-only mode without database.
            println!("WARNING: Running in memory-only mode (no DATABASE_URL or SUPABASE_URL)");
            println!("Game state will not be persisted, and auth will use mock tokens.");
            let auth = AuthState::new("http://localhost:54321".to_string(), None);
            let network = NetworkState::new();
            (Arc::new(network), auth, None)
        }
    };

    #[cfg(not(feature = "database"))]
    let (network_state, auth_state) = {
        println!("WARNING: Running in memory-only mode (database feature disabled).");
        println!("Game state will not be persisted, and auth will use mock tokens.");
        let auth = AuthState::new("http://localhost:54321".to_string(), None);
        let network = NetworkState::new();
        (Arc::new(network), auth)
    };

    #[cfg(feature = "database")]
    let state = Arc::new(AppState {
        auth: auth_state,
        network: network_state,
        db,
    });

    #[cfg(not(feature = "database"))]
    let state = Arc::new(AppState {
        auth: auth_state,
        network: network_state,
    });

    // Spawn background session cleanup task.
    // This prevents unbounded memory growth by periodically removing expired sessions.
    // The cleanup interval can be configured via SESSION_CLEANUP_INTERVAL_SECS (default: 60).
    #[cfg(feature = "database")]
    spawn_session_cleanup_task(state.network.clone());
    #[cfg(not(feature = "database"))]
    spawn_session_cleanup_task(state.network.clone());

    // Router.
    let app = Router::new()
        .route("/", get(health_check))
        .route("/me", get(get_current_user)) // Protected route.
        .route("/ws", get(websocket_handler)); // WebSocket endpoint.

    #[cfg(feature = "database")]
    let app = app.route("/api/replays/:game_id", get(get_player_replay));

    // Admin routes (always available, not just with database feature)
    // Create separate router for admin routes with AdminState
    let admin_state = Arc::new(AdminState {
        auth: state.auth.clone(),
        network: state.network.clone(),
        #[cfg(feature = "database")]
        db: state.db.clone(),
    });
    // Build admin router with database-aware conditional routes
    #[cfg(feature = "database")]
    let admin_router = Router::new()
        .route(
            "/api/admin/rooms/:room_id/forfeit",
            post(admin_forfeit_player),
        )
        .route("/api/admin/rooms/:room_id/pause", post(admin_pause_game))
        .route("/api/admin/rooms/:room_id/resume", post(admin_resume_game))
        .route(
            "/api/admin/rooms/:room_id/health",
            get(admin_get_room_health),
        )
        .route("/api/admin/rooms", get(admin_list_rooms))
        .route(
            "/api/admin/rooms/:room_id/export",
            get(admin_export_history),
        )
        .route(
            "/api/admin/rooms/:room_id/replay/download",
            get(admin_download_replay),
        )
        .route("/api/admin/replays/:game_id", get(admin_get_replay))
        .route("/api/admin/games", get(admin_list_games))
        .with_state(admin_state);

    #[cfg(not(feature = "database"))]
    let admin_router = Router::new()
        .route(
            "/api/admin/rooms/:room_id/forfeit",
            post(admin_forfeit_player),
        )
        .route("/api/admin/rooms/:room_id/pause", post(admin_pause_game))
        .route("/api/admin/rooms/:room_id/resume", post(admin_resume_game))
        .route(
            "/api/admin/rooms/:room_id/health",
            get(admin_get_room_health),
        )
        .route("/api/admin/rooms", get(admin_list_rooms))
        .route(
            "/api/admin/rooms/:room_id/export",
            get(admin_export_history),
        )
        .route(
            "/api/admin/rooms/:room_id/replay/download",
            get(admin_download_replay),
        )
        .with_state(admin_state);

    // Merge admin router with main app
    let app = app.merge(admin_router);

    // CORS configuration with explicit origin allowlist for security.
    // Prevents CSRF attacks by restricting cross-origin requests to trusted domains.
    let allowed_origins = env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:5173,http://localhost:1420".to_string());

    let origins: Vec<HeaderValue> = allowed_origins
        .split(',')
        .filter_map(|s| s.trim().parse().ok())
        .collect();

    let app: Router = app
        .layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::list(origins))
                .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
                .allow_headers([AUTHORIZATION, CONTENT_TYPE, ACCEPT])
                .allow_credentials(true)
                .max_age(Duration::from_secs(3600)),
        )
        .with_state(state);

    // Run.
    let port = env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let port_num: u16 = port.parse().expect("PORT must be a valid number (0-65535)");
    let addr = SocketAddr::from(([0, 0, 0, 0], port_num));
    println!("Server running on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind TCP listener - check port availability and permissions");

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}

/// Basic liveness endpoint.
async fn health_check() -> &'static str {
    "Mahjong Server is Healthy!"
}

/// Query params for player-specific replay requests.
#[cfg(feature = "database")]
#[derive(serde::Deserialize)]
struct PlayerReplayQuery {
    seat: Seat,
}

/// Retrieves a player-facing replay for the requested game.
#[cfg(feature = "database")]
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

/// Ensures the referenced game exists in persistence before further work.
#[cfg(feature = "database")]
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
#[cfg(feature = "database")]
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
    let token = extract_bearer_token(&headers)?;

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
