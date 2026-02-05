# Test Scenario: Join Room (Invite Code)

**User Story**: US-030 - Join Room (Invite Code)
**Scope**: Server-layer Envelope flow (not `GameCommand`)
**Components**: LobbyScreen, JoinRoomDialog

## Setup (Arrange)

- App is on Lobby screen.
- WebSocket connected and authenticated.
- Join Room dialog is closed.

## Steps (Act)

1. User clicks "Join Room" on the lobby.
2. User enters invite code `AB12C`.
3. User clicks "Join".
4. Client sends Envelope `JoinRoom` with `room_id: "AB12C"`.
5. Server replies with Envelope `RoomJoined`.
6. Client transitions to Room screen and shows "Waiting for players".

## Expected Outcome (Assert)

- Join Room dialog validates code format (5 chars, alphanumeric).
- One `JoinRoom` envelope is sent per attempt.
- `RoomJoined` transitions to the room screen.
- Error responses show a user-friendly message.

## Error Cases

- Invalid code: server sends `Error` with reason and UI shows error.
- Room full: server sends `Error` with reason and UI shows error.
- Game already started: server sends `Error` with reason and UI shows error.
- Disconnect after submit: UI shows reconnect and re-opens Join dialog if needed.

## Envelope References

- Client -> Server: `JoinRoom`
- Server -> Client: `RoomJoined`, `Error`

## Deep Link

- Link format: `/?join=1&code=AB12C`
- Lobby should open Join dialog with code pre-filled.
