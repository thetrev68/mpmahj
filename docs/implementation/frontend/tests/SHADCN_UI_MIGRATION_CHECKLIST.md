# shadcn/ui Migration Checklist

## Scope

- Frontend app: `apps/client/src`
- Goal: replace custom/native controls and modal shells with real shadcn/ui components.

## Completed in this pass

- [x] Replace native `<button>` usage in production components with shadcn `Button`.
- [x] Replace native range inputs with shadcn `Slider`.
- [x] Add shadcn `Slider` primitive: `apps/client/src/components/ui/slider.tsx`.
- [x] Add `Slider` unit test: `apps/client/src/components/ui/slider.test.tsx`.
- [x] Convert modal overlays to shadcn `Dialog` in:
- [x] `apps/client/src/components/game/CallWindowPanel.tsx`
- [x] `apps/client/src/components/game/CallResolutionOverlay.tsx`
- [x] `apps/client/src/components/game/DeadHandOverlay.tsx`
- [x] `apps/client/src/components/game/DrawOverlay.tsx`
- [x] `apps/client/src/components/game/VotingPanel.tsx`
- [x] `apps/client/src/components/game/MahjongConfirmationDialog.tsx`
- [x] `apps/client/src/components/game/MahjongValidationDialog.tsx`
- [x] `apps/client/src/components/game/DiceOverlay.tsx`
- [x] `apps/client/src/components/game/DrawScoringScreen.tsx`
- [x] `apps/client/src/components/game/ScoringScreen.tsx`
- [x] `apps/client/src/components/game/GameOverPanel.tsx`
- [x] `apps/client/src/components/game/JokerExchangeDialog.tsx`
- [x] `apps/client/src/components/game/WinnerCelebration.tsx`
- [x] `apps/client/src/components/game/GameBoard.tsx` (Heavenly Hand overlay)

## Remaining

- [x] Migrate right-side history drawer to a shadcn primitive (`Sheet` preferred):
- [x] `apps/client/src/components/game/HistoryPanel.tsx`

## Verification commands

- `rg "<button|<input|<select|<textarea" apps/client/src -g "*.tsx" -g "!apps/client/src/components/ui/**" -g "!**/*.test.tsx"`
- `rg -l 'role="dialog"' apps/client/src/components/game apps/client/src/pages -g "*.tsx" -g "!**/*.test.tsx"`
