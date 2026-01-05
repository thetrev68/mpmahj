# 13. Screen Flows and Navigation

This document defines the major frontend screens and how the application transitions between them based on network events and game phase changes.

## 13.1 Screen List

1. **Auth Screen**: guest or JWT sign-in.
2. **Lobby Screen**: create/join room and view current room status.
3. **Game Room**: main gameplay UI (table, hand, action bar).
4. **Scoring Overlay**: validation and scoring UI during `GamePhase.Scoring`.
5. **Game Over Screen**: final results and replay options.
6. **Settings Modal**: audio, layout, and accessibility preferences.
7. **Reconnect Modal**: shown when the socket disconnects.

## 13.2 Routing Strategy

Use a simple view-state router in `App.tsx` or `apps/client/src/routes.ts`:

- `Auth` -> `Lobby` after `AuthSuccess`.
- `Lobby` -> `GameRoom` after `RoomJoined`.
- `GameRoom` overlays scoring or game over based on `GamePhase`.

## 13.3 Navigation Triggers

**Auth -> Lobby**

- `Envelope.AuthSuccess` received.

**Lobby -> GameRoom**

- `Envelope.RoomJoined` received and `GameEvent.GameStarting` broadcast.

**GameRoom -> GameOver**

- `GamePhase` transitions to `{ GameOver: GameResult }`.

**Reconnect Modal**

- WebSocket close or heartbeat timeout.

## 13.4 Screen Dependencies

**Auth Screen**

- `sessionStore`: persists session token.
- `useGameSocket`: authenticate and connect.

**Lobby Screen**

- `sessionStore`: player id, room id, seat.
- `gameStore`: player list (from `PlayerJoined`).

**Game Room**

- `gameStore`: phase, players, discard pile, hand, remaining tiles.
- `uiStore`: selections, modals, toasts.

**Game Over**

- `gameStore`: `GameResult` from `GameOver` event.

## 13.5 Error and Edge Screens

If the server returns `Envelope.Error` (RoomNotFound, RoomFull, InvalidCommand):

- Show a dismissible banner.
- Keep the user on the current screen.

## 13.6 Diagram (Text)

```text
Auth -> Lobby -> GameRoom -> GameOver
  |       |           |
  |       |           +-> ScoringOverlay (GamePhase.Scoring)
  |       +-> AuthError banner
  +-> ReconnectModal (socket close)
```
