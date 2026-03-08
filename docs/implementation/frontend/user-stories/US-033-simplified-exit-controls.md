# US-033: Simplified Exit Controls (Leave Only)

## Status

- State: Not Started
- Priority: High
- Batch: A

## Problem

Game exit controls are duplicated and confusing (`Leave` + `Forfeit`), and house rules/settings placement competes for space.

## Scope

- Remove forfeit capability end-to-end (UI, commands, events, tests, and obsolete types where safe).
- Keep a single `Leave Game` action with one confirmation question.
- Place `Settings` and `Leave Game` at the gameboard top-right (settings left of leave).
- On confirm leave, return to lobby and show a toast that the game ended.
- Stop collecting/storing forfeit/abandon reason text.

## Acceptance Criteria

- AC-1: No `Forfeit` button or dialog appears anywhere in game UI.
- AC-2: `Leave Game` appears in top-right board controls, not in action panel.
- AC-3: Leave confirmation is a single yes/no confirmation with no reason input.
- AC-4: Confirming leave routes player to lobby and shows completion toast.
- AC-5: No reason payload is sent from client when ending game.
- AC-6: Forfeit-specific tests/components are removed or replaced.

## Edge Cases

- EC-1: Leave while command is processing still prevents double-submit.
- EC-2: Leave during setup/charleston/playing uses same confirmation UX.

## Primary Files (Expected)

- `apps/client/src/components/game/ActionBar.tsx`
- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/ForfeitConfirmationDialog.tsx` (remove)
- `apps/client/src/features/game/ForfeitGame.integration.test.tsx` (remove/replace)
- `apps/client/src/features/game/LeaveGame.integration.test.tsx`
- `apps/client/src/components/game/HouseRulesPanel.tsx` (remove usage)
- `apps/client/src/lib/game-events/publicEventHandlers.endgame.ts` (cleanup)

## Test Plan

- Update `ActionBar.test.tsx` and `GameBoard.test.tsx` for top-right control placement.
- Replace forfeit integration assertions with leave-only behavior checks.
- Add regression test: no reason field exists in leave flow.
