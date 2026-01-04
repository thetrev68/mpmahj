# Backend Remaining Work

This document captures backend gaps and wiring tasks discovered during review.

## Core Game Logic

- Win validation wired into `DeclareMahjong` (pattern validation). (Done)
  - File: `crates/mahjong_core/src/table.rs`
- Joker exchange validation is incomplete (replacement tile validation). (Done)
  - File: `crates/mahjong_core/src/table.rs`
- Draw handling is placeholder (wall exhaustion assigns fake winner). (Done)
  - File: `crates/mahjong_core/src/flow.rs`
- Scoring is not implemented in MVP.
  - File: `docs/implementation/01-game-core.md`

## Server/Network Wiring

- JWT reconnect cannot fully restore stored sessions (missing `player_id` index for stored sessions). (Done)
  - File: `crates/mahjong_server/src/network/websocket.rs`
- Final state persistence uses placeholder JSON (no full `Table` serialization). (Done)
  - File: `crates/mahjong_server/src/network/room.rs`
- Bot takeover after grace period is future work.
  - File: `docs/implementation/03-networking-imp-detail.md`

## Persistence/Replay Wiring

- State reconstruction from snapshots/events is not implemented.
  - File: `docs/implementation/05-persistence-IMPLEMENTATION-SUMMARY.md`
- Replay API endpoints (HTTP) are missing. (Done)
  - File: `docs/implementation/05-persistence-IMPLEMENTATION-SUMMARY.md`
- Player stats aggregation is not populated.
  - File: `docs/implementation/05-persistence-IMPLEMENTATION-SUMMARY.md`
- Snapshot usage is not active (schema only).
  - File: `docs/implementation/05-persistence-IMPLEMENTATION-SUMMARY.md`

## AI/Bot Scaffolds (Backend)

- Basic bot uses placeholder histogram logic.
  - File: `crates/mahjong_core/src/bot/basic.rs`
- Greedy strategy needs real pattern histogram lookup.
  - File: `crates/mahjong_ai/src/strategies/greedy.rs`
- AI wrapper TODO: wrap `BasicBot` for `mahjong_ai` trait.
  - File: `crates/mahjong_ai/src/trait.rs`
