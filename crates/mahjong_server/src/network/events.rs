use crate::db::{EventDelivery, EventVisibility};
use crate::network::analysis::RoomAnalysis;
use crate::network::{messages::Envelope, room::Room, session::Session};
use axum::extract::ws::Message;
use futures_util::SinkExt;
use mahjong_core::event::GameEvent;
use std::sync::Arc;
use tokio::sync::Mutex;

const SNAPSHOT_INTERVAL: i32 = 50;

pub trait RoomEvents {
    fn broadcast_event(
        &mut self,
        event: GameEvent,
        delivery: EventDelivery,
    ) -> impl std::future::Future<Output = ()> + Send;

    fn send_to_session(
        &self,
        session: &Arc<Mutex<Session>>,
        event: GameEvent,
    ) -> impl std::future::Future<Output = ()> + Send;

    fn is_game_ending_event(&self, event: &GameEvent) -> bool;

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
}
