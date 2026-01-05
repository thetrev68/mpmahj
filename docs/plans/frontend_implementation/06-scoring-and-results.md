# Phase 6: Scoring, Results, and Post-Game UX

## Goal

Implement the scoring and post-game experience using `GamePhase.Scoring`, `HandValidated`, and `GameResult`.

## 1. Scoring Overlay

**Trigger**

- `GamePhase` enters `{ Scoring: WinContext }`

**UI**

- Winner seat and win type (self-draw vs call).
- Display winning tile and full winning hand.
- Show "Validating hand..." until `HandValidated`.

**Component**

- `apps/client/src/components/features/scoring/ScoringOverlay.tsx`

```tsx
type ScoringOverlayProps = {
  context: WinContext;
  validation?: { valid: boolean; pattern?: string };
};
```

## 2. Hand Validation Feedback

**Event**

- `HandValidated { valid, pattern }`

**UI**

- If invalid, display error toast and return to previous phase.
- If valid, show pattern name and score on the overlay.

## 3. Game Over Screen

**Event**

- `GameOver { winner, result }`

**UI**

- Winner seat, winning pattern.
- Final hands for all players (from `result.final_hands`).
- "Play Again" and "Exit" buttons (client-side only for now).

**Component**

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
