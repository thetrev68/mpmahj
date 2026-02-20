use super::{parse_uuid, Database, SCHEMA_VERSION};
use crate::event_delivery::EventDelivery;
use mahjong_core::event::Event;
use sqlx::{Postgres, Transaction};

impl Database {
    /// Appends a game event to the log.
    ///
    /// This is the core event sourcing operation. Events are stored with:
    /// - Monotonically increasing sequence number
    /// - Visibility metadata (public/private)
    /// - Target player for private events
    pub async fn append_event(
        &self,
        game_id: &str,
        seq: i32,
        event: &Event,
        delivery: EventDelivery,
        tx: Option<&mut Transaction<'_, Postgres>>,
    ) -> Result<(), sqlx::Error> {
        let uuid = parse_uuid(game_id)?;

        let event_json = serde_json::to_value(event).map_err(|e| {
            sqlx::Error::Encode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Failed to serialize event: {}", e),
            )))
        })?;

        let visibility = delivery.visibility.as_str();
        let target_player = delivery.target_player_db_value();

        let query = sqlx::query(
            r#"
            INSERT INTO game_events (game_id, seq, event, visibility, target_player, schema_version)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(uuid)
        .bind(seq)
        .bind(event_json)
        .bind(visibility)
        .bind(target_player)
        .bind(SCHEMA_VERSION);

        match tx {
            Some(transaction) => query.execute(&mut **transaction).await?,
            None => query.execute(&self.pool).await?,
        };

        Ok(())
    }

    /// Appends multiple events in a single transaction.
    ///
    /// This ensures atomic event log appends and maintains strict ordering
    pub async fn append_events(
        &self,
        game_id: &str,
        events: &[(i32, Event, EventDelivery)],
    ) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        for (seq, event, delivery) in events {
            self.append_event(game_id, *seq, event, *delivery, Some(&mut tx))
                .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    /// Gets the event count for a game.
    pub async fn get_event_count(&self, game_id: &str) -> Result<i32, sqlx::Error> {
        let uuid = parse_uuid(game_id)?;

        let count: i32 = sqlx::query_scalar(
            r#"
            SELECT get_game_event_count($1) as "count!"
            "#,
        )
        .bind(uuid)
        .fetch_one(&self.pool)
        .await?;

        Ok(count)
    }
}
