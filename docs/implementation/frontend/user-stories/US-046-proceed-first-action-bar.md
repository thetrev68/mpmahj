# US-046: Proceed-First Action Bar

## Status

- State: Proposed
- Priority: High
- Batch: Proceed Flow

## Problem

The current action bar still exposes multiple action-specific buttons and labels. That works mechanically, but it does not produce the clear, repeatable "select -> proceed" interaction model we want.

## Scope

- Replace the current context-specific primary action buttons in `ActionBar` with a single dominant `Proceed` button.
- Keep instruction text as the first-class explanation of what `Proceed` will do.
- Preserve `Mahjong` as a separate explicit action.
- Apply the new pattern to:
  - Charleston passes
  - Charleston round vote / stop flow
  - courtesy pass
  - normal discard turn
- Remove `Sort` from the action bar completely.

## Acceptance Criteria

- AC-1: The action bar presents one dominant primary action labeled `Proceed` during Charleston and normal discard flow.
- AC-2: Instruction copy always explains what `Proceed` will do in the current state.
- AC-3: `Mahjong` remains a separate visible action when eligible and is never folded into `Proceed`.
- AC-4: `Sort Hand` is no longer rendered by `ActionBar`.
- AC-5: Charleston stop/continue flow is expressed via staged tile count plus `Proceed`, not via a separate visible vote button vocabulary.

## Edge Cases

- EC-1: In read-only/history mode, the existing read-only message still replaces interactive controls.
- EC-2: `Proceed` remains disabled only when the current action truly cannot be completed; it should not be disabled for flows where "do nothing and continue" is valid. Call-window enabled/disabled logic is out of scope here — that belongs to US-047.
- EC-3: Courtesy pass instruction copy uses the negotiated target count, not current selection count.

## Primary Files (Expected)

- `apps/client/src/components/game/ActionBar.tsx`
- `apps/client/src/components/game/ActionBarPhaseActions.tsx`
- `apps/client/src/components/game/ActionBarDerivations.ts`
- `apps/client/src/components/game/ActionBar.types.ts`
- `apps/client/src/components/game/ActionBar.test.tsx`
- `apps/client/src/components/game/ActionBarPhaseActions.test.tsx`
- `apps/client/src/components/game/ActionBarDerivations.test.ts`

## Notes for Implementer

- The new primary CTA is intentionally stable. The instruction text carries the meaning.
- Charleston instruction copy should be explicit about direction and count.
- Round vote behavior should read like:
  - stage `3` tiles -> continue
  - stage `0` tiles -> stop
- `Sort` is moved out of scope for this component; do not replace it with another bottom-bar utility.
- This story does not remove the modal call window yet. That happens in US-047.

## Test Plan

- Update action-bar tests to assert `Proceed` appears for Charleston and discard contexts.
- Assert `Sort Hand` is absent from `ActionBar`.
- Assert instruction copy explains the current action for:
  - first Charleston pass
  - courtesy pass
  - discard turn
  - non-turn waiting state
- Assert `Mahjong` remains separately rendered and enabled only when eligible.
