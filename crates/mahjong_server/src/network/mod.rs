//! Networking layer for WebSocket-based American Mahjong game server.
//!
//! This module implements the complete networking stack including:
//! - WebSocket message handling
//! - Session management (authentication, reconnection)
//! - Room management (game lifecycle, seat allocation)
//! - Event broadcasting with visibility filtering
//! - Heartbeat (ping/pong)
//! - Rate limiting
//!
//! See specification: docs/implementation/03-networking.md

pub mod analysis;
pub mod bot_runner;
pub mod commands;
pub mod events;
pub mod heartbeat;
pub mod history;
pub mod messages;
pub mod rate_limit;
pub mod room;
pub mod room_store;
pub mod session;
pub mod visibility;
pub mod websocket;

// Re-export key types for convenience
pub use analysis::RoomAnalysis;
pub use commands::RoomCommands;
pub use events::RoomEvents;
pub use messages::Envelope;
pub use rate_limit::RateLimitStore;
pub use room::Room;
pub use room_store::RoomStore;
pub use session::{Session, SessionStore, StoredSession};
pub use websocket::{ws_handler, NetworkState};
