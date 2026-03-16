# US-063: Play Surface Theme Ownership and Board Chrome Compliance

Absorbs: `US-066` (Play Surface Theme Root Ownership and Board Chrome Integrity)

## Status

- State: Proposed
- Priority: Critical
- Batch: G
- Implementation Ready: Yes

## Problem

The play surface currently cheats on theme handling at two levels:

### P-1 -- Forced Dark Root (previously US-066)

`GameBoard.tsx` line 230 forces a `dark` class on the board wrapper:

```tsx
<div className="dark relative w-full h-screen bg-[image:var(--table-felt-gradient)]" ...>
```

This means the game surface does not inherit the app's active light/dark theme. The board is a
theme island locked to dark mode regardless of user preference. Every downstream component inherits
this forced context, which masks theme bugs and prevents light-mode from working on the board.

### P-2 -- Board Chrome Token Noncompliance (previously US-063)

`US-056` fixed themed internals for the history panel and settings modal content, but the board
chrome that launches and surrounds those surfaces is still inconsistent:

- top-right Settings / History controls do not visually integrate in light mode
- right-rail wrappers and hint states use hardcoded `bg-slate-900`, `bg-slate-800`, `text-slate-400`
  classes that assume a dark context
- overlay banners and board-adjacent status elements ignore the active theme

These two problems are coupled: fixing theme tokens (P-2) is meaningless while the root forces dark
(P-1), because you cannot test or verify light-mode compliance. They must be solved together, with
the root fix landing first.

## Scope

**In scope:**

- Remove the forced `dark` class from the `GameBoard` root wrapper.
- Make the play surface inherit the active app theme from the normal document/theme provider chain.
- Repair board-level controls and wrappers that only looked acceptable because the board was
  artificially dark:
  - top-right Settings and History buttons
  - right-rail container, separators, and hint section states (idle, loading, error)
  - playing-phase overlays and banners adjacent to the board
  - mobile trigger controls if present
- Replace hardcoded slate/dark palette classes with theme-aware tokens or explicit `dark:` / light
  pairs.
- Add tests that assert the absence of the forced dark root and verify theme token usage.

**Out of scope:**

- Rebuilding settings functionality.
- Rewriting history panel internals already covered by `US-056`.
- Right-rail edge geometry, staging clipping, or alignment-grid work (covered by `US-062`).
- Reworking the table-felt visual direction itself (the felt gradient token is theme-compatible).

## Acceptance Criteria

### Root Theme Fix (from US-066)

- AC-1: `GameBoard` does not apply a forced `dark` class to the play-surface root.
- AC-2: The play surface inherits the active app theme from the normal document/theme provider
  chain rather than creating a local theme island.
- AC-3: Tests explicitly assert the absence of a forced `dark` class on the `game-board` root.
- AC-4: If any board-level element still requires explicit light/dark styling after the root fix,
  it uses theme-aware tokens or explicit `dark:` pairs rather than relying on a forced dark root.

### Board Chrome Compliance (from US-063)

- AC-5: The desktop Settings button renders legibly and intentionally in both light and dark mode.
- AC-6: The desktop History button renders legibly and intentionally in both light and dark mode.
- AC-7: The mobile hint/history/settings trigger set, if present in the same surface, follows the
  same theme-token rules as desktop controls.
- AC-8: No board-level settings/history trigger relies on hardcoded slate text/background classes
  that invert poorly in light mode.
- AC-9: `RightRailHintSection` uses theme-aware tokens for container, idle, loading, success, and
  error states rather than fixed dark palette classes.
- AC-10: Playing-phase overlays or banners adjacent to the board use theme-aware tokens or explicit
  light/dark pairs; no unreadable hardcoded dark-on-light combinations remain.
- AC-11: The repaired tests include explicit assertions for the top-right control chrome and the
  right-rail container in both themed class paths.

## Edge Cases

- EC-1: The table felt background token remains visible and intentional in both themes.
- EC-2: Overlays that are intentionally color-coded (dead hand, call window) remain distinguishable
  after the root theme fix.
- EC-3: The board does not become unreadable in light mode because downstream chrome was authored
  against hardcoded dark assumptions.
- EC-4: Disabled or read-only trigger states remain legible in both themes.
- EC-5: Error banners in the right rail remain visually distinct without falling back to hardcoded
  dark red surfaces.
- EC-6: Historical/replay overlays remain clearly differentiated from normal live-play status in
  both themes.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx` -- remove forced dark, repair board chrome
- `apps/client/src/components/game/GameBoard.test.tsx` -- assert no forced dark root, theme classes
- `apps/client/src/components/game/RightRailHintSection.tsx` -- theme-aware tokens
- `apps/client/src/components/game/RightRailHintSection.test.tsx` -- theme assertions
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` -- repair
  hardcoded classes
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx` -- repair
  overlay/banner classes

## Notes for Implementer

### Order of operations

1. Remove the forced `dark` class from `GameBoard`'s root `<div>`.
2. Immediately verify what breaks visually in light mode -- this surfaces every hardcoded-dark
   assumption downstream.
3. Repair each broken surface with theme-aware tokens or `dark:` pairs.

Do not attempt step 3 before step 1. The forced dark root masks every downstream problem.

### Root ownership rule

The board wrapper may own layout, felt background, and stacking context. It must **not** own theme
mode. If a component only looks correct because an ancestor forces `dark`, that component is still
broken.

### Prior work

`US-056` solved modal and sheet internals. This story handles the board-level entry points and
adjacent surfaces that `US-056` left behind, plus the forced-dark root that prevented those fixes
from being testable in light mode.

### Testing rule

Do not stop at "button click still works." This story is about theme correctness of visible board
chrome, so the tests need to assert classes/tokens on those surfaces directly.

## Test Plan

- Root wrapper test:
  - assert `game-board` root does not include `dark` class
- Trigger-control tests:
  - settings button classes in light and dark
  - history button classes in light and dark
  - mobile trigger classes if applicable
- Right-rail tests:
  - idle state theme tokens
  - loading state theme tokens
  - error state theme tokens
- Overlay tests:
  - read-only / replay / hint-adjacent banners use theme-safe tokens
- Manual verification:
  - light mode full board
  - dark mode full board
  - modal open over board in both themes

## Verification Commands

```bash
cd apps/client
npx vitest run src/components/game/GameBoard.test.tsx
npx vitest run src/components/game/RightRailHintSection.test.tsx
npx tsc --noEmit
```
