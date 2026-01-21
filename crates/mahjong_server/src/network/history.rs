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

    /// Find the last decision point before the current state.
    ///
    /// Searches backwards from the current history tip for an entry marked as a decision point.
    /// Used for "Smart Undo" functionality.
    fn find_last_decision_point(&self) -> Option<u32>;
}

impl RoomHistory for Room {
    /// Check if this is a practice mode game.
    ///
    /// Practice mode = 3 or 4 bots (single human player or all bots).
    /// Also enabled if debug_mode is true (for testing/development).
    fn is_practice_mode(&self) -> bool {
        self.bot_seats.len() >= 3 || self.debug_mode
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

        // Determine if this is a decision point (waiting for user input)
        // We tag states where players need to make a choice:
        // - DrawTile: Player needs to discard
        // - MeldCalled: Player needs to discard
        // - CallWindowOpened: Players need to Call/Pass
        // - PassTiles: Players need to Pass (or confirm)
        // - CharlestonCompleted: Game starting (East needs to discard)
        // - ResumeGame: Game resuming (players need to act)
        let is_decision_point = matches!(
            action,
            MoveAction::DrawTile { .. }
                | MoveAction::MeldCalled { .. }
                | MoveAction::CallWindowOpened { .. }
                | MoveAction::PassTiles { .. }
                | MoveAction::CharlestonCompleted
                | MoveAction::ResumeGame
        );

        let entry = MoveHistoryEntry {
            move_number: self.current_move_number,
            timestamp: Utc::now(),
            seat,
            action,
            description,
            is_decision_point,
            snapshot: table.clone(), // Full snapshot
        };

        self.history.push(entry);
        self.current_move_number += 1;
    }

    /// Find the last decision point before the current state.
    fn find_last_decision_point(&self) -> Option<u32> {
        // Start searching from the end of history
        // We look for the last decision point that is NOT the current state
        // (because usually you want to undo *away* from the current state)
        
        // However, if the current state IS a decision point (e.g., I just drew),
        // "Undo" usually implies going back to the *previous* decision point
        // (e.g., undoing the previous player's discard? Or undoing my draw? Can't undo draw.)
        // Actually, if I am at "DrawTile", the *last* action was "DrawTile".
        // The state *before* DrawTile was "CallWindowClosed" (automatic) -> "CallWindowOpened" (decision).
        // If I undo, I want to go back to "CallWindowOpened"? No, that implies I can change the previous outcome.
        
        // "Smart Undo" usually means "Undo the last action *I* took".
        // But in a shared history, it means "Undo the last action *anyone* took".
        
        // Algorithm:
        // 1. Start from the last entry.
        // 2. Search backwards for a decision point.
        // 3. If we are currently AT the last decision point (e.g., nothing happened since),
        //    we need to go back further to the *previous* decision point.
        
        // For simplicity: Always find the *second to last* decision point? 
        // Or simply the last one, and if that is the tip, go one back?
        
        // Let's assume the user wants to jump to a *valid state* to resume play.
        // That state must be a decision point.
        
        // Case 1: I just discarded. History tip is DiscardTile (Not Decision).
        // Backward search finds DrawTile (Decision).
        // If I jump there, I am back to "Need to Discard". This undoes my discard. CORRECT.
        
        // Case 2: I just Passed. History tip is PassTiles (Decision).
        // If I jump there, I am at the state "After I Passed". This does NOT undo my pass.
        // So I need to jump to the decision point *before* PassTiles.
        
        // Case 3: Call Window Open. History tip is CallWindowOpened (Decision).
        // If I jump there, I am still in Call Window. This changes nothing.
        // I need to jump to the decision point *before* CallWindowOpened.
        // Which is... DiscardTile (Not) -> DrawTile (Decision).
        // So if I undo during Call Window, I undo the Discard that caused it. CORRECT.
        
        // So the logic is: Find the last decision point that is STRICTLY BEFORE the current tip?
        // Wait, "current tip" is the last entry.
        // If the last entry IS a decision point, we skip it and find the previous one.
        // If the last entry is NOT a decision point, we find the nearest one backwards (which is the effective current state start).
        // Wait, if last entry is DiscardTile (not decision), nearest is DrawTile (decision).
        // If I jump to DrawTile, I undo the Discard.
        
        // So: Scan backwards.
        // The first decision point found represents the *start* of the current action sequence.
        // If we want to UNDO that sequence, we need the *previous* decision point.
        // But if the current sequence is "automatic" (e.g. dealing), maybe we just want the start of it?
        
        // Let's try: "Find the decision point *prior* to the active one".
        // If the last entry is a decision point, it IS the active one. We want the previous one.
        // If the last entry is NOT a decision point, the active one is the nearest preceding one. We want THAT one?
        // No, if I am at DiscardTile (not decision), my turn is effectively over. I shouldn't be able to undo?
        // Or "Undo" takes me back to DrawTile?
        // If I played DiscardTile, and hit Undo, I want to be back at DrawTile.
        // DrawTile IS the nearest preceding decision point.
        // So simply finding the "nearest preceding decision point" is correct for non-decision tips.
        // But for decision tips (CallWindowOpened), finding "nearest preceding" finds itself.
        // And jumping to itself does nothing.
        // So if the tip is a decision point, we must skip it.
        
        let history_len = self.history.len();
        if history_len == 0 {
            return None;
        }

        // Start checking from the last entry
        for i in (0..history_len).rev() {
            let entry = &self.history[i];
            if entry.is_decision_point {
                // If this decision point is the very last entry, it represents the *current* state.
                // Undoing means going *back* from here. So we skip it and keep looking.
                // Exception: If it's the ONLY entry (start of game), we can't go back.
                if i == history_len - 1 {
                    continue;
                }
                
                // Found a decision point strictly before the current tip (or we skipped the tip).
                return Some(entry.move_number);
            }
        }
        
        // If we skipped the only decision point (start of game), or found none, return 0?
        // Or None?
        // If we are at move 0 and it's a decision point, we return 0 (can't go further back).
        if history_len > 0 && self.history[0].is_decision_point {
             return Some(0);
        }

        None
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

        Ok(Event::Public(PublicEvent::HistoryList {
            entries: summaries,
        }))
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
    async fn handle_resume_from_history(&mut self, move_number: u32) -> Result<Vec<Event>, String> {
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
