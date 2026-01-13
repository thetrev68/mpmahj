//! Rate limiting utilities for WebSocket clients.
//!
//! This module implements per-client rate limits for auth, commands,
//! and reconnection attempts using a fixed-window counter.
//!
//! ```no_run
//! use mahjong_server::network::rate_limit::RateLimitStore;
//! let limits = RateLimitStore::new();
//! let _ = limits.check_room_action("player-1");
//! ```

use dashmap::DashMap;
use mahjong_core::command::GameCommand;
use std::collections::VecDeque;
use std::time::{Duration, Instant};

/// Error returned when a rate limit is exceeded.
#[derive(Debug, Clone)]
pub struct RateLimitError {
    /// Suggested delay before retrying, in milliseconds.
    pub retry_after_ms: u64,
}

/// Fixed-window rate limiter keyed by string identifiers.
struct RateLimiter {
    /// Sliding window length.
    window: Duration,
    /// Maximum requests allowed in the window.
    max_requests: usize,
    /// Timestamp queue per key.
    hits: DashMap<String, VecDeque<Instant>>,
}

impl RateLimiter {
    /// Constructs a limiter with a window length and request cap.
    fn new(window: Duration, max_requests: usize) -> Self {
        Self {
            window,
            max_requests,
            hits: DashMap::new(),
        }
    }

    /// Records a hit and returns an error if the limit is exceeded.
    fn check(&self, key: &str) -> Result<(), RateLimitError> {
        let now = Instant::now();
        let mut entry = self.hits.entry(key.to_string()).or_default();

        while let Some(front) = entry.front() {
            if now.duration_since(*front) >= self.window {
                entry.pop_front();
            } else {
                break;
            }
        }

        if entry.len() >= self.max_requests {
            let retry_after = entry
                .front()
                .map(|oldest| {
                    let elapsed = now.duration_since(*oldest);
                    self.window
                        .checked_sub(elapsed)
                        .unwrap_or_else(|| Duration::from_millis(0))
                        .as_millis() as u64
                })
                .unwrap_or(0);

            return Err(RateLimitError {
                retry_after_ms: retry_after,
            });
        }

        entry.push_back(now);
        Ok(())
    }
}

/// Rate limiters for different request categories.
pub struct RateLimitStore {
    /// Rate limit for auth attempts by IP.
    auth: RateLimiter,
    /// Rate limit for auth attempts per connection.
    auth_connection: RateLimiter,
    /// General command rate limit.
    commands: RateLimiter,
    /// Reconnect rate limit per token.
    reconnect: RateLimiter,
    /// Reconnect rate limit per IP.
    reconnect_ip: RateLimiter,
    /// Charleston pass rate limit to avoid spam.
    charleston_pass: RateLimiter,
}

impl RateLimitStore {
    /// Builds the default rate limit configuration.
    pub fn new() -> Self {
        Self {
            auth: RateLimiter::new(Duration::from_secs(60), 5),
            auth_connection: RateLimiter::new(Duration::from_secs(60), 5),
            commands: RateLimiter::new(Duration::from_secs(2), 10),
            reconnect: RateLimiter::new(Duration::from_secs(60), 5),
            reconnect_ip: RateLimiter::new(Duration::from_secs(60), 5),
            charleston_pass: RateLimiter::new(Duration::from_secs(1), 1),
        }
    }

    /// Applies auth rate limits for the given IP and connection.
    pub fn check_auth(&self, ip_key: &str, connection_key: &str) -> Result<(), RateLimitError> {
        self.auth.check(ip_key)?;
        self.auth_connection.check(connection_key)
    }

    /// Applies reconnect rate limits for the given token and IP.
    pub fn check_reconnect(&self, token_key: &str, ip_key: &str) -> Result<(), RateLimitError> {
        self.reconnect.check(token_key)?;
        self.reconnect_ip.check(ip_key)
    }

    /// Applies command rate limits, with a tighter window for Charleston passes.
    pub fn check_command(&self, key: &str, command: &GameCommand) -> Result<(), RateLimitError> {
        match command {
            GameCommand::PassTiles { .. } | GameCommand::AcceptCourtesyPass { .. } => {
                self.charleston_pass.check(key)
            }
            _ => self.commands.check(key),
        }
    }

    /// Applies a general room action rate limit.
    pub fn check_room_action(&self, key: &str) -> Result<(), RateLimitError> {
        self.commands.check(key)
    }
}

impl Default for RateLimitStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    //! Unit tests for rate limiting behavior.

    use super::*;

    /// Ensures the limiter blocks once the cap is reached.
    #[test]
    fn test_rate_limiter_blocks_after_limit() {
        let limiter = RateLimiter::new(Duration::from_secs(60), 2);
        assert!(limiter.check("player-1").is_ok());
        assert!(limiter.check("player-1").is_ok());
        assert!(limiter.check("player-1").is_err());
    }

    /// Ensures Charleston passes use the stricter limit.
    #[test]
    fn test_rate_limit_store_charleston_override() {
        let store = RateLimitStore::new();
        let cmd = GameCommand::PassTiles {
            player: mahjong_core::player::Seat::East,
            tiles: vec![],
            blind_pass_count: None,
        };

        assert!(store.check_command("player-1", &cmd).is_ok());
        assert!(store.check_command("player-1", &cmd).is_err());
    }
}
