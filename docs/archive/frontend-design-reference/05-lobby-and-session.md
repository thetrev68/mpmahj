# Phase 5: Lobby, Authentication, and Session Flow

## Goal

Implement the full pre-game flow: authentication, room creation/joining, seat assignment, and readiness. This uses the server WebSocket envelope protocol (Authenticate, CreateRoom, JoinRoom, RoomJoined, etc).

## 1. Authentication UX

### Supported auth methods

- Guest (default)
- Token (reconnect)
- JWT (Supabase)

### Auth Screen Components

- `apps/client/src/components/layout/AuthScreen.tsx`
- `apps/client/src/components/features/auth/AuthPanel.tsx`

### Flow

1. User selects auth method (guest or JWT).
2. On connect, send `Envelope.Authenticate`.
3. On `AuthSuccess`, store `session_token` and optional `room_id`/`seat`.
4. On `AuthFailure`, show error and stay on Auth screen.

### Command

```ts
const authEnvelope: Envelope = {
  kind: 'Authenticate',
  payload: {
    method: 'guest',
    version: '1.0',
  },
};
```text

## 2. Room Management

### Lobby Screen Components

- `apps/client/src/components/layout/LobbyScreen.tsx`
- `apps/client/src/components/features/lobby/RoomCard.tsx`
- `apps/client/src/components/features/lobby/SeatList.tsx`

### Actions

- Create room: `Envelope.CreateRoom`
- Join room: `Envelope.JoinRoom` (room_id)
- Leave room: `Envelope.LeaveRoom`
- Close room: `Envelope.CloseRoom` (host only)

### Events

- `RoomJoined` sets current `room_id` and seat.
- `RoomMemberLeft` updates seat list and tile counts.
- `RoomClosed` returns to lobby.

## 3. Seat Assignment and Ready State

Seat assignment is server-driven via `RoomJoined` and `GameEvent.PlayerJoined`.

UI should show:

- Seat list (East, South, West, North).
- Bots vs human indicator (`is_bot` from `PlayerJoined`).
- "Ready" button for Setup phase (`ReadyToStart` command).

## 4. Lobby Status Handling

The lobby should reflect:

- Connection status (`connecting`, `connected`, `disconnected`).
- Room id with copy button.
- List of joined players (from `PlayerJoined` events).

## 5. Deliverables

1. Auth UI with guest/JWT options.
2. Room create/join/leave flows using envelopes.
3. Lobby view showing seats and readiness.
4. Session token persistence for reconnect.
