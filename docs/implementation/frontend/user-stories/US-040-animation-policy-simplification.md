# US-040: Animation Policy Simplification (Normal or Off)

## Status

- State: Implemented
- Priority: Medium
- Batch: C

## Problem

Animation speed/options create unnecessary complexity; product direction is fixed normal speed with accessibility override.

## Scope

- Remove the Animation Speed selector and per-category toggle checkboxes from `AnimationSettings.tsx`.
- Simplify `useAnimationSettings.ts` to expose only `reducedMotion: boolean` (derived from OS `prefers-reduced-motion`) — remove `speed`, per-animation booleans, and `updateSettings`.
- Keep the `getDuration` and `isEnabled` utilities but drive them from OS preference only.
- Remove `AnimationSettings.tsx` from any settings panel that renders it, or replace it with a read-only reduced-motion status indicator.

## Acceptance Criteria

- AC-1: No animation speed selector or per-category toggle checkboxes appear in any UI.
- AC-2: All animations run at normal speed by default (speed multiplier = 1).
- AC-3: When the OS `prefers-reduced-motion` media query is active, `isEnabled()` returns `false` for all animation types.

## Edge Cases

- EC-1: Changing OS reduced-motion preference at runtime (without page reload) toggles `reducedMotion` reactively — the `mediaQuery.addEventListener('change', ...)` already handles this in `useAnimationSettings.ts`.
- EC-2: With reduced-motion active, critical state-change visuals (tile placement, meld formation) still complete — they just skip CSS transitions.

## Primary Files (Expected)

- `apps/client/src/hooks/useAnimationSettings.ts` — simplify: remove `AnimationSpeed`, per-animation toggle fields, `updateSettings`, localStorage persistence; keep `reducedMotion`, `getDuration`, `isEnabled`, `prefersReducedMotion`
- `apps/client/src/components/game/AnimationSettings.tsx` — remove Speed selector and per-category toggles; either render only a reduced-motion status banner or delete the component entirely
- `apps/client/src/components/game/AnimationSettings.test.tsx` — update for removed controls
- `apps/client/src/hooks/useAnimationSettings.test.ts` — update for simplified interface

## Notes for Implementer

- **Current `AnimationSettings.tsx`**: Renders a Card with a Speed `<Select>`, per-category `<Checkbox>` toggles (tile_movement, charleston_pass, etc.), and a "Respect reduced motion" checkbox. All of this needs to go. If the component still appears in a settings panel, replace it with a `<p>` banner that says "Animations are on (reduced motion disabled)" or similar read-only text.
- **Current `useAnimationSettings.ts`**: Has `AnimationPreferences` interface with `speed`, five boolean toggles, and `respect_reduced_motion`. Simplify to just watch `window.matchMedia('(prefers-reduced-motion: reduce)')`. The simplified return should be `{ reducedMotion, getDuration, isEnabled, prefersReducedMotion }`.
- **`getDuration` simplified**: `return reducedMotion ? 0 : baseDurationMs` — no speed multiplier.
- **`isEnabled` simplified**: `return !reducedMotion && settings[animation]` becomes `return !reducedMotion`.
- **`AnimationSpeed` type**: Used in `AnimationSettings.tsx` and `useAnimationSettings.ts` — can be deleted entirely.
- **localStorage**: Remove the `ANIMATION_SETTINGS_STORAGE_KEY` localStorage read/write. No user prefs to persist.
- **Callers of `updateSettings`**: Run `npx tsc --noEmit` after removing `updateSettings` to find all call sites. There should be few — likely only `AnimationSettings.tsx` itself.
- **`useGameAnimations.ts`**: Only needs changes if it calls `updateSettings` or reads removed fields. Check with grep first.

## Test Plan

- Update `AnimationSettings.test.tsx`: remove assertions for speed selector (`data-testid="animation-speed-select"`) and per-category checkboxes. Assert none of those testids are present.
- Update `useAnimationSettings.test.ts`: remove tests for `updateSettings`, speed multipliers, and per-animation toggle behavior. Assert `getDuration(500)` returns `500` by default and `0` when reduced-motion is active.
- Run `npx tsc --noEmit` and `npx vitest run` after simplification.

---

## Codex implementation summary
