# US-039: Action Panel Clarity (Persistent Controls + Instructional Prompt)

## Status

- State: Implemented and committed in commit b58762c
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

---

## Codex Summary

Implemented and committed everything for `US-039`.

Commit:

- `b58762c`
- Message: `feat(game): US-039 action panel clarity`

Verification status:

- `npx vitest run` passed
- `npx tsc --noEmit` passed
- `npx prettier --write .` applied during the flow
- `npm run check:all` passed (full Rust + TS + lint + tests)

Summary:

- ACs implemented: action panel instruction clarity and persistent visible action controls (disabled when unavailable), across setup/charleston/playing/read-only states.
- ECs implemented: suppressed/unavailable actions remain visible and disabled; turn/selection-dependent messaging and button states validated.
- Deferred items: none.
- Test files touched: `10` total (`1` new test file: `ActionBarPhaseActions.test.tsx`).

---

## Claude Review

US-039: Action Panel Clarity — MOSTLY PASS with one issue to flag
AC-1 ✓: Phase-level return null branches are eliminated. All phases now render {instruction} + buttons with disabled prop.

AC-2 ✓: Discard and pass buttons use disabled={...} prop rather than conditional omission for the previously-problematic suppressCharlestonPassAction and not-my-turn cases.

AC-3 ✓: getInstructionText is defined in ActionBarDerivations.ts:70–121, data-testid="action-instruction" is rendered in every non-readOnly code path.

One minor bug — courtesy pass instruction copy:

ActionBarDerivations.ts:80:

return `Select ${selectedCount} ${selectedCount === 1 ? 'tile' : 'tiles'} for courtesy pass`;
selectedCount is the number of tiles already selected, so at 0 tiles selected this produces "Select 0 tiles for courtesy pass", which is misleading. The spec says "Select N tiles for courtesy pass" where N should be the target count (courtesyPassCount). The function signature doesn't receive courtesyPassCount, so it can't produce the correct copy.

One secondary gap — Mahjong/Joker/Hint buttons are still conditionally omitted:

In ActionBarPhaseActions.tsx:249–270, canDeclareMahjong, canExchangeJoker, and canRequestHint buttons use {flag && <Button ...>}. These are absent from the DOM when not applicable rather than disabled. This technically violates AC-1/AC-2 for those buttons. Whether this is in-scope for US-039 depends on how you define "major action buttons" — the story notes only cited the suppressCharlestonPassAction null-return as the problematic case, so Codex may have reasonably treated these as out of scope.

---

## Claude Fixes

Changes made

### ActionBarDerivations.ts

- Added `courtesyPassCount?: number` as a 4th param to `getInstructionText`.
- Courtesy pass copy now reads from `courtesyPassCount` (the target count) rather than `selectedCount` (the current selection). Falls back to `selectedCount` if the caller doesn't pass it.

### ActionBarPhaseActions.tsx

- Passes `courtesyPassCount` as the 4th arg to `getInstructionText`.
- `declare-mahjong-button` and `exchange-joker-button` are now always rendered in the Discarding/my-turn branch. `disabled` is set via `!canDeclareMahjong` / `!canExchangeJoker` instead of conditional omission.
- `get-hint-button` is now gated only on `onOpenHintRequest` being defined (feature wired up). `canRequestHint=false` now just disables the button rather than hiding it.

### ActionBarDerivations.test.ts

- Updated the courtesy pass test to pass `courtesyPassCount` as the 4th arg and assert target-based copy. Added a fallback case.

### ActionBarPhaseActions.test.tsx

- Added 4 new tests asserting that `declare-mahjong-button` and `exchange-joker-button` are in the DOM but disabled when their flags are false, and enabled when true.
