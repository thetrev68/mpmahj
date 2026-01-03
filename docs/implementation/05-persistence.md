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

- Every public event is appended with sequence number
- Private events are either omitted or stored with redaction

Replay uses:

- Start from initial seed + join order
- Apply events sequentially to reconstruct state

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
