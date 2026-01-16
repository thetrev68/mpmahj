//! Player statistics aggregation and persistence.
use crate::db::Database;
use crate::network::session::Session;
use mahjong_core::flow::GameResult;
use mahjong_core::player::Seat;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Aggregated per-player statistics stored in the database.
// TODO: Complete PlayerStats tracking for dashboard support
//
// METRICS TO CONSIDER:
//
// 1. Pattern Attempt Tracking:
//    - Track which patterns players pursue during games (via AnalysisUpdate events)
//    - Metrics: patterns_attempted: HashMap<String, u32>, pattern_switch_count: u32
//    - Challenge: Need to define "attempt" (primary pattern? all viable patterns?)
//    - Challenge: Pattern viability changes each turn - aggregate over game or snapshot at key moments?
//
// 2. Move Timing:
//    - Average time per decision (discard, call, Charleston pass)
//    - Metrics: total_move_time_secs: u64, total_moves: u32, avg_charleston_time_secs: f32
//    - Challenge: Requires timestamp tracking in command processing (not currently captured)
//    - Implementation: Add `received_at: Instant` to command handling, emit timing events
//    - Note: Timers exist for call windows (started_at_ms), but not for general moves
//
// 3. Charleston Efficiency:
//    - Measure effectiveness of tile exchanges during Charleston
//    - Potential metrics:
//      * Percentage of passed tiles that were "dead" (not in final hand or patterns)
//      * Tiles received that contributed to final hand
//      * Blind pass/steal effectiveness (did stolen tiles help?)
//    - Challenge: Requires retroactive analysis of Charleston decisions vs final hand
//    - Challenge: Define "efficiency" - tile utility? pattern advancement? defensive value?
//
// 4. Discard Safety:
//    - Track dangerous vs safe discards (tiles other players could call)
//    - Metrics: dangerous_discards: u32, safe_discards: u32, tiles_called_by_others: u32
//    - Challenge: Requires post-game analysis of opponent hands to determine safety
//    - Challenge: "Dangerous" is probabilistic - needs AI-level evaluation (mahjong_ai crate)
//    - Note: Could track simpler metric: discards immediately called vs not called
//
// DATA COLLECTION APPROACHES:
//
// Option A: Event-sourced aggregation (parse game event log at game end)
//   - Pros: No changes to game loop, can be added incrementally
//   - Cons: Expensive to compute, may miss timing data without additional event fields
//   - Best for: Pattern tracking (from AnalysisUpdate events), discard analysis
//
// Option B: Real-time accumulation (track during gameplay via middleware)
//   - Pros: Accurate timing, can capture per-turn decisions
//   - Cons: Requires architectural changes to command/event pipeline
//   - Best for: Move timing, live efficiency calculations
//   - Implementation: Add timing middleware to Table::process_command()
//
// Option C: Hybrid (collect raw data during game, aggregate in update_player_stats)
//   - Add timing metadata to events (CommandExecuted, TurnChanged)
//   - Parse event log for detailed metrics at game end
//   - Balance between accuracy and complexity
//
// DECISION NEEDED: Which specific metrics provide value for players/dashboard?
// DECISION NEEDED: Is real-time tracking worth the architectural complexity?
// DECISION NEEDED: Should stats focus on outcomes (win rate) or process (decision quality)?
//
// IMPLEMENTATION BLOCKERS:
// - No command timestamp tracking in current architecture
// - No pattern "commitment" signal (players may pursue multiple patterns)
// - Charleston analysis requires definition of "good" vs "bad" pass
// - Safety analysis needs opponent hand visibility (only available post-game)
//
// SUGGESTED NEXT STEPS:
// 1. Define concrete metric list with product owner
// 2. Add timestamp field to command processing (server-side)
// 3. Emit TimingInfo events or add timing metadata to existing events
// 4. Implement event log parser for metric extraction
// 5. Add fields to PlayerStats struct
// 6. Update update_player_stats() to call metric extraction functions
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlayerStats {
    /// Total games played.
    pub games_played: u32,
    /// Total games won.
    pub games_won: u32,
    /// Total games lost.
    pub games_lost: u32,
    /// Total games drawn.
    pub games_drawn: u32,
    /// Count of wins per pattern identifier.
    pub wins_by_pattern: HashMap<String, u32>,
    /// Cumulative score across all games.
    pub total_score: i32,
    /// Highest single-game score.
    pub highest_score: i32,
    /// Lowest single-game score (can be negative).
    pub lowest_score: i32,
}

impl PlayerStats {
    /// Builds stats from a JSON blob stored in the database.
    pub fn from_value(value: Option<serde_json::Value>) -> Self {
        value
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default()
    }
}

/// Updates per-player statistics for a completed game.
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
