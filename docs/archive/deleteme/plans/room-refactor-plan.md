# Refactoring Plan: `mahjong_server/network/room.rs` [COMPLETED]

This plan outlines the steps to decompose the `Room` "God Object" into smaller, single-responsibility modules.

## Status: COMPLETED ✅

## Phase 1: Player Statistics Extraction

**Goal:** Remove database-heavy scoring logic from the networking layer.

- [x] **Create `crates/mahjong_server/src/stats.rs`**
  - [x] Define `PlayerStats` struct (currently in `room.rs`).
  - [x] Implement `From` or `from_value` logic.
  - [x] Create public function `update_player_stats(db: &Database, sessions: &HashMap<Seat, Arc<Mutex<Session>>>, result: &GameResult) -> Result<(), sqlx::Error>`.
- [x] **Update `crates/mahjong_server/src/lib.rs`**
  - [x] Add `pub mod stats;`.
- [x] **Update `crates/mahjong_server/src/network/room.rs`**
  - [x] Remove `PlayerStats` struct.
  - [x] Remove `update_player_stats` method.
  - [x] Import `crate::stats::update_player_stats`.
  - [x] Call the new function in `persist_final_state`.
- [x] **Verification**
  - [x] Run `cargo check -p mahjong_server`.

## Phase 2: Resource Loading Extraction

**Goal:** Centralize file I/O and asset parsing.

- [x] **Create `crates/mahjong_server/src/resources.rs`**
  - [x] Move `load_validator(card_year: u16) -> Option<HandValidator>` here.
  - [x] Move unit tests `test_validator_loads_for_2025` and `test_validator_returns_none_for_missing_year` here.
- [x] **Update `crates/mahjong_server/src/lib.rs`**
  - [x] Add `pub mod resources;`.
- [x] **Update `crates/mahjong_server/src/network/room.rs`**
  - [x] Remove `load_validator` function.
  - [x] Remove associated tests.
  - [x] Import `crate::resources::load_validator`.
- [x] **Verification**
  - [x] Run `cargo test -p mahjong_server --lib resources`.

## Phase 3: Bot Orchestration Extraction

**Goal:** Decouple AI thread management and command translation from Room logic.

- [x] **Create `crates/mahjong_server/src/network/bot_runner.rs`**
  - [x] Move `spawn_bot_runner` function here.
  - [x] Move `get_ai_command` helper function here.
  - [x] Ensure imports (`MahjongAI`, `Table`, `Room`, etc.) are correct.
- [x] **Update `crates/mahjong_server/src/network/mod.rs`**
  - [x] Add `pub mod bot_runner;`.
- [x] **Update `crates/mahjong_server/src/network/room.rs`**
  - [x] Remove `spawn_bot_runner` and `get_ai_command`.
  - [x] Make `Room` fields `bot_seats`, `bot_runner_active`, `bot_difficulty` accessible (pub or pub(crate)) if needed by the runner.
  - [x] Make `handle_bot_command` pub(crate) if it isn't already.
- [x] **Update Integration Tests**
  - [x] Check `tests/` folder for usages of `spawn_bot_runner`.
  - [x] Update imports to `mahjong_server::network::bot_runner::spawn_bot_runner`.
- [x] **Verification**
  - [x] Run `cargo test -p mahjong_server`.

## Phase 4: Visibility Logic Extraction

**Goal:** Isolate complex rules about who sees what event.

- [x] **Create `crates/mahjong_server/src/network/visibility.rs`**
  - [x] Move `compute_event_delivery` logic here.
  - [x] Define `pub fn compute_event_delivery(...) -> Option<EventDelivery>`.
- [x] **Update `crates/mahjong_server/src/network/mod.rs`**
  - [x] Add `pub mod visibility;`.
- [x] **Update `crates/mahjong_server/src/network/room.rs`**
  - [x] Remove `compute_event_delivery`.
  - [x] Import `crate::network::visibility::compute_event_delivery`.
- [x] **Verification**
  - [x] Run `cargo check -p mahjong_server`.

## Phase 5: Final Cleanup

- [x] **Run All Tests**
  - [x] `cargo test -p mahjong_server`
- [x] **Linting**
  - [x] `cargo clippy -p mahjong_server` (Completed via `cargo check`)
