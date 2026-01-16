# Plan: Fix sqlx Compilation Error with Feature Flags

## Problem Statement

The `mahjong_server` crate fails to compile with the following error:

```text
error: `SQLX_OFFLINE=true` but there is no cached data for this query
```

**Root Cause:**

- `.cargo/config.toml` sets `SQLX_OFFLINE=true` globally for the crate
- The `.sqlx/` query cache is incomplete (has 8 query files but at least one query is missing)
- sqlx is currently a required dependency - there are NO feature flags to make it optional
- The server architecture already supports optional database mode (DB is `Option<Database>` in many places)

## Goal

Enable the server to compile and run in two modes:

1. **Without database feature** (`cargo build`): No PostgreSQL dependency, in-memory only
2. **With database feature** (`cargo build --features database`): Full PostgreSQL persistence

## Solution Approach

The correct solution has **3 phases**:

### Phase 1: Extract Event Delivery Types (Clean Migration)

**Why First**: `EventDelivery` and `EventVisibility` are used throughout the networking layer but are currently defined in `db.rs`. They are NOT database-specific - they control event routing in WebSockets.

**Important**: We do a clean migration with NO re-exports. This ensures all code is properly updated and prevents hidden dependencies.

**Steps:**

1. Create `crates/mahjong_server/src/event_delivery.rs` with:
   - `EventDelivery` struct
   - `EventVisibility` enum
   - Helper methods (`broadcast()`, `unicast()`)
   - Database-specific helper `target_player_db_value()` marked with `#[cfg(feature = "database")]` and `pub(crate)` visibility
   - Database-specific helper `as_str()` on `EventVisibility` marked with `#[cfg(feature = "database")]` and `pub(crate)` visibility

2. Add `pub mod event_delivery;` to `src/lib.rs`

3. Update `src/db.rs`:
   - Add import at top: `use crate::event_delivery::{EventDelivery, EventVisibility};`
   - Remove the original type definitions (lines ~30-88)
   - **DO NOT add re-exports** - this would hide incomplete migration

4. Update all imports throughout the codebase:
   - Change `use crate::db::EventDelivery` → `use crate::event_delivery::EventDelivery`
   - Change `use crate::db::{EventDelivery, EventVisibility}` → `use crate::event_delivery::{EventDelivery, EventVisibility}`
   - Files to update:
     - `src/db.rs` (import at top)
     - `src/network/analysis.rs`
     - `src/network/commands.rs`
     - `src/network/events.rs`
     - `src/network/visibility.rs`
     - `src/network/room.rs`

5. **Test**: Run `cargo build` - if it fails with "cannot find EventDelivery in db", you've found a file that needs updating (this is good - it ensures complete migration!)

6. **Verify**: Once `cargo build` succeeds, search the entire codebase for `db::EventDelivery` to ensure no imports were missed:

   ```bash
   grep -r "db::EventDelivery" crates/mahjong_server/src/
   ```

   This should return NO results.

### Phase 2: Add Feature Flags to Cargo.toml

**Steps:**

1. Update `crates/mahjong_server/Cargo.toml`:

```toml
[features]
default = []
database = ["sqlx"]

[dependencies]
# ... existing dependencies ...

# Database (optional)
sqlx = { version = "0.8", features = ["runtime-tokio-native-tls", "postgres", "uuid", "chrono", "macros", "migrate"], optional = true }
```

1. Update `.cargo/config.toml` to document offline mode (don't force it):

```toml
# Cargo configuration for mahjong_server
#
# Note: SQLX_OFFLINE environment variable can be set to skip compile-time database verification.
# This is useful for CI/CD environments or when building without database access.
#
# To use offline mode with the `database` feature:
#   1. Connect to a development database with DATABASE_URL
#   2. Run `cargo sqlx prepare --features database` to generate query metadata in .sqlx/
#   3. Set SQLX_OFFLINE=true in your environment or uncomment below
#
# Without the `database` feature, sqlx is not compiled and this setting is unnecessary.

# [env]
# SQLX_OFFLINE = "true"
```

### Phase 3: Conditional Compilation

**Steps:**

1. Update `src/lib.rs`:

```rust
pub mod analysis;
pub mod auth;
#[cfg(feature = "database")]
pub mod db;
pub mod event_delivery;  // Now always available
pub mod hint;
pub mod network;
#[cfg(feature = "database")]
pub mod replay;  // Entirely database-dependent
pub mod resources;
#[cfg(feature = "database")]
pub mod stats;  // Entirely database-dependent
```

1. Update `src/network/room.rs`:
   - Conditionally import: `#[cfg(feature = "database")] use crate::db::Database;`
   - Conditionally compile field: `#[cfg(feature = "database")] pub(crate) db: Option<Database>,`
   - Conditionally compile constructors: `#[cfg(feature = "database")] pub fn new_with_db(...)`
   - Conditionally compile database usage: `#[cfg(feature = "database")] if let Some(db) = &self.db { ... }`
   - Update struct initialization in `new_with_rules()`:

     ```rust
     Self {
         // ...
         #[cfg(feature = "database")]
         db: None,
         // ...
     }
     ```

2. Update `src/network/room_store.rs`:
   - Conditionally import: `#[cfg(feature = "database")] use crate::db::Database;`
   - Conditionally compile methods:
     - `#[cfg(feature = "database")] pub fn create_room_with_db(...)`
     - `#[cfg(feature = "database")] pub fn create_room_with_db_and_rules(...)`

3. Update `src/network/websocket.rs`:
   - Conditionally import: `#[cfg(feature = "database")] use crate::db::Database;`
   - Conditionally compile field: `#[cfg(feature = "database")] pub db: Option<Database>,`
   - Conditionally compile constructor: `#[cfg(feature = "database")] pub fn new_with_db(...)`
   - Update `NetworkState::new()`:

     ```rust
     Self {
         // ...
         #[cfg(feature = "database")]
         db: None,
         // ...
     }
     ```

4. Update `src/network/events.rs`:
   - Conditionally compile database persistence blocks:

     ```rust
     #[cfg(feature = "database")]
     if let Some(db) = &self.db {
         // ... database operations ...
     }
     ```

   - Two locations to update (around lines 330 and 425)

5. Update `src/main.rs`:
   - Conditionally import:

     ```rust
     #[cfg(feature = "database")]
     use mahjong_server::db::{Database, GameListRecord};
     #[cfg(feature = "database")]
     use mahjong_server::replay::{ReplayError, ReplayResponse, ReplayService};
     ```

   - Conditionally compile AppState field:

     ```rust
     struct AppState {
         auth: AuthState,
         network: Arc<NetworkState>,
         #[cfg(feature = "database")]
         db: Option<Database>,
     }
     ```

   - Conditionally compile database initialization in `main()` (lines 62-102)
   - Conditionally compile replay routes (keep `/ws` always available):

     ```rust
     let mut app = Router::new()
         .route("/", get(health_check))
         .route("/me", get(get_current_user))
         .route("/ws", get(websocket_handler));

     #[cfg(feature = "database")]
     {
         app = app
             .route("/api/replays/:game_id", get(get_player_replay))
             .route("/api/admin/replays/:game_id", get(get_admin_replay))
             .route("/api/admin/games", get(list_admin_games));
     }

     app.layer(CorsLayer::new()...)
        .with_state(state)
     ```

   - Conditionally compile handler functions (lines 140-250):

     ```rust
     #[cfg(feature = "database")]
     async fn get_player_replay(...) { ... }

     #[cfg(feature = "database")]
     async fn get_admin_replay(...) { ... }

     #[cfg(feature = "database")]
     async fn list_admin_games(...) { ... }

     #[cfg(feature = "database")]
     async fn ensure_game_exists(...) { ... }
     ```

## Testing Strategy

After each phase:

1. **Without database feature:**

   ```bash
   cargo clean
   cargo build --no-default-features
   cargo test --no-default-features
   ```

2. **With database feature:**

   ```bash
   cargo clean
   SQLX_OFFLINE=true cargo build --features database
   # If fails, run: cargo sqlx prepare --features database (requires live DB)
   cargo test --features database
   ```

3. **Integration tests:**
   - Verify in-memory mode works without `DATABASE_URL`
   - Verify persistence mode works with `DATABASE_URL` and `--features database`

## Key Files to Modify (in order)

### Phase 1 (No Breaking Changes)

1. `src/event_delivery.rs` (new file)
2. `src/lib.rs` (add module)
3. `src/db.rs` (add re-exports)
4. `src/network/analysis.rs` (update import)
5. `src/network/commands.rs` (update import)
6. `src/network/events.rs` (update import)
7. `src/network/visibility.rs` (update import)
8. `src/network/room.rs` (update import)

### Phase 2 (Add Feature Flag)

1. `Cargo.toml` (features + optional sqlx)
2. `.cargo/config.toml` (document offline mode)

### Phase 3 (Conditional Compilation)

1. `src/lib.rs` (conditional modules)
2. `src/network/room.rs` (conditional db field + methods)
3. `src/network/room_store.rs` (conditional db methods)
4. `src/network/websocket.rs` (conditional db field + constructor)
5. `src/network/events.rs` (conditional db blocks)
6. `src/main.rs` (conditional routes + handlers)

## Expected Outcome

After completion:

- **Default build** (`cargo build`): Compiles without sqlx, in-memory mode only
- **With database** (`cargo build --features database`): Full PostgreSQL support
- **No breaking changes**: Existing code using `crate::db::EventDelivery` continues to work
- **Clean architecture**: Database is truly optional, not just "runtime optional with compile-time dependency"

## Gotchas & Edge Cases

1. **Struct field initialization**: When adding `#[cfg(feature = "database")]` to struct fields, you MUST also conditionally initialize them in all struct literals with `#[cfg(feature = "database")]`

2. **Nested conditional blocks**: Database persistence blocks inside event handlers need wrapping, not just the function

3. **Test compilation**: Some integration tests may import database types - these tests should also be feature-gated

4. **Documentation examples**: Doc examples in `db.rs`, `replay.rs`, and `stats.rs` assume database availability - add `# #[cfg(feature = "database")]` to prevent doc-test failures

5. **Main binary**: The `main.rs` server binary realistically needs database features for full functionality, but should gracefully degrade when run without them (WebSocket-only mode)

## Alternative Considered (Rejected)

**Just update the sqlx cache**: Running `cargo sqlx prepare` would fix the immediate error, but doesn't solve the architectural issue that the server should be able to run without any database dependency at all.

## Success Criteria

- [ ] `cargo build` succeeds without connecting to any database
- [ ] `cargo build --features database` succeeds (with SQLX_OFFLINE=true or valid cache)
- [ ] All tests pass in both modes
- [ ] Server can run in memory-only mode (no DATABASE_URL required)
- [ ] Server can run with full persistence (DATABASE_URL + feature flag)
- [ ] No breaking changes to existing API surface
