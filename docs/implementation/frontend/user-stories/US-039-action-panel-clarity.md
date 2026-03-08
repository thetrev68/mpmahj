# US-039: Action Panel Clarity (Persistent Controls + Instructional Prompt)

## Status

- State: Not Started
- Priority: High
- Batch: A

## Problem

Action availability is not consistently visible, and users do not always get clear instruction text for required next actions.

## Scope

- Keep all major action buttons visible at all times.
- Enable/disable buttons by current state only.
- Add explicit instruction line in action panel for the current required input (example: "Select 3 tiles to pass").

## Acceptance Criteria

- AC-1: Action panel displays full control set throughout gameplay.
- AC-2: Non-valid actions are disabled, not hidden.
- AC-3: Instructional prompt updates with phase/turn requirements.

## Edge Cases

- EC-1: Read-only/history mode still shows immutable controls with clear lock state.
- EC-2: Instruction copy remains correct when server state updates mid-action.

## Primary Files (Expected)

- `apps/client/src/components/game/ActionBar.tsx`
- `apps/client/src/components/game/ActionBarPhaseActions.tsx`
- `apps/client/src/components/game/ActionBarDerivations.ts`

## Test Plan

- Expand `ActionBar.test.tsx` with always-visible control expectations.
- Add prompt-copy tests by phase in `ActionBarDerivations.test.ts`.
