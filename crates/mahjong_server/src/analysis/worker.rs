//! Background analysis worker for always-on analysis and hint emission.
//!
//! The worker snapshots room state, runs analysis off-lock, and then
//! updates caches plus emits events to sessions.
//!
//! Performance metrics are tracked and logged for requests that exceed thresholds.
//! Target: <50ms avg, <100ms p90. See docs/implementation/remaining-work.md Section 5.1
//!
//! ```no_run
//! # use std::sync::{Arc, Weak};
//! # use tokio::sync::{mpsc, Mutex};
//! # use mahjong_server::analysis::AnalysisRequest;
//! # use mahjong_server::network::room::Room;
//! # async fn run() {
//! let (tx, rx) = mpsc::channel::<AnalysisRequest>(8);
//! let (room, _analysis_rx) = Room::new();
//! let room = Arc::new(Mutex::new(room));
//! let weak_room = Arc::downgrade(&room);
//! tokio::spawn(async move {
//!     mahjong_server::analysis::worker::analysis_worker(weak_room, rx).await;
//! });
//! # let _ = tx;
//! # }
//! ```
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
use mahjong_core::event::{analysis_events::AnalysisEvent, types::PatternAnalysis, Event};
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
        let mut coalesced_count = 0;
        while let Ok(next_request) = rx.try_recv() {
            request = next_request;
            coalesced_count += 1;
        }

        let room_arc = match weak_room.upgrade() {
            Some(arc) => arc,
            None => break, // Room dropped, exit worker
        };

        // === Performance Metrics ===
        let start_total = Instant::now();
        let mut total_patterns_evaluated = 0;
        let mut seats_analyzed = 0;

        // --- Step 1: Snapshot Phase (hold lock briefly). ---
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

        // --- Step 2: Analysis Phase (no lock). ---
        // This is the CPU-intensive part.

        // 2a. Build VisibleTiles.
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

        // 2b. Determine seats to analyze.
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

            // Dirty check: skip if neither hand nor visible context changed.
            // We check visible hash because opponent discards/melds change probabilities
            // even if my hand is same.
            let cached_hand_hash = hashes.hand_hashes.get(&seat).copied().unwrap_or(0);

            if hand_hash == cached_hand_hash && current_visible_hash == hashes.visible_hash {
                continue; // Skip analysis
            }

            // Perform analysis with timeout.
            let analysis_future = async {
                let start_seat = Instant::now();
                let analysis_results = validator.analyze(&player.hand, config.max_patterns);

                let pattern_count = analysis_results.len();

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

                (seat, analysis, hand_hash, pattern_count, elapsed)
            };

            // Wrap in tokio timeout
            match tokio::time::timeout(
                std::time::Duration::from_millis(config.timeout_ms),
                analysis_future,
            )
            .await
            {
                Ok((seat, analysis, hash, pattern_count, seat_elapsed)) => {
                    results.insert(seat, analysis);
                    new_hand_hashes.insert(seat, hash);
                    total_patterns_evaluated += pattern_count;
                    seats_analyzed += 1;

                    // Log per-seat metrics if seat analysis was slow
                    if seat_elapsed.as_millis() > 25 {
                        tracing::debug!(
                            seat = ?seat,
                            elapsed_ms = seat_elapsed.as_millis(),
                            patterns_evaluated = pattern_count,
                            "Seat analysis completed (slow)"
                        );
                    }
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

        // ========== AI COMPARISON LOGGING ==========
        // Only run if debug mode is enabled via environment variable.
        // This does not require accessing Room (which is locked); we work with the snapshot.

        let debug_enabled = std::env::var("DEBUG_AI_COMPARISON").ok().as_deref() == Some("1");

        let mut comparison_logs = Vec::new();

        if debug_enabled && !results.is_empty() {
            use crate::analysis::comparison::{run_strategy_comparison, AnalysisLogEntry};
            use mahjong_ai::r#trait::{create_ai, MahjongAI};
            use mahjong_ai::Difficulty;

            // Run comparison for each seat that was analyzed.
            for seat in results.keys() {
                if let Some(player) = snapshot.players.get(seat) {
                    // Create fresh AI instances for each comparison
                    // (Cannot reuse across seats due to internal state)
                    let mut strategies: Vec<Box<dyn MahjongAI>> = vec![
                        create_ai(Difficulty::Hard, 0),   // Greedy
                        create_ai(Difficulty::Expert, 0), // MCTS
                        create_ai(Difficulty::Easy, 0),   // BasicBot
                    ];
                    let strategy_names = vec!["Greedy", "MCTS", "BasicBot"];

                    // Run comparison.
                    let recommendations = run_strategy_comparison(
                        &player.hand,
                        &visible,
                        validator,
                        &mut strategies,
                        &strategy_names,
                    );

                    let log_entry = AnalysisLogEntry {
                        turn_number: snapshot.turn_number,
                        seat: *seat,
                        hand_snapshot: player.hand.clone(),
                        recommendations,
                    };

                    comparison_logs.push(log_entry);

                    tracing::debug!(
                        seat = ?seat,
                        turn = snapshot.turn_number,
                        "AI comparison logged for seat"
                    );
                }
            }
        }

        // --- Step 3: Update Phase (lock room). ---
        let mut pending_events: Vec<(Arc<Mutex<Session>>, Event)> = Vec::new();
        {
            let mut room = room_arc.lock().await;

            // Update hashes (skip visible hash update if any timeout occurred).
            if !any_timeout {
                room.analysis_hashes.visible_hash = current_visible_hash;
            }
            room.analysis_hashes.hand_hashes = new_hand_hashes;

            // ========== APPEND AI COMPARISON LOGS ==========
            if !comparison_logs.is_empty() {
                room.analysis_log.extend(comparison_logs);

                // Optional: Limit log size to prevent unbounded growth
                // Keep only the last 500 entries (~2.5-5MB of data)
                const MAX_LOG_ENTRIES: usize = 500;
                if room.analysis_log.len() > MAX_LOG_ENTRIES {
                    let excess = room.analysis_log.len() - MAX_LOG_ENTRIES;
                    room.analysis_log.drain(0..excess);
                    tracing::debug!(
                        removed = excess,
                        remaining = room.analysis_log.len(),
                        "Trimmed old AI comparison log entries"
                    );
                }
            }

            // Update cache and stage events for sending.
            for (seat, analysis) in results {
                let should_emit = match room.analysis_cache.get(&seat) {
                    Some(old_analysis) => analysis.has_significant_change(old_analysis),
                    None => true,
                };

                room.analysis_cache.insert(seat, analysis.clone());

                if should_emit {
                    if let Some(session_arc) = sessions.get(&seat) {
                        let event = Event::Analysis(AnalysisEvent::HandAnalysisUpdated {
                            distance_to_win: analysis.distance_to_win,
                            viable_count: analysis.viable_count,
                            impossible_count: analysis.impossible_count,
                        });

                        pending_events.push((session_arc.clone(), event));

                        // FRONTEND_INTEGRATION_POINT: AnalysisUpdate event emission.
                        // This event contains detailed pattern viability data for the Card Viewer UI.
                        // Frontend should:
                        // 1. Listen for AnalysisUpdate events in WebSocket handler
                        // 2. Update analysisStore with new pattern data
                        // 3. Re-render Card Viewer to show updated viability/difficulty
                        //
                        // TypeScript binding: PatternAnalysis[] in Event::Analysis::AnalysisUpdate

                        // Convert StrategicEvaluation -> PatternAnalysis.
                        let patterns: Vec<PatternAnalysis> = analysis
                            .evaluations
                            .iter()
                            .map(|eval| PatternAnalysis {
                                pattern_name: eval.pattern_id.clone(),
                                distance: eval.deficiency.max(0) as u8,
                                viable: eval.viable,
                                difficulty: eval.difficulty_class,
                                probability: eval.probability,
                                score: eval.score as u32,
                            })
                            .collect();

                        let analysis_event = Event::Analysis(AnalysisEvent::AnalysisUpdate { patterns });
                        pending_events.push((session_arc.clone(), analysis_event));

                        // Compose and send hints if verbosity is not Disabled.
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

                                let hint_event = Event::Analysis(AnalysisEvent::HintUpdate { hint });
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

        // === Log Performance Metrics ===
        let elapsed_total = start_total.elapsed();

        // Log if processing took significant time or if we coalesced requests
        if elapsed_total.as_millis() > 50 || coalesced_count > 0 {
            tracing::info!(
                elapsed_ms = elapsed_total.as_millis(),
                seats_analyzed = seats_analyzed,
                patterns_evaluated = total_patterns_evaluated,
                coalesced_requests = coalesced_count,
                queue_depth = coalesced_count + 1,
                "Analysis worker pass complete"
            );
        } else if elapsed_total.as_millis() > 10 {
            tracing::debug!(
                elapsed_ms = elapsed_total.as_millis(),
                seats_analyzed = seats_analyzed,
                patterns_evaluated = total_patterns_evaluated,
                "Analysis worker pass complete"
            );
        }
    }
}

/// Sends a single event to a player's WebSocket session.
async fn send_event_to_session(session: &Arc<Mutex<Session>>, event: Event) {
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
