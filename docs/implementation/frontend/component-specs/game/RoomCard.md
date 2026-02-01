# RoomCard

## Purpose

Compact display of a single room with join action and status badges.

## User Stories

- US-030: Available rooms list

## Props

```typescript
interface RoomCardProps {
  room: RoomSummary;
  onJoin: (roomId: string) => void;
}
```

## Behavior

- Shows room name, player count, and status (Open/In Progress).
- Join button disabled if room is full or in progress.

## Visual Requirements

### Layout

```
┌─────────────────────────────┐
│ Room A        2 / 4 [Join]  │
│ Open                           │
└─────────────────────────────┘
```

- Name left, player count center, join button right.
- Status badge below.

## Related Components

- **Used by**: `<RoomList>`
- **Uses**: shadcn/ui `<Button>`, `<Badge>`, `<Card>`

## Implementation Notes

- RoomSummary type shared with lobby state.
