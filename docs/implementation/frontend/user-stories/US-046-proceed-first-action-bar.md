# US-046: Proceed-First Action Bar

## Status

- State: Done
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

---

## Codex Implementation Summary

Implemented and committed US-046 as `1200d15` (`Implement proceed-first action bar flow`).

The action bar is now proceed-first across Charleston and discard flow, with meaning moved into instruction copy, Charleston voting handled through `Proceed`, and `Mahjong` kept separate. The main changes are in [ActionBar.tsx](C:/Repos/mpmahj/apps/client/src/components/game/ActionBar.tsx), [ActionBarDerivations.ts](C:/Repos/mpmahj/apps/client/src/components/game/ActionBarDerivations.ts), [ActionBarPhaseActions.tsx](C:/Repos/mpmahj/apps/client/src/components/game/ActionBarPhaseActions.tsx), and [CharlestonPhase.tsx](C:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.tsx), with test coverage updated across unit and integration tests.

Verification:

- Passed: `npx vitest run` in `apps/client`
- Passed: `npx tsc --noEmit` in `apps/client`
- Passed: `cargo fmt --all`, `cargo check --workspace`, `cargo test --workspace`, `cargo clippy --all-targets --all-features`
- Passed: `npm run lint --workspaces --if-present`
- `npm run check:all` is still blocked by unrelated existing `knip` issues involving untracked `tailwind.config.cjs` / `apps/client/knip.json`, so I left those out of the commit

---

## Claude Validation

## US-046 Review

### AC Coverage

#### AC-1 — Single dominant Proceed button ✅

`renderProceedButton` is the single helper used across all Charleston and discard branches. Charleston pass uses `pass-tiles-button`, voting uses `proceed-button`, courtesy uses `courtesy-pass-tiles-button`, discard uses `discard-button`. All render the label "Proceed" (or "Proceeding…" when busy).

#### AC-2 — Instruction copy first ✅

`getInstructionText` covers all phases. The `action-instruction` element is always rendered before buttons in every branch. Copy is direction-aware (left/right/across) for Charleston passes.

#### AC-3 — Mahjong separate ✅

`declare-mahjong-button` is a distinct button rendered in the `isMe` Discarding branch, never merged into Proceed. It renders always (disabled when ineligible — a reasonable UX pattern). Tests confirm both it and Proceed coexist.

#### AC-4 — Sort Hand removed ✅

Test at [ActionBar.test.tsx:69] explicitly asserts `queryByTestId('sort-button')` is absent. No Sort button found in the component.

#### AC-5 — Vote via staged count + Proceed ✅

`VotingToContinue` branch infers Stop/Continue from `selectedTiles.length` (0 → Stop, 3 → Continue) via `getCharlestonVoteChoice`, then fires it via the single Proceed button. No separate Stop/Continue button vocabulary.

### EC Coverage

#### EC-1 — Read-only mode ✅

Early return with `action-bar-read-only` replaces all interactive controls. Tested in [ActionBarPhaseActions.test.tsx] line 156.

#### EC-2 — Proceed not over-disabled ✅

`canSubmitCharlestonVote` correctly returns `true` for 0 tiles (Stop vote is valid). Tested at [ActionBarDerivations.test.ts:115].

#### EC-3 — Courtesy copy uses target count ✅

`getInstructionText` uses `courtesyPassCount ?? selectedCount`. Tests at [ActionBarDerivations.test.ts:148-157] verify the negotiated count drives copy, not selected count.

## Minor Observations

1. **Drawing stage Proceed is always disabled** ([ActionBarPhaseActions.tsx:277]): `renderProceedButton(true, ...)` — hardcoded disabled. This is correct (player can't act during auto-draw) but there's no test asserting this. Not a bug, but a test gap.

2. **Non-turn waiting state in test plan**: The spec calls for an assertion on "non-turn waiting state" instruction copy. `getInstructionText` returns `'Waiting for West to discard.'` correctly, and `getInstructionText` tests cover it in [ActionBarDerivations.test.ts:167], but [ActionBar.test.tsx] doesn't have an explicit `action-instruction` assertion for that case. Minor gap.

3. **`ActionBar.types.ts`** was listed as a primary file but wasn't significantly changed (the interface evolved in place). Not a problem.

### Summary

Implementation is complete and accurate. All 5 ACs and 3 ECs are satisfied. Test coverage is solid across unit (Derivations), component (PhaseActions), and integration (ActionBar) layers. The two minor gaps above (Drawing test + non-turn instruction assertion) are low risk given the derivation-level coverage.
