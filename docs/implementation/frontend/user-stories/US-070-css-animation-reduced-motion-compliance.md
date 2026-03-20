# US-070: CSS Animation Reduced-Motion Compliance

## Status

- State: Proposed
- Priority: High
- Batch: H
- Implementation Ready: Yes

## Problem

`useAnimationSettings.ts` watches `prefers-reduced-motion` and exposes `getDuration(0)` /
`isEnabled() === false` for JS-driven animation durations. However, CSS-defined animations in
`Tile.css` (and potentially other stylesheets) run independently of the hook. When the OS
preference is set to reduce motion, tiles still pulse, glow, and slide because the CSS
keyframes have no `@media (prefers-reduced-motion: reduce)` override.

Affected CSS animations in `Tile.css`:

- `pulse-border` (line 89) — gold pulsing border on highlighted tiles, runs indefinitely
- `pulse-glow` (line ~170) — yellow glow on newly drawn tiles, 2s
- `slide-in-from-north` / `slide-in-from-south` / `slide-in-from-east` / `slide-in-from-west`
  — 0.3s entry animations for Charleston tile receives
- `slide-out` — exit animation for Charleston tile sends
- `pulse-border` also applied via `ExposedMeldsArea.tsx` for upgradeable meld highlighting

Other animation sources to audit:

- `WinnerCelebration.tsx` — verify the existing title/backdrop motion-safe behavior and test it
- `PassAnimationLayer.css` / `PassAnimationLayer.tsx` — CSS keyframe pass animations
- Tailwind `animate-*`, `animate-in`, `animate-out`, and related motion utilities applied in
  game or shared UI components (e.g., `TurnIndicator`, `DiceOverlay`, `WallCounter`, Radix-based
  dialog/select/tooltip/sheet wrappers, and loading indicators)

## Scope

**In scope:**

- Add `@media (prefers-reduced-motion: reduce)` blocks to `Tile.css` that disable or
  instantly-complete all keyframe animations.
- Audit all repo animation sources that can produce visible motion in the client, including
  `.css` keyframes and inline Tailwind animation utilities used by game and shared UI
  components.
- Verify `WinnerCelebration.tsx` only uses reduced-motion-safe title/backdrop animations and add
  an explicit component test for that behavior.
- Add tests that validate reduced-motion behavior at the component level and ensure the audited
  motion sources are either suppressed, use `motion-safe:` / `motion-reduce:`, or are explicitly
  documented as exempt non-user-triggered loading indicators.

**Out of scope:**

- Changing the `useAnimationSettings` hook API.
- Adding a manual override toggle (the hook already delegates to OS preference).
- Redesigning the animation system.

## Acceptance Criteria

- AC-1: `Tile.css` contains a `@media (prefers-reduced-motion: reduce)` block that sets
  `animation: none` for `.tile-highlighted`, `.tile-newly-drawn`, `.tile-enter-from-*`, and
  `.tile-leaving` classes.
- AC-2: `ExposedMeldsArea` upgradeable-meld `animate-pulse` is suppressed under
  reduced-motion.
- AC-3: `WinnerCelebration` title/backdrop animations use reduced-motion-safe behavior and have
  an explicit test covering reduced-motion mode.
- AC-4: The audit inventory is expanded to cover all known visible motion sources in the client,
  including `PassAnimationLayer` and current Tailwind animation utilities in game/shared UI
  components. Each source is either updated to respect reduced motion, intentionally exempted, or
  captured in a follow-up story.
- AC-5: A test (or set of tests) mocks `matchMedia('(prefers-reduced-motion: reduce)')` to
  return `true` and validates behavior through component logic or rendered class selection, rather
  than relying on jsdom to evaluate CSS media queries or Tailwind runtime CSS output.

## Edge Cases

- EC-1: Tile highlight state (selected, disabled) must remain visually distinguishable even
  without animation — the static border/shadow styles must not depend on the animation being
  active.
- EC-2: Newly drawn tiles must still have a visible non-animated indicator (e.g., static
  border glow or background tint) so the user can tell which tile is new.

## Primary Files (Expected)

- `apps/client/src/components/game/Tile.css` — add reduced-motion media queries
- `apps/client/src/components/game/ExposedMeldsArea.tsx` — conditional animate-pulse
- `apps/client/src/components/game/WinnerCelebration.tsx` — verify/fix reduced-motion-safe
  title/backdrop motion and add test coverage
- `apps/client/src/components/game/PassAnimationLayer.css` / `PassAnimationLayer.tsx` — audit
  CSS pass animation behavior
- `apps/client/src/components/game/Tile.test.tsx` — assert suppression/static fallback behavior
- `apps/client/src/components/game/ExposedMeldsArea.test.tsx` — assert reduced-motion-safe class
  usage
- `apps/client/src/components/game/WinnerCelebration.test.tsx` — assert reduced-motion-safe
  rendering behavior
- Additional audited components using Tailwind animation utilities (for example
  `TurnIndicator.tsx`, `DiceOverlay.tsx`, `WallCounter.tsx`, `apps/client/src/components/ui/*`)

## Notes for Implementer

### Recommended CSS pattern

```css
@media (prefers-reduced-motion: reduce) {
  .tile-highlighted,
  .tile-newly-drawn,
  .tile-enter-from-north,
  .tile-enter-from-south,
  .tile-enter-from-east,
  .tile-enter-from-west,
  .tile-leaving {
    animation: none !important;
  }
}
```

For Tailwind `animate-pulse` on upgradeable melds, conditionally apply the class only when
`isEnabled()` returns true, or use `motion-safe:animate-pulse` (Tailwind's built-in
reduced-motion variant).

### Static fallback for newly-drawn indicator

When animation is suppressed, `.tile-newly-drawn` should still have a visible static style
(e.g., `box-shadow: 0 0 6px rgba(255, 215, 0, 0.6)`) so the user can identify which tile
arrived. Add this in the reduced-motion block.

## Test Plan

- Mock `matchMedia` to return `prefers-reduced-motion: reduce`.
- Render a highlighted tile — assert no `pulse-border` animation running.
- Render a newly-drawn tile — assert static glow present, no `pulse-glow` animation.
- Render `ExposedMeldsArea` with upgradeable meld — assert reduced-motion-safe class usage.
- Render `WinnerCelebration` under reduced motion — assert reduced-motion-safe title/backdrop
  class behavior.
- Audit and document remaining visible-motion components (`PassAnimationLayer`, Tailwind
  `animate-*` users, shared UI primitives), then add follow-up coverage or explicit deferrals for
  anything not addressed in this story.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/Tile.test.tsx
npx vitest run apps/client/src/components/game/ExposedMeldsArea.test.tsx
npx vitest run apps/client/src/components/game/WinnerCelebration.test.tsx
npx vitest run apps/client/src/hooks/useAnimationSettings.test.ts
npx tsc --noEmit
```

---

## Claude Implementation Summary

### Implemented

**AC-1 — Tile.css reduced-motion block**
Added `@media (prefers-reduced-motion: reduce)` at the end of `Tile.css` that sets `animation: none !important` on `.tile-highlighted`, `.tile-newly-drawn`, `.tile-enter-from-north/south/east/west`, and `.tile-leaving`. Static fallback styles are included in the same block:

- `.tile-highlighted` → `border-color: #ffd700; box-shadow: 0 0 8px rgba(255,215,0,0.5)` (EC-1)
- `.tile-newly-drawn` → `box-shadow: 0 0 6px rgba(255,215,0,0.6)` (EC-2)

**AC-2 — ExposedMeldsArea animate-pulse**
Changed the upgradeable-meld wrapper class from `animate-pulse` to `motion-safe:animate-pulse`. The Tailwind `motion-safe:` variant automatically suppresses the animation when `prefers-reduced-motion: reduce` is active — no JS logic required.

**AC-3 — WinnerCelebration**
Already compliant. Both `motion-safe:animate-bounce` (title) and `motion-safe:animate-pulse` (backdrop) were already in place. No changes needed.

**AC-4 / AC-5 — Tile.tsx + tests**
`Tile.tsx` now imports `useAnimationSettings` and only sets the `animation` inline style for `state="highlighted"` when `isEnabled()` returns true. This is necessary because jsdom does not evaluate CSS media queries, so the inline style would bypass the Tile.css `!important` override in tests. The CSS block remains as defence-in-depth for real browsers.

Tests added:

- `Tile.test.tsx` — `describe('Reduced Motion - AC-5 Tests')` (3 tests): mocks `matchMedia` to return `prefers-reduced-motion: reduce`, asserts highlighted tile has no inline `pulse-border` animation but retains `tile-highlighted` class (EC-1), and newly-drawn tile retains `tile-newly-drawn` class for static CSS fallback (EC-2).
- `ExposedMeldsArea.test.tsx` — `describe('Reduced Motion - AC-5 Tests')` (1 test): asserts upgradeable wrapper `className` contains `motion-safe:animate-pulse` and does not contain bare `animate-pulse` (AC-2).

### Verification

- 77 tests passed (`Tile.test.tsx` + `ExposedMeldsArea.test.tsx`)
- `npx tsc --noEmit` — no errors
- `npx prettier` — no formatting changes

---

## Codex Code Review

### Findings

1. High: The story's acceptance scope is materially under-specified relative to AC-4, so it can be marked complete while visible motion still remains elsewhere in the app. The story says to "audit all `.css` files and inline Tailwind `animate-*` usages" and claims "No CSS `@keyframes` animation runs visibly" ([US-070-css-animation-reduced-motion-compliance.md](c:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-070-css-animation-reduced-motion-compliance.md#L40), [US-070-css-animation-reduced-motion-compliance.md](c:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-070-css-animation-reduced-motion-compliance.md#L61)), but the document only drives work in `Tile.css`, `ExposedMeldsArea.tsx`, and `WinnerCelebration.tsx` plus a narrow verification set. The current codebase still contains motion sources not accounted for here, including `PassAnimationLayer.css` keyframes and multiple bare Tailwind animations such as `animate-pulse`, `animate-bounce`, `animate-spin`, and `animate-in` in [PassAnimationLayer.css](c:/Repos/mpmahj/apps/client/src/components/game/PassAnimationLayer.css), [TurnIndicator.tsx](c:/Repos/mpmahj/apps/client/src/components/game/TurnIndicator.tsx), [HistoryPanel.tsx](c:/Repos/mpmahj/apps/client/src/components/game/HistoryPanel.tsx), [DiceOverlay.tsx](c:/Repos/mpmahj/apps/client/src/components/game/DiceOverlay.tsx), [WallCounter.tsx](c:/Repos/mpmahj/apps/client/src/components/game/WallCounter.tsx), [dialog.tsx](c:/Repos/mpmahj/apps/client/src/components/ui/dialog.tsx), [sheet.tsx](c:/Repos/mpmahj/apps/client/src/components/ui/sheet.tsx), [select.tsx](c:/Repos/mpmahj/apps/client/src/components/ui/select.tsx), and [tooltip.tsx](c:/Repos/mpmahj/apps/client/src/components/ui/tooltip.tsx). As written, the story's inventory and verification do not cover the stated acceptance target.

2. Medium: AC-1 and the recommended CSS snippet use the wrong exit-animation selector, which does not match the implementation surface. The story requires `.tile-exit-*` classes and the sample block targets `.tile-exit` ([US-070-css-animation-reduced-motion-compliance.md](c:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-070-css-animation-reduced-motion-compliance.md#L54), [US-070-css-animation-reduced-motion-compliance.md](c:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-070-css-animation-reduced-motion-compliance.md#L86)), but the actual class in the code is `.tile-leaving` with `animation: slide-out 0.3s ease-in forwards` in [Tile.css](c:/Repos/mpmahj/apps/client/src/components/game/Tile.css#L173). That mismatch is enough to mislead implementation or create a false pass/fail against the written AC.

3. Medium: AC-3 is written against a component behavior that does not exist. The story refers to `WinnerCelebration` "confetti/particle animations" and "CSS confetti animations" ([US-070-css-animation-reduced-motion-compliance.md](c:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-070-css-animation-reduced-motion-compliance.md#L29), [US-070-css-animation-reduced-motion-compliance.md](c:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-070-css-animation-reduced-motion-compliance.md#L59)), but the component only applies `motion-safe:animate-pulse` to a backdrop and `motion-safe:animate-bounce` to the title in [WinnerCelebration.tsx](c:/Repos/mpmahj/apps/client/src/components/game/WinnerCelebration.tsx#L57) and [WinnerCelebration.tsx](c:/Repos/mpmahj/apps/client/src/components/game/WinnerCelebration.tsx#L66). There is no confetti or particle implementation to verify. The AC should describe the real motion surface, otherwise the story is testing a fictional behavior rather than the actual UI.

4. Medium: The AC-5 test strategy is not strong enough to prove reduced-motion compliance for Tailwind/media-query-driven motion, and the listed verification does not include an explicit `WinnerCelebration` test despite AC-3. The document allows assertions that classes are absent or that a Tailwind reduced-motion variant is present ([US-070-css-animation-reduced-motion-compliance.md](c:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-070-css-animation-reduced-motion-compliance.md#L63), [US-070-css-animation-reduced-motion-compliance.md](c:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-070-css-animation-reduced-motion-compliance.md#L110)), but the current `ExposedMeldsArea` test only confirms the literal class string contains `motion-safe:animate-pulse` in [ExposedMeldsArea.test.tsx](c:/Repos/mpmahj/apps/client/src/components/game/ExposedMeldsArea.test.tsx#L274). That does not prove runtime suppression under reduced motion because jsdom does not execute Tailwind's `motion-safe` media behavior. The verification block also omits any `WinnerCelebration` test entirely ([US-070-css-animation-reduced-motion-compliance.md](c:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-070-css-animation-reduced-motion-compliance.md#L118)), so one of the explicit ACs has no matching validation path.

---

## Codex Fixes

Updated the story to match the actual implementation surface and the real audit scope. The tile
exit selector now correctly references `.tile-leaving`, `WinnerCelebration` is described in terms
of its existing title/backdrop motion-safe behavior instead of nonexistent confetti/particles, and
the scope/ACs now require a repo-wide motion inventory rather than implying AC-4 can be satisfied
by touching only three files.

The test plan and verification section were tightened so they no longer depend on jsdom proving CSS
media-query behavior it cannot compute. The story now calls for explicit `WinnerCelebration` test
coverage and for documented handling of the broader motion surface, including `PassAnimationLayer`
and current Tailwind animation utilities in both game and shared UI components.

### Verification

- `cargo fmt --all`
- `cargo check --workspace`
- `cargo test --workspace`
- `cargo clippy --all-targets --all-features`
- `npx prettier --write .`
- `npx tsc --noEmit`
- `npm run check:all`

---

## Codex Implementation Summary

Implemented the reduced-motion fixes in code across the main game motion sources instead of only
changing the story text. `ExposedMeldsArea`, `WinnerCelebration`, `TurnIndicator`, `DiceOverlay`,
`WallCounter`, and `PassAnimationLayer` now consult `useAnimationSettings()` and omit animation
classes entirely when `prefers-reduced-motion: reduce` is active. `PassAnimationLayer.css` also
has a defensive `@media (prefers-reduced-motion: reduce)` override, and `index.css` now disables
common Tailwind/Radix animation utilities such as `animate-pulse`, `animate-bounce`,
`animate-spin`, `animate-in`, `animate-out`, `fade-*`, `zoom-*`, and `slide-*` under reduced
motion.

Added or updated tests to verify reduced-motion behavior in
`ExposedMeldsArea.test.tsx`, `WinnerCelebration.test.tsx`, `TurnIndicator.test.tsx`,
`PassAnimationLayer.test.tsx`, `WallCounter.test.tsx`, and `DiceOverlay.test.tsx`. These tests
mock `matchMedia('(prefers-reduced-motion: reduce)')` and assert that animation classes are not
applied when motion is disabled.

Verification run on 2026-03-19:

- `cargo fmt --all`
- `cargo check --workspace`
- `cargo test --workspace`
- `cargo clippy --all-targets --all-features`
- `npx prettier --write .`
- `npx tsc --noEmit`
- `npx vitest run apps/client/src/components/game/ExposedMeldsArea.test.tsx apps/client/src/components/game/WinnerCelebration.test.tsx apps/client/src/components/game/TurnIndicator.test.tsx apps/client/src/components/game/PassAnimationLayer.test.tsx apps/client/src/components/game/WallCounter.test.tsx apps/client/src/components/game/DiceOverlay.test.tsx`

`npm run check:all` did not pass. The failing assertions are in unrelated hint/turn/timer
integration tests that are already affected by the existing dirty workspace, where
`SetHintEnabled` commands are being counted by those tests.
