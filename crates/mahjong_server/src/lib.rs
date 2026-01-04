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
pub mod auth;
pub mod db;
pub mod network;
pub mod replay;
