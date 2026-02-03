# US-037: Disconnect / Reconnect

## Story

**As a** player in an active game
**I want** the client to recover gracefully after a disconnect
**So that** I can continue the game without losing authoritative state

## Acceptance Criteria

### AC-1: Connection Status Indicator

**Given** the game UI is visible
**When** the WebSocket disconnects
**Then** a persistent status banner appears: "Reconnecting..."
**And** the banner includes a spinner and retry attempt count
**And** interactive game actions are disabled while disconnected

### AC-2: Auto-Reconnect With Backoff

**Given** the socket is disconnected
**When** auto-reconnect starts
**Then** reconnect attempts use exponential backoff (1s, 2s, 4s, 8s, max 30s)
**And** each attempt updates the banner text (e.g., "Reconnecting... attempt 3")
**And** reconnect stops when a connection is re-established

### AC-3: Auth-First Handshake

**Given** a stored `session_token` exists
**When** the socket reopens
**Then** the first outbound message is `Authenticate { method: jwt, token }`
**And** on `AuthSuccess`, the token is refreshed in local storage

### AC-4: State Resync After Auth

**Given** `AuthSuccess` is received after reconnect
**When** the client requests a resync
**Then** it sends `RequestState` for the current seat
**And** on `StateSnapshot`, the client replaces local state entirely
**And** any transient UI state is cleared (selected tiles, dialogs, pending actions)
**And** the game UI reflects the snapshot immediately

### AC-5: Resume In-Progress Flow

**Given** the user was mid-action before disconnect
**When** the state snapshot is applied
**Then** the user sees the authoritative stage (Charleston, Drawing, Discarding, CallWindow)
**And** the user can continue from the restored stage
**And** any unsent local actions are dropped unless explicitly queued

### AC-6: Manual Retry

**Given** auto-reconnect fails for 30s
**When** the user clicks "Retry Now"
**Then** a new reconnect attempt starts immediately

### AC-7: Failure Outcomes

**Given** authentication fails (expired/invalid token)
**When** the server responds with auth error
**Then** the user is returned to the login screen with an error message

**Given** the room no longer exists or the game ended
**When** the resync request returns "not found" or `GameOver`
**Then** the user is returned to the lobby with a dismissal notice

## UI / UX Requirements

- Reconnect banner is non-blocking but clearly visible.
- Disable action buttons and tile selection while disconnected.
- Show a short toast when connection is restored: "Reconnected".

## Backend Integration

### Outbound Envelopes

- `Authenticate { method: 'jwt', credentials: { token } }`
- `RequestState { player: Seat }`

### Inbound Envelopes

- `AuthSuccess { session_token, seat? }`
- `StateSnapshot { snapshot: GameStateSnapshot }`
- `Error { message }`

## Error Cases

- Token expired: auth error, redirect to login.
- Server unreachable: banner persists, retries continue.
- Snapshot missing seat: show "Unable to restore seat" and return to lobby.
- Duplicate events after reconnect: deduplicate by event id if provided.

## Component References

- `useGameSocket` (connection lifecycle, reconnect logic)
- `ConnectionStatus` (banner/toast UI)
- `GameBoard` (disable interactions during disconnect)

## Testing Strategy

- Scenario: `tests/test-scenarios/disconnect-reconnect.md`
- Fixtures: `game-states/mid-game-charleston.json`, `event-sequences/reconnect-flow.json`

## Accessibility

- Banner announces: "Connection lost. Reconnecting."
- On success: "Reconnected. Game state updated."
- Focus remains on prior UI element; no forced focus change.
