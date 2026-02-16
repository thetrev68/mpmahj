//! History and replay management for a room.
//!
//! Tracks move history, undo requests, and pause/resume state.
//!
//! # Architecture
//!
//! `HistoryManager` is one of three composition members in [`Room`](super::Room). It provides:
//! - **Move history**: Append-only log of player actions (discard, call, meld, etc.)
//! - **Undo/redo**: Smart undo with voting (multiplayer) or immediate execution (solo)
//! - **Pause state**: Tracks whether the game is paused and which player paused it
//! - **Replay support**: Records past states and move numbers for replay reconstruction
//!
//! # State Machine: History vs Present
//!
//! - **Present state** (`present_state`): The current live game state
//! - **History viewing**: When rewinding (undo), save present to backup and load a past state
//! - **Move number**: Increments with each history entry (move 0, 1, 2...)
//!
//! In solo play, undo immediately mutates the present state. In multiplayer, `undo_request`
//! collects votes until a threshold is met, then the present is restored from backup.
//!
//! # Meld Call Tracking
//!
//! - `last_call_resolution`: Used to determine if a meld call was contested (affects scoring)
//! - `last_called_tile`: The tile that triggered the call (needed for history entry)

use mahjong_core::{
    call_resolution::CallResolution,
    history::{HistoryMode, MoveHistoryEntry},
    player::Seat,
    table::Table,
    tile::Tile,
};
use std::collections::HashMap;
use std::time::Instant;

/// Maximum number of move history entries retained per game.
pub const MAX_HISTORY_ENTRIES: usize = 500;

/// State for a pending undo request.
///
/// Represents an active "Smart Undo" request that requires voting in multiplayer games.
/// In solo play, the undo is executed immediately without this state.
#[derive(Debug, Clone)]
pub struct UndoRequest {
    /// The player who requested the undo.
    pub requester: Seat,
    /// The move number to revert to.
    pub target_move: u32,
    /// Votes received from other players (True = Approve, False = Deny).
    pub votes: HashMap<Seat, bool>,
    /// When the request was created (for timeout).
    pub created_at: Instant,
}

/// Manages game history, undo/redo, and pause state.
#[derive(Debug)]
pub struct HistoryManager {
    /// Complete move history (append-only until game ends)
    history: Vec<MoveHistoryEntry>,
    /// Current history viewing mode
    mode: HistoryMode,
    /// Current move number (increments with each history entry)
    move_number: u32,
    /// Backup of "present" state when viewing history
    present_state: Option<Box<Table>>,
    /// Active undo request pending voting
    undo_request: Option<UndoRequest>,
    /// Last call resolution (used to determine if meld call was contested)
    last_call_resolution: Option<CallResolution>,
    /// Last called tile (from call window, used for MahjongByCall history entry)
    last_called_tile: Option<Tile>,
    /// Whether the game is currently paused
    paused: bool,
    /// The seat that paused the game (host)
    paused_by: Option<Seat>,
}

impl HistoryManager {
    /// Create a new history manager.
    pub fn new() -> Self {
        Self {
            history: Vec::new(),
            mode: HistoryMode::None,
            move_number: 0,
            present_state: None,
            undo_request: None,
            last_call_resolution: None,
            last_called_tile: None,
            paused: false,
            paused_by: None,
        }
    }

    /// Add an entry to the move history.
    pub fn add_entry(&mut self, entry: MoveHistoryEntry) {
        self.history.push(entry);
        if self.history.len() > MAX_HISTORY_ENTRIES {
            self.history.remove(0);
        }
        self.move_number += 1;
    }

    /// Get the complete move history.
    pub fn get_history(&self) -> &[MoveHistoryEntry] {
        &self.history
    }

    /// Get the number of history entries.
    pub fn len(&self) -> usize {
        self.history.len()
    }

    /// Check if the history is empty.
    pub fn is_empty(&self) -> bool {
        self.history.is_empty()
    }

    /// Set the active undo request.
    pub fn set_undo_request(&mut self, req: UndoRequest) {
        self.undo_request = Some(req);
    }

    /// Get the active undo request.
    pub fn get_undo_request(&self) -> Option<&UndoRequest> {
        self.undo_request.as_ref()
    }

    /// Get a mutable reference to the active undo request.
    pub fn get_undo_request_mut(&mut self) -> Option<&mut UndoRequest> {
        self.undo_request.as_mut()
    }

    /// Clear the active undo request.
    pub fn clear_undo_request(&mut self) {
        self.undo_request = None;
    }

    /// Set the paused state.
    pub fn set_paused(&mut self, paused: bool, by: Option<Seat>) {
        self.paused = paused;
        self.paused_by = by;
    }

    /// Check if the game is paused.
    pub fn is_paused(&self) -> bool {
        self.paused
    }

    /// Get the seat that paused the game.
    pub fn get_paused_by(&self) -> Option<Seat> {
        self.paused_by
    }

    /// Set the history viewing mode.
    pub fn set_history_mode(&mut self, mode: HistoryMode) {
        self.mode = mode;
    }

    /// Get the current history viewing mode.
    pub fn get_history_mode(&self) -> HistoryMode {
        self.mode
    }

    /// Get the current move number.
    pub fn get_move_number(&self) -> u32 {
        self.move_number
    }

    /// Set the move number.
    pub fn set_move_number(&mut self, number: u32) {
        self.move_number = number;
    }

    /// Set the present state backup.
    pub fn set_present_state(&mut self, state: Box<Table>) {
        self.present_state = Some(state);
    }

    /// Get the present state backup.
    pub fn get_present_state(&self) -> Option<&Table> {
        self.present_state.as_deref()
    }

    /// Take the present state backup (consumes it).
    pub fn take_present_state(&mut self) -> Option<Box<Table>> {
        self.present_state.take()
    }

    /// Set the last call resolution.
    pub fn set_last_call_resolution(&mut self, resolution: CallResolution) {
        self.last_call_resolution = Some(resolution);
    }

    /// Get the last call resolution.
    pub fn get_last_call_resolution(&self) -> Option<&CallResolution> {
        self.last_call_resolution.as_ref()
    }

    /// Clear the last call resolution.
    pub fn clear_last_call_resolution(&mut self) {
        self.last_call_resolution = None;
    }

    /// Set the last called tile.
    pub fn set_last_called_tile(&mut self, tile: Tile) {
        self.last_called_tile = Some(tile);
    }

    /// Get the last called tile.
    pub fn get_last_called_tile(&self) -> Option<Tile> {
        self.last_called_tile
    }

    /// Clear the last called tile.
    pub fn clear_last_called_tile(&mut self) {
        self.last_called_tile = None;
    }

    /// Clear all history.
    pub fn clear(&mut self) {
        self.history.clear();
        self.mode = HistoryMode::None;
        self.move_number = 0;
        self.present_state = None;
        self.undo_request = None;
        self.last_call_resolution = None;
        self.last_called_tile = None;
        self.paused = false;
        self.paused_by = None;
    }

    /// Get an entry at a specific index.
    pub fn get(&self, index: usize) -> Option<&MoveHistoryEntry> {
        self.history.get(index)
    }

    /// Get an entry by stable move number.
    pub fn get_by_move_number(&self, move_number: u32) -> Option<&MoveHistoryEntry> {
        self.history
            .iter()
            .find(|entry| entry.move_number == move_number)
    }

    /// Truncate history to a specific length.
    pub fn truncate(&mut self, len: usize) {
        self.history.truncate(len);
    }

    /// Truncate history to keep entries from start through a move number (inclusive).
    /// Returns true if move number was found and truncation occurred.
    pub fn truncate_through_move_number(&mut self, move_number: u32) -> bool {
        if let Some(index) = self
            .history
            .iter()
            .position(|entry| entry.move_number == move_number)
        {
            self.history.truncate(index + 1);
            true
        } else {
            false
        }
    }

    /// Get an iterator over history entries.
    pub fn iter(&self) -> impl Iterator<Item = &MoveHistoryEntry> {
        self.history.iter()
    }
}

impl Default for HistoryManager {
    fn default() -> Self {
        Self::new()
    }
}
