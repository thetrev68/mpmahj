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

pub mod auth;
pub mod db;
pub mod network;
pub mod replay;
