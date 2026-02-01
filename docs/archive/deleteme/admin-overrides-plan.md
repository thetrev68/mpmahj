# Implementation Plan: Admin Overrides (Section 1.3)

**Task:** Implement admin override system for managing stuck games, viewing room health metrics, and administrative control.

**Status:** ✅ COMPLETED (2026-01-18)

**Implementation Summary:**

- ✅ Authorization module with role-based access control
- ✅ Three new GameEvent variants (AdminForfeitOverride, AdminPauseOverride, AdminResumeOverride)
- ✅ Five admin HTTP endpoints (forfeit, pause, resume, health, list rooms)
- ✅ TypeScript bindings auto-generated
- ✅ All workspace tests passing (55/55)

**User Decisions:**

- ✅ Role names: `admin`, `moderator`, `super_admin`
- ✅ Event visibility: Public (broadcast to all players)
- ✅ Audit strategy: Event log only
- ✅ Resume scope: Admins can resume any paused game

---

## Overview

Add admin endpoints to force-forfeit players, force-pause/resume games, and view room health metrics. Use existing JWT role claims from Supabase for authorization. Admin actions emit public GameEvents for transparency and audit trails.

**Design Principles:**

- HTTP REST endpoints (not WebSocket) for admin actions
- JWT role-based authorization using existing `Claims.role` field
- Admin actions emit new GameEvent variants (AdminForfeitOverride, etc.)
- Public events broadcast to all players for transparency
- No separate audit table - rely on existing event persistence

---

## Architecture

### Authorization Flow

```text
HTTP Request → Extract JWT → Validate token → Check role → Execute action
                    ↓
              [admin, moderator, super_admin] → Allow
              [user, guest, other] → 403 Forbidden
```text

### Event Flow

```text
Admin Action → Emit AdminXyzOverride event → Persist to game_events → Broadcast to all players
```text

### Role Permissions

- **Moderator:** Force-forfeit, force-pause/resume, view health metrics
- **Admin:** All moderator actions + list all rooms
- **Super Admin:** Reserved for future elevated privileges

---

## Implementation Steps

### Step 1: Authorization Module

**File:** `crates/mahjong_server/src/authorization.rs` (NEW)

Create authorization helper with role extraction from JWT tokens.

**Types to implement:**

```rust
pub enum Role {
    User,
    Moderator,
    Admin,
    SuperAdmin,
}

pub struct AdminContext {
    pub user_id: String,
    pub role: Role,
    pub display_name: String,
}

pub fn require_admin_role(
    headers: &HeaderMap,
    auth_state: &AuthState,
) -> Result<AdminContext, (StatusCode, String)>
```text

**Logic:**

1. Extract `Authorization: Bearer <token>` header
2. Call `auth_state.validate_token(token)` (existing method)
3. Parse `claims.role` string:
   - `"admin"` → `Role::Admin`
   - `"moderator"` → `Role::Moderator`
   - `"super_admin"` → `Role::SuperAdmin`
   - Anything else → Reject with 403 Forbidden
4. Return `AdminContext` with user info and role
5. Handle errors: Missing header → 401, Invalid token → 401, Insufficient role → 403

**Export:** Add `pub mod authorization;` to `lib.rs`

**Tests:** Unit tests for role parsing, token validation, error cases

---

### Step 2: Admin Event Types

**File:** `crates/mahjong_core/src/event.rs`

Add three new GameEvent variants for admin actions.

**Events to add:**

```rust
/// Admin forced a player to forfeit
AdminForfeitOverride {
    admin_id: String,
    admin_display_name: String,
    forfeited_player: Seat,
    reason: String,
},

/// Admin paused the game
AdminPauseOverride {
    admin_id: String,
    admin_display_name: String,
    reason: String,
},

/// Admin resumed the game
AdminResumeOverride {
    admin_id: String,
    admin_display_name: String,
},
```text

**TypeScript bindings:**

- Ensure `#[derive(TS)]` and `#[ts(export)]` attributes present
- Run: `cd crates/mahjong_core && cargo test export_bindings_gameevent`
- Verify: `apps/client/src/types/bindings/generated/GameEvent.ts` updated

**Visibility:** All admin events are Public (broadcast to all players)

**Location in file:** Add after existing admin-related events or at end of enum

---

### Step 3: Admin Handlers Module

**File:** `crates/mahjong_server/src/network/admin.rs` (NEW)

Implement 5 HTTP endpoint handlers for admin actions.

**Handlers to implement:**

#### 3.1 Force Forfeit

```rust
pub async fn admin_forfeit_player(
    Path(room_id): Path<String>,
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<ForfeitPayload>,
) -> Result<Json<SuccessResponse>, (StatusCode, String)>
```text

**Logic:**

1. Validate admin token: `require_admin_role(&headers, &state.auth)? → AdminContext`
2. Check role: Moderator+ required
3. Get room: `state.network.rooms.get_room(&room_id).ok_or(404)?`
4. Validate player seat exists in room
5. Emit event: `AdminForfeitOverride { admin_id, admin_display_name, forfeited_player: payload.player_seat, reason: payload.reason }`
6. Call existing forfeit logic: Reuse pattern from `handle_command(ForfeitGame)` in `commands.rs:174-228`
7. Broadcast event to all sessions
8. Return 200 OK: `{ "success": true, "message": "Player forfeited by admin" }`

**Request body:**

```rust
#[derive(Deserialize)]
struct ForfeitPayload {
    player_seat: Seat,
    reason: String,
}
```text

**File reference:** See existing forfeit handler at `crates/mahjong_server/src/network/commands.rs:174-228`

#### 3.2 Force Pause

```rust
pub async fn admin_pause_game(
    Path(room_id): Path<String>,
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<PausePayload>,
) -> Result<Json<SuccessResponse>, (StatusCode, String)>
```text

**Logic:**

1. Validate admin token (Moderator+)
2. Get room, check if already paused → 409 Conflict if yes
3. Update room state: `room.paused = true`, `room.paused_by = None` (admin override)
4. Emit event: `AdminPauseOverride { admin_id, admin_display_name, reason: payload.reason }`
5. Broadcast to all sessions
6. Return 200 OK

**Request body:**

```rust
#[derive(Deserialize)]
struct PausePayload {
    reason: String,
}
```text

**File reference:** See existing pause handler at `crates/mahjong_server/src/network/commands.rs:119-147`

#### 3.3 Force Resume

```rust
pub async fn admin_resume_game(
    Path(room_id): Path<String>,
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<SuccessResponse>, (StatusCode, String)>
```text

**Logic:**

1. Validate admin token (Moderator+)
2. Get room, check if paused → 409 Conflict if not paused
3. Update room state: `room.paused = false`, `room.paused_by = None`
4. Emit event: `AdminResumeOverride { admin_id, admin_display_name }`
5. Broadcast to all sessions
6. Return 200 OK

**Note:** Admin can resume ANY paused game (host-paused or admin-paused) per user decision

**File reference:** See existing resume handler at `crates/mahjong_server/src/network/commands.rs:148-173`

#### 3.4 Get Room Health

```rust
pub async fn admin_get_room_health(
    Path(room_id): Path<String>,
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<RoomHealthResponse>, (StatusCode, String)>
```text

**Logic:**

1. Validate admin token (Moderator+)
2. Get room from `RoomStore`
3. Collect metrics:
   - `room.sessions.len()` → player_count
   - `room.bot_seats.len()` → bot_count
   - `room.paused`, `room.paused_by`, `room.host_seat`
   - `room.memory_metrics()` → (analysis_kb, history_kb, total_kb)
   - `room.history.len()` → history_length
   - `room.analysis_log.len()` → analysis_log_length
   - For each session: seat, player_id, connected, last_pong
4. Return JSON response

**Response type:**

```rust
#[derive(Serialize)]
struct RoomHealthResponse {
    room_id: String,
    created_at: DateTime<Utc>,
    game_started: bool,
    player_count: usize,
    bot_count: usize,
    paused: bool,
    paused_by: Option<Seat>,
    host_seat: Option<Seat>,
    memory_kb: MemoryMetrics,
    history_length: usize,
    analysis_log_length: usize,
    connections: Vec<ConnectionInfo>,
}

#[derive(Serialize)]
struct MemoryMetrics {
    analysis: usize,
    history: usize,
    total: usize,
}

#[derive(Serialize)]
struct ConnectionInfo {
    seat: Seat,
    player_id: String,
    connected: bool,
    last_pong: DateTime<Utc>,
}
```text

**File reference:** See room fields at `crates/mahjong_server/src/network/room.rs:59-136`

#### 3.5 List All Rooms

```rust
pub async fn admin_list_rooms(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<RoomSummary>>, (StatusCode, String)>
```text

**Logic:**

1. Validate admin token (Admin+ role required - higher privilege)
2. Get all room IDs: `state.network.rooms.list_rooms()`
3. For each room, collect summary:
   - room_id, created_at, game_started, player_count, paused
4. Return array of summaries

**Response type:**

```rust
#[derive(Serialize)]
struct RoomSummary {
    room_id: String,
    created_at: DateTime<Utc>,
    game_started: bool,
    player_count: usize,
    paused: bool,
}
```text

**Note:** Future enhancement - add pagination if >100 rooms

**File reference:** See `RoomStore::list_rooms()` at `crates/mahjong_server/src/network/room_store.rs:114-117`

**Export:** Add `pub mod admin;` to `crates/mahjong_server/src/network/mod.rs`

---

### Step 4: Route Registration

**File:** `crates/mahjong_server/src/main.rs`

Add admin routes to Axum router (around line 212).

**Routes to add:**

```rust
#[cfg(feature = "database")]
let app = app
    .route("/api/replays/:game_id", get(get_player_replay))
    .route("/api/admin/replays/:game_id", get(get_admin_replay))
    .route("/api/admin/games", get(list_admin_games))
    // NEW ADMIN ROUTES:
    .route("/api/admin/rooms/:room_id/forfeit", post(admin_forfeit_player))
    .route("/api/admin/rooms/:room_id/pause", post(admin_pause_game))
    .route("/api/admin/rooms/:room_id/resume", post(admin_resume_game))
    .route("/api/admin/rooms/:room_id/health", get(admin_get_room_health))
    .route("/api/admin/rooms", get(admin_list_rooms));
```text

**Import:** Add at top of file:

```rust
use mahjong_server::network::admin::{
    admin_forfeit_player, admin_pause_game, admin_resume_game,
    admin_get_room_health, admin_list_rooms,
};
```text

**Compile check:** Run `cargo check -p mahjong_server` to verify routes compile

---

### Step 5: Visibility Logic Update

**File:** `crates/mahjong_server/src/network/visibility.rs`

Ensure admin events return `EventVisibility::Public`.

**Add cases to `compute_event_delivery()` function:**

```rust
GameEvent::AdminForfeitOverride { .. } => EventDelivery::public(),
GameEvent::AdminPauseOverride { .. } => EventDelivery::public(),
GameEvent::AdminResumeOverride { .. } => EventDelivery::public(),
```text

**Location:** Around line 50-200 in visibility.rs

**File reference:** See pattern at `crates/mahjong_server/src/network/visibility.rs`

---

### Step 6: Event Broadcasting Integration

**File:** `crates/mahjong_server/src/network/admin.rs`

In each handler, broadcast events using existing `Room::broadcast_event()` method.

**Pattern to follow:**

```rust
let event = GameEvent::AdminForfeitOverride { ... };
let delivery = compute_event_delivery(&event);
room.broadcast_event(event, delivery).await;
```text

**File reference:** See existing broadcast pattern at `crates/mahjong_server/src/network/events.rs:50-401`

**Note:** `broadcast_event()` automatically:

- Persists to database (if configured)
- Records history entry
- Broadcasts to all sessions based on visibility

---

## Testing Strategy

### Unit Tests

**File:** `crates/mahjong_server/tests/admin_tests.rs` (NEW)

**Test cases to implement:**

1. **test_admin_role_parsing**
   - Mock JWT with role: "admin" → `Role::Admin`
   - Mock JWT with role: "moderator" → `Role::Moderator`
   - Mock JWT with role: "super_admin" → `Role::SuperAdmin`
   - Mock JWT with role: "user" → Reject with 403

2. **test_admin_forfeit_authorization**
   - No token → 401 Unauthorized
   - User token → 403 Forbidden
   - Moderator token → 200 OK

3. **test_admin_forfeit_emits_event**
   - Admin forfeits player East
   - Verify `AdminForfeitOverride` event broadcast
   - Verify event persisted to database (if db enabled)

4. **test_admin_pause_double_pause**
   - Admin pauses game → Success
   - Admin pauses again → 409 Conflict

5. **test_admin_resume_not_paused**
   - Game not paused
   - Admin attempts resume → 409 Conflict

6. **test_admin_health_metrics**
   - Create room with 2 players, 2 bots
   - Call health endpoint
   - Verify response: player_count=4, bot_count=2

7. **test_admin_list_rooms**
   - Create 3 rooms
   - Call list endpoint
   - Verify all 3 rooms in response

**Helper pattern:**

```rust
// Mock JWT token with specific role
fn mock_jwt_token(role: &str) -> String {
    // Use existing auth test helpers
}

// Create test room with players
async fn setup_test_room() -> (String, Arc<NetworkState>) {
    // Use existing test setup patterns
}
```text

### Integration Tests

**File:** `crates/mahjong_server/tests/admin_integration_tests.rs` (NEW)

**Test cases to implement:**

1. **test_admin_forfeit_end_to_end**
   - Start full game (4 players, playing phase)
   - Admin calls forfeit endpoint
   - Verify: `AdminForfeitOverride` event received by all players
   - Verify: `GameOver` event emitted
   - Verify: Game finished in database with forfeit status

2. **test_admin_pause_blocks_gameplay**
   - Start game, advance to player's turn
   - Admin pauses game
   - Player attempts `DrawTile` command
   - Verify error: "Game is paused"
   - Admin resumes game
   - Player draws tile successfully

3. **test_admin_resume_host_paused_game**
   - Host pauses game (via `PauseGame` command)
   - Admin resumes game (admin override)
   - Verify: Game resumed successfully
   - Verify: `AdminResumeOverride` event broadcast

**File references:**

- See existing integration test patterns at `crates/mahjong_server/tests/stall_controls_tests.rs`
- See forfeit tests at `crates/mahjong_server/tests/forfeit_tests.rs`

---

## Verification Steps

After implementation, verify:

1. **Compilation:**

   ```bash
   cargo build --workspace
   ```

2. **Type Generation:**

   ```bash
   cd crates/mahjong_core
   cargo test export_bindings_gameevent
   # Check: apps/client/src/types/bindings/generated/GameEvent.ts
   ```

3. **Unit Tests:**

   ```bash
   cargo test admin_tests --package mahjong_server
   ```

4. **Integration Tests:**

   ```bash
   cargo test admin_integration_tests --package mahjong_server
   ```

5. **Full Test Suite:**

   ```bash
   cargo test --workspace
   ```

6. **Manual API Testing:**

   ```bash
   # Start server with Supabase configured
   export DATABASE_URL="postgresql://..."
   export SUPABASE_URL="https://..."
   cargo run -p mahjong_server

   # Get admin JWT token from Supabase (role: "moderator")
   export ADMIN_TOKEN="<jwt-token>"

   # Test forfeit endpoint
   curl -X POST http://localhost:3000/api/admin/rooms/<room_id>/forfeit \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"player_seat": "East", "reason": "Testing admin forfeit"}'

   # Expected: 200 OK with success message

   # Test health endpoint
   curl http://localhost:3000/api/admin/rooms/<room_id>/health \
     -H "Authorization: Bearer $ADMIN_TOKEN"

   # Expected: JSON with room health metrics
   ```

7. **Event Verification:**

   ```sql
   -- Check admin events in database
   SELECT * FROM game_events
   WHERE event->>'type' LIKE 'Admin%'
   ORDER BY created_at DESC;
   ```

---

## Critical Files

**New Files:**

1. `crates/mahjong_server/src/authorization.rs` - Authorization helper
2. `crates/mahjong_server/src/network/admin.rs` - Admin endpoint handlers
3. `crates/mahjong_server/tests/admin_tests.rs` - Unit tests
4. `crates/mahjong_server/tests/admin_integration_tests.rs` - Integration tests

**Modified Files:**

1. `crates/mahjong_core/src/event.rs` - Add 3 admin event variants
2. `crates/mahjong_server/src/main.rs` - Register 5 admin routes
3. `crates/mahjong_server/src/network/visibility.rs` - Add admin event visibility
4. `crates/mahjong_server/src/lib.rs` - Export authorization module
5. `crates/mahjong_server/src/network/mod.rs` - Export admin module

---

## Error Handling

**HTTP Status Codes:**

- 200 OK - Action succeeded
- 401 Unauthorized - Missing/invalid JWT
- 403 Forbidden - Insufficient role
- 404 Not Found - Room not found
- 409 Conflict - Invalid state (e.g., pause already paused)
- 500 Internal Server Error - Database/serialization error

**Error Response Format:**

```json
{
  "error": "Forbidden: Admin role required (current role: user)"
}
```text

**Logging:**

- INFO: All admin actions with admin_id, action type, target
- WARN: Authorization failures
- ERROR: Database persistence failures

---

## Security Considerations

1. **JWT Validation:** Always validate token signature via Supabase JWKS
2. **Role Enforcement:** Check role in every handler before action
3. **Audit Trail:** All admin actions persisted as events (append-only)
4. **Input Validation:** Validate room_id UUID format, seat enum, reason string length
5. **Rate Limiting:** Apply existing rate limiter to admin endpoints

---

## Documentation Updates

After implementation:

1. **Update remaining-work.md:**
   - Mark Section 1.3 as ✅ COMPLETED
   - Add implementation date

2. **Add rustdoc:**
   - Document all public types in authorization.rs
   - Document all endpoint handlers in admin.rs
   - Include examples and error cases

3. **Update CLAUDE.md:**
   - Add admin override pattern to "Common Tasks" section
   - Document role-based authorization pattern

---

## Summary

This plan implements a complete admin override system with:

- ✅ JWT role-based authorization (admin, moderator, super_admin)
- ✅ Force-forfeit, force-pause/resume endpoints
- ✅ Room health metrics endpoint
- ✅ Public events for transparency
- ✅ Event log-based audit trail
- ✅ Comprehensive test coverage

The implementation follows existing patterns (HTTP endpoints, JWT auth, event persistence) and requires no database migrations. Admin actions are transparent to players via public event broadcasts.
