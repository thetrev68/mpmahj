//! Utilities for bot behavior that are shared between client and server implementations.
//!
//! These utilities help ensure consistent bot behavior across different execution contexts:
//! - Terminal client bots (mahjong_terminal)
//! - Server-side bot runner (mahjong_server)

use crate::flow::{GamePhase, TurnStage};
use rand::Rng;
use std::time::Duration;

/// Calculate human-like delay for bot actions based on game phase.
///
/// Returns a randomized delay that varies by game phase to simulate human thinking time.
/// Delays are calibrated to feel natural while keeping the game moving.
///
/// # Delay Ranges
///
/// - **Charleston**: 2-4 seconds (deliberate tile selection)
/// - **Drawing**: 200-500ms (quick action)
/// - **Discarding**: 1-3 seconds (evaluating hand and strategy)
/// - **Call Window**: 800-2000ms (decision on whether to call)
/// - **Other phases**: 200ms (default)
///
/// # Examples
///
/// ```
/// use mahjong_core::bot_utils::calculate_bot_delay;
/// use mahjong_core::flow::GamePhase;
///
/// let phase = GamePhase::WaitingForPlayers;
/// let delay = calculate_bot_delay(&phase);
/// // Returns a Duration appropriate for the current phase
/// ```
pub fn calculate_bot_delay(phase: &GamePhase) -> Duration {
    let mut rng = rand::thread_rng();

    let delay_ms = match phase {
        GamePhase::Charleston(_) => rng.gen_range(2000..4000),
        GamePhase::Playing(stage) => match stage {
            TurnStage::Drawing { .. } => rng.gen_range(200..500),
            TurnStage::Discarding { .. } => rng.gen_range(1000..3000),
            TurnStage::CallWindow { .. } => rng.gen_range(800..2000),
        },
        _ => 200,
    };

    Duration::from_millis(delay_ms)
}

/// Calculate human-like delay with game progress consideration.
///
/// Similar to [`calculate_bot_delay`], but speeds up as the game progresses
/// (as the wall empties). This creates more dynamic pacing where bots think
/// faster in the late game.
///
/// # Arguments
///
/// * `phase` - Current game phase
/// * `wall_remaining` - Number of tiles left in the wall
/// * `wall_total` - Total tiles in the wall at game start (typically 99)
///
/// # Speed Factor
///
/// - Start of game (wall full): 1.0x speed (full delays)
/// - End of game (wall empty): 2.0x speed (half delays)
/// - Charleston phases are NOT sped up (always use base delays)
///
/// # Examples
///
/// ```
/// use mahjong_core::bot_utils::calculate_bot_delay_with_progress;
/// use mahjong_core::flow::{GamePhase, TurnStage};
/// use mahjong_core::player::Seat;
///
/// let phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::East });
/// let delay = calculate_bot_delay_with_progress(&phase, 50, 99);
/// // Returns faster delay since wall is half empty
/// ```
pub fn calculate_bot_delay_with_progress(
    phase: &GamePhase,
    wall_remaining: usize,
    wall_total: usize,
) -> Duration {
    let mut rng = rand::thread_rng();

    // Calculate game progress (0.0 = start, 1.0 = wall empty)
    let progress = 1.0 - (wall_remaining as f64 / wall_total as f64);
    // Speed factor: 1.0 at start → 0.5 when wall empty (2x faster)
    let speed_factor = 1.0 - (0.5 * progress);

    let base_delay_ms = match phase {
        GamePhase::Charleston(_) => rng.gen_range(2000..4000),
        GamePhase::Playing(stage) => match stage {
            TurnStage::Drawing { .. } => rng.gen_range(200..500),
            TurnStage::Discarding { .. } => rng.gen_range(1000..3000),
            TurnStage::CallWindow { .. } => rng.gen_range(800..2000),
        },
        _ => 200,
    };

    // Don't speed up Charleston actions
    let final_delay_ms = if matches!(phase, GamePhase::Charleston(_)) {
        base_delay_ms
    } else {
        (base_delay_ms as f64 * speed_factor) as u64
    };

    Duration::from_millis(final_delay_ms)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::flow::CharlestonStage;
    use crate::player::Seat;

    #[test]
    fn test_calculate_bot_delay_ranges() {
        // Test Charleston delays (2-4 seconds)
        let phase = GamePhase::Charleston(CharlestonStage::FirstRight);
        for _ in 0..10 {
            let delay = calculate_bot_delay(&phase);
            let ms = delay.as_millis() as u64;
            assert!((2000..4000).contains(&ms));
        }

        // Test drawing delays (200-500ms)
        let phase = GamePhase::Playing(TurnStage::Drawing { player: Seat::East });
        for _ in 0..10 {
            let delay = calculate_bot_delay(&phase);
            let ms = delay.as_millis() as u64;
            assert!((200..500).contains(&ms));
        }

        // Test discarding delays (1-3 seconds)
        let phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::East });
        for _ in 0..10 {
            let delay = calculate_bot_delay(&phase);
            let ms = delay.as_millis() as u64;
            assert!((1000..3000).contains(&ms));
        }
    }

    #[test]
    fn test_calculate_bot_delay_with_progress_speedup() {
        let phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::East });

        // At start (wall full), should use base delays
        let delay_start = calculate_bot_delay_with_progress(&phase, 99, 99);
        let ms_start = delay_start.as_millis() as u64;
        assert!((1000..3000).contains(&ms_start));

        // At end (wall empty), should be roughly 2x faster
        let delay_end = calculate_bot_delay_with_progress(&phase, 0, 99);
        let ms_end = delay_end.as_millis() as u64;
        assert!((500..1500).contains(&ms_end));
    }

    #[test]
    fn test_charleston_does_not_speed_up() {
        let phase = GamePhase::Charleston(CharlestonStage::FirstRight);

        // Charleston delays should be the same regardless of wall state
        let delay_start = calculate_bot_delay_with_progress(&phase, 99, 99);
        let delay_end = calculate_bot_delay_with_progress(&phase, 0, 99);

        let ms_start = delay_start.as_millis() as u64;
        let ms_end = delay_end.as_millis() as u64;

        // Both should be in Charleston range (2-4 seconds)
        assert!((2000..4000).contains(&ms_start));
        assert!((2000..4000).contains(&ms_end));
    }
}
