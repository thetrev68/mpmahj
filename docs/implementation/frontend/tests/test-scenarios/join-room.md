# Test Scenario: Join Room (Server Envelope)

**User Story**: US-030 - Join Room
**Scope**: Server-layer Envelope flow (not `GameCommand`)
**Component Specs**: LobbyScreen.md, JoinRoomDialog.md, RoomList.md, RoomScreen.md
**Fixtures**: `lobby-with-rooms.json`, `envelopes/join-room-sequence.json`

## Setup (Arrange)

- App is on Lobby screen with a room list.
- WebSocket connected and authenticated.
- Room list includes one open room and one password-protected room.
- Join Room dialog is closed.

## Steps (Act)

1. User opens Join Room dialog.
2. User submits an open room id with no password.
3. Client sends Envelope `JoinRoom`.
4. Server replies with Envelope `RoomJoined`.
5. Client transitions to Room screen and shows assigned seat.
6. User leaves the room.
7. User repeats join for a password-protected room with a password.

## Expected Outcome (Assert)

- Join Room dialog validates room id before send.
- One `JoinRoom` Envelope is sent per attempt with provided password.
- `RoomJoined` updates room roster and user seat.
- UI reflects host, player list, and room status.
- Leaving returns the client to Lobby and updates room list.

## Error Cases

- Room not found: server sends `RoomJoinFailed` with reason and UI shows error.
- Room full: server sends `RoomJoinFailed` with reason and UI shows error.
- Password required: server sends `RoomJoinFailed` with reason and UI shows error.
- Password invalid: server sends `RoomJoinFailed` with reason and UI shows error.
- Game already started: server sends `RoomJoinFailed` with reason and UI shows error.
- Disconnect after submit: UI shows reconnect and requests room list on reconnect.

## Envelope References

- Client → Server: `JoinRoom`, `LeaveRoom`
- Server → Client: `RoomJoined`, `RoomJoinFailed`, `RoomListUpdated`, `PlayerJoined`, `PlayerLeft`

## Notes

- This scenario is intentionally server-layer and should be implemented as an integration test using Envelope messages, not `GameCommand`.
