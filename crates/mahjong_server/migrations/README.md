# Database Migrations

Migrations are managed by [sqlx](https://github.com/launchbrown/sqlx) and applied automatically on server startup.

## Rules

**Never modify a migration file after it has been applied to any environment.**

sqlx records a checksum of each migration when it runs. If the file changes afterward, the server will warn (or error) on startup because the stored checksum no longer matches. This is what `"migration was previously applied but has been modified"` means.

- To change the schema: add a **new** migration file.
- To fix a typo or comment in an old migration: resist the urge — it is not worth the checksum mismatch.
- If a mismatch already exists, run `sqlx migrate repair` (sqlx ≥ 0.8.x) or manually update `_sqlx_migrations.checksum` to match the current file. See project history for an example.

## Naming

```
<timestamp>_<description>.sql
```

Timestamps use the format `YYYYMMDDHHMMSS`. Descriptions use underscores. Example:

```
20260104000001_create_persistence_schema.sql
```
