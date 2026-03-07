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

- Why it matters: if JWKS cannot be loaded, auth is effectively disabled for JWT users while the server appears healthy.
- Evidence:
  - `load_keys` failure only logs warning: [crates/mahjong_server/src/main.rs:162](c:\Repos\mpmahj\crates\mahjong_server\src\main.rs)
  - Missing key causes token validation failure path: [crates/mahjong_server/src/auth.rs:90](c:\Repos\mpmahj\crates\mahjong_server\src\auth.rs)
- Exploit/failure scenario: transient Supabase outage or DNS issue causes widespread login failures without clear operational signal.
- Remediation:
  1. Fail startup unless running in explicit degraded mode, or enter degraded mode with explicit health state.
  2. Add periodic JWKS refresh and fallback strategy.
  3. Expose startup/auth-health metric.
- Confidence: high

</li>
<li>

Host-less room closure action

- Why it matters: any authenticated player in a room can close the room; there is no host/moderation boundary check.
- Evidence:
  - `CloseRoom` dispatch has no host authorization check: [crates/mahjong_server/src/network/websocket/handlers.rs:34](c:\Repos\mpmahj\crates\mahjong_server\src\network\websocket\handlers.rs)
  - `handle_close_room` only checks session exists and that player is in a room: [crates/mahjong_server/src/network/websocket/room_actions.rs:532](c:\Repos\mpmahj\crates\mahjong_server\src\network\websocket\room_actions.rs)
- Exploit/failure scenario: one player can evict all players from active room at any time.
- Remediation:
  1. Track room host/master/seat-level authority.
  2. Restrict close to host or add voting/majority policy.
  3. Emit audit event with actor and reason.
- Confidence: high

</li>
<li>

No payload size check before JSON parse

- Why it matters: oversized/degenerate websocket frames are fed directly into `serde_json::from_str`, which can amplify CPU/memory use under abuse.
- Evidence:
  - Parser is direct pass-through: [crates/mahjong_server/src/network/messages.rs:591](c:\Repos\mpmahj\crates\mahjong_server\src\network\messages.rs)
  - `parse_incoming_envelope` does no validation: [crates/mahjong_server/src/network/websocket/protocol.rs:4](c:\Repos\mpmahj\crates\mahjong_server\src\network\websocket\protocol.rs)
  - Called before all message dispatch: [crates/mahjong_server/src/network/websocket/mod.rs:208](c:\Repos\mpmahj\crates\mahjong_server\src\network\websocket\mod.rs)
- Exploit/failure scenario: WS flood with huge messages can consume parse CPU and saturate task workers.
- Remediation:
  1. Enforce frame/body size limit at transport and before JSON parse.
  2. Reject oversized/garbage quickly with specific close/error code.
  3. Add rate-limiter gating before parse where possible.
- Confidence: high

</li>
<li>

Auth-header parsing inconsistency across endpoints

- Why it matters: different parsing rules can create edge-case auth bypass confusion and harder incident triage.
- Evidence:
  - Admin path requires strict `Bearer` prefix: [crates/mahjong_server/src/authorization.rs:135](c:\Repos\mpmahj\crates\authorization.rs)
  - `get_current_user` uses `trim_start_matches("Bearer ")` and trims whitespace: [crates/mahjong_server/src/main.rs:428](c:\Repos\mpmahj\crates\mahjong_server\src\main.rs)
- Exploit/failure scenario: malformed/legacy header formats may be rejected inconsistently or accepted where not expected.
- Remediation: centralize header parsing and normalize policy (case-insensitive scheme handling, explicit format validation).
- Confidence: medium

</li>
<li>

CORS allows credentials without CSRF defense

- Why it matters: state-changing routes use credentialed cross-origin allowance without anti-CSRF token or same-site constraints in app code.
- Evidence:
  - Credentials enabled globally: [crates/mahjong_server/src/main.rs:268](c:\Repos\mpmahj\crates\mahjong_server\src\main.rs)
  - Origin allowlist only: [crates/mahjong_server/src/main.rs:265](c:\Repos\mpmahj\crates\mahjong_server\src\main.rs)
- Exploit/failure scenario: browser-based CSRF risk against replay/admin or room mutation endpoints if a trusted origin is compromised.
- Remediation: add CSRF tokens for credentialed stateful calls and enforce stricter per-route CORS policy.
- Confidence: medium

</li>
</ol>

### Medium

<ol>
<li>

In-memory auth + session state creates reliability/security coupling in scaled deployments

- Why it matters: JWT/session/rate/state storage is local process memory; horizontal scaling can produce inconsistent auth and abusive sessions per node.
- Evidence:
  - Session store is DashMap in-process: [crates/mahjong_server/src/network/session/state.rs:151](c:\Repos\mpmahj\crates\mahjong_server\src\network\session\state.rs)
  - Rate limiter is per-process memory: [crates/mahjong_server/src/network/rate_limit.rs:12](c:\Repos\mpmahj\crates\mahjong_server\src\network\rate_limit.rs)
  - Background cleanup task only local: [crates/mahjong_server/src/main.rs:94](c:\Repos\mpmahj\crates\mahjong_server\src\main.rs)
- Exploit/failure scenario: sticky-session assumptions break during failover; per-node auth rate limits are bypassed.
- Remediation: externalize sessions/rate limiting to shared store (Redis/Postgres) and make cleanup/distributed state explicit.
- Confidence: medium

</li>
<li>

Guest websocket auth is fully anonymous

- Why it matters: `AuthMethod::Guest` creates durable session ids without user identity, enabling untraceable abuse for non-game-safe environments.
- Evidence:
  - `Guest` branch accepts unauthenticated input: [crates/mahjong_server/src/network/websocket/auth.rs:199](c:\Repos\mpmahj\crates\mahjong_server\src\network\websocket\auth.rs)
  - Session/player IDs generated from random UUIDs: [crates/mahjong_server/src/network/session/state.rs:39](c:\Repos\mpmahj\crates\mahjong_server\src\network\session\state.rs)
- Exploit/failure scenario: flood attacks using disposable identities without durable attribution.
- Remediation: keep guest as explicit mode, add stricter throttles and moderation constraints per guest namespace.
- Confidence: medium

</li>
</ol>

### Low

<ol>
<li>

Frontend stores tokens in `localStorage` and auto-reauthenticates without integrity checks

- Why it matters: XSS or local script compromise exposes session tokens; protocol trusts stored values and auto-sends token auth.
- Evidence:
  - Token persistence and retrieval: [apps/client/src/hooks/gameSocketStorage.ts:7](c:\Repos\mpmahj\apps\client\src\hooks\gameSocketStorage.ts)
  - Auto-sends token auth on open: [apps/client/src/hooks/useGameSocket.ts:154](c:\Repos\mpmahj\apps\client\src\hooks\useGameSocket.ts)
- Exploit/failure scenario: script injection steals session token and resumes game session as victim.
- Remediation: move to HttpOnly cookie/session-bound token model where possible; use secure Web Storage only for non-sensitive identifiers.
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

- Guest auth risk (#9) is a design choice if anonymous play is intentionally required. If guest mode is intended, classify it as a policy/control hardening task rather than a correctness bug.

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
