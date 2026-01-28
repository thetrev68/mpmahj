//! Analysis and AI management for a room.
//!
//! Manages AI analysis caching, hint generation, and debug logging.

use crate::analysis::{
    comparison::AnalysisLogEntry, AnalysisCache, AnalysisConfig, AnalysisHashState,
    AnalysisRequest,
};
use mahjong_core::{hint::HintVerbosity, player::Seat};
use std::collections::HashMap;
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
    /// Hint verbosity per player (default: Intermediate)
    hint_verbosity: HashMap<Seat, HintVerbosity>,
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
            hint_verbosity: HashMap::new(),
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

    /// Set hint verbosity for a player.
    pub fn set_hint_verbosity(&mut self, seat: Seat, verbosity: HintVerbosity) {
        self.hint_verbosity.insert(seat, verbosity);
    }

    /// Get hint verbosity for a player (defaults to Intermediate).
    pub fn get_hint_verbosity(&self, seat: Seat) -> HintVerbosity {
        self.hint_verbosity
            .get(&seat)
            .copied()
            .unwrap_or(HintVerbosity::Intermediate)
    }

    /// Set the pattern lookup table.
    pub fn set_pattern_lookup(&mut self, lookup: HashMap<String, String>) {
        self.pattern_lookup = lookup;
    }

    /// Get a reference to the pattern lookup table.
    pub fn pattern_lookup(&self) -> &HashMap<String, String> {
        &self.pattern_lookup
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
}
