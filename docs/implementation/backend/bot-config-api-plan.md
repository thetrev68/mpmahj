# Bot Configuration API - Implementation Plan

**Feature:** Bot Configuration API (Section 2 of remaining-work.md)

**Status:** 🚧 IN PROGRESS

**Last Updated:** 2026-01-18

---

## Overview

**Goal:** Expose existing bot difficulty backend functionality to clients via the room creation API.

**Current State:**

- ✅ Backend has full bot difficulty support (`Room.bot_difficulty` field)
- ✅ `Room::configure_bot_difficulty()` method exists
- ❌ Client-facing API doesn't expose bot configuration
- ❌ Bot difficulty hardcoded to `Difficulty::Easy` on room creation
- ❌ No auto-fill bots option

**Target State:**

- Clients can specify bot difficulty when creating rooms
- Clients can request rooms pre-filled with bots
- TypeScript bindings auto-generated for new fields
- Full test coverage for all scenarios

---

## Implementation Sections

### 2.1 Extend CreateRoomPayload

**Status:** ✅ COMPLETED (2026-01-18)

**Location:** `crates/mahjong_server/src/network/messages.rs:181-207`

**Tasks:**

- [x] Add `bot_difficulty: Option<Difficulty>` field to `CreateRoomPayload`
  - Field defaults to `Difficulty::Easy` via `default_bot_difficulty()` helper
  - Added `#[serde(default = "default_bot_difficulty")]` attribute
  - Created helper function `fn default_bot_difficulty() -> Option<Difficulty>`
- [x] Add `fill_with_bots: bool` field to `CreateRoomPayload`
  - Field defaults to `false` via `#[serde(default)]` attribute
  - Changed from `Option<bool>` to `bool` for simpler API
- [x] Update rustdoc for `CreateRoomPayload`:
  - Added comprehensive `///` documentation with example JSON payload
  - Documented default behavior for all fields
  - Added examples showing both basic and advanced usage
  - Follows rustdoc standards (see CLAUDE.md)
- [x] Added `#[derive(Serialize, Deserialize, TS)]` to `Difficulty` enum in `mahjong_ai`
  - Added FRONTEND_INTEGRATION_POINT marker
  - Created export test: `export_bindings_difficulty()`
- [x] Fixed ts-rs export paths (relative to crate root, not source file)
  - Changed from `../../../../apps/...` to `../../../apps/...`
- [x] Generated TypeScript bindings successfully:
  - `Difficulty.ts`: Exported as union type `"Easy" | "Medium" | "Hard" | "Expert"`
  - `CreateRoomPayload.ts`: Includes `bot_difficulty` and `fill_with_bots` fields

**Example rustdoc:**

````rust
/// Payload for creating a new game room.
///
/// # Fields
///
/// - `bot_difficulty`: Optional bot AI difficulty (defaults to `Easy` if not provided)
/// - `fill_with_bots`: If `true`, automatically fills empty seats with bots (defaults to `false`)
///
/// # Example JSON
///
/// ```json
/// {
///   "bot_difficulty": "Hard",
///   "fill_with_bots": true
/// }
/// ```
````

**Acceptance Criteria:**

- ✅ `CreateRoomPayload` has two new fields (`bot_difficulty`, `fill_with_bots`)
- ✅ Fields have proper defaults and serde attributes
- ✅ Rustdoc includes comprehensive examples and field descriptions
- ✅ TypeScript bindings generated successfully

**Implementation Notes:**

- Commit: `4bc0822` - feat: expose bot difficulty configuration in CreateRoomPayload API
- Key learning: ts-rs `export_to` paths are relative to crate root (where Cargo.toml is), not source file
- TypeScript bindings:
  - [Difficulty.ts](../../../apps/client/src/types/bindings/generated/Difficulty.ts)
  - [CreateRoomPayload.ts](../../../apps/client/src/types/bindings/generated/CreateRoomPayload.ts)
- Modified files:
  - [crates/mahjong_ai/src/trait.rs](../../../crates/mahjong_ai/src/trait.rs) - Added Serialize/Deserialize/TS to Difficulty
  - [crates/mahjong_server/src/network/messages.rs](../../../crates/mahjong_server/src/network/messages.rs) - Extended CreateRoomPayload

---

### 2.2 Wire Up Room Creation Handler

**Status:** ✅ COMPLETED (2026-01-19)

**Location:** `crates/mahjong_server/src/network/websocket.rs:578-637`

**Tasks:**

- [x] Locate `handle_create_room()` function
- [x] Read `bot_difficulty` from `CreateRoomPayload`
  - If `Some(difficulty)`, call `room.configure_bot_difficulty(difficulty)`
  - If `None`, use default behavior (Easy)
- [x] Read `fill_with_bots` from `CreateRoomPayload`
  - If `true`, call `room.fill_empty_seats_with_bots()`
  - If `false`, leave room unfilled
- [x] Server-side validation:
  - Serde handles invalid `Difficulty` enum values
  - Default values applied via `default_bot_difficulty()` function
- [x] Update rustdoc for `handle_create_room()`:
  - Documented bot configuration behavior
  - Included example JSON payload showing new parameters
- [x] Error handling:
  - Bot configuration is infallible (no Result type needed)
  - Configuration happens before room join

**Implementation Notes:**

- Changed function signature from `(state, player_id, card_year)` to `(state, player_id, payload)`
- Bot difficulty configured BEFORE filling seats with bots
- Order implemented: Create room → Configure difficulty → Fill with bots → Join creator
- Updated terminal client to provide default values for new fields

**Acceptance Criteria:**

- ✅ `handle_create_room()` reads and applies bot difficulty
- ✅ `fill_with_bots` flag triggers auto-fill logic
- ✅ Invalid values rejected via serde validation
- ✅ Function documented with comprehensive rustdoc

**Modified Files:**

- [crates/mahjong_server/src/network/websocket.rs](../../../crates/mahjong_server/src/network/websocket.rs) - Updated handler function
- [crates/mahjong_server/src/network/room.rs](../../../crates/mahjong_server/src/network/room.rs) - Implemented `fill_empty_seats_with_bots()`
- [crates/mahjong_terminal/src/client.rs](../../../crates/mahjong_terminal/src/client.rs) - Fixed terminal client compatibility

**Tests Added:**

- `test_configure_bot_difficulty` - Verifies difficulty configuration
- `test_fill_empty_seats_with_bots_all_empty` - Verifies all 4 seats filled
- `test_fill_empty_seats_with_bots_idempotent` - Verifies idempotence
- `test_fill_empty_seats_with_bots_respects_humans` - Verifies bot marking logic
- `test_fill_empty_seats_with_bots_partial` - Additional edge cases

All tests passing: 254 server tests + 176 workspace tests = 430+ total

---

### 2.3 Auto-Fill Bots Logic

**Status:** ✅ COMPLETED (2026-01-19)

**Location:** `crates/mahjong_server/src/network/room.rs:579-586`

**Tasks:**

- [x] Implement `Room::fill_empty_seats_with_bots(&mut self)`
  - Iterates over all 4 seats: `for seat in Seat::all()`
  - Checks if seat is occupied: `if !self.sessions.contains_key(&seat)`
  - If empty, marks seat as bot-controlled in `self.bot_seats`
- [x] Bot runner spawning:
  - Bot runner is spawned separately when game starts (not in this method)
  - Existing `spawn_bot_runner()` function handles bot lifecycle
- [x] Add rustdoc for `fill_empty_seats_with_bots()`:
  - Explains when to call this method
  - Documents preconditions (difficulty should be set first)
  - Includes example usage
  - Follows rustdoc standards with cross-references
- [x] Handle edge cases:
  - Room already full → method does nothing (no bots marked)
  - Bots already added → method is idempotent (safe to call multiple times)
  - Human players present → only fills empty seats, respects human sessions

**Implementation Notes:**

- Method signature: `pub fn fill_empty_seats_with_bots(&mut self)` (no Result needed)
- Idempotent: safe to call multiple times
- Bots use the difficulty configured via `configure_bot_difficulty()`
- Bot runner lifecycle managed by existing `spawn_bot_runner()` function
- Simple implementation: 7 lines of code

**Acceptance Criteria:**

- ✅ `fill_empty_seats_with_bots()` fills all empty seats with bots
- ✅ Bots use the configured difficulty level (set in room.bot_difficulty)
- ✅ Method is idempotent and handles edge cases
- ✅ Rustdoc includes clear examples and preconditions

**Tests Added:**

See Section 2.2 tests (same test module covers both implementations)

---

### 2.4 Update Frontend Integration

**Status:** ⏳ PENDING - Frontend Work (Not Tracked Here)

**Location:** `apps/client/src/components/ConnectionPanel.tsx`

**Tasks:**

- [ ] Update `ConnectionPanel.tsx` to wire up bot difficulty dropdown
  - Currently UI-only, needs to send value to backend
- [ ] Wire up "Fill with Bots" checkbox to `CreateRoomPayload.fill_with_bots`
- [ ] Update TypeScript types to use generated bindings
- [ ] Add client-side validation (optional, server validates anyway)

**Implementation Notes:**

- Frontend work is tracked separately
- This section is included for completeness
- TypeScript bindings must be generated first (Section 2.1)

**Acceptance Criteria:**

- UI dropdown sends bot difficulty to backend
- Checkbox controls `fill_with_bots` field
- Client uses auto-generated TypeScript types

---

### 2.5 Testing

**Status:** ⏳ PENDING

**Location:** `crates/mahjong_server/tests/`

**Tasks:**

- [ ] Add unit tests for `CreateRoomPayload` deserialization:
  - Test default values (no fields provided)
  - Test explicit `bot_difficulty` values (Easy, Medium, Hard)
  - Test `fill_with_bots: true` and `false`
  - Test invalid JSON (should fail gracefully)
  - Test file: `crates/mahjong_server/tests/bot_config_tests.rs` (new file)
- [ ] Add integration test: Create room with Hard difficulty
  - Create room with `bot_difficulty: "Hard"`
  - Add bot to seat
  - Verify bot uses Hard AI (check bot decision-making)
  - Test file: `crates/mahjong_server/tests/bot_config_tests.rs`
- [ ] Add integration test: Create room with `fill_with_bots=true`
  - Create room with `fill_with_bots: true`
  - Verify 3 bots are automatically added (4th seat is creator)
  - Verify bots use configured difficulty
  - Test file: `crates/mahjong_server/tests/bot_config_tests.rs`
- [ ] Add integration test: Room creation with defaults
  - Create room with no bot config fields
  - Verify defaults are applied (Easy difficulty, no auto-fill)
  - Test file: `crates/mahjong_server/tests/bot_config_tests.rs`
- [ ] Add edge case tests:
  - Room already full (auto-fill does nothing)
  - Multiple calls to `fill_empty_seats_with_bots()` (idempotence)
  - Bot difficulty change after bots added (should affect future bots)

**Test Structure:**

```rust
#[cfg(test)]
mod bot_config_tests {
    use super::*;

    #[test]
    fn test_createroompayload_defaults() { /* ... */ }

    #[test]
    fn test_createroompayload_with_difficulty() { /* ... */ }

    #[tokio::test]
    async fn test_room_creation_with_hard_difficulty() { /* ... */ }

    #[tokio::test]
    async fn test_fill_with_bots_fills_empty_seats() { /* ... */ }

    #[tokio::test]
    async fn test_fill_with_bots_idempotent() { /* ... */ }
}
```

**Acceptance Criteria:**

- All unit tests pass (payload deserialization)
- Integration tests verify bot difficulty is used correctly
- Integration tests verify auto-fill works as expected
- Edge cases are covered
- Tests follow existing patterns in `crates/mahjong_server/tests/`

---

## Rustdoc Compliance Reminder

**IMPORTANT:** All public APIs must follow rustdoc standards (see [CLAUDE.md](../../CLAUDE.md)):

- ✅ Use `///` for item documentation, `//!` for module documentation
- ✅ Include examples in doc comments (` ```rust` or ` ```ignore`)
- ✅ Document all fields, parameters, and return values
- ✅ Cross-reference related types and functions
- ✅ Add `FRONTEND_INTEGRATION_POINT` markers for client-facing types
- ✅ Verify docs render correctly: `cargo doc --open --no-deps`

**Files Requiring Rustdoc Updates:**

1. `crates/mahjong_server/src/network/messages.rs` - `CreateRoomPayload` struct
2. `crates/mahjong_server/src/network/commands.rs` - `handle_create_room()` function
3. `crates/mahjong_server/src/network/room.rs` - `fill_empty_seats_with_bots()` method

---

## Implementation Order

**Recommended sequence:**

1. **Section 2.1:** Extend `CreateRoomPayload` (data structures first)
2. **Section 2.3:** Implement `fill_empty_seats_with_bots()` (backend logic)
3. **Section 2.2:** Wire up `handle_create_room()` (glue code)
4. **Section 2.5:** Add tests (verify everything works)
5. **Section 2.4:** Frontend integration (client work, tracked separately)

**Rationale:** Build from data structures → backend logic → glue code → tests → frontend

---

## Related Documentation

- **Backend Work Tracker:** [remaining-work.md](remaining-work.md)
- **Frontend Spec:** [minimal-browser-ui.md:84-94](../frontend/minimal-browser-ui.md#L84-L94)
- **Project Guidelines:** [CLAUDE.md](../../CLAUDE.md)
- **Architecture:** [docs/architecture/00-ARCHITECTURE.md](../../architecture/00-ARCHITECTURE.md)

---

## Acceptance Criteria (Overall)

Feature is complete when:

- ✅ Clients can specify bot difficulty on room creation
- ✅ Bots use the configured difficulty level
- ✅ `fill_with_bots` flag works correctly
- ✅ TypeScript bindings include new fields and are auto-generated
- ✅ All tests pass (unit + integration)
- ✅ All public APIs have rustdoc with examples
- ✅ Frontend UI is wired up (tracked separately)

---

## Notes

- This feature leverages existing bot infrastructure (`Room.bot_difficulty`, `configure_bot_difficulty()`)
- No new AI logic needed, just API surface exposure
- TypeScript bindings are auto-generated via `ts-rs` crate
- Frontend work is tracked separately (not in this plan)
- Follow existing patterns in `crates/mahjong_server/tests/` for test structure

---

**Status Legend:**

- ✅ COMPLETED
- 🚧 IN PROGRESS
- ⏳ PENDING
- ❌ BLOCKED
