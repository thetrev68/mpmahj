# US-033: Simplified Exit Controls (Leave Only)

## Status

- State: Not Started
- Priority: High
- Batch: A

## Problem

Game exit controls are duplicated and confusing (`Leave` + `Forfeit`), and house rules/settings placement competes for space.

## Scope

- Remove the Forfeit button, `ForfeitConfirmationDialog`, and all forfeit state from the action bar.
- Keep a single `Leave Game` button and its existing `LeaveConfirmationDialog`.
- Move `Leave Game` to a top-right board controls strip (Settings icon left of it), out of `ActionBar`.
- On confirm leave, return to lobby and show a toast.
- Remove forfeit-specific test files.

## Acceptance Criteria

- AC-1: No `Forfeit` button or dialog appears anywhere in game UI.
- AC-2: `Leave Game` button appears in top-right board controls, not inside `ActionBar`.
- AC-3: Leave confirmation is a yes/no dialog with no reason text input.
- AC-4: Confirming leave routes player to lobby and shows completion toast.
- AC-5: No reason payload is sent from client when leaving.
- AC-6: Forfeit-specific tests and components are removed.

## Edge Cases

- EC-1: Leave while a command is processing still prevents double-submit (existing lock logic preserved for the leave path).
- EC-2: Leave during Setup/Charleston/Playing phases uses the same confirmation UX.

## Primary Files (Expected)

- `apps/client/src/components/game/ActionBar.tsx` — remove Forfeit button + `ForfeitConfirmationDialog` import/usage; remove Leave button (it moves to `GameBoard.tsx`)
- `apps/client/src/components/game/ActionBar.types.ts` — remove any forfeit-related props
- `apps/client/src/components/game/useActionBarHandlers.ts` — remove `canForfeit`, `forfeitReason`, `isForfeiting`, `showForfeitDialog`, and all forfeit handlers; lift leave handler if needed
- `apps/client/src/components/game/ActionBarDerivations.ts` — remove `canForfeit` from `ActionBarPhaseMeta` interface and `getActionBarPhaseMeta` return value
- `apps/client/src/components/game/ForfeitConfirmationDialog.tsx` — delete file and its test
- `apps/client/src/components/game/GameBoard.tsx` — add top-right control strip with Settings icon + Leave Game button + `LeaveConfirmationDialog`
- `apps/client/src/features/game/ForfeitGame.integration.test.tsx` — delete file
- `apps/client/src/features/game/LeaveGame.integration.test.tsx` — update/extend for new top-right placement

## Notes for Implementer

- **What exists today**: `ActionBar.tsx` renders both a Leave button and a Forfeit button. Both open separate dialogs (`LeaveConfirmationDialog`, `ForfeitConfirmationDialog`). `useActionBarHandlers.ts` owns all dialog state. `ActionBarDerivations.ts` computes `canForfeit` (only true during Playing, not CallWindow).
- **`LeaveConfirmationDialog`** already exists and is correct — do not change its logic or appearance.
- **Moving Leave to `GameBoard.tsx`**: `GameBoard.tsx` already renders a `data-testid="leave-toast"` div, so it is the right owner for leave logic. Add a small top-right overlay div containing a Settings gear icon and a Leave button.
- **`handleConfirmLeave`**: Lift the leave handler logic from `useActionBarHandlers.ts` into a local handler or thin hook in `GameBoard.tsx`.
- **No reason field**: `ForfeitGame` command had a `reason` field; `LeaveGame` command does not — no change needed to the leave command shape.
- **`canForfeit` removal**: Remove the field from `ActionBarPhaseMeta` and all its callers. Run `npx tsc --noEmit` to catch stray references.
- **Settings icon**: Use a gear icon from `lucide-react` (already a project dependency). It can open a stub panel or existing settings — keep minimal for this story.

## Test Plan

- Delete `ForfeitConfirmationDialog.test.tsx` and `ForfeitGame.integration.test.tsx`.
- Update `ActionBar.test.tsx`: remove forfeit testid assertions; assert Leave button is no longer rendered inside `ActionBar`.
- Update `GameBoard.test.tsx`: assert top-right Leave button is present and leave dialog opens on click.
- Update `LeaveGame.integration.test.tsx`: confirm leave flow routes to lobby and shows toast from the top-right button location.
- Add regression assertion: no element with `data-testid="forfeit-game-button"` exists in the rendered tree.
