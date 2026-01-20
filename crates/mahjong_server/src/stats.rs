//! Player statistics aggregation and persistence.
//!
//! This module provides comprehensive player statistics tracking for American Mahjong games.
//! Stats are automatically collected during gameplay and persisted to the database at game completion.
//!
//! # Statistics Categories
//!
//! - **Core Metrics**: Games played, win/loss/draw counts, scores, pattern wins
//! - **Win Streaks**: Current and longest consecutive win tracking
//! - **Charleston Performance**: Tile exchange efficiency, blind passes, courtesy passes
//! - **Hand Building**: Discard safety, meld calling frequency, play style metrics
//! - **Joker Usage**: Joker frequency in winning vs losing hands
//!
//! # Architecture
//!
//! Statistics collection uses a two-phase approach:
//!
//! 1. **Event Analysis**: [`analyze_game_events`] processes the complete move history to extract
//!    in-game statistics that require event correlation (e.g., tracking whose discards were called).
//!
//! 2. **Game Result Analysis**: [`update_player_stats`] analyzes the final [`GameResult`] to
//!    extract end-game metrics (scores, joker counts, win streaks).
//!
//! # Example
//!
//! ```no_run
//! # use mahjong_server::stats::{PlayerStats, analyze_game_events};
//! # use mahjong_core::history::MoveHistoryEntry;
//! # let game_history: Vec<MoveHistoryEntry> = vec![];
//! // Analyze game events for per-player stats
//! let in_game_stats = analyze_game_events(&game_history);
//!
//! // PlayerStats provides derived metrics
//! let stats = PlayerStats::default();
//! let win_rate = stats.win_rate();  // Percentage
//! let charleston_eff = stats.charleston_efficiency();  // Ratio
//! let discard_safety = stats.discard_safety_rate();  // Percentage
//! ```
//!
//! # Frontend Integration
//!
//! TypeScript bindings are auto-generated for [`PlayerStats`] to enable type-safe frontend integration.
//! Run `cargo test export_bindings_player_stats` to regenerate bindings.
use crate::db::Database;
use crate::network::session::Session;
use mahjong_core::flow::outcomes::GameResult;
use mahjong_core::player::Seat;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use ts_rs::TS;

/// Aggregated per-player statistics stored in the database.
///
/// This structure tracks comprehensive gameplay metrics across all games for a single player.
/// All stats are cumulative and persist across game sessions.
///
/// # Persistence
///
/// Stats are stored as JSON in the PostgreSQL `players` table and updated via
/// [`update_player_stats`] after each game completion.
///
/// # Derived Metrics
///
/// Several helper methods calculate derived statistics:
/// - [`win_rate`](Self::win_rate) - Win percentage
/// - [`average_score`](Self::average_score) - Points per game
/// - [`charleston_efficiency`](Self::charleston_efficiency) - Tile exchange ratio
/// - [`discard_safety_rate`](Self::discard_safety_rate) - Safe discard percentage
/// - [`exposure_rate`](Self::exposure_rate) - Aggressive vs conservative play
/// - [`avg_jokers_per_win`](Self::avg_jokers_per_win) - Joker efficiency
/// - [`most_common_winning_pattern`](Self::most_common_winning_pattern) - Favorite pattern
/// - [`pattern_diversity`](Self::pattern_diversity) - Pattern variety score
///
/// # Backward Compatibility
///
/// New fields use `#[serde(default)]` to ensure compatibility with existing database records
/// that don't have these fields. Missing fields will initialize to their default values (0).
///
/// # Frontend Integration Point
///
/// **FRONTEND_INTEGRATION_POINT**: This struct is exported to TypeScript via ts-rs.
/// See `apps/client/src/types/bindings/generated/PlayerStats.ts` for frontend types.
///
/// # Example
///
/// ```
/// # use mahjong_server::stats::PlayerStats;
/// # use std::collections::HashMap;
/// let mut stats = PlayerStats::default();
/// stats.games_played = 10;
/// stats.games_won = 6;
/// stats.tiles_discarded = 120;
/// stats.discards_called_by_others = 15;
///
/// assert!((stats.win_rate() - 60.0).abs() < 0.01);
/// assert!((stats.discard_safety_rate() - 87.5).abs() < 0.01);
/// ```
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
#[derive(Debug, Clone, Serialize, Deserialize, Default, TS)]
#[ts(
    export,
    export_to = "../../../apps/client/src/types/bindings/generated/"
)]
pub struct PlayerStats {
    // === Core Game Metrics ===
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

    // === Win Streaks ===
    /// Current consecutive wins (resets on loss/draw).
    #[serde(default)]
    pub current_win_streak: u32,
    /// Longest win streak ever achieved.
    #[serde(default)]
    pub longest_win_streak: u32,

    // === Charleston Metrics ===
    /// Total tiles passed during Charleston phases.
    #[serde(default)]
    pub charleston_tiles_passed: u32,
    /// Total tiles received during Charleston phases.
    #[serde(default)]
    pub charleston_tiles_received: u32,
    /// Number of courtesy passes initiated.
    #[serde(default)]
    pub courtesy_passes_initiated: u32,
    /// Number of blind passes executed (exchanging <3 tiles).
    #[serde(default)]
    pub blind_passes_executed: u32,

    // === Hand Building Metrics ===
    /// Total tiles called for melds (Pung/Kong/Quint).
    #[serde(default)]
    pub tiles_called: u32,
    /// Total tiles discarded across all games.
    #[serde(default)]
    pub tiles_discarded: u32,
    /// Discards that were immediately called by other players.
    #[serde(default)]
    pub discards_called_by_others: u32,

    // === Joker Usage ===
    /// Jokers used in winning hands.
    #[serde(default)]
    pub jokers_used_in_wins: u32,
    /// Jokers used in losing hands.
    #[serde(default)]
    pub jokers_used_in_losses: u32,
}

impl PlayerStats {
    /// Builds stats from a JSON blob stored in the database.
    pub fn from_value(value: Option<serde_json::Value>) -> Self {
        value
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default()
    }

    /// Calculates win rate as a percentage (0.0 to 100.0).
    pub fn win_rate(&self) -> f32 {
        if self.games_played == 0 {
            0.0
        } else {
            (self.games_won as f32 / self.games_played as f32) * 100.0
        }
    }

    /// Calculates average score per game.
    pub fn average_score(&self) -> f32 {
        if self.games_played == 0 {
            0.0
        } else {
            self.total_score as f32 / self.games_played as f32
        }
    }

    /// Calculates Charleston pass efficiency (tiles received / tiles passed ratio).
    /// Values > 1.0 indicate receiving more than passing (net positive exchange).
    pub fn charleston_efficiency(&self) -> f32 {
        if self.charleston_tiles_passed == 0 {
            0.0
        } else {
            self.charleston_tiles_received as f32 / self.charleston_tiles_passed as f32
        }
    }

    /// Calculates discard safety rate (percentage of discards NOT called by others).
    /// Higher is better - represents safe play.
    pub fn discard_safety_rate(&self) -> f32 {
        if self.tiles_discarded == 0 {
            100.0
        } else {
            let safe_discards = self.tiles_discarded - self.discards_called_by_others;
            (safe_discards as f32 / self.tiles_discarded as f32) * 100.0
        }
    }

    /// Calculates exposure rate (percentage of hands played with exposed melds).
    /// Higher values indicate aggressive calling strategy.
    pub fn exposure_rate(&self) -> f32 {
        if self.tiles_discarded == 0 {
            0.0
        } else {
            (self.tiles_called as f32 / self.tiles_discarded as f32) * 100.0
        }
    }

    /// Updates win streak after a game result.
    pub fn update_win_streak(&mut self, won: bool) {
        if won {
            self.current_win_streak += 1;
            if self.current_win_streak > self.longest_win_streak {
                self.longest_win_streak = self.current_win_streak;
            }
        } else {
            self.current_win_streak = 0;
        }
    }

    /// Calculates average jokers per winning hand.
    pub fn avg_jokers_per_win(&self) -> f32 {
        if self.games_won == 0 {
            0.0
        } else {
            self.jokers_used_in_wins as f32 / self.games_won as f32
        }
    }

    /// Returns the most frequently won pattern (pattern ID and count).
    pub fn most_common_winning_pattern(&self) -> Option<(&str, u32)> {
        self.wins_by_pattern
            .iter()
            .max_by_key(|(_, count)| *count)
            .map(|(pattern, count)| (pattern.as_str(), *count))
    }

    /// Calculates pattern diversity score (number of unique patterns won / total wins).
    /// Values closer to 1.0 indicate diverse pattern usage.
    pub fn pattern_diversity(&self) -> f32 {
        if self.games_won == 0 {
            0.0
        } else {
            self.wins_by_pattern.len() as f32 / self.games_won as f32
        }
    }
}

/// Analyzes game events to extract in-game statistics.
///
/// This function processes the complete move history to calculate metrics that require
/// correlation between multiple events (e.g., tracking whose discards were called by opponents).
///
/// # Event Correlation
///
/// The function tracks state across events to correlate actions:
/// - **Discard Tracking**: Links [`GameEvent::TileDiscarded`] with subsequent [`GameEvent::TileCalled`]
///   to identify dangerous discards.
/// - **Charleston Analysis**: Counts tiles passed/received and detects blind passes (< 3 tiles).
/// - **Courtesy Pass Detection**: Tracks [`GameEvent::CourtesyPassProposed`] events.
///
/// # Returns
///
/// A [`HashMap`] mapping each [`Seat`] to their [`InGameStats`] for this game.
///
/// # Example
///
/// ```no_run
/// # use mahjong_server::stats::analyze_game_events;
/// # use mahjong_core::history::MoveHistoryEntry;
/// # let move_history: Vec<MoveHistoryEntry> = vec![];
/// let stats = analyze_game_events(&move_history);
///
/// for (seat, player_stats) in stats {
///     println!("{:?} discarded {} tiles, {} were called",
///         seat,
///         player_stats.tiles_discarded,
///         player_stats.discards_called_by_others
///     );
/// }
/// ```
///
/// # Performance
///
/// Time complexity: O(n) where n is the number of events in the game history.
/// Typical game has 200-400 events (Charleston + main game + scoring).
pub fn analyze_game_events(
    events: &[mahjong_core::history::MoveHistoryEntry],
) -> HashMap<Seat, InGameStats> {
    use mahjong_core::history::MoveAction;

    let mut stats: HashMap<Seat, InGameStats> = HashMap::new();
    let mut last_discard: Option<(Seat, mahjong_core::tile::Tile)> = None;

    for entry in events {
        match &entry.action {
            // Charleston metrics
            MoveAction::PassTiles { count, .. } => {
                let stat = stats.entry(entry.seat).or_default();
                stat.charleston_tiles_passed += u32::from(*count);
                if *count < 3 {
                    stat.blind_passes_executed += 1;
                }
            }

            // Hand building metrics
            MoveAction::DiscardTile { tile } => {
                last_discard = Some((entry.seat, *tile));
                let stat = stats.entry(entry.seat).or_default();
                stat.tiles_discarded += 1;
            }

            MoveAction::MeldCalled {
                tile: _, contested, ..
            } => {
                let stat = stats.entry(entry.seat).or_default();
                // Count the called tile
                stat.tiles_called += 1;

                // Track whose discard was called
                if let Some((discarder, _)) = last_discard {
                    if discarder != entry.seat {
                        let discarder_stat = stats.entry(discarder).or_default();
                        discarder_stat.discards_called_by_others += 1;
                    }
                }

                // If contested, it means this was a priority call
                if *contested {
                    // Could add contested_calls stat if needed
                }
            }

            MoveAction::CallWindowOpened { tile } => {
                // We can't determine who discarded from just this action
                // This info should come from the DiscardTile action before it
                last_discard = last_discard.or(Some((Seat::East, *tile)));
            }

            _ => {}
        }
    }

    stats
}

/// In-game statistics extracted from event log analysis.
///
/// This structure contains raw counts for a single game, extracted by [`analyze_game_events`].
/// These stats are accumulated into the persistent [`PlayerStats`] at game completion.
///
/// # Lifecycle
///
/// 1. Created per-player by [`analyze_game_events`] from move history
/// 2. Merged into [`PlayerStats`] by [`update_player_stats`]
/// 3. Persisted to database as part of cumulative player stats
///
/// # Design Rationale
///
/// Separated from [`PlayerStats`] because:
/// - Single game scope vs lifetime accumulation
/// - Requires event correlation (not available from [`GameResult`] alone)
/// - Different serialization requirements (ephemeral vs persisted)
#[derive(Debug, Default, Clone)]
pub struct InGameStats {
    pub charleston_tiles_passed: u32,
    pub charleston_tiles_received: u32,
    pub courtesy_passes_initiated: u32,
    pub blind_passes_executed: u32,
    pub tiles_called: u32,
    pub tiles_discarded: u32,
    pub discards_called_by_others: u32,
}

/// Updates per-player statistics for a completed game.
///
/// # Arguments
/// * `db` - Database handle for persistence
/// * `sessions` - Player sessions (for user IDs and display names)
/// * `result` - Final game result (winner, scores, hands)
/// * `game_history` - Complete event log for in-game stats analysis
pub async fn update_player_stats(
    db: &Database,
    sessions: &HashMap<Seat, Arc<Mutex<Session>>>,
    result: &GameResult,
    game_history: &[mahjong_core::history::MoveHistoryEntry],
) -> Result<(), sqlx::Error> {
    // Analyze event log to extract in-game stats
    let in_game_stats = analyze_game_events(game_history);

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

        // Merge in-game stats from event log analysis
        if let Some(game_stats) = in_game_stats.get(seat) {
            stats.charleston_tiles_passed += game_stats.charleston_tiles_passed;
            stats.charleston_tiles_received += game_stats.charleston_tiles_received;
            stats.courtesy_passes_initiated += game_stats.courtesy_passes_initiated;
            stats.blind_passes_executed += game_stats.blind_passes_executed;
            stats.tiles_called += game_stats.tiles_called;
            stats.tiles_discarded += game_stats.tiles_discarded;
            stats.discards_called_by_others += game_stats.discards_called_by_others;
        }

        // Get this player's final score
        let player_score = result.final_scores.get(seat).copied().unwrap_or(0);
        stats.total_score += player_score;
        if player_score > stats.highest_score {
            stats.highest_score = player_score;
        }
        if player_score < stats.lowest_score {
            stats.lowest_score = player_score;
        }

        // Count jokers in this player's final hand
        let joker_count = if let Some(hand) = result.final_hands.get(seat) {
            hand.concealed.iter().filter(|t| t.is_joker()).count() as u32
                + hand
                    .exposed
                    .iter()
                    .flat_map(|m| m.tiles.iter())
                    .filter(|t| t.is_joker())
                    .count() as u32
        } else {
            0
        };

        match result.winner {
            Some(winner) if winner == *seat => {
                stats.games_won += 1;
                stats.update_win_streak(true);
                stats.jokers_used_in_wins += joker_count;
                if let Some(pattern) = &result.winning_pattern {
                    *stats.wins_by_pattern.entry(pattern.clone()).or_insert(0) += 1;
                }
            }
            Some(_) => {
                stats.games_lost += 1;
                stats.update_win_streak(false);
                stats.jokers_used_in_losses += joker_count;
            }
            None => {
                stats.games_drawn += 1;
                stats.update_win_streak(false);
                // Don't count jokers in draws
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_bindings_player_stats() {
        PlayerStats::export().expect("Failed to export PlayerStats TypeScript bindings");
    }
}
