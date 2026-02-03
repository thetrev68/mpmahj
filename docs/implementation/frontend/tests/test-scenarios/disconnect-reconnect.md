# Test Scenario: Disconnect and Reconnect - Network Recovery

**User Story**: US-037 - Disconnect / Reconnect
**Fixtures**: `game-states/mid-game-charleston.json`, `event-sequences/reconnect-flow.json`

## Setup (Arrange)

- Game state: Charleston FirstRight phase.
- User seated as: West.
- Partial action: 2 of 3 tiles selected for pass.
- WebSocket: initially connected.
- Auth token: stored in localStorage.

## Steps (Act)

1. Network connection drops while the user is in Charleston.
2. WebSocket closes and the client shows a "Reconnecting..." banner.
3. Attempt #1 reconnect times out after 5s.
4. Attempt #2 waits 2s and reconnects successfully.
5. Client sends `Authenticate { method: jwt, token }` as first message.
6. Server responds with `AuthSuccess { session_token, seat }`.
7. Client sends `RequestState { player: seat }`.
8. Server responds with `StateSnapshot { snapshot }`.
9. Client replaces local state with the snapshot and clears transient UI state.

## Expected Outcome (Assert)

- Reconnect banner appears immediately and actions are disabled while disconnected.
- Exponential backoff is used (1s, 2s, 4s, 8s, max 30s).
- `Authenticate` is the first outbound message after reconnect.
- `AuthSuccess` refreshes the stored session token.
- `RequestState` is sent and `StateSnapshot` is applied.
- Charleston phase and current turn reflect the server snapshot.
- User can resume from the restored stage.

## Error Cases

- Network down for extended period: reconnect attempts continue with backoff up to 30s.
- Token expired: server returns auth error and client redirects to login.
- Room closed or game ended: client returns to lobby with a notice.
- Snapshot missing seat: client shows error and returns to lobby.
- Partial action lost: previously selected tiles are cleared and user must reselect.
