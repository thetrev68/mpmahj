# US-039: Action Panel Clarity (Persistent Controls + Instructional Prompt)

## Status

- State: Not Started
- Priority: High
- Batch: A

## Problem

Action availability is not consistently visible, and users do not always get clear instruction text for required next actions.

## Scope

- Audit each phase branch in `ActionBarPhaseActions.tsx` and ensure action buttons are always rendered (disabled when not valid), not conditionally hidden.
- Add a dedicated instruction line at the top of `ActionBarPhaseActions` output that describes the current required action (e.g. "Select 3 tiles to pass", "Select a tile to discard", "Waiting for East to roll dice").
- Extract instruction copy into `ActionBarDerivations.ts` as a pure function so it is independently testable.

## Acceptance Criteria

- AC-1: All major action buttons are present in the DOM throughout gameplay (not conditionally omitted based on phase).
- AC-2: Buttons that are not currently valid are `disabled`, not hidden.
- AC-3: A text instruction line is always visible in the action panel, updating with phase and turn state.

## Edge Cases

- EC-1: In read-only/history mode, the panel shows disabled controls with the existing `data-testid="action-bar-read-only"` message — no changes needed to read-only branch.
- EC-2: Instruction copy updates immediately when server state changes mid-action (derived from props, not local state).

## Primary Files (Expected)

- `apps/client/src/components/game/ActionBarPhaseActions.tsx` — refactor phase branches to always render buttons; add instruction line at top of each branch
- `apps/client/src/components/game/ActionBarDerivations.ts` — add `getInstructionText(phase, mySeat, context): string` pure function
- `apps/client/src/components/game/ActionBar.tsx` — no structural changes needed; `ActionBarPhaseActions` is already composed here

## Notes for Implementer

- **Current behavior**: `ActionBarPhaseActions.tsx` returns `null` in some branches (e.g. `suppressCharlestonPassAction && phase.Charleston !== 'CourtesyAcross'` returns `null`). These null returns hide buttons entirely rather than disabling them.
- **AC-2 approach**: Replace `return null` branches with a render that shows buttons in `disabled` state. The buttons can still be `disabled={true}` — they just must be in the DOM.
- **Instruction text function**: Add `getInstructionText(phase: GamePhase, mySeat: Seat, selectedCount: number): string` to `ActionBarDerivations.ts`. Example outputs:
  - Setup/RollingDice + East seat → `"Roll dice to start the game"`
  - Setup/RollingDice + other seat → `"Waiting for East to roll dice"`
  - Charleston → `"Select 3 tiles to pass"` (or `"Select N tiles for courtesy pass"`)
  - Playing/Discarding + my turn → `"Select a tile to discard"`
  - Playing/Discarding + not my turn → `"${seat}'s turn to discard"`
  - Playing/Drawing → `"Drawing tile…"`
- **Instruction line placement**: Render it as the first element in the `ActionBarPhaseActions` return, above buttons, with `data-testid="action-instruction"`. Use existing `text-center text-gray-300 text-sm` style.
- **`ActionBarDerivations.test.ts`**: A test file likely already exists (or create it at `src/components/game/ActionBarDerivations.test.ts`). Add test cases for each instruction text variant.

## Test Plan

- Update `ActionBar.test.tsx`: assert that action buttons are present in the DOM even in phases where they were previously hidden.
- Add tests to `ActionBarDerivations.test.ts` (create if absent): cover each phase/turn combination for `getInstructionText`.
- Update `ActionBarPhaseActions.test.tsx` (or `ActionBar.test.tsx`): assert `data-testid="action-instruction"` is present and contains expected copy for key game states.
