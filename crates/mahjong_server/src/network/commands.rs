//! Command handling for room state changes and hint/analysis requests.
//!
//! ```no_run
//! use mahjong_server::network::commands::RoomCommands;
//! use mahjong_core::command::GameCommand;
//! # async fn run(mut room: mahjong_server::network::room::Room) -> Result<(), mahjong_core::table::CommandError> {
//! room.handle_command(GameCommand::GetAnalysis { player: mahjong_core::player::Seat::East }, "player").await?;
//! # Ok(())
//! # }
//! ```
use crate::event_delivery::EventDelivery;
use crate::network::analysis::RoomAnalysis;
use crate::network::events::RoomEvents;
use crate::network::history::RoomHistory;
use crate::network::room::Room;
use mahjong_core::{
    command::GameCommand, event::GameEvent, hint::HintVerbosity, player::Seat, table::CommandError,
};

/// Command handling behaviors for rooms.
pub trait RoomCommands {
    /// Handles a player-issued command with authorization checks.
    fn handle_command(
        &mut self,
        command: GameCommand,
        sender_player_id: &str,
    ) -> impl std::future::Future<Output = Result<(), CommandError>> + Send;

    /// Handles a bot-issued command without session authorization.
    fn handle_bot_command(
        &mut self,
        command: GameCommand,
    ) -> impl std::future::Future<Output = Result<(), CommandError>> + Send;

    /// Handles an analysis request for a specific seat.
    fn handle_get_analysis_command(
        &mut self,
        seat: Seat,
    ) -> impl std::future::Future<Output = Result<(), CommandError>> + Send;

    /// Handles a hint request for a specific seat and verbosity.
    fn handle_request_hint(
        &mut self,
        seat: Seat,
        verbosity: HintVerbosity,
    ) -> impl std::future::Future<Output = Result<(), CommandError>> + Send;
}

impl RoomCommands for Room {
    /// Process a game command.
    ///
    /// Validates the command, applies it to the table, and broadcasts resulting events.
    async fn handle_command(
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

        // Handle history commands (practice mode only)
        match &command {
            GameCommand::RequestHistory { .. } => {
                let event = self
                    .handle_request_history()
                    .await
                    .map_err(CommandError::InvalidCommand)?;

                // Send only to requesting player
                if let Some(session) = self.sessions.get(&command_seat) {
                    self.send_to_session(session, event).await;
                }
                return Ok(());
            }
            GameCommand::JumpToMove { move_number, .. } => {
                let event = self
                    .handle_jump_to_move(*move_number)
                    .await
                    .map_err(CommandError::InvalidCommand)?;

                self.broadcast_event(event, EventDelivery::broadcast())
                    .await;
                return Ok(());
            }
            GameCommand::ResumeFromHistory { move_number, .. } => {
                let events = self
                    .handle_resume_from_history(*move_number)
                    .await
                    .map_err(CommandError::InvalidCommand)?;

                for event in events {
                    self.broadcast_event(event, EventDelivery::broadcast())
                        .await;
                }
                return Ok(());
            }
            GameCommand::ReturnToPresent { .. } => {
                let event = self
                    .handle_return_to_present()
                    .await
                    .map_err(CommandError::InvalidCommand)?;

                self.broadcast_event(event, EventDelivery::broadcast())
                    .await;
                return Ok(());
            }
            _ => {
                // Not a history command, continue with normal processing
            }
        }

        // Handle GetAnalysis command directly (doesn't go through Table)
        if matches!(command, GameCommand::GetAnalysis { .. }) {
            return self.handle_get_analysis_command(command_seat).await;
        }

        // Handle RequestHint command directly (doesn't go through Table)
        if let GameCommand::RequestHint { player, verbosity } = command {
            return self.handle_request_hint(player, verbosity).await;
        }

        // Handle SetHintVerbosity command directly (doesn't go through Table)
        if let GameCommand::SetHintVerbosity { player, verbosity } = command {
            self.set_hint_verbosity(player, verbosity);
            return Ok(());
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
    async fn handle_bot_command(&mut self, command: GameCommand) -> Result<(), CommandError> {
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
                // Send summary event
                let event = GameEvent::HandAnalysisUpdated {
                    distance_to_win: analysis.distance_to_win,
                    viable_count: analysis.viable_count,
                    impossible_count: analysis.impossible_count,
                };
                self.send_to_session(session, event.clone()).await;

                // FRONTEND_INTEGRATION_POINT: AnalysisUpdate Event (On-Demand)
                // Also send detailed pattern analysis for Card Viewer
                let patterns: Vec<mahjong_core::event::PatternAnalysis> = analysis
                    .evaluations
                    .iter()
                    .map(|eval| mahjong_core::event::PatternAnalysis {
                        pattern_name: eval.pattern_id.clone(),
                        distance: eval.deficiency.max(0) as u8,
                        viable: eval.viable,
                        difficulty: eval.difficulty_class,
                        probability: eval.probability,
                        score: eval.score as u32,
                    })
                    .collect();

                let analysis_event = GameEvent::AnalysisUpdate { patterns };
                self.send_to_session(session, analysis_event).await;
            }
        }

        Ok(())
    }

    /// Handle RequestHint command by composing hint from cached analysis.
    ///
    /// If no analysis is cached for the player, runs analysis on-demand.
    /// Sends HintUpdate event with recommendations to the requesting player.
    async fn handle_request_hint(
        &mut self,
        seat: Seat,
        verbosity: HintVerbosity,
    ) -> Result<(), CommandError> {
        // Get or compute analysis for this seat
        if !self.analysis_cache.contains_key(&seat) {
            // No cached analysis - run it now
            self.run_analysis_for_seat(seat).await;
        }

        let table = self.table.as_ref().ok_or(CommandError::WrongPhase)?;
        let validator = table.validator.as_ref().ok_or(CommandError::WrongPhase)?;

        // Get cached analysis
        let analysis = self
            .analysis_cache
            .get(&seat)
            .ok_or(CommandError::WrongPhase)?;

        let player = table
            .players
            .get(&seat)
            .ok_or(CommandError::PlayerNotFound)?;

        // Build context
        let visible = crate::analysis::build_visible_tiles(table);
        let call_context = crate::analysis::call_context_from_table(table, seat);

        // Compose hint
        let hint = crate::hint::HintComposer::compose(
            analysis,
            &player.hand,
            &visible,
            validator,
            verbosity,
            &self.pattern_lookup,
            call_context,
        );

        // Send HintUpdate event
        if let Some(session) = self.sessions.get(&seat) {
            let event = GameEvent::HintUpdate { hint };
            self.send_to_session(session, event).await;
        }

        Ok(())
    }
}
