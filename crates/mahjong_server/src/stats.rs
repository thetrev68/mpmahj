use crate::db::Database;
use crate::network::session::Session;
use mahjong_core::flow::GameResult;
use mahjong_core::player::Seat;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlayerStats {
    pub games_played: u32,
    pub games_won: u32,
    pub games_lost: u32,
    pub games_drawn: u32,
    pub wins_by_pattern: HashMap<String, u32>,
    pub total_score: i32,   // Cumulative score across all games
    pub highest_score: i32, // Highest single-game score
    pub lowest_score: i32,  // Lowest single-game score (can be negative)
}

impl PlayerStats {
    pub fn from_value(value: Option<serde_json::Value>) -> Self {
        value
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default()
    }
}

pub async fn update_player_stats(
    db: &Database,
    sessions: &HashMap<Seat, Arc<Mutex<Session>>>,
    result: &GameResult,
) -> Result<(), sqlx::Error> {
    for (seat, session_arc) in sessions {
        let session = session_arc.lock().await;
        let player_id = session.player_id.clone();
        let display_name = session.display_name.clone();
        drop(session);

        let (mut stats, use_user_id) =
            if let Some(record) = db.get_player_by_user_id(&player_id).await? {
                (PlayerStats::from_value(record.stats), true)
            } else {
                db.upsert_player(&player_id, Some(&display_name)).await?;
                let record = db.get_player(&player_id).await?;
                (PlayerStats::from_value(record.and_then(|r| r.stats)), false)
            };

        stats.games_played += 1;

        // Get this player's final score
        let player_score = result.final_scores.get(seat).copied().unwrap_or(0);
        stats.total_score += player_score;
        if player_score > stats.highest_score {
            stats.highest_score = player_score;
        }
        if player_score < stats.lowest_score {
            stats.lowest_score = player_score;
        }

        match result.winner {
            Some(winner) if winner == *seat => {
                stats.games_won += 1;
                if let Some(pattern) = &result.winning_pattern {
                    *stats.wins_by_pattern.entry(pattern.clone()).or_insert(0) += 1;
                }
            }
            Some(_) => {
                stats.games_lost += 1;
            }
            None => {
                stats.games_drawn += 1;
            }
        }

        let stats_value = serde_json::to_value(&stats).map_err(|e| {
            sqlx::Error::Encode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                e.to_string(),
            )))
        })?;

        if use_user_id {
            db.update_player_stats_by_user_id(&player_id, &stats_value)
                .await?;
        } else {
            db.update_player_stats(&player_id, &stats_value).await?;
        }
    }

    Ok(())
}
