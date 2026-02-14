# US-030: Join Room (Invite Code)

## Story

**As a** player
**I want** to join an existing game room using an invite code
**So that** I can play with the specific people I invited

## Intent

- Rooms are invite-only for MVP.
- Room creator shares a 5-character alphanumeric code.
- Joining is first-come, first-serve.
- East seat is determined later by dice; seats can be adjusted by the host if needed.

## Acceptance Criteria

### AC-1: Join Room Entry

**Given** I am on the lobby screen
**When** I click "Join Room"
**Then** a Join Room dialog opens with a single invite code input

### AC-2: Code Validation

**Given** the Join Room dialog is open
**When** I type an invite code
**Then** the code is normalized to uppercase
**And** only alphanumeric characters are accepted
**And** the Join button is enabled only when the code is 5 characters

### AC-3: Send Join Command

**Given** I entered a valid invite code
**When** I click "Join"
**Then** a `JoinRoom` envelope is sent with the invite code
**And** the Join button shows a loading state

### AC-4: Join Success

**Given** the JoinRoom envelope was sent
**When** the server responds with `RoomJoined`
**Then** I transition to the room screen
**And** I see a "Waiting for players" state

### AC-5: Join Errors

**Given** I attempted to join a room
**When** the server responds with an error
**Then** an error message is shown

Supported errors:

- Invalid code
- Room full
- Game already started

### AC-6: Share Link From Create Room

**Given** I created a room
**When** the room is created successfully
**Then** I see the invite code
**And** a "Copy Link" button copies a direct link to the Join Room dialog
**And** the link pre-fills the invite code

### AC-7: Deep Link Join

**Given** I open a link containing `?join=1&code=ABCDE`
**When** the lobby loads
**Then** the Join Room dialog opens
**And** the code input is pre-filled with `ABCDE`

## Technical Details

### Envelope (Frontend -> Backend)

```typescript
{
  kind: 'JoinRoom',
  payload: {
    room_id: string // Invite code (5 chars, alphanumeric, uppercase)
  }
}
```

### Envelope (Backend -> Frontend)

```typescript
{
  kind: 'RoomJoined',
  payload: {
    room_id: string,
    seat: Seat
  }
}

{
  kind: 'Error',
  payload: {
    code: string,
    message: string
  }
}
```

## Components Involved

- `LobbyScreen`
- `JoinRoomDialog`
- `CreateRoomForm`

## Test Scenario

- `tests/test-scenarios/join-room.md`

## Notes

- Invite code is 5 characters, alphanumeric, case-insensitive.
- UI should normalize to uppercase on input.
- No room list, filters, or seat selection for MVP.
