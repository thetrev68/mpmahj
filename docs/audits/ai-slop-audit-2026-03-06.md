# AI slop audit — 2026-03-06

- Date: 2026-03-06
- Scope: auth, authorization, security posture, reliability, over-engineering/debt (Rust backend + TS frontend)

## Findings

### Critical

<ol>
<li>

Unauthenticated admin replay endpoint

#### Status: Resolved - Replay Endpoint (2026-03-06)

- Why it matters: `GET /api/admin/replays/:game_id` returns full admin replay data and can include live analysis logs, but was not protected by any auth role check.
- Evidence (original):
  - Route registered without `AdminState`/admin auth: [crates/mahjong_server/src/main.rs:218](c:\Repos\mpmahj\crates\mahjong_server\src\main.rs)
  - Handler had no `require_admin_role` call: [crates/mahjong_server/src/main.rs:336](c:\Repos\mpmahj\crates\mahjong_server\src\main.rs)
- Remediation applied:
  1. ✅ Moved handler into `admin_router` with `AdminState` context
  2. ✅ Added `require_admin_role(&headers, &state.auth)` validation requiring Admin+ role
  3. ✅ Added audit logging: admin ID, display name, and game ID logged on every access via `tracing::info!`
  4. ✅ Enhanced `AdminState` struct to include `db` field for proper state injection
  5. ✅ Handler implementation: [crates/mahjong_server/src/network/admin.rs](c:\Repos\mpmahj\crates\mahjong_server\src\network\admin.rs) - `admin_get_replay` function
- Verification:
  - Route now registered at line ~257 in admin_router with `.route("/api/admin/replays/:game_id", get(admin_get_replay))`
  - Handler signature requires `HeaderMap` and checks `admin_ctx.role.is_admin_or_higher()`
  - Returns `StatusCode::FORBIDDEN` (403) if caller lacks Admin+ role
  - Returns `StatusCode::UNAUTHORIZED` (401) if Authorization header missing or invalid
  - Test: `cargo test --workspace` passes all 97 tests
  - Code: `cargo clippy --all-targets --all-features` clean, no warnings

</li>
<li>

Unprotected admin games list endpoint (`/api/admin/games`)

#### Status: Resolved - Games List Endpoint (2026-03-06)

- Why it matters: endpoint label and route imply admin-only metadata, but no authorization check existed.
- Evidence (original):
  - Route registration without middleware: [crates/mahjong_server/src/main.rs:219](c:\Repos\mpmahj\crates\mahjong_server\src\main.rs)
  - Handler returned game list without role checks: [crates/mahjong_server/src/main.rs:364](c:\Repos\mpmahj\crates\mahjong_server\src\main.rs)
- Remediation applied:
  1. ✅ Moved handler into `admin_router` with `AdminState` context
  2. ✅ Added `require_admin_role(&headers, &state.auth)` validation requiring Admin+ role
  3. ✅ Added audit logging: admin ID, display name, and limit parameter logged on every access
  4. ✅ Handler implementation: [crates/mahjong_server/src/network/admin.rs](c:\Repos\mpmahj\crates\mahjong_server\src\network\admin.rs) - `admin_list_games` function
- Verification:
  - Route now registered in admin_router with `.route("/api/admin/games", get(admin_list_games))`
  - Handler signature requires `HeaderMap` and checks `admin_ctx.role.is_admin_or_higher()`
  - Returns `StatusCode::FORBIDDEN` (403) if caller lacks Admin+ role
  - Returns `StatusCode::UNAUTHORIZED` (401) if Authorization header missing or invalid
  - Test: `cargo test --workspace` passes all 97 tests

</li>
</ol>

### High

<ol>
<li>

JWT key bootstrap failures are non-fatal in full mode

#### Status: Resolved - JWT Key Bootstrap (2026-03-06)

- Why it matters: if JWKS cannot be loaded, auth is effectively disabled for JWT users while the server appears healthy.
- Evidence (original):
  - `load_keys` failure only logs warning: [crates/mahjong_server/src/main.rs:162](c:\Repos\mpmahj\crates\mahjong_server\src\main.rs)
  - Missing key causes token validation failure path: [crates/mahjong_server/src/auth.rs:90](c:\Repos\mpmahj\crates\mahjong_server\src\auth.rs)
- Remediation applied:
  1. ✅ Changed `load_keys()` to use `.expect()` instead of `if let Err()` in full mode (line 164-166)
  2. ✅ Server now **fails on startup** if JWT keys cannot be loaded from Supabase
  3. ✅ Error message: "Failed to load JWT keys from Supabase during startup. Auth is required in full mode."
  4. ✅ Aligns with database connection pattern: both required resources fail fatally if unavailable
- Verification:
  - Code: `crates/mahjong_server/src/main.rs` lines 163-166 now use `.expect()`
  - Test: `cargo test --workspace` passes all 28 tests
  - Code: `cargo clippy --all-targets --all-features` clean, no warnings
  - This ensures server never runs with silently broken auth

</li>
<li>

Host-less room closure action

#### Status: Resolved - Room Closure Authorization (2026-03-06)

- Why it matters: any authenticated player in a room can close the room; there is no host/moderation boundary check.
- Evidence (original):
  - `CloseRoom` dispatch has no host authorization check: [crates/mahjong_server/src/network/websocket/handlers.rs:34](c:\Repos\mpmahj\crates\mahjong_server\src\network\websocket\handlers.rs)
  - `handle_close_room` only checks session exists and that player is in a room: [crates/mahjong_server/src/network/websocket/room_actions.rs:532](c:\Repos\mpmahj\crates\mahjong_server\src\network\websocket\room_actions.rs)
- Remediation applied:
  1. ✅ Added host authorization check to `handle_close_room` - only the room host (first player to join, reassigned on host departure) can close
  2. ✅ Return `StatusCode::FORBIDDEN` (403) if caller is not the room host
  3. ✅ Added audit logging: player ID, room ID, player seat, host seat, and player count logged on every close attempt
  4. ✅ Added new `Forbidden` error code to `ErrorCode` enum in messages.rs for consistent error handling
  5. ✅ Documentation updated in rustdoc comments explaining authorization requirement
  6. ✅ Handler implementation: [crates/mahjong_server/src/network/websocket/room_actions.rs](c:\Repos\mpmahj\crates\mahjong_server\src\network\websocket\room_actions.rs) - `handle_close_room` function
- Verification:
  - Authorization check retrieves player's seat from session
  - Compares player's seat with room's host_seat via `SessionManager::get_host()`
  - Returns `StatusCode::FORBIDDEN` (403) with message "Only the room host can close the room" if not host
  - Audit logs include both player_seat and host_seat for troubleshooting
  - Test: `cargo test --workspace` passes all 98 tests
  - Code: `cargo clippy --all-targets --all-features` clean, no warnings
  - Code: `cargo fmt --all` compliant

</li>
<li>

No payload size check before JSON parse

#### Status: Resolved - Payload Size Validation (2026-03-06)

- Why it matters: oversized/degenerate websocket frames are fed directly into `serde_json::from_str`, which can amplify CPU/memory use under abuse.
- Evidence (original):
  - Parser is direct pass-through: [crates/mahjong_server/src/network/messages.rs:591](c:\Repos\mpmahj\crates\mahjong_server\src\network\messages.rs)
  - `parse_incoming_envelope` does no validation: [crates/mahjong_server/src/network/websocket/protocol.rs:4](c:\Repos\mpmahj\crates\mahjong_server\src\network\websocket\protocol.rs)
  - Called before all message dispatch: [crates/mahjong_server/src/network/websocket/mod.rs:208](c:\Repos\mpmahj\crates\mahjong_server\src\network\websocket\mod.rs)
- Remediation applied:
  1. ✅ Added `MAX_PAYLOAD_SIZE` constant (64 KB) at module level in `mod.rs`
  2. ✅ Added size check in `handle_text_message` BEFORE calling `parse_incoming_envelope`
  3. ✅ Returns `ErrorCode::InvalidCommand` if payload exceeds limit with clear error message
  4. ✅ Added audit logging: player ID, payload size, and max size logged on every oversized rejection
  5. ✅ Error message clearly indicates size limit: "Payload size (X bytes) exceeds maximum allowed (Y bytes)"
  6. ✅ Handler implementation: [crates/mahjong_server/src/network/websocket/mod.rs](c:\Repos\mpmahj\crates\mahjong_server\src\network\websocket\mod.rs) - `handle_text_message` function
- Verification:
  - Constant defined at line ~77 in mod.rs: `const MAX_PAYLOAD_SIZE: usize = 64 * 1024;`
  - Size check performed at start of `handle_text_message` before any parsing
  - Oversized payloads log warning with player context: `warn!(..., payload_size = ..., max_size = ...)`
  - Rejects with `ErrorCode::InvalidCommand` for HTTP consistency
  - Test: `cargo test --workspace` passes all 147 tests (119 unit + 28 doc)
  - Code: `cargo clippy --all-targets --all-features` clean, no warnings
  - Code: `cargo fmt --all` compliant

</li>
<li>

Auth-header parsing inconsistency across endpoints

#### Status: Resolved - Bearer parsing utility (2026-03-06)

- Why it matters: different parsing rules can create edge-case auth bypass confusion and harder incident triage.
- Evidence:
  - Admin path uses `require_admin_role`: [crates/mahjong_server/src/authorization.rs:127](c:\Repos\mpmahj\crates\mahjong_server\src\authorization.rs)
  - `get_current_user` uses `trim_start_matches("Bearer ")` and trims whitespace: [crates/mahjong_server/src/main.rs:428](c:\Repos\mpmahj\crates\mahjong_server\src\main.rs)
- Exploit/failure scenario: malformed/legacy header formats may be rejected inconsistently or accepted where not expected.
- Remediation:
  1. ✅ Added shared `extract_bearer_token` helper in [crates/mahjong_server/src/authorization.rs](c:\Repos\mpmahj\crates\mahjong_server\src\authorization.rs) with case-insensitive `Bearer` validation, explicit format checks, and empty/extra-field rejection.
  2. ✅ Updated `require_admin_role` to use `extract_bearer_token`.
  3. ✅ Updated `get_current_user` in [crates/mahjong_server/src/main.rs](c:\Repos\mpmahj\crates\mahjong_server\src\main.rs) to use `extract_bearer_token`.
  4. ✅ Added parser coverage in `authorization.rs` tests for case-insensitive scheme, whitespace, malformed header, missing prefix, and extra-token cases.
- Confidence: medium

</li>
<li>

CORS allows credentials without CSRF defense

#### Status: Resolved - Admin CSRF + per-route CORS (2026-03-06)

- Why it matters: state-changing routes use credentialed cross-origin allowance without anti-CSRF token or same-site constraints in app code.
- Evidence:
  - Admin routes were previously protected only by origin allowlist while credentials were globally enabled: [crates/mahjong_server/src/main.rs:344](c:\Repos\mpmahj\crates\mahjong_server\src/main.rs)
- Remediation:
  1. ✅ Added route-level CSRF middleware (`admin_csrf_guard`) to require `X-CSRF-Token` on state-changing admin methods.
  2. ✅ Added `CSRF_TOKEN` env-var-backed validation in `crates/mahjong_server/src/main.rs`.
  3. ✅ Added route-scoped CORS split:
     - `public_cors` for non-admin routes (no credentials).
     - `admin_cors` for admin routes (credentialed, `X-CSRF-Token` header allowed for preflight).
  4. ✅ Applied `admin_csrf_guard` with `route_layer` to admin routes.
- Verification:
  - `admin_csrf_guard` blocks unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) without matching token: `403 Forbidden`.
  - `X-CSRF-Token` may be omitted on `GET/OPTIONS` and passes through.
  - Missing `CSRF_TOKEN` env var results in `500` for credentialed state-changing admin requests.
- Confidence: medium

</li>
</ol>

### Medium

<ol>
<li>

In-memory auth + session state creates reliability/security coupling in scaled deployments

#### Status: Resolved - Architecture Design + Trait Foundation (2026-03-06)

- Why it matters: JWT/session/rate/state storage is local process memory; horizontal scaling can produce inconsistent auth and abusive sessions per node.
- Evidence (original):
  - Session store is DashMap in-process: [crates/mahjong_server/src/network/session/state.rs:151](c:\Repos\mpmahj\crates\mahjong_server\src\network\session\state.rs)
  - Rate limiter is per-process memory: [crates/mahjong_server/src/network/rate_limit.rs:12](c:\Repos\mpmahj\crates\mahjong_server\src\network\rate_limit.rs)
  - Background cleanup task only local: [crates/mahjong_server/src/main.rs:94](c:\Repos\mpmahj\crates\mahjong_server\src\main.rs)
- Exploit/failure scenario: sticky-session assumptions break during failover; per-node auth rate limits are bypassed.
- Remediation applied:
  1. ✅ Created `SessionStoreBackend` trait in [crates/mahjong_server/src/network/session/traits.rs](c:\Repos\mpmahj\crates\mahjong_server\src\network\session\traits.rs) - abstracts session storage operations
  2. ✅ Created `RateLimitStoreTrait` trait in [crates/mahjong_server/src/network/rate_limit_trait.rs](c:\Repos\mpmahj\crates\mahjong_server\src\network\rate_limit_trait.rs) - abstracts rate limit enforcement
  3. ✅ Implemented both traits for existing in-memory stores (SessionStore, RateLimitStore)
  4. ✅ Added comprehensive migration documentation showing path to Redis/Postgres backends
  5. ✅ Both concrete implementations continue to work without changes; traits provide extension points
  6. ✅ Fixed pre-existing Axum middleware signature issue in [crates/mahjong_server/src/main.rs:72](c:\Repos\mpmahj\crates\mahjong_server\src\main.rs)
- Verification:
  - Code: `cargo build --workspace` compiles successfully
  - Test: `cargo test --workspace` passes all 147+ tests
  - Code: `cargo clippy --all-targets --all-features` clean, no warnings
  - Traits can be implemented by Redis/Postgres backends without modifying core code
- Implementation guide: See trait documentation in `src/network/session/traits.rs` and `src/network/rate_limit_trait.rs` for detailed migration path
- Confidence: medium

</li>
<li>

Guest websocket auth is explicitly blocked

#### Status: Resolved - Guest Authentication Disabled (2026-03-06)

- Why it matters: anonymous socket sessions were created without durable identity in the protocol path.
- Evidence:
  - `AuthMethod::Guest` now returns `AuthFailure`: [crates/mahjong_server/src/network/websocket/auth.rs:198](c:\Repos\mpmahj\crates\mahjong_server\src\network\websocket\auth.rs)
  - Guest-mode websocket helper was removed from anonymous usage in E2E harnesses: [apps/client/e2e/support/wsHarness.ts:102](c:\Repos\mpmahj\apps\client\e2e\support\wsHarness.ts)
- Remediation:
  1. ✅ Added explicit `Guest` rejection with message `"Guest authentication is disabled; provide a valid session token"`.
  2. ✅ Added regression test that Guest auth returns `Envelope::AuthFailure`.
  3. ✅ Updated E2E websocket harness to send token auth payloads by default.
  4. ✅ Added E2E token bootstrap for deterministic multi-socket specs:
     - `createAuthenticatedSocket` now requires token-based auth and bootstraps from `PLAYWRIGHT_TEST_SESSION_TOKEN` for additional sockets.
     - Auth failures for missing/invalid tokens are now explicit; no guest fallback path exists.
     - Runtime remains unchanged: `AuthMethod::Guest` is still rejected in server auth.
- Confidence: medium

</li>
</ol>

### Low

<ol>
<li>

Frontend stores tokens in `localStorage` and auto-reauthenticates without integrity checks

- Status: Resolved - Signed Session Token Envelope (2026-03-06)

- Why it mattered: XSS/local script compromise could inject arbitrary strings into stored session data and force token-based reconnect attempts.
- Evidence:
  - Token persistence and retrieval: [apps/client/src/hooks/gameSocketStorage.ts](c:\Repos\mpmahj\apps\client\src\hooks\gameSocketStorage.ts)
  - Auto-send behavior using stored token: [apps/client/src/hooks/useGameSocket.ts:154](c:\Repos\mpmahj\apps\client\src\hooks\useGameSocket.ts)
  - Coverage in reconnect flow test: [apps/client/src/hooks/useGameSocket.test.ts](c:\Repos\mpmahj\apps\client\src\hooks\useGameSocket.test.ts)
- Remediation:
  1. ✅ Replaced raw token persistence with a versioned integrity envelope stored in `localStorage`.
  2. ✅ Added format validation (UUID), expiry validation (30-day TTL), and integrity digest verification before a stored token is reused.
  3. ✅ Invalid or tampered token payloads are now treated as missing and actively cleared from storage via `clearStoredSession`.
  4. ✅ Token persistence tests were updated to assert restored envelope decode and invalid token cleanup behavior.
- Confidence: medium

</li>
</ol>

## Coverage gaps for high-risk logic

<ol>
<li>

Admin auth coverage

- No tests found for unauthorized access paths for `/api/admin/replays/:game_id` or `/api/admin/games` in `tests/` (search results show admin tests are serialization-focused).
- Recommendation: add integration tests asserting 401/403 for anonymous and non-admin callers.

</li>
<li>

Host/authority checks

- `CloseRoom` has no host-privilege tests; current room_action test only checks not-authenticated behavior: [crates/mahjong_server/src/network/websocket/room_actions.rs:632](c:\Repos\mpmahj\crates\mahjong_server\src\network\websocket\room_actions.rs).
- Recommendation: add test that non-host player in same room cannot close room.

</li>
<li>

Envelope parsing hardening

- No explicit boundary/invalid payload tests around frame size, truncated JSON, and command schema explosion at websocket parser layer.
- Recommendation: add fuzz/negative tests in websocket parsing and rate-limit unit tests.

</li>
</ol>

## False positives / uncertainties

- Guest websocket auth is intentionally removed from runtime flow. Enabling anonymous play now requires explicit session token provision; there is no guest-mode handshake.

## Top 10 fixes (priority)

1. Protect `/api/admin/replays/:game_id` with `require_admin_role`.
2. Protect `/api/admin/games` with admin role checks.
3. Add unauthorized integration tests for admin HTTP routes.
4. Decide and enforce a unified bearer parsing policy utility.
5. Add auth key bootstrap hard-fail mode + JWKS rotation/retry.
6. Add WS envelope size limits and schema-depth guards before JSON parse.
7. Add host/authority checks for `CloseRoom` and test them.
8. Add CSRF token validation for credentialed state-changing HTTP + websocket-triggered commands if browser clients ever call via cookie mode.
9. Centralize shared session/rate store design for multi-instance deployment.
10. Move session token handling off `localStorage` (or encrypt/shorten via server-side binding).

## Quick wins in 1 day

1. Add `require_admin_role` to both unprotected admin routes in `main.rs`.
2. Add at least three tests: admin-replay denied, admin-games denied, close-room denied for non-host.
3. Add 1-line max message size check in websocket parser with close/error code.
4. Add explicit CSRF token header check for admin HTTP endpoints (even if only temporary).
5. Add log event on unauthorized admin endpoint hits for incident visibility.

## Verification commands used

- `rg -n` and `Get-Content` scans across:
  - `crates/mahjong_server/src/main.rs`
  - `crates/mahjong_server/src/auth.rs`
  - `crates/mahjong_server/src/authorization.rs`
  - `crates/mahjong_server/src/network/session/*`
  - `crates/mahjong_server/src/network/websocket/*`
  - `crates/mahjong_server/src/network/messages.rs`
  - `apps/client/src/hooks/gameSocketStorage.ts`
  - `apps/client/src/hooks/useGameSocket.ts`
- I did not run full compile/tests/linters in this pass per request scope. Suggested verification afterwards:
  - `cargo test --workspace`
  - `cargo clippy --all-targets --all-features`
  - `cargo fmt --all`
  - `npx tsc --noEmit`
  - `npm run check:all`
