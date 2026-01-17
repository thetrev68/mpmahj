//! American Mahjong Game Server
//!
//! This library provides the core server implementation including:
//! - WebSocket networking
//! - Session and room management
//! - Authentication
//! - Rate limiting
//! - Heartbeat monitoring
//! - Optional database persistence
//! - Replay functionality
//!
//! ## Feature Flags
//!
//! The server can run in two modes:
//!
//! ### Memory-Only Mode (Default)
//! ```bash
//! cargo build
//! cargo test
//! ```
//! - No PostgreSQL dependency
//! - Game state not persisted
//! - Perfect for development and testing
//!
//! ### Database Mode (Optional)
//! ```bash
//! cargo build --features database
//! cargo test --features database
//! ```
//! - Enables PostgreSQL persistence via sqlx
//! - Event sourcing and replay functionality
//! - Player statistics tracking
//!
//! ### SQLX Offline Mode
//! When building with the `database` feature without a live database connection:
//! ```bash
//! # Step 1: Generate query metadata (requires DATABASE_URL)
//! cargo sqlx prepare --features database
//!
//! # Step 2: Build offline (no database needed)
//! SQLX_OFFLINE=true cargo build --features database
//! ```
//!
//! See `.cargo/config.toml` for configuration details.
//!
//! ## Example Usage
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
pub mod test_utils;
