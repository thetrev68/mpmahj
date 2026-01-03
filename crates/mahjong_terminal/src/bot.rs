use anyhow::Result;

use crate::client::Client;

/// Simple bot AI for automated testing
///
/// This bot uses very simple heuristics and is intentionally weak.
/// The goal is testing, not competitive play.
#[allow(dead_code)]
pub struct Bot;

#[allow(dead_code)]
impl Bot {
    pub fn new() -> Self {
        Self
    }

    /// Decide what action to take given the current game state
    pub fn decide_action(&self, _state: &crate::client::GameState) -> Option<String> {
        // TODO: Implement bot decision logic
        // For now, just return None (no action)
        None
    }
}

/// Run the bot in auto-play mode
pub async fn run_bot(_client: &mut Client) -> Result<()> {
    tracing::info!("Bot mode starting...");

    // TODO: Implement bot game loop
    // - Listen for events
    // - Decide actions based on game state
    // - Send commands automatically
    // - Handle Charleston, discarding, calling, etc.

    // For now, just a placeholder that waits
    tracing::warn!("Bot AI not yet implemented");

    // Keep the connection alive
    tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;

    Ok(())
}

// Bot strategy helpers (to be implemented)

/// Charleston strategy: pass highest-value tiles
fn _charleston_strategy() {
    // TODO: Implement Charleston tile selection
    // Priority: Dragons > Winds > 1s/9s > Others
}

/// Discard strategy: discard tiles that don't fit any pattern
fn _discard_strategy() {
    // TODO: Implement discard selection
    // 1. Check which patterns are still possible
    // 2. Discard tiles that don't fit any pattern
    // 3. Prefer keeping pairs and runs
}

/// Call strategy: only call if it helps complete a pattern
fn _call_strategy() {
    // TODO: Implement call decision
    // Only call if:
    // - Tile completes a pung/kong
    // - Hand is 80%+ towards a pattern
    // - Not too early in the game
}

/// Mahjong validation: check if we have a winning hand
fn _validate_mahjong() {
    // TODO: Implement win validation
    // This will eventually call the validation engine from mahjong_core
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bot_creation() {
        let _bot = Bot::new();
        // Bot should be created successfully
    }
}
