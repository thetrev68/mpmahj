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

Implemented and committed `US-040` end-to-end with TDD slices.

Commit:

- `b5c2b8a`
- `feat(game): US-040 animation policy simplification`

AC/EC walkthrough:

- `AC-1` implemented and tested: speed selector/toggles removed from UI; `AnimationSettings` is read-only status text.
- `AC-2` implemented and tested: default behavior is normal timing (`getDuration(base) === base`).
- `AC-3` implemented and tested: with OS reduced motion active, `isEnabled()` is `false` globally.
- `EC-1` implemented and tested: media query runtime changes reactively update `reducedMotion`.
- `EC-2` implemented in behavior: critical flows still render while transition durations become `0` under reduced motion.

Key implementation points:

- Simplified [useAnimationSettings.ts](C:\Repos\mpmahj\apps\client\src\hooks\useAnimationSettings.ts) to OS preference only.
- Removed animation preference state/update wiring from phase consumers:
  - [PlayingPhase.tsx](C:\Repos\mpmahj\apps\client\src\components\game\phases\PlayingPhase.tsx)
  - [PlayingPhaseOverlays.tsx](C:\Repos\mpmahj\apps\client\src\components\game\phases\playing-phase\PlayingPhaseOverlays.tsx)
  - [CharlestonPhase.tsx](C:\Repos\mpmahj\apps\client\src\components\game\phases\CharlestonPhase.tsx)
  - [SetupPhase.tsx](C:\Repos\mpmahj\apps\client\src\components\game\phases\SetupPhase.tsx)
  - [WinnerCelebration.tsx](C:\Repos\mpmahj\apps\client\src\components\game\WinnerCelebration.tsx)
- Simplified [AnimationSettings.tsx](C:\Repos\mpmahj\apps\client\src\components\game\AnimationSettings.tsx) to read-only policy indicator.

Verification commands run:

- `npx vitest run` ✅
- `npx tsc --noEmit` ✅
- `npx prettier --write .` ✅
- `npm run check:all` ✅

Deferred items:

- None.

Test summary:

- Updated test files: `4`
  - [useAnimationSettings.test.ts](C:\Repos\mpmahj\apps\client\src\hooks\useAnimationSettings.test.ts)
  - [AnimationSettings.test.tsx](C:\Repos\mpmahj\apps\client\src\components\game\AnimationSettings.test.tsx)
  - [PlayingPhaseOverlays.test.tsx](C:\Repos\mpmahj\apps\client\src\components\game\phases\playing-phase\PlayingPhaseOverlays.test.tsx)
  - [PlayingPhase.test.tsx](C:\Repos\mpmahj\apps\client\src\components\game\phases\PlayingPhase.test.tsx)

---

## Claude validation

## US-040 Evaluation: Complete and Accurate

### AC Walkthrough

| Criterion                                                      | Status | Evidence                                                                                                                                |
| -------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **AC-1** No speed selector or per-category toggles             | ✅     | `AnimationSettings.tsx` is a read-only status card. No `AnimationSpeed`, `updateSettings`, or toggle controls anywhere in the codebase. |
| **AC-2** Normal speed by default                               | ✅     | `getDuration(base) = reducedMotion ? 0 : base` — no multiplier. Test asserts `getDuration(500) === 500`.                                |
| **AC-3** `isEnabled()` returns `false` under OS reduced-motion | ✅     | `isEnabled = () => !reducedMotion`. Test verified.                                                                                      |

### EC Walkthrough

| Criterion                                               | Status | Evidence                                                                                                                                 |
| ------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **EC-1** Runtime media query toggle                     | ✅     | `mediaQuery.addEventListener('change', onChange)` wired up. Test uses `controls.setMatches(true)` + `act()` and asserts reactive update. |
| **EC-2** Critical visuals complete under reduced-motion | ✅     | `getDuration` returns `0` (not skipping render), so tile placement still occurs — just without CSS transition delay.                     |

### Hook Simplification

`useAnimationSettings.ts` returns exactly `{ getDuration, isEnabled, reducedMotion, prefersReducedMotion }` — no `AnimationSpeed`, no `updateSettings`, no per-animation booleans, no localStorage. The `constants.ts` has no storage key remnant.

### Phase Consumer Cleanup

All five consumers properly updated:

- **PlayingPhase.tsx** — calls `useAnimationSettings()`, passes `getDuration`/`prefersReducedMotion` down to `PlayingPhaseOverlays`
- **PlayingPhaseOverlays.tsx** — renders `<AnimationSettings prefersReducedMotion={prefersReducedMotion} />` inside the settings dialog
- **CharlestonPhase.tsx** — `useAnimationSettings()` → `isEnabled` + `prefersReducedMotion`; renders `<AnimationSettings prefersReducedMotion={prefersReducedMotion} />`
- **SetupPhase.tsx** — imports `useAnimationSettings` (uses it downstream)
- **WinnerCelebration.tsx** — `isEnabled()` drives `celebrateWithMotion` for CSS animation classes

## Minor Observation

`reducedMotion` and `prefersReducedMotion` are identical values (`useAnimationSettings.ts:54`). Both are returned per spec, so this is correct — no issue.

## Verdict

Implementation is complete and accurate. All ACs, ECs, file changes, and test coverage match the spec. No deferred gaps.
