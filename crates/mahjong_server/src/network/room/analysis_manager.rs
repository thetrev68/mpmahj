//! Analysis and AI management for a room.
//!
//! Manages AI analysis caching, hint generation, and debug logging.
//!
//! # Architecture
//!
//! `AnalysisManager` is one of three composition members in [`Room`](super::Room). It provides:
//! - **Caching**: Stores analysis results per-player to avoid redundant computation
//! - **Configuration**: Tuning knobs for when analysis triggers, timeout, CPU budget
//! - **Hashing**: Skips re-analysis when game state hasn't meaningfully changed
//! - **Hints**: Converts analysis to user-friendly recommendations per player's hint-enabled state
//! - **Debug mode**: Optional AI comparison logging (triggered by `DEBUG_AI_COMPARISON=1` env var)
//!
//! # Analysis Flow
//!
//! 1. Game loop emits a game state change
//! 2. Room's analysis handler checks hash state (via `hashes()`) — skip if unchanged
//! 3. Creates an `AnalysisRequest` and sends to background worker (via `sender()`)
//! 4. Worker performs expensive MCTS/evaluation and returns results
//! 5. Results cached in `cache()` and converted to hints for each player
//! 6. Hints sent to clients via WebSocket when hint delivery is enabled
//!
//! # Debug Mode
//!
//! When `DEBUG_AI_COMPARISON=1`, the manager logs AI strategy comparisons
//! (e.g., Greedy vs MCTS recommendations) for performance analysis.

use crate::analysis::{
    comparison::AnalysisLogEntry, AnalysisCache, AnalysisConfig, AnalysisHashState, AnalysisRequest,
};
use mahjong_core::player::Seat;
use std::collections::{HashMap, HashSet};
use tokio::sync::mpsc;

/// Manages AI analysis, caching, and hint generation.
#[derive(Debug)]
pub struct AnalysisManager {
    /// Per-player analysis cache (always-on analyst)
    cache: AnalysisCache,
    /// Analysis configuration (when to trigger, timeouts, etc.)
    config: AnalysisConfig,
    /// Hashes used to skip redundant analysis
    hashes: AnalysisHashState,
    /// Channel to send analysis requests to the background worker
    tx: mpsc::Sender<AnalysisRequest>,
    /// Debug mode: enables AI comparison logging
    debug_mode: bool,
    /// AI comparison log (only populated when debug_mode == true)
    log: Vec<AnalysisLogEntry>,
    /// Seats with hint delivery disabled.
    hint_disabled: HashSet<Seat>,
    /// Pattern ID → display name (from UnifiedCard)
    pattern_lookup: HashMap<String, String>,
}

impl AnalysisManager {
    /// Create a new analysis manager.
    pub fn new(tx: mpsc::Sender<AnalysisRequest>) -> Self {
        // Check if debug mode is enabled
        let debug_mode = std::env::var("DEBUG_AI_COMPARISON").ok().as_deref() == Some("1");

        Self {
            cache: HashMap::new(),
            config: AnalysisConfig::default(),
            hashes: AnalysisHashState::default(),
            tx,
            debug_mode,
            log: Vec::new(),
            hint_disabled: HashSet::new(),
            pattern_lookup: HashMap::new(),
        }
    }

    /// Get a reference to the analysis cache.
    pub fn cache(&self) -> &AnalysisCache {
        &self.cache
    }

    /// Get a mutable reference to the analysis cache.
    pub fn cache_mut(&mut self) -> &mut AnalysisCache {
        &mut self.cache
    }

    /// Get the analysis configuration.
    pub fn config(&self) -> &AnalysisConfig {
        &self.config
    }

    /// Get a mutable reference to the analysis configuration.
    pub fn config_mut(&mut self) -> &mut AnalysisConfig {
        &mut self.config
    }

    /// Get the analysis hash state.
    pub fn hashes(&self) -> &AnalysisHashState {
        &self.hashes
    }

    /// Get a mutable reference to the analysis hash state.
    pub fn hashes_mut(&mut self) -> &mut AnalysisHashState {
        &mut self.hashes
    }

    /// Get a reference to the analysis request sender.
    pub fn sender(&self) -> &mpsc::Sender<AnalysisRequest> {
        &self.tx
    }

    /// Add an entry to the analysis log.
    pub fn log_analysis(&mut self, entry: AnalysisLogEntry) {
        if self.debug_mode {
            self.log.push(entry);
        }
    }

    /// Get the analysis log.
    pub fn get_analysis_log(&self) -> &[AnalysisLogEntry] {
        &self.log
    }

    /// Get the number of entries in the analysis log.
    pub fn analysis_log_len(&self) -> usize {
        self.log.len()
    }

    /// Enable or disable hint delivery for a player.
    pub fn set_hint_enabled(&mut self, seat: Seat, enabled: bool) {
        if enabled {
            self.hint_disabled.remove(&seat);
        } else {
            self.hint_disabled.insert(seat);
        }
    }

    /// Check whether hint delivery is enabled for a player.
    pub fn is_hint_enabled(&self, seat: Seat) -> bool {
        !self.hint_disabled.contains(&seat)
    }

    /// Set the pattern lookup table.
    pub fn set_pattern_lookup(&mut self, lookup: HashMap<String, String>) {
        self.pattern_lookup = lookup;
    }

    /// Get a reference to the pattern lookup table.
    pub fn pattern_lookup(&self) -> &HashMap<String, String> {
        &self.pattern_lookup
    }

    /// Get pattern name from ID (for hint display).
    pub fn pattern_name(&self, pattern_id: &str) -> Option<&str> {
        self.pattern_lookup.get(pattern_id).map(|s| s.as_str())
    }

    /// Enable or disable debug mode.
    pub fn set_debug_mode(&mut self, enabled: bool) {
        self.debug_mode = enabled;
    }

    /// Check if debug mode is enabled.
    pub fn is_debug_mode(&self) -> bool {
        self.debug_mode
    }

    /// Clear the analysis cache.
    pub fn clear_cache(&mut self) {
        self.cache.clear();
    }

    /// Clear the analysis log.
    pub fn clear_log(&mut self) {
        self.log.clear();
    }

    /// Drain old entries from the analysis log to keep it under a maximum size.
    pub fn trim_log(&mut self, max_entries: usize) {
        if self.log.len() > max_entries {
            let excess = self.log.len() - max_entries;
            self.log.drain(0..excess);
        }
    }
}
