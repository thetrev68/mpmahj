//! American Mahjong Game Server
//!
//! This library provides the core server implementation including:
//! - WebSocket networking
//! - Session and room management
//! - Authentication
//! - Rate limiting
//! - Heartbeat monitoring
//! - Database persistence
//! - Replay functionality
//!
//! ```
//! #![allow(unused_imports)]
//! use mahjong_server::network::{Envelope, NetworkState, RateLimitStore};
//! ```
pub mod analysis;
pub mod auth;
#[cfg(feature = "database")]
pub mod db;
pub mod event_delivery;
pub mod hint;
pub mod network;
#[cfg(feature = "database")]
pub mod replay;
pub mod resources;
#[cfg(feature = "database")]
pub mod stats;
