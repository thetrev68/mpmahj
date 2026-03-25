# US-087: Charleston Mahjong Signal and Post-Audit Code Cleanup

## Status

- State: Proposed
- Priority: High
- Batch: M
- Implementation Ready: Yes

## Problem

A hostile review of the US-084 and US-085 implementations found five concrete defects:

1. **Charleston Mahjong signal is wrong.** US-084 always demotes the `Mahjong` button during
   Charleston, even when `canDeclareMahjong=true`. This is incorrect game logic. Mahjong is a valid
   win condition during Charleston — East can win on a Heavenly hand (initial 14-tile deal, before
   any passing starts) or on an Earthly hand (after the first compulsory Charleston or after the
   second optional Charleston). East is the only player with 14 tiles during these windows. When the
   server asserts `canDeclareMahjong=true` in the Charleston phase, the button must escalate to the
   full primary CTA treatment, not stay demoted with only an amber accent.

2. **Four dead props remain in `ActionBarPhaseActions`.** `myVote`, `votedPlayers`, `totalPlayers`,
   and `botVoteMessage` are declared in the interface, forwarded through `ActionBar`, destructured in
   `ActionBarPhaseActions`, and never referenced in JSX. They are dead prop bloat left over from a
   removed vote-panel surface.

3. **`getPatternVariantLabel` has dead-code logic.** Both branches of the conditional return
   `pattern.variation_id || pattern.pattern_id`. The `if` guard on `duplicateNameCounts` is a
   no-op. The `duplicateNameCounts` `reduce` on `bestPatterns` is computed every render for no
   purpose. The intended behavior — always show the variant label — should be expressed directly.

4. **`onNeedsExtraVerticalSpace` (EC-4 of US-084) has zero test coverage.** The
   `ResizeObserver`-based `updateSpacePressure` callback in `RightRailHintSection` fires
   `onNeedsExtraVerticalSpace(true/false)` based on scroll overflow, but no test exercises this path
   or verifies the `data-hint-expanded` attribute is set when overflow is detected.

5. **`TurnIndicator` has no call sites — US-085 AC-4 was not delivered at runtime.** The component
   was updated to use `absolute inset-0` positioning and gained a `data-positioning="board-relative"`
   attribute, but it is imported only by its own test file. No phase component renders it. The
   audit finding ("east-side indicator drifts into the rail") remains structurally possible the
   moment something does render the component. This item is deferred to US-086 AC-10, which already
   owns board-region ownership and `TurnIndicator.tsx` as a primary file. It is called out here as
   a blocking gap in US-085.

## Scope

**In scope:**

- Correct the Charleston `Mahjong` button escalation rule so that `canDeclareMahjong=true` in
  Charleston produces the full primary CTA treatment (yellow gradient, pulse) while
  `canDeclareMahjong=false` keeps the demoted muted treatment.
- Remove `myVote`, `votedPlayers`, `totalPlayers`, and `botVoteMessage` from the
  `ActionBarPhaseActionsProps` interface, the `ActionBar.tsx` forwarding chain, and all related
  test props.
- Simplify `getPatternVariantLabel` to remove the dead conditional and eliminate the dead
  `duplicateNameCounts` `reduce`.
- Add test coverage for the `onNeedsExtraVerticalSpace` callback via a mocked `ResizeObserver`
  in `RightRailHintSection.test.tsx`.
- Document the `26rem` magic number in `GameBoard.tsx` with an inline comment explaining its
  constituent parts (1rem left padding + 1rem right padding + 24rem min-rail width = 26rem) so
  the link between layout padding and the board-width formula is not implicit.

**Out of scope:**

- Wiring `TurnIndicator` into the component tree. That belongs to US-086 AC-10.
- Changing the CTA hierarchy for any phase other than Charleston.
- Changing the right-rail layout or hint surface styles established by US-084.
- Redesigning the voting surface or restoring removed vote-panel props.

## Acceptance Criteria

- AC-1: When `canDeclareMahjong=false` during any Charleston stage, the `Mahjong` button uses
  the demoted muted treatment (outline, no amber accent, no pulse, no gradient) established by
  US-084.
- AC-2: When `canDeclareMahjong=true` during any Charleston stage, the `Mahjong` button escalates
  to the full primary CTA treatment: yellow gradient, `animate-pulse`, same styling used in the
  Playing phase.
- AC-3: The `ActionBarPhaseActionsProps` interface no longer declares `myVote`, `votedPlayers`,
  `totalPlayers`, or `botVoteMessage`. No TypeScript errors are introduced by removal.
- AC-4: `ActionBar.tsx` no longer accepts or forwards the four removed props. Callers that
  previously passed them compile cleanly after removal.
- AC-5: `getPatternVariantLabel` has no dead conditional. The `duplicateNameCounts` `reduce` is
  removed. The function always returns the variant label (existing behavior, made explicit).
- AC-6: A test in `RightRailHintSection.test.tsx` exercises `onNeedsExtraVerticalSpace` via a
  mocked `ResizeObserver` and asserts the callback fires `true` when scroll overflow is present
  and `false` when no hint is active.
- AC-7: The `board-controls-row` and `square-board-container` width formula in `GameBoard.tsx`
  carries an inline comment explaining that `26rem` = 1rem (left pad) + 1rem (right pad) + 24rem
  (min-rail width).

## Game Rules Reference

**Charleston Mahjong windows (East only):**

- **Heavenly hand:** East holds a winning 14-tile hand from the initial deal, before any tile
  passing has occurred. The server will assert `canDeclareMahjong=true` at the start of the
  Charleston phase if East's initial hand is a Mahjong.
- **Earthly hand:** East completes a winning hand after the first compulsory Charleston pass or
  after the second optional Charleston pass. East is the only player who may hold 14 tiles
  between Charleston stages, so only East can reach this condition.

In both cases the server drives `canDeclareMahjong`. The frontend does not need to detect the
game-rule window independently — it must only respond to the flag correctly by escalating rather
than demoting the button.

## Edge Cases

- EC-1: The `Mahjong` button must remain enabled and clickable when `canDeclareMahjong=true` in
  Charleston so East can execute the win.
- EC-2: Read-only/historical Charleston must not accidentally show a promoted `Mahjong` button.
  The `readOnly` early-return guard in `ActionBarPhaseActions` already covers this path.
- EC-3: If `canDeclareMahjong` flips from `false` to `true` mid-Charleston (server update), the
  button must escalate without requiring a page reload or phase remount.
- EC-4: Removing the four dead props must not silently break any callers that still pass them.
  TypeScript should catch remaining prop references at compile time.
- EC-5: The `getPatternVariantLabel` simplification must not change the rendered output for any
  existing fixture. Both duplicate and unique pattern names must continue to show their variant
  label.

## Primary Files (Expected)

- `apps/client/src/components/game/ActionBarPhaseActions.tsx`
- `apps/client/src/components/game/ActionBar.tsx`
- `apps/client/src/components/game/ActionBar.types.ts`
- `apps/client/src/components/game/HintPanel.tsx`
- `apps/client/src/components/game/RightRailHintSection.tsx`
- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/ActionBarPhaseActions.test.tsx`
- `apps/client/src/components/game/ActionBar.test.tsx`
- `apps/client/src/components/game/HintPanel.test.tsx`
- `apps/client/src/components/game/RightRailHintSection.test.tsx`

## Notes for Implementer

### Charleston Mahjong escalation

The fix is in `ActionBarPhaseActions.tsx` at the point where `mahjongButton` is constructed inside
the Charleston branch. Currently:

```ts
const mahjongButton = renderMahjongButton(disabled || isBusy || !canDeclareMahjong, {
  demoted: true,
  actionable: canDeclareMahjong,
});
```

The `demoted: true` should track whether Mahjong is actually available:

```ts
const mahjongButton = renderMahjongButton(disabled || isBusy || !canDeclareMahjong, {
  demoted: !canDeclareMahjong,
});
```

When `canDeclareMahjong=false`: `demoted=true`, button disabled → muted outline. No amber.
When `canDeclareMahjong=true`: `demoted=false`, button enabled → full yellow gradient with pulse.

The `actionable` flag is no longer needed in this model. The demoted/non-demoted split is already
conveyed by `demoted: !canDeclareMahjong` plus the `buttonDisabled` guard.

### Dead props removal

Remove from `ActionBarPhaseActionsProps`: `myVote`, `votedPlayers`, `totalPlayers`,
`botVoteMessage`. Remove the corresponding entries from the destructuring, from `ActionBar.tsx`
forwarding, and from `ActionBar.types.ts` if they are declared there and nowhere else consumed.
Check all test files for `votedPlayers: []`, `totalPlayers: 4` etc. in `baseProps` and remove
them. TypeScript will surface any callers that still pass the props.

### `getPatternVariantLabel` simplification

Replace the entire function and the `duplicateNameCounts` reduce with:

```ts
function getPatternVariantLabel(pattern: PatternSummary): string {
  return pattern.variation_id || pattern.pattern_id;
}
```

Update the call site and remove the `duplicateNameCounts` variable from the parent. The test at
`HintPanel.test.tsx` line 127 ("unique pattern names still show a key identifier") already
encodes this as the expected behavior, so no test behavior changes — only the test for the
duplicate-name case at line 91 should be checked to confirm it still passes.

### `onNeedsExtraVerticalSpace` test

In the test, mock `ResizeObserver`, render `RightRailHintSection` with a non-empty `currentHint`,
set `scrollHeight > clientHeight` on the body ref, trigger the observer callback, and assert that
the provided `onNeedsExtraVerticalSpace` spy was called with `true`. Then remove the hint (or set
`currentHint={null}`) and assert it was called with `false`.

## Test Plan

- Update `ActionBarPhaseActions.test.tsx`:
  - The existing test "AC-1/AC-2: Charleston Mahjong button uses a demoted non-pulsing treatment
    in the baseline case" currently tests `canDeclareMahjong={true}` and expects amber outline
    classes. Update it to test `canDeclareMahjong={false}` for the demoted baseline, and add a
    new test that asserts `canDeclareMahjong={true}` produces the yellow gradient and
    `animate-pulse` classes (same as Playing phase).
  - Remove `myVote`, `votedPlayers`, `totalPlayers`, `botVoteMessage` from `baseProps`.
  - Verify the `EC-1` test (line 368) no longer expects `border-amber-400/70` on an actionable
    Charleston Mahjong button — it should now expect the yellow gradient.
- Update `HintPanel.test.tsx`:
  - Confirm all existing tests still pass after `getPatternVariantLabel` simplification.
  - No behavior changes expected.
- Add to `RightRailHintSection.test.tsx`:
  - Test that `onNeedsExtraVerticalSpace(true)` fires when the hint body overflows.
  - Test that `onNeedsExtraVerticalSpace(false)` fires when there is no hint.

## Visual Verification

Required before completion:

1. `charleston-dark-lg` with `canDeclareMahjong=false` (normal state)
   - confirm `Mahjong` button is a quiet muted outline with no amber tint
   - confirm `Proceed` is still the clear primary CTA
2. `charleston-dark-lg` with `canDeclareMahjong=true` (Heavenly/Earthly hand state)
   - confirm `Mahjong` button shows full yellow gradient with pulse
   - confirm this reads as a genuine win signal, not secondary noise
3. `playing-dark-lg`
   - confirm Playing-phase `Mahjong` button appearance is unchanged

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/ActionBarPhaseActions.test.tsx apps/client/src/components/game/ActionBar.test.tsx apps/client/src/components/game/HintPanel.test.tsx apps/client/src/components/game/RightRailHintSection.test.tsx
npx tsc --noEmit
```
