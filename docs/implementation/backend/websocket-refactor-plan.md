# WebSocket Handler Refactor Plan

**Context**
- `crates/mahjong_server/src/network/websocket.rs` (~1.1k LOC) mixes upgrade, auth, routing, room lifecycle, command dispatch, rate limits, and send/broadcast helpers, making it hard to test or modify safely.
- Goal: isolate responsibilities, keep server-authoritative pipeline intact, improve testability and readability without changing behavior.

**Strategy**: Break into 5 stages, each independently testable and mergeable.

---

## Stage 1: Foundation - Module Structure & State

**Goal**: Set up module structure and extract stateless components.

**Files to create**:
- `network/websocket/mod.rs` (convert from file → directory)
- `network/websocket/state.rs`
- `network/websocket/responses.rs`

**Steps**:
1. Create `network/websocket/` directory and move `websocket.rs` → `websocket/mod.rs`
2. Extract `NetworkState` + constructors → `state.rs`; re-export in `mod.rs`
3. Extract `WsError`, `send_message`, `broadcast_to_room` → `responses.rs`
4. Add module doc comment in `mod.rs` describing pipeline (upgrade → auth → message loop)
5. Run tests: `cargo test -p mahjong_server`

**Success criteria**: All tests pass, no behavior change, imports work.

---

## Stage 2: Authentication Isolation

**Goal**: Extract auth flow into dedicated module.

**Files to create**:
- `network/websocket/auth.rs`

**Steps**:
1. Move `wait_for_auth_and_create_session` + `process_authenticate` → `auth.rs`
2. Keep auth-specific rate-limit checks in `auth.rs`
3. Return `(player_id, session_handle)` from auth flow
4. Update `handle_socket` to use `auth::wait_for_auth_and_create_session`
5. Add unit tests for auth failures (missing token, invalid JWT, rate-limit)
6. Run tests: `cargo test -p mahjong_server`

**Success criteria**: Auth flow isolated, tests pass, auth errors handled identically.

---

## Stage 3: Room Actions Extraction

**Goal**: Isolate room lifecycle operations.

**Files to create**:
- `network/websocket/room_actions.rs`

**Steps**:
1. Extract room handlers: `handle_create_room`, `handle_join_room`, `handle_leave_room`, `handle_close_room` → `room_actions.rs`
2. Add helper: `get_session_and_room(player_id, room_id, sessions, rooms)` to reduce duplication
3. Keep room-specific rate-limit checks in `room_actions.rs`
4. Update `handle_socket` message loop to call `room_actions::*`
5. Add unit tests for room flow edge cases (double-join, leave non-existent room)
6. Run tests: `cargo test -p mahjong_server` + integration tests

**Success criteria**: Room flows isolated, tests pass, no regression in room behavior.

---

## Stage 4: Command & Router

**Goal**: Extract command handling and create message router.

**Files to create**:
- `network/websocket/command.rs`
- `network/websocket/router.rs`
- (Optional) `network/websocket/types.rs`

**Steps**:
1. Extract `handle_command` + `map_command_error` → `command.rs`
2. (Optional) Create `ConnectionCtx { player_id, ip_key, addr }` in `types.rs` to pass context through handlers
3. Create `router.rs` with `dispatch_envelope(envelope, ctx, state)` that matches message type and delegates to submodules
4. Add centralized tracing/metrics hooks in router (entry/exit logging)
5. Refactor `handle_socket` message loop to use `router::dispatch_envelope`
6. Add unit tests for router dispatch (invalid envelope, unexpected message types)
7. Run tests: `cargo test -p mahjong_server` + integration tests

**Success criteria**: All message routing through single dispatcher, logging consistent, tests pass.

---

## Stage 5: Heartbeat & Final Cleanup

**Goal**: Clean up heartbeat handling and polish.

**Files to create**:
- `network/websocket/heartbeat.rs`

**Steps**:
1. Extract heartbeat spawn logic → `heartbeat.rs`
2. Slim `handle_socket` to: upgrade → auth → spawn heartbeat → message loop
3. Reconcile imports: use `pub(super)` for internal helpers, `pub` for public API
4. Remove any dead code or unused helpers
5. Run `cargo fmt`, `cargo clippy --fix`, `cargo test -p mahjong_server`
6. Run full integration test suite: `cargo test`
7. Update this doc with "Completed" status

**Success criteria**: Clean module structure, no clippy warnings, all tests green.

---

## Final Module Layout

After all stages:
- `network/websocket/mod.rs`: thin entry; upgrade + `handle_socket`; re-exports
- `network/websocket/state.rs`: `NetworkState` and constructors
- `network/websocket/auth.rs`: auth flow + rate-limits
- `network/websocket/router.rs`: envelope dispatch + logging/metrics
- `network/websocket/room_actions.rs`: create/join/leave/close + helpers
- `network/websocket/command.rs`: `handle_command` + error mapping
- `network/websocket/responses.rs`: `WsError`, send/broadcast helpers
- `network/websocket/heartbeat.rs`: heartbeat spawn logic
- `network/websocket/types.rs`: (optional) `ConnectionCtx`

---

## Global Notes

**For all stages**:
- Preserve server-authoritative behavior: all commands through `Room::handle_command`
- Keep rate-limit checks at existing boundaries (auth, room actions, commands)
- Run `cargo test -p mahjong_server` after each stage
- Each stage should be independently mergeable
- No behavior changes—only code organization
- **Adhere to proper rustdoc standards**: Add `///` doc comments for all public functions, modules, and types; use `//!` module-level docs; include `# Examples`, `# Errors`, `# Panics` sections where appropriate; document invariants and safety requirements

**Testing strategy**:
- Unit tests for new modules (auth failures, router dispatch, room edge cases)
- Integration tests in `tests/networking_integration.rs` should remain unchanged and pass
- Add regression tests if bugs discovered during refactor
