use axum::{
    routing::get,
    Router,
    extract::State,
    http::{StatusCode, HeaderMap},
};
use std::net::SocketAddr;
use tower_http::cors::{CorsLayer, Any};
use std::env;
use std::sync::Arc;

use mahjong_server::auth::AuthState;

// Shared state available to all routes
struct AppState {
    auth: AuthState,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    let _ = dotenvy::dotenv();

    // 1. Load Config
    let supabase_url = env::var("SUPABASE_URL").expect("SUPABASE_URL must be set");

    // 2. Initialize Auth
    let auth_state = AuthState::new(supabase_url);
    if let Err(e) = auth_state.load_keys().await {
        eprintln!("CRITICAL WARNING: Failed to load Auth keys: {}", e);
    }

    let state = Arc::new(AppState {
        auth: auth_state,
    });

    // 3. Router
    let app = Router::new()
        .route("/", get(health_check))
        .route("/me", get(get_current_user)) // Protected Route
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .with_state(state);

    // 4. Run
    let port = env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = SocketAddr::from(([0, 0, 0, 0], port.parse().unwrap()));
    println!("Server running on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> &'static str {
    "Mahjong Server is Healthy!"
}

// Example Protected Handler
async fn get_current_user(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
) -> Result<String, (StatusCode, String)> {
    // 1. Extract Bearer Token
    let auth_header = headers.get("Authorization")
        .ok_or((StatusCode::UNAUTHORIZED, "Missing Authorization header".to_string()))?
        .to_str()
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid header format".to_string()))?;

    let token = auth_header.trim_start_matches("Bearer ").trim();

    // 2. Verify Token
    let claims = state.auth.validate_token(token)
        .map_err(|e| (StatusCode::UNAUTHORIZED, format!("Invalid token: {}", e)))?;

    Ok(format!("Hello user {}, your role is {}", claims.claims.sub, claims.claims.role))
}