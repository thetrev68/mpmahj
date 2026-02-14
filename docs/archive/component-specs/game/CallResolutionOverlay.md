# CallResolutionOverlay

## Purpose

Shows the call priority resolution after the call window closes. Explains who won, why they won (Mahjong priority or proximity), and lists all callers.

## User Stories

- US-012: Call Priority Resolution

## Props

```typescript
interface CallResolutionOverlayProps {
  /** Final call resolution */
  resolution: CallResolution;
  /** Optional tie-break reason metadata */
  tieBreak: CallTieBreakReason | null;
  /** All players who declared call intent */
  allCallers: CallIntentSummary[];
  /** Seat that discarded the tile */
  discardedBy: Seat;
  /** Dismiss callback */
  onDismiss: () => void;
}
```

## Behavior

- Renders a modal overlay when `resolution` is not `"NoCall"`.
- Builds a resolution message:
  - Mahjong beats meld: "Mahjong beats Pung/Kong/Quint".
  - Tie-break by seat order: "Closest to discarder".
  - Mahjong tie: "Both Mahjong, {winner} is closer".
- Displays priority rules (Mahjong before meld, clockwise proximity).
- Lists all callers with their intent types, and marks the winner.
- Shows a tie-break section when `tieBreak` is present.
- Dismisses on backdrop click, Escape key, or Continue button.

## Visual Requirements

### Layout

```text
+---------------------------+
| Call Resolved             |
| South wins: Mahjong beats |
|                           |
| Priority Rules            |
| 1. Mahjong > meld         |
| 2. Closest clockwise      |
|                           |
| Priority Diagram          |
| Discarder: East           |
| South -> West -> North    |
|                           |
| All Callers               |
| South: Mahjong (winner)   |
| West: Pung                |
|                           |
| Continue                  |
+---------------------------+
```

- Modal overlay with a white card.
- Winner message in green text.
- Priority rules in a blue callout.

## Interactions

- **Backdrop click**: Dismiss overlay.
- **Escape**: Dismiss overlay.
- **Continue**: Dismiss overlay.

## Dependencies

- `<PriorityDiagram>`
- shadcn/ui `<Button>` or a standard button element

## Test Cases

1. Shows priority rules when displayed.
2. Mahjong beats meld message for mixed callers.
3. Meld tie-break shows "Closest to discarder".
4. Mahjong tie-break shows "Both Mahjong, X is closer".
5. Lists all callers and marks the winner.
6. Dismisses via Continue and Escape.

## Mock Data

```typescript
const resolution: CallResolution = { Mahjong: 'South' };
const tieBreak: CallTieBreakReason | null = null;
const allCallers: CallIntentSummary[] = [
  { seat: 'South', kind: 'Mahjong' },
  { seat: 'West', kind: { Meld: { meld_type: 'Pung' } } },
];
```

## Implementation Notes

- Use `CallIntentSummary` for caller labels (no tile exposure).
- Derive contenders from `tieBreak.SeatOrder.contenders` if present; otherwise use all callers.
- Do not render the overlay for `"NoCall"`.
