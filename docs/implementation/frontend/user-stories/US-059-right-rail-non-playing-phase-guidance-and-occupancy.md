# US-059: Right Rail Charleston Hint Availability (Frontend Phase Gating)

## Status

- State: Proposed
- Priority: High
- Batch: F
- Implementation Ready: Yes

## Problem

`US-055` was implemented as if the AI Hint rail should exist only during the Playing phase. That was
the wrong product interpretation.

The intended behavior is:

- Charleston: AI Hints are available in the right rail
- Playing: AI Hints are available in the right rail
- Setup: no AI Hint content
- Historical / read-only review: no AI Hint content

Today the frontend hides the rail-owned hint section outside Playing. The hint portal into
`right-rail-bottom` is rendered exclusively inside `PlayingPhase.tsx` (lines 272-285), so no other
phase can populate it. As a result, Charleston loses both:

- strategic pattern guidance
- immediate pass recommendations

### Server already supports Charleston hints

Investigation of the Rust codebase confirms the server has **no phase gating** on hint requests:

- `RequestHint` passes validation unconditionally (`validation.rs` — no phase check).
- `HintComposer::compose()` (`hint/mod.rs`) accepts `charleston_stage: Option<CharlestonStage>` and
  populates `charleston_pass_recommendations` when the stage is active.
- All three AI strategies (BasicBot, Greedy, MCTS) implement `select_charleston_tiles()`.
- Analysis cache is refreshed on `TilesPassed` and `TilesReceived` events during Charleston.

The gap is **frontend-only**: the portal rendering and `useHintSystem` hook are scoped to
`PlayingPhase`, preventing the existing server capability from reaching the user during Charleston.

## Scope

**In scope:**

- Move the right-rail hint portal rendering out of `PlayingPhase` so it is active during both
  Playing and Charleston phases.
- Wire `useHintSystem` (or equivalent) so that hint requests can be made during Charleston.
- Ensure `RightRailHintSection` renders `charleston_pass_recommendations` from the hint payload when
  in a Charleston stage.
- Keep Setup and historical/read-only states free of AI Hint content.

**Out of scope:**

- Server/Rust changes (server already supports Charleston hints).
- New right-rail explanation panels for Setup, Charleston, or read-only mode.
- Moving phase guidance from the top status/tracker area into the rail.
- Mobile hint redesign below `lg`.
- Reworking the visual layout of the right rail beyond what is required to make Charleston hints
  appear there.

## Acceptance Criteria

- AC-1: On `lg` screens, the AI Hint section is available during the Charleston phase in the same
  right-rail location used during Playing.
- AC-2: During Charleston, the rail can display:
  - pass recommendations (`charleston_pass_recommendations`)
  - pattern recommendations (when populated by server)
- AC-3: Charleston hint requests use the same rail-owned request/display flow as Playing; the UI
  does not branch into a separate Charleston-only hint component.
- AC-4: The frontend no longer hard-gates the right-rail hint section to `PlayingPhase` only.
- AC-5: During Setup, `right-rail-bottom` does not render AI Hint content.
- AC-6: During historical/read-only review, `right-rail-bottom` does not render AI Hint content and
  no new requests can be made.
- AC-7: This story does not add any explanatory right-rail phase panel for Setup, Charleston, or
  historical mode.
- AC-8: Phase guidance remains owned by the top messaging/status bar area rather than being moved to
  the rail.
- AC-9: Playing-phase hint behavior from `US-055` is preserved while Charleston support is added.

## Edge Cases

- EC-1: If hints are globally disabled, both Playing and Charleston suppress the request affordance
  consistently under the same hint-settings contract.
- EC-2: If the player transitions from Charleston into Playing with an existing hint visible, the
  hint surface remains coherent and does not remount into a broken state.
- EC-3: If the player enters historical/read-only view while a hint is visible, the rail does not
  present a new request affordance.
- EC-4: Charleston hint payloads should label pass recommendations as "pass" rather than "discard"
  unless that wording is intentionally normalized across both phases.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx` -- move portal target population here or to a
  shared wrapper
- `apps/client/src/components/game/phases/PlayingPhase.tsx` -- remove portal rendering (moved up)
- `apps/client/src/components/game/phases/CharlestonPhase.tsx` -- wire hint system if hook stays
  per-phase
- `apps/client/src/hooks/useHintSystem.ts` -- ensure it works outside PlayingPhase context
- `apps/client/src/components/game/RightRailHintSection.tsx` -- render Charleston pass
  recommendations
- `apps/client/src/components/game/HintPanel.tsx` -- handle Charleston-specific payload display
- `apps/client/src/components/game/RightRailHintSection.test.tsx`
- `apps/client/src/features/game/HintRightRail.integration.test.tsx`

## Notes for Implementer

### This is a frontend-only story

The server already accepts `RequestHint` during Charleston, runs the appropriate AI strategy, and
returns `charleston_pass_recommendations` in the `HintData` payload. No Rust changes are needed.

### Portal placement

The simplest approach: move the `createPortal(...)` call from `PlayingPhase.tsx` to `GameBoard.tsx`,
gated to `phase === 'Charleston' || phase === 'Playing'`. The right-rail slot
(`RIGHT_RAIL_HINT_SLOT_ID`) is already rendered unconditionally in `GameBoard`.

Alternatively, add the same portal rendering to `CharlestonPhase.tsx`. Either approach works; the
key constraint is that the portal must be populated during both phases.

### UX ownership

The rail owns AI hint content.

The top messaging bar / tracker owns phase guidance, timing, and instructional status.

Do not blur those responsibilities.

## Test Plan

- Frontend component tests:
  - right rail shows AI Hint section during Playing
  - right rail shows AI Hint section during Charleston
  - right rail shows no AI Hint content during Setup
  - right rail shows no AI Hint request affordance during historical/read-only mode
- Integration tests:
  - Charleston hint request -> mock server response -> rail render
  - Playing hint request flow still works
  - Charleston-to-Playing transition preserves hint state

## Verification Commands

```bash
cd apps/client
npx vitest run src/components/game/RightRailHintSection.test.tsx
npx vitest run src/features/game/HintRightRail.integration.test.tsx
npx tsc --noEmit
```
