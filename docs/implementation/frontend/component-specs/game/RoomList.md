# RoomList

## Purpose

Displays a list of available rooms with filtering and refresh controls.

## User Stories

- US-030: Available rooms list

## Props

```typescript
interface RoomListProps {
  rooms: RoomSummary[];
  isLoading: boolean;
  onJoin: (roomId: string) => void;
  onRefresh: () => void;
}

interface RoomSummary {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
  isInProgress: boolean;
}
```

## Behavior

- Renders a list of rooms using `<RoomCard>`.
- Shows loading state when `isLoading` is true.
- Refresh button triggers `onRefresh`.

## Visual Requirements

### Layout

```
┌─────────────────────────────┐
│ Rooms           [Refresh]   │
│ [RoomCard]                  │
│ [RoomCard]                  │
└─────────────────────────────┘
```

- Title + refresh on top.
- Room cards stacked with spacing.

## Related Components

- **Used by**: `<LobbyLayout>`
- **Uses**: `<RoomCard>`
- **Uses**: shadcn/ui `<Button>`, `<Card>`

## Implementation Notes

- Sorting (e.g., joinable first) should be done in a selector.
