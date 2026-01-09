//! Room management for game instances.
//!
//! A Room represents a game lobby and active game instance. It:
//! - Manages up to 4 players (one per seat: East, South, West, North)
//! - Holds the authoritative game state (Table from mahjong_core)
//! - Processes commands and broadcasts events with visibility filtering
//! - Handles player lifecycle (join, disconnect, reconnect)

use crate::analysis::{AnalysisCache, AnalysisConfig, AnalysisHashState, AnalysisRequest, AnalysisTrigger};
use crate::db::{Database, EventDelivery, EventVisibility};
use crate::network::{messages::Envelope, session::Session};
use axum::extract::ws::Message;
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use futures_util::SinkExt;
use mahjong_ai::Difficulty;
use mahjong_core::{
    command::GameCommand,
    event::GameEvent,
    player::{Player, PlayerStatus, Seat},
    table::{CommandError, HouseRules, Table},
};
// serde removed
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Weak};
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
    event_seq: i32,
    /// Database handle for persistence (optional for testing)
    db: Option<Database>,
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
}

const SNAPSHOT_INTERVAL: i32 = 50;

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
            },
            rx,
        )
    }

    /// Create a room with a specific ID (for testing).
    pub fn with_id(room_id: String) -> (Self, mpsc::Receiver<AnalysisRequest>) {
        let (tx, rx) = mpsc::channel(100);
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
            },
            rx,
        )
    }

    /// Set the database for this room (useful for testing).
    pub fn set_db(&mut self, db: Database) {
        self.db = Some(db);
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
        // Get house rules (custom or default)
        let house_rules = self.house_rules.clone().unwrap_or_default();
        let card_year = house_rules.ruleset.card_year;

        // Create the game table with the configured rules
        let seed = rand::random::<u64>();
        let mut table = Table::new_with_rules(self.room_id.clone(), seed, house_rules);

        // Load validator for the card year
        if let Some(validator) = crate::resources::load_validator(card_year) {
            table.set_validator(validator);
        } else {
            // Warn but continue - game can proceed without win validation
            tracing::warn!(
                "Failed to load validator for year {} - win validation disabled. \
                 Game will proceed but cannot validate Mahjong declarations.",
                card_year
            );
        }

        // Populate players from sessions
        for (seat, session_arc) in &self.sessions {
            let session = session_arc.lock().await;
            let player = mahjong_core::player::Player::new(session.player_id.clone(), *seat, false);
            table.players.insert(*seat, player);
        }

        // Transition to Setup phase
        let _ = table.transition_phase(mahjong_core::flow::PhaseTrigger::AllPlayersJoined);
        self.table = Some(table);
        self.game_started = true;

        // Persist game creation
        if let Some(db) = &self.db {
            if let Err(e) = db.create_game(&self.room_id).await {
                tracing::error!("Failed to persist game creation: {}", e);
            }
        }

        // Broadcast GameStarting event
        let event = GameEvent::GameStarting;
        self.broadcast_event(event, EventDelivery::broadcast())
            .await;
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

    /// Process a game command.
    ///
    /// Validates the command, applies it to the table, and broadcasts resulting events.
    pub async fn handle_command(
        &mut self,
        command: GameCommand,
        sender_player_id: &str,
    ) -> Result<(), CommandError> {
        let command_for_delivery = command.clone();

        // Ensure the sender is authorized to act for the command's seat.
        let command_seat = command.player();
        {
            let session = self
                .sessions
                .get(&command_seat)
                .ok_or(CommandError::PlayerNotFound)?;
            let session = session.lock().await;
            if session.player_id != sender_player_id {
                return Err(CommandError::PlayerNotFound);
            }
        } // session lock is dropped here

        // Handle GetAnalysis command directly (doesn't go through Table)
        if matches!(command, GameCommand::GetAnalysis { .. }) {
            return self.handle_get_analysis_command(command_seat).await;
        }

        // Process command through the Table (this validates and generates events)
        // and capture any context needed for delivery decisions.
        let (events, current_turn_after) = {
            let table = self.table.as_mut().ok_or(CommandError::WrongPhase)?;
            let events = table.process_command(command)?;
            (events, table.current_turn)
        };

        // Some private events (e.g., TilesDealt) don't include their target seat.
        // The core emits those events in Seat::all() order during dealing.
        let mut dealt_targets = Seat::all().into_iter();

        // Broadcast all resulting events
        for event in events {
            let delivery = crate::network::visibility::compute_event_delivery(
                &event,
                &command_for_delivery,
                current_turn_after,
                &mut dealt_targets,
            );

            let delivery = match delivery {
                Some(d) => d,
                None => {
                    // Do not broadcast/persist private events if we cannot determine a target.
                    tracing::error!(
                        event = ?event,
                        "Private event missing target; refusing to broadcast/persist"
                    );
                    continue;
                }
            };

            self.broadcast_event(event, delivery).await;
        }

        Ok(())
    }

    /// Handle a bot-issued command (no session authorization).
    pub async fn handle_bot_command(&mut self, command: GameCommand) -> Result<(), CommandError> {
        let command_for_delivery = command.clone();
        let (events, current_turn_after) = {
            let table = self.table.as_mut().ok_or(CommandError::WrongPhase)?;
            let events = table.process_command(command)?;
            (events, table.current_turn)
        };

        let mut dealt_targets = Seat::all().into_iter();
        for event in events {
            let delivery = crate::network::visibility::compute_event_delivery(
                &event,
                &command_for_delivery,
                current_turn_after,
                &mut dealt_targets,
            );

            let delivery = match delivery {
                Some(d) => d,
                None => {
                    tracing::error!(
                        event = ?event,
                        "Private event missing target; refusing to broadcast/persist"
                    );
                    continue;
                }
            };

            self.broadcast_event(event, delivery).await;
        }
        Ok(())
    }

    /// Handle GetAnalysis command by returning cached analysis results.
    ///
    /// If no analysis is cached for the player, runs analysis on-demand.
    /// Sends HandAnalysisUpdated event with full results to the requesting player.
    async fn handle_get_analysis_command(&mut self, seat: Seat) -> Result<(), CommandError> {
        // Get or compute analysis for this seat
        if !self.analysis_cache.contains_key(&seat) {
            // No cached analysis - run it now
            self.run_analysis_for_seat(seat).await;
        }

        // Get cached analysis (should exist now)
        if let Some(analysis) = self.analysis_cache.get(&seat) {
            if let Some(session) = self.sessions.get(&seat) {
                let event = GameEvent::HandAnalysisUpdated {
                    distance_to_win: analysis.distance_to_win,
                    viable_count: analysis.viable_count,
                    impossible_count: analysis.impossible_count,
                };
                self.send_to_session(session, event).await;
            }
        }

        Ok(())
    }

    /// Run analysis for a specific seat (used by GetAnalysis command).
    async fn run_analysis_for_seat(&mut self, seat: Seat) {
        use crate::analysis::HandAnalysis;
        use mahjong_ai::context::VisibleTiles;
        use mahjong_ai::evaluation::StrategicEvaluation;
        use std::time::Instant;

        let table = match &self.table {
            Some(t) => t,
            None => return,
        };

        let validator = match &table.validator {
            Some(v) => v,
            None => return,
        };

        // Build VisibleTiles
        let mut visible = VisibleTiles::new();
        for discarded in &table.discard_pile {
            visible.add_discard(discarded.tile);
        }
        for (s, player) in &table.players {
            for meld in &player.hand.exposed {
                visible.add_meld(*s, meld.clone());
            }
        }

        // Get player and run analysis
        if let Some(player) = table.players.get(&seat) {
            let start = Instant::now();
            let hand = &player.hand;

            let analysis_results = validator.analyze(hand, self.analysis_config.max_patterns);

            let evaluations: Vec<StrategicEvaluation> = analysis_results
                .into_iter()
                .filter_map(|result| {
                    let target_histogram =
                        validator.histogram_for_variation(&result.variation_id)?;
                    Some(StrategicEvaluation::from_analysis(
                        result,
                        hand,
                        &visible,
                        target_histogram,
                    ))
                })
                .collect();

            let analysis = HandAnalysis::from_evaluations(evaluations);
            let elapsed = start.elapsed();

            tracing::info!(
                seat = ?seat,
                distance_to_win = analysis.distance_to_win,
                viable_count = analysis.viable_count,
                elapsed_ms = elapsed.as_millis(),
                "On-demand analysis completed"
            );

            self.analysis_cache.insert(seat, analysis);
        }
    }

    /// Check if analysis should be triggered for the given event.
    ///
    /// Trigger conditions depend on the configured analysis mode:
    /// - `OnDemand`: Never trigger automatically (return false)
    /// - `ActivePlayerOnly`: Trigger on TurnChanged, TilesDealt
    /// - `AlwaysOn`: Trigger on TurnChanged, TilesDealt, TileDrawn, TileCalled, TilesPassed, TilesReceived
    fn should_trigger_analysis(&self, event: &GameEvent) -> bool {
        use crate::analysis::AnalysisMode;

        // Check if analysis is globally enabled for this room
        if let Some(rules) = &self.house_rules {
            if !rules.analysis_enabled {
                return false;
            }
        }

        match self.analysis_config.mode {
            AnalysisMode::OnDemand => false,
            AnalysisMode::ActivePlayerOnly => matches!(
                event,
                GameEvent::TurnChanged { .. }
                    | GameEvent::TilesDealt { .. }
                    // Also update when player's hand changes during Charleston
                    | GameEvent::TilesPassed { .. }
                    | GameEvent::TilesReceived { .. }
            ),
            AnalysisMode::AlwaysOn => matches!(
                event,
                GameEvent::TurnChanged { .. }
                    | GameEvent::TilesDealt { .. }
                    | GameEvent::TileDrawn { .. }
                    | GameEvent::TileCalled { .. }
                    | GameEvent::TilesPassed { .. }
                    | GameEvent::TilesReceived { .. }
            ),
        }
    }

    /// Enqueue an analysis request for the background worker.
    fn enqueue_analysis(&self, event: GameEvent) {
        if !self.should_trigger_analysis(&event) {
            return;
        }

        let tx = self.analysis_tx.clone();
        tokio::spawn(async move {
            if let Err(e) = tx.send(AnalysisRequest {
                trigger: AnalysisTrigger::Event(event),
            }).await {
                // This happens during room shutdown, so debug only
                tracing::debug!("Failed to enqueue analysis request: {}", e);
            }
        });
    }

    /// Broadcast an event to appropriate players based on visibility rules.
    ///
    /// Private events (e.g., TileDrawn with tile data) go only to the target player.
    /// Public events (e.g., TileDiscarded) go to all players.
    pub async fn broadcast_event(&mut self, event: GameEvent, delivery: EventDelivery) {
        // Persist event to database first
        if let Some(db) = &self.db {
            let seq = self.event_seq;
            if let Err(e) = db
                .append_event(&self.room_id, seq, &event, delivery, None)
                .await
            {
                tracing::error!("Failed to persist event: {}", e);
            }

            // Snapshot at phase boundaries or periodic interval
            let should_snapshot = matches!(
                event,
                GameEvent::PhaseChanged { .. }
                    | GameEvent::CharlestonComplete
                    | GameEvent::GameOver { .. }
            ) || (seq > 0 && seq % SNAPSHOT_INTERVAL == 0);

            if should_snapshot {
                if let Some(table) = &self.table {
                    // Create full snapshot including all hands
                    let snapshot = table.create_full_snapshot();
                    match serde_json::to_value(&snapshot) {
                        Ok(state) => {
                            if let Err(e) = db.save_snapshot(&self.room_id, seq, &state).await {
                                tracing::error!("Failed to persist snapshot: {}", e);
                            }
                        }
                        Err(e) => {
                            tracing::error!("Failed to serialize snapshot: {}", e);
                        }
                    }
                }
            }
            self.event_seq += 1;
        }

        // Check if this is a game-ending event and persist final state
        if self.is_game_ending_event(&event) {
            self.persist_final_state(&event).await;
        }

        // Broadcast to players based on visibility
        match delivery.visibility {
            EventVisibility::Public => {
                // Broadcast to all players, but check is_for_seat() for pair-scoped events
                for (seat, session) in &self.sessions {
                    // If the event has seat-specific visibility, check it
                    if event.is_for_seat(*seat) {
                        // This event is specifically for this seat (pair-scoped)
                        self.send_to_session(session, event.clone()).await;
                    } else if !matches!(
                        event,
                        GameEvent::CourtesyPassProposed { .. }
                            | GameEvent::CourtesyPassMismatch { .. }
                            | GameEvent::CourtesyPairReady { .. }
                    ) {
                        // Not a pair-scoped event, send to all
                        self.send_to_session(session, event.clone()).await;
                    }
                }
            }
            EventVisibility::Private => {
                // Send only to target player
                if let Some(target_seat) = delivery.target_player {
                    if let Some(session) = self.sessions.get(&target_seat) {
                        self.send_to_session(session, event.clone()).await;
                    }
                }
            }
        }

        // Enqueue analysis instead of running it directly
        self.enqueue_analysis(event);
    }

    // compute_event_delivery moved to visibility.rs

    /// Send an event to a specific session.
    async fn send_to_session(&self, session: &Arc<Mutex<Session>>, event: GameEvent) {
        let envelope = Envelope::event(event);
        if let Ok(json) = envelope.to_json() {
            let msg = Message::Text(json);
            let session = session.lock().await;
            let mut sender = session.ws_sender.lock().await;
            if let Err(e) = sender.send(msg).await {
                tracing::warn!("Failed to send event to player: {}", e);
            }
        }
    }

    /// Check if an event signals the end of the game.
    fn is_game_ending_event(&self, event: &GameEvent) -> bool {
        matches!(event, GameEvent::GameOver { .. })
    }

    /// Persist the final game state when the game ends.
    async fn persist_final_state(&self, event: &GameEvent) {
        if let Some(db) = &self.db {
            if let Some(table) = &self.table {
                // Extract winner information from event
                let (winner_seat, winning_pattern) = match event {
                    GameEvent::GameOver { winner, result } => {
                        (*winner, result.winning_pattern.as_deref())
                    }
                    _ => (None, None),
                };

                let final_state = serde_json::to_value(table).unwrap_or_else(|_| {
                    serde_json::json!({
                        "game_id": table.game_id,
                        "phase": format!("{:?}", table.phase),
                        "current_turn": format!("{:?}", table.current_turn),
                        "dealer": format!("{:?}", table.dealer),
                        "round_number": table.round_number,
                    })
                });

                // Extract ruleset metadata
                let card_year = table.house_rules.ruleset.card_year;
                let timer_mode = format!("{:?}", table.house_rules.ruleset.timer_mode);
                let wall_seed = i64::try_from(table.wall.seed).ok();
                let wall_break_point = i16::try_from(table.wall.break_point).ok();

                if let Err(e) = db
                    .finish_game(
                        &self.room_id,
                        winner_seat,
                        winning_pattern,
                        &final_state,
                        card_year,
                        &timer_mode,
                        wall_seed,
                        wall_break_point,
                    )
                    .await
                {
                    tracing::error!("Failed to persist final game state: {}", e);
                }

                if let Some(GameEvent::GameOver { result, .. }) = Some(event) {
                    if let Err(e) =
                        crate::stats::update_player_stats(db, &self.sessions, result).await
                    {
                        tracing::error!("Failed to update player stats: {}", e);
                    }
                }
            }
        }
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

/// Thread-safe room storage.
///
/// Manages all active rooms with concurrent access.
pub struct RoomStore {
    rooms: DashMap<String, Arc<Mutex<Room>>>,
}

impl RoomStore {
    /// Create a new empty room store.
    pub fn new() -> Self {
        Self {
            rooms: DashMap::new(),
        }
    }

    /// Create a new room with default rules.
    ///
    /// Returns the room_id and room reference.
    pub fn create_room(&self) -> (String, Arc<Mutex<Room>>) {
        let (room, rx) = Room::new();
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());
        
        let weak_room = Arc::downgrade(&room_arc);
        tokio::spawn(analysis_worker(weak_room, rx));
        
        (room_id, room_arc)
    }

    /// Create a new room with database persistence and default rules.
    ///
    /// Returns the room_id and room reference.
    pub fn create_room_with_db(&self, db: Database) -> (String, Arc<Mutex<Room>>) {
        let (room, rx) = Room::new_with_db(db);
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());
        
        let weak_room = Arc::downgrade(&room_arc);
        tokio::spawn(analysis_worker(weak_room, rx));

        (room_id, room_arc)
    }

    /// Create a new room with custom house rules.
    ///
    /// Returns the room_id and room reference.
    pub fn create_room_with_rules(&self, house_rules: HouseRules) -> (String, Arc<Mutex<Room>>) {
        let (room, rx) = Room::new_with_rules(house_rules);
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());
        
        let weak_room = Arc::downgrade(&room_arc);
        tokio::spawn(analysis_worker(weak_room, rx));

        (room_id, room_arc)
    }

    /// Create a room with database and custom rules.
    ///
    /// Returns the room_id and room reference.
    pub fn create_room_with_db_and_rules(
        &self,
        db: Database,
        house_rules: HouseRules,
    ) -> (String, Arc<Mutex<Room>>) {
        let (room, rx) = Room::new_with_db_and_rules(db, house_rules);
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());
        
        let weak_room = Arc::downgrade(&room_arc);
        tokio::spawn(analysis_worker(weak_room, rx));

        (room_id, room_arc)
    }

    /// Get a room by ID.
    pub fn get_room(&self, room_id: &str) -> Option<Arc<Mutex<Room>>> {
        self.rooms.get(room_id).map(|entry| entry.clone())
    }

    /// Remove a room (e.g., when game ends or all players leave).
    pub fn remove_room(&self, room_id: &str) -> bool {
        self.rooms.remove(room_id).is_some()
    }

    /// Get the number of active rooms.
    pub fn room_count(&self) -> usize {
        self.rooms.len()
    }

    /// Get all room IDs (for debugging/admin).
    pub fn list_rooms(&self) -> Vec<String> {
        self.rooms.iter().map(|entry| entry.key().clone()).collect()
    }
}

impl Default for RoomStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Background worker for processing analysis requests.
///
/// This task runs for the lifetime of the room and processes requests sequentially.
async fn analysis_worker(
    weak_room: Weak<Mutex<Room>>,
    mut rx: mpsc::Receiver<AnalysisRequest>,
) {
    use crate::analysis::{AnalysisMode, HandAnalysis};
    use mahjong_ai::context::VisibleTiles;
    use mahjong_ai::evaluation::StrategicEvaluation;
    use std::time::Instant;

    while let Some(_request) = rx.recv().await {
        // Coalesce requests: drain the channel to get to the latest state
        while rx.try_recv().is_ok() {}

        let room_arc = match weak_room.upgrade() {
            Some(arc) => arc,
            None => break, // Room dropped, exit worker
        };
        
        // --- Step 1: Snapshot Phase (Hold lock briefly) ---
        // We clone the data needed for analysis to avoid holding the lock during computation.
        // This is a trade-off: cloning overhead vs locking overhead.
        // For mahjong, the table state is small enough that cloning is preferred.
        let (snapshot, config, hashes, sessions) = {
            let room = room_arc.lock().await;
            
            // If table or validator missing, skip
            if room.table.is_none() || room.table.as_ref().unwrap().validator.is_none() {
                continue;
            }

            let table = room.table.as_ref().unwrap().clone();
            let config = room.analysis_config.clone();
            let hashes = room.analysis_hashes.clone();
            let sessions = room.sessions.clone(); // Clone sessions to send events later
            
            (table, config, hashes, sessions)
        };

        let validator = snapshot.validator.as_ref().unwrap();

        // --- Step 2: Analysis Phase (No lock) ---
        // This is the CPU-intensive part.
        
        let start_total = Instant::now();
        
        // 2a. Build VisibleTiles
        let mut visible = VisibleTiles::new();
        for discarded in &snapshot.discard_pile {
            visible.add_discard(discarded.tile);
        }
        for (seat, player) in &snapshot.players {
            for meld in &player.hand.exposed {
                visible.add_meld(*seat, meld.clone());
            }
        }
        
        let current_visible_hash = AnalysisHashState::compute_visible_hash(
            &snapshot.discard_pile,
            &snapshot.players
        );
        
        // 2b. Determine seats to analyze
        let seats_to_analyze: Vec<Seat> = match config.mode {
            AnalysisMode::ActivePlayerOnly => vec![snapshot.current_turn],
            AnalysisMode::AlwaysOn => Seat::all().to_vec(),
            AnalysisMode::OnDemand => continue,
        };

        let mut results = HashMap::new();
        let mut new_hand_hashes = hashes.hand_hashes.clone();
        
        for seat in seats_to_analyze {
            let player = match snapshot.players.get(&seat) {
                Some(p) => p,
                None => continue,
            };
            
            let hand_hash = AnalysisHashState::compute_hand_hash(&player.hand);
            
            // Dirty check: skip if neither hand nor visible context changed
            // We check visible hash because opponent discards/melds change probabilities
            // even if my hand is same.
            let cached_hand_hash = hashes.hand_hashes.get(&seat).copied().unwrap_or(0);
            
            if hand_hash == cached_hand_hash && current_visible_hash == hashes.visible_hash {
                continue; // Skip analysis
            }
            
            // Perform Analysis with Timeout
            let analysis_future = async {
                let start_seat = Instant::now();
                let analysis_results = validator.analyze(&player.hand, config.max_patterns);
                
                let evaluations: Vec<StrategicEvaluation> = analysis_results
                    .into_iter()
                    .filter_map(|result| {
                        let target_histogram =
                            validator.histogram_for_variation(&result.variation_id)?;
                        Some(StrategicEvaluation::from_analysis(
                            result,
                            &player.hand,
                            &visible,
                            target_histogram,
                        ))
                    })
                    .collect();

                let analysis = HandAnalysis::from_evaluations(evaluations);
                let elapsed = start_seat.elapsed();
                
                // Warn on timeout if env var set
                let timeout_ms = config.timeout_ms as u128;
                if std::env::var("ANALYSIS_WARN_TIMEOUT").ok().as_deref() == Some("1") 
                   && elapsed.as_millis() > timeout_ms {
                    tracing::warn!(
                        seat = ?seat,
                        elapsed_ms = elapsed.as_millis(),
                        timeout_ms = timeout_ms,
                        "Analysis exceeded timeout budget"
                    );
                }
                
                (seat, analysis, hand_hash)
            };
            
            // Wrap in tokio timeout
            match tokio::time::timeout(
                std::time::Duration::from_millis(config.timeout_ms),
                analysis_future
            ).await {
                Ok((seat, analysis, hash)) => {
                    results.insert(seat, analysis);
                    new_hand_hashes.insert(seat, hash);
                }
                Err(_) => {
                    // Timeout: do nothing (stale cache will persist)
                    if std::env::var("ANALYSIS_WARN_TIMEOUT").ok().as_deref() == Some("1") {
                         tracing::warn!(seat = ?seat, "Analysis timed out (aborted)");
                    }
                }
            }
        }
        
        if results.is_empty() {
             // Update visible hash even if no seats analyzed?
             // Yes, to prevent re-checking visible hash match next time.
             // But if we skipped analysis because hash matched, we don't need to update.
             // If we skipped because of timeout, we shouldn't update hash? 
             // If timeout, we want to try again next time? Or back off?
             // Plan says "On timeout: Keep stale cache, emit no update."
             // So we don't update hash if timeout.
             // But here we might have mixed results.
             
             // If we have no results, we still might need to update visible hash in room 
             // IF we skipped everyone due to hash match.
             // But if hash matched, we didn't calculate.
             // If hashes DID NOT match, but we produced no results (all timeouts?), 
             // then we shouldn't update visible hash in room?
             
             // Actually, if we skipped due to hash match, `results` is empty.
             // We should update `analysis_hashes` in Room to match `current_visible_hash` 
             // ONLY if we successfully processed the changes.
             // But if we skipped, it means Room already has correct hashes?
             // No, `current_visible_hash` is computed from snapshot.
             // `hashes.visible_hash` is from Room.
             // If `current != hashes`, and we skipped because `hand` match?
             // Wait, logic was: `if hand_hash == cached && current_visible == cached_visible { continue }`.
             // So if `current_visible != cached_visible`, we DO NOT continue.
             // So we run analysis.
             // If analysis succeeds, we add to `results`.
             // If results is empty, it means either:
             // 1. No seats needed analysis (ActivePlayerOnly and not active)
             // 2. All timeouts.
             
             // If 1, we should update visible hash in room so we don't keep checking.
        }

        // --- Step 3: Update Phase (Lock Room) ---
        {
            let mut room = room_arc.lock().await;
            
            // Update hashes
            room.analysis_hashes.visible_hash = current_visible_hash;
            room.analysis_hashes.hand_hashes = new_hand_hashes;
            
            // Update cache and emit events
            for (seat, analysis) in results {
                 let should_emit = match room.analysis_cache.get(&seat) {
                    Some(old_analysis) => analysis.has_significant_change(old_analysis),
                    None => true,
                };

                room.analysis_cache.insert(seat, analysis.clone());

                if should_emit {
                    if let Some(session_arc) = sessions.get(&seat) {
                        let event = GameEvent::HandAnalysisUpdated {
                            distance_to_win: analysis.distance_to_win,
                            viable_count: analysis.viable_count,
                            impossible_count: analysis.impossible_count,
                        };
                        
                        // Helper to send (duplicate logic from Room but Room is locked)
                        // We can't call room.send_to_session because it locks room?
                        // No, room.send_to_session takes `&self` and locks `Session`. 
                        // It does NOT lock Room.
                        // However, we hold `room` lock (MutexGuard).
                        // Calling `room.send_to_session` is fine.
                        // But `send_to_session` is async.
                        // Calling async method while holding lock is okay as long as `send_to_session` doesn't lock Room.
                        // `send_to_session` locks Session and Session.ws_sender. Safe.
                        
                        room.send_to_session(session_arc, event).await;
                    }
                }
            }
        }
        
        let elapsed_total = start_total.elapsed();
        if elapsed_total.as_millis() > 10 {
             tracing::debug!(
                elapsed_ms = elapsed_total.as_millis(),
                "Analysis worker pass complete"
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_room_creation() {
        let (room, _) = Room::new();
        assert!(!room.room_id.is_empty());
        assert_eq!(room.player_count(), 0);
        assert!(!room.is_full());
        assert!(!room.all_seats_filled());
        assert!(!room.game_started);
    }

    #[test]
    fn test_find_available_seat() {
        let (room, _) = Room::new();

        // All seats should be available initially
        assert_eq!(room.find_available_seat(), Some(Seat::East));
    }

    #[test]
    fn test_room_capacity() {
        let (room, _) = Room::new();

        // Empty room is not full
        assert!(!room.is_full());
        assert!(!room.all_seats_filled());
        assert_eq!(room.player_count(), 0);
    }

    #[tokio::test]
    async fn test_room_store() {
        let store = RoomStore::new();
        assert_eq!(store.room_count(), 0);

        let (room_id, _room) = store.create_room();
        assert_eq!(store.room_count(), 1);

        let retrieved = store.get_room(&room_id);
        assert!(retrieved.is_some());

        let removed = store.remove_room(&room_id);
        assert!(removed);
        assert_eq!(store.room_count(), 0);
    }

    #[tokio::test]
    async fn test_list_rooms() {
        let store = RoomStore::new();
        let (room_id1, _) = store.create_room();
        let (room_id2, _) = store.create_room();

        let rooms = store.list_rooms();
        assert_eq!(rooms.len(), 2);
        assert!(rooms.contains(&room_id1));
        assert!(rooms.contains(&room_id2));
    }

    #[test]
    fn test_room_with_id() {
        let custom_id = "test-room-123".to_string();
        let (room, _) = Room::with_id(custom_id.clone());
        assert_eq!(room.room_id, custom_id);
        assert_eq!(room.player_count(), 0);
    }

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

    #[test]
    fn test_room_creation_with_custom_rules() {
        let house_rules = HouseRules::with_card_year(2020);
        let (room, _) = Room::new_with_rules(house_rules);

        assert_eq!(room.house_rules.unwrap().ruleset.card_year, 2020);
    }

    #[tokio::test]
    async fn test_room_store_create_with_rules() {
        let store = RoomStore::new();
        let house_rules = HouseRules::with_card_year(2024);
        let (room_id, room_arc) = store.create_room_with_rules(house_rules);

        let room = room_arc.lock().await;
        assert_eq!(room.house_rules.as_ref().unwrap().ruleset.card_year, 2024);
        drop(room);

        // Verify we can retrieve it
        let retrieved = store.get_room(&room_id);
        assert!(retrieved.is_some());
    }
}
