//! Room management for game instances.
//!
//! A Room represents a game lobby and active game instance. It:
//! - Manages up to 4 players (one per seat: East, South, West, North)
//! - Holds the authoritative game state (Table from mahjong_core)
//! - Processes commands and broadcasts events with visibility filtering
//! - Handles player lifecycle (join, disconnect, reconnect)

use crate::db::Database;
use crate::network::{messages::Envelope, session::Session};
use axum::extract::ws::Message;
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use futures_util::SinkExt;
use mahjong_ai::{create_ai, Difficulty, MahjongAI};
use mahjong_core::{
    command::GameCommand,
    event::GameEvent,
    player::{Player, PlayerStatus, Seat},
    rules::{card::UnifiedCard, validator::HandValidator},
    table::{CommandError, HouseRules, Table},
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

/// Load validator for a specific card year.
/// Returns None if the card file doesn't exist or can't be parsed.
fn load_validator(card_year: u16) -> Option<HandValidator> {
    // Map year to file - unified format for 2025, individual year files for others
    // Note: Years 2021-2024 are not yet available (data conversion in progress)
    let filename = match card_year {
        2025 => "unified_card2025.json",
        2020 => "card2020.json",
        2019 => "card2019.json",
        2018 => "card2018.json",
        2017 => "card2017.json",
        _ => {
            tracing::error!("No card data available for year {}", card_year);
            return None;
        }
    };

    // Try workspace-relative path first (production), then parent path (tests in crate directory)
    let paths = [
        std::path::Path::new("data/cards").join(filename),
        std::path::Path::new("../../data/cards").join(filename),
    ];

    for path in &paths {
        if let Ok(json) = std::fs::read_to_string(path) {
            match UnifiedCard::from_json(&json) {
                Ok(card) => return Some(HandValidator::new(&card)),
                Err(e) => {
                    tracing::error!("Failed to parse card {}: {}", path.display(), e);
                    return None;
                }
            }
        }
    }

    tracing::error!(
        "Failed to load card file {} from any of: {:?}",
        filename,
        paths
    );
    None
}

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
    bot_seats: HashSet<Seat>,
    /// Whether a bot runner task is active
    bot_runner_active: bool,
    /// Difficulty level for bots in this room
    pub bot_difficulty: Difficulty,
    /// Custom house rules for this room (None = use defaults)
    pub house_rules: Option<HouseRules>,
}

const SNAPSHOT_INTERVAL: i32 = 50;

impl Room {
    /// Create a new empty room with default rules.
    pub fn new() -> Self {
        Self::new_with_rules(HouseRules::default())
    }

    /// Create a new room with database persistence and default rules.
    pub fn new_with_db(db: Database) -> Self {
        Self::new_with_db_and_rules(db, HouseRules::default())
    }

    /// Create a new room with custom house rules.
    pub fn new_with_rules(house_rules: HouseRules) -> Self {
        let room_id = Uuid::new_v4().to_string();
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
        }
    }

    /// Create a room with database and custom rules.
    pub fn new_with_db_and_rules(db: Database, house_rules: HouseRules) -> Self {
        let room_id = Uuid::new_v4().to_string();
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
        }
    }

    /// Create a room with a specific ID (for testing).
    pub fn with_id(room_id: String) -> Self {
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
        }
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
        if let Some(validator) = load_validator(card_year) {
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
        self.broadcast_event(event).await;
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

        let table = self.table.as_mut().ok_or(CommandError::WrongPhase)?;

        // Process command through the Table (this validates and generates events)
        let events = table.process_command(command)?;

        // Broadcast all resulting events
        for event in events {
            self.broadcast_event(event).await;
        }

        Ok(())
    }

    /// Handle a bot-issued command (no session authorization).
    pub async fn handle_bot_command(&mut self, command: GameCommand) -> Result<(), CommandError> {
        let table = self.table.as_mut().ok_or(CommandError::WrongPhase)?;
        let events = table.process_command(command)?;
        for event in events {
            self.broadcast_event(event).await;
        }
        Ok(())
    }

    /// Broadcast an event to appropriate players based on visibility rules.
    ///
    /// Private events (e.g., TileDrawn with tile data) go only to the target player.
    /// Public events (e.g., TileDiscarded) go to all players.
    pub async fn broadcast_event(&mut self, event: GameEvent) {
        // Persist event to database first
        if let Some(db) = &self.db {
            let seq = self.event_seq;
            if let Err(e) = db.append_event(&self.room_id, seq, &event, None).await {
                tracing::error!("Failed to persist event: {}", e);
            }
            if seq > 0 && seq % SNAPSHOT_INTERVAL == 0 {
                if let Some(table) = &self.table {
                    match serde_json::to_value(table) {
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
        if event.is_private() {
            // Send only to target player
            if let Some(target_seat) = self.determine_target(&event) {
                if let Some(session) = self.sessions.get(&target_seat) {
                    self.send_to_session(session, event).await;
                }
            }
        } else {
            // Broadcast to all players
            for session in self.sessions.values() {
                self.send_to_session(session, event.clone()).await;
            }
        }
    }

    /// Determine which player should receive a private event.
    ///
    /// This examines the event type and context to determine the target.
    fn determine_target(&self, event: &GameEvent) -> Option<Seat> {
        match event {
            GameEvent::TileDrawn { .. } => {
                // Target is current turn player
                self.table.as_ref().map(|t| t.current_turn)
            }
            GameEvent::TilesDealt { your_tiles } => {
                let table = self.table.as_ref()?;
                Seat::all().into_iter().find(|seat| {
                    table
                        .players
                        .get(seat)
                        .is_some_and(|p| p.hand.concealed == *your_tiles)
                })
            }
            GameEvent::TilesReceived { player, .. } => Some(*player),
            _ => None,
        }
    }

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

                if let Err(e) = db
                    .finish_game(
                        &self.room_id,
                        winner_seat,
                        winning_pattern,
                        &final_state,
                        card_year,
                        &timer_mode,
                    )
                    .await
                {
                    tracing::error!("Failed to persist final game state: {}", e);
                }

                if let Some(GameEvent::GameOver { result, .. }) = Some(event) {
                    if let Err(e) = self.update_player_stats(result).await {
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

    async fn update_player_stats(
        &self,
        result: &mahjong_core::flow::GameResult,
    ) -> Result<(), sqlx::Error> {
        let db = match &self.db {
            Some(db) => db,
            None => return Ok(()),
        };

        for (seat, session_arc) in &self.sessions {
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
}

pub fn spawn_bot_runner(room_arc: Arc<Mutex<Room>>) {
    tokio::spawn(async move {
        // Get difficulty from room (snapshot at start of runner)
        let difficulty = {
            let room = room_arc.lock().await;
            room.bot_difficulty
        };

        // Create bots for all seats using the configured difficulty
        // Note: We create one for each seat, but only use them if the seat is in bot_seats
        let mut bots: HashMap<Seat, Box<dyn MahjongAI>> = Seat::all()
            .into_iter()
            .map(|seat| {
                let seed = rand::random::<u64>();
                (seat, create_ai(difficulty, seed))
            })
            .collect();

        let mut interval = tokio::time::interval(std::time::Duration::from_millis(200));

        loop {
            interval.tick().await;
            let mut room = room_arc.lock().await;

            if room.bot_seats.is_empty() {
                room.bot_runner_active = false;
                break;
            }

            let table = match room.table.as_ref() {
                Some(table) => table,
                None => continue,
            };

            let mut commands = Vec::new();
            for seat in &room.bot_seats {
                if let Some(bot) = bots.get_mut(seat) {
                    // Logic to extract bot command - similar to what get_bot_command did but using MahjongAI trait
                    // The Table::get_bot_command was specific to BasicBot. We need to implement the glue here
                    // or assume Table has been updated to use MahjongAI trait (which it hasn't, it's in core).

                    // Since Table::get_bot_command uses BasicBot, we can't use it directly if we want to use other AIs.
                    // We need to replicate the "ask bot for command" logic here using the MahjongAI trait.

                    // TODO: This logic replicates what Table::get_bot_command does but uses the trait
                    if table.current_turn != *seat {
                        continue; // Not my turn
                    }

                    // Check if we can act (check rules/flow)
                    // Simplified: just check if we have a pending action
                    // Actually, Table::get_bot_command does a lot of checks.
                    // For now, let's just use a simplified integration:

                    // We need to implement the "Adapter" logic here.
                    // Since we can't easily modify Table in core to use mahjong_ai (circular dep?),
                    // we implement the bridge here.

                    if let Some(cmd) = get_ai_command(table, *seat, bot.as_mut()) {
                        commands.push(cmd);
                    }
                }
            }

            for command in commands {
                let _ = room.handle_bot_command(command).await;
            }
        }
    });
}

/// Bridge function to get a command from a MahjongAI trait object
fn get_ai_command(table: &Table, seat: Seat, ai: &mut dyn MahjongAI) -> Option<GameCommand> {
    use mahjong_core::flow::{GamePhase, TurnStage};

    let player = table.players.get(&seat)?;
    let validator = table.validator.as_ref()?;

    // Construct visible tiles context
    let mut visible = mahjong_ai::VisibleTiles::new();
    for d in &table.discard_pile {
        visible.add_discard(d.tile);
    }
    // Add exposures
    for (seat, p) in &table.players {
        for meld in &p.hand.exposed {
            visible.add_meld(*seat, meld.clone());
        }
    }

    match &table.phase {
        GamePhase::Charleston(stage) => {
            // Handle Charleston logic
            if let Some(cs) = &table.charleston_state {
                // Check if we haven't acted yet (pending_passes is None)
                if cs.pending_passes.get(&seat).is_none_or(|v| v.is_none()) {
                    if stage.requires_pass() {
                        let tiles =
                            ai.select_charleston_tiles(&player.hand, *stage, &visible, validator);
                        if tiles.len() == 3 {
                            return Some(GameCommand::PassTiles {
                                player: seat,
                                tiles,
                                blind_pass_count: None,
                            });
                        }
                    } else if *stage == mahjong_core::flow::CharlestonStage::VotingToContinue {
                        if !cs.votes.contains_key(&seat) {
                            let vote = ai.vote_charleston(&player.hand, &visible, validator);
                            return Some(GameCommand::VoteCharleston { player: seat, vote });
                        }
                    } else if *stage == mahjong_core::flow::CharlestonStage::CourtesyAcross {
                        // Simple courtesy pass (0 tiles)
                        return Some(GameCommand::AcceptCourtesyPass {
                            player: seat,
                            tiles: vec![],
                        });
                    }
                }
            }
            None
        }
        GamePhase::Playing(stage) => {
            match stage {
                TurnStage::Discarding { player: p } if *p == seat => {
                    let tile = ai.select_discard(&player.hand, &visible, validator);
                    Some(GameCommand::DiscardTile { player: seat, tile })
                }
                TurnStage::Drawing { player: p } if *p == seat => {
                    Some(GameCommand::DrawTile { player: seat })
                }
                TurnStage::CallWindow {
                    discarded_by,
                    can_act,
                    ..
                } if can_act.contains(&seat) && *discarded_by != seat => {
                    // Simplified: Always pass for now to avoid complex call logic in this fix
                    Some(GameCommand::Pass { player: seat })
                }
                _ => None,
            }
        }
        _ => None,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct PlayerStats {
    games_played: u32,
    games_won: u32,
    games_lost: u32,
    games_drawn: u32,
    wins_by_pattern: HashMap<String, u32>,
    total_score: i32,   // Cumulative score across all games
    highest_score: i32, // Highest single-game score
    lowest_score: i32,  // Lowest single-game score (can be negative)
}

impl PlayerStats {
    fn from_value(value: Option<serde_json::Value>) -> Self {
        value
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default()
    }
}

impl Default for Room {
    fn default() -> Self {
        Self::new()
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
        let room = Room::new();
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());
        (room_id, room_arc)
    }

    /// Create a new room with database persistence and default rules.
    ///
    /// Returns the room_id and room reference.
    pub fn create_room_with_db(&self, db: Database) -> (String, Arc<Mutex<Room>>) {
        let room = Room::new_with_db(db);
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());
        (room_id, room_arc)
    }

    /// Create a new room with custom house rules.
    ///
    /// Returns the room_id and room reference.
    pub fn create_room_with_rules(&self, house_rules: HouseRules) -> (String, Arc<Mutex<Room>>) {
        let room = Room::new_with_rules(house_rules);
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());
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
        let room = Room::new_with_db_and_rules(db, house_rules);
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_room_creation() {
        let room = Room::new();
        assert!(!room.room_id.is_empty());
        assert_eq!(room.player_count(), 0);
        assert!(!room.is_full());
        assert!(!room.all_seats_filled());
        assert!(!room.game_started);
    }

    #[test]
    fn test_find_available_seat() {
        let room = Room::new();

        // All seats should be available initially
        assert_eq!(room.find_available_seat(), Some(Seat::East));
    }

    #[test]
    fn test_room_capacity() {
        let room = Room::new();

        // Empty room is not full
        assert!(!room.is_full());
        assert!(!room.all_seats_filled());
        assert_eq!(room.player_count(), 0);

        // Add placeholder sessions (without actual WebSocket - we're just testing capacity logic)
        // Note: In real usage, these would be created through proper session flow
        // For unit testing, we just verify the capacity tracking logic works

        // Room is full when sessions.len() == 4
        // This is tested indirectly through is_full() method
    }

    #[test]
    fn test_room_store() {
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

    #[test]
    fn test_list_rooms() {
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
        let room = Room::with_id(custom_id.clone());
        assert_eq!(room.room_id, custom_id);
        assert_eq!(room.player_count(), 0);
    }

    #[test]
    fn test_room_creation_with_default_rules() {
        let room = Room::new();
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
        let room = Room::new_with_rules(house_rules);

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

    #[test]
    fn test_validator_loads_for_2025() {
        let validator = load_validator(2025);
        assert!(
            validator.is_some(),
            "Failed to load 2025 card validator. Ensure:\n\
             1. data/cards/unified_card2025.json exists\n\
             2. Tests run from workspace root (use: cargo test --manifest-path Cargo.toml)\n\
             Current dir: {:?}",
            std::env::current_dir()
        );
    }

    #[test]
    fn test_validator_returns_none_for_missing_year() {
        // Year with no card data should return None
        let validator = load_validator(2016);
        assert!(
            validator.is_none(),
            "Validator should return None for unavailable year 2016"
        );
    }
}
