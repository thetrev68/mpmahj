use crate::analysis::{
    AnalysisHashState, AnalysisMode, AnalysisRequest, AnalysisTrigger, HandAnalysis,
};
use crate::network::messages::Envelope;
use crate::network::room::Room;
use crate::network::session::Session;
use axum::extract::ws::Message;
use futures_util::SinkExt;
use mahjong_ai::context::VisibleTiles;
use mahjong_ai::evaluation::StrategicEvaluation;
use mahjong_core::event::GameEvent;
use mahjong_core::player::Seat;
use std::collections::HashMap;
use std::sync::{Arc, Weak};
use std::time::Instant;
use tokio::sync::{mpsc, Mutex};

/// Background worker for processing analysis requests.
///
/// This task runs for the lifetime of the room and processes requests sequentially.
pub async fn analysis_worker(
    weak_room: Weak<Mutex<Room>>,
    mut rx: mpsc::Receiver<AnalysisRequest>,
) {
    while let Some(mut request) = rx.recv().await {
        // Coalesce requests: drain the channel to get to the latest state
        while let Ok(next_request) = rx.try_recv() {
            request = next_request;
        }

        let room_arc = match weak_room.upgrade() {
            Some(arc) => arc,
            None => break, // Room dropped, exit worker
        };

        // --- Step 1: Snapshot Phase (Hold lock briefly) ---
        // We clone the data needed for analysis to avoid holding the lock during computation.
        // This is a trade-off: cloning overhead vs locking overhead.
        // For mahjong, the table state is small enough that cloning is preferred.
        let (snapshot, config, hashes, sessions) = {
            let room = room_arc.lock().await;

            // If table or validator missing, skip
            if room.table.is_none() || room.table.as_ref().unwrap().validator.is_none() {
                continue;
            }

            let table = room.table.as_ref().unwrap().clone();
            let config = room.analysis_config.clone();
            let hashes = room.analysis_hashes.clone();
            let sessions = room.sessions.clone(); // Clone sessions to send events later

            (table, config, hashes, sessions)
        };

        let validator = snapshot.validator.as_ref().unwrap();

        // --- Step 2: Analysis Phase (No lock) ---
        // This is the CPU-intensive part.

        let start_total = Instant::now();

        // 2a. Build VisibleTiles
        let mut visible = VisibleTiles::new();
        for discarded in &snapshot.discard_pile {
            visible.add_discard(discarded.tile);
        }
        for (seat, player) in &snapshot.players {
            for meld in &player.hand.exposed {
                visible.add_meld(*seat, meld.clone());
            }
        }

        let current_visible_hash =
            AnalysisHashState::compute_visible_hash(&snapshot.discard_pile, &snapshot.players);

        let AnalysisTrigger::Event(trigger_event) = &request.trigger;
        let requested_seat = request
            .target_seat
            .or_else(|| trigger_event.associated_player());

        // 2b. Determine seats to analyze
        let seats_to_analyze: Vec<Seat> = match config.mode {
            AnalysisMode::ActivePlayerOnly => match requested_seat {
                Some(seat) => vec![seat],
                None => vec![snapshot.current_turn],
            },
            AnalysisMode::AlwaysOn => Seat::all().to_vec(),
            AnalysisMode::OnDemand => continue,
        };

        let mut results = HashMap::new();
        let mut new_hand_hashes = hashes.hand_hashes.clone();
        let mut any_timeout = false;

        for seat in seats_to_analyze {
            let player = match snapshot.players.get(&seat) {
                Some(p) => p,
                None => continue,
            };

            let hand_hash = AnalysisHashState::compute_hand_hash(&player.hand);

            // Dirty check: skip if neither hand nor visible context changed
            // We check visible hash because opponent discards/melds change probabilities
            // even if my hand is same.
            let cached_hand_hash = hashes.hand_hashes.get(&seat).copied().unwrap_or(0);

            if hand_hash == cached_hand_hash && current_visible_hash == hashes.visible_hash {
                continue; // Skip analysis
            }

            // Perform Analysis with Timeout
            let analysis_future = async {
                let start_seat = Instant::now();
                let analysis_results = validator.analyze(&player.hand, config.max_patterns);

                let evaluations: Vec<StrategicEvaluation> = analysis_results
                    .into_iter()
                    .filter_map(|result| {
                        let target_histogram =
                            validator.histogram_for_variation(&result.variation_id)?;
                        Some(StrategicEvaluation::from_analysis(
                            result,
                            &player.hand,
                            &visible,
                            target_histogram,
                        ))
                    })
                    .collect();

                let analysis = HandAnalysis::from_evaluations(evaluations);
                let elapsed = start_seat.elapsed();

                // Warn on timeout if env var set
                let timeout_ms = config.timeout_ms as u128;
                if std::env::var("ANALYSIS_WARN_TIMEOUT").ok().as_deref() == Some("1")
                    && elapsed.as_millis() > timeout_ms
                {
                    tracing::warn!(
                        seat = ?seat,
                        elapsed_ms = elapsed.as_millis(),
                        timeout_ms = timeout_ms,
                        "Analysis exceeded timeout budget"
                    );
                }

                (seat, analysis, hand_hash)
            };

            // Wrap in tokio timeout
            match tokio::time::timeout(
                std::time::Duration::from_millis(config.timeout_ms),
                analysis_future,
            )
            .await
            {
                Ok((seat, analysis, hash)) => {
                    results.insert(seat, analysis);
                    new_hand_hashes.insert(seat, hash);
                }
                Err(_) => {
                    any_timeout = true;
                    // Timeout: do nothing (stale cache will persist)
                    if std::env::var("ANALYSIS_WARN_TIMEOUT").ok().as_deref() == Some("1") {
                        tracing::warn!(seat = ?seat, "Analysis timed out (aborted)");
                    }
                }
            }
        }

        // --- Step 3: Update Phase (Lock Room) ---
        let mut pending_events: Vec<(Arc<Mutex<Session>>, GameEvent)> = Vec::new();
        {
            let mut room = room_arc.lock().await;

            // Update hashes (skip visible hash update if any timeout occurred)
            if !any_timeout {
                room.analysis_hashes.visible_hash = current_visible_hash;
            }
            room.analysis_hashes.hand_hashes = new_hand_hashes;

            // Update cache and stage events for sending
            for (seat, analysis) in results {
                let should_emit = match room.analysis_cache.get(&seat) {
                    Some(old_analysis) => analysis.has_significant_change(old_analysis),
                    None => true,
                };

                room.analysis_cache.insert(seat, analysis.clone());

                if should_emit {
                    if let Some(session_arc) = sessions.get(&seat) {
                        let event = GameEvent::HandAnalysisUpdated {
                            distance_to_win: analysis.distance_to_win,
                            viable_count: analysis.viable_count,
                            impossible_count: analysis.impossible_count,
                        };

                        pending_events.push((session_arc.clone(), event));

                        // FRONTEND_INTEGRATION_POINT: AnalysisUpdate Event Emission
                        // This event contains detailed pattern viability data for the Card Viewer UI.
                        // Frontend should:
                        // 1. Listen for AnalysisUpdate events in WebSocket handler
                        // 2. Update analysisStore with new pattern data
                        // 3. Re-render Card Viewer to show updated viability/difficulty
                        //
                        // TypeScript binding: PatternAnalysis[] in GameEvent.AnalysisUpdate

                        // Convert StrategicEvaluation -> PatternAnalysis
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
                        pending_events.push((session_arc.clone(), analysis_event));

                        // Compose and send hints if verbosity is not Disabled
                        let verbosity = room.get_hint_verbosity(seat);
                        if verbosity != mahjong_core::hint::HintVerbosity::Disabled {
                            let player = snapshot.players.get(&seat);
                            if let Some(player) = player {
                                let call_context =
                                    crate::analysis::call_context_from_table(&snapshot, seat);
                                let hint = crate::hint::HintComposer::compose(
                                    &analysis,
                                    &player.hand,
                                    &visible,
                                    validator,
                                    verbosity,
                                    &room.pattern_lookup,
                                    call_context,
                                );

                                let hint_event = GameEvent::HintUpdate { hint };
                                pending_events.push((session_arc.clone(), hint_event));
                            }
                        }
                    }
                }
            }
        }

        for (session_arc, event) in pending_events {
            send_event_to_session(&session_arc, event).await;
        }

        let elapsed_total = start_total.elapsed();
        if elapsed_total.as_millis() > 10 {
            tracing::debug!(
                elapsed_ms = elapsed_total.as_millis(),
                "Analysis worker pass complete"
            );
        }
    }
}

async fn send_event_to_session(session: &Arc<Mutex<Session>>, event: GameEvent) {
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
