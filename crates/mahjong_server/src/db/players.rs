use super::{parse_uuid, Database, PlayerRecord};
use chrono::Utc;
use serde_json::Value as JsonValue;
use uuid::Uuid;

impl Database {
    /// Creates or updates a player record.
    pub async fn upsert_player(
        &self,
        username: &str,
        display_name: Option<&str>,
    ) -> Result<Uuid, sqlx::Error> {
        let record: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO players (username, display_name, last_seen)
            VALUES ($1, $2, $3)
            ON CONFLICT (username) DO UPDATE
            SET display_name = COALESCE(EXCLUDED.display_name, players.display_name),
                last_seen = EXCLUDED.last_seen
            RETURNING id
            "#,
        )
        .bind(username)
        .bind(display_name)
        .bind(Utc::now())
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }

    /// Upserts a player from Auth ID (Supabase).
    pub async fn upsert_player_from_auth(
        &self,
        user_id: &str,
        email: &str,
    ) -> Result<PlayerRecord, sqlx::Error> {
        let uuid = parse_uuid(user_id)?;

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

    /// Gets a player by Supabase user ID.
    pub async fn get_player_by_user_id(
        &self,
        user_id: &str,
    ) -> Result<Option<PlayerRecord>, sqlx::Error> {
        let uuid = parse_uuid(user_id)?;

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

    /// Updates player statistics.
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

    /// Updates player statistics by Supabase user ID.
    pub async fn update_player_stats_by_user_id(
        &self,
        user_id: &str,
        stats: &JsonValue,
    ) -> Result<(), sqlx::Error> {
        let uuid = parse_uuid(user_id)?;

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

    /// Gets a player by username.
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
