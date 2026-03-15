# US-063: Board Chrome Theme Compliance for History, Settings, and Rail Controls

## Status

- State: Proposed
- Priority: High
- Batch: G
- Implementation Ready: Yes

## Problem

`US-056` fixed themed internals for the history panel and settings modal content, but the board
chrome that launches and surrounds those surfaces is still inconsistent:

- top-right Settings / History controls do not visually integrate cleanly in light and dark themes
- right-rail wrappers and hint states still use hardcoded dark classes
- overlay banners and board-adjacent status elements still ignore the active theme in places

This leaves the user-facing result feeling unfinished even though the modal interiors improved.

## Scope

**In scope:**

- Theme-token compliance for board-level controls and wrappers tied to settings, history, and hints.
- Fix the launch buttons and adjacent chrome used in playing view for both light and dark mode.
- Remove hardcoded dark palette usage from right-rail hint wrappers and board overlays in the
  playing surface.
- Add tests that explicitly cover these board-level themed surfaces.

**Out of scope:**

- Rebuilding settings functionality.
- Rewriting history panel internals already covered by `US-056`.
- Reworking non-theme layout geometry beyond what is required for token compliance.

## Acceptance Criteria

- AC-1: The desktop Settings button renders legibly and intentionally in both light and dark mode.
- AC-2: The desktop History button renders legibly and intentionally in both light and dark mode.
- AC-3: The mobile hint/history/settings trigger set, if present in the same surface, follows the
  same theme-token rules as desktop controls.
- AC-4: No board-level settings/history trigger relies on hardcoded slate text/background classes
  that invert poorly in light mode.
- AC-5: `RightRailHintSection` uses theme-aware tokens for container, idle, loading, success, and
  error states rather than fixed dark palette classes.
- AC-6: Playing-phase overlays or banners adjacent to the board use theme-aware tokens or explicit
  light/dark pairs; no unreadable hardcoded dark-on-light combinations remain.
- AC-7: The repaired tests include explicit assertions for the top-right control chrome and the
  right-rail container in both themed class paths.
- AC-8: `US-056` is referenced in implementation notes as partial prior work, but this story stands
  on its own and does not assume the old story fully solved board-level theme compliance.

## Edge Cases

- EC-1: Disabled or read-only trigger states remain legible in both themes.
- EC-2: Error banners in the right rail remain visually distinct without falling back to hardcoded
  dark red surfaces.
- EC-3: Historical/replay overlays remain clearly differentiated from normal live-play status in
  both themes.

## Primary Files (Expected)

- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`
- `apps/client/src/components/game/RightRailHintSection.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx`
- `apps/client/src/components/game/GameBoard.test.tsx`
- `apps/client/src/components/game/RightRailHintSection.test.tsx`

## Notes for Implementer

### Recovery rule

Treat this as a board-chrome follow-up to `US-056`, not as a contradiction of it. The issue is that
the previous story solved modal and sheet internals while leaving visible entry points and adjacent
surfaces behind.

### Testing rule

Do not stop at "button click still works." This story is about theme correctness of visible board
chrome, so the tests need to assert classes/tokens on those surfaces directly.

## Test Plan

- Trigger-control tests:
  - settings button classes
  - history button classes
  - mobile trigger classes if applicable
- Right-rail tests:
  - idle state
  - loading state
  - error state
- Overlay tests:
  - read-only / replay / hint-adjacent banners do not use unreadable hardcoded dark classes

## Verification Commands

```bash
cd apps/client
npx vitest run src/components/game/RightRailHintSection.test.tsx
npx vitest run src/components/game/GameBoard.test.tsx
npx tsc --noEmit
```
