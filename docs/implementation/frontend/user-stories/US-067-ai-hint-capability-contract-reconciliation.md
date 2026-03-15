# US-067: AI Hint Capability Contract Reconciliation

## Status

- State: Proposed
- Priority: Critical
- Batch: H
- Implementation Ready: Yes

## Problem

The hint system currently promises more capability than the client can actually request or render.

Today:

- the client hard-codes all hint requests to `Intermediate`
- the generated contract documents `best_patterns` as a Beginner-only field
- the UI currently behaves like an intermediate discard-only tool

That means restoring pattern rendering alone is not enough. Even if the panel grows a pattern
section, the current request/settings model may never supply the data needed to populate it.

This is a contract bug, not just a presentation bug.

## Scope

**In scope:**

- Reconcile hint settings, request behavior, and panel expectations into one coherent contract.
- Decide and implement one of these models:
  - keep a single user-facing hint mode and ensure it includes both discard + pattern guidance, or
  - restore multiple client-facing hint modes so pattern-capable payloads can actually be requested
- Update tests so the repaired capability contract is enforced end-to-end.

**Out of scope:**

- New backend analysis algorithms.
- Charleston hint UX.
- General rail layout or theme cleanup outside what is required to support the repaired contract.

## Acceptance Criteria

- AC-1: The user-facing hint contract and the requested server verbosity/capability are aligned.
- AC-2: The chosen product model is explicit in code and docs:
  - single mode with strategic pattern guidance, or
  - multiple modes with clear capability differences
- AC-3: The client does not hard-code a verbosity/capability level that makes required UI content
  unreachable.
- AC-4: If the product keeps a single "Use Hints" setting, successful hint requests still return
  enough strategic information to support both discard advice and pattern guidance.
- AC-5: If the product restores multiple hint modes, settings UI and request dialog behavior match
  the supported capability set exactly.
- AC-6: `HintPanel` and the rail consume the repaired contract without dead sections or impossible
  branches.
- AC-7: Tests fail if the client requests a capability level that cannot satisfy the required hint
  UI.
- AC-8: Tests fail if strategic pattern guidance is expected by the UI but impossible under the
  selected request/settings contract.
- AC-9: Canceling an in-flight hint request has an explicit, tested outcome:
  - return to idle, or
  - preserve prior hint intentionally
    The chosen behavior is documented and covered, not accidental.

## Edge Cases

- EC-1: Historical view still blocks new requests while preserving any intentionally retained
  existing hint content.
- EC-2: Turning hints off mid-session clears or suppresses hint content consistently with the chosen
  contract.
- EC-3: Timeout/error states do not leave the UI implying a strategic capability the client did not
  actually request.

## Primary Files (Expected)

- `apps/client/src/hooks/useHintSystem.ts`
- `apps/client/src/components/game/HintPanel.tsx`
- `apps/client/src/components/game/RightRailHintSection.tsx`
- `apps/client/src/components/game/HintSettingsSection.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx`
- `apps/client/src/components/game/HintPanel.test.tsx`
- `apps/client/src/hooks/useHintSystem.test.ts`
- `apps/client/src/features/game/HintRightRail.integration.test.tsx`
- `apps/client/src/types/bindings/generated/HintData.ts`

## Notes for Implementer

### Contract rule

Do not ship another hybrid where:

- settings say "hints are on"
- requests ask only for intermediate discard help
- UI claims to support strategic pattern guidance

One product story must own all three of those layers together.

### Relationship to prior stories

`US-064` restores visible pattern guidance in the panel. This story fixes the deeper capability
contract so that the required data can actually exist in normal use.

## Test Plan

- Hook tests:
  - requested capability matches settings
  - cancel behavior is explicit and stable
- Panel/rail tests:
  - strategic payload path renders correctly
  - discard-only path is only allowed if it matches the chosen product contract
- Integration tests:
  - request -> response -> rendered hint content
  - settings change -> request contract update

## Verification Commands

```bash
cd apps/client
npx vitest run src/hooks/useHintSystem.test.ts
npx vitest run src/components/game/HintPanel.test.tsx
npx vitest run src/features/game/HintRightRail.integration.test.tsx
npx tsc --noEmit
```
