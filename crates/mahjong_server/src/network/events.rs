//! Event broadcasting, persistence, and history hooks.
//!
//! ```no_run
//! use mahjong_server::network::events::RoomEvents;
//! use mahjong_core::event::GameEvent;
//! # async fn run(mut room: mahjong_server::network::room::Room) {
//! room.broadcast_event(GameEvent::CallWindowClosed, mahjong_server::db::EventDelivery::broadcast()).await;
//! # }
//! ```
use crate::db::{EventDelivery, EventVisibility};
use crate::network::analysis::RoomAnalysis;
use crate::network::history::RoomHistory;
use crate::network::{messages::Envelope, room::Room, session::Session};
use axum::extract::ws::Message;
use futures_util::SinkExt;
use mahjong_core::{event::GameEvent, history::MoveAction, player::Seat};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Snapshot interval for persisted replay snapshots.
const SNAPSHOT_INTERVAL: i32 = 50;

/// Event broadcast and persistence behaviors for rooms.
pub trait RoomEvents {
    /// Broadcasts a game event to sessions based on delivery settings.
    fn broadcast_event(
        &mut self,
        event: GameEvent,
        delivery: EventDelivery,
    ) -> impl std::future::Future<Output = ()> + Send;

    /// Sends a game event to a specific session.
    fn send_to_session(
        &self,
        session: &Arc<Mutex<Session>>,
        event: GameEvent,
    ) -> impl std::future::Future<Output = ()> + Send;

    /// Returns true if the event ends the game.
    fn is_game_ending_event(&self, event: &GameEvent) -> bool;

    /// Persists the final game state when the game ends.
    fn persist_final_state(
        &self,
        event: &GameEvent,
    ) -> impl std::future::Future<Output = ()> + Send;
}

impl RoomEvents for Room {
    /// Broadcast an event to appropriate players based on visibility rules.
    ///
    /// Private events (e.g., TileDrawn with tile data) go only to the target player.
    /// Public events (e.g., TileDiscarded) go to all players.
    async fn broadcast_event(&mut self, event: GameEvent, delivery: EventDelivery) {
        // TODO: Inject server timestamps for timer events (CallWindowOpened, CharlestonTimerStarted).
        // Record history entry for significant events (BEFORE persisting to DB)
        match &event {
            GameEvent::TileDrawn { tile: Some(t), .. } => {
                // Infer seat from delivery or table
                let seat = delivery
                    .target_player
                    .or_else(|| self.table.as_ref().map(|t| t.current_turn))
                    .unwrap_or(Seat::East);

                let desc = format!("Move {} - {:?} drew {}", self.current_move_number, seat, t);
                self.record_history_entry(
                    seat,
                    MoveAction::DrawTile {
                        tile: *t,
                        visible: true,
                    },
                    desc,
                );
            }
            GameEvent::TileDrawn { tile: None, .. } => {
                // Public event (no tile info) - we skip recording this as duplicate
                // or record as hidden if needed, but we prefer the one with tile info.
            }
            GameEvent::TileDiscarded { player, tile } => {
                let desc = format!(
                    "Move {} - {:?} discarded {}",
                    self.current_move_number, player, tile
                );
                self.record_history_entry(*player, MoveAction::DiscardTile { tile: *tile }, desc);
            }
            GameEvent::TileCalled {
                player,
                meld,
                called_tile,
            } => {
                let desc = format!(
                    "Move {} - {:?} called {:?} of {}",
                    self.current_move_number, player, meld.meld_type, called_tile
                );
                self.record_history_entry(
                    *player,
                    MoveAction::CallTile {
                        tile: *called_tile,
                        meld_type: meld.meld_type,
                    },
                    desc,
                );
            }
            GameEvent::TilesPassed { player, tiles } => {
                // Determine direction/count from context or event?
                // Event doesn't have direction.
                // But we can record "Passed 3 tiles".
                // TODO: Derive pass direction from table state explicitly.
                let count = tiles.len() as u8;
                let desc = format!(
                    "Move {} - {:?} passed {} tiles",
                    self.current_move_number, player, count
                );
                // We use North as placeholder for direction if not easily available,
                // or try to find it from table phase if possible.
                // For now, using Across as a safe default or checking table phase.
                let direction = self
                    .table
                    .as_ref()
                    .and_then(|t| {
                        if let mahjong_core::flow::GamePhase::Charleston(stage) = &t.phase {
                            stage.pass_direction()
                        } else {
                            Some(mahjong_core::flow::PassDirection::Across)
                        }
                    })
                    .unwrap_or(mahjong_core::flow::PassDirection::Across);

                self.record_history_entry(
                    *player,
                    MoveAction::PassTiles { direction, count },
                    desc,
                );
            }
            GameEvent::CallWindowOpened { tile, .. } => {
                let desc = format!(
                    "Move {} - Call window opened for {}",
                    self.current_move_number, tile
                );
                // Note: We don't have the discarder's seat easily accessible here
                // Could be enhanced by adding context or extracting from table state
                // TODO: Attribute call window events to the actual discarder.
                self.record_history_entry(
                    Seat::East, // Placeholder.
                    MoveAction::CallWindowOpened { tile: *tile },
                    desc,
                );
            }
            GameEvent::CallWindowClosed => {
                let desc = format!(
                    "Move {} - Call window closed (all passed)",
                    self.current_move_number
                );
                self.record_history_entry(Seat::East, MoveAction::CallWindowClosed, desc);
            }
            GameEvent::GameOver {
                winner: Some(winner_seat),
                result,
            } => {
                if let Some(pattern_name) = &result.winning_pattern {
                    let score = result.final_scores.get(winner_seat).copied().unwrap_or(0);
                    let desc = format!(
                        "Move {} - {:?} declared Mahjong with '{}' for {} points",
                        self.current_move_number, winner_seat, pattern_name, score
                    );
                    self.record_history_entry(
                        *winner_seat,
                        MoveAction::DeclareWin {
                            pattern_name: pattern_name.clone(),
                            score: score as u32,
                        },
                        desc,
                    );
                }
            }
            GameEvent::GameOver { winner: None, .. } => {
                // Draw / Wall Exhausted / Abandoned handled elsewhere or skipped for win history?
                // WallExhausted is a separate event usually.
            }
            // Add cases for Kong, JokerExchange, etc. as needed
            _ => {
                // Not all events create history entries
            }
        }

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
        self.enqueue_analysis(event, &delivery);
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
    // TODO: Store full game history to DB when game ends (export complete event log + snapshots)
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

                let analysis_log = if self.analysis_log.is_empty() {
                    None
                } else {
                    match serde_json::to_value(&self.analysis_log) {
                        Ok(value) => Some(value),
                        Err(e) => {
                            tracing::error!("Failed to serialize analysis log: {}", e);
                            None
                        }
                    }
                };

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
                        analysis_log.as_ref(),
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
}
