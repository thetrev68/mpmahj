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
//!
//! ```no_run
//! use mahjong_server::network::messages::{AuthMethod, Envelope};
//! let envelope = Envelope::authenticate(AuthMethod::Guest, None);
//! let json = envelope.to_json().unwrap();
//! let _parsed = Envelope::from_json(&json).unwrap();
//! ```

use chrono::{DateTime, Utc};
use mahjong_ai::Difficulty;
use mahjong_core::{
    command::GameCommand, event::Event, player::Seat, snapshot::GameStateSnapshot,
    table::HouseRules,
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Top-level message envelope for all WebSocket communication.
///
/// Every message sent between client and server is wrapped in this envelope
/// to provide type discrimination and version safety.
#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "payload")]
pub enum Envelope {
    // ===== CLIENT → SERVER =====
    /// Client authentication request
    Authenticate(AuthenticatePayload),
    /// Game command from player
    Command(CommandPayload),
    /// Create a new room and join it
    CreateRoom(CreateRoomPayload),
    /// Join an existing room
    JoinRoom(JoinRoomPayload),
    /// Leave the current room
    LeaveRoom(LeaveRoomPayload),
    /// Close the current room
    CloseRoom(CloseRoomPayload),
    /// Heartbeat response
    Pong(PongPayload),

    // ===== SERVER → CLIENT =====
    /// Authentication succeeded
    AuthSuccess(AuthSuccessPayload),
    /// Authentication failed
    AuthFailure(AuthFailurePayload),
    /// Game event broadcast
    Event(EventPayload),
    /// Room join confirmation
    RoomJoined(RoomJoinedPayload),
    /// Room leave confirmation
    RoomLeft(RoomLeftPayload),
    /// Room closed notification
    RoomClosed(RoomClosedPayload),
    /// Room member left notification
    RoomMemberLeft(RoomMemberLeftPayload),
    /// Error response
    Error(ErrorPayload),
    /// Heartbeat request
    Ping(PingPayload),
    /// State snapshot for reconnection
    StateSnapshot(StateSnapshotPayload),
}

// ===== CLIENT → SERVER PAYLOADS =====

/// Authentication request payload.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct AuthenticatePayload {
    /// Authentication method
    pub method: AuthMethod,
    /// Optional credentials (required for token auth)
    pub credentials: Option<Credentials>,
    /// Client protocol version (for future compatibility)
    pub version: String,
}

/// Authentication method selection.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
#[serde(rename_all = "lowercase")]
pub enum AuthMethod {
    /// Guest mode (no credentials needed)
    Guest,
    /// Token-based session restoration
    Token,
    /// Supabase JWT authentication
    Jwt,
}

/// Credentials for token authentication.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct Credentials {
    /// Session token from previous authentication
    pub token: String,
}

/// Game command payload.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct CommandPayload {
    /// The game command to execute
    pub command: GameCommand,
}

/// Create room request payload.
///
/// # FRONTEND_INTEGRATION_POINT
///
/// This payload is sent by clients when creating a new game room.
///
/// # Fields
///
/// - `room_name`: Display name for the room (defaults to "My American Mahjong Game")
/// - `card_year`: NMJL card year to use for pattern validation (defaults to 2025)
/// - `bot_difficulty`: AI difficulty level for bots in the room (defaults to Easy)
/// - `fill_with_bots`: If `true`, automatically fills empty seats with bots (defaults to `false`)
///
/// # Examples
///
/// ```
/// use mahjong_server::network::messages::CreateRoomPayload;
/// use mahjong_ai::Difficulty;
///
/// // Create a room with all defaults (2025 card, Easy bots, no auto-fill)
/// let payload = CreateRoomPayload {
///     room_name: "My American Mahjong Game".to_string(),
///     card_year: 2025,
///     house_rules: None,
///     bot_difficulty: None,
///     fill_with_bots: false,
/// };
///
/// // Create a room with hard bots and auto-fill
/// let payload_with_bots = CreateRoomPayload {
///     room_name: "Friday Night Mahjong".to_string(),
///     card_year: 2025,
///     house_rules: None,
///     bot_difficulty: Some(Difficulty::Hard),
///     fill_with_bots: true,
/// };
/// ```
///
/// # JSON Format
///
/// ```json
/// {
///   "room_name": "Friday Night Mahjong",
///   "card_year": 2020,
///   "bot_difficulty": "Hard",
///   "fill_with_bots": true
/// }
/// ```
///
/// All fields are optional in JSON:
/// - `room_name` defaults to "My American Mahjong Game" if omitted
/// - `card_year` defaults to 2025 if omitted
/// - `bot_difficulty` defaults to Easy if omitted
/// - `fill_with_bots` defaults to `false` if omitted
///
/// # Available Card Years
///
/// Supported NMJL card years: **2017, 2018, 2019, 2020, 2025**
///
/// The server will return an error if an unsupported year is requested.
///
/// # Bot Difficulty Levels
///
/// Available difficulty levels:
/// - `Easy`: Random decisions (strategically void)
/// - `Medium`: Uses BasicBot from mahjong_core (simple heuristics)
/// - `Hard`: Greedy EV maximization (no lookahead)
/// - `Expert`: MCTS with 10,000 iterations (deep search)
///
/// See [`mahjong_ai::Difficulty`] for implementation details.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct CreateRoomPayload {
    /// Display name for the room.
    ///
    /// Defaults to "My American Mahjong Game" if not specified in JSON.
    #[serde(default = "default_room_name")]
    pub room_name: String,

    /// Card year to use for pattern validation.
    ///
    /// Determines which NMJL card patterns are valid for winning hands.
    /// Available years: 2017, 2018, 2019, 2020, 2025
    ///
    /// Defaults to 2025 if not specified in JSON.
    /// Ignored when `house_rules` is provided (card year is read from
    /// `house_rules.ruleset.card_year` instead).
    #[serde(default = "default_card_year")]
    pub card_year: u16,

    /// Full house-rules configuration for the room.
    ///
    /// When provided, overrides `card_year` and supplies the complete ruleset
    /// (timers, bonuses, analysis toggle, etc.).  When `None`, a default
    /// `HouseRules` is constructed from `card_year`.
    #[serde(default)]
    #[ts(optional)]
    pub house_rules: Option<HouseRules>,

    /// Bot AI difficulty level.
    ///
    /// Controls the intelligence of bots added to the room.
    /// If `None`, defaults to `Difficulty::Easy`.
    ///
    /// Must be set BEFORE bots are added to seats.
    #[serde(default = "default_bot_difficulty")]
    pub bot_difficulty: Option<Difficulty>,

    /// Auto-fill empty seats with bots.
    ///
    /// If `true`, the server will automatically add bots to all empty seats
    /// after the room is created. The bots will use the configured `bot_difficulty`.
    ///
    /// If `false` (default), the room creator must manually add bots or invite players.
    #[serde(default)]
    pub fill_with_bots: bool,
}

fn default_card_year() -> u16 {
    2025
}

fn default_room_name() -> String {
    "My American Mahjong Game".to_string()
}

fn default_bot_difficulty() -> Option<Difficulty> {
    Some(Difficulty::Easy)
}

/// Join room request payload.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct JoinRoomPayload {
    /// Room identifier to join
    pub room_id: String,
}

/// Leave room request payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaveRoomPayload {}

/// Close room request payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloseRoomPayload {}

/// Heartbeat response payload.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct PongPayload {
    /// Echo of the timestamp from the Ping message
    #[ts(type = "string")]
    pub timestamp: DateTime<Utc>,
}

// ===== SERVER → CLIENT PAYLOADS =====

/// Successful authentication response.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct AuthSuccessPayload {
    /// Unique player identifier
    pub player_id: String,
    /// Display name for the player
    pub display_name: String,
    /// Session token for reconnection
    pub session_token: String,
    /// Current room if player is already in one (for reconnection)
    pub room_id: Option<String>,
    /// Current seat if player is already in a game (for reconnection)
    pub seat: Option<Seat>,
}

/// Failed authentication response.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct AuthFailurePayload {
    /// Human-readable error message
    pub reason: String,
}

/// Game event payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventPayload {
    /// The game event that occurred
    pub event: Event,
}

/// Room join confirmation payload.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct RoomJoinedPayload {
    /// Room identifier
    pub room_id: String,
    /// Seat assignment in the room
    pub seat: Seat,
    /// House rules configured for this room.
    ///
    /// Lets the lobby UI display the active ruleset (timers, bonuses, card year)
    /// before the game starts and the full `StateSnapshot` becomes available.
    pub house_rules: HouseRules,
}

/// Room leave confirmation payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomLeftPayload {
    /// Room identifier
    pub room_id: String,
}

/// Room closed notification payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomClosedPayload {
    /// Room identifier
    pub room_id: String,
}

/// Room member left notification payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomMemberLeftPayload {
    /// Room identifier
    pub room_id: String,
    /// Player identifier
    pub player_id: String,
    /// Seat that was vacated
    pub seat: Seat,
}

/// Error response payload.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct ErrorPayload {
    /// Machine-readable error code
    pub code: ErrorCode,
    /// Human-readable error message
    pub message: String,
    /// Optional additional context (e.g., field names, validation details)
    #[ts(type = "unknown")]
    pub context: Option<serde_json::Value>,
}

/// Standard error codes for server responses.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
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
    /// Player has already submitted for this action
    AlreadySubmitted,
    /// Player is not authenticated
    Unauthenticated,
    /// Generic server error
    InternalError,
}

/// Heartbeat request payload.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct PingPayload {
    /// Current server timestamp (client should echo in Pong)
    #[ts(type = "string")]
    pub timestamp: DateTime<Utc>,
}

/// State snapshot payload for reconnection.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct StateSnapshotPayload {
    /// Complete game state snapshot
    pub snapshot: GameStateSnapshot,
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

    /// Create a room with default card year (2025).
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_server::network::messages::Envelope;
    ///
    /// let envelope = Envelope::create_room();
    /// // Uses card year 2025
    /// ```
    pub fn create_room() -> Self {
        Self::create_room_with_year(2025)
    }

    /// Create a room with a specific card year.
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_server::network::messages::Envelope;
    ///
    /// // Create a room with 2020 NMJL card
    /// let envelope = Envelope::create_room_with_year(2020);
    ///
    /// // Create a room with 2017 card
    /// let envelope = Envelope::create_room_with_year(2017);
    /// ```
    ///
    /// # Available Years
    ///
    /// Supported years: 2017, 2018, 2019, 2020, 2025
    pub fn create_room_with_year(card_year: u16) -> Self {
        Self::CreateRoom(CreateRoomPayload {
            room_name: default_room_name(),
            card_year,
            house_rules: None,
            bot_difficulty: None,
            fill_with_bots: false,
        })
    }

    /// Join a room by id.
    pub fn join_room(room_id: String) -> Self {
        Self::JoinRoom(JoinRoomPayload { room_id })
    }

    /// Leave the current room.
    pub fn leave_room() -> Self {
        Self::LeaveRoom(LeaveRoomPayload {})
    }

    /// Close the current room.
    pub fn close_room() -> Self {
        Self::CloseRoom(CloseRoomPayload {})
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
    pub fn event(event: Event) -> Self {
        Self::Event(EventPayload { event })
    }

    /// Create a RoomJoined message.
    pub fn room_joined(room_id: String, seat: Seat, house_rules: HouseRules) -> Self {
        Self::RoomJoined(RoomJoinedPayload {
            room_id,
            seat,
            house_rules,
        })
    }

    /// Create a RoomLeft message.
    pub fn room_left(room_id: String) -> Self {
        Self::RoomLeft(RoomLeftPayload { room_id })
    }

    /// Create a RoomClosed message.
    pub fn room_closed(room_id: String) -> Self {
        Self::RoomClosed(RoomClosedPayload { room_id })
    }

    /// Create a RoomMemberLeft message.
    pub fn room_member_left(room_id: String, player_id: String, seat: Seat) -> Self {
        Self::RoomMemberLeft(RoomMemberLeftPayload {
            room_id,
            player_id,
            seat,
        })
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

    /// Create a StateSnapshot message.
    pub fn state_snapshot(snapshot: GameStateSnapshot) -> Self {
        Self::StateSnapshot(StateSnapshotPayload { snapshot })
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
    //! Round-trip tests for the JSON envelope format.

    use super::*;
    use mahjong_core::{command::GameCommand, player::Seat};

    /// Ensures guest auth envelopes serialize/deserialize correctly.
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

    /// Ensures token auth envelopes serialize/deserialize correctly.
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

    /// Ensures command envelopes serialize/deserialize correctly.
    #[test]
    fn test_command_roundtrip() {
        let command = GameCommand::DrawTile { player: Seat::East };
        let envelope = Envelope::command(command.clone());
        let json = envelope.to_json().unwrap();
        let parsed = Envelope::from_json(&json).unwrap();

        if let Envelope::Command(payload) = parsed {
            assert_eq!(payload.command, command);
        } else {
            panic!("Wrong envelope variant");
        }
    }

    /// Ensures auth success envelopes serialize/deserialize correctly.
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

    /// Ensures error envelopes serialize/deserialize correctly.
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

    /// Ensures ping/pong envelopes serialize/deserialize correctly.
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

    /// Ensures JSON layout matches the protocol schema.
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

    /// Export TypeScript bindings for CreateRoomPayload.
    #[test]
    fn export_bindings_createroompayload() {
        CreateRoomPayload::export().expect("Failed to export CreateRoomPayload bindings");
    }

    /// Export TypeScript bindings for AuthenticatePayload.
    #[test]
    fn export_bindings_authenticatepayload() {
        AuthenticatePayload::export().expect("Failed to export AuthenticatePayload bindings");
    }

    /// Export TypeScript bindings for AuthMethod.
    #[test]
    fn export_bindings_authmethod() {
        AuthMethod::export().expect("Failed to export AuthMethod bindings");
    }

    /// Export TypeScript bindings for Credentials.
    #[test]
    fn export_bindings_credentials() {
        Credentials::export().expect("Failed to export Credentials bindings");
    }

    /// Export TypeScript bindings for CommandPayload.
    #[test]
    fn export_bindings_commandpayload() {
        CommandPayload::export().expect("Failed to export CommandPayload bindings");
    }

    /// Export TypeScript bindings for JoinRoomPayload.
    #[test]
    fn export_bindings_joinroompayload() {
        JoinRoomPayload::export().expect("Failed to export JoinRoomPayload bindings");
    }

    /// Export TypeScript bindings for PongPayload.
    #[test]
    fn export_bindings_pongpayload() {
        PongPayload::export().expect("Failed to export PongPayload bindings");
    }

    /// Export TypeScript bindings for AuthSuccessPayload.
    #[test]
    fn export_bindings_authsuccesspayload() {
        AuthSuccessPayload::export().expect("Failed to export AuthSuccessPayload bindings");
    }

    /// Export TypeScript bindings for AuthFailurePayload.
    #[test]
    fn export_bindings_authfailurepayload() {
        AuthFailurePayload::export().expect("Failed to export AuthFailurePayload bindings");
    }

    /// Export TypeScript bindings for RoomJoinedPayload.
    #[test]
    fn export_bindings_roomjoinedpayload() {
        RoomJoinedPayload::export().expect("Failed to export RoomJoinedPayload bindings");
    }

    /// Export TypeScript bindings for ErrorCode.
    #[test]
    fn export_bindings_errorcode() {
        ErrorCode::export().expect("Failed to export ErrorCode bindings");
    }

    /// Export TypeScript bindings for ErrorPayload.
    #[test]
    fn export_bindings_errorpayload() {
        ErrorPayload::export().expect("Failed to export ErrorPayload bindings");
    }

    /// Export TypeScript bindings for PingPayload.
    #[test]
    fn export_bindings_pingpayload() {
        PingPayload::export().expect("Failed to export PingPayload bindings");
    }

    /// Export TypeScript bindings for StateSnapshotPayload.
    #[test]
    fn export_bindings_statesnapshotpayload() {
        StateSnapshotPayload::export().expect("Failed to export StateSnapshotPayload bindings");
    }
}
