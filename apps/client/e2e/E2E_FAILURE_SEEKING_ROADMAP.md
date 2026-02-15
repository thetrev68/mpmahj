# E2E Failure-Seeking Roadmap

Date: 2026-02-15
Workspace: `c:\Repos\mpmahj`

## Goal

Build a robust browser+server Playwright suite that catches real user-facing regressions before user testing.

## Principles

- Optimize for bug discovery, not green checks.
- Fail loudly on hangs/protocol issues/stale state/race conditions.
- Keep tests deterministic: bounded waits, explicit assertions, cleanup.
- No retry-based flake masking.

## Proposed Matrix

### Phase 1: Boot + Lobby + Room Entry (highest risk)

- `auth-lobby-boot.spec.ts`
  - Auth handshake reaches stable connected lobby.
  - Guard against `Connecting...` / `Loading game...` deadlocks.
- `room-entry.spec.ts`
  - Create room and reach `room-waiting`/`game-board` deterministically.
  - Join by room code from second client.
  - Join by deep link (`?join=1&code=XXXXX`).
  - Failure UX for room not found/full.

### Phase 2: Multi-client + Start transition

- `multiplayer-start.spec.ts`
  - Host + multiple browser clients.
  - Bot-fill path.
  - Transition to first actionable turn/state.
  - Duplicate create/join submission resilience.

### Phase 3: Reconnect/refresh recovery

- `reconnect-recovery.spec.ts`
  - Refresh recovery in lobby.
  - Refresh recovery in room waiting.
  - Recovery while in game turn.
  - No post-reconnect loading deadlocks.

### Phase 4: Protocol robustness

- `protocol-robustness.spec.ts`
  - Invalid client envelope handling.
  - Server error envelope handling.
  - Ping/pong heartbeat behavior.
  - Out-of-turn command rejection surfaced.

### Phase 5: Chaos/race/failure UX

- `race-chaos.spec.ts`
  - Rapid clicks, duplicate submissions, out-of-order stress.
  - WS/network fault injection: disconnect, delay, drop.
- `failure-modes.spec.ts`
  - stale token/session.
  - server interruption during active session.
  - leave/forfeit stable return path.

## Shared Support Utilities (target)

Create under `apps/client/e2e/support/`:

- `fixtures.ts`: deterministic setup helpers (lobby ready, create/join room, room code extraction).
- `multiclient.ts`: 2–4 isolated browser contexts + lifecycle cleanup.
- `faults.ts`: controllable WS/network faults (disconnect/delay/drop).
- `wsHarness.ts`: raw socket helpers for protocol-level assertions.
- `assertions.ts`: bounded wait + deadlock/hang guards + diagnostic capture.

## Commands / CI Readiness (target)

Update `apps/client/package.json` and root `package.json` with:

- `test:e2e:smoke`
- `test:e2e:critical`
- `test:e2e:chaos`
- `test:e2e` / `test:e2e:all`

Keep headless and self-starting via Playwright `webServer` (no manual startup).

## Validation Requirements Before Marking Complete

- Targeted spec runs for each new area.
- Full E2E pack run.
- Typecheck/lint for modified files.

## Current Session Status

- Completed:
  - Phase 1 specs implemented:
    - `apps/client/e2e/auth-lobby-boot.spec.ts`
    - `apps/client/e2e/room-entry.spec.ts`
  - Shared E2E support utilities created:
    - `apps/client/e2e/support/assertions.ts`
    - `apps/client/e2e/support/fixtures.ts`
    - `apps/client/e2e/support/multiclient.ts`
    - `apps/client/e2e/support/faults.ts`
    - `apps/client/e2e/support/wsHarness.ts`
  - Playwright config hardened for failure-seeking:
    - retries disabled
    - trace/video retained on failure
    - deterministic local WS/CORS test env
  - Scripts added:
    - `npm run test:e2e:phase1` (client + root)
    - `npm run test:e2e:critical` (client + root)
  - Docs updated:
    - `apps/client/TESTING.md` E2E section
  - Phase 2 spec implemented:
    - `apps/client/e2e/multiplayer-start.spec.ts`
  - Phase 3 spec implemented:
    - `apps/client/e2e/reconnect-recovery.spec.ts`
  - Reconnect-state assertions added:
    - `apps/client/e2e/support/assertions.ts`
      - `expectNoReconnectFallbackSurface`
      - `expectReconnectRestoredRoomSurface`
  - Scripts added:
    - `npm run test:e2e:phase2` (client + root)
    - `npm run test:e2e:phase3` (client + root)
    - `npm run test:e2e:critical` now runs phase 1 + phase 2 + phase 3
  - Bugs fixed in app/server discovered during Phase 1:
    - Join/deeplink input previously truncated to 5 uppercase chars, incompatible with server UUID room IDs.
    - Server auth rate limits now configurable via environment variables for deterministic E2E orchestration.
  - Bug fixed in app discovered during Phase 3:
    - Full refresh in-room could route users back to lobby because `roomStore.currentRoom` was not restored from `AuthSuccess.room_id/seat`; lobby now hydrates room membership on auth.
- Next:
  - Implement Phase 4 (`protocol-robustness.spec.ts`).

## Known Risk Areas to Confirm During Implementation

- Refresh/reconnect room restoration may have store hydration gaps.
- Combined “host + multiple humans + bot fill” may be constrained by current UX flow.
- True server-restart simulation may require harness-level process control.

## Next Session Starter

1. Implement support helpers first (`fixtures`, `multiclient`, `faults`, `wsHarness`, `assertions`).
2. Implement Phase 1 specs and run targeted tests.
3. Fix app bugs discovered by E2E immediately in-branch.
4. Continue through Phases 2–5 with validation after each phase.
