# ScoreDisplay

## Purpose

Shows score breakdown for a completed hand. Lists base pattern, bonuses, and final totals per player.

## User Stories

- US-018: Score breakdown
- US-019: End of hand summary

## Props

```typescript
interface ScoreDisplayProps {
  patternName: string;
  baseValue: number;
  bonuses: { label: string; value: number }[];
  totals: { seat: Seat; name: string; score: number }[];
}
```

## Behavior

- Displays pattern name and base value.
- Lists bonus rows if present.
- Shows final totals in a player list.

## Visual Requirements

### Layout

```text
┌─────────────────────────────┐
│ Pattern: Like Numbers (30)  │
│ + Concealed (10)            │
│ + Jokerless (10)            │
│ Totals:                     │
│  South: 50   West: -10 ...  │
└─────────────────────────────┘
```

- Bonuses grouped under pattern header.
- Totals aligned in a simple grid/list.

## Related Components

- **Used by**: `<WinnerCelebration>` or end-of-hand screen
- **Uses**: shadcn/ui `<Card>`, `<Badge>`

## Implementation Notes

- All values are server-provided; no local scoring.

```text

```
