//! Session management for a room.
//!
//! Tracks active player sessions, bot seats, and host designation.

use crate::network::session::Session;
use mahjong_ai::Difficulty;
use mahjong_core::player::Seat;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Manages player sessions, bot seats, and host assignment.
#[derive(Debug, Clone)]
pub struct SessionManager {
    /// Players by seat (up to 4)
    sessions: HashMap<Seat, Arc<Mutex<Session>>>,
    /// Seats controlled by bots (for takeover)
    bot_seats: HashSet<Seat>,
    /// Difficulty level for bots in this room
    bot_difficulty: Difficulty,
    /// Whether a bot runner task is active
    bot_runner_active: bool,
    /// The seat designated as the room host (can pause/resume)
    host_seat: Option<Seat>,
}

impl SessionManager {
    /// Create a new session manager.
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            bot_seats: HashSet::new(),
            bot_difficulty: Difficulty::Easy,
            bot_runner_active: false,
            host_seat: None,
        }
    }

    /// Add a player session to a specific seat.
    ///
    /// Returns the seat assigned, or an error if the seat is already occupied.
    pub fn join(&mut self, seat: Seat, session: Arc<Mutex<Session>>) -> Result<Seat, String> {
        if self.sessions.contains_key(&seat) {
            return Err(format!("Seat {:?} is already occupied", seat));
        }
        self.sessions.insert(seat, session);

        // Set host to first player who joins
        if self.host_seat.is_none() {
            self.host_seat = Some(seat);
        }

        Ok(seat)
    }

    /// Remove a player session from a seat.
    ///
    /// Returns `true` if a session was removed, `false` if the seat was empty.
    pub fn remove(&mut self, seat: Seat) -> bool {
        let removed = self.sessions.remove(&seat).is_some();

        // If host left, assign to another player
        if self.host_seat == Some(seat) {
            self.host_seat = self.sessions.keys().next().copied();
        }

        removed
    }

    /// Get a reference to a player's session.
    pub fn get_session(&self, seat: Seat) -> Option<Arc<Mutex<Session>>> {
        self.sessions.get(&seat).cloned()
    }

    /// Get a reference to a player's session (alias for compatibility).
    pub fn get(&self, seat: &Seat) -> Option<&Arc<Mutex<Session>>> {
        self.sessions.get(seat)
    }

    /// Set the host seat.
    pub fn set_host(&mut self, seat: Seat) {
        self.host_seat = Some(seat);
    }

    /// Get the current host seat.
    pub fn get_host(&self) -> Option<Seat> {
        self.host_seat
    }

    /// Mark a seat as bot-controlled.
    pub fn add_bot(&mut self, seat: Seat) {
        self.bot_seats.insert(seat);
    }

    /// Remove bot control from a seat.
    pub fn remove_bot(&mut self, seat: Seat) {
        self.bot_seats.remove(&seat);
    }

    /// Check if a seat is controlled by a bot.
    pub fn is_bot(&self, seat: Seat) -> bool {
        self.bot_seats.contains(&seat)
    }

    /// Get all bot seats.
    pub fn bot_seats(&self) -> &HashSet<Seat> {
        &self.bot_seats
    }

    /// Set the bot difficulty level.
    pub fn set_bot_difficulty(&mut self, difficulty: Difficulty) {
        self.bot_difficulty = difficulty;
    }

    /// Get the current bot difficulty level.
    pub fn bot_difficulty(&self) -> Difficulty {
        self.bot_difficulty
    }

    /// Set whether the bot runner is active.
    pub fn set_bot_runner_active(&mut self, active: bool) {
        self.bot_runner_active = active;
    }

    /// Check if the bot runner is active.
    pub fn is_bot_runner_active(&self) -> bool {
        self.bot_runner_active
    }

    /// Iterate over all sessions.
    pub fn sessions_iter(&self) -> impl Iterator<Item = (&Seat, &Arc<Mutex<Session>>)> {
        self.sessions.iter()
    }

    /// Get the number of players currently in the room.
    pub fn player_count(&self) -> usize {
        self.sessions.len()
    }

    /// Check if the room is full (4 players).
    pub fn is_full(&self) -> bool {
        self.sessions.len() == 4
    }

    /// Check if a seat is occupied.
    pub fn is_occupied(&self, seat: Seat) -> bool {
        self.sessions.contains_key(&seat)
    }

    /// Get an iterator over all seat keys.
    pub fn keys(&self) -> impl Iterator<Item = &Seat> {
        self.sessions.keys()
    }

    /// Get an iterator over all session values.
    pub fn values(&self) -> impl Iterator<Item = &Arc<Mutex<Session>>> {
        self.sessions.values()
    }

    /// Get a reference to the underlying sessions map.
    pub fn sessions(&self) -> &HashMap<Seat, Arc<Mutex<Session>>> {
        &self.sessions
    }

    /// Get the number of sessions (compatibility method).
    pub fn len(&self) -> usize {
        self.sessions.len()
    }

    /// Check if there are no sessions.
    pub fn is_empty(&self) -> bool {
        self.sessions.is_empty()
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}
