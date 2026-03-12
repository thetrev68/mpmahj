# US-049: Charleston Blind Pass Face-Down Rendering and Receive-First Flow

## Status

- State: Proposed
- Priority: Critical
- Batch: E

## Problem

The current blind-pass experience is internally inconsistent and hard to understand:

- blind-pass candidates can render face-up and show a `PEEK` label, which contradicts the blind-pass concept
- the rack count appears to drop as if the player has already committed rack tiles, which breaks the intended "keep your hand intact" value of blind pass
- the pass-2 to pass-3 transition does not clearly separate "tiles I just received into my hand" from "tiles I may now forward blindly"

From a player perspective, blind pass should soften the Charleston requirement to pass 3 tiles. It should feel like a receive-first decision moment where the player keeps their current hand intact and may satisfy some or all of the outgoing pass using the newly received blind tiles.

## Scope

- Reframe blind pass in the UI as a receive-first decision moment.
- Keep the player rack visually intact during blind-pass selection.
- Show blind-pass candidates separately in staging as face-down incoming tiles.
- Remove the `PEEK` terminology from blind-pass staging.
- Stabilize the pass-2 -> pass-3 transition:
  - pass-2 received tiles auto-absorb into the rack
  - the rack auto-sorts after absorb
  - the newly absorbed tiles remain visually identifiable for a short period
  - blind-pass candidates then appear as the only staging tiles for pass 3
- Align instruction copy with the receive-first blind-pass model.

## Out of Scope

- Broader staging-strip width/layout work covered by `US-050`
- Courtesy-pass UX cleanup covered by `US-051`
- Any right-rail, hint, discard-pool, or gameplay action-pane redesign
- Backend protocol changes unless current frontend behavior proves impossible to express with the existing command/event model

## Acceptance Criteria

- AC-1: During blind-pass selection, the concealed rack shows the player's full legal pre-pass hand count for that seat/stage.
- AC-2: Blind-pass candidates appear in staging as a separate incoming group and do not visually replace rack tiles before the user chooses the outgoing 3.
- AC-3: Blind-pass staging tiles render face-down on initial render and remain face-down on hover.
- AC-4: Blind-pass staging uses `BLIND` labeling and does not show `PEEK`.
- AC-5: The blind-pass instruction text teaches the receive-first model: the player may choose the outgoing 3 from rack tiles, blind incoming tiles, or a mix.
- AC-6: End of pass 2 auto-absorbs the 3 received tiles into the rack without requiring an extra user action.
- AC-7: After pass-2 auto-absorb, the rack auto-sorts.
- AC-8: The 3 pass-2 received tiles remain visually identifiable after auto-absorb via a temporary highlight/halo/newly-received treatment.
- AC-9: Once blind pass begins, staging shows only the 3 blind-pass candidates, not a combined 6-tile staging state.
- AC-10: The player can complete the blind-pass outgoing 3 using:
  - 3 rack tiles
  - 3 blind staging tiles
  - any 1/2/3 split across rack and blind staging that totals 3

## Edge Cases

- EC-1: East blind-pass fixture keeps 14 rack tiles visible during selection; non-East blind-pass fixtures keep 13.
- EC-2: Reconnect/remount during blind-pass staging restores the correct split between rack tiles and blind staging without duplicating tiles.
- EC-3: Auto-sort after pass-2 absorb does not make the newly received tiles untraceable; the highlight survives the sort.
- EC-4: Mixed passes still compute correctly when the player chooses some tiles from the rack and some from blind staging.
- EC-5: If reveal-on-click remains in the product, revealed state must not break the receive-first rack-count invariant or the face-down hover rule for still-hidden tiles.

## Primary Files (Expected)

- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/components/game/StagingStrip.tsx`
- `apps/client/src/components/game/PlayerRack.tsx`
- `apps/client/src/components/game/ActionBar.tsx`
- `apps/client/src/components/game/ActionBarDerivations.ts`
- `apps/client/src/stores/gameUIStore.ts`
- `apps/client/src/lib/game-events/privateEventHandlers.ts`
- `apps/client/src/features/game/CharlestonFirstLeft.integration.test.tsx`
- `apps/client/src/features/game/CharlestonSecondRight.integration.test.tsx`
- `apps/client/src/features/game/Charleston.integration.test.tsx`

## Notes for Implementer

- Product framing to preserve:
  - blind pass is a receive-first decision moment
  - the player keeps their existing hand intact
  - blind incoming tiles are temporary pass candidates, not already-absorbed rack replacements
- Current code paths already model blind-pass tiles as staged incoming state, but the UX contract is still wrong in two ways:
  - blind staging can imply reveal/peek behavior
  - the rack/count presentation does not fully reflect the receive-first mental model
- Seat-aware count rule:
  - East should show 14 before the first discard
  - non-East players should show 13
  - do not hard-code `14` as a universal blind-pass invariant
- Transition contract:
  - pass-2 received tiles should auto-absorb into the rack first
  - then blind-pass candidates should appear as the new staging source
  - do not require `Proceed` just to move pass-2 tiles into the hand
  - do not show 6 staging tiles at once
- Copy direction:
  - replace `PEEK` with `BLIND`
  - preferred prompt direction:
    - `Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed.`
- Reveal-on-click remains an explicit product decision:
  - if it stays, treat it as a secondary UI behavior, not the core story of blind pass
  - if it goes, simplify tests and copy accordingly
- This story should build on the ownership guardrails from `US-043` and `US-044`, not reintroduce duplicate local/rack owners.

## Test Plan

- Add or update integration tests that prove the receive-first model in both blind-pass stages:
  - `FirstLeft`
  - `SecondRight`
- Add a blind-pass rack-count regression for at least one East fixture and, if available, one non-East fixture.
- Add tests covering all three outgoing composition patterns:
  - all 3 from rack
  - all 3 from blind staging
  - mixed rack + blind staging totaling 3
- Update component tests for `StagingStrip`:
  - blind tiles render face-down
  - hover does not reveal them
  - `BLIND` badge appears
  - `PEEK` badge does not appear in blind mode
- Update rack/phase tests to assert:
  - pass-2 received tiles auto-absorb
  - rack auto-sorts after absorb
  - newly received tiles remain visually identifiable after sort
  - blind-pass staging does not show a 6-tile combined state
- Add reconnect/remount regression coverage if the current blind-staging tests do not already prove the split survives reconciliation.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/StagingStrip.test.tsx
npx vitest run apps/client/src/components/game/phases/CharlestonPhase.test.tsx
npx vitest run apps/client/src/features/game/CharlestonFirstLeft.integration.test.tsx
npx vitest run apps/client/src/features/game/CharlestonSecondRight.integration.test.tsx
npx vitest run apps/client/src/features/game/Charleston.integration.test.tsx
npx tsc --noEmit
npx prettier --write docs/implementation/frontend/user-stories/US-049-charleston-blind-pass-face-down-and-receive-first-flow.md docs/implementation/frontend/user-stories/USER-TESTING-BACKLOG.md
```
