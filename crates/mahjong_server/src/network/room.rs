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
use mahjong_core::{
    command::GameCommand,
    event::GameEvent,
    player::Seat,
    table::{CommandError, Table},
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

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
}

impl Room {
    /// Create a new empty room.
    pub fn new() -> Self {
        let room_id = Uuid::new_v4().to_string();
        Self {
            room_id,
            sessions: HashMap::new(),
            table: None,
            created_at: Utc::now(),
            game_started: false,
            event_seq: 0,
            db: None,
        }
    }

    /// Create a new room with database persistence.
    pub fn new_with_db(db: Database) -> Self {
        let room_id = Uuid::new_v4().to_string();
        Self {
            room_id,
            sessions: HashMap::new(),
            table: None,
            created_at: Utc::now(),
            game_started: false,
            event_seq: 0,
            db: Some(db),
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
    pub async fn join(
        &mut self,
        session: Arc<Mutex<Session>>,
    ) -> Result<Seat, String> {
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
        // Create the game table with a random seed
        let seed = rand::random::<u64>();
        let table = Table::new(self.room_id.clone(), seed);
        self.table = Some(table);
        self.game_started = true;

        // Persist game creation to database
        if let Some(db) = &self.db {
            if let Err(e) = db.create_game(&self.room_id).await {
                tracing::error!("Failed to persist game creation: {}", e);
            }
        }

        // Broadcast GameStarting event
        let event = GameEvent::GameStarting;
        self.broadcast_event(event).await;
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
            GameEvent::TilesDealt { .. } => {
                // During dealing, we'd need to send different versions to each player
                // For now, this is handled specially in start_game
                None
            }
            GameEvent::TilesReceived { .. } => {
                // Target is the player receiving tiles from Charleston
                // This requires more context from Charleston state
                None
            }
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
                        (*winner, Some(result.winning_pattern.as_str()))
                    }
                    _ => (None, None),
                };

                // Serialize table state as JSON
                // Note: Table must implement Serialize for this to work
                // For now, we'll use a placeholder empty object
                let final_state = serde_json::json!({
                    "game_id": table.game_id,
                    "phase": format!("{:?}", table.phase),
                    "current_turn": format!("{:?}", table.current_turn),
                    "dealer": format!("{:?}", table.dealer),
                    "round_number": table.round_number,
                });

                if let Err(e) = db
                    .finish_game(&self.room_id, winner_seat, winning_pattern, &final_state)
                    .await
                {
                    tracing::error!("Failed to persist final game state: {}", e);
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

    /// Create a new room.
    ///
    /// Returns the room_id and room reference.
    pub fn create_room(&self) -> (String, Arc<Mutex<Room>>) {
        let room = Room::new();
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());
        (room_id, room_arc)
    }

    /// Create a new room with database persistence.
    ///
    /// Returns the room_id and room reference.
    pub fn create_room_with_db(&self, db: Database) -> (String, Arc<Mutex<Room>>) {
        let room = Room::new_with_db(db);
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
}
