# Phase 7: Reconnect, Resync, and Replay

## Goal

Ensure clients can safely reconnect, resync state, and view replays without corrupting local state.

## 1. Session Restoration

### Server support

- `AuthSuccess` returns `session_token`.
- If a token is provided, the server attempts to restore session and may return `room_id` and `seat`.

### Client flow

1. Persist `session_token` in local storage.
2. On app launch, attempt `Authenticate` with `method: 'token'`.
3. If `AuthSuccess` includes `room_id`, send `RequestState` or await `StateSnapshot`.

### Command

```ts
const cmd: GameCommand = { RequestState: { player: mySeat } };
```

## 2. State Snapshot Handling

### Envelope

- `StateSnapshot { snapshot: GameStateSnapshot }`

### Store update

- `gameStore.applySnapshot(snapshot)` should overwrite local state.
- Clear any pending ActionQueue events.

## 3. Reconnect UI

### Components

- `apps/client/src/components/ui/ConnectionBanner.tsx`
- `apps/client/src/components/features/reconnect/ReconnectModal.tsx`

### Behaviors

- Show "Reconnecting..." banner when socket closes.
- Provide "Reconnect" button after a timeout.
- Disable gameplay input while disconnected.

## 4. Replay (Optional)

The backend provides replay endpoints:

- `GET /api/replays/:game_id?seat=East`
- `GET /api/admin/replays/:game_id`

### Client usage

- Add a "View Replay" button in Game Over screen.
- Fetch replay events and play them through ActionQueue.
- Only show seat-specific replays to authenticated players.

## 5. Deliverables

1. Token-based reconnect flow.
2. Snapshot application and ActionQueue reset.
3. Reconnect UI and disabled input on disconnect.
4. Optional replay viewer scaffold.
