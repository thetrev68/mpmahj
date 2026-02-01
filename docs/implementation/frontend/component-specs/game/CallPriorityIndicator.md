# CallPriorityIndicator

## Purpose

Visualizes multiple callers competing for a discard (priority order). Communicates who is calling and who has priority to claim.

## User Stories

- US-012: Call priority resolution

## Props

````typescript
interface CallPriorityIndicatorProps {
  isVisible: boolean;
  pendingIntents: CallIntent[]; // from TurnStage::CallWindow
  resolution?: CallResolution; // from PublicEvent::CallResolved
  mySeat: Seat;
}
```text

## Behavior

- Shows a row of caller seats when `isVisible`.
- Highlights the resolved seat when `resolution` is available.
- If no resolution yet, show “Resolving…” state.
- Indicates when local player is in the caller list.

## Visual Requirements

### Layout

```text
┌───────────────────────────────────────────┐
│ Callers: W  N  E   (Resolving...)         │
│ Priority: N                               │
└───────────────────────────────────────────┘
```text

- Caller chips/avatars in a row.
- Priority line below (optional until known).

### Styles

- Caller chips: neutral badges.
- Priority: highlighted badge or outline.
- Local player: subtle “You” marker.

## Related Components

- **Used by**: `<GameBoard>` during call window
- **Uses**: shadcn/ui `<Badge>`, `<Card>`

## Implementation Notes

- Seat ordering should follow table order (South → West → North → East).
````
