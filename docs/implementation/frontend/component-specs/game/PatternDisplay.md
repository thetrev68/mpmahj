# PatternDisplay

## Purpose

Displays the winning pattern card information: pattern name, short description, and example tiles.

## User Stories

- US-018: Winning pattern card
- US-019: End of hand summary

## Props

```typescript
interface PatternDisplayProps {
  patternName: string;
  patternDescription?: string;
  exampleTiles?: Tile[];
}
```text

## Behavior

- Shows pattern name prominently.
- If `patternDescription` is provided, show below the name.
- If `exampleTiles` is provided, render a compact tile row.

## Visual Requirements

### Layout

```text
┌─────────────────────────────┐
│ Like Numbers                │
│ Two-digit pairs, any suits  │
│ [tile][tile][tile]...       │
└─────────────────────────────┘
```text

- Name on top, description below, tiles at bottom.

## Related Components

- **Used by**: `<WinnerCelebration>`, `<ScoreDisplay>`
- **Uses**: `<Tile>` for example tiles
- **Uses**: shadcn/ui `<Card>`

## Implementation Notes

- Example tiles are optional; do not infer on client.
```
