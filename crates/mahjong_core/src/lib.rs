//! Core game logic and data types for American Mahjong.

pub mod bot;
pub mod bot_utils;
pub mod call_resolution;
pub mod command;
pub mod deck;
pub mod event;
pub mod flow;
pub mod hand;
pub mod hint;
pub mod history;
pub mod meld;
pub mod player;
pub mod rules;
pub mod scoring;
pub mod snapshot;
pub mod table;
pub mod tile;

/// Re-exported history types for convenience.
pub use history::{HistoryMode, MoveAction, MoveHistoryEntry};
/// Re-exported tile type for convenience.
pub use tile::Tile;
