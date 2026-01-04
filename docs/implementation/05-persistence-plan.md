# 05. Persistence + Replays - Implementation Plan

This plan translates `docs/implementation/05-persistence.md` into concrete steps and file-level guidance for the server.

## Sources

- `docs/implementation/05-persistence.md`
- `docs/architecture/03-module-architecture.md`
- `docs/architecture/09-network-protocol.md`
- `docs/architecture/06-command-event-system-api-contract.md`
- `crates/mahjong_server/Cargo.toml`

## Scope

Add persistence for completed games, event logs, and replay views (per-player) using PostgreSQL. Implement event visibility metadata and snapshot verification.

## Plan

### 1) Define database schema and migrations

Use PostgreSQL via `sqlx` (already in `mahjong_server`). Add migrations for the following tables:

`games`

- `id UUID PRIMARY KEY`
- `created_at TIMESTAMP`
- `finished_at TIMESTAMP`
- `winner_seat TEXT`
- `winning_pattern TEXT`
- `final_state JSONB`

`game_events`

- `id UUID PRIMARY KEY`
- `game_id UUID REFERENCES games(id)`
- `seq INT NOT NULL`
- `event JSONB NOT NULL`
- `visibility TEXT NOT NULL`  -- `public` or `private`
- `target_player TEXT`        -- seat for private events
- `schema_version INT NOT NULL`
- `created_at TIMESTAMP`

`players`

- `id UUID PRIMARY KEY`
- `username TEXT UNIQUE`
- `stats JSONB`

Optional (if snapshots every N events are required):

- `game_snapshots` table with `game_id`, `seq`, `state JSONB`, `created_at`.

### 2) Add persistence module to server

Create a persistence module (e.g., `crates/mahjong_server/src/db.rs`):

- DB pool initialization (`DATABASE_URL` from env)
- Insert and query helpers for games, game_events, and players
- Transaction boundaries around event inserts to keep ordering strict

### 3) Emit event log with visibility metadata

Integrate event logging in the room processing flow (`crates/mahjong_server/src/network/room.rs`).

For each `GameEvent` emitted:

- Assign a monotonically increasing `seq` per game
- Determine visibility:
  - public events: `visibility = 'public'`, `target_player = null`
  - private events: `visibility = 'private'`, `target_player = <Seat>`
- Store `event` as JSON, plus `schema_version`

Guidance:

- Centralize visibility logic in one helper (avoid duplicating rules).
- Keep sequencing strict (no parallel inserts for the same game).

### 4) Store final snapshot at game end

When the game ends (e.g., `GameOver` or `GameWon`), persist:

- `finished_at`
- `winner_seat`, `winning_pattern`
- `final_state` (serialized `Table` or server snapshot type)

### 5) Replay API (per-player view)

Add replay query functions to return a filtered event stream:

- Input: `game_id`, `viewer_seat`
- Output: ordered events where:
  - all public events are included
  - private events are included only when `target_player == viewer_seat`
  - other private events are redacted (optional: replace with `TileDrawn` with `tile: null`)

Support admin replay with all events (guarded by auth role).

### 6) Replay reconstruction

To reconstruct state:

- Start from initial seed + join order (or `game_start` snapshot)
- Apply filtered events in seq order
- Ensure end state matches `final_state` when viewer is admin (full visibility)

### 7) Schema versioning

- Add a `schema_version` constant in server code
- Persist it with each event
- Provide a migration strategy for changes in event schema

### 8) Tests

Add tests to cover:

- Sequence ordering is preserved
- Replay for a player filters private events from other players
- Replay reconstruction reaches the same state as `final_state` (full visibility)
- Event log persistence does not fail under normal load

## Open questions / decisions

- Confirm where replay endpoints live (REST vs WebSocket command). The plan assumes server-side query helpers exist; API surface can be decided later.
- Define the exact `final_state` type (serialized `Table` vs explicit snapshot struct).
- Decide whether to implement `game_snapshots` immediately or defer.

## Suggested file list

- `crates/mahjong_server/src/db.rs`
- `crates/mahjong_server/src/replay.rs` (if added)
- `crates/mahjong_server/src/network/room.rs` (event logging hook)
- `crates/mahjong_server/migrations/` (SQL migrations)
