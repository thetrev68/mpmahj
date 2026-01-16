//! Room management for game instances.
//!
//! A Room represents a game lobby and active game instance. It:
//! - Manages up to 4 players (one per seat: East, South, West, North)
//! - Holds the authoritative game state (Table from mahjong_core)
//! - Processes commands and broadcasts events with visibility filtering
//! - Handles player lifecycle (join, disconnect, reconnect)
//!
//! ```no_run
//! use mahjong_server::network::room::Room;
//! let (room, _rx) = Room::new();
//! assert!(!room.room_id.is_empty());
//! ```

use crate::analysis::{AnalysisCache, AnalysisConfig, AnalysisHashState, AnalysisRequest};
use crate::db::{Database, EventDelivery};
use crate::network::events::RoomEvents;
use crate::network::session::Session;
use chrono::{DateTime, Utc};
use mahjong_ai::Difficulty;
use mahjong_core::history::{HistoryMode, MoveHistoryEntry};
use mahjong_core::{
    event::GameEvent,
    hint::HintVerbosity,
    player::{Player, PlayerStatus, Seat},
    table::{HouseRules, Table},
};
// serde removed
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;

// load_validator moved to resources.rs

/// A game room with up to 4 players.
///
/// Rooms have three states:
/// - Waiting: Players joining (< 4 players)
/// - Ready: All 4 players present (can start game)
/// - Active: Game in progress
#[derive(Debug)]
pub struct Room {
    /// Unique room identifier
    pub room_id: String,
    /// Players by seat (up to 4)
    pub sessions: HashMap<Seat, Arc<Mutex<Session>>>,
    /// The game table (contains all game state)
    pub table: Option<Table>,
    /// When this room was created
    pub created_at: DateTime<Utc>,
    /// Whether the game has started
    pub game_started: bool,
    /// Event sequence counter for persistence (monotonically increasing)
    pub(crate) event_seq: i32,
    /// Database handle for persistence (optional for testing)
    pub(crate) db: Option<Database>,
    /// Seats controlled by bots (for takeover)
    pub(crate) bot_seats: HashSet<Seat>,
    /// Whether a bot runner task is active
    pub(crate) bot_runner_active: bool,
    /// Difficulty level for bots in this room
    pub bot_difficulty: Difficulty,
    /// Custom house rules for this room (None = use defaults)
    pub house_rules: Option<HouseRules>,
    /// Per-player analysis cache (always-on analyst)
    pub analysis_cache: AnalysisCache,
    /// Analysis configuration (when to trigger, timeouts, etc.)
    pub analysis_config: AnalysisConfig,
    /// Hashes used to skip redundant analysis
    pub analysis_hashes: AnalysisHashState,
    /// Channel to send analysis requests to the background worker
    pub analysis_tx: mpsc::Sender<AnalysisRequest>,
    /// Hint verbosity per player (default: Intermediate).
    pub hint_verbosity: HashMap<Seat, HintVerbosity>,
    /// Pattern ID → display name (from UnifiedCard).
    /// Used for HintData.best_patterns.
    pub pattern_lookup: HashMap<String, String>,

    // ========== NEW FIELDS FOR AI COMPARISON ==========
    /// Debug mode: enables AI comparison logging
    /// Set from DEBUG_AI_COMPARISON environment variable at room creation
    pub(crate) debug_mode: bool,

    /// AI comparison log (only populated when debug_mode == true)
    /// Stored in memory, not persisted to database by default
    /// Each entry is ~5-10KB (hand snapshot + 3 recommendations)
    pub(crate) analysis_log: Vec<crate::analysis::comparison::AnalysisLogEntry>,
    /// Complete move history (append-only until game ends)
    // TODO: Add metrics for history entries per room and memory usage tracking
    pub history: Vec<MoveHistoryEntry>,

    /// Current history viewing mode
    pub history_mode: HistoryMode,

    /// Current move number (increments with each history entry)
    pub current_move_number: u32,

    /// Backup of "present" state when viewing history
    /// (allows returning to present without re-processing)

    /// Last call resolution (used to determine if meld call was contested)
    /// Set when CallResolved event is processed, used when TileCalled is processed
    pub(crate) last_call_resolution: Option<mahjong_core::call_resolution::CallResolution>,

    /// Last called tile (from call window, used for MahjongByCall history entry)
    pub(crate) last_called_tile: Option<mahjong_core::tile::Tile>,
    pub present_state: Option<Box<Table>>,
}

impl Room {
    /// Create a new empty room with default rules.
    pub fn new() -> (Self, mpsc::Receiver<AnalysisRequest>) {
        Self::new_with_rules(HouseRules::default())
    }

    /// Create a new room with database persistence and default rules.
    pub fn new_with_db(db: Database) -> (Self, mpsc::Receiver<AnalysisRequest>) {
        Self::new_with_db_and_rules(db, HouseRules::default())
    }

    /// Create a new room with custom house rules.
    pub fn new_with_rules(house_rules: HouseRules) -> (Self, mpsc::Receiver<AnalysisRequest>) {
        let (tx, rx) = mpsc::channel(100);
        let room_id = Uuid::new_v4().to_string();

        // Check if debug mode is enabled.
        let debug_mode = std::env::var("DEBUG_AI_COMPARISON").ok().as_deref() == Some("1");

        (
            Self {
                room_id,
                sessions: HashMap::new(),
                table: None,
                created_at: Utc::now(),
                game_started: false,
                event_seq: 0,
                db: None,
                bot_seats: HashSet::new(),
                bot_runner_active: false,
                bot_difficulty: Difficulty::Easy,
                house_rules: Some(house_rules),
                analysis_cache: HashMap::new(),
                analysis_config: AnalysisConfig::default(),
                analysis_hashes: AnalysisHashState::default(),
                analysis_tx: tx,
                hint_verbosity: HashMap::new(),
                pattern_lookup: HashMap::new(),
                debug_mode,
                analysis_log: Vec::new(),
                history: Vec::new(),
                history_mode: HistoryMode::None,
                current_move_number: 0,
                present_state: None,
                last_call_resolution: None,
                last_called_tile: None,
            },
            rx,
        )
    }

    /// Create a room with database and custom rules.
    pub fn new_with_db_and_rules(
        db: Database,
        house_rules: HouseRules,
    ) -> (Self, mpsc::Receiver<AnalysisRequest>) {
        let (tx, rx) = mpsc::channel(100);
        let room_id = Uuid::new_v4().to_string();

        // Check if debug mode is enabled.
        let debug_mode = std::env::var("DEBUG_AI_COMPARISON").ok().as_deref() == Some("1");

        (
            Self {
                room_id,
                sessions: HashMap::new(),
                table: None,
                created_at: Utc::now(),
                game_started: false,
                event_seq: 0,
                db: Some(db),
                bot_seats: HashSet::new(),
                bot_runner_active: false,
                bot_difficulty: Difficulty::Easy,
                house_rules: Some(house_rules),
                analysis_cache: HashMap::new(),
                analysis_config: AnalysisConfig::default(),
                analysis_hashes: AnalysisHashState::default(),
                analysis_tx: tx,
                hint_verbosity: HashMap::new(),
                pattern_lookup: HashMap::new(),
                debug_mode,
                analysis_log: Vec::new(),
                history: Vec::new(),
                history_mode: HistoryMode::None,
                current_move_number: 0,
                present_state: None,
                last_call_resolution: None,
                last_called_tile: None,
            },
            rx,
        )
    }

    /// Create a room with a specific ID (for testing).
    pub fn with_id(room_id: String) -> (Self, mpsc::Receiver<AnalysisRequest>) {
        let (tx, rx) = mpsc::channel(100);

        // Check if debug mode is enabled.
        let debug_mode = std::env::var("DEBUG_AI_COMPARISON").ok().as_deref() == Some("1");

        (
            Self {
                room_id,
                sessions: HashMap::new(),
                table: None,
                created_at: Utc::now(),
                game_started: false,
                event_seq: 0,
                db: None,
                bot_seats: HashSet::new(),
                bot_runner_active: false,
                bot_difficulty: Difficulty::Easy,
                house_rules: Some(HouseRules::default()),
                analysis_cache: HashMap::new(),
                analysis_config: AnalysisConfig::default(),
                analysis_hashes: AnalysisHashState::default(),
                analysis_tx: tx,
                hint_verbosity: HashMap::new(),
                pattern_lookup: HashMap::new(),
                debug_mode,
                analysis_log: Vec::new(),
                history: Vec::new(),
                history_mode: HistoryMode::None,
                current_move_number: 0,
                present_state: None,
                last_call_resolution: None,
                last_called_tile: None,
            },
            rx,
        )
    }

    /// Set the database for this room (useful for testing).
    pub fn set_db(&mut self, db: Database) {
        self.db = Some(db);
    }

    /// Get hint verbosity for a player (default: Intermediate).
    pub fn get_hint_verbosity(&self, seat: Seat) -> HintVerbosity {
        self.hint_verbosity
            .get(&seat)
            .copied()
            .unwrap_or(HintVerbosity::Intermediate)
    }

    /// Set hint verbosity for a player.
    pub fn set_hint_verbosity(&mut self, seat: Seat, level: HintVerbosity) {
        self.hint_verbosity.insert(seat, level);
    }

    /// Get pattern name from ID (for hint display).
    pub fn pattern_name(&self, pattern_id: &str) -> Option<&str> {
        self.pattern_lookup.get(pattern_id).map(|s| s.as_str())
    }

    /// Get the AI comparison log (debug mode only).
    ///
    /// Returns the full log if debug_mode is enabled, otherwise empty.
    pub fn get_analysis_log(&self) -> &[crate::analysis::comparison::AnalysisLogEntry] {
        if self.debug_mode {
            &self.analysis_log
        } else {
            &[]
        }
    }

    /// Get the number of entries in the analysis log.
    pub fn analysis_log_len(&self) -> usize {
        self.analysis_log.len()
    }

    /// Check if the room is full (4 players).
    pub fn is_full(&self) -> bool {
        self.sessions.len() >= 4
    }

    /// Check if all seats are occupied.
    pub fn all_seats_filled(&self) -> bool {
        self.sessions.len() == 4
    }

    /// Find an available seat.
    ///
    /// Returns the first unoccupied seat in order: East, South, West, North.
    pub fn find_available_seat(&self) -> Option<Seat> {
        [Seat::East, Seat::South, Seat::West, Seat::North]
            .into_iter()
            .find(|&seat| !self.sessions.contains_key(&seat))
    }

    /// Add a player to the room.
    ///
    /// Returns the assigned seat, or an error if room is full.
    pub async fn join(&mut self, session: Arc<Mutex<Session>>) -> Result<Seat, String> {
        if self.is_full() {
            return Err("Room is full".to_string());
        }

        let seat = self
            .find_available_seat()
            .ok_or_else(|| "No available seats".to_string())?;

        // Update session with room info
        {
            let mut sess = session.lock().await;
            sess.room_id = Some(self.room_id.clone());
            sess.seat = Some(seat);
        }

        self.sessions.insert(seat, session);

        // If all 4 seats filled, start the game
        if self.all_seats_filled() && !self.game_started {
            self.start_game().await;
        }

        Ok(seat)
    }

    /// Start the game (called when all 4 players are present).
    async fn start_game(&mut self) {
        // Get house rules (custom or default).
        let house_rules = self.house_rules.clone().unwrap_or_default();
        let card_year = house_rules.ruleset.card_year;

        // Create the game table with the configured rules.
        let seed = rand::random::<u64>();
        let mut table = Table::new_with_rules(self.room_id.clone(), seed, house_rules);

        // Load validator for the card year.
        if let Some(resources) = crate::resources::load_card_resources(card_year) {
            table.set_validator(resources.validator);
            self.pattern_lookup = resources.pattern_lookup;
        } else {
            // Warn but continue - game can proceed without win validation
            tracing::warn!(
                "Failed to load validator for year {} - win validation disabled. \
                 Game will proceed but cannot validate Mahjong declarations.",
                card_year
            );
        }

        // Populate players from sessions.
        for (seat, session_arc) in &self.sessions {
            let session = session_arc.lock().await;
            let player = mahjong_core::player::Player::new(session.player_id.clone(), *seat, false);
            table.players.insert(*seat, player);
        }

        // Transition to Setup phase.
        let _ = table.transition_phase(mahjong_core::flow::PhaseTrigger::AllPlayersJoined);

        // Broadcast GameStarting event.
        self.table = Some(table);
        self.game_started = true;

        // Persist game creation.
        if let Some(db) = &self.db {
            if let Err(e) = db.create_game(&self.room_id).await {
                tracing::error!("Failed to persist game creation: {}", e);
            }
        }

        let event = GameEvent::GameStarting;
        self.broadcast_event(event, EventDelivery::broadcast())
            .await;

        // Auto-roll dice and deal tiles (no player input needed for setup)
        // Collect all events first to avoid borrow conflicts
        let events_to_broadcast: Vec<(GameEvent, EventDelivery)> = if let Some(table) =
            &mut self.table
        {
            let dummy_command = mahjong_core::command::GameCommand::RollDice { player: Seat::East };

            let setup_events = mahjong_core::table::handlers::setup::roll_dice(table, Seat::East);

            // TilesDealt events are emitted in Seat::all() order
            let mut dealt_targets = Seat::all().into_iter();
            let mut collected: Vec<(GameEvent, EventDelivery)> = Vec::new();

            for event in setup_events {
                let delivery = crate::network::visibility::compute_event_delivery(
                    &event,
                    &dummy_command,
                    Seat::East,
                    &mut dealt_targets,
                );

                if let Some(d) = delivery {
                    collected.push((event, d));
                } else {
                    tracing::error!(
                        event = ?event,
                        "Private event missing target during setup; skipping"
                    );
                }
            }

            // Auto-ready all players to start Charleston immediately
            for seat in Seat::all() {
                let ready_events =
                    mahjong_core::table::handlers::setup::ready_to_start(table, seat);
                for event in ready_events {
                    collected.push((event, EventDelivery::broadcast()));
                }
            }

            collected
        } else {
            Vec::new()
        };

        // Now broadcast all collected events
        for (event, delivery) in events_to_broadcast {
            self.broadcast_event(event, delivery).await;
        }
    }

    /// Enable a bot to take over a disconnected seat.
    pub fn enable_bot(&mut self, seat: Seat, player_id: String) {
        self.bot_seats.insert(seat);
        if let Some(table) = &mut self.table {
            let entry = table
                .players
                .entry(seat)
                .or_insert_with(|| Player::new(player_id, seat, true));
            entry.is_bot = true;
            entry.status = PlayerStatus::Active;
        }
    }

    /// Marks the bot runner as active, returning true if it was previously inactive.
    pub fn mark_bot_runner_active(&mut self) -> bool {
        if self.bot_runner_active {
            false
        } else {
            self.bot_runner_active = true;
            true
        }
    }

    /// Set the difficulty level for bots in this room.
    pub fn configure_bot_difficulty(&mut self, difficulty: Difficulty) {
        self.bot_difficulty = difficulty;
    }

    /// Remove a player from the room.
    ///
    /// If game hasn't started, simply removes them.
    /// If game is active, marks them as disconnected (can reconnect within grace period).
    pub async fn remove_player(&mut self, seat: Seat) -> bool {
        if let Some(session) = self.sessions.remove(&seat) {
            let mut sess = session.lock().await;
            sess.room_id = None;
            sess.seat = None;
            true
        } else {
            false
        }
    }

    /// Get the number of players in the room.
    pub fn player_count(&self) -> usize {
        self.sessions.len()
    }

    // update_player_stats moved to stats.rs
}

// spawn_bot_runner and get_ai_command moved to bot_runner.rs

// PlayerStats moved to stats.rs

impl Default for Room {
    fn default() -> Self {
        Self::new().0
    }
}

#[cfg(test)]
mod tests {
    //! Unit tests for room lifecycle helpers.

    use super::*;

    /// Ensures a new room starts empty.
    #[test]
    fn test_room_creation() {
        let (room, _) = Room::new();
        assert!(!room.room_id.is_empty());
        assert_eq!(room.player_count(), 0);
        assert!(!room.is_full());
        assert!(!room.all_seats_filled());
        assert!(!room.game_started);
    }

    /// Ensures available seats are reported in order.
    #[test]
    fn test_find_available_seat() {
        let (room, _) = Room::new();

        // All seats should be available initially
        assert_eq!(room.find_available_seat(), Some(Seat::East));
    }

    /// Ensures empty rooms report capacity correctly.
    #[test]
    fn test_room_capacity() {
        let (room, _) = Room::new();

        // Empty room is not full
        assert!(!room.is_full());
        assert!(!room.all_seats_filled());
        assert_eq!(room.player_count(), 0);
    }

    /// Ensures custom IDs are preserved.
    #[test]
    fn test_room_with_id() {
        let custom_id = "test-room-123".to_string();
        let (room, _) = Room::with_id(custom_id.clone());
        assert_eq!(room.room_id, custom_id);
        assert_eq!(room.player_count(), 0);
    }

    /// Ensures default rules are applied on creation.
    #[test]
    fn test_room_creation_with_default_rules() {
        let (room, _) = Room::new();
        assert!(!room.room_id.is_empty());
        assert_eq!(room.player_count(), 0);
        assert!(!room.game_started);
        // Default house rules should be present
        assert!(room.house_rules.is_some());
        assert_eq!(room.house_rules.unwrap().ruleset.card_year, 2025);
    }

    /// Ensures custom rules are applied on creation.
    #[test]
    fn test_room_creation_with_custom_rules() {
        let house_rules = HouseRules::with_card_year(2020);
        let (room, _) = Room::new_with_rules(house_rules);

        assert_eq!(room.house_rules.unwrap().ruleset.card_year, 2020);
    }
}
