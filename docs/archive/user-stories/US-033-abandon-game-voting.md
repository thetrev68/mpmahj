# US-033: Abandon Game (Consensus)

## Story

**As a** player in an active game
**I want** a consensus-based way to abandon a game that is stuck or broken
**So that** all players can end the game fairly

## Status

**Deferred**: Backend does not currently expose an abandon-by-consensus command or vote flow.

## Acceptance Criteria

### AC-1: No Abandon UI While Unsupported

**Given** I am in an active game
**When** the game menu is displayed
**Then** there is no "Abandon Game" or "Propose Abandon" action
**And** the UI does not show any abandon voting panels

### AC-2: Handle Server-Initiated Abandon Events

**Given** the server ends a game with `GameAbandoned` for any reason
**When** the client receives the event
**Then** the game ends and the user is returned to the lobby
**And** a notice is shown explaining the reason

### AC-3: No Client-Side Command Emission

**Given** abandon consensus is unsupported
**When** the user attempts to access it via deep link or debug UI
**Then** no abandon-related command is sent to the server
**And** the UI shows a message: "Abandon game is not supported yet."

## Backend Integration

- **Outbound**: None
- **Inbound**: `GameAbandoned` (already handled as a terminal game state)

## Testing Strategy

- Verify no abandon UI appears in game menu.
- Verify `GameAbandoned` transitions the UI to lobby with a reason notice.

## Notes

- Revisit when a server-layer abandon vote flow is added.
