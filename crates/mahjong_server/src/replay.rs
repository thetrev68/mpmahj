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
    flow::{GamePhase, SetupStage, TurnStage},
    player::{Player, PlayerStatus, Seat},
    table::{DiscardedTile, Table},
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

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
        let game = self
            .db
            .get_game(game_id)
            .await
            .map_err(ReplayError::Database)?;
        if game.is_none() {
            return Err(ReplayError::GameNotFound);
        }

        // Get events up to target_seq
        let replay: Vec<ReplayEvent> = match viewer_seat {
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

        let mut snapshot_seq = None;
        let mut table = if let Some(snapshot) = self
            .db
            .get_latest_snapshot(game_id, target_seq)
            .await
            .map_err(ReplayError::Database)?
        {
            snapshot_seq = Some(snapshot.seq);
            serde_json::from_value(snapshot.state)
                .map_err(|e| ReplayError::Deserialization(e.to_string()))?
        } else {
            Table::new(game_id.to_string(), 0)
        };

        let mut state = ReplayApplyState::new(viewer_seat);
        for entry in replay {
            if let Some(seq) = snapshot_seq {
                if entry.seq <= seq {
                    continue;
                }
            }
            if entry.seq <= target_seq {
                apply_event(&mut table, &entry.event, &mut state);
            }
        }

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

struct ReplayApplyState {
    next_deal_index: usize,
    viewer_seat: Option<Seat>,
    applied_draw_for_turn: bool,
}

impl ReplayApplyState {
    fn new(viewer_seat: Option<Seat>) -> Self {
        Self {
            next_deal_index: 0,
            viewer_seat,
            applied_draw_for_turn: false,
        }
    }
}

fn apply_event(table: &mut Table, event: &GameEvent, state: &mut ReplayApplyState) {
    match event {
        GameEvent::PlayerJoined {
            player,
            player_id,
            is_bot,
        } => {
            let entry = table.players.entry(*player).or_insert_with(|| {
                let mut p = Player::new(player_id.clone(), *player, *is_bot);
                p.status = PlayerStatus::Waiting;
                p
            });
            entry.id = player_id.clone();
            entry.is_bot = *is_bot;
        }
        GameEvent::GameStarting => {
            table.phase = GamePhase::Setup(SetupStage::RollingDice);
        }
        GameEvent::DiceRolled { .. } | GameEvent::WallBroken { .. } => {}
        GameEvent::TilesDealt { your_tiles } => {
            let seat = state.viewer_seat.unwrap_or_else(|| {
                let seats = Seat::all();
                let idx = state.next_deal_index.min(seats.len().saturating_sub(1));
                state.next_deal_index = (state.next_deal_index + 1).min(seats.len());
                seats[idx]
            });
            let player = table.players.entry(seat).or_insert_with(|| {
                let mut p = Player::new("Unknown".to_string(), seat, false);
                p.status = PlayerStatus::Waiting;
                p
            });
            player.hand = mahjong_core::hand::Hand::new(your_tiles.clone());
            player.status = PlayerStatus::Active;
        }
        GameEvent::CharlestonPhaseChanged { stage } => {
            table.phase = GamePhase::Charleston(*stage);
        }
        GameEvent::CharlestonComplete => {
            table.phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::East });
            table.current_turn = Seat::East;
        }
        GameEvent::TurnChanged { player, stage } => {
            table.phase = GamePhase::Playing(stage.clone());
            table.current_turn = *player;
            state.applied_draw_for_turn = false;
        }
        GameEvent::CallWindowOpened {
            tile,
            discarded_by,
            can_call,
        } => {
            table.phase = GamePhase::Playing(TurnStage::CallWindow {
                tile: *tile,
                discarded_by: *discarded_by,
                can_act: can_call.iter().copied().collect::<HashSet<_>>(),
                timer: 0,
            });
            table.current_turn = *discarded_by;
        }
        GameEvent::CallWindowClosed => {}
        GameEvent::TileDrawn {
            tile: Some(tile), ..
        } => {
            let seat = state.viewer_seat.unwrap_or(table.current_turn);
            if let Some(player) = table.players.get_mut(&seat) {
                player.hand.add_tile(*tile);
            }
            state.applied_draw_for_turn = true;
        }
        GameEvent::TileDrawn { tile: None, .. } => {
            if state.applied_draw_for_turn {
                state.applied_draw_for_turn = false;
            }
        }
        GameEvent::TileDiscarded { player, tile } => {
            if let Some(p) = table.players.get_mut(player) {
                let _ = p.hand.remove_tile(*tile);
            }
            table.discard_pile.push(DiscardedTile {
                tile: *tile,
                discarded_by: *player,
            });
        }
        GameEvent::TileCalled {
            player,
            meld,
            called_tile,
        } => {
            if let Some(last) = table.discard_pile.last() {
                if last.tile == *called_tile {
                    table.discard_pile.pop();
                }
            }
            if let Some(p) = table.players.get_mut(player) {
                let _ = p.hand.expose_meld(meld.clone());
            }
        }
        GameEvent::TilesReceived { player, tiles } => {
            if let Some(p) = table.players.get_mut(player) {
                for tile in tiles {
                    p.hand.add_tile(*tile);
                }
            }
        }
        GameEvent::JokerExchanged {
            player,
            target_seat,
            replacement,
            ..
        } => {
            if let Some(target) = table.players.get_mut(target_seat) {
                for meld in &mut target.hand.exposed {
                    if let Some(pos) = meld.tiles.iter().position(|t| t.is_joker()) {
                        meld.tiles[pos] = *replacement;
                        break;
                    }
                }
            }
            if let Some(p) = table.players.get_mut(player) {
                let _ = p.hand.remove_tile(*replacement);
                p.hand.add_tile(mahjong_core::tile::tiles::JOKER);
            }
        }
        GameEvent::BlankExchanged { player } => {
            if let Some(p) = table.players.get_mut(player) {
                if let Some(pos) = p.hand.concealed.iter().position(|t| t.is_blank()) {
                    let tile = p.hand.concealed[pos];
                    let _ = p.hand.remove_tile(tile);
                }
            }
        }
        GameEvent::PhaseChanged { phase } => {
            table.phase = phase.clone();
        }
        GameEvent::GameOver { result, .. } => {
            table.phase = GamePhase::GameOver(result.clone());
        }
        _ => {}
    }
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
