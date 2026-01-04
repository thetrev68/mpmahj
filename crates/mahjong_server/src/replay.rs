//! Replay functionality for reconstructing and viewing past games.
//!
//! Provides:
//! - Per-player filtered event streams (respects privacy)
//! - Admin full event streams (no filtering)
//! - State reconstruction from event logs
//! - Snapshot-based replay optimization

use crate::db::{Database, EventRecord};
use mahjong_core::{
    event::GameEvent,
    player::Seat,
    table::Table,
};
use serde::{Deserialize, Serialize};

/// Replay view for a specific player.
///
/// Contains only events the player is authorized to see:
/// - All public events
/// - Private events targeted at this player
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerReplay {
    pub game_id: String,
    pub viewer_seat: Seat,
    pub events: Vec<ReplayEvent>,
    pub event_count: usize,
}

/// Replay event with metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayEvent {
    pub seq: i32,
    pub event: GameEvent,
    pub visibility: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Admin replay with full access (no privacy filtering).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminReplay {
    pub game_id: String,
    pub events: Vec<ReplayEvent>,
    pub event_count: usize,
}

/// Replay service for querying and reconstructing games.
pub struct ReplayService {
    db: Database,
}

impl ReplayService {
    /// Create a new replay service.
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    /// Get a filtered replay for a specific player.
    ///
    /// Returns only events the player is authorized to see.
    pub async fn get_player_replay(
        &self,
        game_id: &str,
        viewer_seat: Seat,
    ) -> Result<PlayerReplay, ReplayError> {
        let records = self
            .db
            .get_player_replay(game_id, viewer_seat)
            .await
            .map_err(ReplayError::Database)?;

        let events = records
            .into_iter()
            .map(|r| self.record_to_replay_event(r))
            .collect::<Result<Vec<_>, _>>()?;

        let event_count = events.len();

        Ok(PlayerReplay {
            game_id: game_id.to_string(),
            viewer_seat,
            events,
            event_count,
        })
    }

    /// Get a complete replay (admin access).
    ///
    /// Returns all events with no privacy filtering.
    pub async fn get_admin_replay(&self, game_id: &str) -> Result<AdminReplay, ReplayError> {
        let records = self
            .db
            .get_admin_replay(game_id)
            .await
            .map_err(ReplayError::Database)?;

        let events = records
            .into_iter()
            .map(|r| self.record_to_replay_event(r))
            .collect::<Result<Vec<_>, _>>()?;

        let event_count = events.len();

        Ok(AdminReplay {
            game_id: game_id.to_string(),
            events,
            event_count,
        })
    }

    /// Reconstruct game state at a specific event sequence.
    ///
    /// This replays events from the beginning up to the specified sequence.
    /// For admin reconstruction, use `viewer_seat = None`.
    pub async fn reconstruct_state_at_seq(
        &self,
        game_id: &str,
        target_seq: i32,
        viewer_seat: Option<Seat>,
    ) -> Result<Table, ReplayError> {
        // Get events up to target_seq
        let _replay: Vec<ReplayEvent> = match viewer_seat {
            Some(seat) => {
                let player_replay = self.get_player_replay(game_id, seat).await?;
                player_replay
                    .events
                    .into_iter()
                    .filter(|e| e.seq <= target_seq)
                    .collect()
            }
            None => {
                let admin_replay = self.get_admin_replay(game_id).await?;
                admin_replay
                    .events
                    .into_iter()
                    .filter(|e| e.seq <= target_seq)
                    .collect()
            }
        };

        // Reconstruct state by replaying events
        // Note: This is a simplified version. Full reconstruction would require
        // initializing a Table from game metadata and applying events one by one.
        // For now, we return an error indicating this needs implementation.
        Err(ReplayError::ReconstructionNotImplemented)
    }

    /// Get the final state of a completed game.
    pub async fn get_final_state(&self, game_id: &str) -> Result<Option<serde_json::Value>, ReplayError> {
        let game = self
            .db
            .get_game(game_id)
            .await
            .map_err(ReplayError::Database)?;

        Ok(game.and_then(|g| g.final_state))
    }

    /// Verify that replaying events produces the same final state.
    ///
    /// This is useful for testing event sourcing correctness.
    pub async fn verify_replay_integrity(
        &self,
        game_id: &str,
    ) -> Result<bool, ReplayError> {
        // Get admin replay (full event stream)
        let _admin_replay = self.get_admin_replay(game_id).await?;

        // Get stored final state
        let final_state = self.get_final_state(game_id).await?;

        if final_state.is_none() {
            return Ok(false); // Game not finished
        }

        // For full verification, we would:
        // 1. Reconstruct state from events
        // 2. Serialize reconstructed state
        // 3. Compare with stored final_state
        //
        // This requires Table reconstruction implementation.
        Err(ReplayError::ReconstructionNotImplemented)
    }

    /// Get event count for a game.
    pub async fn get_event_count(&self, game_id: &str) -> Result<i32, ReplayError> {
        self.db
            .get_event_count(game_id)
            .await
            .map_err(ReplayError::Database)
    }

    // ========================================================================
    // Helper methods
    // ========================================================================

    /// Convert database EventRecord to ReplayEvent.
    fn record_to_replay_event(&self, record: EventRecord) -> Result<ReplayEvent, ReplayError> {
        let event: GameEvent = serde_json::from_value(record.event)
            .map_err(|e| ReplayError::Deserialization(e.to_string()))?;

        Ok(ReplayEvent {
            seq: record.seq,
            event,
            visibility: record.visibility,
            timestamp: record.created_at,
        })
    }
}

// ============================================================================
// Error types
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum ReplayError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Failed to deserialize event: {0}")]
    Deserialization(String),

    #[error("Game not found")]
    GameNotFound,

    #[error("State reconstruction not yet implemented")]
    ReconstructionNotImplemented,
}

// ============================================================================
// Replay request/response types for API
// ============================================================================

/// Request to get a player's replay.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerReplayRequest {
    pub game_id: String,
    pub viewer_seat: Seat,
}

/// Request to get admin replay.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminReplayRequest {
    pub game_id: String,
}

/// Response containing replay data.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ReplayResponse {
    PlayerReplay(PlayerReplay),
    AdminReplay(AdminReplay),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires database
    async fn test_replay_service_creation() {
        let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set");
        let db = Database::new(&db_url).await.unwrap();
        let _service = ReplayService::new(db);
    }
}
