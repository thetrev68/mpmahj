//! History viewer functionality for practice mode.
//!
//! Provides time-travel features: view move history, jump to any point,
//! and resume from history (truncating future moves).
//!
//! ```no_run
//! use mahjong_server::network::history::RoomHistory;
//! use mahjong_core::history::MoveAction;
//! # let (mut room, _rx) = mahjong_server::network::room::Room::new();
//! room.record_history_entry(mahjong_core::player::Seat::East, MoveAction::CallWindowClosed, "Call window closed".to_string());
//! ```

use crate::network::room::Room;
use chrono::Utc;
use mahjong_core::{
    event::{public_events::PublicEvent, Event},
    history::{HistoryMode, MoveAction, MoveHistoryEntry, MoveHistorySummary},
    player::Seat,
};

/// History management trait for Room.
pub trait RoomHistory {
    /// Check if this is a practice mode game (3+ bots).
    fn is_practice_mode(&self) -> bool;

    /// Record a move in history with a snapshot of current state.
    fn record_history_entry(&mut self, seat: Seat, action: MoveAction, description: String);

    /// Handle RequestHistory command.
    fn handle_request_history(
        &self,
    ) -> impl std::future::Future<Output = Result<Event, String>> + Send;

    /// Handle JumpToMove command.
    fn handle_jump_to_move(
        &mut self,
        move_number: u32,
    ) -> impl std::future::Future<Output = Result<Event, String>> + Send;

    /// Handle ResumeFromHistory command.
    fn handle_resume_from_history(
        &mut self,
        move_number: u32,
    ) -> impl std::future::Future<Output = Result<Vec<Event>, String>> + Send;

    /// Handle ReturnToPresent command.
    fn handle_return_to_present(
        &mut self,
    ) -> impl std::future::Future<Output = Result<Event, String>> + Send;
}

impl RoomHistory for Room {
    /// Check if this is a practice mode game.
    ///
    /// Practice mode = 3 or 4 bots (single human player or all bots).
    fn is_practice_mode(&self) -> bool {
        self.bot_seats.len() >= 3
    }

    /// Records a move in history with a snapshot of current state.
    fn record_history_entry(&mut self, seat: Seat, action: MoveAction, description: String) {
        // Only record if not viewing history
        if self.history_mode != HistoryMode::None {
            return;
        }

        // Only record if table exists
        let Some(table) = &self.table else {
            return;
        };

        let entry = MoveHistoryEntry {
            move_number: self.current_move_number,
            timestamp: Utc::now(),
            seat,
            action,
            description,
            snapshot: table.clone(), // Full snapshot
        };

        self.history.push(entry);
        self.current_move_number += 1;
    }

    /// Handle request for full history list.
    async fn handle_request_history(&self) -> Result<Event, String> {
        // Check if this is a practice mode game
        if !self.is_practice_mode() {
            return Err("History is only available in Practice Mode".to_string());
        }

        // Convert full history entries to lightweight summaries
        let summaries: Vec<MoveHistorySummary> = self
            .history
            .iter()
            .map(|entry| MoveHistorySummary {
                move_number: entry.move_number,
                timestamp: entry.timestamp,
                seat: entry.seat,
                action: entry.action.clone(),
                description: entry.description.clone(),
            })
            .collect();

        Ok(Event::Public(PublicEvent::HistoryList { entries: summaries }))
    }

    /// Handle jumping to a specific move in history.
    async fn handle_jump_to_move(&mut self, move_number: u32) -> Result<Event, String> {
        // Check practice mode
        if !self.is_practice_mode() {
            return Err("History is only available in Practice Mode".to_string());
        }

        // Validate move number
        if move_number >= self.history.len() as u32 {
            return Err(format!(
                "Move {} does not exist (game has {} moves)",
                move_number,
                self.history.len()
            ));
        }

        // Save current state as "present" if not already viewing history
        if self.history_mode == HistoryMode::None {
            if let Some(table) = &self.table {
                self.present_state = Some(Box::new(table.clone()));
            }
        }

        // Restore state from snapshot
        let entry = &self.history[move_number as usize];
        self.table = Some(entry.snapshot.clone());
        self.history_mode = HistoryMode::Viewing {
            at_move: move_number,
        };

        Ok(Event::Public(PublicEvent::StateRestored {
            move_number,
            description: entry.description.clone(),
            mode: self.history_mode,
        }))
    }

    /// Handle resuming gameplay from a history point (truncates future).
    async fn handle_resume_from_history(
        &mut self,
        move_number: u32,
    ) -> Result<Vec<Event>, String> {
        // Check practice mode
        if !self.is_practice_mode() {
            return Err("History is only available in Practice Mode".to_string());
        }

        // Check if viewing history (must be viewing to resume)
        if self.history_mode == HistoryMode::None {
            return Err("Not viewing history".to_string());
        }

        // Validate move number
        if move_number >= self.history.len() as u32 {
            return Err(format!(
                "Move {} does not exist (game has {} moves)",
                move_number,
                self.history.len()
            ));
        }

        // Restore state from snapshot
        let entry = &self.history[move_number as usize];
        self.table = Some(entry.snapshot.clone());
        let description = entry.description.clone();

        // Truncate future history
        self.history.truncate((move_number + 1) as usize);
        self.current_move_number = move_number + 1;

        // Clear history mode
        self.history_mode = HistoryMode::None;
        self.present_state = None;

        // Return events: StateRestored + HistoryTruncated
        Ok(vec![
            Event::Public(PublicEvent::StateRestored {
                move_number,
                description,
                mode: HistoryMode::None,
            }),
            Event::Public(PublicEvent::HistoryTruncated {
                from_move: move_number + 1,
            }),
        ])
    }

    /// Handle returning to present (exit history view).
    async fn handle_return_to_present(&mut self) -> Result<Event, String> {
        // Check if in history mode
        if self.history_mode == HistoryMode::None {
            return Err("Not viewing history".to_string());
        }

        // Restore present state
        if let Some(present) = self.present_state.take() {
            self.table = Some(*present);
        } else {
            // Fallback: restore from last history entry
            if let Some(entry) = self.history.last() {
                self.table = Some(entry.snapshot.clone());
            } else {
                return Err("No present state to restore".to_string());
            }
        }

        self.history_mode = HistoryMode::None;

        Ok(Event::Public(PublicEvent::StateRestored {
            move_number: self.current_move_number - 1,
            description: "Returned to present".to_string(),
            mode: HistoryMode::None,
        }))
    }
}
