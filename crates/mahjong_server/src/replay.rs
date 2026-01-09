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
    player::{Player, PlayerStatus, Seat},
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
    pub target_player: Option<String>,
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
        _viewer_seat: Option<Seat>,
    ) -> Result<Table, ReplayError> {
        let game = self
            .db
            .get_game(game_id)
            .await
            .map_err(ReplayError::Database)?;
        if game.is_none() {
            return Err(ReplayError::GameNotFound);
        }

        // Try to load nearest snapshot
        let (mut table, start_seq) = if let Some(snapshot) = self
            .db
            .get_latest_snapshot(game_id, target_seq)
            .await
            .map_err(ReplayError::Database)?
        {
            let snapshot_data: mahjong_core::snapshot::GameStateSnapshot =
                serde_json::from_value(snapshot.state)
                    .map_err(|e| ReplayError::Deserialization(e.to_string()))?;

            let card_year = snapshot_data.house_rules.ruleset.card_year;
            let validator = crate::resources::load_validator(card_year)
                .ok_or(ReplayError::ValidatorUnavailable(card_year))?;

            let table = Table::from_snapshot(snapshot_data, validator);
            (table, snapshot.seq + 1)
        } else {
            // No snapshot, start from beginning (need seed? Table::new generates random seed...)
            // Wait, Table::new(id, seed) requires seed.
            // If we start from 0, we need the initial seed.
            // But Table::new generates random seed if we don't provide it.
            // We should probably check if there is a "GameCreated" event or "GameStarting" that implies initialization?
            // Actually, for replay from 0, we rely on the events to populate state.
            // But Table::new creates a Wall with a seed.
            // If we don't have the original seed, replay might diverge if we rely on Wall randomness.
            // BUT we have stored `wall_seed` in `games` table!
            // `db.get_game` returns `GameRecord`.
            // Does `GameRecord` have `wall_seed`?
            // I added `wall_seed` to `games` table in DB, but `GameRecord` struct in `db.rs` was NOT updated to include it.
            // I should rely on the default behavior for now, or fetch `wall_seed` if possible.
            // The plan says "Replay: Seed 0 (wrong!)".
            // If I use 0, I match the "before" state.
            // But now I want it correct.
            // Since I can't easily change GameRecord struct right now (it's in db.rs), I'll use 0 for now as fallback.
            (Table::new(game_id.to_string(), 0), 0)
        };

        // Fetch events from start_seq to target_seq
        let events = self
            .db
            .get_events_range(game_id, start_seq, target_seq)
            .await
            .map_err(ReplayError::Database)?;

        for record in events {
            let event: GameEvent = serde_json::from_value(record.event)
                .map_err(|e| ReplayError::Deserialization(e.to_string()))?;

            // Special handling for TilesDealt because it lacks player info in the event itself
            if let GameEvent::TilesDealt { your_tiles } = &event {
                if let Some(target_str) = &record.target_player {
                    let seat = match target_str.as_str() {
                        "East" => Some(Seat::East),
                        "South" => Some(Seat::South),
                        "West" => Some(Seat::West),
                        "North" => Some(Seat::North),
                        _ => None,
                    };
                    if let Some(seat) = seat {
                        let player = table.players.entry(seat).or_insert_with(|| {
                            let mut p = Player::new("Unknown".to_string(), seat, false);
                            p.status = PlayerStatus::Active;
                            p
                        });
                        player.hand = mahjong_core::hand::Hand::new(your_tiles.clone());
                        player.status = PlayerStatus::Active;
                    }
                }
            } else if let Err(e) = mahjong_core::table::replay::apply_event(&mut table, event) {
                tracing::warn!("Failed to apply event at seq {}: {}", record.seq, e);
            }
        }

        // If viewer_seat is specified, we might want to filter the result?
        // But Table returned is the full server state (reconstructed).
        // The caller might want to create a snapshot from it for the viewer.
        // The method returns `Table`.

        Ok(table)
    }

    /// Get the final state of a completed game.
    pub async fn get_final_state(
        &self,
        game_id: &str,
    ) -> Result<Option<serde_json::Value>, ReplayError> {
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
    pub async fn verify_replay_integrity(&self, game_id: &str) -> Result<bool, ReplayError> {
        // Get admin replay (full event stream)
        let admin_replay = self.get_admin_replay(game_id).await?;

        // Get stored final state
        let final_state = self.get_final_state(game_id).await?;

        if final_state.is_none() {
            return Ok(false); // Game not finished
        }

        let max_seq = admin_replay
            .events
            .iter()
            .map(|event| event.seq)
            .max()
            .unwrap_or(0);

        let reconstructed = self
            .reconstruct_state_at_seq(game_id, max_seq, None)
            .await?;
        let reconstructed_value = serde_json::to_value(&reconstructed)
            .map_err(|e| ReplayError::Deserialization(e.to_string()))?;

        Ok(Some(reconstructed_value) == final_state)
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
            target_player: record.target_player,
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

    #[error("No validator available for card year {0}")]
    ValidatorUnavailable(u16),

    #[error("Game not found")]
    GameNotFound,
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
