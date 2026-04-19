# US-045: Frontend Regression Guardrails (E2E + Visual Baselines)

## Status

- State: Implemented
- Priority: High
- Batch: D

## Problem

Recent regressions passed unit and type checks while failing obvious in-browser behavior, indicating test coverage misses layout/state integration failures.

## Scope

- Add guardrail tests that validate real browser rendering and critical Charleston/Playing invariants.
- Establish baseline screenshots for key game phases and viewports.
- Fail CI when layout/state regressions reappear.
- Convert the recovery learnings into permanent automated gates rather than one-time validation.

## Acceptance Criteria

- AC-1: Add E2E assertion for Charleston tile-count legality after each pass stage transition.
- AC-2: Add E2E assertion for outgoing staging contiguous fill from slot 0.
- AC-3: Add visual snapshot checks for Charleston and Playing at 1280px+ and 1440px+.
- AC-4: CI run includes these checks in `check:all` or a required companion script.
- AC-5: The new tests fail against the pre-fix broken behavior before the fixes are accepted.
- AC-6: The new tests cover both Charleston/state integrity and layout/visual integrity; neither category may be omitted.

## Edge Cases

- EC-1: Snapshots are stable across environments (fonts/animations normalized).
- EC-2: Reduced-motion mode has deterministic snapshots and does not create false failures.

## Primary Files (Expected)

- `apps/client/e2e/*.spec.ts`
- `apps/client/e2e/support/gamePlay.ts`
- `package.json` scripts (`check:all` integration)
- `docs/implementation/frontend/user-stories/USER-TESTING-BACKLOG.md` (status updates)

## Notes for Implementer

- Use deterministic seeds/fixtures wherever possible.
- Disable non-essential animations for snapshot runs.
- Snapshot target should include the full board scene, not isolated components.
- Guardrails this story must close permanently:
  - unit tests that encode bad layout as acceptable
  - isolated component tests that miss multi-step gameplay drift
  - green CI that never exercises browser-visible failures
- Required artifact for this story:
  - at least one new script or `check:all` integration path that a future implementer cannot accidentally skip
- Snapshot discipline:
  - normalize fonts if necessary
  - force reduced motion or disable non-essential animation for captures
  - capture the whole board scene, including staging and action region
- Completion is blocked unless the CI path is actually wired, not just documented.

## Test Plan

- Add new E2E spec file for recovery regressions.
- Add at least two snapshot checkpoints:
  - Charleston pass stage (problem reproduction point)
  - Playing discard stage baseline
- Verify failures reproduce with current broken state before applying fixes.
- Include one assertion that inspects layout relationships in the browser, not just screenshot diffs.
- If `check:all` cannot include these directly, add a required companion script and document exactly where it is invoked.

## Verification Commands

```bash
npx playwright test
npx vitest run
npx tsc --noEmit
npm run check:all
```

## GPT-4.5 Proposed Scope

Invariant to protect: browser-visible board layout and multi-step Charleston state must be proven by browser-level guardrails, and those guardrails must be part of a required CI/script path that future implementers cannot skip.

Authoritative owners I’ll treat as fixed and only observe in E2E:

- Hand contents: the server snapshot, surfaced to the client as `gameState.your_hand` / derived client view.
- Staged incoming tiles: `useGameUIStore().stagedIncoming` in [gameUIStore.ts](/c:/Repos/mpmahj/apps/client/src/stores/gameUIStore.ts) and consumed in [CharlestonPhase.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.tsx).
- Outgoing staged order: phase-owned `selectedIds` mapped to outgoing tiles in the phase container.
- Commit eligibility: phase-owned booleans such as `canCommitPass` in [CharlestonPhase.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.tsx), with `StagingStrip`/`ActionBar` as render surfaces.

Scope checklist:

- In-scope AC/EC:
  - AC-1 with a browser test that validates Charleston tile-count legality across pass-stage transitions.
  - AC-2 with a browser test that validates outgoing staging fills contiguously from slot `0`.
  - AC-3 with full-board visual baselines for Charleston and Playing at `1280px` and `1440px`.
  - AC-4 with required script integration, because [package.json](/c:/Repos/mpmahj/package.json) `check:all` currently does not run Playwright.
  - AC-5 by reproducing the current guardrail gap first: CI can go green without browser-visible checks, which is the failure class this story exists to close.
  - AC-6 by covering both state integrity and layout/visual integrity in the new Playwright path.
  - EC-1 and EC-2 by normalizing animations/reduced motion in Playwright config or helpers so screenshots are deterministic.
- Files I expect to change:
  - likely a new spec under `apps/client/e2e/`, probably alongside or replacing parts of [board-layout-anchoring.spec.ts](/c:/Repos/mpmahj/apps/client/e2e/board-layout-anchoring.spec.ts)
  - [gamePlay.ts](/c:/Repos/mpmahj/apps/client/e2e/support/gamePlay.ts)
  - [playwright.config.ts](/c:/Repos/mpmahj/apps/client/playwright.config.ts)
  - [apps/client/package.json](/c:/Repos/mpmahj/apps/client/package.json)
  - [package.json](/c:/Repos/mpmahj/package.json)
  - [USER-TESTING-BACKLOG.md](/c:/Repos/mpmahj/docs/implementation/frontend/user-stories/USER-TESTING-BACKLOG.md)
- Tests I will add or update:
  - a new Playwright recovery/guardrails spec for Charleston tile-count legality and contiguous staging order
  - visual snapshot assertions for whole-board Charleston and Playing scenes at `1280` and `1440`
  - at least one browser geometry assertion in addition to screenshots
  - script/CI wiring validation by integrating the Playwright path into `check:all` or a required companion script invoked from it
- Explicit deferred items:
  - none planned; the story is blocked from completion without actual CI/script integration evidence, so I am treating that as mandatory rather than deferrable.

Current reproduction plan before edits:

- Document the present gap that [package.json](/c:/Repos/mpmahj/package.json) `check:all` omits Playwright entirely.
- Add the new Playwright guardrail spec/snapshots so they fail before wiring/fixes are complete.
- Use browser-level evidence, not component-only assertions.

---

## GPT-5.4 Implementation Summary

1. Invariant implemented  
   Browser-visible gameplay regressions must be caught by browser guardrails, not inferred from unit-level proxies. The guarded board scene now proves two classes of failure in Playwright: Charleston rack-count legality across the ordered pass-stage fixtures and contiguous outgoing staging fill from slot `0`, while whole-board Charleston and Playing screenshots at `1280x720` and `1440x900` protect layout regressions.

2. State owner(s) after the change  
   This story did not change gameplay ownership. It observes the owners established by prior recovery stories:
   current hand contents remain server-snapshot-owned via `gameState.your_hand`; Charleston staged incoming remains owned by `useGameUIStore().stagedIncoming`; outgoing staged order remains phase-owned `selectedIds`; commit eligibility remains phase-owned booleans consumed by render surfaces.

3. Tests added/updated  
   Added [frontend-recovery-guardrails.spec.ts](/c:/Repos/mpmahj/apps/client/e2e/frontend-recovery-guardrails.spec.ts) with:

- browser rack-count legality assertions across ordered Charleston pass-stage fixtures
- browser outgoing-staging contiguous-fill assertion from slot `0`
- board-local geometry assertions plus Charleston/Playing screenshot baselines at `1280x720` and `1440x900`

Updated [gamePlay.ts](/c:/Repos/mpmahj/apps/client/e2e/support/gamePlay.ts) to provide deterministic reduced-motion setup, rack-count helpers, and contiguous-slot assertions.

Added required script integration in [apps/client/package.json](/c:/Repos/mpmahj/apps/client/package.json) and [package.json](/c:/Repos/mpmahj/package.json) so `npm run check:all` now executes the recovery Playwright guardrail path.

1. Verification commands run  
   Executed successfully:

- `npx tsc --noEmit`
- `npx vitest run`
- `npm run test:e2e:recovery`
- `npm run check:all`

1. Residual risk or deferred proof  
   The Charleston legality E2E uses ordered browser fixtures rather than an authenticated live-room Charleston transition, because this local environment did not provide a Playwright auth session token. The proof type is still browser-level and CI-wired, but a token-backed live-transition expansion would strengthen AC-1 further if CI/session seeding is added later.
