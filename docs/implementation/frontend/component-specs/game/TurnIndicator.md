# TurnIndicator

## Purpose

Highlights the current active player and indicates turn ownership ("Your Turn" vs "Waiting"). Supports both main board and player rack contexts.

## User Stories

- US-009: Discard tile action
- US-010: Discard flow visibility

## Props

```typescript
interface TurnIndicatorProps {
  currentSeat: Seat; // 'South' | 'West' | 'North' | 'East'
  mySeat: Seat;
  turnNumber?: number; // optional round/turn counter
  isCallWindow?: boolean; // true during call window
}
```text

## Behavior

- If `currentSeat === mySeat`, display “Your Turn”.
- Otherwise display “Waiting for <seat>”.
- If `isCallWindow` is true, display “Call Window” badge.
- Optional `turnNumber` is displayed in a subtle label.

## Visual Requirements

### Layout

```text
┌─────────────────────────────┐
│ Your Turn        Turn 12    │
│ Call Window (badge)         │
└─────────────────────────────┘
```text

- Primary label left; optional turn number right.
- Badge appears below when in call window.

### States

- **Active**: Highlighted text or glow for current player.
- **Inactive**: Muted text.

## Related Components

- **Used by**: `<GameBoard>`, `<PlayerRack>`
- **Uses**: shadcn/ui `<Badge>`, `<Card>`

## Implementation Notes

- Seat name mapping should be localized in a utility (e.g., South → “You” for local seat).
```
