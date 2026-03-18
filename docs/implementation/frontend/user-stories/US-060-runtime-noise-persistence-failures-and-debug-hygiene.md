# US-060: Runtime Noise, Persistence Failures, and Debug Hygiene

## Status

- State: Proposed
- Priority: Critical
- Batch: F
- Implementation Ready: Yes

## Problem

Manual testing is currently polluted by a mix of real failures and avoidable debug noise:

- stale session restoration warnings on connection startup
- verbose client-side event logging in development
- unconditional AI Charleston scoring dumps to stdout
- database persistence failures during room creation (`game_events_game_id_fkey`)

The result is a terminal that looks broken even before the player decides whether the actual feature
under test is working.

## Scope

**In scope:**

- Remove or gate frontend debug logging so ordinary local development does not spam the terminal.
- Remove or gate unconditional AI Charleston scoring output.
- Fix the event-persistence ordering bug that produces `game_events_game_id_fkey` failures during
  room creation.
- Tighten invalid-session restoration behavior so a stale session token is cleared and does not keep
  retriggering noisy auth failures during the same boot.
- Preserve useful warnings and errors, but make them actionable and intentional.

**Out of scope:**

- Silencing all server logging.
- General observability redesign.
- Production log ingestion or log formatting infrastructure.
- Feature changes unrelated to log hygiene or the persistence/auth failures listed here.

## Acceptance Criteria

- AC-1: Creating a room no longer logs `Failed to persist event` caused by
  `game_events_game_id_fkey`.
- AC-2: The game or room record is persisted before dependent event rows are appended, or the event
  append path otherwise guarantees foreign-key correctness.
- AC-3: Client event-bridge debug logging is off by default in ordinary development sessions.
- AC-4: If client event-bridge debug logging remains available, it is controlled by an explicit
  opt-in flag, not just `import.meta.env.DEV`.
- AC-5: AI Charleston scoring output is not printed unconditionally during normal play.
- AC-6: If AI scoring logs remain available, they are behind a debug-level tracing/logging path or
  an explicit opt-in flag.
- AC-7: A stale/invalid stored session token is cleared after authentication failure so the client
  does not keep retrying the same bad token during the same boot.
- AC-8: Session-restoration failure handling does not silently trap the app in a reconnect/noise
  loop.
- AC-9: The remaining startup/runtime logs visible during a normal local game are high-signal:
  connection established, authentication success/failure, and real server warnings/errors.

## Edge Cases

- EC-1: If database persistence is intentionally unavailable, the server logs a clear startup mode
  message once, rather than repeated runtime FK failures.
- EC-2: If a developer opts into verbose client logging, the existing event details remain available
  for debugging.
- EC-3: Clearing an invalid stored session must not also wipe a valid fresh session created later in
  the same run.
- EC-4: Debug-log suppression must not hide actual transport errors or server error envelopes.

## Primary Files (Expected)

- `apps/client/src/hooks/useGameEvents.ts`
- `apps/client/src/components/game/useGameBoardBridge.ts`
- `apps/client/src/hooks/gameSocketStorage.ts`
- `apps/client/src/hooks/useGameSocket.ts`
- `crates/mahjong_ai/src/strategies/greedy.rs`
- `crates/mahjong_core/src/bot/basic.rs`
- `crates/mahjong_server/src/network/events/mod.rs`
- `crates/mahjong_server/src/network/websocket/room_actions.rs`
- `crates/mahjong_server/src/db/events.rs`
- `crates/mahjong_server/tests/full_game_lifecycle.rs`

## Notes for Implementer

### Debug-log policy

The current `useGameEvents` wiring uses `import.meta.env.DEV` as the debug switch. That is too broad.
Local development should not automatically mean full envelope/UI-action spam.

Prefer:

- `false` by default
- explicit opt-in via env flag such as `VITE_DEBUG_GAME_EVENTS=true`

### Persistence bug handling

Do not paper over the foreign-key error by suppressing the log. The bug needs to be fixed so the
insert path becomes correct. Only after the path is correct should any log-volume adjustments be
considered.

### AI logging

The Charleston scoring dump is useful when tuning bots, not when manually testing the app. Convert
it to tracing/debug output or an explicit developer flag.

## Test Plan

- Server tests:
  - room creation path persists without `game_events_game_id_fkey`
  - invalid session restoration produces a single recoverable failure, not repeated noise
- Client tests:
  - debug logging remains silent by default
  - debug logging turns on only with the explicit flag
  - invalid stored session token is cleared on auth failure
- Manual smoke check:
  - start app
  - create room
  - run through Charleston start
  - confirm terminal is free of client event spam, AI scoring dumps, and FK persistence errors

## Verification Commands

```bash
cargo test -p mahjong_server full_game_lifecycle
cargo test -p mahjong_server history_integration_tests
cd apps/client
npx vitest run src/hooks/useGameEvents.test.ts
npx vitest run src/hooks/useGameSocket.test.ts
npx tsc --noEmit
```

---

## Codex Implementation Summary

Implemented US-060 across the requested areas.

Server-side, [room_actions.rs](C:/Repos/mpmahj/crates/mahjong_server/src/network/websocket/room_actions.rs) now persists the `games` row immediately after room creation, before any room events can be appended, and [games.rs](C:/Repos/mpmahj/crates/mahjong_server/src/db/games.rs) makes `create_game` idempotent with `ON CONFLICT DO NOTHING`. That fixes the ordering bug instead of hiding the `Failed to persist event` log path.

On the client, [useGameBoardBridge.ts](C:/Repos/mpmahj/apps/client/src/components/game/useGameBoardBridge.ts) now enables event debug logging only when `VITE_DEBUG_GAME_EVENTS === 'true'`, and the new coverage in [useGameBoardBridge.test.ts](C:/Repos/mpmahj/apps/client/src/components/game/useGameBoardBridge.test.ts) checks default-off and explicit opt-in. For stale session handling, [useGameSocket.ts](C:/Repos/mpmahj/apps/client/src/hooks/useGameSocket.ts), [gameSocketProtocol.ts](C:/Repos/mpmahj/apps/client/src/hooks/gameSocketProtocol.ts), and [gameSocketStorage.ts](C:/Repos/mpmahj/apps/client/src/hooks/gameSocketStorage.ts) now track the token used for restore and only clear storage if the failing auth token still matches the stored one, which protects EC-3. The socket tests in [useGameSocket.test.ts](C:/Repos/mpmahj/apps/client/src/hooks/useGameSocket.test.ts) cover both clearing the stale token and preserving a newer one. AI Charleston stdout dumps in [greedy.rs](C:/Repos/mpmahj/crates/mahjong_ai/src/strategies/greedy.rs) and [basic.rs](C:/Repos/mpmahj/crates/mahjong_core/src/bot/basic.rs) were converted to `log::debug!`, with `log` added to [Cargo.toml](C:/Repos/mpmahj/crates/mahjong_ai/Cargo.toml) and [Cargo.toml](C:/Repos/mpmahj/crates/mahjong_core/Cargo.toml).

Verification:

- `cargo fmt --all`
- `cargo test -p mahjong_server full_game_lifecycle` passed, but the matched test is currently `#[ignore]`
- `cargo test -p mahjong_server history_integration_tests` passed, but the filter matched `0` tests
- `npx vitest run src/hooks/useGameEvents.test.ts src/hooks/useGameSocket.test.ts` passed
- `npx vitest run src/components/game/useGameBoardBridge.test.ts` passed
- `npx tsc --noEmit` passed

I did not touch the unrelated user changes already present in the worktree.
