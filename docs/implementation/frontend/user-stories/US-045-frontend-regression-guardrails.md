# US-045: Frontend Regression Guardrails (E2E + Visual Baselines)

## Status

- State: Proposed
- Priority: High
- Batch: D

## Problem

Recent regressions passed unit and type checks while failing obvious in-browser behavior, indicating test coverage misses layout/state integration failures.

## Scope

- Add guardrail tests that validate real browser rendering and critical Charleston/Playing invariants.
- Establish baseline screenshots for key game phases and viewports.
- Fail CI when layout/state regressions reappear.

## Acceptance Criteria

- AC-1: Add E2E assertion for Charleston tile-count legality after each pass stage transition.
- AC-2: Add E2E assertion for outgoing staging contiguous fill from slot 0.
- AC-3: Add visual snapshot checks for Charleston and Playing at 1280px+ and 1440px+.
- AC-4: CI run includes these checks in `check:all` or a required companion script.

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

## Test Plan

- Add new E2E spec file for recovery regressions.
- Add at least two snapshot checkpoints:
  - Charleston pass stage (problem reproduction point)
  - Playing discard stage baseline
- Verify failures reproduce with current broken state before applying fixes.

## Verification Commands

```bash
npx playwright test
npx vitest run
npx tsc --noEmit
npm run check:all
```
