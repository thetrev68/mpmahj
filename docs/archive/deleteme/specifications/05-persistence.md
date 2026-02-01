# 05. Persistence + Replays Implementation Spec

This document specifies persistence and replay behavior.

---

## 1. Persistence Goals

- Save completed games for review
- Enable replay via event log
- Store player stats

---

## 2. Data Model (PostgreSQL)

Tables:

- `games`
  - `id UUID`
  - `created_at TIMESTAMP`
  - `finished_at TIMESTAMP`
  - `winner_seat TEXT`
  - `winning_pattern TEXT`
  - `final_state JSONB`

- `game_events`
  - `id UUID`
  - `game_id UUID`
  - `seq INT`
  - `event JSONB`
  - `created_at TIMESTAMP`

- `players`
  - `id UUID`
  - `username TEXT UNIQUE`
  - `stats JSONB`

---

## 3. Event Log

- Every event (public and private) is appended with sequence number
- Events include visibility metadata: `{ event_data, visibility: "public" | "private", target_player?: Seat }`

Storage Schema:

```json
{
  "id": "uuid",
  "game_id": "uuid",
  "seq": 42,
  "event": { "type": "TileDrawn", "tile": { "suit": "Dots", "rank": 5 }, "remaining_tiles": 83 },
  "visibility": "private",
  "target_player": "East",
  "created_at": "2025-01-02T12:34:56Z"
}
```text

Replay Privacy:

- Replays are **per-player** - each player gets their own replay view
- When player views replay:
  - Show all public events
  - Show private events where `target_player == viewing_player`
  - Hide other players' private events (show "East drew a tile" instead of revealing tile)
- Full admin replay (all events visible) requires special permission

Replay Reconstruction:

- Start from initial seed + join order
- Apply events sequentially to reconstruct state
- Filter events by viewer's perspective

---

## 4. Save Points

- Save full snapshot at game end
- Optionally snapshot every N events for large replays

---

## 5. Versioning

- Each event log includes `schema_version`
- Migrations required if event schema changes

---

## 6. Testing Checklist

- Replay produces final state equal to stored snapshot
- Event sequence ordering preserved
- Private events not leaked
