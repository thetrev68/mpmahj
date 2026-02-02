# VotePanel

## Purpose

Charleston voting UI for Stop/Continue decision after first Charleston. Displays vote options, current tallies, and countdown timer.

## User Stories

- US-005: Charleston voting (Stop/Continue)

## Props

```typescript
interface VotePanelProps {
  isOpen: boolean;
  myVote?: 'stop' | 'continue';
  voteCounts: { stop: number; continue: number };
  totalPlayers: number; // usually 4
  secondsRemaining: number;
  onVote: (vote: 'stop' | 'continue') => void;
}
```text

## Behavior

- Shows two primary actions: Stop and Continue.
- Selected option is highlighted after `onVote`.
- Vote buttons disabled after user has voted.
- Displays live vote counts and remaining time.
- Auto-closes (parent-driven) when voting phase ends.

## Visual Requirements

### Layout

```text
┌───────────────────────────────────────────┐
│ Vote: Continue the Charleston?            │
│ [Stop] 2 votes      [Continue] 1 vote     │
│ Time: 08s                               │
└───────────────────────────────────────────┘
```text

- Header question on top
- Two side-by-side vote buttons with counts
- Timer row at bottom

### Styles

- **Stop**: Destructive/red button
- **Continue**: Primary/green button
- Selected button shows checkmark or glow

## Related Components

- **Used by**: `<GameBoard>` or `<ActionBar>` during voting phase
- **Uses**: shadcn/ui `<Button>`, `<Badge>`, `<Card>`
- **Uses**: `<CharlestonTimer>` for countdown display

## Implementation Notes

- Vote counts should remain visible even after user votes.
- Ensure keyboard focus lands on the panel when it opens.
```
