//! Rate limiting utilities for WebSocket clients.
//!
//! This module implements per-client rate limits for auth, commands,
//! and reconnection attempts using a fixed-window counter.

use dashmap::DashMap;
use mahjong_core::command::GameCommand;
use std::collections::VecDeque;
use std::time::{Duration, Instant};

/// Error returned when a rate limit is exceeded.
#[derive(Debug, Clone)]
pub struct RateLimitError {
    pub retry_after_ms: u64,
}

struct RateLimiter {
    window: Duration,
    max_requests: usize,
    hits: DashMap<String, VecDeque<Instant>>,
}

impl RateLimiter {
    fn new(window: Duration, max_requests: usize) -> Self {
        Self {
            window,
            max_requests,
            hits: DashMap::new(),
        }
    }

    fn check(&self, key: &str) -> Result<(), RateLimitError> {
        let now = Instant::now();
        let mut entry = self
            .hits
            .entry(key.to_string())
            .or_default();

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
    auth: RateLimiter,
    auth_connection: RateLimiter,
    commands: RateLimiter,
    reconnect: RateLimiter,
    reconnect_ip: RateLimiter,
    charleston_pass: RateLimiter,
}

impl RateLimitStore {
    pub fn new() -> Self {
        Self {
            auth: RateLimiter::new(Duration::from_secs(60), 5),
            auth_connection: RateLimiter::new(Duration::from_secs(60), 5),
            commands: RateLimiter::new(Duration::from_secs(1), 10),
            reconnect: RateLimiter::new(Duration::from_secs(60), 5),
            reconnect_ip: RateLimiter::new(Duration::from_secs(60), 5),
            charleston_pass: RateLimiter::new(Duration::from_secs(1), 1),
        }
    }

    pub fn check_auth(&self, ip_key: &str, connection_key: &str) -> Result<(), RateLimitError> {
        self.auth.check(ip_key)?;
        self.auth_connection.check(connection_key)
    }

    pub fn check_reconnect(&self, token_key: &str, ip_key: &str) -> Result<(), RateLimitError> {
        self.reconnect.check(token_key)?;
        self.reconnect_ip.check(ip_key)
    }

    pub fn check_command(&self, key: &str, command: &GameCommand) -> Result<(), RateLimitError> {
        match command {
            GameCommand::PassTiles { .. } | GameCommand::AcceptCourtesyPass { .. } => {
                self.charleston_pass.check(key)
            }
            _ => self.commands.check(key),
        }
    }
}

impl Default for RateLimitStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limiter_blocks_after_limit() {
        let limiter = RateLimiter::new(Duration::from_secs(60), 2);
        assert!(limiter.check("player-1").is_ok());
        assert!(limiter.check("player-1").is_ok());
        assert!(limiter.check("player-1").is_err());
    }

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
