# Phase 6: Scoring, Results, and Post-Game UX

## Goal

Implement the scoring and post-game experience using `GamePhase.Scoring`, `HandValidated`, and `GameResult`.

## 1. Scoring Overlay

### Trigger

- `GamePhase` enters `{ Scoring: WinContext }`

### Scoring Overlay UI

- Winner seat and win type

### Scoring Component

- `apps/client/src/components/features/scoring/ScoringOverlay.tsx`

```tsx
type ScoringOverlayProps = {
  context: WinContext;
  validation?: { valid: boolean; pattern?: string };
};
```

## 2. Hand Validation Feedback

### Validation Event

- `HandValidated { valid, pattern }`

### Validation UI

- If invalid, display error toast and return to previous phase.
- If valid, show pattern name and score on the overlay.

## 3. Game Over Screen

### Game Over Event

- `GameOver { winner, result }`

### Game Over UI

- Winner seat, winning pattern.
- Final hands for all players (from `result.final_hands`).
- "Play Again" and "Exit" buttons (client-side only for now).

### Game Over Component

- `apps/client/src/components/features/scoring/GameOverScreen.tsx`

```tsx
type GameOverScreenProps = {
  result: GameResult;
  onExit: () => void;
  onPlayAgain?: () => void;
};
```

## 4. NMJL Card Integration

When a pattern is validated, highlight it in the Card Viewer.

- Use `pattern` from `HandValidated`.
- Auto-scroll to the matching row in `CardViewer`.

## 5. Deliverables

1. Scoring overlay with win context data.
2. Valid/invalid feedback flow from `HandValidated`.
3. GameOver screen with final hands.
4. Card Viewer integration on validated pattern.
