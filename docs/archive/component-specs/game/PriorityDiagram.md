# PriorityDiagram

## Purpose

Visualizes clockwise call priority starting from the discarder. Highlights the winning seat and any tied contenders.

## User Stories

- US-012: Call Priority Resolution

## Props

```typescript
interface PriorityDiagramProps {
  /** Seat that discarded the tile */
  discardedBy: Seat;
  /** Seat that won the call */
  winner: Seat;
  /** Optional tied contenders */
  contenders?: Seat[];
}
```

## Behavior

- Computes clockwise priority order from the discarder.
- Renders a compact list of seats in priority order.
- Highlights the winner with a strong badge.
- Marks contenders with a subtle warning badge.
- Shows a "Contenders" line when `contenders` is provided.

## Visual Requirements

### Layout

```text
Priority Diagram
Discarder: East
Priority order (clockwise): South -> West -> North
Contenders: South, West
```

### Styles

- Discarder badge: neutral gray.
- Winner badge: green background, white text.
- Contender badge: amber background with border.
- Arrow separators use plain text "->".

## Dependencies

- shadcn/ui `<Badge>`

## Test Cases

1. Renders discarder and priority order for East discarder.
2. Highlights winning seat with winner label.
3. Displays contenders list when provided.

## Mock Data

```typescript
const props: PriorityDiagramProps = {
  discardedBy: 'East',
  winner: 'South',
  contenders: ['South', 'West'],
};
```

## Implementation Notes

- Use seat order: East -> South -> West -> North.
- Priority order is the next three seats clockwise after the discarder.
- Avoid non-ASCII symbols in labels.
