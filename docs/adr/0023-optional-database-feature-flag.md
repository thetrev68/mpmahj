# ADR 0023: Optional Database Feature Flag

## Status

Accepted (Implemented 2026-01-16)

## Context

The `mahjong_server` crate was failing to compile with the error:

```text
error: `SQLX_OFFLINE=true` but there is no cached data for this query
```text

This occurred because:

1. `.cargo/config.toml` set `SQLX_OFFLINE=true` globally
2. The `.sqlx/` query cache was incomplete
3. sqlx was a required dependency with no way to disable it
4. The server architecture already supported optional database mode (`db: Option<Database>`)

More fundamentally, requiring a PostgreSQL dependency for development and testing was an unnecessary barrier. The server's architecture already treated the database as optional at runtime, but required it at compile time.

## Decision

Implement a `database` cargo feature that makes sqlx truly optional, allowing the server to compile in two modes:

### 1. Memory-Only Mode (Default)

- No PostgreSQL dependency at all
- In-memory game state only
- Perfect for development, testing, and simple deployments
- Build with: `cargo build`

### 2. Database Mode (Optional)

- Full PostgreSQL persistence via sqlx
- Event sourcing and replay functionality
- Player statistics tracking
- Build with: `cargo build --features database`

### Implementation Approach

The solution was implemented in **3 phases**:

#### Phase 1: Extract Event Delivery Types

- Created `event_delivery.rs` with `EventDelivery` and `EventVisibility`
- These types were in `db.rs` but are networking concepts, not database concepts
- Clean migration with NO re-exports ensures complete import updates
- Database-specific methods (`as_str()`, `target_player_db_value()`) gated with `#[cfg(feature = "database")]`

#### Phase 2: Add Feature Flags

- Added `[features]` to `Cargo.toml` with `database = ["sqlx"]`
- Made sqlx dependency optional
- Updated `.cargo/config.toml` to document (not enforce) offline mode

#### Phase 3: Conditional Compilation

- Gated modules: `#[cfg(feature = "database")]` on `db`, `replay`, `stats` modules
- Gated struct fields: Database handles in `Room`, `NetworkState`, `AppState`
- Gated methods: Database constructors and persistence operations
- Gated routes: Replay endpoints only available with database feature
- Gated tests: Database-dependent integration tests

### SQLX Offline Mode Support

When building with the `database` feature without a live database:

```bash
# Step 1: Generate query metadata (requires DATABASE_URL)
export DATABASE_URL="postgresql://user:pass@localhost/mahjong"
cargo sqlx prepare --features database

# Step 2: Build offline (no database needed)
SQLX_OFFLINE=true cargo build --features database
```text

This is useful for CI/CD environments and offline development.

## Alternatives Considered

### Just Update the SQLX Cache

Running `cargo sqlx prepare` would fix the immediate compilation error, but doesn't address the architectural issue: why should developers need PostgreSQL installed just to work on game logic or networking code?

**Rejected because**: It maintains the unnecessary compile-time dependency and adds friction to the development workflow.

### Always Require Database, Improve Documentation

Keep sqlx as required but improve the setup documentation and ensure `.sqlx/` cache is complete.

**Rejected because**: This makes local development harder and doesn't match the runtime architecture (database is already optional at runtime).

### Separate Binary for Database Mode

Create two separate binaries: `mahjong_server` (no DB) and `mahjong_server_db` (with DB).

**Rejected because**: Unnecessary code duplication and deployment complexity. Feature flags are the idiomatic Rust solution for optional functionality.

## Consequences

### Positive

1. **Lower Barrier to Entry**: Developers can `cargo build` without PostgreSQL installed
2. **Faster CI**: Default tests run without database setup
3. **Flexible Deployment**: Can deploy memory-only mode for simple use cases
4. **Clean Architecture**: Compile-time enforcement matches runtime optionality
5. **No Breaking Changes**: Existing code with `--features database` works identically

### Negative

1. **More Build Configurations to Test**: Must verify both modes work
2. **Conditional Compilation Complexity**: More `#[cfg(feature = "database")]` annotations
3. **Documentation Split**: Must document both modes

### Maintenance Notes

- When adding new database queries, always use `#[cfg(feature = "database")]`
- Test both modes in CI: `cargo test` and `cargo test --features database`
- Update `.sqlx/` cache when queries change: `cargo sqlx prepare --features database`
- Keep `event_delivery.rs` free of database dependencies (it's a networking concept)

## References

- Implementation commits: `2a582fe`, `fee7f64`, `7632788`
- Related ADRs:
  - [ADR-0007: Event Log Persistence](0007-event-log-persistence-and-replay.md) - Database schema design
  - [ADR-0020: Deterministic Replay Wall State](0020-deterministic-replay-wall-state.md) - Replay system
- Documentation:
  - [Cargo.toml features section](../../crates/mahjong_server/Cargo.toml)
  - [lib.rs feature flag docs](../../crates/mahjong_server/src/lib.rs)
  - [.cargo/config.toml](../../.cargo/config.toml)
```
