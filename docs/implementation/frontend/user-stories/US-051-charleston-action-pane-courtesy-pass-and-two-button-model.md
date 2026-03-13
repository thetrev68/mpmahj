# US-051: Charleston Action Pane — Courtesy Pass Text + Persistent Two-Button Model

## Status

- State: Proposed
- Priority: High
- Batch: E

## Problem

Two related issues make the Charleston action pane confusing and visually unstable.

### C-3 — Courtesy Pass: Duplicate UI + Wrong Prompt Text

During the `CourtesyAcross` stage a floating Card-based panel — `CourtesyPassPanel` — appears
at the top of the board (`absolute left-1/2 top-36 z-20`). It shows "Negotiate with {seat} - select
0-3 tiles" and offers four count buttons (Skip / 1 / 2 / 3). This panel is mounted in
`CharlestonPhase.tsx` (lines 472–482) and is redundant: the action pane already has a Proceed
button for the same stage. Two surfaces for the same action causes confusion.

A second absolute-positioned panel — `CourtesyNegotiationStatus` — renders at the same board
location while a negotiation outcome is in flight (lines 484–495). It is part of the same
modal-style pattern and is removed by this story alongside `CourtesyPassPanel`.

The action pane instruction text produced by `getInstructionText` for `CourtesyAcross` currently
reads _"Courtesy pass. Select N tiles for your across partner, then press Proceed."_ where N is
a specific agreed count rather than the full valid range. The correct prompt is:
_"Courtesy pass. Select 0–3 tiles for your across partner, then press Proceed."_

### C-4 — Action Pane: Persistent Proceed + Mahjong Buttons

During Charleston the action pane renders different button layouts for each sub-stage. Standard
passes show only a Proceed button. `CourtesyAcross` shows only a Proceed button with a different
testid. `VotingToContinue` shows only a Proceed button with a third testid. The Mahjong button is
absent from all Charleston sub-stages. The result is that the button set changes shape as the
game advances, which is disorienting.

The fix is to always render exactly two buttons in the Charleston action pane: **Proceed** and
**Mahjong**. Both are always visible. Each is disabled when its action is not currently available.
This two-button model is the Charleston half of a pattern that `US-052` will mirror for gameplay.

## Scope

**In scope:**

- Remove `CourtesyPassPanel` from `CharlestonPhase.tsx` (mount site: lines 472–482, condition
  `isCourtesyStage && !negotiationType`).
- Remove `CourtesyNegotiationStatus` from `CharlestonPhase.tsx` (mount site: lines 484–495,
  condition `isCourtesyStage && negotiationType && agreedCount !== undefined`).
- Delete the component files `CourtesyPassPanel.tsx`, `CourtesyPassPanel.test.tsx`,
  `CourtesyNegotiationStatus.tsx`, and `CourtesyNegotiationStatus.test.tsx` (each is only used
  in CharlestonPhase.tsx).
- Fix the `CourtesyAcross` instruction text in `ActionBarDerivations.ts` to read:
  _"Courtesy pass. Select 0–3 tiles for your across partner, then press Proceed."_
- Add a Mahjong button to the Charleston branch of `ActionBarPhaseActions.tsx`. The button is
  always rendered; it is disabled unless `canDeclareMahjong` is true (which the server will
  keep false during Charleston in normal play).
- Collapse the three Charleston-specific Proceed testids (`pass-tiles-button`,
  `courtesy-pass-tiles-button`, `proceed-button`) to a single `proceed-button` testid so the
  Proceed button has a stable, phase-invariant identity in Charleston tests.
- Update all tests that assert the old courtesy-pass-related testids or the old modal elements.

**Out of scope:**

- Gameplay Proceed / Mahjong button model — covered by `US-052`. The `discard-button`,
  `call-window-proceed-button`, and playing-phase Mahjong testids are not changed here.
- `CourtesyNegotiationStatus` state logic (the underlying store actions and event handlers
  remain; only the render site is removed).
- The server-side fix to emit `canDeclareMahjong = true` during Charleston is a dependency of
  AC-7 and is already tracked in `TODO.md` (`P2 - Product/Infra Debt`: "Fix server to set
  `can_declare_mahjong = true` during Charleston when the player has Mahjong."). The frontend
  button wiring does not need to change when that fix lands.
- Any changes to the courtesy pass negotiation server protocol — this story only removes the
  modal UI overlay.
- US-039 persistent controls model — this story tightens that model for Charleston rather than
  replacing it.

## Acceptance Criteria

- AC-1: During all Charleston sub-stages (`FirstRight`, `FirstAcross`, `FirstLeft`,
  `SecondLeft`, `SecondAcross`, `SecondRight`, `CourtesyAcross`, and `VotingToContinue`), the
  action pane renders exactly two clickable action buttons: **Proceed** and **Mahjong**. No
  other clickable action buttons appear in the pane. Instruction text and status blocks may
  still render above the buttons.
- AC-2: No element with `data-testid="courtesy-pass-panel"` exists in the DOM during any
  Charleston sub-stage.
- AC-3: No element with the `CourtesyNegotiationStatus` class or testid exists in the DOM
  during any Charleston sub-stage.
- AC-4: The action pane instruction text during `CourtesyAcross` reads exactly: _"Courtesy
  pass. Select 0–3 tiles for your across partner, then press Proceed."_
- AC-5: The Proceed button uses `data-testid="proceed-button"` in all Charleston sub-stages
  (the old `pass-tiles-button` and `courtesy-pass-tiles-button` testids no longer appear).
- AC-6: The Mahjong button uses `data-testid="declare-mahjong-button"` and is present in all
  Charleston sub-stages. It is disabled when `canDeclareMahjong` is false and enabled when
  `canDeclareMahjong` is true.
- AC-7: The Mahjong button is enabled during a Charleston sub-stage if and only if
  `canDeclareMahjong` is true.
- AC-8: The Proceed button is disabled (not hidden) when its action is not currently available
  (see button-state matrix in Notes for Implementer).
- AC-9: The Proceed button is enabled when its action is available (see matrix).
- AC-10: Existing courtesy pass tile-selection flow continues to work: the player selects 0–3
  tiles from the rack, then presses Proceed in the action pane.

## Edge Cases

- EC-1: When a player has already submitted a courtesy pass and is waiting for their partner,
  the action pane shows the waiting state via instruction text only; both Proceed and Mahjong
  remain rendered (Proceed disabled, Mahjong disabled).
- EC-2: During `VotingToContinue`, the vote-panel status block (vote indicators, waiting
  message) remains rendered above the two buttons — that block is not removed by this story.
  Proceed (`proceed-button`) and Mahjong (`declare-mahjong-button`) must both appear below it.
- EC-3: Read-only / historical view mode: both buttons are absent (the read-only banner renders
  instead), consistent with current behaviour. No change to `readOnly` rendering path.
- EC-4: When `disabled` or `isBusy` is true, Proceed and Mahjong are both disabled.
- EC-5: Reconnect / remount mid-CourtesyAcross stage does not cause `CourtesyPassPanel` or
  `CourtesyNegotiationStatus` to flash back into the DOM before settling.

## Primary Files (Expected)

- `apps/client/src/components/game/phases/CharlestonPhase.tsx` — remove `CourtesyPassPanel`
  render site (lines 472–482) and `CourtesyNegotiationStatus` render site (lines 484–495);
  remove associated imports
- `apps/client/src/components/game/ActionBarPhaseActions.tsx` — Charleston branch: add Mahjong
  button to all sub-stage returns; unify Proceed testids to `proceed-button`
- `apps/client/src/components/game/ActionBarDerivations.ts` — fix `CourtesyAcross` instruction
  text (line ~129)
- `apps/client/src/components/game/CourtesyPassPanel.tsx` — delete
- `apps/client/src/components/game/CourtesyPassPanel.test.tsx` — delete
- `apps/client/src/components/game/CourtesyNegotiationStatus.tsx` — delete
- `apps/client/src/components/game/CourtesyNegotiationStatus.test.tsx` — delete
- `apps/client/src/components/game/phases/CharlestonPhase.test.tsx` — remove mock of
  `CourtesyPassPanel`; update any assertions that referenced old testids or modal elements
- `apps/client/src/components/game/ActionBarDerivations.test.ts` — update `CourtesyAcross`
  instruction text assertions
- `apps/client/src/features/game/CharlestonCourtesyPass.integration.test.tsx` — update to use
  `proceed-button` instead of `courtesy-pass-tiles-button`; remove assertions for modal
  elements; add assertions that Mahjong button is present and disabled
- `apps/client/src/components/game/phases/charleston-courtesy-pass.integration.test.tsx` —
  update or remove old panel-oriented assertions so the file matches the action-pane model

## Notes for Implementer

### Button-state matrix — Charleston sub-stages

This matrix defines the enabled/disabled logic for each sub-stage. Both buttons are always
rendered; the matrix says when each is enabled.

| Sub-stage                                                                             | Proceed enabled when                                                                                       | Mahjong enabled when |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------- |
| `FirstRight`, `FirstAcross`, `FirstLeft`, `SecondLeft`, `SecondAcross`, `SecondRight` | `canCommitCharlestonPass && !suppressCharlestonPassAction`                                                 | `canDeclareMahjong`  |
| `CourtesyAcross`                                                                      | `canSubmitCourtesyPass({ selectedTilesCount, courtesyPassCount, isBusy })`                                 | `canDeclareMahjong`  |
| `VotingToContinue`                                                                    | `canSubmitCharlestonVote(selectedTiles.length, hasSubmittedVote, isBusy) && !suppressCharlestonPassAction` | `canDeclareMahjong`  |

In all cases: if `disabled` is true both buttons are disabled regardless of the above.

`canDeclareMahjong` is a server-driven flag. Declaring Mahjong during Charleston is a legal
game action (a player who has Mahjong after receiving tiles may declare it immediately), but
the server currently keeps `canDeclareMahjong = false` during Charleston. That is a server bug.
This story surfaces the button on the frontend; the companion server fix already tracked in
`TODO.md` must enable `canDeclareMahjong` at the appropriate Charleston moments for the button
to become live. The frontend Mahjong button enabling condition (`canDeclareMahjong`) does not
change — once that server fix lands, the button will enable automatically.

### Testid consolidation scope

Only the **Charleston branch** of `ActionBarPhaseActions.tsx` is affected:

- `pass-tiles-button` → `proceed-button`
- `courtesy-pass-tiles-button` → `proceed-button`
- The existing `proceed-button` for `VotingToContinue` stays `proceed-button` (no change)

**Not changed by this story** (US-052 scope):

- `discard-button` (Playing/Discarding and Drawing)
- `call-window-proceed-button` (Playing/CallWindow)
- `declare-mahjong-button` in Playing phase (testid is already correct; just ensure the
  Charleston button uses the same testid)

### CourtesyPassPanel removal implications

`CourtesyPassPanel` used `onPropose(count)` → `handleCourtesyProposal(count)` to send a
count-based proposal. After removal, courtesy pass uses the existing action-pane tile-selection
model: the player stages 0–3 tiles from the rack and presses Proceed, which fires
`CommitCourtesyPass`. Verify that `handleCourtesyProposal` and the store actions it dispatches
can be cleaned up from `CharlestonPhase.tsx` if they are only called by `CourtesyPassPanel`
and not by the action-pane path.

`CourtesyNegotiationStatus` showed the outcome of a count negotiation between players. Once the
count negotiation modal is removed, the negotiation status is handled entirely in the action pane
instruction text and the standard "Waiting for other players…" line. No new UI is needed.

### Dependency on US-039

US-039 established persistent action controls (instruction text + Proceed always present). This
story tightens that model by making Mahjong the second persistent button alongside Proceed.
Do not remove the instruction text (`action-instruction`) — it remains above the button row.

### Pattern established for US-052

US-052 mirrors this exact two-button model for the Playing phase:

- Proceed (`proceed-button`) — enabled when a tile is staged for discard or a call can proceed
- Mahjong (`declare-mahjong-button`) — enabled when `canDeclareMahjong` is true

Writing the Charleston buttons in a shared helper or consistent pattern in
`ActionBarPhaseActions.tsx` will reduce the diff needed in US-052.

## Test Plan

- Update `ActionBarDerivations.test.ts`: assert `CourtesyAcross` instruction text equals
  `"Courtesy pass. Select 0–3 tiles for your across partner, then press Proceed."`.
- Update `CharlestonPhase.test.tsx`:
  - Remove the `vi.mock('../CourtesyPassPanel', ...)` mock (component no longer exists).
  - Assert `courtesy-pass-panel` is absent from the DOM during `CourtesyAcross`.
- For each Charleston sub-stage with a dedicated integration test, assert:
  - `proceed-button` is present in the DOM.
  - `declare-mahjong-button` is present in the DOM.
  - `courtesy-pass-panel` is absent from the DOM.
- In `CharlestonCourtesyPass.integration.test.tsx`:
  - Replace `courtesy-pass-tiles-button` queries with `proceed-button`.
  - Assert `courtesy-pass-panel` is not rendered during the courtesy stage.
  - Assert `declare-mahjong-button` is present and disabled during the courtesy stage.
- In `components/game/phases/charleston-courtesy-pass.integration.test.tsx`:
  - Remove or rewrite panel-specific assertions so the file validates the action-pane courtesy model instead of the deleted modal UI.
- Confirm that no test file still imports or references `CourtesyPassPanel` or
  `CourtesyNegotiationStatus` after deletion.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/ActionBarDerivations.test.ts
npx vitest run apps/client/src/components/game/phases/CharlestonPhase.test.tsx
npx vitest run apps/client/src/features/game/CharlestonCourtesyPass.integration.test.tsx
npx vitest run apps/client/src/components/game/phases/charleston-courtesy-pass.integration.test.tsx
npx vitest run apps/client/src/features/game/Charleston.integration.test.tsx
npx tsc --noEmit
npx prettier --write \
  apps/client/src/components/game/ActionBarPhaseActions.tsx \
  apps/client/src/components/game/ActionBarDerivations.ts \
  apps/client/src/components/game/phases/CharlestonPhase.tsx \
  docs/implementation/frontend/user-stories/US-051-charleston-action-pane-courtesy-pass-and-two-button-model.md \
  docs/implementation/frontend/user-stories/USER-TESTING-BACKLOG.md
```
