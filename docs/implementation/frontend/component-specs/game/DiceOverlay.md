# DiceOverlay

## Purpose

Animated dice roll overlay for round start and wall break determination. Temporarily blocks interaction and highlights the rolled values.

## User Stories

- US-001: Dice roll animation

## Props

```typescript
interface DiceOverlayProps {
  isOpen: boolean;
  rollTotal: number; // 2-12 from PublicEvent::DiceRolled
  durationMs?: number; // animation duration
  showTotal?: boolean;
  onComplete?: () => void;
}
```

## Behavior

- When `isOpen` becomes true, play dice roll animation.
- After `durationMs`, reveals final `rollTotal` and calls `onComplete`.
- If `showTotal` is true, displays sum below the dice.
- Overlay blocks clicks while visible.

## Visual Requirements

### Layout

```text
┌─────────────────────────┐
│   🎲   🎲               │
│   Total: 9             │
└─────────────────────────┘
```

- Centered dice icons with roll animation.
- Dimmed backdrop.

### States

- **Rolling**: Dice shake/blur.
- **Settled**: Crisp dice faces.

## Related Components

- **Used by**: `<GameBoard>` during round start
- **Uses**: shadcn/ui `<Dialog>` or `<Card>` for overlay

## Implementation Notes

- Dice roll total is server-authoritative; no local RNG.
