# US-040: Animation Policy Simplification (Normal or Off)

## Status

- State: Not Started
- Priority: Medium
- Batch: C

## Problem

Animation speed/options create unnecessary complexity; product direction is fixed normal speed with accessibility override.

## Scope

- Remove user-facing animation speed/enable controls.
- Default animations to normal.
- Respect reduced-motion preference by disabling animations globally.

## Acceptance Criteria

- AC-1: No UI control for animation speed appears.
- AC-2: Animations run at normal behavior by default.
- AC-3: Reduced-motion setting disables gameplay animations.

## Edge Cases

- EC-1: Reduced-motion toggles at runtime without page reload.
- EC-2: Critical state-change visuals remain perceivable without animation.

## Primary Files (Expected)

- `apps/client/src/components/game/AnimationSettings.tsx`
- `apps/client/src/hooks/useAnimationSettings.ts`
- `apps/client/src/hooks/useGameAnimations.ts`

## Test Plan

- Update `AnimationSettings.test.tsx` for removed controls.
- Add/adjust reduced-motion behavior tests in `useGameAnimations.test.ts`.
