use chrono::{DateTime, Utc};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use uuid::Uuid;

/// Game metadata record.
#[derive(Debug, Clone, serde::Serialize, FromRow)]
pub struct GameRecord {
    /// Game ID.
    pub id: Uuid,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Completion timestamp.
    pub finished_at: Option<DateTime<Utc>>,
    /// Seat that won, if any.
    pub winner_seat: Option<String>,
    /// Pattern code for the winning hand.
    pub winning_pattern: Option<String>,
    /// Final serialized game state.
    pub final_state: Option<JsonValue>,
    /// Optional analysis log for admins.
    pub analysis_log: Option<JsonValue>,
    /// Wall seed for deterministic replay reconstruction.
    pub wall_seed: Option<i64>,
}

/// Reduced game record for list views.
#[derive(Debug, Clone, serde::Serialize, FromRow)]
pub struct GameListRecord {
    /// Game ID.
    pub id: Uuid,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Completion timestamp.
    pub finished_at: Option<DateTime<Utc>>,
    /// Seat that won, if any.
    pub winner_seat: Option<String>,
    /// Pattern code for the winning hand.
    pub winning_pattern: Option<String>,
}

/// Persisted event row.
#[derive(Debug, Clone, FromRow)]
pub struct EventRecord {
    /// Row ID.
    pub id: Uuid,
    /// Sequence number within the game.
    pub seq: i32,
    /// Serialized event payload.
    pub event: JsonValue,
    /// Visibility string ("public" or "private").
    pub visibility: String,
    /// Targeted player for private events.
    pub target_player: Option<String>,
    /// Persistence timestamp.
    pub created_at: DateTime<Utc>,
}

/// Snapshot row used for fast replay reconstruction.
#[derive(Debug, Clone, FromRow)]
pub struct SnapshotRecord {
    /// Row ID.
    pub id: Uuid,
    /// Game ID.
    pub game_id: Uuid,
    /// Sequence number of the snapshot.
    pub seq: i32,
    /// Serialized snapshot state.
    pub state: JsonValue,
    /// Persistence timestamp.
    pub created_at: DateTime<Utc>,
}

/// Player profile row.
#[derive(Debug, Clone, FromRow)]
pub struct PlayerRecord {
    /// Player ID.
    pub id: Uuid,
    /// Username (email for Supabase-backed players).
    pub username: String,
    /// Optional display name override.
    pub display_name: Option<String>,
    /// Serialized stats blob.
    pub stats: Option<JsonValue>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last seen timestamp.
    pub last_seen: Option<DateTime<Utc>>,
}
