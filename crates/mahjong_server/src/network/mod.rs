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

pub mod messages;
pub mod session;
// pub mod room;
// pub mod websocket;
// pub mod heartbeat;
// pub mod rate_limit;

// Re-export key types for convenience
pub use messages::Envelope;
pub use session::{Session, SessionStore, StoredSession};
