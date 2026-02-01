# WinnerCelebration

## Purpose

Celebration overlay for Mahjong win. Highlights winning player, pattern name, and provides a continue action.

## User Stories

- US-018: Mahjong celebration UI
- US-019: End of hand summary

## Props

````typescript
interface WinnerCelebrationProps {
  isOpen: boolean;
  winnerName: string;
  winnerSeat: PlayerSeat;
  patternName: string;
  handValue?: number; // optional points
  onContinue: () => void;
}
```text

## Behavior

- Shows winner details and pattern name.
- Plays brief confetti or sparkle effect on open.
- Continue button closes overlay (parent-driven).

## Visual Requirements

### Layout

```text
┌──────────────────────────────┐
│ Mahjong!                     │
│ Winner: Alice (South)         │
│ Pattern: 2025 "Like Numbers" │
│ [Continue]                    │
└──────────────────────────────┘
```text

- Centered card with celebratory heading.
- Pattern name emphasized.

## Related Components

- **Used by**: `<GameBoard>` end-of-hand flow
- **Uses**: shadcn/ui `<Dialog>`, `<Button>`, `<Card>`

## Implementation Notes

- Avoid heavy effects on low-motion preference.
````
