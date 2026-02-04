# US-034: Configure House Rules

## Story

**As a** room creator
**I want** to configure house rules
**So that** the game reflects preferred variants

## Status

**Deferred**: Backend does not currently accept house rules in room creation or game start.

## Acceptance Criteria

### AC-1: No Editable House Rules During Create Room

**Given** I am creating a room
**When** the Create Room form is displayed
**Then** there is no editable House Rules panel
**And** the UI does not send house-rule fields in `CreateRoom` envelopes

### AC-2: Read-Only Display If Provided by Server

**Given** the server includes house rules in room details or snapshots
**When** the room or game view is displayed
**Then** the rules are shown in read-only form
**And** the values cannot be edited by the client

### AC-3: Default Rules Message

**Given** house rules are not provided by the server
**When** room details are displayed
**Then** the UI shows a short label: "House rules: default server settings"

## Backend Integration

- **Outbound**: None
- **Inbound**: Optional room or snapshot fields if/when backend exposes them

## Testing Strategy

- Verify Create Room sends no house-rule fields.
- Verify read-only display when rules are present.
- Verify default label when rules are absent.

## Notes

- Revisit when backend accepts house rules in `CreateRoom`.
