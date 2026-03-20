# US-074: Event Bridge Logging Discipline and Debug Gating

## Status

- State: Proposed
- Priority: Medium
- Batch: J
- Implementation Ready: Yes

## Problem

Frontend WebSocket and event-bridge code still mixes three logging modes:

- always-on `console.log` / `console.warn` / `console.info` in runtime paths
- debug-gated logs behind `VITE_DEBUG_GAME_EVENTS`
- error reporting that should remain visible regardless of debug mode

The current state is inconsistent. Some event-flow diagnostics are already gated in
`useGameEvents.ts` and `eventDispatchers.ts`, while related connection and decoding paths still
emit directly. This makes production noise harder to reason about and weakens the intended
contract from US-060 that routine event tracing should be opt-in.

## Scope

**In scope:**

- Audit frontend runtime logging in the WebSocket / event-bridge path:
  - `apps/client/src/hooks/useGameSocket.ts`
  - `apps/client/src/hooks/gameSocketProtocol.ts`
  - `apps/client/src/components/game/useGameBoardBridge.ts`
  - `apps/client/src/lib/game-events/eventDispatchers.ts`
  - `apps/client/src/hooks/useGameEvents.ts`
- Define three categories:
  - debug-only trace logs
  - always-on warnings/errors for real failures
  - logs that should be removed entirely
- Apply a single consistent gating mechanism for debug trace logs.
- Preserve actionable error visibility for failed socket/auth/decode paths.
- Add or update tests where logging behavior is part of the contract.

**Out of scope:**

- Adding a third-party logging library.
- Backend logging changes.
- Refactoring unrelated feature modules that happen to call `console.warn` for localStorage or
  audio fallback behavior.

## Acceptance Criteria

- AC-1: Routine event-trace logs in the game event bridge do not emit unless the debug flag is
  enabled.
- AC-2: Actual failure paths still surface via `console.warn` or `console.error` when appropriate.
- AC-3: Logging behavior is consistent across `useGameEvents`, dispatcher, bridge, and socket
  layers for the same event flow.
- AC-4: No always-on `console.log` remains in the audited event-bridge files.
- AC-5: Tests cover at least one debug-enabled path and one debug-disabled path.

## Edge Cases

- EC-1: Injected test/offline WebSockets still reject malformed inbound payloads without throwing.
- EC-2: Reconnect, auth-failure, and protocol-decode errors remain visible even when debug is off.

## Primary Files (Expected)

- `apps/client/src/hooks/useGameEvents.ts`
- `apps/client/src/lib/game-events/eventDispatchers.ts`
- `apps/client/src/components/game/useGameBoardBridge.ts`
- `apps/client/src/hooks/useGameSocket.ts`
- `apps/client/src/hooks/useGameSocket.test.ts`
- `apps/client/src/hooks/useGameEvents.test.ts`

## Notes for Implementer

Keep the policy simple:

- `console.error` for failures the user or developer should always notice
- `console.warn` for degraded-but-recoverable runtime issues
- debug-only helper for event traces and lifecycle chatter

Do not spread `import.meta.env` checks through every file. Thread one resolved debug boolean into
the bridge layers that need it.

## Test Plan

- Assert trace logging stays silent when debug is false.
- Assert trace logging emits when debug is true.
- Assert malformed inbound message handling still warns in non-debug mode.
- Assert connection/auth failures still error in non-debug mode.

## Verification Commands

```bash
npx vitest run apps/client/src/hooks/useGameEvents.test.ts apps/client/src/hooks/useGameSocket.test.ts
npx tsc --noEmit
```

## Implementation Summary

Status: Complete

### Changes Made

| File | Change |
|---|---|
| `apps/client/src/hooks/gameSocketTypes.ts` | Added `debug?: boolean` to `UseGameSocketOptions` |
| `apps/client/src/hooks/useGameSocket.ts` | Extracts `debug` (defaults to `VITE_DEBUG_GAME_EVENTS`), gates `console.log('WebSocket connected')`, threads debug to protocol |
| `apps/client/src/hooks/gameSocketProtocol.ts` | Accepts `debug` in options, gates `console.debug('[WS] received envelope:')` behind it; `console.error` (AuthFailure) and `console.warn` (malformed messages) remain always-on |
| `apps/client/src/lib/game-events/eventDispatchers.ts` | Made server error `console.warn` always-on (was debug-gated); `ALREADY_SUBMITTED` info remains debug-only |
| `apps/client/src/hooks/useGameSocket.test.ts` | Added 6 tests in `debug logging gating (US-074)` describe block |

### AC Walkthrough

- **AC-1**: Trace logs (`WebSocket connected`, `received envelope:`, subscription lifecycle, command sending, UI action dispatch) only emit when `VITE_DEBUG_GAME_EVENTS=true`. ✓
- **AC-2**: `console.error` for AuthFailure, `console.warn` for malformed inbound messages and server error envelopes remain always-on. ✓
- **AC-3**: All layers use the same `debug` boolean threaded from `VITE_DEBUG_GAME_EVENTS`. ✓
- **AC-4**: No always-on `console.log` remains in any audited file. ✓
- **AC-5**: 6 new tests cover debug-enabled trace, debug-disabled silence, and always-on failure paths. ✓

### EC Walkthrough

- **EC-1**: Malformed inbound payloads warn via `console.warn` regardless of debug flag — tested. ✓
- **EC-2**: AuthFailure errors via `console.error` regardless of debug flag — tested. ✓

### Test Summary

- `useGameSocket.test.ts`: 14 tests (6 new)
- `useGameEvents.test.ts`: 16 tests (0 new, all passing)
- Full suite: 126 files, 1511 tests passing
