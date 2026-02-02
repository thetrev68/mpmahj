# SeatSelector

## Purpose

Allows players to choose a seat in a room (South/West/North/East), showing availability.

## User Stories

- US-030: Seat selection UI

## Props

```typescript
interface SeatSelectorProps {
  seats: { seat: Seat; occupiedBy?: string }[];
  mySeat?: Seat;
  onSelect: (seat: Seat) => void;
}
```text

## Behavior

- Renders four seat buttons.
- Occupied seats are disabled and show occupant name.
- Selected seat is highlighted.

## Visual Requirements

### Layout

```text
┌─────────────────────────────┐
│   [North]                   │
│ [West]  [Table]  [East]     │
│   [South] (You)             │
└─────────────────────────────┘
```text

- Seats arranged around a mini table glyph.

## Related Components

- **Used by**: `<LobbyLayout>`
- **Uses**: shadcn/ui `<Button>`, `<Badge>`

## Implementation Notes

- Seat order should match game orientation (South is local).
```
