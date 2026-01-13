//! Call resolution logic for adjudicating simultaneous calls.
//!
//! When multiple players attempt to call the same discarded tile, this module
//! determines which player wins based on:
//! 1. Call priority (Mahjong > Meld)
//! 2. Seat order (counterclockwise from discarder if tied)

use crate::{meld::Meld, player::Seat};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Represents a player's intent to call a discarded tile.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct CallIntent {
    /// The player making the call
    pub seat: Seat,

    /// The type of call being made
    pub kind: CallIntentKind,

    /// Sequence number within this call window (for tracking order)
    pub sequence: u32,
}

/// The type of call a player is making.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum CallIntentKind {
    /// Calling to win (highest priority)
    Mahjong,

    /// Calling to expose a meld (Pung/Kong/Quint)
    Meld(Meld),
}

/// The result of resolving a call window with multiple intents.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum CallResolution {
    /// A player is winning with the called tile
    Mahjong(Seat),

    /// A player is exposing a meld with the called tile
    Meld { seat: Seat, meld: Meld },

    /// No player called (all passed)
    NoCall,
}

impl CallIntent {
    /// Create a new call intent.
    pub fn new(seat: Seat, kind: CallIntentKind, sequence: u32) -> Self {
        Self {
            seat,
            kind,
            sequence,
        }
    }

    /// Get the priority of this call intent (higher number = higher priority).
    /// Mahjong calls always have priority over meld calls.
    ///
    /// Priority values are internal and only used for ordering (Mahjong = 2,
    /// Meld = 1).
    fn priority(&self) -> u8 {
        match self.kind {
            CallIntentKind::Mahjong => 2,
            CallIntentKind::Meld(_) => 1,
        }
    }
}

/// Resolve multiple call intents according to American Mahjong rules.
///
/// Priority order:
/// 1. Mahjong calls beat meld calls
/// 2. Among same priority, counterclockwise from discarder wins
///    (Right > Across > Left from discarder's perspective)
///
/// # Examples
/// ```
/// use mahjong_core::call_resolution::{resolve_calls, CallIntent, CallIntentKind, CallResolution};
/// use mahjong_core::meld::{Meld, MeldType};
/// use mahjong_core::player::Seat;
/// use mahjong_core::tile::Tile;
///
/// let meld = Meld::new(MeldType::Pung, vec![Tile(0), Tile(0), Tile(0)], Some(Tile(0))).unwrap();
/// let intents = vec![CallIntent::new(Seat::South, CallIntentKind::Meld(meld), 0)];
/// let result = resolve_calls(&intents, Seat::East);
///
/// assert!(matches!(result, CallResolution::Meld { seat: Seat::South, .. }));
/// ```
pub fn resolve_calls(intents: &[CallIntent], discarded_by: Seat) -> CallResolution {
    if intents.is_empty() {
        return CallResolution::NoCall;
    }

    // Find the highest priority
    let max_priority = intents.iter().map(|i| i.priority()).max().unwrap();

    // Filter to only highest priority intents
    let top_priority: Vec<&CallIntent> = intents
        .iter()
        .filter(|i| i.priority() == max_priority)
        .collect();

    // If only one at top priority, they win
    if top_priority.len() == 1 {
        let winner = top_priority[0];
        return match &winner.kind {
            CallIntentKind::Mahjong => CallResolution::Mahjong(winner.seat),
            CallIntentKind::Meld(meld) => CallResolution::Meld {
                seat: winner.seat,
                meld: meld.clone(),
            },
        };
    }

    // Multiple at same priority - use seat order (counterclockwise from discarder)
    // Right > Across > Left from discarder's perspective
    let seat_order = [
        discarded_by.right(),
        discarded_by.across(),
        discarded_by.left(),
    ];

    for seat in seat_order {
        if let Some(winner) = top_priority.iter().find(|i| i.seat == seat) {
            return match &winner.kind {
                CallIntentKind::Mahjong => CallResolution::Mahjong(winner.seat),
                CallIntentKind::Meld(meld) => CallResolution::Meld {
                    seat: winner.seat,
                    meld: meld.clone(),
                },
            };
        }
    }

    // Should never reach here if intents is non-empty
    CallResolution::NoCall
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{meld::MeldType, tile::Tile};

    /// Build a simple Pung for call resolution tests.
    fn create_test_meld() -> Meld {
        // Create a Pung of 1 Bam (index 0)
        Meld::new(
            MeldType::Pung,
            vec![Tile(0), Tile(0), Tile(0)],
            Some(Tile(0)),
        )
        .unwrap()
    }

    #[test]
    fn test_no_calls() {
        let intents = vec![];
        let resolution = resolve_calls(&intents, Seat::East);
        assert_eq!(resolution, CallResolution::NoCall);
    }

    #[test]
    fn test_single_mahjong_call() {
        let intents = vec![CallIntent::new(Seat::South, CallIntentKind::Mahjong, 0)];
        let resolution = resolve_calls(&intents, Seat::East);
        assert_eq!(resolution, CallResolution::Mahjong(Seat::South));
    }

    #[test]
    fn test_single_meld_call() {
        let meld = create_test_meld();
        let intents = vec![CallIntent::new(
            Seat::West,
            CallIntentKind::Meld(meld.clone()),
            0,
        )];
        let resolution = resolve_calls(&intents, Seat::East);
        assert!(matches!(
            resolution,
            CallResolution::Meld {
                seat: Seat::West,
                ..
            }
        ));
    }

    #[test]
    fn test_mahjong_beats_meld() {
        let meld = create_test_meld();
        let intents = vec![
            CallIntent::new(Seat::South, CallIntentKind::Meld(meld.clone()), 0),
            CallIntent::new(Seat::West, CallIntentKind::Mahjong, 1),
        ];
        let resolution = resolve_calls(&intents, Seat::East);
        assert_eq!(resolution, CallResolution::Mahjong(Seat::West));
    }

    #[test]
    fn test_seat_order_right_wins() {
        // East discards, both South (right) and West (left) want to meld
        let meld = create_test_meld();
        let intents = vec![
            CallIntent::new(Seat::South, CallIntentKind::Meld(meld.clone()), 0),
            CallIntent::new(Seat::West, CallIntentKind::Meld(meld.clone()), 1),
        ];
        let resolution = resolve_calls(&intents, Seat::East);
        assert!(matches!(
            resolution,
            CallResolution::Meld {
                seat: Seat::South,
                ..
            }
        ));
    }

    #[test]
    fn test_seat_order_across_beats_left() {
        // East discards, both West (across) and North (left) want to meld
        let meld = create_test_meld();
        let intents = vec![
            CallIntent::new(Seat::West, CallIntentKind::Meld(meld.clone()), 0),
            CallIntent::new(Seat::North, CallIntentKind::Meld(meld.clone()), 1),
        ];
        let resolution = resolve_calls(&intents, Seat::East);
        assert!(matches!(
            resolution,
            CallResolution::Meld {
                seat: Seat::West,
                ..
            }
        ));
    }

    #[test]
    fn test_multiple_mahjong_calls() {
        // Both South (right) and North (across) declare Mahjong
        // South should win (counterclockwise priority)
        let intents = vec![
            CallIntent::new(Seat::South, CallIntentKind::Mahjong, 0),
            CallIntent::new(Seat::North, CallIntentKind::Mahjong, 1),
        ];
        let resolution = resolve_calls(&intents, Seat::East);
        assert_eq!(resolution, CallResolution::Mahjong(Seat::South));
    }
}
