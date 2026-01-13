//! Move history tracking and history-viewing state.

use crate::{player::Seat, table::Table, tile::Tile};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// A single entry in the game's move history.
///
/// Captures the action, timing, and a full table snapshot so the client can
/// jump to any move deterministically.
///
/// # Examples
/// ```no_run
/// use mahjong_core::history::{MoveAction, MoveHistoryEntry};
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::tile::tiles::DOT_1;
///
/// let entry = MoveHistoryEntry {
///     move_number: 0,
///     timestamp: chrono::Utc::now(),
///     seat: Seat::East,
///     action: MoveAction::DrawTile {
///         tile: DOT_1,
///         visible: true,
///     },
///     description: "East draws".to_string(),
///     snapshot: Table::new("test".to_string(), 42),
/// };
/// let _ = entry;
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveHistoryEntry {
    /// Sequential move number (0-indexed)
    pub move_number: u32,

    /// When this move occurred
    pub timestamp: DateTime<Utc>,

    /// Which player made this move
    pub seat: Seat,

    /// What action was taken
    pub action: MoveAction,

    /// Human-readable description for UI display
    pub description: String,

    /// Complete game state snapshot at this point
    /// (allows jumping to any move instantly)
    pub snapshot: Table,
}

/// Types of actions that create history entries.
///
/// # Examples
/// ```
/// use mahjong_core::history::MoveAction;
/// use mahjong_core::tile::tiles::BAM_3;
///
/// let action = MoveAction::DiscardTile { tile: BAM_3 };
/// let _ = action;
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum MoveAction {
    /// Drew a tile from the wall
    DrawTile { tile: Tile, visible: bool },

    /// Discarded a tile
    DiscardTile { tile: Tile },

    /// Called a discard for a meld
    CallTile {
        tile: Tile,
        meld_type: crate::meld::MeldType,
    },

    /// Passed tiles in Charleston
    PassTiles {
        direction: crate::flow::PassDirection,
        count: u8,
    },

    /// Declared a kong/quint and drew replacement
    DeclareKong { tiles: Vec<Tile> },

    /// Exchanged a joker from exposed meld
    ExchangeJoker { joker: Tile, replacement: Tile },

    /// Declared Mahjong
    DeclareWin { pattern_name: String, score: u32 },

    /// Call window opened after discard
    CallWindowOpened { tile: Tile },

    /// Call window closed (all passed)
    CallWindowClosed,

    /// Charleston phase completed
    CharlestonCompleted,
}

/// History viewing modes.
///
/// # Examples
/// ```
/// use mahjong_core::history::HistoryMode;
///
/// let mode = HistoryMode::Viewing { at_move: 12 };
/// assert!(matches!(mode, HistoryMode::Viewing { .. }));
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, Default)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum HistoryMode {
    /// Not viewing history (normal gameplay)
    #[default]
    None,

    /// Viewing history in read-only mode
    Viewing { at_move: u32 },

    /// Game paused at a history point (can resume from here)
    Paused { at_move: u32 },
}

/// Lightweight summary of a history entry (for listing).
///
/// This is designed for quick UI lists without the full table snapshot.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct MoveHistorySummary {
    pub move_number: u32,
    pub timestamp: DateTime<Utc>,
    pub seat: Seat,
    pub action: MoveAction,
    pub description: String,
}
