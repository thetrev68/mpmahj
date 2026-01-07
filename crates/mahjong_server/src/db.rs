//! Database persistence module
//!
//! Provides PostgreSQL persistence for:
//! - Game metadata (creation, completion, winners)
//! - Event sourcing log (all game events with visibility metadata)
//! - Player stats and profiles
//! - Replay functionality (filtered event streams)

use chrono::{DateTime, Utc};
use mahjong_core::{event::GameEvent, player::Seat};
use serde_json::{json, Value as JsonValue};
use sqlx::{postgres::PgPoolOptions, FromRow, PgPool, Postgres, Transaction};
use std::time::Duration;
use uuid::Uuid;

/// Schema version for event serialization
/// Increment this when GameEvent enum changes in a breaking way
pub const SCHEMA_VERSION: i32 = 1;

/// Delivery metadata for persisted events.
///
/// This is intentionally owned by the server boundary (mahjong_server): the core
/// `GameEvent` type represents *what happened*, while delivery concerns (who can
/// see an event) depend on connection/session context.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EventVisibility {
    Public,
    Private,
}

impl EventVisibility {
    fn as_str(self) -> &'static str {
        match self {
            Self::Public => "public",
            Self::Private => "private",
        }
    }
}

/// Where an event is delivered.
///
/// - Public events are broadcast to all players.
/// - Private events are delivered only to `target_player`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EventDelivery {
    pub visibility: EventVisibility,
    pub target_player: Option<Seat>,
}

impl EventDelivery {
    #[must_use]
    pub fn broadcast() -> Self {
        Self {
            visibility: EventVisibility::Public,
            target_player: None,
        }
    }

    #[must_use]
    pub fn unicast(target_player: Seat) -> Self {
        Self {
            visibility: EventVisibility::Private,
            target_player: Some(target_player),
        }
    }

    fn target_player_db_value(self) -> Option<String> {
        self.target_player.map(|s| format!("{:?}", s))
    }
}

/// Database connection pool and query interface
#[derive(Clone, Debug)]
pub struct Database {
    pool: PgPool,
}

impl Database {
    /// Initialize database connection pool from DATABASE_URL environment variable
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(3))
            .connect(database_url)
            .await?;

        Ok(Self { pool })
    }

    /// Run migrations (call this on startup)
    pub async fn run_migrations(&self) -> Result<(), sqlx::Error> {
        sqlx::migrate!("./migrations").run(&self.pool).await?;
        Ok(())
    }

    /// Get a reference to the connection pool
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    // ========================================================================
    // Game CRUD operations
    // ========================================================================

    /// Create a new game record
    pub async fn create_game(&self, game_id: &str) -> Result<(), sqlx::Error> {
        let uuid = Uuid::parse_str(game_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        sqlx::query(
            r#"
            INSERT INTO games (id, created_at)
            VALUES ($1, $2)
            "#,
        )
        .bind(uuid)
        .bind(Utc::now())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Update game with final state when it ends
    /// Update game with final state when it ends
    pub async fn finish_game(
        &self,
        game_id: &str,
        winner_seat: Option<Seat>,
        winning_pattern: Option<&str>,
        final_state: &JsonValue,
        card_year: u16,
        timer_mode: &str,
    ) -> Result<(), sqlx::Error> {
        let uuid = Uuid::parse_str(game_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        let winner_str = winner_seat.map(|s| format!("{:?}", s));

        // Extend final state with ruleset metadata
        let mut extended_state = final_state.clone();
        if let Some(obj) = extended_state.as_object_mut() {
            obj.insert(
                "ruleset_metadata".to_string(),
                json!({
                    "card_year": card_year,
                    "timer_mode": timer_mode,
                }),
            );
        }

        sqlx::query(
            r#"
            UPDATE games
            SET finished_at = $1,
                winner_seat = $2,
                winning_pattern = $3,
                final_state = $4
            WHERE id = $5
            "#,
        )
        .bind(Utc::now())
        .bind(winner_str)
        .bind(winning_pattern)
        .bind(extended_state)
        .bind(uuid)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get game metadata by ID
    pub async fn get_game(&self, game_id: &str) -> Result<Option<GameRecord>, sqlx::Error> {
        let uuid = Uuid::parse_str(game_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        let record = sqlx::query_as!(
            GameRecord,
            r#"
            SELECT id, created_at, finished_at, winner_seat, winning_pattern, final_state
            FROM games
            WHERE id = $1
            "#,
            uuid
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(record)
    }

    /// List recent games for admin tooling.
    pub async fn list_recent_games(&self, limit: i64) -> Result<Vec<GameListRecord>, sqlx::Error> {
        let rows = sqlx::query_as!(
            GameListRecord,
            r#"
            SELECT id, created_at, finished_at, winner_seat, winning_pattern
            FROM games
            ORDER BY created_at DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    // ========================================================================
    // Event log operations
    // ========================================================================

    /// Append a game event to the log
    ///
    /// This is the core event sourcing operation. Events are stored with:
    /// - Monotonically increasing sequence number
    /// - Visibility metadata (public/private)
    /// - Target player for private events
    pub async fn append_event(
        &self,
        game_id: &str,
        seq: i32,
        event: &GameEvent,
        delivery: EventDelivery,
        tx: Option<&mut Transaction<'_, Postgres>>,
    ) -> Result<(), sqlx::Error> {
        let uuid = Uuid::parse_str(game_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        let event_json = serde_json::to_value(event).map_err(|e| {
            sqlx::Error::Encode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Failed to serialize event: {}", e),
            )))
        })?;

        let visibility = delivery.visibility.as_str();
        let target_player = delivery.target_player_db_value();

        let query = sqlx::query!(
            r#"
            INSERT INTO game_events (game_id, seq, event, visibility, target_player, schema_version)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
            uuid,
            seq,
            event_json,
            visibility,
            target_player,
            SCHEMA_VERSION
        );

        match tx {
            Some(transaction) => query.execute(&mut **transaction).await?,
            None => query.execute(&self.pool).await?,
        };

        Ok(())
    }

    /// Append multiple events in a single transaction
    ///
    /// This ensures atomic event log appends and maintains strict ordering
    pub async fn append_events(
        &self,
        game_id: &str,
        events: &[(i32, GameEvent, EventDelivery)],
    ) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        for (seq, event, delivery) in events {
            self.append_event(game_id, *seq, event, *delivery, Some(&mut tx))
                .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    /// Get event count for a game
    pub async fn get_event_count(&self, game_id: &str) -> Result<i32, sqlx::Error> {
        let uuid = Uuid::parse_str(game_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        let count: i32 = sqlx::query_scalar!(
            r#"
            SELECT get_game_event_count($1) as "count!"
            "#,
            uuid
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(count)
    }

    // ========================================================================
    // Replay operations
    // ========================================================================

    /// Get filtered event stream for a specific player (respects privacy)
    ///
    /// Returns:
    /// - All public events
    /// - Private events targeted at the viewer
    /// - Events are ordered by sequence number
    pub async fn get_player_replay(
        &self,
        game_id: &str,
        viewer_seat: Seat,
    ) -> Result<Vec<EventRecord>, sqlx::Error> {
        let uuid = Uuid::parse_str(game_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        let viewer_str = format!("{:?}", viewer_seat);

        let records = sqlx::query_as::<_, EventRecord>(
            r#"
            SELECT id, seq, event, visibility, target_player, created_at
            FROM get_player_replay_events($1, $2)
            "#,
        )
        .bind(uuid)
        .bind(viewer_str)
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    /// Get complete event stream (admin access, no privacy filtering)
    pub async fn get_admin_replay(&self, game_id: &str) -> Result<Vec<EventRecord>, sqlx::Error> {
        let uuid = Uuid::parse_str(game_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        let records = sqlx::query_as::<_, EventRecord>(
            r#"
            SELECT id, seq, event, visibility, target_player, created_at
            FROM get_admin_replay_events($1)
            "#,
        )
        .bind(uuid)
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    // ========================================================================
    // Snapshot operations (optional, for performance)
    // ========================================================================

    /// Store a game state snapshot at a specific sequence number
    pub async fn save_snapshot(
        &self,
        game_id: &str,
        seq: i32,
        state: &JsonValue,
    ) -> Result<(), sqlx::Error> {
        let uuid = Uuid::parse_str(game_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        sqlx::query!(
            r#"
            INSERT INTO game_snapshots (game_id, seq, state)
            VALUES ($1, $2, $3)
            ON CONFLICT (game_id, seq) DO UPDATE
            SET state = EXCLUDED.state
            "#,
            uuid,
            seq,
            state
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get the latest snapshot before or at a given sequence number
    pub async fn get_latest_snapshot(
        &self,
        game_id: &str,
        before_seq: i32,
    ) -> Result<Option<SnapshotRecord>, sqlx::Error> {
        let uuid = Uuid::parse_str(game_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        let record = sqlx::query_as!(
            SnapshotRecord,
            r#"
            SELECT id, game_id, seq, state, created_at
            FROM game_snapshots
            WHERE game_id = $1 AND seq <= $2
            ORDER BY seq DESC
            LIMIT 1
            "#,
            uuid,
            before_seq
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(record)
    }

    // ========================================================================
    // Player operations
    // ========================================================================

    /// Create or update a player record
    pub async fn upsert_player(
        &self,
        username: &str,
        display_name: Option<&str>,
    ) -> Result<Uuid, sqlx::Error> {
        let record = sqlx::query!(
            r#"
            INSERT INTO players (username, display_name, last_seen)
            VALUES ($1, $2, $3)
            ON CONFLICT (username) DO UPDATE
            SET display_name = COALESCE(EXCLUDED.display_name, players.display_name),
                last_seen = EXCLUDED.last_seen
            RETURNING id
            "#,
            username,
            display_name,
            Utc::now()
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(record.id)
    }

    /// Upsert player from Auth ID (Supabase)
    pub async fn upsert_player_from_auth(
        &self,
        user_id: &str,
        email: &str,
    ) -> Result<PlayerRecord, sqlx::Error> {
        let uuid = Uuid::parse_str(user_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        // Note: The trigger 'on_auth_user_created' might have already created the row
        // if the user just signed up. But if they signed up before we added the trigger
        // or if we need to sync data, we upsert here.
        // We assume 'username' is email for now as per trigger logic.
        let record = sqlx::query_as::<_, PlayerRecord>(
            r#"
            INSERT INTO players (user_id, username, last_seen)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE
            SET last_seen = EXCLUDED.last_seen
            RETURNING id, username, display_name, stats, created_at, last_seen
            "#,
        )
        .bind(uuid)
        .bind(email)
        .bind(Utc::now())
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }

    /// Get player by Supabase user_id.
    pub async fn get_player_by_user_id(
        &self,
        user_id: &str,
    ) -> Result<Option<PlayerRecord>, sqlx::Error> {
        let uuid = Uuid::parse_str(user_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        let record = sqlx::query_as::<_, PlayerRecord>(
            r#"
            SELECT id, username, display_name, stats, created_at, last_seen
            FROM players
            WHERE user_id = $1
            "#,
        )
        .bind(uuid)
        .fetch_optional(&self.pool)
        .await?;

        Ok(record)
    }

    /// Update player statistics
    pub async fn update_player_stats(
        &self,
        username: &str,
        stats: &JsonValue,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE players
            SET stats = $1
            WHERE username = $2
            "#,
        )
        .bind(stats)
        .bind(username)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Update player statistics by Supabase user_id.
    pub async fn update_player_stats_by_user_id(
        &self,
        user_id: &str,
        stats: &JsonValue,
    ) -> Result<(), sqlx::Error> {
        let uuid = Uuid::parse_str(user_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        sqlx::query(
            r#"
            UPDATE players
            SET stats = $1
            WHERE user_id = $2
            "#,
        )
        .bind(stats)
        .bind(uuid)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get player by username
    pub async fn get_player(&self, username: &str) -> Result<Option<PlayerRecord>, sqlx::Error> {
        let record = sqlx::query_as::<_, PlayerRecord>(
            r#"
            SELECT id, username, display_name, stats, created_at, last_seen
            FROM players
            WHERE username = $1
            "#,
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await?;

        Ok(record)
    }
}

// ============================================================================
// Record types for database queries
// ============================================================================

#[derive(Debug, Clone, serde::Serialize, FromRow)]
pub struct GameRecord {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub winner_seat: Option<String>,
    pub winning_pattern: Option<String>,
    pub final_state: Option<JsonValue>,
}

#[derive(Debug, Clone, serde::Serialize, FromRow)]
pub struct GameListRecord {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub winner_seat: Option<String>,
    pub winning_pattern: Option<String>,
}

#[derive(Debug, Clone, FromRow)]
pub struct EventRecord {
    pub id: Uuid,
    pub seq: i32,
    pub event: JsonValue,
    pub visibility: String,
    pub target_player: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct SnapshotRecord {
    pub id: Uuid,
    pub game_id: Uuid,
    pub seq: i32,
    pub state: JsonValue,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct PlayerRecord {
    pub id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub stats: Option<JsonValue>,
    pub created_at: DateTime<Utc>,
    pub last_seen: Option<DateTime<Utc>>,
}

// ============================================================================
// Helper functions
// ============================================================================
// Note: Table serialization is handled by serde_json::to_value() directly
// since Table implements Serialize via the mahjong_core crate

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires DATABASE_URL to be set
    async fn test_database_connection() {
        let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set");
        let db = Database::new(&db_url).await.unwrap();
        assert!(!db.pool().is_closed());
    }

    #[tokio::test]
    #[ignore] // Requires DATABASE_URL and migrations
    async fn test_create_and_get_game() {
        let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set");
        let db = Database::new(&db_url).await.unwrap();
        db.run_migrations().await.unwrap();

        let game_id = Uuid::new_v4().to_string();
        db.create_game(&game_id).await.unwrap();

        let game = db.get_game(&game_id).await.unwrap();
        assert!(game.is_some());
        assert_eq!(game.unwrap().id.to_string(), game_id);
    }

    #[tokio::test]
    #[ignore] // Requires DATABASE_URL
    async fn test_ruleset_persistence() {
        let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set");
        let db = Database::new(&db_url).await.unwrap();
        db.run_migrations().await.unwrap();

        let game_id = Uuid::new_v4().to_string();
        db.create_game(&game_id).await.unwrap();

        let final_state = serde_json::json!({
            "game_id": game_id,
            "phase": "GameOver",
        });

        db.finish_game(
            &game_id,
            Some(Seat::East),
            Some("2025-GRP1-H1"),
            &final_state,
            2025,
            "Visible",
        )
        .await
        .unwrap();

        // Verify persistence
        let game = db.get_game(&game_id).await.unwrap().unwrap();
        assert!(game.final_state.is_some());

        let state = game.final_state.unwrap();
        let ruleset_meta = state.get("ruleset_metadata").unwrap();
        assert_eq!(ruleset_meta.get("card_year").unwrap(), 2025);
        assert_eq!(ruleset_meta.get("timer_mode").unwrap(), "Visible");
    }
}
