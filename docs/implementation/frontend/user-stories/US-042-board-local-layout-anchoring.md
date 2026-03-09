# US-042: Board-Local Layout Anchoring and Collision Elimination

## Status

- State: Implemented
- Priority: Critical
- Batch: D

## Problem

The board was made nominally square, but core gameplay elements remain viewport-anchored (`fixed`) instead of board-anchored. This causes collisions/overlap and inconsistent geometry in Charleston and Playing phases.

## Scope

- Convert core gameplay layout from viewport-fixed anchoring to board-local anchoring.
- Ensure staging strip, player zone, and opponent racks are positioned relative to the square board scene.
- Preserve global overlays/dialogs as viewport-fixed only when they are truly global.
- Remove test expectations that currently encode viewport-fixed gameplay layout as correct behavior.

## Acceptance Criteria

- AC-1: `PlayerZone` and `StagingStrip` are board-local (not viewport `fixed`).
- AC-2: Opponent rack anchors in Charleston and Playing presentations are board-local and visually symmetric.
- AC-3: At 1280px and 1440px desktop widths, action controls, staging strip, and rack shells do not overlap each other.
- AC-4: Right rail remains reserved and does not intrude into board content.
- AC-5: Tests no longer assert `fixed` positioning for board-local gameplay layers.
- AC-6: Browser-level evidence exists for both Charleston and Playing baseline layouts at target desktop widths.

## Edge Cases

- EC-1: Small viewports remain usable without clipping critical controls.
- EC-2: Existing modals/dialogs/toasts continue to work as viewport overlays.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/PlayerZone.tsx`
- `apps/client/src/components/game/StagingStrip.tsx`
- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`

## Notes for Implementer

- Introduce a board-scene container (`relative`) as the single anchoring context.
- Avoid mixed coordinate systems for core table objects (do not combine viewport-fixed and board-absolute for the same layer).
- Keep only true global elements as `fixed`: full-screen dialogs, global reconnect banners, and game-end overlays.
- Current known contradiction to resolve:
  - `PlayerZone.tsx`, `StagingStrip.tsx`, `CharlestonPhase.tsx`, and `PlayingPhasePresentation.tsx` still contain viewport `fixed` positioning for gameplay elements.
  - `PlayerZone.test.tsx` currently expects `fixed`, which means the tests encode the regression instead of catching it.
- Authoritative layout owner for this story:
  - the board-scene container in `GameBoard.tsx`
  - not the viewport
- Proof type required for completion:
  - `unit` for class/structure assertions
  - `e2e` or `visual` for overlap/collision proof
- Completion is blocked if the story ends with "manual validation deferred" for overlap-related ACs.

## Test Plan

- Update unit tests to assert removal of viewport `fixed` classes from board-local components.
- Add/extend integration tests to verify no action/staging overlap in Charleston and Playing baseline states.
- Add visual regression captures for 1280x720 and 1440x900 board snapshots.
- Add at least one failing reproduction before the fix:
  - either an existing test updated to fail on current `fixed` anchoring
  - or a new browser-level layout assertion that demonstrates overlap/collision
- Explicitly update any tests that currently normalize the bad layout as expected behavior.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game
npx playwright test
npx tsc --noEmit
npm run check:all
```

---

## GPT-5.4 Proposed Scope (phase 1)

### Scope Checklist

Invariant to protect before editing: board-local gameplay layers must be anchored to the board scene in [GameBoard.tsx](c:/Repos/mpmahj/apps/client/src/components/game/GameBoard.tsx), not to the viewport. If the board moves or the viewport width changes, the player zone, staging strip, and opponent racks must move with the board and remain non-overlapping with the reserved right rail.

In scope AC/EC:

- `AC-1`: make `PlayerZone` and `StagingStrip` board-local, not `fixed`
- `AC-2`: make opponent rack anchors in Charleston and Playing board-local and symmetric
- `AC-3`: add browser-level proof for no overlap at `1280x720` and `1440x900` in both Charleston and Playing
- `AC-4`: preserve the right rail reservation
- `AC-5`: remove unit expectations that treat viewport-fixed gameplay layers as correct
- `AC-6`: add browser-level Charleston and Playing baseline evidence
- `EC-1`: keep smaller viewports usable while avoiding critical control clipping
- `EC-2`: keep true overlays/dialogs/toasts viewport-fixed

Authoritative owners I will keep:

- Layout anchoring owner: the board scene container inside [GameBoard.tsx](c:/Repos/mpmahj/apps/client/src/components/game/GameBoard.tsx)
- Hand contents: existing phase inputs (`gameState.your_hand` plus existing phase-local visual derivations), unchanged by this story
- Staged incoming tiles: existing phase owners only
  - Charleston: store-driven `stagedIncoming` bridged through [CharlestonPhase.tsx](c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.tsx)
  - Playing: `playing.stagedIncomingTile` passed into [PlayingPhasePresentation.tsx](c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx)
- Outgoing staged order: existing `selectedIds` / derived `outgoingTiles`, unchanged
- Commit eligibility: existing derived booleans in phase presenters, unchanged

Expected code files to change:

- [apps/client/src/components/game/GameBoard.tsx](c:/Repos/mpmahj/apps/client/src/components/game/GameBoard.tsx)
- [apps/client/src/components/game/PlayerZone.tsx](c:/Repos/mpmahj/apps/client/src/components/game/PlayerZone.tsx)
- [apps/client/src/components/game/StagingStrip.tsx](c:/Repos/mpmahj/apps/client/src/components/game/StagingStrip.tsx)
- [apps/client/src/components/game/phases/CharlestonPhase.tsx](c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.tsx)
- [apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx](c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx)

Tests I expect to add or update:

- Update [apps/client/src/components/game/PlayerZone.test.tsx](c:/Repos/mpmahj/apps/client/src/components/game/PlayerZone.test.tsx) to fail on viewport `fixed`
- Update [apps/client/src/components/game/StagingStrip.test.tsx](c:/Repos/mpmahj/apps/client/src/components/game/StagingStrip.test.tsx) to assert board-local structure instead of viewport anchoring
- Update [apps/client/src/components/game/GameBoard.test.tsx](c:/Repos/mpmahj/apps/client/src/components/game/GameBoard.test.tsx) to assert the board-scene anchoring contract and right-rail reservation
- Update [apps/client/src/components/game/phases/CharlestonPhase.test.tsx](c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.test.tsx) and [apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx](c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx) for board-local rack positioning
- Add a Playwright regression spec under `apps/client/e2e/` for Charleston and Playing layout overlap checks at `1280x720` and `1440x900`, with screenshots or bounding-box assertions as the guardrail

Reproduction plan first:

- Make the existing unit tests fail by removing the encoded `fixed` expectation and asserting the board-local invariant
- Add a browser-level Playwright check that demonstrates the current overlap/anchoring defect before fixing it, since this is a visual/layout regression

Explicit deferred items:

- None planned. If I can’t produce the required browser-level proof, I will stop rather than mark the story complete.

No linked component spec or linked scenario file was referenced from the US-042 story itself, so there was nothing additional to read there.

---

## GPT-5.4 Implementation Summary

### Implemented

Invariant: all board-local gameplay layers must anchor to the square board scene, not the viewport. That is now enforced in [GameBoard.tsx](c:/Repos/mpmahj/apps/client/src/components/game/GameBoard.tsx) through board-local positioning in [PlayerZone.tsx](c:/Repos/mpmahj/apps/client/src/components/game/PlayerZone.tsx), [StagingStrip.tsx](c:/Repos/mpmahj/apps/client/src/components/game/StagingStrip.tsx), [CharlestonPhase.tsx](c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.tsx), and [PlayingPhasePresentation.tsx](c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx).

State owners after the change:

- Layout anchoring owner: the square board scene in [GameBoard.tsx](c:/Repos/mpmahj/apps/client/src/components/game/GameBoard.tsx)
- Hand contents: unchanged, still from `gameState.your_hand` plus existing phase-local visual derivations
- Staged incoming tiles: unchanged
  - Charleston: store-owned `stagedIncoming` bridged in [CharlestonPhase.tsx](c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.tsx)
  - Playing: `playing.stagedIncomingTile` in [PlayingPhasePresentation.tsx](c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx)
- Outgoing staged order: unchanged, still derived from `selectedIds`
- Commit eligibility: unchanged, still derived in phase presenters (`canCommitPass`, `canCommitDiscard`)

### Guardrails

Tests added/updated:

- Added browser regression proof in [board-layout-anchoring.spec.ts](c:/Repos/mpmahj/apps/client/e2e/board-layout-anchoring.spec.ts) for Charleston and Playing at `1280x720` and `1440x900`
- Added offline browser fixture harness coverage in [App.test.tsx](c:/Repos/mpmahj/apps/client/src/App.test.tsx) and fixture-route support in [App.tsx](c:/Repos/mpmahj/apps/client/src/App.tsx)
- Updated [PlayerZone.test.tsx](c:/Repos/mpmahj/apps/client/src/components/game/PlayerZone.test.tsx), [StagingStrip.test.tsx](c:/Repos/mpmahj/apps/client/src/components/game/StagingStrip.test.tsx), [CharlestonPhase.test.tsx](c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.test.tsx), and [PlayingPhasePresentation.test.tsx](c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx) so they reject viewport-fixed gameplay anchoring

### Verification

Commands run:

- `npx vitest run apps/client/src/components/game apps/client/src/App.test.tsx`
- `npx playwright test e2e/board-layout-anchoring.spec.ts`
- `npx tsc --noEmit`
- `npm run check:all`

All of those passed. `npm run check:all` emitted a non-failing `knip` configuration hint about `@supabase/supabase-js`.

Residual risk:

- Browser proof is present, but it uses a dev/test offline fixture route rather than a live authenticated lobby flow. That was necessary because the current Playwright environment has no auth bootstrap/session token path. The layout proof still runs against the real browser DOM and target desktop viewports.
- I left unrelated existing doc/worktree changes untouched.
