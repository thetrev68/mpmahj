use crate::analysis::{AnalysisMode, AnalysisRequest, AnalysisTrigger, HandAnalysis};
use crate::db::EventDelivery;
use crate::network::room::Room;
use mahjong_ai::context::VisibleTiles;
use mahjong_ai::evaluation::StrategicEvaluation;
use mahjong_core::{event::GameEvent, player::Seat};
use std::time::Instant;

pub trait RoomAnalysis {
    fn run_analysis_for_seat(&mut self, seat: Seat)
        -> impl std::future::Future<Output = ()> + Send;
    fn should_trigger_analysis(&self, event: &GameEvent) -> bool;
    fn enqueue_analysis(&self, event: GameEvent, delivery: &EventDelivery);
}

impl RoomAnalysis for Room {
    /// Run analysis for a specific seat (used by GetAnalysis command).
    async fn run_analysis_for_seat(&mut self, seat: Seat) {
        let table = match &self.table {
            Some(t) => t,
            None => return,
        };

        let validator = match &table.validator {
            Some(v) => v,
            None => return,
        };

        // Build VisibleTiles
        let mut visible = VisibleTiles::new();
        for discarded in &table.discard_pile {
            visible.add_discard(discarded.tile);
        }
        for (s, player) in &table.players {
            for meld in &player.hand.exposed {
                visible.add_meld(*s, meld.clone());
            }
        }

        // Get player and run analysis
        if let Some(player) = table.players.get(&seat) {
            let start = Instant::now();
            let hand = &player.hand;

            let analysis_results = validator.analyze(hand, self.analysis_config.max_patterns);

            let evaluations: Vec<StrategicEvaluation> = analysis_results
                .into_iter()
                .filter_map(|result| {
                    let target_histogram =
                        validator.histogram_for_variation(&result.variation_id)?;
                    Some(StrategicEvaluation::from_analysis(
                        result,
                        hand,
                        &visible,
                        target_histogram,
                    ))
                })
                .collect();

            let analysis = HandAnalysis::from_evaluations(evaluations);
            let elapsed = start.elapsed();

            tracing::info!(
                seat = ?seat,
                distance_to_win = analysis.distance_to_win,
                viable_count = analysis.viable_count,
                elapsed_ms = elapsed.as_millis(),
                "On-demand analysis completed"
            );

            self.analysis_cache.insert(seat, analysis);
        }
    }

    /// Check if analysis should be triggered for the given event.
    ///
    /// Trigger conditions depend on the configured analysis mode:
    /// - `OnDemand`: Never trigger automatically (return false)
    /// - `ActivePlayerOnly`: Trigger on TurnChanged, TilesDealt
    /// - `AlwaysOn`: Trigger on TurnChanged, TilesDealt, TileDrawn, TileCalled, TilesPassed, TilesReceived
    fn should_trigger_analysis(&self, event: &GameEvent) -> bool {
        // Check if analysis is globally enabled for this room
        if let Some(rules) = &self.house_rules {
            if !rules.analysis_enabled {
                return false;
            }
        }

        match self.analysis_config.mode {
            AnalysisMode::OnDemand => false,
            AnalysisMode::ActivePlayerOnly => matches!(
                event,
                GameEvent::TurnChanged { .. }
                    | GameEvent::TilesDealt { .. }
                    // Also update when player's hand changes during Charleston
                    | GameEvent::TilesPassed { .. }
                    | GameEvent::TilesReceived { .. }
            ),
            AnalysisMode::AlwaysOn => matches!(
                event,
                GameEvent::TurnChanged { .. }
                    | GameEvent::TilesDealt { .. }
                    | GameEvent::TileDrawn { .. }
                    | GameEvent::TileCalled { .. }
                    | GameEvent::TilesPassed { .. }
                    | GameEvent::TilesReceived { .. }
            ),
        }
    }

    /// Enqueue an analysis request for the background worker.
    fn enqueue_analysis(&self, event: GameEvent, delivery: &EventDelivery) {
        if !self.should_trigger_analysis(&event) {
            return;
        }

        if self.analysis_tx.is_closed() {
            return;
        }

        let target_seat = delivery.target_player.or_else(|| event.associated_player());

        let tx = self.analysis_tx.clone();
        tokio::spawn(async move {
            if let Err(e) = tx
                .send(AnalysisRequest {
                    trigger: AnalysisTrigger::Event(event),
                    target_seat,
                })
                .await
            {
                // This happens during room shutdown, so debug only
                tracing::debug!("Failed to enqueue analysis request: {}", e);
            }
        });
    }
}
