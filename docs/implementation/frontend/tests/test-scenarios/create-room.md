# Test Scenario: Create Room (Server Envelope)

**User Story**: US-029 - Create Room
**Scope**: Server-layer Envelope flow (not `GameCommand`)
**Component Specs**: LobbyScreen.md, CreateRoomDialog.md, RoomList.md
**Fixtures**: `lobby-empty.json`, `envelopes/create-room-sequence.json`

## Setup (Arrange)

- App is on Lobby screen.
- WebSocket connected and authenticated.
- Lobby list is empty.
- Create Room dialog is closed.

## Steps (Act)

1. User opens Create Room dialog.
2. User fills required fields and submits.
3. Client sends Envelope `CreateRoom` with room settings.
4. Server replies with Envelope `RoomCreated`.
5. Server broadcasts `RoomListUpdated` to lobby subscribers.
6. Client transitions to Room screen for the created room.

## Expected Outcome (Assert)

- Create Room dialog validates input before send.
- One `CreateRoom` Envelope is sent with the exact settings.
- `RoomCreated` is received and the room appears in the lobby list.
- Client enters the new room as host.
- Room screen displays room id, host, and player list.

## Error Cases

- Duplicate room name: Server accepts, room id is unique, UI shows the name with unique room id.
- Invalid settings: Server sends `RoomCreateFailed` with reason and UI keeps dialog open.
- Socket disconnect after submit: UI shows reconnect state, then requests room list and reconciles whether room exists.

## Envelope References

- Client → Server: `CreateRoom`
- Server → Client: `RoomCreated`, `RoomCreateFailed`
- Server → Lobby: `RoomListUpdated`

## Notes

- This scenario is intentionally server-layer and should be implemented as an integration test using Envelope messages, not `GameCommand`.
