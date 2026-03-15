# US-059: Right Rail Charleston Hint Availability and Phase Scope Correction

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

Today the frontend hides the rail-owned hint section outside Playing, and the backend does not
provide Charleston hint payloads. As a result, Charleston loses both:

- strategic pattern guidance
- immediate discard/pass recommendations

That is a functional gap, not a sidebar-explanation problem.

## Scope

**In scope:**

- Expand the hint availability contract so the right-rail AI Hint section is active during both:
  - Playing
  - Charleston
- Add the required backend/Rust support so Charleston can request and receive hint results using the
  same analysis model as gameplay:
  - pattern recommendations
  - discard/pass recommendations
- Update the frontend phase gating so the existing rail-owned hint section renders during Charleston
  as well as Playing.
- Ensure Charleston hint requests use the existing AI Hint surface rather than a special-purpose
  Charleston-only rail panel.
- Keep Setup and historical/read-only states free of AI Hint content.

**Out of scope:**

- New right-rail explanation panels for Setup, Charleston, or read-only mode.
- Moving phase guidance from the top status/tracker area into the rail.
- Mobile hint redesign below `lg`.
- Reworking the visual layout of the right rail beyond what is required to make Charleston hints
  appear there.

## Acceptance Criteria

- AC-1: On `lg` screens, the AI Hint section is available during the Charleston phase in the same
  right-rail location used during Playing.
- AC-2: During Charleston, the rail can display both:
  - pass/discard recommendations
  - pattern recommendations
- AC-3: Charleston hint requests use the same rail-owned request/display flow as Playing; the UI
  does not branch into a separate Charleston-only hint component.
- AC-4: The backend sends usable hint payloads during Charleston instead of suppressing hint results
  outside Playing.
- AC-5: The frontend no longer hard-gates the right-rail hint section to Playing only.
- AC-6: During Setup, `right-rail-bottom` does not render AI Hint content.
- AC-7: During historical/read-only review, `right-rail-bottom` does not render AI Hint content and
  no new requests can be made.
- AC-8: This story does not add any explanatory right-rail phase panel for Setup, Charleston, or
  historical mode.
- AC-9: Phase guidance remains owned by the top messaging/status bar area rather than being moved to
  the rail.
- AC-10: Playing-phase hint behavior from `US-055` is preserved while Charleston support is added.

## Edge Cases

- EC-1: If hints are globally disabled, both Playing and Charleston suppress the request affordance
  consistently under the same hint-settings contract.
- EC-2: If the player transitions from Charleston into Playing with an existing hint visible, the
  hint surface remains coherent and does not remount into a broken state.
- EC-3: If the player enters historical/read-only view while a hint is visible, the rail does not
  present a new request affordance.
- EC-4: Charleston hint payloads must not reuse Playing-only wording that says "discard" when the
  action is functionally a pass recommendation unless that wording is intentionally normalized across
  both phases.

## Primary Files (Expected)

- `crates/mahjong_server/src/analysis/`
- `crates/mahjong_server/src/network/`
- `crates/mahjong_core/`
- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/RightRailHintSection.tsx`
- `apps/client/src/components/game/HintPanel.tsx`
- `apps/client/src/components/game/phases/PlayingPhase.tsx`
- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/hooks/useHintSystem.ts`
- `apps/client/src/components/game/RightRailHintSection.test.tsx`
- `apps/client/src/features/game/HintRightRail.integration.test.tsx`
- Rust tests covering Charleston hint availability / delivery

## Notes for Implementer

### Product correction

Do not solve this by filling the rail with explanation copy. That was the wrong interpretation.

The missing feature is Charleston hint availability itself.

### Server requirement

This story is explicitly cross-stack. The frontend cannot complete it alone because the backend is
currently not sending Charleston hint results.

### UX ownership

The rail owns AI hint content.

The top messaging bar / tracker owns phase guidance, timing, and instructional status.

Do not blur those responsibilities again.

## Test Plan

- Rust/server tests:
  - Charleston hint request is accepted
  - Charleston hint result is produced and delivered
- Frontend component tests:
  - right rail shows AI Hint section during Playing
  - right rail shows AI Hint section during Charleston
  - right rail shows no AI Hint content during Setup
  - right rail shows no AI Hint request affordance during historical/read-only mode
- Integration tests:
  - Charleston hint request -> response -> rail render
  - Playing hint request flow still works

## Verification Commands

```bash
cargo test --workspace
cd apps/client
npx vitest run src/components/game/RightRailHintSection.test.tsx
npx vitest run src/features/game/HintRightRail.integration.test.tsx
npx tsc --noEmit
```
