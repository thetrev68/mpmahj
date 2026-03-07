//! Authentication flow for WebSocket connections.
//!
//! This module handles the authentication phase of the WebSocket pipeline:
//! - Waiting for the initial [`Envelope::Authenticate`] message
//! - Validating credentials (Guest, JWT, or Token)
//! - Creating or restoring sessions
//! - Rate-limiting authentication attempts
//!
//! ## Authentication Methods
//!
//! - **Guest**: Creates a new anonymous session with auto-generated credentials
//! - **JWT**: Validates JWT token, upserts player in database, creates/restores session
//! - **Token**: Restores existing session from stored state using session token
//!
//! ## Rate Limiting
//!
//! - Auth attempts are rate-limited per IP and connection
//! - Reconnect attempts (Token auth) have separate rate limits per token
//!
//! ## Usage
//!
//! This module is internal to the websocket handler. Authentication runs inside
//! `ws_handler` and is not intended to be invoked directly.

use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

#[cfg(feature = "database")]
use tracing::error;

use crate::network::{
    messages::{AuthMethod, Credentials, Envelope, ErrorCode},
    rate_limit::RateLimitError,
    NetworkState,
};

use super::responses::{send_auth_failure, send_error_on_sender};

/// Waits for the initial Authenticate message and creates or restores a session.
///
/// This is the entry point for WebSocket authentication. It:
/// 1. Waits for the first message from the client
/// 2. Validates that it's an [`Envelope::Authenticate`] message
/// 3. Checks authentication rate limits
/// 4. Delegates to [`process_authenticate`] to handle the specific auth method
///
/// # Arguments
///
/// * `receiver` - The receiving half of the WebSocket stream
/// * `sender` - The sending half of the WebSocket stream (consumed on success)
/// * `state` - Shared network state containing sessions, rate limits, etc.
/// * `ip_key` - Client IP address for rate limiting
/// * `connection_key` - Unique connection identifier (IP:port) for rate limiting
///
/// # Returns
///
/// * `Ok(String)` - The authenticated player ID
/// * `Err(String)` - Error message describing why authentication failed
///
/// # Errors
///
/// Returns an error if:
/// - Client sends invalid JSON
/// - First message is not [`Envelope::Authenticate`]
/// - Rate limit is exceeded
/// - Authentication credentials are invalid
/// - Connection is closed before authentication completes
///
/// # Examples
///
/// This function is invoked internally by the websocket upgrade flow and is
/// not meant to be called directly from external code.
pub async fn wait_for_auth_and_create_session(
    receiver: &mut futures_util::stream::SplitStream<WebSocket>,
    mut sender: futures_util::stream::SplitSink<WebSocket, Message>,
    state: &Arc<NetworkState>,
    ip_key: &str,
    connection_key: &str,
) -> Result<String, String> {
    while let Some(msg_result) = receiver.next().await {
        match msg_result {
            Ok(Message::Text(text)) => {
                // Parse envelope
                let envelope = match Envelope::from_json(&text) {
                    Ok(envelope) => envelope,
                    Err(e) => {
                        let _ = send_auth_failure(
                            &mut sender,
                            &format!("Invalid JSON envelope: {}", e),
                        )
                        .await;
                        return Err(format!("Invalid JSON envelope: {}", e));
                    }
                };

                // Only accept Authenticate messages
                match envelope {
                    Envelope::Authenticate(payload) => {
                        if let Err(err) = state.rate_limits.check_auth(ip_key, connection_key) {
                            let _ = send_error_on_sender(
                                &mut sender,
                                ErrorCode::RateLimitExceeded,
                                "Authentication rate limit exceeded",
                                Some(rate_limit_context(err)),
                            )
                            .await;
                            return Err("Authentication rate limit exceeded".to_string());
                        }
                        // Process authentication and create session
                        return process_authenticate(
                            payload.method,
                            payload.credentials,
                            state,
                            sender,
                            ip_key,
                        )
                        .await;
                    }
                    _ => {
                        let _ =
                            send_auth_failure(&mut sender, "First message must be Authenticate")
                                .await;
                        return Err("First message must be Authenticate".to_string());
                    }
                }
            }
            Ok(Message::Close(_)) => {
                return Err("Connection closed before authentication".to_string());
            }
            Ok(_) => {
                // Ignore other message types during auth
                continue;
            }
            Err(e) => {
                return Err(format!("WebSocket error during auth: {}", e));
            }
        }
    }

    Err("Connection closed before authentication".to_string())
}

/// Processes authentication credentials and creates or restores a session.
///
/// Handles three authentication methods:
///
/// ## Guest Authentication
///
/// Creates a new anonymous session with auto-generated player ID and display name.
/// No credentials required.
///
/// ## JWT Authentication
///
/// 1. Validates JWT token signature and expiration
/// 2. Extracts player ID from token claims
/// 3. Upserts player record in database (if available)
/// 4. Checks for existing active/stored session and supersedes/restores it
/// 5. Creates new session with validated identity
///
/// ## Token Authentication
///
/// 1. Checks reconnect rate limits
/// 2. Looks up stored session by session token
/// 3. Restores session state (room, seat, display name)
/// 4. Re-establishes WebSocket connection
///
/// # Arguments
///
/// * `method` - Authentication method (Guest, JWT, or Token)
/// * `credentials` - Optional credentials (token for JWT/Token auth)
/// * `state` - Shared network state
/// * `sender` - WebSocket sender (consumed to embed in session)
/// * `ip_key` - Client IP for rate limiting
///
/// # Returns
///
/// * `Ok(String)` - Authenticated player ID
/// * `Err(String)` - Error message
///
/// # Errors
///
/// Returns an error if:
/// - JWT validation fails
/// - Database upsert fails (JWT auth)
/// - Session token not found (Token auth)
/// - Reconnect rate limit exceeded (Token auth)
/// - Missing required credentials
async fn process_authenticate(
    method: AuthMethod,
    credentials: Option<Credentials>,
    state: &Arc<NetworkState>,
    mut sender: futures_util::stream::SplitSink<WebSocket, Message>,
    ip_key: &str,
) -> Result<String, String> {
    match method {
        AuthMethod::Guest => {
            // Guest authentication - create new session with embedded ws_sender.
            let session = crate::network::session::Session::new_guest(sender);

            let player_id = session.player_id.clone();
            let display_name = session.display_name.clone();
            let session_token = session.session_token.clone();
            let room_id = session.room_id.clone();
            let seat = session.seat;

            // Send AuthSuccess before storing session.
            let response = Envelope::auth_success(
                player_id.clone(),
                display_name,
                session_token,
                room_id,
                seat,
            );

            // Send through the session's ws_sender.
            {
                let mut ws_guard = session.ws_sender.lock().await;
                let json = response
                    .to_json()
                    .map_err(|e| format!("Serialize error: {}", e))?;
                ws_guard
                    .send(Message::Text(json))
                    .await
                    .map_err(|e| format!("Send error: {}", e))?;
            }

            // Add to session store.
            let (_, _, _, _session_arc) = state.sessions.add_guest_session(session);

            Ok(player_id)
        }
        AuthMethod::Jwt => {
            let token = match credentials.map(|c| c.token) {
                Some(token) => token,
                None => {
                    let _ = send_auth_failure(&mut sender, "Missing token in credentials").await;
                    return Err("Missing token in credentials".to_string());
                }
            };

            let auth = state
                .auth
                .as_ref()
                .ok_or_else(|| "Auth not configured on server".to_string())?;

            let claims = auth
                .validate_token(&token)
                .map_err(|e| format!("Invalid token: {}", e))?;

            let player_id = claims.claims.sub;
            // Use sub as email fallback if we can't get it easily from claims (depends on struct)
            #[cfg(feature = "database")]
            let email = player_id.clone();

            // 1. Ensure user exists in DB.
            let (mut display_name, mut room_id, mut seat) = {
                #[cfg(feature = "database")]
                {
                    if let Some(db) = &state.db {
                        match db.upsert_player_from_auth(&player_id, &email).await {
                            Ok(rec) => (
                                rec.display_name
                                    .unwrap_or_else(|| format!("User_{}", &player_id[..8])),
                                None,
                                None,
                            ),
                            Err(e) => {
                                error!("Failed to upsert player: {}", e);
                                return Err(format!("Database error: {}", e));
                            }
                        }
                    } else {
                        (format!("User_{}", &player_id[..8]), None, None)
                    }
                }
                #[cfg(not(feature = "database"))]
                {
                    (format!("User_{}", &player_id[..8]), None, None)
                }
            };

            // 2. Check for existing session (Active or Stored) to recover state.
            // If active, we are taking over. If stored, we are restoring.
            // Since we trust the JWT, we don't need the session_token for proof, just identity.

            // Check active first
            if let Some(active_arc) = state.sessions.get_active(&player_id) {
                let mut active = active_arc.lock().await;
                room_id = active.room_id.clone();
                seat = active.seat;

                // Explicitly disconnect the old session before it gets replaced.
                // Send an error message to notify the client that they've been superseded.
                let disconnect_msg = Envelope::error(
                    ErrorCode::InvalidCredentials,
                    "Session superseded by new login",
                );
                if let Ok(json) = disconnect_msg.to_json() {
                    let mut ws_guard = active.ws_sender.lock().await;
                    // Best-effort send; ignore errors as connection may already be dead
                    let _ = ws_guard.send(Message::Text(json)).await;
                    let _ = ws_guard.send(Message::Close(None)).await;
                }

                // Mark as disconnected to stop heartbeat task
                active.disconnect();
            } else if let Some(stored) = state.sessions.take_stored_by_player_id(&player_id) {
                room_id = stored.room_id.clone();
                seat = stored.seat;
                display_name = stored.display_name;
            }

            // 3. Create new Session object.
            let session_token = Uuid::new_v4().to_string(); // New session token

            let session = crate::network::session::Session {
                player_id: player_id.clone(),
                display_name: display_name.clone(),
                session_token: session_token.clone(),
                is_guest: false,
                room_id: room_id.clone(),
                seat,
                ws_sender: Arc::new(tokio::sync::Mutex::new(sender)),
                last_pong: chrono::Utc::now(),
                connected: true,
            };

            // Send AuthSuccess.
            let response = Envelope::auth_success(
                player_id.clone(),
                display_name,
                session_token,
                room_id,
                seat,
            );

            {
                let mut ws_guard = session.ws_sender.lock().await;
                let json = response
                    .to_json()
                    .map_err(|e| format!("Serialize error: {}", e))?;
                ws_guard
                    .send(Message::Text(json))
                    .await
                    .map_err(|e| format!("Send error: {}", e))?;
            }

            // 4. Register in SessionStore (overwrites existing if any).
            state.sessions.add_guest_session(session);
            // Note: add_guest_session is a misnomer, it just adds a session.
            // It uses session.player_id as key.

            Ok(player_id)
        }
        AuthMethod::Token => {
            // Token authentication - restore session.
            let token = match credentials.map(|c| c.token) {
                Some(token) => token,
                None => {
                    let _ = send_auth_failure(&mut sender, "Missing token in credentials").await;
                    return Err("Missing token in credentials".to_string());
                }
            };

            if let Err(err) = state.rate_limits.check_reconnect(&token, ip_key) {
                let _ = send_error_on_sender(
                    &mut sender,
                    ErrorCode::RateLimitExceeded,
                    "Reconnect rate limit exceeded",
                    Some(rate_limit_context(err)),
                )
                .await;
                return Err("Reconnect rate limit exceeded".to_string());
            }

            let (player_id, display_name, session_token, room_id, seat, _session_arc) =
                match state.sessions.restore_session(&token, sender) {
                    Ok(restored) => restored,
                    Err((e, mut sender)) => {
                        let _ = send_auth_failure(
                            &mut sender,
                            &format!("Session restoration failed: {}", e),
                        )
                        .await;
                        return Err(format!("Session restoration failed: {}", e));
                    }
                };

            // Send AuthSuccess (session's ws_sender will be used)
            let response = Envelope::auth_success(
                player_id.clone(),
                display_name,
                session_token,
                room_id,
                seat,
            );

            // Send through the restored session's ws_sender
            {
                let session_arc = state
                    .sessions
                    .get_active(&player_id)
                    .ok_or("Session not found after restoration")?;
                let session = session_arc.lock().await;
                let mut ws_guard = session.ws_sender.lock().await;
                let json = response
                    .to_json()
                    .map_err(|e| format!("Serialize error: {}", e))?;
                ws_guard
                    .send(Message::Text(json))
                    .await
                    .map_err(|e| format!("Send error: {}", e))?;
            }

            Ok(player_id)
        }
    }
}

/// Builds error context payload for rate limit responses.
///
/// # Arguments
///
/// * `err` - The rate limit error containing retry-after information
///
/// # Returns
///
/// JSON object with `retry_after_ms` field indicating when the client can retry
///
/// Context helper used in websocket responses.
pub fn rate_limit_context(err: RateLimitError) -> serde_json::Value {
    json!({ "retry_after_ms": err.retry_after_ms })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limit_context() {
        let err = RateLimitError {
            retry_after_ms: 1000,
        };
        let context = rate_limit_context(err);
        assert_eq!(context["retry_after_ms"], 1000);
    }

    #[test]
    fn test_rate_limit_context_zero() {
        let err = RateLimitError { retry_after_ms: 0 };
        let context = rate_limit_context(err);
        assert_eq!(context["retry_after_ms"], 0);
    }

    #[test]
    fn test_rate_limit_context_large_value() {
        let err = RateLimitError {
            retry_after_ms: 60000,
        };
        let context = rate_limit_context(err);
        assert_eq!(context["retry_after_ms"], 60000);
    }

    // Note: Integration tests for actual authentication flows are in
    // tests/networking_integration.rs and tests/network_rate_limits.rs
    // as they require full WebSocket setup.
    //
    // ## Authentication Failure Scenarios (covered in integration tests):
    //
    // 1. **Invalid JSON**: Client sends malformed JSON
    //    - Expected: AuthFailure with "Invalid JSON envelope" message
    //
    // 2. **Missing Token (JWT)**: Client sends JWT auth without credentials
    //    - Expected: AuthFailure with "Missing token in credentials"
    //
    // 3. **Invalid JWT Token**: Client sends JWT auth with invalid token
    //    - Expected: AuthFailure with "Invalid token: <error>"
    //
    // 4. **Missing Token (Token)**: Client sends Token auth without credentials
    //    - Expected: AuthFailure with "Missing token in credentials"
    //
    // 5. **Invalid Session Token**: Client sends Token auth with non-existent token
    //    - Expected: AuthFailure with "Session restoration failed: <error>"
    //
    // 6. **Auth Rate Limit Exceeded**: Client exceeds auth attempts per IP/connection
    //    - Expected: Error with ErrorCode::RateLimitExceeded and retry_after_ms context
    //    - Covered by: tests/network_rate_limits.rs::auth_rate_limit_is_per_ip
    //
    // 7. **Reconnect Rate Limit Exceeded**: Client exceeds reconnect attempts per token
    //    - Expected: Error with ErrorCode::RateLimitExceeded and retry_after_ms context
    //
    // 8. **Wrong First Message**: Client sends non-Authenticate message first
    //    - Expected: AuthFailure with "First message must be Authenticate"
    //
    // 9. **Connection Closed**: Client closes connection before authenticating
    //    - Expected: Error "Connection closed before authentication"
    //
    // 10. **WebSocket Error**: WebSocket error during auth phase
    //     - Expected: Error "WebSocket error during auth: <error>"
}
