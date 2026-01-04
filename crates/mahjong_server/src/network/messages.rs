//! WebSocket message envelope types.
//!
//! All messages between client and server use a JSON envelope format:
//! ```json
//! {
//!   "kind": "Command",
//!   "payload": { ... }
//! }
//! ```
//!
//! This provides type safety and extensibility for the protocol.

use chrono::{DateTime, Utc};
use mahjong_core::{command::GameCommand, event::GameEvent, player::Seat};
use serde::{Deserialize, Serialize};

/// Top-level message envelope for all WebSocket communication.
///
/// Every message sent between client and server is wrapped in this envelope
/// to provide type discrimination and version safety.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "payload")]
pub enum Envelope {
    // ===== CLIENT → SERVER =====
    /// Client authentication request
    Authenticate(AuthenticatePayload),
    /// Game command from player
    Command(CommandPayload),
    /// Heartbeat response
    Pong(PongPayload),

    // ===== SERVER → CLIENT =====
    /// Authentication succeeded
    AuthSuccess(AuthSuccessPayload),
    /// Authentication failed
    AuthFailure(AuthFailurePayload),
    /// Game event broadcast
    Event(EventPayload),
    /// Error response
    Error(ErrorPayload),
    /// Heartbeat request
    Ping(PingPayload),
}

// ===== CLIENT → SERVER PAYLOADS =====

/// Authentication request payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthenticatePayload {
    /// Authentication method
    pub method: AuthMethod,
    /// Optional credentials (required for token auth)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credentials: Option<Credentials>,
    /// Client protocol version (for future compatibility)
    pub version: String,
}

/// Authentication method selection.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AuthMethod {
    /// Guest mode (no credentials needed)
    Guest,
    /// Token-based session restoration
    Token,
}

/// Credentials for token authentication.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credentials {
    /// Session token from previous authentication
    pub token: String,
}

/// Game command payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandPayload {
    /// The game command to execute
    pub command: GameCommand,
}

/// Heartbeat response payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PongPayload {
    /// Echo of the timestamp from the Ping message
    pub timestamp: DateTime<Utc>,
}

// ===== SERVER → CLIENT PAYLOADS =====

/// Successful authentication response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSuccessPayload {
    /// Unique player identifier
    pub player_id: String,
    /// Display name for the player
    pub display_name: String,
    /// Session token for reconnection
    pub session_token: String,
    /// Current room if player is already in one (for reconnection)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room_id: Option<String>,
    /// Current seat if player is already in a game (for reconnection)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seat: Option<Seat>,
}

/// Failed authentication response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthFailurePayload {
    /// Human-readable error message
    pub reason: String,
}

/// Game event payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventPayload {
    /// The game event that occurred
    pub event: GameEvent,
}

/// Error response payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPayload {
    /// Machine-readable error code
    pub code: ErrorCode,
    /// Human-readable error message
    pub message: String,
    /// Optional additional context (e.g., field names, validation details)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<serde_json::Value>,
}

/// Standard error codes for server responses.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    /// Invalid or expired credentials
    InvalidCredentials,
    /// Room does not exist
    RoomNotFound,
    /// Room is full (4 players)
    RoomFull,
    /// Command is invalid for current game state
    InvalidCommand,
    /// Action attempted when not player's turn
    NotYourTurn,
    /// Invalid tile for the action
    InvalidTile,
    /// Rate limit exceeded
    RateLimitExceeded,
    /// Player is not authenticated
    Unauthenticated,
    /// Generic server error
    InternalError,
}

/// Heartbeat request payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingPayload {
    /// Current server timestamp (client should echo in Pong)
    pub timestamp: DateTime<Utc>,
}

// ===== HELPER CONSTRUCTORS =====

impl Envelope {
    /// Create an Authenticate message.
    pub fn authenticate(method: AuthMethod, credentials: Option<Credentials>) -> Self {
        Self::Authenticate(AuthenticatePayload {
            method,
            credentials,
            version: "1.0".to_string(),
        })
    }

    /// Create a Command message.
    pub fn command(command: GameCommand) -> Self {
        Self::Command(CommandPayload { command })
    }

    /// Create a Pong message.
    pub fn pong(timestamp: DateTime<Utc>) -> Self {
        Self::Pong(PongPayload { timestamp })
    }

    /// Create an AuthSuccess message.
    pub fn auth_success(
        player_id: String,
        display_name: String,
        session_token: String,
        room_id: Option<String>,
        seat: Option<Seat>,
    ) -> Self {
        Self::AuthSuccess(AuthSuccessPayload {
            player_id,
            display_name,
            session_token,
            room_id,
            seat,
        })
    }

    /// Create an AuthFailure message.
    pub fn auth_failure(reason: impl Into<String>) -> Self {
        Self::AuthFailure(AuthFailurePayload {
            reason: reason.into(),
        })
    }

    /// Create an Event message.
    pub fn event(event: GameEvent) -> Self {
        Self::Event(EventPayload { event })
    }

    /// Create an Error message.
    pub fn error(code: ErrorCode, message: impl Into<String>) -> Self {
        Self::Error(ErrorPayload {
            code,
            message: message.into(),
            context: None,
        })
    }

    /// Create an Error message with additional context.
    pub fn error_with_context(
        code: ErrorCode,
        message: impl Into<String>,
        context: serde_json::Value,
    ) -> Self {
        Self::Error(ErrorPayload {
            code,
            message: message.into(),
            context: Some(context),
        })
    }

    /// Create a Ping message.
    pub fn ping(timestamp: DateTime<Utc>) -> Self {
        Self::Ping(PingPayload { timestamp })
    }

    /// Serialize this envelope to a JSON string.
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Deserialize an envelope from a JSON string.
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mahjong_core::{command::GameCommand, player::Seat};

    #[test]
    fn test_authenticate_guest_roundtrip() {
        let envelope = Envelope::authenticate(AuthMethod::Guest, None);
        let json = envelope.to_json().unwrap();
        let parsed = Envelope::from_json(&json).unwrap();

        if let Envelope::Authenticate(payload) = parsed {
            assert_eq!(payload.method, AuthMethod::Guest);
            assert!(payload.credentials.is_none());
            assert_eq!(payload.version, "1.0");
        } else {
            panic!("Wrong envelope variant");
        }
    }

    #[test]
    fn test_authenticate_token_roundtrip() {
        let envelope = Envelope::authenticate(
            AuthMethod::Token,
            Some(Credentials {
                token: "test-token-123".to_string(),
            }),
        );
        let json = envelope.to_json().unwrap();
        let parsed = Envelope::from_json(&json).unwrap();

        if let Envelope::Authenticate(payload) = parsed {
            assert_eq!(payload.method, AuthMethod::Token);
            assert!(payload.credentials.is_some());
            assert_eq!(payload.credentials.unwrap().token, "test-token-123");
        } else {
            panic!("Wrong envelope variant");
        }
    }

    #[test]
    fn test_command_roundtrip() {
        let command = GameCommand::DrawTile {
            player: Seat::East,
        };
        let envelope = Envelope::command(command.clone());
        let json = envelope.to_json().unwrap();
        let parsed = Envelope::from_json(&json).unwrap();

        if let Envelope::Command(payload) = parsed {
            assert_eq!(payload.command, command);
        } else {
            panic!("Wrong envelope variant");
        }
    }

    #[test]
    fn test_auth_success_roundtrip() {
        let envelope = Envelope::auth_success(
            "player-123".to_string(),
            "TestPlayer".to_string(),
            "session-token-456".to_string(),
            Some("room-789".to_string()),
            Some(Seat::South),
        );
        let json = envelope.to_json().unwrap();
        let parsed = Envelope::from_json(&json).unwrap();

        if let Envelope::AuthSuccess(payload) = parsed {
            assert_eq!(payload.player_id, "player-123");
            assert_eq!(payload.display_name, "TestPlayer");
            assert_eq!(payload.session_token, "session-token-456");
            assert_eq!(payload.room_id, Some("room-789".to_string()));
            assert_eq!(payload.seat, Some(Seat::South));
        } else {
            panic!("Wrong envelope variant");
        }
    }

    #[test]
    fn test_error_roundtrip() {
        let envelope = Envelope::error(ErrorCode::RoomFull, "Room is at capacity");
        let json = envelope.to_json().unwrap();
        let parsed = Envelope::from_json(&json).unwrap();

        if let Envelope::Error(payload) = parsed {
            assert_eq!(payload.code, ErrorCode::RoomFull);
            assert_eq!(payload.message, "Room is at capacity");
            assert!(payload.context.is_none());
        } else {
            panic!("Wrong envelope variant");
        }
    }

    #[test]
    fn test_ping_pong_roundtrip() {
        let now = Utc::now();
        let ping = Envelope::ping(now);
        let ping_json = ping.to_json().unwrap();
        let parsed_ping = Envelope::from_json(&ping_json).unwrap();

        if let Envelope::Ping(payload) = parsed_ping {
            let pong = Envelope::pong(payload.timestamp);
            let pong_json = pong.to_json().unwrap();
            let parsed_pong = Envelope::from_json(&pong_json).unwrap();

            if let Envelope::Pong(pong_payload) = parsed_pong {
                assert_eq!(pong_payload.timestamp, payload.timestamp);
            } else {
                panic!("Wrong pong envelope variant");
            }
        } else {
            panic!("Wrong ping envelope variant");
        }
    }

    #[test]
    fn test_json_format() {
        // Verify the JSON format matches the spec
        let envelope = Envelope::authenticate(AuthMethod::Guest, None);
        let json = envelope.to_json().unwrap();

        // Parse as generic JSON to verify structure
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(value.get("kind").is_some());
        assert_eq!(value["kind"], "Authenticate");
        assert!(value.get("payload").is_some());
        let payload = &value["payload"];
        assert!(payload.get("method").is_some());
        assert_eq!(payload["method"], "guest");
    }
}
