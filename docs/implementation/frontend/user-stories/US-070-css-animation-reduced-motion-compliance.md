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

Other CSS animation sources to audit:

- `WinnerCelebration.tsx` — mentions `prefers-reduced-motion` in comments but needs
  verification that CSS confetti animations actually respect it
- Any Tailwind `animate-*` utilities applied in component classes (e.g., `animate-pulse` on
  various loading indicators)

## Scope

**In scope:**

- Add `@media (prefers-reduced-motion: reduce)` blocks to `Tile.css` that disable or
  instantly-complete all keyframe animations.
- Audit all `.css` files and inline Tailwind `animate-*` usages for motion that should be
  suppressed.
- Verify `WinnerCelebration.tsx` CSS actually respects the preference (not just commented).
- Add test assertions that animation classes are not applied (or produce zero-duration) when
  `prefers-reduced-motion` is active.

**Out of scope:**

- Changing the `useAnimationSettings` hook API.
- Adding a manual override toggle (the hook already delegates to OS preference).
- Redesigning the animation system.

## Acceptance Criteria

- AC-1: `Tile.css` contains a `@media (prefers-reduced-motion: reduce)` block that sets
  `animation: none` for `.tile-highlighted`, `.tile-newly-drawn`, `.tile-enter-from-*`, and
  `.tile-exit-*` classes.
- AC-2: `ExposedMeldsArea` upgradeable-meld `animate-pulse` is suppressed under
  reduced-motion.
- AC-3: `WinnerCelebration` confetti/particle animations produce no motion when
  `prefers-reduced-motion` is active.
- AC-4: No CSS `@keyframes` animation runs visibly when the user has opted out of motion at
  the OS level.
- AC-5: A test (or set of tests) mocks `matchMedia('(prefers-reduced-motion: reduce)')` to
  return `true` and asserts that animated elements do not have active animation classes, or
  that the computed style resolves to `animation-duration: 0s` / `animation: none`.

## Edge Cases

- EC-1: Tile highlight state (selected, disabled) must remain visually distinguishable even
  without animation — the static border/shadow styles must not depend on the animation being
  active.
- EC-2: Newly drawn tiles must still have a visible non-animated indicator (e.g., static
  border glow or background tint) so the user can tell which tile is new.

## Primary Files (Expected)

- `apps/client/src/components/game/Tile.css` — add reduced-motion media queries
- `apps/client/src/components/game/ExposedMeldsArea.tsx` — conditional animate-pulse
- `apps/client/src/components/game/WinnerCelebration.tsx` — verify/fix reduced-motion
- `apps/client/src/components/game/Tile.css` test or snapshot — assert suppression

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
  .tile-exit {
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
- Render ExposedMeldsArea with upgradeable meld — assert `animate-pulse` class absent or
  Tailwind `motion-reduce` variant applied.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/Tile.test.tsx
npx vitest run apps/client/src/components/game/ExposedMeldsArea.test.tsx
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
