# CharlestonTimer

## Purpose

Countdown timer for Charleston actions (pass selection, blind pass, and vote). Communicates remaining time to act and urgency as time expires.

## User Stories

- US-002: Charleston pass action
- US-005: Charleston voting (Stop/Continue)

## Props

````typescript
interface CharlestonTimerProps {
  secondsRemaining: number; // integer seconds
  totalSeconds: number; // initial duration
  isActive: boolean;
  label?: string; // "Select Tiles", "Vote", etc.
  timerMode?: TimerMode; // Visible | Hidden
  startedAtMs?: number; // server timestamp for sync
  onTimeout?: () => void; // optional local callback
}
```text

## Behavior

- Renders a countdown value from `secondsRemaining`.
- Visual urgency increases as time approaches 0.
- When `isActive` is false, show a paused state (no countdown animation).
- When `secondsRemaining` reaches 0, shows “Time Up” and triggers `onTimeout` (if provided).

## Visual Requirements

### Layout

```text
┌───────────────┐
│  12s          │
│  Select Tiles │
└───────────────┘
```text

- Timer value is the primary element.
- Optional label below the time.

### States

- **Normal**: Blue/neutral color
- **Warning**: Yellow when <= 5 seconds
- **Critical**: Red when <= 2 seconds
- **Paused**: Muted gray

### Animations

- Smooth progress ring or bar that shrinks with time.
- Subtle pulse when in **Critical** state.

## Related Components

- **Used by**: `<ActionBar>`, `<VotePanel>`, `<TileSelectionPanel>`
- **Uses**: shadcn/ui `<Progress>`
- **Uses**: shadcn/ui `<Badge>` or `<Card>` for container

## Implementation Notes

- Avoid local timers; prefer server-driven time from game state and `started_at_ms`.
- Respect `TimerMode::Hidden` (render compact or hide countdown).
- If `totalSeconds` is 0, hide the progress indicator.
````
