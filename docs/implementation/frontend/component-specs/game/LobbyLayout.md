# LobbyLayout

## Purpose

Main lobby screen layout composing room list, create room action, and seat selection for a selected room.

## User Stories

- US-029: Room creation
- US-030: Room browsing and joining

## Props

```typescript
interface LobbyLayoutProps {
  rooms: RoomSummary[];
  selectedRoomId?: string;
  mySeat?: Seat;
  isLoading: boolean;
  onRefreshRooms: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onSelectSeat: (seat: Seat) => void;
}
```text

## Behavior

- Shows `<RoomList>` on the left (or top on mobile).
- Shows room details + `<SeatSelector>` when a room is selected.
- Create Room button opens `<CreateRoomForm>` (parent-driven).

## Visual Requirements

### Layout

```text
┌───────────────────────────────────────────┐
│ [RoomList]     [Room Details + Seats]     │
│ [Create Room]                             │
└───────────────────────────────────────────┘
```text

- Two-column layout on desktop; stacked on mobile.

## Related Components

- **Uses**: `<RoomList>`, `<RoomCard>`, `<SeatSelector>`, `<CreateRoomForm>`
- **Uses**: shadcn/ui `<Button>`, `<Card>`

## Implementation Notes

- Keep routing out of this component; parent handles navigation.
```
