//! Event broadcasting, persistence, and history hooks.
//!
//! ```no_run
//! use mahjong_server::network::events::RoomEvents;
//! use mahjong_core::event::GameEvent;
//! # async fn run(mut room: mahjong_server::network::room::Room) {
//! room.broadcast_event(GameEvent::CallWindowClosed, mahjong_server::event_delivery::EventDelivery::broadcast()).await;
//! # }
//! ```
use crate::event_delivery::{EventDelivery, EventVisibility};
use crate::network::analysis::RoomAnalysis;
use crate::network::history::RoomHistory;
use crate::network::{messages::Envelope, room::Room, session::Session};
use axum::extract::ws::Message;
use futures_util::SinkExt;
use mahjong_core::{event::GameEvent, history::MoveAction, player::Seat};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Snapshot interval for persisted replay snapshots.
#[cfg(feature = "database")]
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
        // Inject server timestamps for timer events (CallWindowOpened, CharlestonTimerStarted)
        let event = match event {
            GameEvent::CallWindowOpened {
                tile,
                discarded_by,
                can_call,
                timer,
                started_at_ms,
                timer_mode,
            } => {
                // Only inject timestamp if placeholder (0) is present
                let actual_timestamp = if started_at_ms == 0 {
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .expect("system clock should not be before Unix epoch")
                        .as_millis() as u64
                } else {
                    started_at_ms
                };
                GameEvent::CallWindowOpened {
                    tile,
                    discarded_by,
                    can_call,
                    timer,
                    started_at_ms: actual_timestamp,
                    timer_mode,
                }
            }
            GameEvent::CharlestonTimerStarted {
                stage,
                duration,
                started_at_ms,
                timer_mode,
            } => {
                // Only inject timestamp if placeholder (0) is present
                let actual_timestamp = if started_at_ms == 0 {
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .expect("system clock should not be before Unix epoch")
                        .as_millis() as u64
                } else {
                    started_at_ms
                };
                GameEvent::CharlestonTimerStarted {
                    stage,
                    duration,
                    started_at_ms: actual_timestamp,
                    timer_mode,
                }
            }
            // Pass through all other events unchanged
            other => other,
        };

        // Track call resolution for determining contested flag
        if let GameEvent::CallResolved { resolution } = &event {
            self.last_call_resolution = Some(resolution.clone());
        }

        // Track the tile from call window for Mahjong by call detection
        if let GameEvent::CallWindowOpened { tile, .. } = &event {
            self.last_called_tile = Some(*tile);
        }

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
                // Determine if this call was contested by checking last resolution
                let contested = if let Some(last_resolution) = &self.last_call_resolution {
                    // Check if there was actually priority resolution by looking at table phase
                    // If we're here, CallResolved was just emitted, meaning there were intents
                    // We consider it contested if there were multiple intents (not just this one)
                    // The CallResolved event itself doesn't tell us the count, but we can infer:
                    // If CallResolved happened and selected a meld, there was at least one intent.
                    // We'll be conservative and check the table state for pending_intents count.
                    // However, by the time TileCalled is emitted, the phase has moved on.
                    // Better approach: CallResolution::Meld only happens if at least one player called.
                    // If there were multiple callers, the resolution logic would have run.
                    // For now, we'll check if there's a CallResolved in the same batch.
                    // Actually, we can look at whether there were multiple intents by checking
                    // if this is a Meld resolution (which means priority was checked).
                    // The simplest approach: assume contested if we recently saw CallResolved.
                    // More accurate: track intent count from CallResolved event.
                    // Since CallResolved is emitted right before TileCalled, if it exists,
                    // we know resolution happened, but not if it was contested.
                    // For now, use a heuristic: if CallResolved exists, assume at least possibility of contest
                    matches!(
                        last_resolution,
                        mahjong_core::call_resolution::CallResolution::Meld { .. }
                    )
                } else {
                    false
                };

                let desc = if contested {
                    format!(
                        "Move {} - {:?} called {:?} of {} (contested)",
                        self.current_move_number, player, meld.meld_type, called_tile
                    )
                } else {
                    format!(
                        "Move {} - {:?} called {:?} of {}",
                        self.current_move_number, player, meld.meld_type, called_tile
                    )
                };

                self.record_history_entry(
                    *player,
                    MoveAction::MeldCalled {
                        tile: *called_tile,
                        meld_type: meld.meld_type,
                        contested,
                    },
                    desc,
                );

                // Clear the call resolution after using it
                self.last_call_resolution = None;
            }
            GameEvent::TilesPassed { player, tiles } => {
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
                            Some(mahjong_core::flow::charleston::PassDirection::Across)
                        }
                    })
                    .unwrap_or(mahjong_core::flow::charleston::PassDirection::Across);

                self.record_history_entry(
                    *player,
                    MoveAction::PassTiles { direction, count },
                    desc,
                );
            }
            GameEvent::CallWindowOpened {
                tile, discarded_by, ..
            } => {
                let desc = format!(
                    "Move {} - Call window opened for {} (discarded by {:?})",
                    self.current_move_number, tile, discarded_by
                );
                self.record_history_entry(
                    *discarded_by,
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

                    // Check if this was a win by calling - determined by whether we tracked a call resolution
                    let is_call_win = matches!(
                        &self.last_call_resolution,
                        Some(mahjong_core::call_resolution::CallResolution::Mahjong(_))
                    );

                    if is_call_win {
                        // Use the tile from the call window
                        let tile = self
                            .last_called_tile
                            .unwrap_or(mahjong_core::tile::tiles::BAM_1);

                        // Check if there were other callers - if it was a Mahjong resolution,
                        // there was at least the winning call, but we consider it contested
                        // if the resolution was needed (i.e., there were multiple intents)
                        let beat_other_callers = is_call_win; // Conservative: assume contested if went through resolution

                        let desc = if beat_other_callers {
                            format!(
                                "Move {} - {:?} declared Mahjong with '{}' by calling {} (priority win) for {} points",
                                self.current_move_number, winner_seat, pattern_name, tile, score
                            )
                        } else {
                            format!(
                                "Move {} - {:?} declared Mahjong with '{}' by calling {} for {} points",
                                self.current_move_number, winner_seat, pattern_name, tile, score
                            )
                        };

                        self.record_history_entry(
                            *winner_seat,
                            MoveAction::MahjongByCall {
                                tile,
                                pattern_name: pattern_name.clone(),
                                beat_other_callers,
                            },
                            desc,
                        );

                        // Clear the tracking state
                        self.last_call_resolution = None;
                        self.last_called_tile = None;
                    } else {
                        // Self-draw win - use existing DeclareWin
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
            }
            GameEvent::GameOver { winner: None, .. } => {
                // Draw / Wall Exhausted / Abandoned handled elsewhere or skipped for win history?
                // WallExhausted is a separate event usually.
            }
            GameEvent::GamePaused { by, reason } => {
                let desc = if let Some(r) = reason {
                    format!(
                        "Move {} - {:?} paused the game: {}",
                        self.current_move_number, by, r
                    )
                } else {
                    format!(
                        "Move {} - {:?} paused the game",
                        self.current_move_number, by
                    )
                };
                self.record_history_entry(*by, MoveAction::PauseGame, desc);
            }
            GameEvent::GameResumed { by } => {
                let desc = format!(
                    "Move {} - {:?} resumed the game",
                    self.current_move_number, by
                );
                self.record_history_entry(*by, MoveAction::ResumeGame, desc);
            }
            GameEvent::PlayerForfeited { player, reason } => {
                let desc = if let Some(r) = reason {
                    format!(
                        "Move {} - {:?} forfeited: {}",
                        self.current_move_number, player, r
                    )
                } else {
                    format!("Move {} - {:?} forfeited", self.current_move_number, player)
                };
                self.record_history_entry(*player, MoveAction::Forfeit, desc);
            }
            GameEvent::AdminForfeitOverride {
                admin_id,
                admin_display_name,
                forfeited_player,
                reason,
            } => {
                let desc = format!(
                    "Move {} - Admin {} (ID: {}) forced {:?} to forfeit: {}",
                    self.current_move_number,
                    admin_display_name,
                    admin_id,
                    forfeited_player,
                    reason
                );
                self.record_history_entry(*forfeited_player, MoveAction::Forfeit, desc);
            }
            GameEvent::AdminPauseOverride {
                admin_id,
                admin_display_name,
                reason,
            } => {
                let desc = format!(
                    "Move {} - Admin {} (ID: {}) paused the game: {}",
                    self.current_move_number, admin_display_name, admin_id, reason
                );
                // Use East as placeholder since admin actions don't have a player seat
                self.record_history_entry(Seat::East, MoveAction::PauseGame, desc);
            }
            GameEvent::AdminResumeOverride {
                admin_id,
                admin_display_name,
            } => {
                let desc = format!(
                    "Move {} - Admin {} (ID: {}) resumed the game",
                    self.current_move_number, admin_display_name, admin_id
                );
                // Use East as placeholder since admin actions don't have a player seat
                self.record_history_entry(Seat::East, MoveAction::ResumeGame, desc);
            }
            // Add cases for Kong, JokerExchange, etc. as needed
            _ => {
                // Not all events create history entries
            }
        }

        // Persist event to database first
        #[cfg(feature = "database")]
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
    async fn persist_final_state(&self, event: &GameEvent) {
        #[cfg(not(feature = "database"))]
        let _ = event;
        #[cfg(feature = "database")]
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
                        crate::stats::update_player_stats(db, &self.sessions, result, &self.history)
                            .await
                    {
                        tracing::error!("Failed to update player stats: {}", e);
                    }
                }
            }
        }
    }
}
