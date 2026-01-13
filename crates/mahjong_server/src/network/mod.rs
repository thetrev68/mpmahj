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
//!
//! ```no_run
//! use chrono::Utc;
//! use mahjong_server::network::{Envelope, NetworkState};
//! let _state = NetworkState::new();
//! let _envelope = Envelope::ping(Utc::now());
//! ```

/// Analysis messaging and cache integration.
pub mod analysis;
/// Bot runner integration for automated players.
pub mod bot_runner;
/// Command handling for inbound client messages.
pub mod commands;
/// Event emission helpers.
pub mod events;
/// Heartbeat and connection health logic.
pub mod heartbeat;
/// History and replay helpers for networking layer.
pub mod history;
/// Serialization helpers for incoming/outgoing messages.
pub mod messages;
/// Per-session rate limiting.
pub mod rate_limit;
/// Room state and lifecycle.
pub mod room;
/// Room store and lookup helpers.
pub mod room_store;
/// Session storage and authentication.
pub mod session;
/// Event visibility filtering.
pub mod visibility;
/// WebSocket upgrade and handler entrypoints.
pub mod websocket;

// Re-export key types for convenience.
pub use analysis::RoomAnalysis;
pub use commands::RoomCommands;
pub use events::RoomEvents;
pub use messages::Envelope;
pub use rate_limit::RateLimitStore;
pub use room::Room;
pub use room_store::RoomStore;
pub use session::{Session, SessionStore, StoredSession};
pub use websocket::{ws_handler, NetworkState};
